import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import RequestModel from '../models/Request.model';
import CourseModel from '../models/Course.model';
import UserModel from '../models/User.model';
import sendMail from '../utils/sendMail';
import BusinessModel from '../models/Business.model';
import { v2 as cloudinary } from 'cloudinary';
import SectionModel from '../models/Section.model';
import LessonModel from '../models/Lesson.model';

// Utility function to find request with fallback methods
const findRequestWithFallback = async (requestId: string) => {
    const mongoose = require('mongoose');

    // Check if requestId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
        console.log('Invalid ObjectId format');
        return null;
    }

    // Try to find the request using different methods
    let request = await RequestModel.findById(requestId);

    if (!request) {
        request = await RequestModel.findOne({ _id: requestId });
        console.log('findOne with _id result:', request ? 'Found' : 'Not found');
    }

    if (!request) {
        const ObjectId = mongoose.Types.ObjectId;
        request = await RequestModel.findById(new ObjectId(requestId));
        console.log('findById with new ObjectId result:', request ? 'Found' : 'Not found');
    }

    if (!request) {
        request = await RequestModel.findOne({ _id: new mongoose.Types.ObjectId(requestId) });
        console.log('findOne with new ObjectId result:', request ? 'Found' : 'Not found');
    }

    // If still not found, try direct database query
    if (!request) {
        console.log('Trying direct database query...');
        const db = mongoose.connection.db;
        const requestsCollection = db.collection('requests');
        const allDirectRequests = await requestsCollection.find({}).toArray();

        if (allDirectRequests.length > 0) {
            const directDoc = allDirectRequests[0];
            request = new RequestModel(directDoc);
            console.log('Created request from direct doc');
        }
    }

    console.log('=== findRequestWithFallback END ===');
    console.log('Final result:', request ? `Found request ${request._id}` : 'Not found');

    return request;
};
// 🆕 Helper: phân loại thay đổi dựa trên isPublished
function buildChangeMeta(normSections: Array<{
  _id: string;
  isPublished: boolean;
  lessons: Array<{ _id: string; isPublished: boolean }>;
}>) {
  const sectionOld: string[] = [];
  const sectionNew: string[] = [];
  const sectionUpdatedPublished: string[] = []; // section đã publish nhưng có lesson draft

  const lessonOld: string[] = [];
  const lessonNew: string[] = [];
  const bySection: Record<string, { oldLessons: string[]; newLessons: string[] }> = {};

  for (const s of normSections) {
    if (s.isPublished) sectionOld.push(s._id);
    else sectionNew.push(s._id);

    const oldLs: string[] = [];
    const newLs: string[] = [];

    for (const l of (s.lessons || [])) {
      if (l.isPublished) {
        lessonOld.push(l._id);
        oldLs.push(l._id);
      } else {
        lessonNew.push(l._id);
        newLs.push(l._id);
      }
    }

    bySection[s._id] = { oldLessons: oldLs, newLessons: newLs };

    // Published section nhưng có lesson mới (draft) => xem như "section được cập nhật"
    if (s.isPublished && newLs.length > 0) {
      sectionUpdatedPublished.push(s._id);
    }
  }

  const hasDraftChanges = sectionNew.length > 0 || lessonNew.length > 0;

  return {
    summary: {
      sections: {
        old: sectionOld.length,            // đang live
        newDraft: sectionNew.length,       // section mới (chưa live)
        updatedPublished: sectionUpdatedPublished.length // section live có lesson draft
      },
      lessons: {
        old: lessonOld.length,             // đang live
        newDraft: lessonNew.length         // lesson mới (chưa live)
      },
      hasDraftChanges
    },
    sections: {
      old: sectionOld,
      newDraft: sectionNew,
      updatedPublished: sectionUpdatedPublished
    },
    lessons: {
      old: lessonOld,
      newDraft: lessonNew,
      bySection
    }
  };
}
// Create course approval request
export const createCourseApprovalRequest = catchAsync(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) return next(new ErrorHandler('Unauthorized access', 401));

    let { courseId, message, courseSnapshot, sectionsSnapshot, thumbnailUrl } = (req.body || {}) as any;

    // Parse nếu FE lỡ gửi string
    if (typeof courseSnapshot === 'string') {
        try {
            courseSnapshot = JSON.parse(courseSnapshot);
        } catch {}
    }
    if (typeof sectionsSnapshot === 'string') {
        try {
            sectionsSnapshot = JSON.parse(sectionsSnapshot);
        } catch {}
    }

    // fallback khi FE đính trong snapshot
    if (!courseId) courseId = courseSnapshot?._id || courseSnapshot?.courseId;
    if (!courseId) return next(new ErrorHandler('Course ID is required', 400));

    // 1) Tải course từ DB
    const courseDoc = await CourseModel.findById(courseId);
    if (!courseDoc) return next(new ErrorHandler('Course not found', 404));

    // 2) Đồng bộ một số field cơ bản từ snapshot vào Course (để FE đọc courseId là thấy đúng ngay)
    if (courseSnapshot && typeof courseSnapshot === 'object') {
        const fields = [
            'name',
            'subTitle',
            'description',
            'overview',
            'level',
            'category',
            'subCategory',
            'price',
            'estimatedPrice',
            'duration',
            'topics',
            'benefits',
            'prerequisites',
            'isDraft',
            'isPublished',
            'isFree',
            'demoUrl'
        ];
        for (const k of fields) if (courseSnapshot[k] !== undefined) (courseDoc as any)[k] = courseSnapshot[k];

        const snapThumb =
            thumbnailUrl ||
            courseSnapshot.thumbnailUrl ||
            (typeof courseSnapshot.thumbnail === 'string' ? courseSnapshot.thumbnail : courseSnapshot.thumbnail?.url);

        if (snapThumb) {
            (courseDoc as any).thumbnail =
                typeof (courseDoc as any).thumbnail === 'object'
                    ? { ...((courseDoc as any).thumbnail || {}), url: snapThumb }
                    : { url: snapThumb };
        }
        await courseDoc.save();
    }

    // 3) Build sectionsSnapshot từ DB (chuẩn hoá thứ tự và shape)
    let sectionDocs: any[] = [];
    if (Array.isArray((courseDoc as any).sections) && (courseDoc as any).sections.length) {
        sectionDocs = await SectionModel.find({ _id: { $in: (courseDoc as any).sections } })
            .select('_id title order isPublished')
            .sort({ order: 1 })
            .lean();
    } else {
        sectionDocs = await SectionModel.find({ $or: [{ course: courseId }, { courseId }] })
            .select('_id title order isPublished')
            .sort({ order: 1 })
            .lean();
    }

    const sectionIds = sectionDocs.map((s) => s._id);
    const lessonDocs = sectionIds.length
        ? await LessonModel.find({ sectionId: { $in: sectionIds } })
              .select('_id title order isPublished videoLength videoUrl sectionId')
              .sort({ order: 1 })
              .lean()
        : [];

    const lessonsBySection = new Map<string, any[]>();
    for (const l of lessonDocs) {
        const sid = String(l.sectionId);
        if (!lessonsBySection.has(sid)) lessonsBySection.set(sid, []);
        lessonsBySection.get(sid)!.push({
            _id: l._id,
            title: l.title,
            order: l.order,
            isPublished: !!l.isPublished,
            videoLength: l.videoLength,
            videoUrl: l.videoUrl
        });
    }

    const sectionsSnapshotFromDb = sectionDocs.map((s) => ({
        _id: s._id,
        title: s.title,
        order: s.order,
        isPublished: !!s.isPublished,
        lessons: (lessonsBySection.get(String(s._id)) || []).sort((a, b) => a.order - b.order)
    }));

    // Luôn ưu tiên snapshot từ DB để chuẩn hoá
    sectionsSnapshot = sectionsSnapshotFromDb;

    // Chuẩn hoá snapshot course để so sánh
    const normalizeCourseSnap = (snap: any) => {
        if (!snap || typeof snap !== 'object') return {};
        const thumb =
            snap.thumbnailUrl ||
            (typeof snap.thumbnail === 'string' ? snap.thumbnail : snap.thumbnail?.url) ||
            (courseDoc as any)?.thumbnail?.url ||
            undefined;

        const pick = (o: any, keys: string[]) => {
            const out: any = {};
            for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
            return out;
        };
        const base = pick(snap, [
            'name',
            'subTitle',
            'description',
            'overview',
            'level',
            'category',
            'subCategory',
            'price',
            'estimatedPrice',
            'duration',
            'topics',
            'benefits',
            'prerequisites',
            'isDraft',
            'isPublished',
            'isFree',
            'demoUrl'
        ]);
        if (thumb) base.thumbnailUrl = thumb;
        return base;
    };

    const normalizeSectionsSnap = (secs: any[]) => {
        return (Array.isArray(secs) ? secs : [])
            .map((s) => ({
                _id: String(s._id),
                title: s.title ?? '',
                order: Number(s.order ?? 0),
                isPublished: !!s.isPublished,
                lessons: (Array.isArray(s.lessons) ? s.lessons : [])
                    .map((l: any) => ({
                        _id: String(l._id),
                        title: l.title ?? '',
                        order: Number(l.order ?? 0),
                        isPublished: !!l.isPublished,
                        // chỉ giữ phần cần thiết để so sánh, tránh noise
                        videoLength: l.videoLength ?? undefined,
                        videoUrl: l?.videoUrl?.url ?? l?.videoUrl ?? undefined
                    }))
                    .sort((a: any, b: any) => a.order - b.order)
            }))
            .sort((a, b) => a.order - b.order);
    };

    const deepEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

    const newCourseSnap =
        courseSnapshot && typeof courseSnapshot === 'object'
            ? courseSnapshot
            : {
                  _id: courseDoc._id,
                  name: courseDoc.name,
                  subTitle: courseDoc.subTitle,
                  description: courseDoc.description,
                  overview: courseDoc.overview,
                  price: courseDoc.price,
                  estimatedPrice: courseDoc.estimatedPrice,
                  duration: courseDoc.duration,
                  topics: (courseDoc as any).topics || (courseDoc as any).tags || [],
                  isPublished: (courseDoc as any).isPublished,
                  isDraft: (courseDoc as any).isDraft,
                  thumbnail: (courseDoc as any)?.thumbnail,
                  level: (courseDoc as any)?.level,
                  category: (courseDoc as any)?.category,
                  subCategory: (courseDoc as any)?.subCategory,
                  isFree: (courseDoc as any)?.isFree,
                  demoUrl: (courseDoc as any)?.demoUrl,
                  benefits: (courseDoc as any)?.benefits,
                  prerequisites: (courseDoc as any)?.prerequisites
              };

    const normNewCourse = normalizeCourseSnap(newCourseSnap);
    const normNewSections = normalizeSectionsSnap(sectionsSnapshot);

    // 🆕 Tính meta thay đổi dựa trên isPublished
    const changeMeta = buildChangeMeta(
        normNewSections.map((s) => ({
            _id: s._id,
            isPublished: !!s.isPublished,
            lessons: (s.lessons || []).map((l: any) => ({ _id: l._id, isPublished: !!l.isPublished }))
        }))
    );

    // 4) Nếu đã có request pending -> cập nhật request hiện tại
    const existed = await RequestModel.findOne({
        userId,
        courseId,
        type: 'course_approval',
        status: 'pending'
    });

    if (existed) {
        const currCourse = normalizeCourseSnap(existed?.data?.course || {});
        const currSections = normalizeSectionsSnap(existed?.data?.sections || []);

        const changedCourse = !deepEqual(currCourse, normNewCourse);
        const changedSections = !deepEqual(currSections, normNewSections);

        if (changedCourse || changedSections) {
            existed.data = existed.data || {};
            existed.data.course = newCourseSnap;
            existed.data.sections = sectionsSnapshot;
            // 🆕 cập nhật meta vào data của request
            existed.data.meta = changeMeta;
            if (message) existed.message = message;
            existed.markModified('data');
            await existed.save();

            const populated = await RequestModel.findById(existed._id)
                .populate({
                    path: 'courseId',
                    select: 'name subTitle description overview topics tags thumbnail price estimatedPrice duration isPublished updatedAt sections',
                    populate: {
                        path: 'sections',
                        select: '_id title order isPublished lessons',
                        options: { sort: { order: 1 } },
                        populate: {
                            path: 'lessons',
                            select: '_id title order isPublished videoLength videoUrl',
                            options: { sort: { order: 1 } }
                        }
                    }
                })
                .populate({ path: 'userId', select: 'name email avatar' })
                .lean();

            return res.status(200).json({
                success: true,
                message: 'An approval request is already pending. It has been updated with your latest changes.',
                updated: true,
                data: populated
            });
        }

        return res.status(200).json({
            success: true,
            message: 'An approval request is already pending. No changes detected.',
            updated: false,
            data: existed
        });
    }

    // 5) Tạo request mới
    const newReq = await RequestModel.create({
        userId,
        courseId,
        type: 'course_approval',
        status: 'pending',
        message: message || `Request to approve course`,
        data: {
            course: newCourseSnap,
            sections: sectionsSnapshot,
            // 🆕 đính kèm meta để BE/FE đọc ngay
            meta: changeMeta
        }
    });
    // 6) Populate để UI đọc trực tiếp
    const populated = await RequestModel.findById(newReq._id)
        .populate({
            path: 'courseId',
            select: 'name subTitle description overview topics tags thumbnail price estimatedPrice duration isPublished updatedAt sections',
            populate: {
                path: 'sections',
                select: '_id title order isPublished lessons',
                options: { sort: { order: 1 } },
                populate: {
                    path: 'lessons',
                    select: '_id title order isPublished videoLength videoUrl',
                    options: { sort: { order: 1 } }
                }
            }
        })
        .populate({ path: 'userId', select: 'name email avatar' })
        .lean();

    return res.status(201).json({
        success: true,
        message: 'Course approval request has been submitted.',
        data: populated
    });
});



// Get request by course ID (for course_approval)
export const getCourseApprovalRequestByCourseId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { courseId } = req.params;
        if (!courseId) return next(new ErrorHandler('Course ID is required', 400));

        const request = await RequestModel.findOne({ courseId, type: 'course_approval' });
        if (!request) return next(new ErrorHandler('No course approval request found', 404));

        res.status(200).json({ success: true, data: request });
    }
);

// Get all pending requests (optionally filtered by type)
export const getAllPendingRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type, status } = req.query;
    
    const filter: any = { 
        $or: [
            { deletedAt: { $exists: false } },
            { deletedAt: null }
        ]
    };
    
    // Filter by type if provided
    if (type) filter.type = type;
    
    // Filter by status if provided and not 'all'
    if (status && status !== 'all') {
        filter.status = status;
    } else {
        // Default to pending if no status filter
        filter.status = { $in: ['pending', 'approved', 'rejected'] };
    }

    const requests = await RequestModel.find(filter)
        .populate('userId', 'name email avatar businessInfo socialLinks')
        .populate({
            path: 'userId',
            populate: {
                path: 'businessInfo.businessId',
                model: 'Business',
                select: 'name description'
            }
        })
        .populate('courseId', 'name description thumbnail tags overview subTitle')
        .lean();
    
    if (!requests.length) {
        return res.status(200).json({ 
            success: false, 
            message: 'No requests found',
            data: []
        });
    }

    res.status(200).json({ 
        success: true, 
        data: requests,
        metadata: {
            total: requests.length
        }
    });
});

// Handle request approval/rejection (generic)
export const handleRequestActionCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { requestId } = req.params;
  const { action } = req.body;

  console.log("=== handleRequestActionCourse START ===");
  console.log("Request ID:", requestId);
  console.log("Action:", action);

  if (!requestId) return next(new ErrorHandler("Request ID is required", 400));
  if (!["approve", "reject"].includes(action)) return next(new ErrorHandler("Invalid action", 400));

  const request = await findRequestWithFallback(requestId);
  if (!request) return next(new ErrorHandler("Request not found", 404));

  console.log("Found request:", request._id, request.type, request.status);

  // Non-course_approval -> giữ nguyên hành vi cũ
  if (request.type !== "course_approval") {
    request.status = action === "approve" ? "approved" : "rejected";
    await request.save();
    return res.status(200).json({
      success: true,
      message: `Request has been ${request.status}.`,
      requestId: request._id,
    });
  }

  // ==== course_approval flow ====
  const course = await CourseModel.findById(request.courseId);
  const instructor = await UserModel.findById(request.userId);
  if (!course || !instructor) return next(new ErrorHandler("Course or Instructor not found", 404));

  console.log("Found course:", course._id, course.name);
  console.log("Found instructor:", instructor._id, instructor.name);

  // Snapshot trong request để biết cái nào là draft (isPublished=false)
  const sectionsInReq: Array<{
    _id: any;
    isPublished?: boolean;
    lessons?: Array<{ _id: any; isPublished?: boolean }>;
  }> = Array.isArray(request?.data?.sections) ? request.data.sections : [];

  const sectionIdsInReq = sectionsInReq.map((s) => String(s._id)).filter(Boolean);

  // Fallback: nếu snapshot rỗng (ít gặp), lấy toàn bộ section theo course
  const fallbackSectionDocs =
    sectionIdsInReq.length === 0
      ? await SectionModel.find({ $or: [{ course: course._id }, { courseId: course._id }] })
          .select("_id")
          .lean()
      : [];

  const effectiveSectionIds = sectionIdsInReq.length
    ? sectionIdsInReq
    : fallbackSectionDocs.map((s: any) => String(s._id));

  // Lấy danh sách draft trong snapshot
  const draftSectionIds = sectionsInReq
    .filter((s) => s && s._id && s.isPublished === false)
    .map((s) => String(s._id));

  const draftLessonIds = sectionsInReq.flatMap((s) =>
    (Array.isArray(s?.lessons) ? s.lessons : [])
      .filter((l) => l && l._id && l.isPublished === false)
      .map((l) => String(l._id))
  );

  // Fallback nếu snapshot không có flag isPublished cho items
  let fallbackDraftSectionIds: string[] = [];
  let fallbackDraftLessonIds: string[] = [];
  if (draftSectionIds.length === 0 && draftLessonIds.length === 0 && effectiveSectionIds.length) {
    const fbSecs = await SectionModel.find({ _id: { $in: effectiveSectionIds }, isPublished: false })
      .select("_id")
      .lean();
    fallbackDraftSectionIds = fbSecs.map((s) => String(s._id));

    const fbLes = await LessonModel.find({ sectionId: { $in: effectiveSectionIds }, isPublished: false })
      .select("_id")
      .lean();
    fallbackDraftLessonIds = fbLes.map((l) => String(l._id));
  }

  const sectionsToPublish = draftSectionIds.length ? draftSectionIds : fallbackDraftSectionIds;
  const lessonsToPublish = draftLessonIds.length ? draftLessonIds : fallbackDraftLessonIds;

  if (action === "approve") {
    // 1) Publish course (đưa course sang live)
    await CourseModel.findByIdAndUpdate(course._id, { isPublished: true, isDraft: false });

    // 2) Publish SECTION mới (draft) có trong request
    let sectionsModified = 0;
    if (sectionsToPublish.length) {
      const secRes = await SectionModel.updateMany(
        { _id: { $in: sectionsToPublish }, isPublished: { $ne: true } },
        { $set: { isPublished: true } }
      );
      // @ts-ignore
      sectionsModified = secRes?.modifiedCount ?? secRes?.nModified ?? 0;
    }

    // 3) Publish LESSON mới (draft) có trong request (kể cả thuộc section đã publish)
    let lessonsModified = 0;
    if (lessonsToPublish.length) {
      const lesRes = await LessonModel.updateMany(
        { _id: { $in: lessonsToPublish }, isPublished: { $ne: true } },
        { $set: { isPublished: true } }
      );
      // @ts-ignore
      lessonsModified = lesRes?.modifiedCount ?? lesRes?.nModified ?? 0;
    }

    // 4) Cập nhật trạng thái request (KHÔNG xoá request)
    request.status = "approved";
    await request.save();

    try {
      await sendMail({
        email: instructor.email,
        subject: "Your Course Has Been Approved!",
        template: "approved-request-mail.ejs",
        data: {
          user: { name: instructor.name },
          courseName: course.name,
          rejectionReason: "",
          courseUrl: `https://academix.id.vn/courses/${course._id}`,
        },
      });
      console.log("Email sent successfully");
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    console.log(
      `Published items -> sections: ${sectionsModified}, lessons: ${lessonsModified}`
    );

    return res.status(200).json({
      success: true,
      message: `Request approved. Published ${sectionsModified} section(s) and ${lessonsModified} lesson(s).`,
      stats: { sectionsPublished: sectionsModified, lessonsPublished: lessonsModified },
      requestId: request._id,
    });
  }

  // action === 'reject'
  // Không đụng gì tới dữ liệu live, giữ nguyên draft để giảng viên tiếp tục sửa.
  request.status = "rejected";
  await request.save();

  try {
    await sendMail({
      email: instructor.email,
      subject: "Your Course Update Was Not Approved",
      template: "reject-request-mail.ejs",
      data: {
        user: { name: instructor.name },
        courseName: course.name,
        rejectionReason: "Your recent updates did not meet the platform requirements.",
        courseUrl: `https://academix.id.vn/instructor/courses/edit-course/${course._id}`,
      },
    });
    console.log("Email sent successfully");
  } catch (emailError) {
    console.error("Email sending failed:", emailError);
  }

  return res.status(200).json({
    success: true,
    message: "Request has been rejected. Draft changes remain un-published.",
    requestId: request._id,
  });
});



// Cleanup processed requests (can be called by a cron job)
export const cleanupProcessedRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    console.log('=== cleanupProcessedRequests START ===');
    
    try {
        // Delete requests that have been processed for more than 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const deleteResult = await RequestModel.deleteMany({
            status: 'processed',
            processedAt: { $lt: twentyFourHoursAgo }
        });
        
        console.log(`Deleted ${deleteResult.deletedCount} processed requests older than 24 hours`);
        
        // Also cleanup any approved/rejected requests older than 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const cleanupOldRequests = await RequestModel.deleteMany({
            status: { $in: ['approved', 'rejected'] },
            updatedAt: { $lt: sevenDaysAgo }
        });
        
        console.log(`Deleted ${cleanupOldRequests.deletedCount} old approved/rejected requests`);
        
        // Cleanup deleted requests older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const cleanupDeletedRequests = await RequestModel.deleteMany({
            status: 'deleted',
            deletedAt: { $lt: oneHourAgo }
        });
        
        console.log(`Deleted ${cleanupDeletedRequests.deletedCount} deleted requests older than 1 hour`);
        console.log('=== cleanupProcessedRequests END ===');
        
        res.status(200).json({
            success: true,
            message: `Cleaned up ${deleteResult.deletedCount} processed requests, ${cleanupOldRequests.deletedCount} old requests, and ${cleanupDeletedRequests.deletedCount} deleted requests`
        });
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({
            success: false,
            message: 'Error during cleanup process'
        });
    }
});

// Force cleanup all approved/rejected requests (emergency cleanup)
export const forceCleanupAllRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    console.log('=== forceCleanupAllRequests START ===');
    
    try {
        // Delete all approved/rejected/processed/deleted requests
        const deleteResult = await RequestModel.deleteMany({
            status: { $in: ['approved', 'rejected', 'processed', 'deleted'] }
        });
        
        console.log(`Force deleted ${deleteResult.deletedCount} requests`);
        console.log('=== forceCleanupAllRequests END ===');
        
        res.status(200).json({
            success: true,
            message: `Force cleaned up ${deleteResult.deletedCount} requests`
        });
    } catch (error) {
        console.error('Error during force cleanup:', error);
        res.status(500).json({
            success: false,
            message: 'Error during force cleanup process'
        });
    }
});

// Force cleanup deleted requests immediately
export const forceCleanupDeletedRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    console.log('=== forceCleanupDeletedRequests START ===');
    
    try {
        // Delete all requests with deleted status
        const deleteResult = await RequestModel.deleteMany({
            status: 'deleted'
        });
        
        console.log(`Force deleted ${deleteResult.deletedCount} deleted requests`);
        console.log('=== forceCleanupDeletedRequests END ===');
        
        res.status(200).json({
            success: true,
            message: `Force cleaned up ${deleteResult.deletedCount} deleted requests`
        });
    } catch (error) {
        console.error('Error during force cleanup deleted requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error during force cleanup deleted requests process'
        });
    }
});

// Get request statistics (for debugging)
export const getRequestStatistics = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    console.log('=== getRequestStatistics START ===');
    
    try {
        const stats = await RequestModel.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const totalRequests = await RequestModel.countDocuments({});
        const pendingRequests = await RequestModel.countDocuments({ status: 'pending' });
        const approvedRequests = await RequestModel.countDocuments({ status: 'approved' });
        const rejectedRequests = await RequestModel.countDocuments({ status: 'rejected' });
        const processedRequests = await RequestModel.countDocuments({ status: 'processed' });
        const deletedRequests = await RequestModel.countDocuments({ status: 'deleted' });
        
        console.log('Request statistics:', {
            total: totalRequests,
            pending: pendingRequests,
            approved: approvedRequests,
            rejected: rejectedRequests,
            processed: processedRequests,
            deleted: deletedRequests
        });
        
        console.log('=== getRequestStatistics END ===');
        
        res.status(200).json({
            success: true,
            data: {
                total: totalRequests,
                pending: pendingRequests,
                approved: approvedRequests,
                rejected: rejectedRequests,
                processed: processedRequests,
                deleted: deletedRequests,
                breakdown: stats
            }
        });
    } catch (error) {
        console.error('Error getting request statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting request statistics'
        });
    }
});





// Create business approval request

export const createBusinessVerificationRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const {
        businessName,
        description,
        taxCode,
        email,
        address,
        businessSector,
        representativeName,
        representativePhone,
        representativeEmail,
        representativeAddress
    } = req.body;
    const createdBy = req.user?._id || req.body.createdBy;

    if (!createdBy) return next(new ErrorHandler('Unauthorized access', 401));
    if (!businessName) return next(new ErrorHandler('Business name is required', 400));

    const existingRequest = await RequestModel.findOne({
        userId: createdBy,
        type: 'business_verification',
        status: 'pending'
    });

    if (existingRequest) {
        return next(new ErrorHandler('A business verification request is already pending.', 400));
    }

    // Xử lý file upload lên Cloudinary
    let logoUrl = '';
    let docImageUrls: string[] = [];
    if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files.logo && files.logo[0]) {
            const logoFile = files.logo[0];
            // Upload logo lên Cloudinary
            logoUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ folder: 'business/logo' }, (error, result) => {
                    if (error || !result) reject(error || new Error('No result from Cloudinary'));
                    else resolve(result.secure_url);
                });
                stream.end(logoFile.buffer);
            });
        }
        if (files.docImages) {
            for (const file of files.docImages) {
                const url = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream({ folder: 'business/docs' }, (error, result) => {
                        if (error || !result) reject(error || new Error('No result from Cloudinary'));
                        else resolve(result.secure_url);
                    });
                    stream.end(file.buffer);
                });
                docImageUrls.push(url as string);
            }
        }
    }

    const newBusiness = await BusinessModel.create({
        businessName,
        description,
        taxCode,
        email,
        address,
        businessSector,
        logo: logoUrl,
        docImages: docImageUrls,
        representative: {
            name: representativeName,
            phone: representativePhone,
            email: representativeEmail,
            address: representativeAddress
        },
        createdBy: createdBy,
        isVerified: false
    });

    await RequestModel.create({
        businessId: newBusiness._id,
        userId: createdBy,
        type: 'business_verification',
        status: 'pending',
        message: `Request to verify business "${businessName}".`,
        data: {
            businessName,
            description,
            taxCode,
            email,
            address,
            businessSector,
            logo: logoUrl,
            docImages: docImageUrls,
            representative: {
                name: representativeName,
                phone: representativePhone,
                email: representativeEmail,
                address: representativeAddress
            }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Business verification request has been submitted.',
        data: {
            business: newBusiness
        }
    });
});

// Get a single request by ID (Admin only)
export const getRequestById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.params;

    if (!requestId) return next(new ErrorHandler('Request ID is required', 400));

    const request = await RequestModel.findById(requestId)
        .populate('courseId')
        .populate('userId')
        .populate('businessId');

    if (!request) return next(new ErrorHandler('Request not found', 404));

    res.status(200).json({ success: true, data: request });
});

// Get a single request by userId and request type
// export const getRequestByUserIdAndType = catchAsync(
//     async (req: Request, res: Response, next: NextFunction) => {
//         const { userId } = req.params;
//         const { type } = req.query;

//         if (!userId) return next(new ErrorHandler('User ID is required', 400));
//         if (!type) return next(new ErrorHandler('Request type is required', 400));

//         const request = await RequestModel.findOne({ userId, type });

//         if (!request) {
//             return next(new ErrorHandler('No request found for this user and type', 404));
//         }

//         res.status(200).json({ success: true, data: request });
//     }
// );

// Handle business verification request approval/rejection
export const handleRequestActionBusiness = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.params;
    const { action } = req.body;

    if (!requestId) return next(new ErrorHandler('Request ID is required', 400));
    if (!['approve', 'reject'].includes(action)) return next(new ErrorHandler('Invalid action', 400));

    const request = await findRequestWithFallback(requestId);
    if (!request) return next(new ErrorHandler('Request not found', 404));

    if (request.type !== 'business_verification') {
        return next(new ErrorHandler('This is not a business verification request', 400));
    }

    request.status = action === 'approve' ? 'approved' : 'rejected';
    await request.save();

    // Tìm business theo businessId trong request
    const business = await BusinessModel.findById(request.businessId);
    if (!business) return next(new ErrorHandler('Business not found', 404));

    // Nếu approve thì cập nhật isVerified
    if (action === 'approve') {
        business.isVerified = true;
        const isExist = business.employees.some((emp: any) => emp.user.toString() === request.userId.toString());
        if (!isExist) {
            business.employees.push({
                user: request.userId,
                role: 'admin',
                createdAt: new Date()
            });
        }

        await business.save();
        await UserModel.findByIdAndUpdate(
            request.userId,
            {
                businessInfo: {
                    businessId: business._id,
                    role: 'admin'
                }
            },
            { new: true }
        );
    }

    // Gửi mail cho người tạo business (user)
    const user = await UserModel.findById(request.userId);
    if (user) {
        await sendMail({
            email: user.email,
            subject: action === 'approve' ? 'Business Verification Approved' : 'Business Verification Rejected',
            template: action === 'approve' ? 'approved-business-mail.ejs' : 'reject-business-mail.ejs',
            data: {
                user: { name: user.name },
                businessName: business.businessName,
                rejectionReason:
                    action === 'reject' ? 'Your business verification request did not meet the requirements.' : ''
            }
        });
    }

    // Xóa request sau khi xử lý
    try {
        const deleteResult = await RequestModel.deleteOne({ _id: requestId });
        console.log('Business request deleteOne result:', deleteResult);
        
        if (deleteResult.deletedCount === 0) {
            console.log('Business request deleteOne failed, trying findByIdAndDelete...');
            const findAndDeleteResult = await RequestModel.findByIdAndDelete(requestId);
            console.log('Business request findByIdAndDelete result:', findAndDeleteResult);
            
            if (!findAndDeleteResult) {
                console.log('Both deletion methods failed for business request, marking as processed...');
                await RequestModel.findByIdAndUpdate(requestId, { 
                    status: 'processed',
                    processedAt: new Date()
                });
                console.log('Marked business request as processed');
            }
        }
    } catch (deleteError) {
        console.error('Error during business request deletion:', deleteError);
        try {
            await RequestModel.findByIdAndUpdate(requestId, { 
                status: 'processed',
                processedAt: new Date()
            });
            console.log('Marked business request as processed due to deletion error');
        } catch (updateError) {
            console.error('Error marking business request as processed:', updateError);
        }
    }

    // Final check for business request
    try {
        const finalCheck = await RequestModel.findById(requestId);
        if (finalCheck) {
            console.log('WARNING: Business request still exists after deletion attempt, forcing deletion...');
            await RequestModel.deleteOne({ _id: requestId });
            console.log('Forced business request deletion completed');
        } else {
            console.log('Business request successfully deleted');
        }
    } catch (finalCheckError) {
        console.error('Error during business request final check:', finalCheckError);
    }

    res.status(200).json({
        success: true,
        message: `Business verification request has been ${request.status} and notification sent.`
    });
});

// Create instructor verification request
export const createInstructorVerificationRequest = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const {
            fullName,
            email,
            phoneNumber,
            dob,
            address,
            category,
            description,
            experience,
            role,
            company,
            documents // use middleware to upload
        } = req.body;
        const createdBy = req.user?._id || req.body.userId;

        if (!createdBy) return next(new ErrorHandler('Unauthorized access', 401));
        if (!fullName || !email || !phoneNumber || !dob || !address || !category || !description) {
            return next(new ErrorHandler('Missing required fields', 400));
        }

        // Check status is pending
        const existingRequest = await RequestModel.findOne({
            userId: createdBy,
            type: 'instructor_verification',
            status: 'pending'
        });
        if (existingRequest) {
            return next(new ErrorHandler('A instructor verification request is already pending.', 400));
        }

        // Xử lý upload docImages lên Cloudinary
        let docImageUrls: string[] = [];
        if (req.files && (req.files as any).docImages) {
            const files = (req.files as { [fieldname: string]: Express.Multer.File[] }).docImages;
            for (const file of files) {
                const url = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream({ folder: 'instructor/docs' }, (error, result) => {
                        if (error || !result) reject(error || new Error('No result from Cloudinary'));
                        else resolve(result.secure_url);
                    });
                    stream.end(file.buffer);
                });
                docImageUrls.push(url as string);
            }
        }

        // Create new request
        const newRequest = await RequestModel.create({
            userId: createdBy,
            type: 'instructor_verification',
            status: 'pending',
            data: {
                fullName,
                email,
                phoneNumber,
                dob,
                address,
                category,
                description,
                experience,
                role,
                company,
                documents: docImageUrls
            }
        });

        res.status(201).json({
            success: true,
            message: 'Instructor verification request has been submitted.',
            data: newRequest
        });
    }
);

export const handleRequestActionInstructor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.params;
    const { action } = req.body;

    if (!requestId) return next(new ErrorHandler('Request ID is required', 400));
    if (!['approve', 'reject'].includes(action)) return next(new ErrorHandler('Invalid action', 400));

    const request = await findRequestWithFallback(requestId);
    if (!request) return next(new ErrorHandler('Request not found', 404));

    if (request.type !== 'instructor_verification') {
        return next(new ErrorHandler('This is not an instructor verification request', 400));
    }

    request.status = action === 'approve' ? 'approved' : 'rejected';
    await request.save();

    // Nếu approve, cập nhật user thành instructor
    if (action === 'approve') {
        await UserModel.findByIdAndUpdate(
            request.userId,
            { role: 'instructor' }, // hoặc cập nhật trường phù hợp
            { new: true }
        );
    }
    // Gửi mail cho user (nếu muốn)
    const user = await UserModel.findById(request.userId);
    if (user) {
        await sendMail({
            email: user.email,
            subject: action === 'approve' ? 'Instructor Verification Approved' : 'Instructor Verification Rejected',
            template: action === 'approve' ? 'approved-instructor-mail.ejs' : 'reject-instructor-mail.ejs',
            data: {
                user: { name: user.name },
                rejectionReason:
                    action === 'reject' ? 'Your instructor verification request did not meet the requirements.' : ''
            }
        });
    }
    // Xóa request sau khi xử lý
    try {
        const deleteResult = await RequestModel.deleteOne({ _id: requestId });
        console.log('Instructor request deleteOne result:', deleteResult);
        
        if (deleteResult.deletedCount === 0) {
            console.log('Instructor request deleteOne failed, trying findByIdAndDelete...');
            const findAndDeleteResult = await RequestModel.findByIdAndDelete(requestId);
            console.log('Instructor request findByIdAndDelete result:', findAndDeleteResult);
            
            if (!findAndDeleteResult) {
                console.log('Both deletion methods failed for instructor request, marking as processed...');
                await RequestModel.findByIdAndUpdate(requestId, { 
                    status: 'processed',
                    processedAt: new Date()
                });
                console.log('Marked instructor request as processed');
            }
        }
    } catch (deleteError) {
        console.error('Error during instructor request deletion:', deleteError);
        try {
            await RequestModel.findByIdAndUpdate(requestId, { 
                status: 'processed',
                processedAt: new Date()
            });
            console.log('Marked instructor request as processed due to deletion error');
        } catch (updateError) {
            console.error('Error marking instructor request as processed:', updateError);
        }
    }

    // Final check for instructor request
    try {
        const finalCheck = await RequestModel.findById(requestId);
        if (finalCheck) {
            console.log('WARNING: Instructor request still exists after deletion attempt, forcing deletion...');
            await RequestModel.deleteOne({ _id: requestId });
            console.log('Forced instructor request deletion completed');
        } else {
            console.log('Instructor request successfully deleted');
        }
    } catch (finalCheckError) {
        console.error('Error during instructor request final check:', finalCheckError);
    }

    res.status(200).json({
        success: true,
        message: `Instructor verification request has been ${request.status}.`
    });
});

export const getAllInstructorCourseRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id; // lấy từ middleware isAuthenticated

    if (!userId) {
        return next(new ErrorHandler('Unauthorized access', 401));
    }

    // Lọc tất cả request của instructor hiện tại
    const requests = await RequestModel.find({
        userId,
        type: 'course_approval' // chỉ lấy request duyệt course
    })
        .populate('courseId') // lấy thông tin course
        .sort({ createdAt: -1 }); // mới nhất trước

    res.status(200).json({
        success: true,
        total: requests.length,
        data: requests
    });
});

export const updateCourseApprovalRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user._id;
    const { requestId, courseId, message, status } = req.body;

    if (!userId) return next(new ErrorHandler('Unauthorized access', 401));
    if (!courseId) return next(new ErrorHandler('Course ID is required', 400));

    // Tìm request
    const query: any = { courseId, userId, type: 'course_approval' };
    if (requestId) query._id = requestId; // nếu có requestId, check chính xác

    const existingRequest = await RequestModel.findOne(query);

    if (!existingRequest) {
        return next(new ErrorHandler('No course approval request found to update.', 404));
    }

    // Cập nhật trạng thái và message
    if (status) existingRequest.status = status;
    else existingRequest.status = 'pending'; // default

    if (message) existingRequest.message = message;

    await existingRequest.save();

    res.status(200).json({
        success: true,
        message: `Course approval request updated to ${existingRequest.status}.`,
        data: existingRequest
    });
});
