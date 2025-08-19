import mongoose, { Schema } from 'mongoose';
import { ICourse, IReview, IReviewReply } from '../interfaces/Course';

const ReviewReplySchema = new Schema<IReviewReply>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        comment: String
    },
    { timestamps: true }
);

const ReviewSchema = new Schema<IReview>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        rating: { type: Number, default: 0 },
        comment: String,
        commentReplies: [ReviewReplySchema]
    },
    { timestamps: true }
);

export interface ICoursePackage {
    package: string;
    quantity: number;
    price: number;
}

const CourseSchema = new Schema<ICourse>(
    {
        name: { type: String, required: true },
        subTitle: String,
        description: String,
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        price: Number,
        estimatedPrice: Number,
        thumbnail: {
            public_id: String,
            url: String
        },
        level: { type: mongoose.Schema.Types.ObjectId, ref: 'Level' },
        demoUrl: {
            public_id: String,
            url: String
        },
        benefits: [{ title: String }],
        prerequisites: [{ title: String }],
        reviews: [ReviewSchema],
        sections: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Section'
            }
        ],
        rating: { type: Number, default: 0 },
        purchased: { type: Number, default: 0 },
        isPublished: { type: Boolean, default: false },
        isFree: { type: Boolean, default: false },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
        overview: {
            type: String,
            default: ''
        },
        duration: {
            type: Number,
            default: 0
        },
        coursePackage: [
            {
                package: { type: String, required: true },
                quantity: { type: Number, required: true },
                price: { type: Number, required: true }
            }
        ]
    },
    { timestamps: true }
);

export default mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);
