import CourseModel from '../models/Course.model';
import UserModel from '../models/User.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';
import { NextFunction, Request, Response } from 'express';

export const createCourse = async (data: any, req: Request, res: Response, next: NextFunction) => {
    const user = await UserModel.findById(req.user?._id);
    if (!user) {
        return next(new ErrorHandler('User is not logged in!', 400));
    }

    // Gán authorId từ user đang login
    data.authorId = user._id;

    const course = await CourseModel.create(data);

    // Gán courseId vào uploadedCourses[]
    user.uploadedCourses.push(course._id);
    await user.save();

    // Cập nhật Redis cache
    await redis.set(user._id.toString(), JSON.stringify(user));

    res.status(201).json({
        success: true,
        course
    });
};

export const getAllCoursesService = async (res: Response) => {
    const courses = await CourseModel.find().sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        courses
    });
};
