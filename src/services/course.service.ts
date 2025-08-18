import ProgressModel from '../models/Progress.model';
import CourseModel from '../models/Course.model';
import UserModel from '../models/User.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import SectionModel from '../models/Section.model';
import cloudinary from 'cloudinary';
// data URI
const DATA_URI_RE = /^data:(image|video|application)\/[a-zA-Z0-9.+-]+;base64,/i;
const MEDIA_KEYS = new Set([
    'thumbnail',
    'image',
    'banner',
    'cover',
    'avatar',
    'poster',
    'logo',
    'video',
    'file',
    'source'
]);

function isDataUri(x: any): x is string {
    return typeof x === 'string' && DATA_URI_RE.test(x);
}

// UPLOAD 1 chuỗi base64 -> Cloudinary
async function uploadDataUri(dataUri: string) {
    const cleaned = dataUri.replace(/\s/g, '');
    const up = await cloudinary.v2.uploader.upload(cleaned, {
        folder: 'courses',
        resource_type: 'auto'
    });
    return { public_id: up.public_id, url: up.secure_url };
}

// ĐỆ QUY chuẩn hoá: bảo toàn ObjectId/Date/Buffer, xử lý key 'url' và key media
async function normalizeDeep(node: any): Promise<any> {
    if (Array.isArray(node)) {
        const out: any[] = [];
        for (let i = 0; i < node.length; i++) out.push(await normalizeDeep(node[i]));
        return out;
    }

    // bảo toàn các kiểu đặc biệt
    if (node instanceof Types.ObjectId || node instanceof Date || Buffer.isBuffer(node)) return node;

    if (node && typeof node === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(node)) {
            // Đừng đụng vào các field id
            if (k === '_id' || k === 'authorId' || k.endsWith('Id')) {
                out[k] = v;
                continue;
            }

            if (typeof v === 'string' && isDataUri(v)) {
                const uploaded = await uploadDataUri(v);

                if (k.toLowerCase() === 'url') {
                    // url: base64 -> chỉ lấy secure_url (String)
                    out[k] = uploaded.url;
                    // nếu object cha có public_id, set thêm cho tiện xoá sau
                    if (!('public_id' in out)) out.public_id = uploaded.public_id;
                } else if (MEDIA_KEYS.has(k.toLowerCase())) {
                    // thumbnail/image/banner: base64 string -> đổi thành object {public_id, url}
                    out[k] = { public_id: uploaded.public_id, url: uploaded.url };
                } else {
                    // field khác là string base64 -> an toàn nhất là dùng URL string
                    out[k] = uploaded.url;
                }
            } else {
                out[k] = await normalizeDeep(v);
            }
        }
        return out;
    }

    // string bình thường / number / boolean...
    return node;
}

// tìm mọi path còn 'data:' (để chặn)
function findDataUriPaths(input: any, path = '$'): string[] {
    const rs: string[] = [];
    if (Array.isArray(input)) {
        input.forEach((v, i) => rs.push(...findDataUriPaths(v, `${path}[${i}]`)));
    } else if (input && typeof input === 'object') {
        for (const [k, v] of Object.entries(input)) rs.push(...findDataUriPaths(v, `${path}.${k}`));
    } else if (typeof input === 'string' && input.startsWith('data:')) {
        rs.push(path);
    }
    return rs;
}
export const createCourse = async (data: any, req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await UserModel.findById(req.user?._id);
        if (!user) return next(new ErrorHandler('User is not logged in!', 400));

        // normalize TRƯỚC, rồi mới gán authorId để không bị normalize “làm hỏng” ObjectId
        const cleaned = await normalizeDeep(data);

        const bad = findDataUriPaths(cleaned);
        if (bad.length) return next(new ErrorHandler(`Invalid base64 at: ${bad.join(', ')}`, 400));

        cleaned.authorId = user._id; // ObjectId gốc của Mongoose

        const course = await CourseModel.create(cleaned);

        user.uploadedCourses.push(course._id);
        await user.save();
        await redis.set(user._id.toString(), JSON.stringify(user));

        res.status(201).json({ success: true, courses: course });
    } catch (err: any) {
        console.error('Create course error:', err?.message, err?.response?.error?.message);
        return next(new ErrorHandler(err?.message || 'Create course failed', 500));
    }
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
