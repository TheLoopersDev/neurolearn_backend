import { Request, Response } from 'express';
import * as revenueService from '../services/revenue.service';
import { catchAsync } from '../utils/catchAsync';

export const getRevenueByUser = catchAsync(async (req: Request, res: Response) => {
  let userId = req.user._id;
  if (req.user.role === 'admin' && req.query.userId) {
    userId = req.query.userId;
  }
  const revenue = await revenueService.getRevenueByUser(userId);
  res.json({ success: true, data: revenue });
}); 