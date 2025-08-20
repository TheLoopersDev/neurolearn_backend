import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import CourseModel from '../models/Course.model';
import LessonModel from '../models/Lesson.model';
import SectionModel from '../models/Section.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';
import cloudinary from 'cloudinary';
import { Types } from 'mongoose';
import ProgressModel from '../models/Progress.model';
// Create a lesson within a section
export const createLesson = catchAsync(async (req: Request, res: Response, next) => {
    const courseId = req.params.courseId;
    const sectionId = req.params.sectionId;
    const { title, description, videoUrl, videoLength, isPublished } = req.body;
    if (!courseId || !sectionId || !title) {
        return next(new ErrorHandler('Course ID, Section ID, and title are required', 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) return next(new ErrorHandler('Course not found', 404));

    const section = await SectionModel.findById(sectionId);
    if (!section) return next(new ErrorHandler('Section not found', 404));

    const currentLessonCount = await LessonModel.countDocuments({ sectionId });

    const lesson = await LessonModel.create({
        title,
        description,
        videoUrl,
        videoLength,
        isPublished: false,
        sectionId,
        courseId,
        order: currentLessonCount + 1
    });

    section.lessons.push(lesson._id);
    await section.save();

    await redis.set(courseId, JSON.stringify(await CourseModel.findById(courseId)));
    res.status(201).json({
        success: true,
        data: {
            _id: lesson._id,
            title,
            description,
            videoUrl,
            videoLength,
            isPublished,
            order: lesson.order,
            sectionId,
            courseId
        }
    });
});

// Reorder lessons within a section
export const reorderLesson = catchAsync(async (req: Request, res: Response, next) => {
    const sectionId = req.params.sectionId;
    const { orderUpdates } = req.body;

    if (!sectionId || !Array.isArray(orderUpdates)) {
        return next(new ErrorHandler('Section ID and valid reorder data are required', 400));
    }

    for (const update of orderUpdates) {
        await LessonModel.findByIdAndUpdate(update.id, { order: update.order });
    }

    const updatedLessons = await LessonModel.find({ sectionId }).sort({ order: 1 });

    const section = await SectionModel.findById(sectionId);
    if (!section) return next(new ErrorHandler('Section not found', 404));

    section.lessons = updatedLessons.map((lesson) => lesson._id);
    await section.save();

    res.status(200).json({
        success: true,
        message: 'Lessons reordered successfully',
        lessons: updatedLessons
    });
});

// Get all lessons in a section
export const getAllLessons = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sectionId = req.params.sectionId;
    if (!sectionId) {
        return next(new ErrorHandler('Section ID is required', 400));
    }
    const lessons = await LessonModel.find({ sectionId }).sort({ order: 1 });
    res.status(200).json({
        success: true,
        data: lessons
    });
});

// Get lesson by ID
export const getLessonById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const lessonId = req.params.lessonId;
    if (!lessonId) {
        return next(new ErrorHandler('Lesson ID is required', 400));
    }
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) return next(new ErrorHandler('Lesson not found', 404));
    res.status(200).json({
        success: true,
        data: lesson
    });
});

// Update lesson
export const updateLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const lessonId = req.params.lessonId;
    const { title, description, videoUrl, videoLength, isFree, order, isPublished } = req.body;
    if (!lessonId) {
        return next(new ErrorHandler('Lesson ID is required', 400));
    }
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) return next(new ErrorHandler('Lesson not found', 404));
    if (title !== undefined) lesson.title = title;
    if (description !== undefined) lesson.description = description;
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
    if (videoLength !== undefined) lesson.videoLength = videoLength;
    if (isFree !== undefined) lesson.isFree = isFree;
    if (order !== undefined) lesson.order = order;
    if (isPublished !== undefined) lesson.isPublished = isPublished;
    await lesson.save();
    res.status(200).json({
        success: true,
        data: lesson
    });
});

export const deleteLesson = catchAsync(async (req, res, next) => {
    const { lessonId } = req.params;
    if (!lessonId) return next(new ErrorHandler('Lesson ID is required', 400));

    const lid = new Types.ObjectId(lessonId);

    const lesson = await LessonModel.findById(lid);
    if (!lesson) return next(new ErrorHandler('Lesson not found', 404));

    const sectionId = new Types.ObjectId(String(lesson.sectionId));

    // 1) Gỡ lesson khỏi Section.lessons
    await SectionModel.updateOne(
        { _id: sectionId },
        { $pull: { lessons: lid, lesson: lid } } // hỗ trợ cả 2 tên field
    );

    // 2) Xoá lesson
    await LessonModel.deleteOne({ _id: lid });

    // 3) Tìm các Progress bị ảnh hưởng (có chứa lessonId này)
    const affectedIds = await ProgressModel.find({ 'completedSections.lessons.lessonId': lid }).distinct('_id');

    // 4) Với mỗi Progress: xoá lesson khỏi mảng, cập nhật counter trong section đó, rồi recalc tổng
    const cursor = ProgressModel.find({ _id: { $in: affectedIds } }).cursor();
    for await (const prog of cursor as any) {
        let touched = false;

        for (const sp of prog.completedSections || []) {
            if (String(sp.sectionId) !== String(sectionId)) continue;

            const arr = Array.isArray(sp.lessons) ? sp.lessons : [];
            const idx = arr.findIndex((l: any) => String(l.lessonId) === String(lid));
            if (idx !== -1) {
                const wasCompleted = !!arr[idx]?.isCompleted;
                arr.splice(idx, 1);
                sp.lessons = arr;
                if (typeof sp.totalLessonsInSection === 'number') {
                    sp.totalLessonsInSection = Math.max(0, sp.totalLessonsInSection - 1);
                } else {
                    sp.totalLessonsInSection = arr.length;
                }
                if (typeof sp.completedLessons === 'number' && wasCompleted) {
                    sp.completedLessons = Math.max(0, sp.completedLessons - 1);
                }
                touched = true;
            }
        }

        if (touched) {
            let totalLessons = 0;
            let totalCompleted = 0;
            for (const sp of prog.completedSections || []) {
                const tl =
                    typeof sp.totalLessonsInSection === 'number'
                        ? sp.totalLessonsInSection
                        : Array.isArray(sp.lessons)
                          ? sp.lessons.length
                          : 0;
                const cl =
                    typeof sp.completedLessons === 'number'
                        ? sp.completedLessons
                        : Array.isArray(sp.lessons)
                          ? sp.lessons.filter((l: any) => l?.isCompleted).length
                          : 0;
                totalLessons += tl;
                totalCompleted += cl;
            }
            prog.totalLessons = totalLessons;
            prog.totalCompleted = totalCompleted;
            prog.progressPercentage = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
            await prog.save();
        }
    }

    res.status(200).json({
        success: true,
        message: 'Lesson deleted and progress updated'
    });
});


// Publish lesson
export const publishLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const lessonId = req.params.lessonId;
    if (!lessonId) {
        return next(new ErrorHandler('Lesson ID is required', 400));
    }
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) return next(new ErrorHandler('Lesson not found', 404));
    lesson.isPublished = true;
    await lesson.save();
    res.status(200).json({
        success: true,
        message: 'Lesson published successfully',
        data: lesson
    });
});

// Unpublish lesson
export const unpublishLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const lessonId = req.params.lessonId;
    if (!lessonId) {
        return next(new ErrorHandler('Lesson ID is required', 400));
    }
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) return next(new ErrorHandler('Lesson not found', 404));
    lesson.isPublished = false;
    await lesson.save();
    res.status(200).json({
        success: true,
        message: 'Lesson unpublished successfully',
        data: lesson
    });
});

// upload video lesson

export const uploadLessonVideo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { lessonId } = req.body;

    if (!lessonId) {
        return next(new ErrorHandler("Lesson ID are required", 400));
    }
    if (!req.file) {
        return next(new ErrorHandler("No video file uploaded", 400));
    }

    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) {
        return next(new ErrorHandler("Lesson not found in section", 404));
    }

    // Xóa video cũ nếu có
    if (lesson.videoUrl?.public_id) {
        await cloudinary.v2.uploader.destroy(lesson.videoUrl.public_id, { resource_type: "video" });
    }

    // Upload video mới
    const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.v2.uploader.upload_stream(
            { resource_type: "video", folder: "lessons" },
            (error, result) => (error ? reject(error) : resolve(result))
        ).end(req.file?.buffer || Buffer.alloc(0));
    });

    // Cập nhật lesson  1
    lesson.videoUrl = {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
    };
    await lesson.save();

    console.log("req.body:", req.body);
    console.log("req.file:", req.file);


    res.status(200).json({
        success: true,
        message: "Lesson video uploaded successfully",
        data: lesson,
    });
});