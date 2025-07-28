import jwt, { JwtPayload } from 'jsonwebtoken';
import { catchAsync } from '@/utils/catchAsync';
import ErrorHandler from '@/utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';
import { redis } from '@/utils/redis';
import { Types } from 'mongoose';

export const isAuthenticated = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    let token;

    if (authHeader && authHeader.startsWith('Bearer')) {
        token = authHeader.split(' ')[1];
    } else {
        token = req.cookies.access_token || (req as any).access_token;
    }

    if (!token) {
        return next(new ErrorHandler('You are not logged in', 401));
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN as string) as JwtPayload;

    const session = await redis.get(decoded.id);
    if (!session) {
        return next(new ErrorHandler('Session expired. Please login again.', 401));
    }

    const user = JSON.parse(session);
    req.user = user;

    next();
});