import mongoose, { Schema } from 'mongoose';
import { ICartModel, ICartItem } from '../interfaces/Cart';

const CartItemSchema = new Schema<ICartItem>({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    }
});

const CartSchema = new Schema<ICartModel>({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [CartItemSchema]
});

export const CartModel = mongoose.models.Cart || mongoose.model<ICartModel>('Cart', CartSchema);
