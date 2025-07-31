import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import RequestModel from '../models/Request.model';
import CourseModel from '../models/Course.model';
import UserModel from '../models/User.model';
import sendMail from '../utils/sendMail';
import BusinessModel from '../models/Business.model';
import { v2 as cloudinary } from 'cloudinary';

// Create course approval request
export const createCourseApprovalRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user._id; 
  const { courseId, message } = req.body;

    if (!userId) return next(new ErrorHandler('Unauthorized access', 401));
    if (!courseId) return next(new ErrorHandler('Course ID is required', 400));

    const existingRequest = await RequestModel.findOne({
        courseId,
        userId,
        type: 'course_approval',
        status: 'pending'
    });
    if (existingRequest) return next(new ErrorHandler('A course approval request is already pending.', 400));

    const newRequest = await RequestModel.create({
        courseId,
        userId,
        type: 'course_approval',
        status: 'pending',
        message
    });

    res.status(201).json({ success: true, data: newRequest });
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
    const { type } = req.query;
    const filter: any = { status: 'pending' };
    if (type) filter.type = type;

    const requests = await RequestModel.find(filter)
        .populate('courseId')
        .populate('instructorId')
        .populate('businessId');

    if (!requests.length) return next(new ErrorHandler('No pending requests found', 404));

    res.status(200).json({ success: true, data: requests });
});

// Handle request approval/rejection (generic)
export const handleRequestActionCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.params;
    const { action } = req.body;

    if (!requestId) return next(new ErrorHandler('Request ID is required', 400));
    if (!['approve', 'reject'].includes(action)) return next(new ErrorHandler('Invalid action', 400));

    const request = await RequestModel.findById(requestId);
    if (!request) return next(new ErrorHandler('Request not found', 404));

    request.status = action === 'approve' ? 'approved' : 'rejected';
    await request.save();

    if (request.type === 'course_approval') {
        const course = await CourseModel.findById(request.courseId);
        const instructor = await UserModel.findById(request.instructorId);
        if (!course || !instructor) return next(new ErrorHandler('Course or Instructor not found', 404));

        if (action === 'approve') await CourseModel.findByIdAndUpdate(request.courseId, { isPublished: true });

        await sendMail({
            email: instructor.email,
            subject: action === 'approve' ? 'Your Course Has Been Approved!' : 'Your Course Has Been Rejected',
            template: action === 'approve' ? 'approved-request-mail.ejs' : 'reject-request-mail.ejs',
            data: {
                user: { name: instructor.name },
                courseName: course.name,
                rejectionReason: action === 'reject' ? 'Your course did not meet the platform requirements.' : '',
                courseUrl: `https://your-platform.com/courses/${course._id}`
            }
        });
    }

    await RequestModel.findByIdAndDelete(requestId);

    res.status(200).json({
        success: true,
        message: `Request has been ${request.status} and email notification sent.`
    });
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
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'business/logo' },
                    (error, result) => {
                        if (error || !result) reject(error || new Error('No result from Cloudinary'));
                        else resolve(result.secure_url);
                    }
                );
                stream.end(logoFile.buffer);
            });
        }
        if (files.docImages) {
            for (const file of files.docImages) {
                const url = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'business/docs' },
                        (error, result) => {
                            if (error || !result) reject(error || new Error('No result from Cloudinary'));
                            else resolve(result.secure_url);
                        }
                    );
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
        message: `Request to verify business "${businessName}".`
    });

    res.status(201).json({
        success: true,
        message: 'Business verification request has been submitted.',
        data: {
            business: newBusiness
        }
    });
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

    const request = await RequestModel.findById(requestId);
    if (!request) return next(new ErrorHandler('Request not found', 404));

    if (request.type !== 'business_verification') {
        return next(new ErrorHandler('This is not a business verification request', 400));
    }

    request.status = action === 'approve' ? 'approved' : 'rejected';
    await request.save();

    // Tìm business theo userId đã tạo
    const business = await BusinessModel.findOne({ createdBy: request.userId });
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
    await RequestModel.findByIdAndDelete(requestId);

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
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'instructor/docs' },
                        (error, result) => {
                            if (error || !result) reject(error || new Error('No result from Cloudinary'));
                            else resolve(result.secure_url);
                        }
                    );
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

    const request = await RequestModel.findById(requestId);
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
    await RequestModel.findByIdAndDelete(requestId);

    res.status(200).json({
        success: true,
        message: `Instructor verification request has been ${request.status}.`
    });
});
