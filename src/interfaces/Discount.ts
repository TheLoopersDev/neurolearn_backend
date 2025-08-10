import mongoose from 'mongoose';

export interface Discount {
    _id?: string;
    code: string;
    name?: string;
    description?: string;
    discountType: 'percentage' | 'fixed';
    amount: number;
    maxDiscountAmount?: number;
    courseIds?: mongoose.Types.ObjectId[];
    businessId?: mongoose.Types.ObjectId;
    accessType: 'public' | 'private';
    allowedUsers?: mongoose.Types.ObjectId[];
    allowedBusinesses?: mongoose.Types.ObjectId[];
    startDate: Date;
    endDate: Date;
    usageLimit?: number;
    usedCount: number;
    minOrderAmount?: number;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
} 