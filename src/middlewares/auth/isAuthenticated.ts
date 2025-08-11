import jwt, { JwtPayload, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { catchAsync } from '../../utils/catchAsync';
import ErrorHandler from '../../utils/ErrorHandler';
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

    if (!access_token) {
        return next(new ErrorHandler('Please login to access this resource.', 400));
    }

    const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as string) as JwtPayload;

    if (!decoded) {
        return next(new ErrorHandler('access token is not valid', 400));
    }

    const user = await redis.get(decoded.id);

    if (!user) {
        return next(new ErrorHandler('User not found', 400));
    }

    req.user = JSON.parse(user);

    next();
});
