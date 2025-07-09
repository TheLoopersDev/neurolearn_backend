import { Request, Response, NextFunction } from 'express';
import * as withdrawService from '../services/withdraw.service';
import * as revenueService from '../services/revenue.service';
import { catchAsync } from '../utils/catchAsync';
import Withdraw from '../models/Withdraw.model';
import ErrorHandler from '../utils/ErrorHandler';

export const createWithdraw = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const withdraw = await Withdraw.create({
    user: req.user._id.toString(),
    amount: req.body.amount,
    bankName: req.body.bankName,
    accountNumber: req.body.accountNumber,
    accountName: req.body.accountName
  });

  res.status(201).json({
    success: true,
    withdraw
  });
});

export const getWithdraws = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id.toString() };
  const withdraws = await Withdraw.find(filter).populate('user', 'name email').sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    withdraws
  });
});

export const getWithdrawById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const withdraw = await Withdraw.findById(req.params.id).populate('user', 'name email');

  if (!withdraw) {
    return next(new ErrorHandler('Withdraw not found', 404));
  }

  if (req.user.role !== 'admin' && String(withdraw.user._id) !== String(req.user._id)) {
    return next(new ErrorHandler('Not authorized to access this withdraw', 403));
  }

  res.status(200).json({
    success: true,
    withdraw
  });
});

export const updateWithdrawStatus = catchAsync(async (req: Request, res: Response) => {
  // Chỉ admin mới được duyệt hoặc từ chối
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { status, adminNote, reason, transactionId } = req.body;
  const update: any = { status };
  if (status === 'approved') update.approvedAt = new Date();
  if (status === 'rejected') update.rejectedAt = new Date();
  if (adminNote) update.adminNote = adminNote;
  if (reason) update.reason = reason;
  if (transactionId) update.transactionId = transactionId;
  const withdraw = await withdrawService.updateWithdrawStatus(req.params.id, update);
  if (!withdraw) return res.status(404).json({ success: false, message: 'Withdraw not found' });
  // Nếu duyệt, trừ tiền vào revenue của instructor
  if (status === 'approved') {
    await revenueService.decreaseRevenue(withdraw.user.toString(), withdraw.amount);
  }
  res.json({ success: true, data: withdraw });
}); 