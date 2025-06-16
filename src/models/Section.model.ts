import mongoose, { Schema } from 'mongoose';

const SectionSchema = new Schema(
    {
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        order: Number,
        title: String,
        description: String,
        lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
        isPublished: { type: Boolean, default: false },
        quizzes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Quiz'
            }
        ]
    },
    { timestamps: true }
);

export default mongoose.models.Section || mongoose.model('Section', SectionSchema);
