import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import CourseModel from '../models/Course.model';
import LessonModel from '../models/Lesson.model';
import SectionModel from '../models/Section.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';

// Create a lesson within a section
export const createLesson = catchAsync(async (req: Request, res: Response, next) => {
    const courseId = req.params.courseId;
    const {sectionId,title,description,videoUrl,videoLength,isFree } = req.body;

    if (!courseId || !sectionId || !title) {
        return next(new ErrorHandler('Course ID, Section ID and title are required', 400));
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
        isFree,
        sectionId,
        courseId,
        order: currentLessonCount + 1
    });

    section.lessons.push(lesson._id);
    await section.save();

    await redis.set(courseId, JSON.stringify(await CourseModel.findById(courseId)));

    res.status(201).json({
        success: true,
        data: lesson
    });
});

/**
 * Reorder lessons within a course
 */
export const reorderLesson = catchAsync(async (req: Request, res: Response, next) => {
    const courseId = req.params.courseId;
    const { sectionId, orderUpdates } = req.body;

    if (!courseId || !sectionId || !Array.isArray(orderUpdates)) {
        return next(new ErrorHandler('Course ID, Section ID and valid reorder data are required', 400));
    }

    const section = await SectionModel.findById(sectionId).populate('lessons');
    if (!section) return next(new ErrorHandler('Section not found', 404));

    for (const update of orderUpdates) {
        await LessonModel.findByIdAndUpdate(update.id, { order: update.order });
    }

    const updatedLessons = await LessonModel.find({ sectionId }).sort({ order: 1 });
    section.lessons = updatedLessons.map((lesson) => lesson._id);
    await section.save();

    const updatedCourse = await CourseModel.findById(courseId);
    await redis.set(courseId, JSON.stringify(updatedCourse));

    res.status(200).json({
        success: true,
        message: 'Lessons reordered successfully',
        lessons: updatedLessons
    });
});
  
