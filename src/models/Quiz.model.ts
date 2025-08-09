import mongoose, { Schema } from 'mongoose';
import { IQuiz, IQuestion } from '../interfaces/Quiz';

const answerOptionSchema = new Schema(
    { id: { type: String, required: true }, text: { type: String, required: true } },
    { _id: false }
);

const questionSchema = new Schema<IQuestion>(
    {
        questionNumber: { type: Number, required: true },
        title: { type: String, required: true },
        questionType: { type: String, required: true, enum: ['single-choice', 'multiple-choice'] },
        questionImage: { type: String, default: null },
        choicesConfig: {
            isMultipleAnswer: { type: Boolean, default: false },
            isAnswerWithImageEnabled: { type: Boolean, default: false }
        },
        options: { type: [answerOptionSchema], required: true },
        correctAnswerIds: { type: [String], required: true },
        points: { type: String, required: true },
        isRequired: { type: Boolean, default: false }
    },
    { _id: false }
);

const quizSchema = new Schema<IQuiz>(
    {
        name: { type: String, required: true },
        examTitle: { type: String },
        duration: { type: String, required: true },
        imageUrl: { type: String },
        category: { type: String },
        progress: { type: Number },
        totalQuestions: { type: Number },
        questions: { type: [questionSchema], required: true },

        instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },

        // ✅ GIẢI PHÁP B: giống Lesson
        sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', index: true },
        order: { type: Number, default: 0, index: true },

        description: { type: String },
        difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
        passingScore: { type: Number },
        maxAttempts: { type: Number },
        isPublished: { type: Boolean, default: false },

        // ❌ bỏ 2 field cũ để tránh rối
        // sectionOrder: { type: Number },
        // lessonOrder: { type: Number },

        userScores: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
                score: { type: Number, required: true, default: 0 },
                attemptedAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

// Sắp xếp nhanh theo section
quizSchema.index({ sectionId: 1, order: 1 });

export default mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', quizSchema);
