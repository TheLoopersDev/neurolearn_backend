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

export const deleteSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sectionId = req.params.sectionId;

    if (!sectionId) {
        return next(new ErrorHandler('Section ID is required', 400));
    }

    const section = await SectionModel.findById(sectionId);
    if (!section) return next(new ErrorHandler('Section not found', 404));

    await section.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Section deleted successfully',
    });
});

export const getAllSections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    if (!courseId) {
        return next(new ErrorHandler('Course ID is required', 400));
    }
    const sections = await SectionModel.find({ courseId }).sort({ order: 1 });
    res.status(200).json({
        success: true,
        data: sections
    });
});

export const getCurriculumByCourseId = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;

    if (!courseId) {
        return next(new ErrorHandler('Course ID is required', 400));
    }

    // Lấy tất cả sections thuộc course, đã publish, có sắp xếp
    const sections = await SectionModel.find({
        courseId
    })
        .sort({ order: 1 })
        .populate({
            path: 'lessons',
            match: { isPublished: true },
            options: { sort: { order: 1 } }
        })
        .lean();

    // Chuyển về format curriculum chuẩn FE cần
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
        curriculum
    });
});


export const getSectionsByUserId = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.userId;
    if (!userId) {
        return next(new ErrorHandler('User ID is required', 400));
    }
    // Giả sử Section có trường createdBy hoặc course có trường author
    const courses = await CourseModel.find({ author: userId });
    const courseIds = courses.map(course => course._id);
    const sections = await SectionModel.find({ courseId: { $in: courseIds } }).sort({ order: 1 });
    res.status(200).json({
        success: true,
        data: sections
    });
});

export const reorderSections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { sectionOrders } = req.body; // [{ sectionId, order }]
    if (!Array.isArray(sectionOrders)) {
        return next(new ErrorHandler('sectionOrders must be an array', 400));
    }
    for (const { sectionId, order } of sectionOrders) {
        await SectionModel.findByIdAndUpdate(sectionId, { order });
    }
    res.status(200).json({
        success: true,
        message: 'Sections reordered successfully'
    });
});

export const publishSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sectionId = req.params.sectionId;
    if (!sectionId) {
        return next(new ErrorHandler('Section ID is required', 400));
    }
    const section = await SectionModel.findById(sectionId);
    if (!section) return next(new ErrorHandler('Section not found', 404));
    section.isPublished = true;
    await section.save();
    res.status(200).json({
        success: true,
        message: 'Section published successfully',
        data: section
    });
});

export const unpublishSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sectionId = req.params.sectionId;
    if (!sectionId) {
        return next(new ErrorHandler('Section ID is required', 400));
    }
    const section = await SectionModel.findById(sectionId);
    if (!section) return next(new ErrorHandler('Section not found', 404));
    section.isPublished = false;
    await section.save();
    res.status(200).json({
        success: true,
        message: 'Section unpublished successfully',
        data: section
    });
});

export const getSectionDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sectionId = req.params.sectionId;
    if (!sectionId) {
        return next(new ErrorHandler('Section ID is required', 400));
    }
    const section = await SectionModel.findById(sectionId).populate('lessons');
    if (!section) return next(new ErrorHandler('Section not found', 404));
    res.status(200).json({
        success: true,
        data: section
    });
});
