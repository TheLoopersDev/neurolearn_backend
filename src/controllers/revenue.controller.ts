import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import Revenue from '../models/Revenue.model';
import { calculateInstructorIncome } from '../services/revenue.service';

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

// API: GET /api/revenue/income/me
export const getMyIncome = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user._id.toString();
  const income = await calculateInstructorIncome(userId);
  res.status(200).json({ success: true, income });
});

// API: GET /api/revenue/income/:userId
export const getInstructorIncomeById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId param' });
  const income = await calculateInstructorIncome(userId);
  res.status(200).json({ success: true, income });
}); 
