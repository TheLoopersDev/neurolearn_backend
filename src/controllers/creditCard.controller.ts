import { Request, Response, NextFunction } from 'express';
import CreditCard from '../models/CreditCard.model';
import ErrorHandler from '../utils/ErrorHandler';
import { catchAsync } from '../utils/catchAsync';
import { getCreditCardByAccountNumber, getCreditCardByUserId, createCreditCardForUser, getBankInfoFromMoMo } from '../services/creditCard.service';

// Create credit card for current instructor
export const createCreditCard = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user._id) {
    return next(new ErrorHandler('Not authorized', 401));
  }

  const creditCard = await createCreditCardForUser(req.user._id, req.body);
  
  return res.status(201).json({
    success: true,
    data: creditCard,
  });
});

// Get credit card of current instructor
export const getCurrentUserCard = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user._id) {
    return next(new ErrorHandler('Not authorized', 401));
  }

  const creditCard = await getCreditCardByUserId(req.user._id);

  // Lấy danh sách bank từ API vietqr
  let bankList: any[] = [];
  try {
    const axios = require('axios');
    const response = await axios.get('https://api.vietqr.io/v2/banks');
    if (response.data && response.data.data) {
      bankList = response.data.data;
    }
  } catch (e) {
    // Nếu lỗi, bỏ qua, không thêm logo
  }

  // Tìm bank theo cardType (so sánh với shortName hoặc code)
  let logo = null;
  let shortName = creditCard.cardType;
  if (bankList.length > 0) {
    const found = bankList.find(
      (b: any) => b.shortName?.toLowerCase() === creditCard.cardType?.toLowerCase() || b.code?.toLowerCase() === creditCard.cardType?.toLowerCase()
    );
    if (found) {
      logo = found.logo;
      shortName = found.shortName;
    }
  }

  // Trả về dữ liệu bổ sung
  return res.status(200).json({
    success: true,
    data: {
      ...creditCard.toObject(),
      logo,
      cardType: shortName,
    },
  });
});

// Get credit card by account number (admin only)
export const getCreditCardByAccountNumberController = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { accountNumber } = req.params;
  
  const creditCard = await getCreditCardByAccountNumber(accountNumber);
  
  return res.status(200).json({
    success: true,
    data: creditCard,
  });
});

// Update current user's credit card
export const updateCreditCard = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user._id) {
    return next(new ErrorHandler('Not authorized', 401));
  }

  const creditCard = await CreditCard.findOneAndUpdate(
    { user: req.user._id },
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!creditCard) {
    return next(new ErrorHandler('Credit card not found', 404));
  }

  return res.status(200).json({
    success: true,
    data: creditCard,
  });
});

// Delete current user's credit card
export const deleteCreditCard = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user._id) {
    return next(new ErrorHandler('Not authorized', 401));
  }

  const creditCard = await CreditCard.findOneAndDelete({ user: req.user._id });
  
  if (!creditCard) {
    return next(new ErrorHandler('Credit card not found', 404));
  }

  return res.status(200).json({
    success: true,
    data: {},
  });
});

export const getBankInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const data = await getBankInfoFromMoMo();
  return res.status(200).json({
    success: true,
    data,
  });
}); 