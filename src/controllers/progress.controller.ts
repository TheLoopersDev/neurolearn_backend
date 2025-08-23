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

// ===== Update lesson completion =====
export const updateLessonCompletionStatus = catchAsync(async (req: Request, res: Response, next: any) => {
  const userId = req.user?._id as string | undefined;
  const courseId = req.params.id as string;
  const { lessonId, isCompleted } = req.body as { lessonId?: string; isCompleted?: boolean | string };

  if (!userId) return next(new ErrorHandler('Unauthorized', 401));
  if (!courseId || !lessonId) return next(new ErrorHandler('Course ID and Lesson ID are required', 400));

  // Chuẩn hóa boolean
  const completed = isCompleted === true || isCompleted === 'true';

  // 1) Lấy course với sections/lessons ĐANG ĐƯỢC DÙNG (ground-truth)
  const course = await CourseModel.findById(courseId).populate([
    {
      path: 'sections',
      match: { isPublished: true },
      options: { sort: { order: 1 } },
      populate: {
        path: 'lessons',
        match: { isPublished: true },
        select: '_id sectionId',
        options: { sort: { order: 1 } }
      }
    }
  ]);

  if (!course) return next(new ErrorHandler('Course not found', 404));

  // 2) Tìm section chứa lessonId trong snapshot của course
  let containingSectionId: any = null;
  for (const sec of (course.sections as any[]) || []) {
    for (const l of (sec.lessons as any[]) || []) {
      if (String(l._id) === String(lessonId)) {
        containingSectionId = sec._id;
        break;
      }
    }
    if (containingSectionId) break;
  }
  if (!containingSectionId) {
    return next(new ErrorHandler('Lesson not found in this course or not published', 404));
  }

  // 3) Lấy progress hoặc khởi tạo
  let progress = await ProgressModel.findOne({ user: userId, course: courseId });
  if (!progress) {
    progress = new ProgressModel({
      user: userId,
      course: courseId,
      completedSections: []
    });
  }

  // 4) Đồng bộ progress THEO DANH SÁCH sections/lessons của course (loại sạch rác)
  //    - Giữ lại trạng thái isCompleted cũ nếu có
  const prevCompletedMap = new Map<string, boolean>();
  for (const sec of (progress.completedSections as any[]) || []) {
    for (const l of (sec.lessons as any[]) || []) {
      prevCompletedMap.set(String(l.lessonId), !!l.isCompleted);
    }
  }

  const syncedSections = ((course.sections as any[]) || []).map((sec: any) => {
    const lessons = ((sec.lessons as any[]) || []).map((l: any) => ({
      lessonId: l._id,
      isCompleted: prevCompletedMap.get(String(l._id)) ?? false
    }));
    const completedLessons = lessons.reduce((acc, it) => acc + (it.isCompleted ? 1 : 0), 0);
    return {
      sectionId: sec._id,
      lessons,
      completedLessons,
      totalLessonsInSection: lessons.length
    };
  });

  progress.completedSections = syncedSections;

  // 5) Cập nhật cờ cho lesson hiện tại
  const targetSection = (progress.completedSections as any[]).find(
    (s: any) => String(s.sectionId) === String(containingSectionId)
  );
  if (!targetSection) return next(new ErrorHandler('Section progress not found after sync', 500));

  const lIdx = (targetSection.lessons as any[]).findIndex(
    (l: any) => String(l.lessonId) === String(lessonId)
  );
  if (lIdx === -1) {
    // (Edge hiếm) lesson vừa sync không có — thêm vào cho chắc
    targetSection.lessons.push({ lessonId, isCompleted: completed } as any);
  } else {
    targetSection.lessons[lIdx].isCompleted = completed;
  }
  // Recompute section counters
  targetSection.completedLessons = (targetSection.lessons as any[]).reduce(
    (acc: number, it: any) => acc + (it.isCompleted ? 1 : 0),
    0
  );
  targetSection.totalLessonsInSection = (targetSection.lessons as any[]).length;

  // 6) Tính tổng (ground-truth theo course.sections)
  const totalLessons = ((course.sections as any[]) || []).reduce(
    (sum, sec: any) => sum + (((sec.lessons as any[]) || []).length),
    0
  );
  const totalCompleted = (progress.completedSections as any[]).reduce(
    (sum: number, sec: any) => sum + (sec.lessons as any[]).filter((x: any) => x.isCompleted).length,
    0
  );
  const progressPercentage = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  // (Optional) nếu schema có các field này, set để dọn dữ liệu sai cũ
  (progress as any).totalLessons = totalLessons;
  (progress as any).totalCompleted = totalCompleted;
  (progress as any).progressPercentage = progressPercentage;

  // 7) Lưu + cache
  progress.markModified('completedSections');
  await progress.save();
  await redis.set(`progress:${userId}:${courseId}`, JSON.stringify(progress));

  // 8) Certificate
  await issueCertificateIfCompleted(String(userId), String(courseId), {
    totalCompleted,
    totalLessons
  });

  // 9) Response
  return res.status(200).json({
    success: true,
    message: 'Lesson completion status updated successfully',
    data: {
      ...progress.toObject(),
      totalLessons,
      totalCompleted,
      completionPercentage: progressPercentage
    }
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

