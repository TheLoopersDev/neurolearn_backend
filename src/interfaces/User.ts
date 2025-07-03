import mongoose, { Document } from 'mongoose';

export interface UserT extends Document {
    _id: string;
    name: string;
    email: string;
    password: string;
    role: string;
    introduce?: string;
    profession: string;
    age: number;
    avatar: {
        public_id: string;
        url: string;
    };
    socialLinks?: {
        facebook?: string;
        twitter?: string;
        linkedin?: string;
        instagram?: string;
    };
    address: string;
    phoneNumber: string;
    rating: number;
    student: number;
    businessInfo?: {
        businessId: mongoose.Types.ObjectId | null;
        role: 'admin' | 'manager' | 'employee' | null;
    };

    purchasedCourses: mongoose.Schema.Types.ObjectId[];
    uploadedCourses: mongoose.Schema.Types.ObjectId[];
    assignedCourses: mongoose.Schema.Types.ObjectId[];
    isVerified: boolean;
    confirmPassword: (password: string) => Promise<boolean>;
    signAccessToken: () => string;
    signRefreshToken: () => string;
}
