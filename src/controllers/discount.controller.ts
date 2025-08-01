import { validateAndCalculateDiscount } from '../services/discount.service';
import DiscountModel from '../models/Discount.model';
import { Request, Response } from 'express';

// API tạo mã giảm giá
export const createDiscount = async (req: Request, res: Response) => {
    try {
        const discount = await DiscountModel.create(req.body);
        res.json({ success: true, discount });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// API validate mã giảm giá

export const validateDiscountCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, courseIds, totalAmount } = req.body;

        if (!code) {
            res.status(400).json({ success: false, message: 'Discount code is required' });
            return;
        }

        // Tìm discount trong DB (match theo code và isActive)
        const discount = await DiscountModel.findOne({
            code: code.trim().toUpperCase(),
            isActive: true
        });

        if (!discount) {
            res.status(400).json({ success: false, message: 'Invalid discount code' });
            return;
        }

        const now = new Date();

        // Kiểm tra thời gian áp dụng
        if (discount.startDate && now < discount.startDate) {
            res.status(400).json({ success: false, message: 'Discount not started yet' });
            return;
        }
        if (discount.endDate && now > discount.endDate) {
            res.status(400).json({ success: false, message: 'Discount expired' });
            return;
        }

        // Kiểm tra minOrderAmount
        if (discount.minOrderAmount && totalAmount < discount.minOrderAmount) {
            res.status(400).json({ success: false, message: 'Order amount is too low for this discount' });
            return;
        }

        // Tính giảm giá
        let discountAmount = 0;

        if (discount.discountType === 'percentage') {
            discountAmount = (totalAmount * discount.amount) / 100;
            // Giới hạn giảm giá tối đa
            if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
                discountAmount = discount.maxDiscountAmount;
            }
        } else if (discount.discountType === 'fixed') {
            discountAmount = discount.amount;
        }

        const totalAfterDiscount = Math.max(totalAmount - discountAmount, 0);

        res.json({
            success: true,
            discountAmount,
            totalAfterDiscount
        });
    } catch (error: any) {
        console.error('validateDiscountCode error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// API lấy tất cả mã giảm giá
export const getAllDiscounts = async (req: Request, res: Response) => {
    try {
        const discounts = await DiscountModel.find().sort({ createdAt: -1 });
        res.json({ success: true, discounts });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
