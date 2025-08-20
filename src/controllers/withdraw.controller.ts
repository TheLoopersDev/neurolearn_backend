import { Request, Response, NextFunction } from 'express';
import * as withdrawService from '../services/withdraw.service';
import * as revenueService from '../services/revenue.service';
import { catchAsync } from '../utils/catchAsync';
import Withdraw from '../models/Withdraw.model';
import ErrorHandler from '../utils/ErrorHandler';

export const createWithdraw = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const {
    amount,
    bankName,
    bankAccountNumber,
    bankAccountName,
    accountNumber,
    accountName,
    bank,
    reason
  } = req.body as any;

  const resolvedBankName = bankName ?? bank?.name;
  const resolvedBankAccountNumber = bankAccountNumber ?? accountNumber ?? bank?.accountNumber;
  const resolvedBankAccountName = bankAccountName ?? accountName ?? bank?.accountName;

  const withdraw = await Withdraw.create({
    user: req.user._id.toString(),
    amount,
    bankName: resolvedBankName,
    bankAccountNumber: resolvedBankAccountNumber,
    bankAccountName: resolvedBankAccountName,
    reason
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

// API cho instructor xem request withdraw của chính mình
export const getMyWithdrawRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // Debug log
  console.log('DEBUG getMyWithdrawRequests req.user:', req.user);
  // Chỉ instructor mới được truy cập
  if (req.user.role !== 'instructor') {
    return next(new ErrorHandler('Only instructors can access this endpoint', 403));
  }

  const { page = 1, limit = 10, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  
  // Filter theo user hiện tại và status nếu có
  const filter: any = { user: req.user._id.toString() };
  if (status) {
    filter.status = status;
  }

  const withdraws = await Withdraw.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Withdraw.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      withdraws,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    }
  });
}); 