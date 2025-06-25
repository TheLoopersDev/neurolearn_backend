import { Request, Response } from 'express';
import * as withdrawService from '../services/withdraw.service';
import * as revenueService from '../services/revenue.service';
import { catchAsync } from '../utils/catchAsync';

export const createWithdraw = catchAsync(async (req: Request, res: Response) => {
  let { reason, ...rest } = req.body;
  if (!reason) {
    reason = 'transaction';
  }
  const data = {
    ...rest,
    reason,
    user: req.user._id,
    status: 'pending',
    requestedAt: new Date(),
  };
  const withdraw = await withdrawService.createWithdraw(data);
  res.status(201).json({ success: true, data: withdraw });
});

export const getWithdraws = catchAsync(async (req: Request, res: Response) => {
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
  const withdraws = await withdrawService.getWithdraws(filter);
  const result = withdraws.map((w: any) => ({
    bankName: w.bankName,
    bankAccountNumber: w.bankAccountNumber,
    bankAccountName: w.bankAccountName,
    amount: w.amount,
    status: w.status,
    reason: w.reason,
    requestedAt: w.requestedAt,
    approvedAt: w.approvedAt,
    rejectedAt: w.rejectedAt,
    adminNote: w.adminNote,
    transactionId: w.transactionId,
  }));
  res.json({ success: true, data: result });
});

export const getWithdrawById = catchAsync(async (req: Request, res: Response) => {
  const withdraw = await withdrawService.getWithdrawById(req.params.id);
  if (!withdraw) return res.status(404).json({ success: false, message: 'Withdraw not found' });
  if (req.user.role !== 'admin' && String(withdraw.user._id) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const result = {
    bankName: withdraw.bankName,
    bankAccountNumber: withdraw.bankAccountNumber,
    bankAccountName: withdraw.bankAccountName,
    amount: withdraw.amount,
    status: withdraw.status,
    reason: withdraw.reason,
    requestedAt: withdraw.requestedAt,
    approvedAt: withdraw.approvedAt,
    rejectedAt: withdraw.rejectedAt,
    adminNote: withdraw.adminNote,
    transactionId: withdraw.transactionId,
  };
  res.json({ success: true, data: result });
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