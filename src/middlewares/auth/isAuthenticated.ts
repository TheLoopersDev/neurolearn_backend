import jwt, { JwtPayload, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { catchAsync } from '@/utils/catchAsync';
import ErrorHandler from '@/utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';
import { redis } from '../../utils/redis';

export const isAuthenticated = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Try to get token from multiple sources
    let access_token = req.access_token || (req.cookies.access_token as string);
    
    // If not found in cookies, try Authorization header
    if (!access_token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            access_token = authHeader.substring(7); // Remove 'Bearer ' prefix
        }
    }

    if (authHeader && authHeader.startsWith('Bearer ') && authHeader !== 'Bearer session-based') {
        token = authHeader.split(' ')[1];
    } else {
        token = req.cookies.access_token || req.headers['access_token'] || (req as any).access_token;
    }

    if (!token) {
        return next(new ErrorHandler('You are not logged in. Please log in to access this resource.', 401));
    }

    try {
        const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as string) as JwtPayload;
        console.log('DEBUG isAuthenticated decoded:', decoded);

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
        console.log('DEBUG isAuthenticated req.user:', req.user);
        next();
    } catch (error) {
        if (error instanceof JsonWebTokenError) {
            return next(new ErrorHandler(`JWT Error: ${error.message}`, 401));
        } else if (error instanceof TokenExpiredError) {
            return next(new ErrorHandler('Token has expired', 401));
        } else if (error instanceof NotBeforeError) {
            return next(new ErrorHandler('Token not active', 401));
        }
        return next(new ErrorHandler('Authentication failed', 401));
    }
});
