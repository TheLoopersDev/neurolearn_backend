import mongoose from 'mongoose';
import { ICourse } from './Course';

export interface ICartItem {
    courseId: mongoose.Schema.Types.ObjectId | ICourse;
    quantity: number;
}

export interface ICart {
    userId: mongoose.Schema.Types.ObjectId;
    items: ICartItem[];
}

export interface ICartModel extends mongoose.Document {
    userId: mongoose.Schema.Types.ObjectId;
    items: ICartItem[];
}
