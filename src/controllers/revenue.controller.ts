import { Request, Response, NextFunction } from 'express';
import * as revenueService from '../services/revenue.service';
import { catchAsync } from '../utils/catchAsync';
import Revenue from '../models/Revenue.model';

export const getRevenueByUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    let userId = req.user._id.toString();
    if (req.user.role === 'admin' && req.query.userId) {
        userId = req.query.userId;
    }
    const revenue = await Revenue.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        revenue
    });
});
