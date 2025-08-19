import { RedisKey } from 'ioredis';
import cloudinary from 'cloudinary';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import ejs from 'ejs';
import dotenv from 'dotenv';
import UserModel from '../models/User.model';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';

import path from 'path';
import sendMail from '../utils/sendMail';
import { UserT } from '../interfaces/User';
import { accessTokenOptions, refreshTokenOptions, sendToken } from '../utils/jwt';
import { redis } from '../utils/redis';
import {
    getUserById,
    getAllUsersService,
    updateUserRoleService,
    getAllInstructorsService
} from '../services/user.service';
import InviteModel from '../models/Invite.model';
import BusinessModel from '../models/Business.model';
import ProgressModel from '../models/Progress.model';
import CourseModel from '../models/Course.model';
import QuizModel from '../models/Quiz.model';
import LessonModel from '../models/Lesson.model';
import mongoose, { Types } from 'mongoose';
import { getLatestCourse } from '../services/course.service';


dotenv.config();

interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;
}

interface IActivationToken {
    token: string;
    activationCode: string;
}

interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

interface IResetCode {
    reset_token: string;
    reset_code: string;
}

interface ILoginRequest {
    email: string;
    password: string;
}

interface ISocialAuthBody {
    email: string;
    name: string;
    avatar: string;
}

interface IUpdateUserInfo {
    name?: string;
    avatar: string;
    email: string;
    age: number;
    profession: string;
    introduce: string;
    address: string;
    phoneNumber: string;
    rating: number;
    student: number;
}

interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}

interface IProfilePicture {
    avatar: string;
}

export const getUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;

    if (!userId) {
        return next(new ErrorHandler('Please provide a user ID', 400));
    }

    const user = await UserModel.findById(userId).populate('uploadedCourses'); // Populate uploadedCourses

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }
    const uploadedCoursesCount = Array.isArray(user.uploadedCourses) ? user.uploadedCourses.length : 0;
    res.status(200).json({
        success: true,
        data: {
            user,
            uploadedCoursesCount
        }
    });
});

export const updateUserSocialLinks = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { data } = req.body; // Đảm bảo rằng bạn nhận được đúng đối tượng `socialLinks`
    const userId = req.user?._id as RedisKey;
    const user = await UserModel.findById(userId);

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // Cập nhật các liên kết mạng xã hội
    if (data.facebook) user.socialLinks.facebook = data.facebook;
    if (data.twitter) user.socialLinks.twitter = data.twitter;
    if (data.linkedin) user.socialLinks.linkedin = data.linkedin;
    if (data.instagram) user.socialLinks.instagram = data.instagram;

    // Lưu thông tin vào database
    await user.save();

    // Lưu lại dữ liệu vào Redis
    await redis.del(userId);

    await redis.set(userId, JSON.stringify(user));

    // Trả về kết quả thành công
    res.status(200).json({
        success: true,
        user
    });
});

export const registrationUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password } = req.body;

    const isEmailExist = await UserModel.findOne({ email });
    if (isEmailExist) return next(new ErrorHandler('Email already exist', 400));

    const user: IRegistrationBody = { name, email, password };

    const activationToken = createActivationToken(user);

    const activationCode = activationToken.activationCode;

    const data = { user: { name: user.name }, activationCode };
    await ejs.renderFile(path.join(__dirname, '../mails', 'activation-mail.ejs'), data);

    try {
        await sendMail({ email: user.email, subject: 'Activate your account', template: 'activation-mail.ejs', data });

        res.status(201).json({
            success: true,
            message: `Please check your email: ${user.email} to activate your account!`,
            activationToken: activationToken.token
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const token = jwt.sign({ user, activationCode }, process.env.ACTIVATION_SECRET as Secret, { expiresIn: '5m' });

    return { token, activationCode };
};

export const activateUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { activation_token, activation_code } = req.body as IActivationRequest;

    const newUser: { user: UserT; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
    ) as { user: UserT; activationCode: string };

    if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler('Invalid activation code', 400));
    }

    const { name, email, password } = newUser.user;

    const isEmailExist = await UserModel.findOne({ email });
    if (isEmailExist) return next(new ErrorHandler('Email already exist', 400));

    const createdUser = await UserModel.create({ name, email, password });
    const invites = await InviteModel.find({ email, status: 'pending' });

    for (const invite of invites) {
        const business = await BusinessModel.findById(invite.businessId);
        if (!business) continue;

        // Add user vào business
        business.employees.push({ user: createdUser._id, role: invite.role });
        await business.save();

        // Nếu muốn lưu thông tin business vào user
        createdUser.businessInfo = {
            businessId: business._id,
            role: invite.role
        };
        await createdUser.save();

        // Update invite status
        invite.status = 'accepted';
        invite.acceptedAt = new Date();
        await invite.save();
    }

    res.status(201).json({ success: true });
});

export const loginUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as ILoginRequest;

    if (!email || !password) {
        return next(new ErrorHandler('Please enter email and password', 400));
    }

    const user = await UserModel.findOne({ email }).select('+password');

    if (!user) {
        return next(new ErrorHandler('Invalid email or password', 400));
    }

    const isPasswordMath = await user.comparePassword(password);

    if (!isPasswordMath) {
        return next(new ErrorHandler('Invalid email or password', 400));
    }

    sendToken(user, 200, res);
});

export const logoutUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    res.cookie('access_token', '', {
        domain: '.vercel.app',
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 1
    });
    res.cookie('refresh_token', '', {
        domain: '.vercel.app',
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 1
    });

    const userId = req.user?._id || '';
    if (userId) {
        redis.del(userId as RedisKey);
    }

    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export const updateAccessToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Try to get refresh token from cookies first
    let refresh_token = req.cookies.refresh_token as string;

    // If not in cookies, try to get from Authorization header
    if (!refresh_token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // Frontend is sending access token, not refresh token
            // We'll try to use it as refresh token for now
            refresh_token = authHeader.substring(7);
        }
    }

    if (!refresh_token) {
        return next(new ErrorHandler('No refresh token provided', 400));
    }

    try {
        // First try to verify as refresh token
        let decoded;
        try {
            decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;
        } catch (refreshError) {
            // If it fails as refresh token, try as access token
            try {
                decoded = jwt.verify(refresh_token, process.env.ACCESS_TOKEN as string) as JwtPayload;
            } catch (accessError) {
                return next(new ErrorHandler('Invalid token', 401));
            }
        }

        const message = 'Please login';

        if (!decoded) {
            return next(new ErrorHandler(message, 400));
        }

        const session = await redis.get(decoded.id as string);

        if (!session) {
            return next(new ErrorHandler(message, 400));
        }

        const user = JSON.parse(session);

        const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, { expiresIn: '3d' });

        req.user = user;
        req.access_token = accessToken;

        res.cookie('access_token', accessToken, accessTokenOptions);
        res.cookie('refresh_token', refreshToken, refreshTokenOptions);

        next();
    } catch (error) {
        return next(new ErrorHandler('Invalid refresh token', 401));
    }
});

export const refreshToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const refresh_token = req.cookies.refresh_token as string;
    const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;

    const message = 'Please login';

    if (!decoded) {
        return next(new ErrorHandler(message, 400));
    }

    const session = await redis.get(decoded.id as string);

    if (!session) {
        return next(new ErrorHandler(message, 400));
    }

    const user = JSON.parse(session);

    const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, { expiresIn: '1m' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, { expiresIn: '3d' });

    req.user = user;
    req.access_token = accessToken;

    res.cookie('access_token', accessToken, accessTokenOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenOptions);

    res.status(200).json({ success: true, accessToken });
});

export const getUserInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user._id) {
        return next(new ErrorHandler('User not authenticated', 500));
    }

    const userId = req.user._id.toString();
    getUserById(userId, res);
});

export const socialAuth = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, name, avatar } = req.body as ISocialAuthBody;
    const user = await UserModel.findOne({ email });
    if (!user) {
        const newUser = await UserModel.create({ email, name, avatar: avatar ? { url: avatar } : undefined });
        sendToken(newUser, 200, res);
    } else {
        sendToken(user, 200, res);
    }
});

export const updateUserInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { name, avatar, email, introduce, profession, age, phoneNumber, address } = req.body as IUpdateUserInfo;
    const userId = req.user?._id as RedisKey;
    const user = await UserModel.findById(userId);

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // Kiểm tra và cập nhật email (nếu email mới không trùng)
    if (email && email !== user.email) {
        const isEmailExist = await UserModel.findOne({ email });
        if (isEmailExist) {
            return next(new ErrorHandler('Email already exists', 400));
        }
        user.email = email;
    }

    // Cập nhật các trường khác
    if (name) user.name = name;
    if (introduce) user.introduce = introduce;
    if (profession) user.profession = profession;
    if (age) user.age = age;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = address;

    // Cập nhật avatar nếu có
    if (avatar) {
        if (user.avatar?.public_id) {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(avatar, { folder: 'avatars', width: 150 });

        user.avatar = { public_id: myCloud.public_id, url: myCloud.secure_url };
    }

    await user.save();
    await redis.set(userId, JSON.stringify(user));

    res.status(200).json({ success: true, user });
});

export const updatePassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { newPassword } = req.body as { newPassword: string };

    if (!newPassword) {
        return next(new ErrorHandler('New password is required', 400));
    }

    // Enforce strong password policy: 8-64 chars, uppercase, lowercase, number, special char, no spaces
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?])\S{8,64}$/;
    if (!strongPasswordRegex.test(newPassword)) {
        return next(
            new ErrorHandler(
                'Password must be 8-64 chars, include uppercase, lowercase, number, special character, and no spaces.',
                400
            )
        );
    }

    const user = await UserModel.findById(req.user?._id).select('+password');

    if (user?.password === undefined) {
        return next(new ErrorHandler('Invalid user', 400));
    }

    // If you still want to require old password, handle it at route level or extend payload.

    user.password = newPassword;
    await user.save();

    redis.set(req.user?._id as RedisKey, JSON.stringify(user));

    res.status(200).json({ success: true, user });
});

export const updateProfilePicture = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { avatar } = req.body as IProfilePicture;

    const userId = req.user?._id;

    const user = await UserModel.findById(userId);

    if (user && avatar) {
        // If user already have avatar
        if (user?.avatar?.public_id) {
            await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(avatar, { folder: 'avatars', width: 150 });
        user.avatar = { public_id: myCloud.public_id, url: myCloud.secure_url };
    }

    await user?.save();

    await redis.set(userId as RedisKey, JSON.stringify(user));

    res.status(200).json({ success: true, user });
});

// get all users -- for admin
export const getAllUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    getAllUsersService(res);
});

// update user role -- for admin
export const updateUserRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id, role } = req.body;

    updateUserRoleService(res, id, role);
});

// delete user -- for admin
export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const user = await UserModel.findById(id);

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    await user.deleteOne({ id });

    await redis.del(id);

    res.status(200).json({ success: true, message: 'User deleted successfully' });
});

export const forgotPasswordUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) return next(new ErrorHandler('User not found', 404));

    const resetToken = createActivationToken(user);

    const resetCode = resetToken.activationCode;

    const data = { user: { name: user.name }, resetCode };
    await ejs.renderFile(path.join(__dirname, '../mails', 'reset-password-mail.ejs'), data);

    try {
        await sendMail({
            email: user.email,
            subject: 'Reset your password',
            template: 'reset-password-mail.ejs',
            data
        });

        res.status(200).json({
            success: true,
            message: `Please check your email: ${user.email} to reset your password!`,
            resetToken: resetToken.token
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

export const resetCodeVerify = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { reset_token, reset_code } = req.body as IResetCode;

    const decoded: { user: UserT; activationCode: string } = jwt.verify(
        reset_token,
        process.env.ACTIVATION_SECRET as string
    ) as { user: UserT; activationCode: string };

    if (decoded.activationCode !== reset_code) {
        return next(new ErrorHandler('Invalid reset code', 400));
    }

    res.status(201).json({
        success: true
    });
});

export const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { reset_token, newPassword } = req.body;

    if (!reset_token || !newPassword) {
        return next(new ErrorHandler('Missing reset token or new password', 400));
    }

    let decoded;
    try {
        decoded = jwt.verify(reset_token, process.env.ACTIVATION_SECRET as string) as { user: { email: string } };
    } catch (error) {
        return next(new ErrorHandler('Invalid or expired reset token', 400));
    }

    const user = await UserModel.findOne({ email: decoded?.user?.email });
    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password has been reset successfully'
    });
});

export const getTopInstructors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const topInstructors = await UserModel.aggregate([
        { $match: { role: 'instructor' } },
        {
            $lookup: {
                from: 'courses',
                localField: 'uploadedCourses',
                foreignField: '_id',
                as: 'uploadedCoursesData'
            }
        },
        {
            $addFields: {
                totalStudents: {
                    $sum: {
                        $map: {
                            input: '$uploadedCoursesData',
                            as: 'course',
                            in: { $ifNull: ['$$course.purchased', 0] }
                        }
                    }
                },
                averageRating: {
                    $avg: {
                        $map: {
                            input: '$uploadedCoursesData',
                            as: 'course',
                            in: { $ifNull: ['$$course.rating', 0] }
                        }
                    }
                },
                uploadedCoursesCount: { $size: '$uploadedCoursesData' }
            }
        },
        { $sort: { totalStudents: -1, averageRating: -1 } },
        { $limit: 10 },
        {
            $project: {
                _id: 1,
                name: 1,
                email: 1,
                role: 1,
                avatar: 1,
                uploadedCourses: 1,
                totalStudents: 1,
                averageRating: 1,
                uploadedCoursesCount: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]);

    if (!topInstructors || topInstructors.length === 0) {
        return next(new ErrorHandler('No instructors found', 404));
    }

    res.status(200).json({
        success: true,
        topInstructors
    });
});
export const getAllInstructors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    getAllInstructorsService(res);
});

export const getInstructorsWithSort = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.query;

    if (!type || (type !== 'recent' && type !== 'oldest')) {
        return next(new ErrorHandler('Invalid type parameter. Use "recent" or "oldest".', 400));
    }

    let users;

    if (type === 'recent') {
        const threeDaysAgo = new Date();
        threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

        users = await UserModel.find({ createdAt: { $gte: threeDaysAgo }, role: 'instructor' })
            .sort({ createdAt: -1 })
            .limit(3);
    } else {
        users = await UserModel.find({ role: 'instructor' })
            .sort({ createdAt: 1 }) // Sắp xếp tăng dần
            .limit(10);
    }

    res.status(200).json({
        success: true,
        instructors: users
    });
});

// ============================
// Helpers
// ============================

type Exam = { name: string; duration: number };

type CourseEntry = {
    courseId: string;
    courseName: string;
    thumbnail: string;
    exams: Exam[];
};

// Gom quiz theo course để UI dễ hiển thị
function groupQuizzesByCourse(quizzes: any[]) {
    const map = new Map<string, CourseEntry>();

    for (const q of quizzes) {
        const courseId = String(q.courseId?._id || q.courseId);

        // ✅ Khai báo kiểu rõ ràng khi khởi tạo entry
        const entry: CourseEntry = map.get(courseId) ?? {
            courseId,
            courseName: (q.courseId as any)?.name || '',
            thumbnail: (q.courseId as any)?.thumbnail?.url || '',
            exams: []
        };

        entry.exams.push({
            name: String(q.name),
            duration: Number(q.duration) || 0
        });

        map.set(courseId, entry);
    }

    return Array.from(map.values()).slice(0, 5);
}

// Tính giờ học từ các lesson đã hoàn thành (videoLength = giây)
async function computeHoursSpentFromProgress(userId: string) {
    const progresses = await ProgressModel.find({ user: userId }, 'completedSections').lean();

    const completedLessonIds = new Set<string>();
    for (const p of progresses) {
        for (const sec of p?.completedSections || []) {
            for (const l of sec?.lessons || []) {
                if (l?.isCompleted && l?.lessonId) completedLessonIds.add(String(l.lessonId));
            }
        }
    }

    if (!completedLessonIds.size) return 0;

    const lessons = await LessonModel.find({ _id: { $in: Array.from(completedLessonIds) } }, { videoLength: 1 }).lean();

    const totalSeconds = lessons.reduce((sum, l) => sum + (Number(l.videoLength) || 0), 0);
    return Math.round((totalSeconds / 3600) * 10) / 10; // giờ, 1 số lẻ
}

// Tạo map progress theo course để tra nhanh
async function getProgressByCourseMap(userId: string) {
    const progressList = await ProgressModel.find(
        { user: userId },
        { course: 1, progressPercentage: 1, completedSections: 1 }
    ).lean();

    const map = new Map<string, any>();
    for (const p of progressList) map.set(String(p.course), p);
    return map;
}

// ============================
// Controller: GET /users/dashboard/:userId
// ============================
export const getUserDashboardData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.userId;
    if (!userId) {
        return next(new ErrorHandler('Please provide a user id', 400));
    }

    // Bảo mật: chỉ cho xem chính mình
    if (!req.user || String(req.user._id) !== String(userId)) {
        return next(new ErrorHandler('Forbidden', 403));
    }

    // 1) Lấy thông tin user + danh sách khoá đã mua (purchasedCourses)
    type UserPick = { purchasedCourses?: any[]; uploadedCourses?: any[] };

    const user = await UserModel.findById(userId, { purchasedCourses: 1, uploadedCourses: 1 }).lean<UserPick | null>();

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const purchasedCourseIds = (user.purchasedCourses ?? []).map(String);

    // 2) Thống kê cơ bản
    const totalCourses = purchasedCourseIds.length;
    const completedCourses = await ProgressModel.countDocuments({ user: userId, progressPercentage: 100 });
    const certificates = completedCourses; // giả định: hoàn thành = có chứng chỉ
    const hoursSpent = await computeHoursSpentFromProgress(userId);

    const stats = { totalCourses, completedCourses, certificates, hoursSpent };

    // 3) Lấy khoá vừa học gần nhất
    let latestCoursePayload: any = null;
    if (purchasedCourseIds.length) {
        latestCoursePayload = await getLatestCourse(userId);
    }
    // 6) Related courses: khóa CHƯA mua nhưng cùng category/subCategory với khóa đang học
    let relatedCourses: any[] = [];

    if (purchasedCourseIds.length) {
        const purchasedCourses = await CourseModel.find(
            { _id: { $in: purchasedCourseIds } },
            { category: 1, subCategory: 1 }
        ).lean();

        const categoryIds = [
            ...new Set(purchasedCourses.map((c) => (c.category ? String(c.category) : null)).filter(Boolean))
        ];
        const subCategoryIds = [
            ...new Set(purchasedCourses.map((c) => (c.subCategory ? String(c.subCategory) : null)).filter(Boolean))
        ];

        const courses = await CourseModel.find({
            _id: { $nin: purchasedCourseIds },
            isPublished: true,
            $or: [
                ...(categoryIds.length ? [{ category: { $in: categoryIds } }] : []),
                ...(subCategoryIds.length ? [{ subCategory: { $in: subCategoryIds } }] : [])
            ]
        })
            .populate('authorId', 'name email avatar profession description')
            .populate('level', 'name')
            .populate({
                path: 'category',
                select: 'name',
                match: categoryIds.length > 0 ? { _id: { $in: categoryIds } } : null, // Chỉ populate nếu có categoryIds
                strictPopulate: false
            })
            .populate({
                path: 'subCategory',
                select: 'name',
                match: subCategoryIds.length > 0 ? { _id: { $in: subCategoryIds } } : null, // Chỉ populate nếu có subCategoryIds
                strictPopulate: false
            })
            .populate({
                path: 'sections',
                match: { isPublished: true },
                select: 'title lessons',
                populate: {
                    path: 'lessons',
                    match: { isPublished: true },
                    select: 'title duration'
                }
            })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        relatedCourses = courses.map((c) => {
            const totalSections = c.sections?.length || 0;
            const totalLessons =
                c.sections?.reduce((sum: number, sec: any) => sum + (sec.lessons?.length || 0), 0) || 0;
            const durationInHours = ((c.duration || 0) / 60).toFixed(1);

            return {
                _id: c._id,
                name: c.name,
                subTitle: c.subTitle,
                description: c.description,
                thumbnail: c.thumbnail,
                demoUrl: c.demoUrl,
                price: c.price,
                estimatedPrice: c.estimatedPrice,
                isFree: c.isFree,
                purchased: c.purchased ?? 0,
                level: c.level?.name ?? null,
                rating: c.rating ?? 0,
                category: c.category || null,
                subCategory: c.subCategory || null,
                overview: c.overview || '',
                topics: Array.isArray(c.topics) ? c.topics : [],
                totalSections,
                totalLessons,
                duration: `${durationInHours} hours`,
                publisher: {
                    name: c.authorId?.name || '',
                    avatar: c.authorId?.avatar || '',
                    email: c.authorId?.email || '',
                    profession: c.authorId?.profession || '',
                    description: c.authorId?.description || ''
                }
            };
        });
    }

    // 7) Student stats cho chart (User)
    const studentStats = await ProgressModel.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        {
            $lookup: {
                from: 'courses',
                localField: 'course',
                foreignField: '_id',
                as: 'course',
                pipeline: [{ $project: { name: 1 } }]
            }
        },
        { $unwind: '$course' },
        {
            $project: {
                _id: 0,
                name: '$course.name',
                // fallback mới cho UI:
                progress: '$progressPercentage',
                // giữ field cũ nếu sau này bạn tính được:
                completed: '$totalCompleted',
                hours: '$totalHours'
            }
        }
    ]);

    // 8) Upcoming exams: gom theo course, lấy nhiều quiz rồi group
    let upcomingExams: any[] = [];
    if (purchasedCourseIds.length) {
        const quizzes = await QuizModel.find(
            { courseId: { $in: purchasedCourseIds }, isPublished: true },
            { name: 1, duration: 1, courseId: 1, createdAt: 1 }
        )
            .sort({ createdAt: -1 })
            .limit(30)
            .populate('courseId', 'name thumbnail.url')
            .lean();

        upcomingExams = groupQuizzesByCourse(quizzes);
    }

    // 9) Trả về
    return res.status(200).json({
        success: true,
        stats,
        latestCourse: latestCoursePayload,
        relatedCourses,
        studentStats,
        upcomingExams
    });
});

export const getUserPurchasedCoursesMobile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user._id) {
        return next(new ErrorHandler('User not authenticated', 500));
    }

    const userId = req.user._id.toString();
    getUserById(userId, res);
});