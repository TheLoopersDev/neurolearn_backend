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

// export const updateLessonCompletionStatus = catchAsync(async (req: Request, res: Response, next: any) => {
//     const userId = req.user?._id;
//     const courseId = req.params.id as string;
//     const { lessonId, isCompleted } = req.body as { lessonId?: string; isCompleted?: boolean | string };

//     if (!userId) return next(new ErrorHandler('Unauthorized', 401));
//     if (!courseId || !lessonId) {
//         return next(new ErrorHandler('Course ID and Lesson ID are required', 400));
//     }

//     // Chuẩn hoá boolean để không bị dính "true"/"false" dạng string
//     const completed = isCompleted === true || isCompleted === 'true';

//     // 1) Lấy lesson & section
//     const lesson = await LessonModel.findById(lessonId).populate('sectionId');
//     if (!lesson) return next(new ErrorHandler('Lesson not found', 404));

//     const sectionId = (lesson.sectionId as any)?._id || (lesson.sectionId as any);
//     const section = await SectionModel.findById(sectionId);
//     if (!section) return next(new ErrorHandler('Section not found', 404));

//     const sectionLessonCount = section.lessons?.length || 0;

//     // 2) Lấy progress (hoặc tạo mới)
//     let progress = await ProgressModel.findOne({ user: userId, course: courseId });

//     if (!progress) {
//         // Lấy toàn bộ section + lesson của course
//         const sections = await SectionModel.find({ course: courseId }).populate({ path: 'lessons', select: '_id' });

//         const completedSections = sections.map((sec: any) => ({
//             sectionId: sec._id,
//             totalLessonsInSection: sec.lessons?.length || 0,
//             completedLessons: 0,
//             lessons: (sec.lessons || []).map((l: any) => ({
//                 lessonId: l._id,
//                 isCompleted: false
//             }))
//         }));

//         const totalLessons = sections.reduce((sum: number, s: any) => sum + (s.lessons?.length || 0), 0);

//         progress = new ProgressModel({
//             user: userId,
//             course: courseId,
//             totalLessons,
//             totalCompleted: 0,
//             completedSections,
//             progressPercentage: 0
//         });
//     }

//     // An toàn: nếu totalLessons trong DB đang = 0 (data cũ), tính lại luôn
//     if (!progress.totalLessons || progress.totalLessons === 0) {
//         const allSections = await SectionModel.find({ course: courseId });
//         progress.totalLessons = allSections.reduce((sum, sec) => sum + (sec.lessons?.length || 0), 0);
//     }

//     // 3) Tìm hoặc tạo sectionProgress
//     let sectionProgress: any = progress.completedSections.find(
//         (s: any) => s.sectionId.toString() === sectionId.toString()
//     );

//     if (!sectionProgress) {
//         // Lần đầu thấy section này trong progress
//         sectionProgress = {
//             sectionId,
//             completedLessons: completed ? 1 : 0,
//             totalLessonsInSection: sectionLessonCount,
//             lessons: [{ lessonId, isCompleted: completed }]
//         };
//         progress.completedSections.push(sectionProgress);
//     } else {
//         // Đồng bộ total lessons của section (phòng trường hợp thay đổi cấu trúc)
//         if ((sectionProgress.totalLessonsInSection || 0) !== sectionLessonCount) {
//             sectionProgress.totalLessonsInSection = sectionLessonCount;
//         }
//         if (!Array.isArray(sectionProgress.lessons)) sectionProgress.lessons = [];

//         // Upsert lesson trong mảng lessons
//         const idx = sectionProgress.lessons.findIndex((l: any) => l.lessonId.toString() === lessonId.toString());

//         if (idx === -1) {
//             sectionProgress.lessons.push({ lessonId, isCompleted: completed });
//         } else {
//             sectionProgress.lessons[idx].isCompleted = completed;
//         }

//         // Cập nhật lại completedLessons dựa trên lessons[]
//         sectionProgress.completedLessons = sectionProgress.lessons.filter((l: any) => l.isCompleted).length;
//     }

//     // 4) Tính lại tổng completed & phần trăm
//     const totalCompleted = progress.completedSections.reduce(
//         (sum: number, sec: any) => sum + (sec.completedLessons || 0),
//         0
//     );

//     progress.totalCompleted = totalCompleted;
//     progress.progressPercentage =
//         progress.totalLessons > 0 ? Math.round((totalCompleted / progress.totalLessons) * 100) : 0;

//     // Cho Mongoose biết nested array đã thay đổi (an toàn khi sửa sâu)
//     progress.markModified('completedSections');

//     // 5) Lưu
//     await progress.save();

//     // (Tuỳ chọn) Cache bản progress tổng — không dùng cache per-lesson nữa
//     await redis.set(`progress:${userId}:${courseId}`, JSON.stringify(progress));

//     // (Tuỳ chọn) Cấp chứng chỉ sau khi hoàn thành khoá
//     await issueCertificateIfCompleted(userId.toString(), courseId.toString(), {
//         totalCompleted: progress.totalCompleted,
//         totalLessons: progress.totalLessons
//     });

//     return res.status(200).json({
//         success: true,
//         message: 'Lesson completion status updated successfully',
//         data: progress
//     });
// });

export const updateLessonCompletionStatus = catchAsync(async (req: Request, res: Response, next: any) => {
    const userId = req.user?._id as string | undefined;
    const courseId = req.params.id as string;
    const { lessonId, isCompleted } = req.body as { lessonId?: string; isCompleted?: boolean | string };

    if (!userId) return next(new ErrorHandler('Unauthorized', 401));
    if (!courseId || !lessonId) return next(new ErrorHandler('Course ID and Lesson ID are required', 400));

    // Chuẩn hoá boolean
    const completed = isCompleted === true || isCompleted === 'true';

    // ===== 1) Lấy lesson & section (đảm bảo là lesson publish) =====
    const lesson = await LessonModel.findById(lessonId).populate('sectionId');
    if (!lesson) return next(new ErrorHandler('Lesson not found', 404));
    const sectionId = (lesson.sectionId as any)?._id || (lesson.sectionId as any);

    const section = await SectionModel.findOne({ _id: sectionId, course: courseId, isPublished: true }).populate({
        path: 'lessons',
        match: { isPublished: true },
        select: '_id',
        options: { sort: { order: 1 } }
    });
    if (!section) return next(new ErrorHandler('Section not found', 404));

    // ===== 2) Lấy progress hoặc seed mới từ cấu trúc course (publish) =====
    let progress = await ProgressModel.findOne({ user: userId, course: courseId });
    if (!progress) {
        const sections = await SectionModel.find({ course: courseId, isPublished: true })
            .sort({ order: 1 })
            .populate({
                path: 'lessons',
                match: { isPublished: true },
                select: '_id',
                options: { sort: { order: 1 } }
            });

        progress = new ProgressModel({
            user: userId,
            course: courseId,
            completedSections: sections.map((sec: any) => ({
                sectionId: sec._id,
                // totalLessonsInSection & completedLessons sẽ auto-calc
                lessons: (sec.lessons || []).map((l: any) => ({
                    lessonId: l._id,
                    isCompleted: false
                }))
            }))
        });
    } else {
        // ===== 2b) Đồng bộ lại completedSections theo cấu trúc thật (nếu có thay đổi) =====
        // - đảm bảo mọi lesson publish đều có entry; không xoá entry cũ để không mất tiến độ
        const secIdx = progress.completedSections.findIndex((s: any) => String(s.sectionId) === String(sectionId));
        if (secIdx === -1) {
            progress.completedSections.push({
                sectionId,
                lessons: (section.lessons || []).map((l: any) => ({ lessonId: l._id, isCompleted: false }))
            } as any);
        } else {
            const secProg = progress.completedSections[secIdx];
            const existing = new Map<string, boolean>();
            for (const it of secProg.lessons || []) existing.set(String(it.lessonId), !!it.isCompleted);

            // Upsert tất cả lesson publish hiện tại
            const merged = (section.lessons || []).map((l: any) => {
                const key = String(l._id);
                return { lessonId: l._id, isCompleted: existing.has(key) ? existing.get(key)! : false };
            });

            secProg.lessons = merged as any;
            progress.completedSections[secIdx] = secProg;
        }
    }

    // ===== 3) Đặt cờ hoàn thành cho lesson hiện tại =====
    const targetSection = progress.completedSections.find((s: any) => String(s.sectionId) === String(sectionId));
    if (!targetSection) return next(new ErrorHandler('Section progress not found after sync', 500));

    const lIdx = targetSection.lessons.findIndex((l: any) => String(l.lessonId) === String(lessonId));
    if (lIdx === -1) {
        // Phòng hờ edge case
        targetSection.lessons.push({ lessonId, isCompleted: completed } as any);
    } else {
        targetSection.lessons[lIdx].isCompleted = completed;
    }

    // ===== 4) Lưu (middleware sẽ tự tính counters & percentage) =====
    progress.markModified('completedSections');
    await progress.save();

    // (Optional) cache & certificate
    await redis.set(`progress:${userId}:${courseId}`, JSON.stringify(progress));
    await issueCertificateIfCompleted(userId.toString(), courseId.toString(), {
        totalCompleted: progress.totalCompleted,
        totalLessons: progress.totalLessons
    });

    return res.status(200).json({
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
  }

