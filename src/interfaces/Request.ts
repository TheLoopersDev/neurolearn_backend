import mongoose, { Document } from 'mongoose';

export interface Request {
    _id?: string;
    courseId?: string | null;
    businessId?: string | null;
    userId: string;
    instructorId?: string | null;
    type: 'course_approval' | 'business_verification' | 'instructor_verification';
    status: 'pending' | 'approved' | 'rejected' | 'processed' | 'deleted';
    processedAt?: Date;
    deletedAt?: Date;
    message?: string;
    data?: {
        fullName?: string;
        email?: string;
        phone?: string;
        dob?: string;
        address?: string;
        category?: string;
        description?: string;
        experience?: string;
        role?: string;
        company?: string;
        documents?: string[];
        [key: string]: any;
    };
    createdAt?: Date;
    updatedAt?: Date;
}
