// src/middlewares/ensureCourseEditable.ts
import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import CourseModel from '../models/Course.model';
import SectionModel from '../models/Section.model';
import LessonModel from '../models/Lesson.model';
import QuizModel from '../models/Quiz.model';
import ErrorHandler from '../utils/ErrorHandler';
import { catchAsync } from '@/utils/catchAsync';

type Options = {
    allowAdminOverride?: boolean; // admin có được phép vượt chặn published không
    attachCourseOnReq?: boolean; // gắn course vào req.course
};

async function resolveCourseIdFromRequest(req: Request): Promise<string> {
    // gom tất cả khả năng từ params, body, query
    const p = req.params as any;
    const b = req.body as any;
    const q = req.query as any;

    const directCourseId = p.courseId || b.courseId || q.courseId;
    const sectionId = p.sectionId || b.sectionId || q.sectionId;
    const lessonId = p.lessonId || b.lessonId || q.lessonId;
    const quizId = p.quizId || b.quizId || q.quizId;
    const id = p.id || b.id || q.id; // có route dùng :id

    // 1) Nếu có courseId trực tiếp
    if (directCourseId) return String(directCourseId);

    // 2) Nếu có sectionId → lấy courseId từ Section
    if (sectionId) {
        if (!Types.ObjectId.isValid(sectionId)) throw new ErrorHandler('Invalid section id', 400);
        const section = await SectionModel.findById(sectionId).select('_id courseId');
        if (!section) throw new ErrorHandler('Section not found', 404);
        if (!section.courseId) throw new ErrorHandler('Parent course not found for section', 404);
        return String(section.courseId);
    }

    // 3) Nếu có lessonId → Lesson → Section → Course
    if (lessonId) {
        if (!Types.ObjectId.isValid(lessonId)) throw new ErrorHandler('Invalid lesson id', 400);
        const lesson = await LessonModel.findById(lessonId).select('_id sectionId');
        if (!lesson) throw new ErrorHandler('Lesson not found', 404);
        if (!lesson.sectionId) throw new ErrorHandler('Parent section not found for lesson', 404);
        const section = await SectionModel.findById(lesson.sectionId).select('_id courseId');
        if (!section?.courseId) throw new ErrorHandler('Parent course not found for lesson', 404);
        return String(section.courseId);
    }

    // 5) Fallback: có :id thì thử đoán
    if (id) {
        if (!Types.ObjectId.isValid(id)) throw new ErrorHandler('Invalid id', 400);

        // Thử là Course
        const c = await CourseModel.findById(id).select('_id');
        if (c) return String(c._id);

        // Thử là Section
        const s = await SectionModel.findById(id).select('_id courseId');
        if (s?.courseId) return String(s.courseId);

        // Thử là Lesson
        const l = await LessonModel.findById(id).select('_id sectionId');
        if (l?.sectionId) {
            const sec = await SectionModel.findById(l.sectionId).select('_id courseId');
            if (sec?.courseId) return String(sec.courseId);
        }

        // Thử là Quiz
        const qz = await QuizModel.findById(id).select('_id courseId sectionId');
        if (qz?.courseId) return String(qz.courseId);
        if (qz?.sectionId) {
            const sec2 = await SectionModel.findById(qz.sectionId).select('_id courseId');
            if (sec2?.courseId) return String(sec2.courseId);
        }

        throw new ErrorHandler('Cannot resolve parent course from id', 404);
    }

    // 6) Không có dữ liệu nào để resolve
    throw new ErrorHandler('Course ID is required', 400);
}

export const ensureCourseEditable = (opts: Options = {}) => {
    const { allowAdminOverride = true, attachCourseOnReq = true } = opts;

    return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
        // --- resolve courseId từ request ---
        const courseId = await resolveCourseIdFromRequest(req);
        if (!Types.ObjectId.isValid(courseId)) {
            return next(new ErrorHandler('Invalid course id', 400));
        }

        // --- lấy course tối thiểu field kiểm tra ---
        const course = await CourseModel.findById(courseId).select('_id authorId isPublished status');
        if (!course) return next(new ErrorHandler('Course not found', 404));

        // --- quyền ---
        const userId = (req as any).user?._id as string | undefined;
        const userRole = (req as any).user?.role as string | undefined;
        const isOwner = userId && String(course.authorId) === String(userId);
        const isAdmin = userRole === 'admin';
        if (!isOwner && !isAdmin) {
            return next(new ErrorHandler('Forbidden', 403));
        }

        // --- trạng thái published ---
        const published = (course as any).isPublished === true || (course as any).status === 'published';
        if (published && !(allowAdminOverride && isAdmin)) {
            const err = new ErrorHandler('Course is already published and cannot be edited.', 409);
            (err as any).code = 'PUBLISHED_LOCKED';
            return next(err);
        }

        if (attachCourseOnReq) (req as any).course = course;
        return next();
    });
};
