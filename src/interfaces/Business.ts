import mongoose, { Document, Types } from 'mongoose';

export interface BusinessCourse {
    course: mongoose.Types.ObjectId;
    totalLicenses: number;
}

export interface BusinessT extends Document {
    _id: string;

    businessName: string;
    description?: string;

    createdBy: Types.ObjectId;

    employees: {
        user: Types.ObjectId;
        role: 'admin' | 'manager' | 'employee';
    }[];

    courses: BusinessCourse[];

    isVerified: boolean;

    signAccessToken: () => string;
    signRefreshToken: () => string;
    comparePassword: (enteredPassword: string) => Promise<boolean>;
}
