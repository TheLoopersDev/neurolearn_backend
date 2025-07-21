import jwt, { JwtPayload } from 'jsonwebtoken';
import { catchAsync } from '@/utils/catchAsync';
import ErrorHandler from '@/utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';
import { redis } from '@/utils/redis';
import { Types } from 'mongoose';

export const isAuthenticated = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const access_token = req.access_token || (req.cookies.access_token as string);

    if (!access_token) {
        return next(new ErrorHandler('Please login to access this resource.', 400));
    }

    try {
        const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as string) as JwtPayload;

        if (!decoded || !decoded.id) {
            return next(new ErrorHandler('access token is not valid', 400));
        }

        // Convert ObjectId to string for Redis lookup
        const userId = decoded.id.toString();

        // Validate ObjectId format
        if (!Types.ObjectId.isValid(userId)) {
            return next(new ErrorHandler('Invalid user ID in token', 400));
        }

        const user = await redis.get(userId);

        if (!user) {
            return next(new ErrorHandler('User not found', 400));
        }

        req.user = JSON.parse(user);
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return next(new ErrorHandler('Authentication failed', 401));
    }
});
