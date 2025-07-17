import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import ProgressModel from '../models/Progress.model';
import CourseModel from '../models/Course.model';
import { redis } from '../utils/redis';
import LessonModel from '../models/Lesson.model';
import SectionModel from '../models/Section.model';
import UserModel from '../models/User.model';
import CertificateModel from '../models/Certificate.model';

// Update lesson completion status via Progress model
export const updateLessonCompletionStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;
    const courseId = req.params.id;
    const { lessonId, isCompleted } = req.body;

    if (!courseId || !lessonId) {
        return next(new ErrorHandler('Course ID and Lesson ID are required', 400));
    }

    const lesson = await LessonModel.findById(lessonId).populate('sectionId');
    if (!lesson) return next(new ErrorHandler('Lesson not found', 404));

    const section = await SectionModel.findById(lesson.sectionId._id);
    if (!section) return next(new ErrorHandler('Section not found', 404));

    const sectionTitle = section.title;
    const sectionLength = section.lessons.length;

    let progress = await ProgressModel.findOne({ user: userId, course: courseId });
    if (!progress) {
        const totalLessons = await LessonModel.countDocuments({
            sectionId: { $in: (await SectionModel.find({ courseId })).map((s) => s._id) }
        });

        progress = new ProgressModel({
            user: userId,
            course: courseId,
            totalLessons,
            totalCompleted: 0,
            completedLessons: []
        });
    }

    // Tìm hoặc tạo section progress
    let sectionProgress = progress.completedLessons.find((s: any) => s.section.name === sectionTitle);

    if (!sectionProgress) {
        sectionProgress = {
            section: {
                name: sectionTitle,
                sectionLength,
                lessons: [],
                totalCompletedPerSection: 0
            }
        };
        progress.completedLessons.push(sectionProgress);
    }

    const lessonIndex = sectionProgress.section.lessons.findIndex((l: any) => l.toString() === lessonId);

    if (isCompleted) {
        if (lessonIndex === -1) {
            sectionProgress.section.lessons.push(lessonId);
        }
    } else {
        if (lessonIndex !== -1) {
            sectionProgress.section.lessons.splice(lessonIndex, 1);
        }
    }
    await LessonModel.findByIdAndUpdate(lessonId, { isCompleted }, { new: true });

    sectionProgress.section.totalCompletedPerSection = sectionProgress.section.lessons.length;

    progress.totalCompleted = progress.completedLessons.reduce(
        (sum: any, sec: any) => sum + (sec.section.lessons?.length || 0),
        0
    );

    await progress.save();

    await redis.set(`progress:${userId}:${courseId}`, JSON.stringify(progress));

    // Check and issue certificate if completed
    await issueCertificateIfCompleted(userId.toString(), courseId.toString(), {
        totalCompleted: progress.totalCompleted,
        totalLessons: progress.totalLessons
    });

    res.status(200).json({
        success: true,
        message: 'Lesson completion status updated successfully',
        data: progress
    });
});

// Get progress data by userId & courseId
export const getProgressData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id; // Lấy userId từ middleware xác thực
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Course ID is required', 400));
    }

    // Kiểm tra xem khóa học có tồn tại không
    const course = await CourseModel.findById(courseId);
    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Tìm progress của user trong khóa học này
    const progress = await ProgressModel.findOne({ user: userId, course: courseId });

    // Tính toán phần trăm hoàn thành
    const totalLessons = course.courseData.length;
    const totalCompleted = progress ? progress.totalCompleted : 0;
    const completionPercentage = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

    if (!progress) {
        return res.status(200).json({
            success: true,
            message: 'No progress found, returning empty progress.',
            data: {
                user: userId,
                course: courseId,
                totalLessons,
                totalCompleted,
                completionPercentage,
                completedLessons: []
            }
        });
    }

    res.status(200).json({
        success: true,
        message: 'Progress data retrieved successfully',
        data: {
            ...progress.toObject(),
            completionPercentage
        }
    });
});

// Get my purchased course progress data
export const getAllCoursesProgress = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id; // Get userId from authentication middleware

    if (!userId) {
        return next(new ErrorHandler('User ID is required', 400));
    }

    // Fetch all courses associated with the user
    const userCourses = await CourseModel.find({ users: userId }); // Assuming `users` is the field in CourseModel that stores enrolled users

    if (!userCourses || userCourses.length === 0) {
        return res.status(200).json({
            success: true,
            message: 'No courses found for this user.',
            data: []
        });
    }

    // Fetch progress for each course
    const progressData = await Promise.all(
        userCourses.map(async (course) => {
            const courseId = course._id;

            // Find progress of the user in this course
            const progress = await ProgressModel.findOne({ user: userId, course: courseId });

            // Calculate completion percentage
            const totalLessons = course.courseData.length;
            const totalCompleted = progress ? progress.totalCompleted : 0;
            const completionPercentage = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

            return {
                courseId: course._id,
                courseName: course.name, // Assuming `name` is a field in CourseModel
                totalLessons,
                totalCompleted,
                completionPercentage,
                completedLessons: progress ? progress.completedLessons : []
            };
        })
    );

    res.status(200).json({
        success: true,
        message: 'Progress data for all courses retrieved successfully',
        data: progressData
    });
});
// Update certificate if completed
export async function issueCertificateIfCompleted(
  userId: string,
  courseId: string,
  progress: { totalCompleted: number; totalLessons: number }
) {
    if (progress.totalCompleted !== progress.totalLessons) return;
  
    const existing = await CertificateModel.findOne({ user: userId, course: courseId });
    if (existing) return;
  
    const user = await UserModel.findById(userId);
    const course = await CourseModel.findById(courseId);
    if (!user || !course) return;
  
    await CertificateModel.create({
      user: user._id,
      course: course._id,
      userName: user.name,
      courseName: course.name,
      completedAt: new Date(),
      issuedBy: 'system',
    });
  };

