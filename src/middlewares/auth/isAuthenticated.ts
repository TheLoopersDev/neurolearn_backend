import jwt, { JwtPayload } from 'jsonwebtoken';
import { catchAsync } from '../../utils/catchAsync';
import ErrorHandler from '../../utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';
import { redis } from '../../utils/redis';
import { Types } from 'mongoose';

export const isAuthenticated = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    let access_token = '';

    // 1. Ưu tiên kiểm tra header Authorization (cho di động)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        access_token = req.headers.authorization.split(' ')[1];
    }
    // 2. Nếu không có, kiểm tra cookie (cho web)
    else if (req.cookies.access_token) {
        access_token = req.cookies.access_token as string;
    }

    if (!access_token) {
        return next(new ErrorHandler('Please login to access this resource.', 400));
    }

    try {
        const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as string) as JwtPayload;

        if (!decoded || !decoded.id) {
            return next(new ErrorHandler('Access token is not valid', 400));
        }

        const userId = decoded.id.toString();

        if (!Types.ObjectId.isValid(userId)) {
            return next(new ErrorHandler('Invalid user ID in token', 400));
        }

        const user = await redis.get(userId);

        if (!user) {
            return next(new ErrorHandler('User not found in Redis', 400));
        }

        req.user = JSON.parse(user);
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return next(new ErrorHandler('Authentication failed', 401));
    }
});
