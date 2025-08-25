import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import DiscountModel from '../models/Discount.model';
import CourseModel from '../models/Course.model';
import BusinessModel from '../models/Business.model';
import mongoose from 'mongoose';
// Create new discount
export const createDiscount = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const {
        code,
        name,
        description,
        discountType,
        amount,
        maxDiscountAmount,
        courseIds,
        businessId,
        accessType,
        allowedUsers,
        allowedBusinesses,
        startDate,
        endDate,
        usageLimit,
        minOrderAmount,
        isActive
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !amount || !startDate || !endDate) {
        return next(new ErrorHandler('Missing required fields', 400));
    }

    // Validate discount type and amount
    if (discountType === 'percentage' && (amount <= 0 || amount > 100)) {
        return next(new ErrorHandler('Percentage discount must be between 0 and 100', 400));
    }

    if (discountType === 'fixed' && amount <= 0) {
        return next(new ErrorHandler('Fixed discount amount must be greater than 0', 400));
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start >= end) {
        return next(new ErrorHandler('End date must be after start date', 400));
    }

    if (start < now) {
        return next(new ErrorHandler('Start date cannot be in the past', 400));
    }

    // Check if code already exists
    const existingDiscount = await DiscountModel.findOne({ code: code.toUpperCase() });
    if (existingDiscount) {
        return next(new ErrorHandler('Discount code already exists', 400));
    }

    // Validate course IDs if provided
    if (courseIds && courseIds.length > 0) {
        // Filter out empty strings
        const validCourseIds = courseIds.filter((id: string) => id && id.trim() !== '');
        if (validCourseIds.length > 0) {
            const validCourses = await CourseModel.find({ _id: { $in: validCourseIds } });
            if (validCourses.length !== validCourseIds.length) {
                return next(new ErrorHandler('Some course IDs are invalid', 400));
            }
        }
        // Update the array to only include valid IDs
        req.body.courseIds = validCourseIds;
    }

    // Validate business ID if provided
    if (businessId && businessId.trim() !== '') {
        const business = await BusinessModel.findById(businessId);
        if (!business) {
            return next(new ErrorHandler('Business not found', 404));
        }
    } else {
        // If businessId is empty string, null, or undefined, set it to undefined to avoid MongoDB casting error
        req.body.businessId = undefined;
    }

    // Validate allowed businesses if provided
    if (allowedBusinesses && allowedBusinesses.length > 0) {
        // Filter out empty strings
        const validBusinessIds = allowedBusinesses.filter((id: string) => id && id.trim() !== '');
        if (validBusinessIds.length > 0) {
            const validBusinesses = await BusinessModel.find({ _id: { $in: validBusinessIds } });
            if (validBusinesses.length !== validBusinessIds.length) {
                return next(new ErrorHandler('Some business IDs are invalid', 400));
            }
        }
        // Update the array to only include valid IDs
        req.body.allowedBusinesses = validBusinessIds;
    }

    // Filter out empty strings from allowedUsers if provided
    let filteredAllowedUsers = allowedUsers;
    if (allowedUsers && allowedUsers.length > 0) {
        filteredAllowedUsers = allowedUsers.filter((id: string) => id && id.trim() !== '');
    }

    const discount = await DiscountModel.create({
        code: code.toUpperCase(),
        name,
        description,
        discountType,
        amount,
        maxDiscountAmount,
        courseIds: req.body.courseIds,
        businessId: req.body.businessId,
        accessType,
        allowedUsers: filteredAllowedUsers,
        allowedBusinesses: req.body.allowedBusinesses,
        startDate: start,
        endDate: end,
        usageLimit,
        minOrderAmount,
        isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
        success: true,
        message: 'Discount created successfully',
        data: discount
    });
});

// Get all discounts with pagination and filters
export const getAllDiscounts = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, search, discountType, accessType, isActive, businessId } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {};

    if (search) {
        filter.$or = [
            { code: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    if (discountType) {
        filter.discountType = discountType;
    }

    if (accessType) {
        filter.accessType = accessType;
    }

    if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
    }

    if (businessId) {
        filter.businessId = businessId;
    }

    // Get total count for pagination
    const totalDiscounts = await DiscountModel.countDocuments(filter);

    // Get discounts with pagination and populate
    const discounts = await DiscountModel.find(filter)
        .populate('courseIds', 'name description thumbnail price')
        .populate('businessId', 'businessName')
        .populate('allowedUsers', 'name email')
        .populate('allowedBusinesses', 'businessName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    // Calculate pagination info
    const totalPages = Math.ceil(totalDiscounts / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
        success: true,
        data: discounts,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalDiscounts,
            hasNextPage,
            hasPrevPage,
            limit: limitNum
        }
    });
});

// Get discount by ID
export const getDiscountById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const discount = await DiscountModel.findById(id)
        .populate('courseIds', 'name description thumbnail price')
        .populate('businessId', 'businessName')
        .populate('allowedUsers', 'name email')
        .populate('allowedBusinesses', 'businessName');

    if (!discount) {
        return next(new ErrorHandler('Discount not found', 404));
    }

    res.status(200).json({
        success: true,
        data: discount
    });
});

// Update discount
export const updateDiscount = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const updateData = req.body;

    const discount = await DiscountModel.findById(id);
    if (!discount) {
        return next(new ErrorHandler('Discount not found', 404));
    }

    // Validate discount type and amount if provided
    if (updateData.discountType && updateData.amount) {
        if (updateData.discountType === 'percentage' && (updateData.amount <= 0 || updateData.amount > 100)) {
            return next(new ErrorHandler('Percentage discount must be between 0 and 100', 400));
        }

        if (updateData.discountType === 'fixed' && updateData.amount <= 0) {
            return next(new ErrorHandler('Fixed discount amount must be greater than 0', 400));
        }
    }

    // Validate dates if provided
    if (updateData.startDate && updateData.endDate) {
        const start = new Date(updateData.startDate);
        const end = new Date(updateData.endDate);

        if (start >= end) {
            return next(new ErrorHandler('End date must be after start date', 400));
        }
    }

    // Check if code already exists (if updating code)
    if (updateData.code && updateData.code !== discount.code) {
        const existingDiscount = await DiscountModel.findOne({
            code: updateData.code.toUpperCase(),
            _id: { $ne: id }
        });
        if (existingDiscount) {
            return next(new ErrorHandler('Discount code already exists', 400));
        }
        updateData.code = updateData.code.toUpperCase();
    }

    // Validate course IDs if provided
    if (updateData.courseIds && updateData.courseIds.length > 0) {
        // Filter out empty strings
        const validCourseIds = updateData.courseIds.filter((id: string) => id && id.trim() !== '');
        if (validCourseIds.length > 0) {
            const validCourses = await CourseModel.find({ _id: { $in: validCourseIds } });
            if (validCourses.length !== validCourseIds.length) {
                return next(new ErrorHandler('Some course IDs are invalid', 400));
            }
        }
        // Update the array to only include valid IDs
        updateData.courseIds = validCourseIds;
    }

    // Validate business ID if provided
    if (updateData.businessId && updateData.businessId.trim() !== '') {
        const business = await BusinessModel.findById(updateData.businessId);
        if (!business) {
            return next(new ErrorHandler('Business not found', 404));
        }
    } else {
        // If businessId is empty string, null, or undefined, set it to undefined to avoid MongoDB casting error
        updateData.businessId = undefined;
    }

    // Validate allowed businesses if provided
    if (updateData.allowedBusinesses && updateData.allowedBusinesses.length > 0) {
        // Filter out empty strings
        const validBusinessIds = updateData.allowedBusinesses.filter((id: string) => id && id.trim() !== '');
        if (validBusinessIds.length > 0) {
            const validBusinesses = await BusinessModel.find({ _id: { $in: validBusinessIds } });
            if (validBusinesses.length !== validBusinessIds.length) {
                return next(new ErrorHandler('Some business IDs are invalid', 400));
            }
        }
        // Update the array to only include valid IDs
        updateData.allowedBusinesses = validBusinessIds;
    }

    // Filter out empty strings from allowedUsers if provided
    if (updateData.allowedUsers && updateData.allowedUsers.length > 0) {
        updateData.allowedUsers = updateData.allowedUsers.filter((id: string) => id && id.trim() !== '');
    }

    const updatedDiscount = await DiscountModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
        .populate('courseIds', 'name description thumbnail price')
        .populate('businessId', 'businessName')
        .populate('allowedUsers', 'name email')
        .populate('allowedBusinesses', 'businessName');

    res.status(200).json({
        success: true,
        message: 'Discount updated successfully',
        data: updatedDiscount
    });
});

// Delete discount
export const deleteDiscount = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const discount = await DiscountModel.findById(id);
    if (!discount) {
        return next(new ErrorHandler('Discount not found', 404));
    }

    // Check if discount is currently active and being used
    const now = new Date();
    if (discount.isActive && discount.startDate <= now && discount.endDate >= now && discount.usedCount > 0) {
        return next(new ErrorHandler('Cannot delete an active discount that has been used', 400));
    }

    await DiscountModel.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: 'Discount deleted successfully'
    });
});

// Validate discount code
export const validateDiscountCode = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { code, courseId, businessId, userId, orderAmount } = req.body;

    if (!code) {
        return next(new ErrorHandler('Discount code is required', 400));
    }

    // Handle empty string values for ObjectId fields
    const cleanBusinessId = businessId && businessId.trim() !== '' ? businessId : undefined;
    const cleanCourseId = courseId && courseId.trim() !== '' ? courseId : undefined;

    const discount = await DiscountModel.findOne({
        code: code.toUpperCase(),
        isActive: true
    });

    if (!discount) {
        return next(new ErrorHandler('Invalid discount code', 400));
    }

    const now = new Date();

    // Check if discount is within valid date range
    if (now < discount.startDate || now > discount.endDate) {
        return next(new ErrorHandler('Discount code is not valid at this time', 400));
    }

    // Check usage limit
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
        return next(new ErrorHandler('Discount code has reached its usage limit', 400));
    }

    // Check minimum order amount
    if (discount.minOrderAmount && orderAmount < discount.minOrderAmount) {
        return next(new ErrorHandler(`Minimum order amount required: $${discount.minOrderAmount}`, 400));
    }

    // Check access type and permissions
    if (discount.accessType === 'private') {
        let hasAccess = false;

        // Check if user has access
        if (userId && discount.allowedUsers && discount.allowedUsers.includes(userId)) {
            hasAccess = true;
        }

        // Check if business has access
        if (cleanBusinessId && discount.allowedBusinesses && discount.allowedBusinesses.includes(cleanBusinessId)) {
            hasAccess = true;
        }

        if (!hasAccess) {
            return next(new ErrorHandler('You do not have access to this discount code', 400));
        }
    }

    // Check if course is eligible
    if (cleanCourseId && discount.courseIds && discount.courseIds.length > 0) {
        if (!discount.courseIds.includes(cleanCourseId)) {
            return next(new ErrorHandler('Discount code is not valid for this course', 400));
        }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.discountType === 'percentage') {
        discountAmount = (orderAmount * discount.amount) / 100;
        if (discount.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, discount.maxDiscountAmount);
        }
    } else {
        discountAmount = discount.amount;
    }

    const finalAmount = Math.max(0, orderAmount - discountAmount);

    res.status(200).json({
        success: true,
        data: {
            discount,
            discountAmount,
            finalAmount,
            originalAmount: orderAmount
        }
    });
});

// Get discount statistics
export const getDiscountStatistics = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const totalDiscounts = await DiscountModel.countDocuments({});
    const activeDiscounts = await DiscountModel.countDocuments({ isActive: true });
    const expiredDiscounts = await DiscountModel.countDocuments({
        endDate: { $lt: new Date() }
    });
    const upcomingDiscounts = await DiscountModel.countDocuments({
        startDate: { $gt: new Date() }
    });

    // Get discount types distribution
    const typeStats = await DiscountModel.aggregate([
        {
            $group: {
                _id: '$discountType',
                count: { $sum: 1 }
            }
        }
    ]);

    // Get access type distribution
    const accessStats = await DiscountModel.aggregate([
        {
            $group: {
                _id: '$accessType',
                count: { $sum: 1 }
            }
        }
    ]);

    // Get most used discounts
    const mostUsedDiscounts = await DiscountModel.find({})
        .sort({ usedCount: -1 })
        .limit(5)
        .select('code name usedCount');

    res.status(200).json({
        success: true,
        data: {
            totalDiscounts,
            activeDiscounts,
            expiredDiscounts,
            upcomingDiscounts,
            typeStats,
            accessStats,
            mostUsedDiscounts
        }
    });
});

export const getAvailableDiscounts = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        const businessId = req.user?.businessInfo?.businessId;
        const role = req.user?.businessInfo?.role;
        if (!userId && !businessId) {
            res.status(400).json({ success: false, message: 'Missing userId or businessId' });
            return;
        }

        const conditions: any[] = [];

        // 1. Discount công khai
        conditions.push({ accessType: 'public' });

        // 2. Discount private nhưng có trong allowedUsers hoặc allowedBusinesses
        const privateCondition: any = { accessType: 'private', $or: [] };

        if (userId) {
            privateCondition.$or.push({ allowedUsers: new mongoose.Types.ObjectId(String(userId)) });
        }
        if (businessId) {
            privateCondition.$or.push({ allowedBusinesses: new mongoose.Types.ObjectId(String(businessId)) });
        }

        if (privateCondition.$or.length > 0) {
            conditions.push(privateCondition);
        }

        if (businessId && role === 'admin') {
            conditions.push({ businessId: new mongoose.Types.ObjectId(String(businessId)) });
        }

        // Query
        const discounts = await DiscountModel.find({
            $or: conditions,
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        }).sort({ createdAt: -1 });

        res.json({ success: true, discounts });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
