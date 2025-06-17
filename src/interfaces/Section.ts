import mongoose, { Document, Types } from 'mongoose';

export interface ISection extends Document {
    courseId: Types.ObjectId;
    title: string;
    description?: string;
    order: number;
    isPublished?: boolean;
    lesson?: Types.ObjectId[];
    quizzes?: Types.ObjectId[];
}
