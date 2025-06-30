import { IOrder } from '../interfaces/Order';
import mongoose, { Schema } from 'mongoose';

const OrderSchema = new Schema<IOrder>(
    {
        courseIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course',
                required: true
            }
        ],
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        payment_info: {
            type: String
        },
        price: Number,
        orderCode: String
    },
    { timestamps: true }
);

export default mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
