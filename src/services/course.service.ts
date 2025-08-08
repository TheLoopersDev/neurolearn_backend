import ProgressModel from '@/models/Progress.model';
import CourseModel from '../models/Course.model';
import UserModel from '../models/User.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import SectionModel from '@/models/Section.model';

export const createCourse = async (data: any, req: Request, res: Response, next: NextFunction) => {
    const user = await UserModel.findById(req.user?._id);
    if (!user) {
        return next(new ErrorHandler('User is not logged in!', 400));
    }

    // Gán authorId từ user đang login
    data.authorId = user._id;

    const courses = await CourseModel.create(data);

    // Gán courseId vào uploadedCourses[]
    user.uploadedCourses.push(courses._id);
    await user.save();

    // Cập nhật Redis cache
    await redis.set(user._id.toString(), JSON.stringify(user));

    res.status(201).json({
        success: true,
        courses
    });
};

export const getAllCoursesService = async (res: Response) => {
    const courses = await CourseModel.find().sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        courses
    });
};
interface ILessonLean {
    _id: Types.ObjectId;
    title: string;
    order: number;
    isPublished?: boolean;
}
interface ISectionLean {
    _id: Types.ObjectId;
    order: number;
    lessons: ILessonLean[];
}
// Lấy "bài tiếp theo" của 1 course dựa vào progress (bài đầu tiên chưa complete, theo thứ tự)
async function findNextLessonForCourse(courseId: string, progressDoc?: any) {
    const completed = new Set<string>();
    for (const sec of progressDoc?.completedSections ?? []) {
        for (const l of sec.lessons ?? []) {
            if (l.isCompleted && l.lessonId) completed.add(String(l.lessonId));
        }
    }

    const sections = await SectionModel.find({ course: courseId, isPublished: true }, { _id: 1, order: 1 })
        .sort({ order: 1 })
        .populate<{ lessons: ILessonLean[] }>({
            path: 'lessons',
            match: { isPublished: true },
            select: '_id title order',
            options: { sort: { order: 1 } }
        })
        .lean<ISectionLean[]>();

    for (const sec of sections) {
        for (const ls of sec.lessons ?? []) {
            if (!completed.has(String(ls._id))) {
                return { _id: ls._id, title: ls.title };
            }
        }
    }
    return null;
}
export const getLatestCourse = async (userId: string) => {
    const latestProgress = await ProgressModel.findOne({ user: userId })
        .sort({ updatedAt: -1 })
        .populate({
            path: 'course',
            select: 'name thumbnail status isPublished sections createdAt'
        })
        .lean<{
            course: {
                _id: any;
                name: string;
                thumbnail?: any;
                status?: string;
                isPublished?: boolean;
                sections?: any[];
            };
            progressPercentage?: number;
            completedSections?: any[];
        } | null>();

    if (!latestProgress?.course) return null;

    return {
        _id: latestProgress.course._id,
        name: latestProgress.course.name,
        thumbnail: latestProgress.course.thumbnail.url,
        status:
            latestProgress.course.status ||
            (latestProgress.course.isPublished
                ? 'published'
                : latestProgress.course.sections?.length
                  ? 'pending'
                  : 'draft'),
        progressPercentage: latestProgress.progressPercentage ?? 0,
        nextLesson: await findNextLessonForCourse(String(latestProgress.course._id), latestProgress)
    };
}
