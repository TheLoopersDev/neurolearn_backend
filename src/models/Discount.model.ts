import mongoose, { Schema, Document } from 'mongoose';

export interface IDiscount extends Document {
    code: string;
    name?: string; // Tên giảm giá
    description?: string;
    discountType: 'percentage' | 'fixed'; // Loại giảm giá: % hoặc cố định
    amount: number; // % hoặc số tiền giảm trực tiếp
    maxDiscountAmount?: number; // Giảm tối đa (nếu %)
    courseIds?: mongoose.Types.ObjectId[];
    businessId?: mongoose.Types.ObjectId;
    accessType: 'public' | 'private'; // Công khai hoặc chỉ định
    allowedUsers?: mongoose.Types.ObjectId[];
    allowedBusinesses?: mongoose.Types.ObjectId[];
    startDate: Date; // Ngày bắt đầu
    endDate: Date; // Ngày kết thúc
    usageLimit?: number; // Giới hạn số lần sử dụng
    usedCount: number; // Đã sử dụng bao nhiêu lần
    minOrderAmount?: number; // Đơn tối thiểu
    isActive: boolean; // Trạng thái
}

const DiscountSchema = new Schema<IDiscount>(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        name: { type: String },
        description: { type: String },
        discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
        amount: { type: Number, required: true }, // Số % hoặc số tiền giảm
        maxDiscountAmount: { type: Number }, // Giảm tối đa
        courseIds: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
        businessId: { type: Schema.Types.ObjectId, ref: 'Business' },
        accessType: { type: String, enum: ['public', 'private'], default: 'public' },
        allowedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        allowedBusinesses: [{ type: Schema.Types.ObjectId, ref: 'Business' }],
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        usageLimit: { type: Number },
        usedCount: { type: Number, default: 0 },
        minOrderAmount: { type: Number },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

export default mongoose.model<IDiscount>('Discount', DiscountSchema);
