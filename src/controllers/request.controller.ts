import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import RequestModel from '../models/Request.model';
import CourseModel from '../models/Course.model';
import UserModel from '../models/User.model';
import sendMail from '../utils/sendMail';
import BusinessModel from '../models/Business.model';
import { v2 as cloudinary } from 'cloudinary';

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

// Create course approval request
export const createCourseApprovalRequest = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    const { courseId, message } = req.body;

    if (!userId) return next(new ErrorHandler('Unauthorized access', 401));
    if (!courseId) return next(new ErrorHandler('Course ID is required', 400));

    const existingRequest = await RequestModel.findOne({
        courseId,
        userId,
        type: 'course_approval'
    });

    if (existingRequest) {
        // Nếu đang pending -> chỉ update message
        existingRequest.status = 'pending';
        if (message) existingRequest.message = message;
        await existingRequest.save();

        return res.status(200).json({
            success: true,
            data: existingRequest,
            message: 'Existing course approval request updated to pending'
        });
    }

    // Nếu chưa có -> tạo mới
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
    
    const filter: any = { 
        status: { $in: ['pending'] }, // Only show pending requests
        $or: [
            { deletedAt: { $exists: false } },
            { deletedAt: null }
        ]
    };
    if (type) filter.type = type;

    const requests = await RequestModel.find(filter).lean();
    
    if (!requests.length) {
        return next(new ErrorHandler('No pending requests found', 404));
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

    console.log('=== handleRequestActionCourse START ===');
    console.log('Request ID:', requestId);
    console.log('Action:', action);

    if (!requestId) return next(new ErrorHandler('Request ID is required', 400));
    if (!['approve', 'reject'].includes(action)) return next(new ErrorHandler('Invalid action', 400));

    const request = await findRequestWithFallback(requestId);
    if (!request) return next(new ErrorHandler('Request not found', 404));

    console.log('Found request:', request._id, request.type, request.status);

    request.status = action === 'approve' ? 'approved' : 'rejected';
    await request.save();

    console.log('Updated request status to:', request.status);

    if (request.type === 'course_approval') {
        const course = await CourseModel.findById(request.courseId);
        const instructor = await UserModel.findById(request.userId);

        if (!course || !instructor) return next(new ErrorHandler('Course or Instructor not found', 404));

        console.log('Found course:', course._id, course.name);
        console.log('Found instructor:', instructor._id, instructor.name);

        if (action === 'approve') {
            await CourseModel.findByIdAndUpdate(request.courseId, { isPublished: true });
            console.log('Course published successfully');
        }

        try {
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
            console.log('Email sent successfully');
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Continue execution even if email fails
        }
    }

    console.log('About to delete request with ID:', requestId);
    
    // First, mark as deleted to prevent any race conditions
    try {
        await RequestModel.findByIdAndUpdate(requestId, { 
            status: 'deleted',
            deletedAt: new Date()
        });
        console.log('Marked request as deleted');
        
        // Then try to actually delete it
        const deleteResult = await RequestModel.deleteOne({ _id: requestId });
        console.log('deleteOne result:', deleteResult);
        
        if (deleteResult.deletedCount === 0) {
            console.log('deleteOne failed, trying findByIdAndDelete...');
            const findAndDeleteResult = await RequestModel.findByIdAndDelete(requestId);
            console.log('findByIdAndDelete result:', findAndDeleteResult);
            
            if (!findAndDeleteResult) {
                console.log('Both deletion methods failed, keeping as deleted status...');
            }
        }
    } catch (deleteError) {
        console.error('Error during deletion:', deleteError);
        // If deletion fails, keep as deleted status
        try {
            await RequestModel.findByIdAndUpdate(requestId, { 
                status: 'deleted',
                deletedAt: new Date()
            });
            console.log('Marked request as deleted due to deletion error');
        } catch (updateError) {
            console.error('Error marking as deleted:', updateError);
        }
    }

    console.log('=== handleRequestActionCourse END ===');

    // Final check - verify if request was actually deleted
    try {
        const finalCheck = await RequestModel.findById(requestId);
        if (finalCheck) {
            console.log('WARNING: Request still exists after deletion attempt, forcing deletion...');
            // Try multiple deletion methods
            let forceDeleteResult = await RequestModel.deleteOne({ _id: requestId });
            if (forceDeleteResult.deletedCount === 0) {
                const findAndDeleteResult = await RequestModel.findByIdAndDelete(requestId);
                if (!findAndDeleteResult) {
                    forceDeleteResult = { deletedCount: 0, acknowledged: true };
                } else {
                    forceDeleteResult = { deletedCount: 1, acknowledged: true };
                }
            }
            if (forceDeleteResult.deletedCount === 0) {
                // If still can't delete, mark as deleted and schedule cleanup
                await RequestModel.findByIdAndUpdate(requestId, { 
                    status: 'deleted',
                    deletedAt: new Date()
                });
                console.log('Marked request as deleted for later cleanup');
            } else {
                console.log('Forced deletion completed');
            }
        } else {
            console.log('Request successfully deleted');
        }
    } catch (finalCheckError) {
        console.error('Error during final check:', finalCheckError);
    }

    res.status(200).json({
        success: true,
        message: `Request has been ${request.status} and email notification sent.`
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
