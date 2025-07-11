import mongoose, { Document } from 'mongoose';

export interface IOrder extends Document {
    courseIds: [mongoose.Schema.Types.ObjectId];
    userId: mongoose.Schema.Types.ObjectId;
    userType: 'user' | 'business';
    licenseQuantities?: {
        courseId: mongoose.Schema.Types.ObjectId;
        quantity: number;
    }[];
    payment_info: object;
    price: number;
    orderCode: string;
}
