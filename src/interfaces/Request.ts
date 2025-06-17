import mongoose, { Document } from 'mongoose';

export interface RequestT extends Document {
    type: 'course_approval' | 'instructor_registration' | 'business_verification';
    courseId?: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    status: 'pending' | 'approved' | 'rejected';
    createdAt?: Date;
    updatedAt?: Date;
}
