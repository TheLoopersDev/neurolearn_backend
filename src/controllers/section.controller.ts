import { Request, Response, NextFunction } from 'express';
import CourseModel from '../models/Course.model';
import SectionModel from '../models/Section.model';
import { redis } from '../utils/redis';
import ErrorHandler from '../utils/ErrorHandler';
import { catchAsync } from '../utils/catchAsync';
import mongoose, { Types } from 'mongoose';
import QuizModel from '../models/Quiz.model';
import LessonModel from '../models/Lesson.model';
import { invalidateQuizzesCache } from './quiz.controller';
import ProgressModel from '@/models/Progress.model';

export const createSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    const { title, description, isPublished } = req.body;

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
        isPublished,
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

export const deleteSection = catchAsync(async (req, res, next) => {
    const { sectionId } = req.params;
    if (!sectionId) return next(new ErrorHandler('Section ID is required', 400));

    const sid = new Types.ObjectId(sectionId);

    // Đảm bảo section tồn tại (không đụng tới courseId)
    const exists = await SectionModel.exists({ _id: sid });
    if (!exists) return next(new ErrorHandler('Section not found', 404));

    // (Tuỳ bạn) Xoá dữ liệu con + gỡ khỏi Course
    await LessonModel.deleteMany({ sectionId: sid });
    await SectionModel.deleteOne({ _id: sid });
    await CourseModel.updateMany({ sections: sid }, { $pull: { sections: sid } });

    // 1) Lấy các Progress bị ảnh hưởng (có chứa section này)
    const affectedIds = await ProgressModel.find({ 'completedSections.sectionId': sid }).distinct('_id');

    // 2) Gỡ block progress của section đó
    await ProgressModel.updateMany({ _id: { $in: affectedIds } }, { $pull: { completedSections: { sectionId: sid } } });

    // 3) Recalc tổng cho các Progress bị ảnh hưởng
    const cursor = ProgressModel.find({ _id: { $in: affectedIds } }).cursor();
    for await (const prog of cursor as any) {
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

    return res.status(200).json({
        success: true,
        message: 'Section deleted and progress updated'
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

// Cho phép linh hoạt: mọi field của section/lesson
type SectionAny = { _id: Types.ObjectId } & Record<string, any>;
type LessonAny = { _id: Types.ObjectId; sectionId: Types.ObjectId; order?: number } & Record<string, any>;
type QuizLean = {
    _id: Types.ObjectId;
    sectionId: Types.ObjectId;
    order?: number;
    name: string;
    isPublished: boolean;
    totalQuestions?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    duration: string;
};

type MixedItem =
    | {
          kind: 'lesson';
          _id: Types.ObjectId;
          order: number;
          title?: string;
          payload: LessonAny; // toàn bộ lesson
      }
    | {
          kind: 'quiz';
          _id: Types.ObjectId;
          order: number;
          name?: string;
          payload: QuizLean | Record<string, any>; // có thể chuyển sang full quiz nếu muốn
      };

export const getSectionsByUserId = catchAsync(async (req, res, next) => {
    const userId = req.user?._id as string | undefined;
    if (!userId) return next(new ErrorHandler('User ID is required', 400));

    // 1) Courses của author
    const courses = await CourseModel.find({ author: userId }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    if (!courses.length) return res.status(200).json({ success: true, data: [] });

    const courseIds = courses.map((c) => c._id);

    // 2) Sections: lấy FULL
    const sections = await SectionModel.find({ courseId: { $in: courseIds } })
        .sort({ order: 1 })
        .lean<SectionAny[]>();

    if (!sections.length) return res.status(200).json({ success: true, data: [] });

    const sectionIds: Types.ObjectId[] = sections.map((s) => s._id);

    // 3) Lessons (FULL) & Quizzes (subset; có thể đổi sang FULL)
    const [lessons, quizzes] = await Promise.all([
        LessonModel.find({ sectionId: { $in: sectionIds } }).lean<LessonAny[]>(),
        QuizModel.find({ sectionId: { $in: sectionIds } })
            // Nếu muốn FULL quiz, bỏ .select(...) hoặc bỏ hẳn .select
            .select('_id sectionId order name isPublished totalQuestions difficulty duration')
            .lean<QuizLean[]>()
    ]);

    // 4) Group theo sectionId
    const bySection: Record<string, MixedItem[]> = Object.create(null);
    for (const sid of sectionIds) bySection[sid.toString()] = [];

    for (const l of lessons) {
        const key = l.sectionId.toString();
        const ord = typeof l.order === 'number' ? l.order : 0;
        bySection[key]?.push({
            kind: 'lesson',
            _id: l._id,
            order: ord,
            title: typeof l.title === 'string' ? l.title : undefined,
            payload: l // ✅ toàn bộ lesson
        });
    }

    for (const q of quizzes) {
        const key = q.sectionId.toString();
        const ord = typeof q.order === 'number' ? q.order : 0;
        bySection[key]?.push({
            kind: 'quiz',
            _id: q._id,
            order: ord,
            name: q.name,
            payload: q // đổi sang full quiz nếu bạn bỏ .select ở trên
        });
    }

    // 5) Attach items (đã sort) vào từng section (section FULL)
    const data = sections.map((s) => {
        const key = s._id.toString();
        const items = (bySection[key] || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return { ...s, items };
    });

    res.status(200).json({ success: true, data });
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

// PATCH /api/sections/:id/add-quiz
// body: { quizId: string, position?: number }
export const addQuizToSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sectionId = (req.params as any)?.sectionId || (req.params as any)?.id || (req.body as any)?.sectionId;

    const { quizId, position } = req.body as { quizId: string; position?: number | string };

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
        return next(new ErrorHandler('Invalid sectionId', 400));
    }
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quizId', 400));
    }

    const section = await SectionModel.findById(sectionId);
    if (!section) return next(new ErrorHandler('Section not found', 404));

    let quiz = await QuizModel.findById(quizId);
    if (!quiz) return next(new ErrorHandler('Quiz not found', 404));

    // ❗ Không add trùng trong chính section này
    if (quiz.sectionId && String(quiz.sectionId) === String(section._id)) {
        const err = new ErrorHandler('This quiz is already in this section.', 409);
        (err as any).code = 'QUIZ_ALREADY_IN_SECTION';
        return next(err);
    }

    // 🧠 Quiz đã thuộc cùng course nhưng ở section khác → chặn
    if (quiz.courseId && String(quiz.courseId) === String(section.courseId)) {
        if (quiz.sectionId && String(quiz.sectionId) !== String(section._id)) {
            const err = new ErrorHandler('This quiz is already attached to another section in this course.', 409);
            (err as any).code = 'QUIZ_ALREADY_IN_COURSE_OTHER_SECTION';
            return next(err);
        }
        // Trường hợp cùng course nhưng chưa attach section -> cho phép gắn bên dưới
    }

    // 🚫 KHÔNG CLONE: nếu quiz thuộc course khác thì chặn
    if (quiz.courseId && String(quiz.courseId) !== String(section.courseId)) {
        const err = new ErrorHandler('This quiz belongs to another course and cannot be attached here.', 409);
        (err as any).code = 'QUIZ_BELONGS_TO_OTHER_COURSE';
        return next(err);
    }

    // 👉 Nếu quiz chưa có courseId (quiz "tự do") → gán course hiện tại
    if (!quiz.courseId) {
        quiz.courseId = section.courseId as any;
    }

    // Tính vị trí insert
    const [lessonCount, quizCount] = await Promise.all([
        LessonModel.countDocuments({ sectionId: section._id }),
        QuizModel.countDocuments({ sectionId: section._id })
    ]);
    const total = lessonCount + quizCount;

    const insertAtRaw = typeof position === 'string' ? parseInt(position, 10) : position;
    const insertAt = typeof insertAtRaw === 'number' && insertAtRaw >= 0 && insertAtRaw <= total ? insertAtRaw : total;

    // Dồn order các item phía sau (lesson + quiz) trong section
    await Promise.all([
        LessonModel.updateMany({ sectionId: section._id, order: { $gte: insertAt } }, { $inc: { order: 1 } }),
        QuizModel.updateMany({ sectionId: section._id, order: { $gte: insertAt } }, { $inc: { order: 1 } })
    ]);

    // Gắn section & order cho quiz (không clone)
    quiz.sectionId = section._id as any;
    quiz.order = insertAt;

    if (!quiz.instructorId && (req as any).user?._id) {
        quiz.instructorId = (req as any).user._id as any;
    }

    await quiz.save();

    // (tuỳ) nếu Section vẫn giữ mảng quizzes -> sync tránh trùng
    if (Array.isArray((section as any).quizzes)) {
        const exists = (section as any).quizzes.some((x: any) => String(x) === String(quiz._id));
        if (!exists) {
            (section as any).quizzes.push(quiz._id);
            await section.save();
        }
    }

    try {
        await invalidateQuizzesCache();
    } catch {
        /* ignore cache errors */
    }

    res.status(200).json({
        success: true,
        quiz: {
            _id: quiz._id,
            courseId: quiz.courseId,
            sectionId: quiz.sectionId,
            order: quiz.order,
            name: quiz.name
        }
    });
});


// PATCH /api/sections/:id/reorder
//FE gửi thứ tự mới: [{ kind:'lesson'|'quiz', id:'...' }, ...] → BE set order = index cho từng item tương ứng:
export const reorderSection = catchAsync(async (req, res, next) => {
    const sectionId = req.params.id;
    const items = req.body.items as { kind: 'lesson' | 'quiz'; id: string }[];

    if (
        !Array.isArray(items) ||
        items.some((i) => !['lesson', 'quiz'].includes(i.kind) || !mongoose.Types.ObjectId.isValid(i.id))
    )
        return next(new ErrorHandler('Invalid payload', 400));

    const bulkLesson: any[] = [];
    const bulkQuiz: any[] = [];
    items.forEach((it, idx) => {
        if (it.kind === 'lesson') {
            bulkLesson.push({ updateOne: { filter: { _id: it.id, sectionId }, update: { $set: { order: idx } } } });
        } else {
            bulkQuiz.push({ updateOne: { filter: { _id: it.id, sectionId }, update: { $set: { order: idx } } } });
        }
    });

    if (bulkLesson.length) await LessonModel.bulkWrite(bulkLesson);
    if (bulkQuiz.length) await QuizModel.bulkWrite(bulkQuiz);

    res.status(200).json({ success: true });
});

export const removeItemFromSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const sectionId = req.params.id;
        const { kind, id, hardDelete } = req.body as {
            kind: 'lesson' | 'quiz';
            id: string;
            hardDelete?: boolean;
        };

        if (!mongoose.Types.ObjectId.isValid(sectionId)) {
            throw new ErrorHandler('Invalid sectionId', 400);
        }
        if (!['lesson', 'quiz'].includes(kind)) {
            throw new ErrorHandler('Invalid kind', 400);
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ErrorHandler('Invalid item id', 400);
        }

        const section = await SectionModel.findById(sectionId).session(session);
        if (!section) throw new ErrorHandler('Section not found', 404);

        const Model = kind === 'lesson' ? LessonModel : QuizModel;

        // Lấy item & validate thuộc section
        const item = await Model.findOne({ _id: id, sectionId }).session(session);
        if (!item) throw new ErrorHandler(`${kind} not found in this section`, 404);

        const removedOrder = item.order ?? 0;

        // 1) Gỡ hoặc xoá hẳn item
        if (hardDelete) {
            await Model.deleteOne({ _id: id, sectionId }).session(session);
        } else {
            // chỉ gỡ khỏi section, reset order
            await Model.updateOne({ _id: id, sectionId }, { $unset: { sectionId: '', order: '' } }).session(session);
        }

        // 2) Dồn lại order cho tất cả item đứng sau (trong cùng section, cả 2 collection)
        await Promise.all([
            LessonModel.updateMany({ sectionId, order: { $gt: removedOrder } }, { $inc: { order: -1 } }).session(
                session
            ),
            QuizModel.updateMany({ sectionId, order: { $gt: removedOrder } }, { $inc: { order: -1 } }).session(session)
        ]);

        // (tuỳ chọn) nếu bạn vẫn còn giữ mảng lessons[] / quizzes[] trong Section để tương thích code cũ:
        // pull id ra khỏi mảng tương ứng
        if (Array.isArray((section as any).lessons) && kind === 'lesson') {
            (section as any).lessons = (section as any).lessons.filter((x: any) => x.toString() !== id);
        }
        if (Array.isArray((section as any).quizzes) && kind === 'quiz') {
            (section as any).quizzes = (section as any).quizzes.filter((x: any) => x.toString() !== id);
        }
        await section.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
});