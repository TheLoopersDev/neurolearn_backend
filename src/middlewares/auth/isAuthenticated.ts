import jwt, { JwtPayload } from 'jsonwebtoken';
import { catchAsync } from '@/utils/catchAsync';
import ErrorHandler from '@/utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';
import { redis } from '@/utils/redis';

export const isAuthenticated = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer ') && authHeader !== 'Bearer session-based') {
        token = authHeader.split(' ')[1];
    } else {
        token = req.cookies.access_token || req.headers['access_token'] || (req as any).access_token;
    }

    if (!token) {
        return next(new ErrorHandler('You are not logged in. Please log in to access this resource.', 401));
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN as string) as JwtPayload;
        const session = await redis.get(decoded.id);
        if (!session) {
            return next(new ErrorHandler('Session expired. Please login again.', 401));
        }

        req.user = JSON.parse(session);
        next();
    } catch (err: any) {
        console.error('JWT error:', err.message);
        return next(new ErrorHandler('Invalid or expired token', 400));
    }
});
