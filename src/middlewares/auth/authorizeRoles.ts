import { NextFunction, Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import ErrorHandler from '../../utils/ErrorHandler';

export const authorizeRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new ErrorHandler('User not found', 400));
        }

        if (!roles.includes(req.user.role)) {
            return next(new ErrorHandler(`Role (${req.user.role}) is not allowed to access this resource`, 403));
        }

        next();
    };
};

export const authorizeBusinessRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user?.businessInfo || !user.businessInfo.role) {
            return next(new ErrorHandler('You were not in any business', 403));
        }

        if (!roles.includes(user.businessInfo.role)) {
            return next(new ErrorHandler(`Role ${user.businessInfo.role} is not allowed to access this resource`, 403));
        }

        next();
    };
};
