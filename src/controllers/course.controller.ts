import mongoose from 'mongoose';
import cloudinary from 'cloudinary';
import ejs from 'ejs';

import { catchAsync } from '../utils/catchAsync';
import { NextFunction, Request, Response } from 'express';
import { createCourse, getAllCoursesService } from '../services/course.service';
import CourseModel from '../models/Course.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';
import path from 'path';
import sendMail from '../utils/sendMail';
import NotificationModel from '../models/Notification.model';
import LevelModel from '../models/Level.model';
import CategoryModel from '../models/Category.model';
import SubCategoryModel from '../models/SubCategory.model';
import UserModel from '../models/User.model';
import LessonModel from '../models/Lesson.model';
import SectionModel from '../models/Section.model';

export const getCoursesByUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;
    if (!userId) return next(new ErrorHandler('Unauthorized - user not found', 401));

    const user = await UserModel.findById(userId).select('uploadedCourses');
    if (!user) return next(new ErrorHandler('User not found', 404));

    const courses = await CourseModel.find({ _id: { $in: user.uploadedCourses } })
        .populate('category subCategory level')
        .lean();

    if (!courses.length) return next(new ErrorHandler('No courses found for this user', 404));

    res.status(200).json({ success: true, data: courses });
});

export const getCoursesWithSort = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.query;

    if (!type || !['recent', 'oldest', 'bestselling'].includes(type as string)) {
        return next(new ErrorHandler('Invalid type parameter. Use "recent", "oldest", or "bestselling".', 400));
    }

    let query = CourseModel.find({ isPublished: true });

    if (type === 'recent') {
        const threeDaysAgo = new Date();
        threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
        query = query
            .find({ createdAt: { $gte: threeDaysAgo } })
            .sort({ createdAt: -1 })
            .limit(3);
    } else if (type === 'oldest') {
        query = query.sort({ createdAt: 1 }).limit(10);
    } else if (type === 'bestselling') {
        query = query.sort({ purchased: -1 }).limit(1);
    }

    const courses = await query.lean();

    const coursesWithDetails = await Promise.all(
        courses.map(async (course) => {
            const sectionIds = course.sections || [];
            const lessonsCount = await LessonModel.countDocuments({ sectionId: { $in: sectionIds } });

            const durationInMinutes = course.duration || 0;
            const durationInHours = (durationInMinutes / 60).toFixed(1);

            return {
                ...course,
                lessonsCount,
                duration: `${durationInHours} hours`
            };
        })
    );

    res.status(200).json({
        success: true,
        data: coursesWithDetails
    });
});

export const uploadCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const data = req.body;

    createCourse(data, req, res, next);
});

export const updateCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    const data = req.body;

    // Cập nhật thumbnail nếu có
    if (typeof data.thumbnail === 'string' && data.thumbnail.startsWith('data:image')) {
        // Xoá thumbnail cũ nếu có
        if (course.thumbnail?.public_id) {
            await cloudinary.v2.uploader.destroy(course.thumbnail.public_id);
        }

        const uploaded = await cloudinary.v2.uploader.upload(data.thumbnail, {
            folder: 'courses'
        });

        data.thumbnail = {
            public_id: uploaded.public_id,
            url: uploaded.secure_url
        };
    }

    // Cập nhật course
    const updatedCourse = await CourseModel.findByIdAndUpdate(courseId, { $set: data }, { new: true });

    // Cập nhật Redis cache
    if (updatedCourse) {
        await redis.set(courseId, JSON.stringify(updatedCourse));
    }

    res.status(200).json({
        success: true,
        data: updatedCourse
    });
});

// publish course
export const publishCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { isPublished: false }, { new: true });

    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        data: courseAfterUpdated
    });
});

// unpublish course
export const unpublishCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(courseId);
        if (course) {
            await redis.set(courseId, JSON.stringify(course));
        }
    }

    // ✅ Update cả isPublished và isDraft
    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(
        courseId,
        {
            isPublished: false,
            isDraft: true
        },
        { new: true } // trả về bản ghi đã update
    );

    if (courseAfterUpdated) {
        await redis.set(courseId, JSON.stringify(courseAfterUpdated));
    }

    res.status(200).json({
        success: true,
        data: courseAfterUpdated
    });
});

// get single course without purchase
import { ICourseDetail } from '../interfaces/Course'; // interface mới
import OrderModel from '../models/Order.model';
import ProgressModel from '../models/Progress.model';
import { Types } from 'mongoose';
import QuizModel from '@/models/Quiz.model';

export const getSingleCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide course id', 400));
    }

    const course = await CourseModel.findById(courseId)
        .populate([
            { path: 'authorId', select: 'name email avatar profession description uploadedCourses introduce' },
            { path: 'level', select: 'name' },
            {
                path: 'sections',
                match: { isPublished: true },
                options: { sort: { order: 1 } },
                populate: {
                    path: 'lessons',
                    match: { isPublished: true },
                    options: { sort: { order: 1 } }
                }
            },
            {
                path: 'reviews',
                populate: {
                    path: 'user',
                    select: 'name avatar'
                }
            }
        ])
        .lean<ICourseDetail>();

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Tổng học sinh
    const instructorCourseIds = course.authorId?.uploadedCourses || [];
    const instructorCourses = await CourseModel.find({ _id: { $in: instructorCourseIds } }, 'purchased').lean();
    const totalStudents = instructorCourses.reduce((sum, c) => sum + (c.purchased || 0), 0);

    const totalCourses = instructorCourseIds.length;

    // Lọc video nếu không miễn phí
    const processedSections = Array.isArray(course.sections)
        ? course.sections.map((section) => ({
              ...section,
              lessons: Array.isArray(section.lessons)
                  ? section.lessons.map((lesson) => ({
                        ...lesson,
                        videoUrl: lesson.isFree ? lesson.videoUrl : undefined
                    }))
                  : []
          }))
        : [];

    const totalLessons = processedSections.reduce(
        (sum, section) => sum + (Array.isArray(section.lessons) ? section.lessons.length : 0),
        0
    );

    const durationInMinutes = typeof course.duration === 'number' ? course.duration : 0;
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    const durationText = `${hours}h ${minutes}m`;

    const responseCourse = {
        _id: course._id,
        name: course.name,
        subTitle: course.subTitle,
        description: course.description,
        thumbnail: course.thumbnail,
        demoUrl: course.demoUrl,
        price: course.price,
        estimatedPrice: course.estimatedPrice,
        isFree: course.isFree,
        purchased: course.purchased ?? 0,
        level: course.level?.name ?? null,
        rating: course.rating ?? 0,
        category: course.category,
        subCategory: course.subCategory,
        overview: course.overview || '',
        topics: Array.isArray(course.topics) ? course.topics : [],
        totalLessons,
        durationText,
        sections: processedSections,
        publisher: {
            name: course.authorId?.name || '',
            avatar: course.authorId?.avatar || '',
            email: course.authorId?.email || '',
            profession: course.authorId?.profession || '',
            description: course.authorId?.introduce || '',
            rating: course.rating ?? 0,
            reviews: Array.isArray(course.reviews) ? course.reviews.length : 0,
            students: totalStudents,
            courses: totalCourses
        },
        reviews: Array.isArray(course.reviews)
            ? course.reviews.map((r) => ({
                  _id: r._id,
                  rating: r.rating,
                  comment: r.comment,
                  user: {
                      name: r.user?.name || '',
                      avatar: r.user?.avatar || ''
                  },
                  commentReplies: Array.isArray(r.commentReplies) ? r.commentReplies : []
              }))
            : []
    };

    return res.status(200).json({
        success: true,
        courses: responseCourse
    });
});

export const getCourseById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    const course = await CourseModel.findById(courseId)
        .populate('category', 'title _id')
        .populate('subCategory', 'title _id')
        .populate('level', 'name _id')
        .populate({
            path: 'reviews',
            populate: {
                path: 'user',
                select: 'name avatar'
            }
        })
        .populate({
            path: 'sections',
            select: 'title lessons duration'
        });

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    res.status(200).json({
        success: true,
        courses: course
    });
});

// update lesson
export const updateLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }

    // Update the lesson with new data
    course.courseData = course.courseData.map((c: any) => {
        const match = c._id === lesson._id;
        const changeData: {
            title: string;
            description: string;
            videoLength: number;
            isFree: boolean;
            videoUrl?: any;
            links?: [{ title: string; url: string }];
            isPublished?: boolean;
        } = {
            title: data.title,
            description: data.description,
            isFree: data.isFree,
            videoLength: data.duration
        };
        if (data.videoUrl) changeData.videoUrl = data.videoUrl;
        if (data.links) changeData.links = data.links;
        if (data.isPublished) changeData.isPublished = data.isPublished;
        return match ? { ...c, ...changeData } : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// delete lesson
export const deleteLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }
    const sections = course.courseData.filter((c: any) => c.videoSection === lesson.videoSection);
    // Delete lesson
    if (sections.length === 1) {
        course.courseData = course.courseData.map((c: any) => {
            const match = c._id === lesson._id;
            return match
                ? {
                      ...c,
                      title: null,
                      description: null,
                      videoLength: null,
                      isFree: false,
                      videoUrl: null,
                      links: [],
                      isPublished: false,
                      isPublishedSection: false
                  }
                : c;
        });
    } else {
        course.courseData = course.courseData.filter((c: any) => {
            return c._id !== lesson._id;
        });
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// publish lesson
export const publishLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }

    if (!lesson.title || !lesson.description || !lesson.videoUrl) {
        return next(new ErrorHandler('Missing required fields', 400));
    }
    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c._id === lesson._id;
        return match
            ? {
                  ...c,
                  isPublished: true
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// unpublish lesson
export const unPublishLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }

    if (!lesson.title || !lesson.description || !lesson.videoUrl) {
        return next(new ErrorHandler('Missing required fields', 400));
    }
    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c._id === lesson._id;
        return match
            ? {
                  ...c,
                  isPublished: false
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// publish section
export const publishSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const sections = course.courseData.filter((c: any) => c.videoSection === data?.videoSection);

    if (sections.length === 0) {
        return next(new ErrorHandler('Section does not exist', 400));
    }

    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c.videoSection === data.videoSection;
        return match
            ? {
                  ...c,
                  isPublishedSection: true
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// unpublish section
export const unpublishSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const sections = course.courseData.filter((c: any) => c.videoSection === data?.videoSection);

    if (sections.length === 0) {
        return next(new ErrorHandler('Section does not exist', 400));
    }

    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c.videoSection === data.videoSection;
        return match
            ? {
                  ...c,
                  isPublishedSection: false
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// delete section
export const deleteSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const sections = course.courseData.filter((c: any) => c.videoSection === data?.videoSection);

    if (sections.length === 0) {
        return next(new ErrorHandler('Section does not exist', 400));
    }

    course.courseData = course.courseData.filter((c: any) => {
        return c.videoSection !== data.videoSection;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// get all courses without purchase
export const getAllCoursesWithoutPurchase = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const isCacheExist = await redis.get(`allCourses ${req.user?._id}`);
    let courses;

    if (isCacheExist) {
        courses = JSON.parse(isCacheExist);
    } else {
        const courses = await CourseModel.find({ isPublished: true }).select(
            '-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links'
        );
        redis.set(`allCourses ${req.user?._id}`, JSON.stringify(courses));
    }

    res.status(200).json({
        success: true,
        courses
    });
});

// get course content -- only for valid user

export const getAllPurchasedCoursesOfUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const purchasedCourses = req?.user?.purchasedCourses;

    if (!purchasedCourses || purchasedCourses.length === 0) {
        return next(new ErrorHandler('No purchased courses found', 404));
    }

    // Lấy thông tin khóa học từ cơ sở dữ liệu
    const courses = await CourseModel.find({
        _id: { $in: purchasedCourses }
    })
        .populate('authorId', 'name email')
        .populate('category', 'name')
        .populate('subCategory', 'name')
        .lean();

    if (!courses || courses.length === 0) {
        return next(new ErrorHandler('Courses not found', 404));
    }

    // Lấy thông tin tiến độ cho từng khóa học
    const coursesWithProgress = await Promise.all(
        courses.map(async (course) => {
            // Tìm tiến độ của khóa học theo user và courseId
            const progress = await ProgressModel.findOne({
                course: course._id,
                user: req.user._id // Lấy tiến độ cho người dùng hiện tại
            }).lean(); // sử dụng lean() để lấy kết quả là đối tượng JavaScript thay vì Mongoose document

            // Kiểm tra nếu progress không tồn tại hoặc bị lỗi
            if (!progress || Array.isArray(progress)) {
                return {
                    ...course,
                    progress: 0 // Nếu không có tiến độ, mặc định là 0%
                };
            }

            // Kiểm tra nếu progress có các trường totalCompleted và totalLessons
            const totalLessons = progress?.totalLessons || 0; // Kiểm tra progress là đối tượng
            const totalCompleted = progress?.totalCompleted || 0;

            // Tính toán phần trăm tiến độ
            const progressPercentage = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0; // Nếu không có lessons, trả về 0%

            // Số lượng phần của khóa học
            const sectionsCount = course.sections?.length || 0;

            // Thời gian tổng khóa học (đơn vị: giờ)
            const durationInHours = (course.duration / 60).toFixed(1);

            return {
                ...course,
                sectionsCount,
                duration: `${durationInHours} hours`,
                progress: progressPercentage // Thêm thông tin tiến độ vào dữ liệu khóa học
            };
        })
    );

    // Trả về dữ liệu khóa học với chi tiết và tiến độ
    res.status(200).json({
        success: true,
        data: coursesWithProgress
    });
});

// get uploaded course by instructor
export const getUploadedCourseByInstructor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userCourseList = req.user?.uploadedCourses;
    const courseId = req.params.id;

    const courseExists = userCourseList?.find((c: any) => c === courseId.toString());

    if (!courseExists) {
        return next(new ErrorHandler('You are not eligible to access this course', 404));
    }

    const course = await CourseModel.findById(courseId);

    course.courseData = course.courseData.sort((a: any, b: any) => {
        if (a.sectionOrder !== b.sectionOrder) {
            return a.sectionOrder - b.sectionOrder; // Sort by sectionOrder first
        }
        return a.lessonOrder - b.lessonOrder; // If sectionOrder is the same, sort by lessonOrder
    });

    res.status(200).json({
        success: true,
        course
    });
});

// get uploaded courses & purchased courses of instructor
export const getAllUploadedAndPurchasedCoursesOfInstructor = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const user = await UserModel.findById(req?.user?._id);

        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const purchasedCourses = await CourseModel.find({
            _id: { $in: user.purchasedCourses }
        }).select('-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links');

        const uploadedCourses = await CourseModel.find({
            _id: { $in: user.uploadedCourses }
        }).select('-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links');

        res.status(200).json({
            success: true,
            purchasedCourses,
            uploadedCourses
        });
    }
);

// add question in course
interface IAddQuestionData {
    question: string;
    courseId: string;
    contentId: string;
}

export const addQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { question, courseId, contentId } = req.body as IAddQuestionData;
    const course = await CourseModel.findById(courseId);

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler('Invalid content Id', 400));
    }

    const courseContent = course?.courseData?.find((c: any) => c._id.equals(contentId));

    if (!courseContent) {
        return next(new ErrorHandler('Course content is not exist', 400));
    }

    const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: []
    };

    courseContent.questions.push(newQuestion);

    await NotificationModel.create({
        user: req.user?._id,
        title: 'New Question Received',
        message: `You have a new question in ${courseContent.title}`,
        courseId: course._id,
        authorId: course.authorId
    });

    await course?.save();

    res.status(200).json({
        success: true,
        course
    });
});

// add answer in course question
interface IAddAnswerData {
    answer: string;
    courseId: string;
    contentId: string;
    questionId: string;
}

interface CourseFilter {
    isPublished: boolean;
    name?: string | { $regex: string; $options: string };
    subTitle?: string | { $regex: string; $options: string };
    level?: mongoose.Types.ObjectId;
    category?: mongoose.Types.ObjectId;
    subCategory?: mongoose.Types.ObjectId;
    authorId?: mongoose.Types.ObjectId;
    rating?: number;
    language?: string;
    price?: any;
    $or?: Array<Partial<Pick<CourseFilter, 'name' | 'subTitle'>>>;
}

export const addAnswer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { answer, courseId, contentId, questionId } = req.body as IAddAnswerData;
    const course = await CourseModel.findById(courseId);

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler('Invalid content Id', 400));
    }

    const courseContent = course?.courseData?.find((c: any) => c._id.equals(contentId));

    if (!courseContent) {
        return next(new ErrorHandler('Course content is not exist', 400));
    }

    const question = courseContent?.questions?.find((q: any) => q._id.equals(questionId));

    if (!question) {
        return next(new ErrorHandler('Invalid question Id', 400));
    }

    // create new answer object
    const newAnswer: any = {
        user: req.user,
        answer
    };

    //  add answer to course content
    question.questionReplies.push(newAnswer);

    await course?.save();

    if (req.user?._id === question.user._id) {
        // create a notification
        await NotificationModel.create({
            user: req.user?._id,
            title: 'New Question Reply Received',
            message: `You have a new question reply in ${courseContent.title}`,
            courseId: course._id,
            authorId: course.authorId
        });
    } else {
        const data = {
            name: question.user.name,
            title: courseContent.title
        };

        await ejs.renderFile(path.join(__dirname, '../mails', 'question-reply.ejs'), data);
        try {
            await sendMail({
                email: question.user.email,
                subject: 'Question Reply',
                template: 'question-reply.ejs',
                data
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    }
    res.status(200).json({
        success: true,
        course
    });
});

// add review for course
interface IAddReviewData {
    review: string;
    rating: number;
    userId: string;
}

export const addReview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userCourseList = req.user?.purchasedCourses;

    const courseId = req.params.id;

    const courseExists = userCourseList?.some((c: any) => c === courseId.toString());

    if (!courseExists) {
        return next(new ErrorHandler('You are not eligible to access this course', 404));
    }

    const course = await CourseModel.findById(courseId);

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    const { rating, review } = req.body as IAddReviewData;

    const reviewData: any = {
        user: req.user,
        rating,
        comment: review
    };

    course?.reviews.push(reviewData);

    // Calculate rating
    let totalRating = 0;

    course?.reviews.forEach((review: any) => {
        totalRating += review.rating;
    });

    course.rating = totalRating / course?.reviews.length;

    await course.save();

    await redis.set(courseId, JSON.stringify(course), 'EX', 604800);

    // create notification

    const notification = {
        user: req.user?._id,
        title: 'New Review Received',
        message: `${req.user?.name} has given review in ${course?.name}`,
        courseId: course._id,
        authorId: course.authorId
    };

    await NotificationModel.create(notification);

    res.status(200).json({
        success: true,
        course
    });
});

// add reply in review
interface IAddReviewData {
    comment: string;
    courseId: string;
    reviewId: string;
}

export const addReplyToReview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { comment, courseId, reviewId } = req.body as IAddReviewData;

    const course = await CourseModel.findById(courseId);

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    const review = course?.reviews?.find((r: any) => r._id.toString() === reviewId.toString());

    if (!review) {
        return next(new ErrorHandler('Review not found', 404));
    }

    const replyData: any = {
        user: req.user,
        comment
    };

    if (!review.commentReplies) {
        review.commentReplies = [];
    }

    review.commentReplies.push(replyData);

    await course.save();

    await redis.set(courseId, JSON.stringify(course), 'EX', 604800);

    res.status(200).json({
        success: true,
        course
    });
});

// get all courses -- for admin
export const getAllCourses = catchAsync(async (req: Request, res: Response, next: NextFunction) => [
    getAllCoursesService(res)
]);

// delete course -- for admin

export const deleteCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Tìm khóa học trong bảng Course
    const course = await CourseModel.findById(id);
    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Nếu khóa học có thumbnail, xóa nó khỏi Cloudinary
    if (course?.thumbnail?.public_id) {
        await cloudinary.v2.uploader.destroy(course.thumbnail.public_id);
    }

    // Xóa tất cả các section liên quan đến khóa học
    await SectionModel.deleteMany({ course: id });

    // Xóa tất cả các lesson liên quan đến các section của khóa học
    await LessonModel.deleteMany({ course: id });

    // Xóa khóa học khỏi bảng Course
    await course.deleteOne({ _id: id });

    // Cập nhật bảng User để xóa khóa học khỏi purchasedCourses và uploadedCourses
    await UserModel.updateMany(
        { purchasedCourses: id }, // Tìm người dùng đã mua khóa học
        { $pull: { purchasedCourses: id } } // Loại bỏ khóa học khỏi purchasedCourses
    );

    await UserModel.updateMany(
        { uploadedCourses: id }, // Tìm người dùng đã tải lên khóa học
        { $pull: { uploadedCourses: id } } // Loại bỏ khóa học khỏi uploadedCourses
    );

    // Xóa thông tin khóa học khỏi cache Redis (nếu có)
    await redis.del(id);

    // Trả về thông báo thành công
    res.status(200).json({
        success: true,
        message: 'Course, sections, and lessons deleted successfully'
    });
});

//get courses -- pagination

export const getCoursesLimitWithPagination = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: CourseFilter = { isPublished: true };
    if (req.query.search) {
        const search = req.query.search as string;
        filter.$or = [{ name: { $regex: search, $options: 'i' } }, { subTitle: { $regex: search, $options: 'i' } }];
    }

    if (req.query.level) {
        const levelDoc = await LevelModel.findOne({ name: new RegExp(`^${req.query.level}$`, 'i') });
        if (levelDoc) filter.level = levelDoc._id;
    }

    if (req.query.category) {
        const categoryDoc = await CategoryModel.findOne({ title: new RegExp(`^${req.query.category}$`, 'i') });
        if (categoryDoc) filter.category = categoryDoc._id;
    }

    if (req.query.subCategory) {
        const subCategoryDoc = await SubCategoryModel.findOne({ title: new RegExp(`^${req.query.subCategory}$`, 'i') });
        if (subCategoryDoc) filter.subCategory = subCategoryDoc._id;
    }

    if (req.query.authorId) {
        const authorDoc = await UserModel.findOne({ name: new RegExp(`^${req.query.authorId}$`, 'i') });
        if (authorDoc) filter.authorId = authorDoc._id;
    }

    if (req.query.rating) {
        const rating = parseInt(req.query.rating as string, 10);
        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
            filter.rating = rating;
        }
    }

    if (req.query.language) {
        filter.language = req.query.language as string;
    }

    if (req.query.price) {
        if (req.query.price === 'Free') {
            filter.price = 0;
        } else if (req.query.price === 'Paid') {
            filter.price = { $gt: 0 };
        }
    }

    const totalCourses = await CourseModel.countDocuments(filter);

    const rawCourses = await CourseModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('authorId', 'name email avatar profession')
        .populate('category', 'name')
        .lean();

    const coursesWithDetails = await Promise.all(
        rawCourses.map(async (course) => {
            const sectionIds = course.sections || [];

            const sections = await SectionModel.find({ _id: { $in: sectionIds } })
                .select('lessons')
                .lean();

            const totalSections = sections.length;
            const lessonIds = sections.flatMap((section) => section.lessons);
            const totalLessons = lessonIds.length;

            return {
                _id: course._id,
                name: course.name,
                subTitle: course.subTitle,
                thumbnail: course.thumbnail ? { url: course.thumbnail.url } : null,
                publisher: course.authorId,
                category: course.category,
                rating: course.rating,
                price: course.price,
                estimatedPrice: course.estimatedPrice,
                purchased: course.purchased,
                duration: (course.duration / 60).toFixed(1) + ' hours',
                totalSections,
                totalLessons
            };
        })
    );

    res.status(200).json({
        success: true,
        page,
        limit,
        totalCourses,
        totalPages: Math.ceil(totalCourses / limit),
        courses: coursesWithDetails
    });
});

// get Instructor courses review statistics
export const getInstructorReviewStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const instructorId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
        return next(new ErrorHandler('Invalid instructor ID', 400));
    }

    // Lấy tất cả khóa học của instructor kèm reviews
    const courses = await CourseModel.find({ authorId: instructorId }).select('reviews');

    if (!courses || courses.length === 0) {
        return res.status(200).json({
            average: 0,
            total: 0,
            stats: [5, 4, 3, 2, 1].map((star) => ({ star, percent: 0 }))
        });
    }

    // Gom tất cả reviews lại
    const allReviews = courses.flatMap((course) => course.reviews || []);

    const total = allReviews.length;
    if (total === 0) {
        return res.status(200).json({
            average: 0,
            total: 0,
            stats: [5, 4, 3, 2, 1].map((star) => ({ star, percent: 0 }))
        });
    }

    // Đếm số review cho từng sao 1–5
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sumRating = 0;

    allReviews.forEach((review) => {
        const rating = review.rating || 0;
        if (rating >= 1 && rating <= 5) {
            counts[rating] = (counts[rating] || 0) + 1;
            sumRating += rating;
        }
    });

    const average = sumRating / total;

    const stats = [5, 4, 3, 2, 1].map((star) => ({
        star,
        percent: Math.round((counts[star] / total) * 100)
    }));

    res.status(200).json({
        average: Number(average.toFixed(1)),
        total,
        stats
    });
});

export const getStudentStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const instructorId = req.params.id;

    // Lấy danh sách course của instructor
    const courses = await CourseModel.find({ authorId: instructorId }).select('_id');
    if (!courses.length) {
        return res.json({
            stats: generateEmptyYearStats() // Trả đủ 12 tháng rỗng
        });
    }

    const courseIds = courses.map((c) => c._id);

    // Lấy các order liên quan
    const orders = await OrderModel.find({ courseIds: { $in: courseIds } }).select('createdAt courseIds');

    // Khởi tạo map 12 tháng rỗng
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const statsMap: Record<string, { name: string; view: number; buy: number }> = {};
    monthNames.forEach((m) => {
        statsMap[m] = { name: m, view: 0, buy: 0 };
    });

    // Cộng dữ liệu vào đúng tháng
    orders.forEach((order) => {
        const created = new Date(order.createdAt);
        const month = created.toLocaleString('en-US', { month: 'short' }); // Jan, Feb ...
        if (!statsMap[month]) return;

        // Nếu có dữ liệu view log thì cộng vào view (tạm để 0)
        statsMap[month].buy += order.courseIds.length;
    });

    // Convert map -> array theo thứ tự tháng
    const stats = monthNames.map((m) => statsMap[m]);

    res.json({ stats });
});

// Helper tạo 12 tháng rỗng
function generateEmptyYearStats() {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames.map((m) => ({ name: m, view: 0, buy: 0 }));
}

export const getInstructorCourseStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const instructorId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
        return res.status(400).json({ success: false, message: 'Invalid instructor ID' });
    }

    try {
        // 1️⃣ Lấy tất cả courses của instructor
        const courses = await CourseModel.find({ authorId: instructorId }).select('_id isPublished');

        const totalCourses = courses.length;
        const pendingCourses = courses.filter((c) => !c.isPublished).length;
        const publishedCourses = courses.filter((c) => c.isPublished).length;

        // 2️⃣ Đếm số courses sold từ OrderModel
        // Giả sử Order có cấu trúc { courseIds: ObjectId[], ... }
        const courseIds = courses.map((c) => c._id);

        const orders = await OrderModel.find({ courseIds: { $in: courseIds } }).select('courseIds');
        let coursesSold = 0;
        orders.forEach((order) => {
            // đếm số lượng courses trong order trùng với instructor
            const matchedCourses = order.courseIds.filter((cid: any) => courseIds.some((id) => id.equals(cid)));
            coursesSold += matchedCourses.length;
        });

        return res.status(200).json({
            success: true,
            totalCourses,
            pendingCourses,
            publishedCourses,
            coursesSold
        });
    } catch (error) {
        console.error('Error fetching course stats:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

export const getLatestCourseStatus = catchAsync(async (req: Request, res: Response, next) => {
    const instructorId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
        return next(new ErrorHandler('Invalid instructor ID', 400));
    }

    // Lấy course mới nhất
    const latestCourse = await CourseModel.findOne({ authorId: instructorId })
        .sort({ createdAt: -1 })
        .select('_id name thumbnail isPublished createdAt sections');

    if (!latestCourse) {
        return res.status(200).json({
            success: true,
            course: null
        });
    }

    // Xác định trạng thái
    const status = latestCourse.isPublished ? 'published' : latestCourse.sections?.length ? 'pending' : 'draft';

    // Tính progress: ví dụ coi tổng số section là 2 bước (title + section)
    const stepsTotal = 2;
    const stepsCompleted = status === 'draft' ? 1 : stepsTotal;

    res.status(200).json({
        success: true,
        course: {
            _id: latestCourse._id,
            name: latestCourse.name,
            thumbnail: latestCourse.thumbnail?.url || '/assets/images/default-course.png',
            status,
            stepsCompleted,
            stepsTotal
        }
    });
});

export const getTopCourses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const topCourses = await CourseModel.find({ isPublished: true })
        .sort({ rating: -1, purchased: -1 })
        .limit(10)
        .populate('authorId', 'name email avatar profession')
        .populate('category', 'name')
        .lean();

    if (!topCourses || topCourses.length === 0) {
        return next(new ErrorHandler('No courses found', 404));
    }

    const coursesWithDetails = await Promise.all(
        topCourses.map(async (course) => {
            const sectionIds = course.sections || [];

            // Lấy tất cả section
            const sections = await SectionModel.find({ _id: { $in: sectionIds } })
                .select('lessons')
                .lean();

            const totalSections = sections.length;
            const lessonIds = sections.flatMap((section) => section.lessons);
            const totalLessons = lessonIds.length;

            return {
                _id: course._id,
                name: course.name,
                subTitle: course.subTitle,
                thumbnail: course.thumbnail ? { url: course.thumbnail.url } : null,
                publisher: course.authorId,
                category: course.category,
                rating: course.rating,
                price: course.price,
                estimatedPrice: course.estimatedPrice,
                purchased: course.purchased,
                duration: (course.duration / 60).toFixed(1) + ' hours',
                totalSections,
                totalLessons
            };
        })
    );

    res.status(200).json({
        success: true,
        courses: coursesWithDetails
    });
});

export const searchCoursesAndInstructors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { search } = req.body;

    if (!search) {
        return res.status(400).json({
            success: false,
            message: 'Search query is required'
        });
    }

    const regex = new RegExp(search, 'i');

    const courses = await CourseModel.find({
        $or: [{ name: regex }, { description: regex }]
    })
        .select('name description authorId thumbnail')
        .populate('authorId', 'name role ');

    const instructors = await UserModel.find({
        name: regex,
        role: 'instructor'
    }).select('name role avatar');

    res.status(200).json({
        success: true,
        courses,
        instructors
    });
});
export const generateVideoCloudinarySignature = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { folder } = req.body;

    if (!folder) {
        return next(new ErrorHandler('Folder name is required', 400));
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // Ensure you are signing all parameters you will send in the upload request
    const signature = cloudinary.v2.utils.api_sign_request(
        {
            timestamp,
            folder
        },
        process.env.CLOUD_API_SECRET || ''
    );

    res.status(200).json({ timestamp, signature });
});

export const getSignatureForDelete = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { publicId } = req.body;

    if (!publicId) {
        return next(new ErrorHandler('publicId is required', 400));
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // Correct parameters for the signature
    const params = {
        public_id: publicId, // Use `public_id` (with underscore)
        timestamp: timestamp
    };

    // Generate the signature
    const signature = cloudinary.v2.utils.api_sign_request(params, process.env.CLOUD_API_SECRET || '');

    res.status(200).json({ timestamp, signature });
});

// update lesson completion status
export const updateLessonCompletionStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;
    const { lessonId, isCompleted } = req.body;

    if (!courseId || !lessonId) {
        return next(new ErrorHandler('Course ID and Lesson ID are required', 400));
    }

    // Find the course
    const course = await CourseModel.findById(courseId);
    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Find the lesson in courseData and update its isCompleted status
    const lesson = course.courseData.id(lessonId);
    if (!lesson) {
        return next(new ErrorHandler('Lesson not found', 404));
    }

    lesson.isCompleted = isCompleted;
    await course.save();

    // Update redis cache
    await redis.set(courseId, JSON.stringify(course));

    res.status(200).json({
        success: true,
        message: 'Lesson completion status updated successfully'
    });
});

// ===== Helper: đếm tổng lesson publish của course (đúng order) =====
async function countTotalLessonsOfCourse(courseId: string) {
    const sections = await SectionModel.find({ course: courseId, isPublished: true })
        .sort({ order: 1 })
        .select('_id lessons') // items không cần ở đây
        .populate({
            path: 'lessons',
            match: { isPublished: true },
            select: '_id',
            options: { sort: { order: 1 } }
        })
        .lean();

    const total = sections.reduce((sum: number, s: any) => sum + (s.lessons?.length || 0), 0);
    return { sections, total };
}

// ===== Helper: seed progress nếu chưa có (tạo rỗng tất cả lesson publish) =====
async function ensureProgressSeeded(userId: string, courseId: string) {
    let progress = await ProgressModel.findOne({ user: userId, course: courseId }).lean();
    if (progress) return progress;

    const { sections } = await countTotalLessonsOfCourse(courseId);

    const completedSections = sections.map((sec: any) => ({
        sectionId: sec._id,
        lessons: (sec.lessons || []).map((l: any) => ({
            lessonId: l._id,
            isCompleted: false
        }))
    }));

    const created = await ProgressModel.create({
        user: userId,
        course: courseId,
        completedSections
    });

    const fresh = await ProgressModel.findById(created._id).lean();
    return fresh!;
}

// ===== Handler: lấy đủ items + quizzes, build order/title đúng =====

export const getSingleCourseFullDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const dbgOn = process.env.QUIZ_DEBUG === '1';
    const dbg = (label: string, payload?: any) => {
        if (!dbgOn) return;
        try {
            const safe = payload && typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : payload;
            // eslint-disable-next-line no-console
            console.log(`[COURSE:detail] ${label}`, safe);
        } catch {
            console.log(`[COURSE:detail] ${label}`, payload);
        }
    };

    const courseId = req.params.id as string;
    const userId = req.user?._id as string | undefined;
    if (!courseId) return next(new ErrorHandler('Please provide course id', 400));

    const course = await CourseModel.findById(courseId).populate([
        { path: 'authorId', select: 'name email avatar profession description uploadedCourses introduce' },
        { path: 'level', select: 'name' },
        { path: 'category', select: 'name' },
        { path: 'subCategory', select: 'name' }
    ]);
    if (!course) return next(new ErrorHandler('Course not found', 404));

    // 1) Sections
    const sections = await SectionModel.find({ _id: { $in: course.sections }, isPublished: true })
        .sort({ order: 1 })
        .select('_id title order courseId')
        .lean<any[]>();

    const sectionIds = sections.map((s) => s._id);

    // 2) Lessons
    const lessons = await LessonModel.find({ sectionId: { $in: sectionIds }, isPublished: true })
        .select('_id title order videoLength isFree videoUrl sectionId')
        .lean<any[]>();

    // 3) Quizzes (+ những field cần cho progress)
    const quizzes = await QuizModel.find({ sectionId: { $in: sectionIds } })
        .select(
            '_id sectionId order name examTitle duration difficulty totalQuestions isPublished passingScore userScores.user userScores.score userScores.attemptedAt'
        )
        .lean<any[]>();

    // 4) Progress (lessons) từ Enrollment/Progress của bạn
    let progressDoc: any = null;
    if (userId) progressDoc = await ensureProgressSeeded(String(userId), String(courseId));

    // Map bài học đã completed theo section
    const completedMap = new Map<string, Set<string>>();
    for (const sec of progressDoc?.completedSections || []) {
        const sid = String(sec.sectionId);
        const set = new Set<string>();
        for (const l of sec.lessons || []) if (l?.isCompleted) set.add(String(l.lessonId));
        completedMap.set(sid, set);
    }

    // 4b) Quiz progress từ chính QuizModel.userScores (lọc theo user hiện tại)
    // quizProgressMap: quizId -> { attempts, lastScore, bestScore, lastAttemptAt, isCompleted, isPassed }
    // 4b) Quiz progress theo LATEST attempt
    const quizProgressMap = new Map<
        string,
        {
            attempts: number;
            lastScore: number | null; // = latest attempt score
            bestScore: number | null;
            lastAttemptAt: Date | null;
            isCompleted: boolean; // có attempt là completed
            isPassed: boolean; // ✅ theo latest attempt
            latestAttempt?: {
                attemptId?: string;
                score: number;
                attemptedAt: Date | null;
                percentage?: number;
            };
            passingScore?: number;
        }
    >();

    if (Array.isArray(quizzes) && userId) {
        for (const q of quizzes) {
            const attempts = (Array.isArray(q.userScores) ? q.userScores : [])
                .filter((s: any) => String(s?.user) === String(userId))
                .sort((a: any, b: any) => {
                    const ta = a?.attemptedAt ?? a?.createdAt ?? 0;
                    const tb = b?.attemptedAt ?? b?.createdAt ?? 0;
                    return new Date(tb).getTime() - new Date(ta).getTime();
                });

            if (attempts.length === 0) continue;

            const latest = attempts[0];
            const lastScore = Number(latest?.score ?? 0);
            const bestScore = Math.max(...attempts.map((a: any) => Number(a?.score ?? 0)));
            const lastAttemptAt = latest?.attemptedAt
                ? new Date(latest.attemptedAt)
                : latest?.createdAt
                  ? new Date(latest.createdAt)
                  : null;
            const passingScore = Number(q.passingScore ?? 0);
            const isPassed = lastScore >= passingScore; // ✅ theo lần gần nhất

            const percentage = q?.totalQuestions ? Math.round((lastScore / Number(q.totalQuestions)) * 100) : undefined;

            quizProgressMap.set(String(q._id), {
                attempts: attempts.length,
                lastScore,
                bestScore,
                lastAttemptAt,
                isCompleted: true,
                isPassed,
                passingScore,
                latestAttempt: {
                    attemptId: latest?._id ? String(latest._id) : undefined,
                    score: lastScore,
                    attemptedAt: lastAttemptAt,
                    percentage
                }
            });
        }
    }

    if (Array.isArray(quizzes) && userId) {
        for (const q of quizzes) {
            const attempts = (Array.isArray(q.userScores) ? q.userScores : [])
                .filter((s: any) => String(s?.user) === String(userId))
                .sort((a: any, b: any) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());

            if (attempts.length === 0) continue;

            const lastScore = Number(attempts[0]?.score ?? 0);
            const bestScore = Math.max(...attempts.map((a: any) => Number(a?.score ?? 0)));
            const lastAttemptAt = attempts[0]?.attemptedAt ? new Date(attempts[0].attemptedAt) : null;
            const passingScore = Number(q.passingScore ?? 0);
            const isPassed = lastScore >= passingScore; // hoặc bestScore >= passingScore, tuỳ yêu cầu
            quizProgressMap.set(String(q._id), {
                attempts: attempts.length,
                lastScore,
                bestScore,
                lastAttemptAt,
                isCompleted: true,
                isPassed
            });
        }
    }

    dbg('quizProgressMap.size', quizProgressMap.size);

    // 5) Group theo sectionId
    const lessonsBySection: Record<string, any[]> = Object.create(null);
    const quizzesBySection: Record<string, any[]> = Object.create(null);
    for (const sid of sectionIds) {
        lessonsBySection[String(sid)] = [];
        quizzesBySection[String(sid)] = [];
    }
    for (const l of lessons) lessonsBySection[String(l.sectionId)].push(l);
    for (const q of quizzes) quizzesBySection[String(q.sectionId)].push(q);

    // 6) Build section items
    const processedSections = sections.map((section: any) => {
        const sid = String(section._id);
        const doneSet = completedMap.get(sid) ?? new Set<string>();

        const secLessons = (lessonsBySection[sid] || []).map((l: any) => ({
            ...l,
            isCompleted: doneSet.has(String(l._id)),
            videoUrl: l.isFree ? l.videoUrl : undefined
        }));

        const secQuizzes = (quizzesBySection[sid] || []).map((q: any) => {
            const qp = quizProgressMap.get(String(q._id));
            const title = q.name ?? q.examTitle ?? 'Untitled quiz';
            return {
                ...q,
                // ✅ các cờ FE đang dùng
                isCompleted: !!qp,
                isPassed: !!qp?.isPassed,
                lastScore: qp?.lastScore ?? null,
                bestScore: qp?.bestScore ?? null,
                attempts: qp?.attempts ?? 0,
                lastAttemptAt: qp?.lastAttemptAt ?? null,
                name: title,
                title
            };
        });

        // MIX + sort
        const lessonItems = secLessons.map((l: any) => ({
            kind: 'lesson' as const,
            _id: l._id,
            order: typeof l.order === 'number' ? l.order : 0,
            title: l.title,
            payload: l
        }));
        const quizItems = secQuizzes.map((q: any) => ({
            kind: 'quiz' as const,
            _id: q._id,
            order: typeof q.order === 'number' ? q.order : 0,
            name: q.name,
            title: q.name,
            payload: q
        }));
        const items = [...lessonItems, ...quizItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        // Progress section — có 2 kiểu, bạn chọn 1:
        // a) chỉ tính theo lessons (giữ nguyên)
        const completedLessonsCount = secLessons.filter((l: any) => l.isCompleted).length;
        const totalLessonsInSection = secLessons.length;
        const sectionProgressPercentage = totalLessonsInSection
            ? Math.round((completedLessonsCount / totalLessonsInSection) * 100)
            : 0;

        // b) tính theo tổng (lessons + quizzes)
        const completedQuizzesCount = secQuizzes.filter((q: any) => q.isPassed).length;
        const totalQuizzesInSection = secQuizzes.length;
        const totalItemsInSection = totalLessonsInSection + totalQuizzesInSection;
        const sectionProgressAllPercent = totalItemsInSection
            ? Math.round(((completedLessonsCount + completedQuizzesCount) / totalItemsInSection) * 100)
            : 0;

        return {
            _id: section._id,
            title: section.title,
            order: section.order,
            lessons: secLessons,
            quizzes: secQuizzes,
            items,
            // giữ số liệu cũ + thêm số liệu all-items để bạn muốn hiển thị kiểu nào cũng được
            completedCount: completedLessonsCount,
            totalLessonsInSection,
            sectionProgressPercentage, // legacy (lessons only)
            sectionItemsCompleted: completedLessonsCount + completedQuizzesCount, // new
            totalItemsInSection, // new
            sectionProgressAllPercent // new
        };
    });

    // 7) Tổng số lesson publish
    const totalLessons = processedSections.reduce((sum, s) => sum + (s.totalLessonsInSection || 0), 0);
    // 7b) Tổng số quiz
    const totalQuizzes = processedSections.reduce((sum, s) => sum + (s.quizzes?.length || 0), 0);

    // 8) Tổng quan progress
    let progressSummary: any = null;
    if (userId) {
        // a) legacy: chỉ lessons
        const totalCompletedLessons = processedSections.reduce((acc, s) => acc + (s.completedCount || 0), 0);
        const progressLessonsOnly = totalLessons ? Math.round((totalCompletedLessons / totalLessons) * 100) : 0;

        // b) all items: lessons + quizzes
        const totalCompletedItems = processedSections.reduce((acc, s) => acc + (s.sectionItemsCompleted || 0), 0);
        const totalItems = totalLessons + totalQuizzes;
        const progressAll = totalItems ? Math.round((totalCompletedItems / totalItems) * 100) : 0;

        // 👉 chọn cái nào bạn muốn FE dùng. Mình trả cả 2 cho bạn linh hoạt.
        progressSummary = {
            totalLessons, // legacy field
            totalCompleted: totalCompletedLessons, // legacy field
            progressPercentage: progressLessonsOnly, // legacy field (giữ tương thích)
            // new fields:
            totalQuizzes,
            totalItems,
            totalCompletedItems,
            progressAllPercentage: progressAll
        };
    }

    // 9) Publisher stats
    const instructorCourseIds = course.authorId?.uploadedCourses || [];
    const instructorCourses = instructorCourseIds.length
        ? await CourseModel.find({ _id: { $in: instructorCourseIds } }, 'purchased').lean()
        : [];
    const totalStudents = instructorCourses.reduce((sum, c: any) => sum + (c.purchased || 0), 0);
    const totalCourses = instructorCourseIds.length;

    const durationInMinutes = typeof course.duration === 'number' ? course.duration : 0;
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    const durationText = `${hours}h ${minutes}m`;

    dbg('response.progress', progressSummary);

    return res.status(200).json({
        success: true,
        course: {
            _id: course._id,
            name: course.name,
            subTitle: course.subTitle,
            description: course.description,
            thumbnail: course.thumbnail,
            demoUrl: course.demoUrl,
            price: course.price,
            estimatedPrice: course.estimatedPrice,
            isFree: course.isFree,
            purchased: course.purchased ?? 0,
            level: course.level?.name ?? null,
            reviews: course.reviews || [],
            rating: course.rating ?? 0,
            category: course.category,
            subCategory: course.subCategory,
            overview: course.overview || '',
            topics: Array.isArray(course.topics) ? course.topics : [],
            durationText,
            totalLessons,
            sections: processedSections, // đã MIX & có quiz progress
            progress: progressSummary, // có cả legacy (lessons) & all-items
            publisher: {
                name: course.authorId?.name || '',
                avatar: course.authorId?.avatar || '',
                email: course.authorId?.email || '',
                profession: course.authorId?.profession || '',
                description: course.authorId?.introduce || '',
                rating: course.rating ?? 0,
                students: totalStudents,
                courses: totalCourses
            }
        }
    });
});

export const getReviewCourseById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide course id', 400));
    }

    const course = await CourseModel.findById(courseId).populate([
        { path: 'category', select: 'name' },
        { path: 'level', select: 'name' }
    ]);

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    const sections = await SectionModel.find({
        _id: { $in: course.sections },
        isPublished: true
    })
        .sort({ order: 1 })
        .populate({
            path: 'lessons',
            match: { isPublished: true },
            options: { sort: { order: 1 } }
        })
        .lean();

    const curriculum = sections.map((section) => ({
        id: section.id,
        title: section.title,
        lessons: Array.isArray(section.lessons)
            ? section.lessons.map((lesson: any) => ({
                  id: lesson._id,
                  type: lesson.type,
                  title: lesson.title,
                  url: lesson.videoUrl.url || lesson.documentUrl || '',
                  thumbnail: lesson.thumbnail || ''
              }))
            : []
    }));

    return res.status(200).json({
        success: true,
        course: {
            title: course.name,
            category: course.category?.name || '',
            skillLevel: course.level?.name || '',
            tags: course.tags?.split(',') || [],
            originalPrice: course.estimatedPrice,
            salePrice: course.price,
            description: course.description,
            thumbnail: course.thumbnail?.url || '',
            curriculum
        }
    });
});

export const checkCoursePurchased = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Course ID is required', 400));
    }

    if (!req.user?._id) {
        return next(new ErrorHandler('Not authenticated', 401));
    }

    // Lấy user mới nhất từ DB
    const freshUser = await UserModel.findById(req.user._id);

    if (!freshUser) {
        return next(new ErrorHandler('User not found', 404));
    }

    // --- Check purchasedCourses ---
    const purchasedCourses = (freshUser.purchasedCourses || []).map((id: any) => id.toString());
    const purchasedMatch = purchasedCourses.includes(courseId.toString());

    // --- Check assignedCourses ---
    const assignedMatch = (freshUser.assignedCourses || []).some(
        (assigned: any) => assigned.course?.toString() === courseId.toString()
    );

    const isPurchased = purchasedMatch || assignedMatch;

    return res.status(200).json({
        success: true,
        isPurchased
    });
});
