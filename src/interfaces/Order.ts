import mongoose, { Document } from 'mongoose';

export interface IOrder extends Document {
    courseIds: mongoose.Types.ObjectId[];
    userId: mongoose.Types.ObjectId;
    userType: 'user' | 'business';
    licenseQuantities?: Record<string, number>;
    payment_info?: string;
    price: number;
    discountCode?: string | null;
    orderCode: number;
    createdAt?: Date;
    updatedAt?: Date;
}
