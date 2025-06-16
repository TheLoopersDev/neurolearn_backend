import { Request, Response, NextFunction } from 'express';
import CourseModel from '../models/Course.model';
import SectionModel from '../models/Section.model';
import { redis } from '../utils/redis';
import ErrorHandler from '../utils/ErrorHandler';
import { catchAsync } from '../utils/catchAsync';

export const createSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    const { title, description } = req.body;

    if (!courseId || !title) {
        return next(new ErrorHandler('Course ID and section title are required', 400));
    }

    // Kiểm tra khoá học tồn tại
    const course = await CourseModel.findById(courseId);
    if (!course) return next(new ErrorHandler('Course not found', 404));

    // Xác định order cho section mới
    const currentSectionCount = await SectionModel.countDocuments({ courseId });
    const section = await SectionModel.create({
        title,
        description,
        courseId,
        order: currentSectionCount + 1
    });

    // Cập nhật danh sách sectionId vào course nếu cần
    await CourseModel.findByIdAndUpdate(courseId, {
        $push: { sections: section._id }
    });

    // Làm mới cache Redis
    await redis.set(courseId, JSON.stringify(await CourseModel.findById(courseId)));

    res.status(201).json({
        success: true,
        data: section
    });
});

export const updateSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sectionId = req.params.id;
    const { title, description, order, isPublished } = req.body;

    if (!sectionId) {
        return next(new ErrorHandler('Section ID is required', 400));
    }

    const section = await SectionModel.findById(sectionId);
    if (!section) {
        return next(new ErrorHandler('Section not found', 404));
    }

    // Cập nhật các trường được gửi
    if (title !== undefined) section.title = title;
    if (description !== undefined) section.description = description;
    if (order !== undefined) section.order = order;
    if (isPublished !== undefined) section.isPublished = isPublished;

    await section.save();

    // Làm mới cache course nếu cần
    await redis.set(section.courseId.toString(), JSON.stringify(await CourseModel.findById(section.courseId)));

    res.status(200).json({
        success: true,
        section
    });
});
