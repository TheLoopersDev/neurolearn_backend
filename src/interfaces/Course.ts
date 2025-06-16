import mongoose, { Document, Types } from 'mongoose';
import { UserT } from './User';

export interface IReviewReply extends Document {
    user: UserT;
    comment: string;
}

export interface IReview extends Document {
    user: UserT;
    rating: number;
    comment: string;
    commentReplies?: IReviewReply[];
}

export interface ICourse extends Document {
    name: string;
    subTitle?: string;
    description?: string;
    price: number;
    estimatedPrice?: number;
    thumbnail: {
        public_id: string;
        url: string;
    };
    demoUrl?: {
        public_id: string;
        url: string;
    };
    authorId: Types.ObjectId;
    tags?: string;
    level?: Types.ObjectId;
    benefits?: { title: string }[];
    prerequisites?: { title: string }[];
    reviews?: IReview[];
    sections?: {
        _id: Types.ObjectId;
    }[];
    rating?: number;
    purchased?: number;
    isPublished: boolean;
    isFree: boolean;
    category: Types.ObjectId;
    subCategory: Types.ObjectId;
    overview: string;
    topics: string[];
    duration: {
        type: Number;
        default: 0;
    };
}

export interface ICoursePopulated extends Document {
    sections: Array<{
        _id: string;
        title: string;
        order: number;
        isPublished: boolean;
        lessons: Array<{
            _id: string;
            title: string;
            order: number;
            isPublished: boolean;
            isFree: boolean;
            videoUrl?: {
                public_id: string;
                url: string;
            };
        }>;
    }>;
}

export interface IReviewClient {
    _id: string;
    rating: number;
    comment: string;
    user: {
        name: string;
        avatar: string;
    };
    commentReplies?: Array<{
        user: {
            name: string;
            avatar: string;
        };
        comment: string;
    }>;
}

export interface ICourseDetail
    extends Omit<ICourse, 'authorId' | 'level' | 'category' | 'subCategory' | 'sections' | 'reviews'> {
    authorId: {
        _id: string;
        name: string;
        email: string;
        avatar: string;
        uploadedCourses?: Array<{ _id: string }>;
        profession: string;
        introduce?: string;
        rating?: number;
        reviews?: number;
        students?: number;
        courses?: number;
        updatedAt?: Date;
    };
    level?: {
        _id: string;
        name: string;
    };
    category?: any;
    subCategory?: any;
    overview: string;
    topics: string[];
    sections: Array<{
        _id: string;
        title: string;
        order: number;
        isPublished: boolean;
        lessons: Array<{
            _id: string;
            title: string;
            order: number;
            isPublished: boolean;
            isFree: boolean;
            videoUrl?: {
                public_id: string;
                url: string;
            };
        }>;
    }>;
    reviews: IReviewClient[];
}

