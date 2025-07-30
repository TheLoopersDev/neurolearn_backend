import ErrorHandler from '@/utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';

export const authorizeRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        console.log('DEBUG authorizeRoles req.user:', req.user);
        console.log('DEBUG authorizeRoles roles:', roles);
        console.log('DEBUG authorizeRoles user role:', req.user?.role);
        if (!roles.includes(req.user?.role || '')) {
            return next(new ErrorHandler(`Role ${req.user?.role} is not allowed to access this resource`, 403));
        }
        console.log('DEBUG authorizeRoles passed');
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
