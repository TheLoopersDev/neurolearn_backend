// import mongoose, { Schema, Document } from 'mongoose';
// import { IProgress } from '../interfaces/Progress';

// // Schema của Progress
// const ProgressSchema = new Schema<IProgress & Document>(
//     {
//         user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//         course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//         totalLessons: { type: Number, required: true },
//         totalCompleted: { type: Number, required: true, default: 0 },
//         completedSections: [
//             {
//                 sectionId: {
//                     type: mongoose.Schema.Types.ObjectId,
//                     ref: 'Section',
//                     required: true
//                 },
//                 completedLessons: { type: Number, default: 0 },
//                 totalLessonsInSection: { type: Number, required: true },
//                 lessons: [
//                     {
//                         lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
//                         isCompleted: { type: Boolean, default: false }
//                     }
//                 ]
//             }
//         ],
//         progressPercentage: { type: Number, default: 0 }
//     },
//     { timestamps: true }
// );

// // Middleware để cập nhật `totalCompleted` và `progressPercentage` tự động
// ProgressSchema.pre<IProgress>('save', function (next) {
//     if (this.isModified('completedSections')) {
//         // Tính toán lại `totalCompleted` từ `completedSections`
//         this.totalCompleted = this.completedSections.reduce((total: any, section: any) => {
//             return total + section.completedLessons;
//         }, 0);

//         // Tính toán phần trăm tiến độ
//         const progressPercentage = Math.round((this.totalCompleted / this.totalLessons) * 100);

//         this.progressPercentage = progressPercentage;
//     }
//     next();
// });

// // Tách logic tính `totalCompleted` và `progressPercentage` thành một hàm riêng biệt nếu cần thiết
// ProgressSchema.methods.calculateProgress = function () {
//     const totalCompleted = this.completedSections.reduce((total: any, section: any) => {
//         return total + section.completedLessons;
//     }, 0);

//     const progressPercentage = this.totalLessons > 0 ? Math.round((totalCompleted / this.totalLessons) * 100) : 0;

//     return { totalCompleted, progressPercentage };
// };

// export default mongoose.models.Progress || mongoose.model<IProgress>('Progress', ProgressSchema);
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILessonProgress {
    lessonId: Types.ObjectId;
    isCompleted: boolean;
}

export interface ISectionProgress {
    sectionId: Types.ObjectId;
    completedLessons: number; // auto-calc
    totalLessonsInSection: number; // auto-calc
    lessons: ILessonProgress[];
}

export interface IProgress extends Document {
    user: Types.ObjectId;
    course: Types.ObjectId;
    totalLessons: number; // auto-calc
    totalCompleted: number; // auto-calc
    completedSections: ISectionProgress[];
    progressPercentage: number; // auto-calc
    calculateProgress(): { totalCompleted: number; progressPercentage: number };
}

// ---- Sub-schemas ----
const LessonProgressSchema = new Schema<ILessonProgress>(
    {
        lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
        isCompleted: { type: Boolean, default: false }
    },
    { _id: false }
);

const SectionProgressSchema = new Schema<ISectionProgress>(
    {
        sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
        completedLessons: { type: Number, default: 0 }, // sẽ auto-calc
        totalLessonsInSection: { type: Number, required: true }, // sẽ auto-calc
        lessons: {
            type: [LessonProgressSchema],
            validate: {
                validator(v: ILessonProgress[]) {
                    return Array.isArray(v);
                },
                message: 'lessons must be an array'
            },
            default: []
        }
    },
    { _id: false }
);

// Auto-calc per-section trước khi validate/save
SectionProgressSchema.pre('validate', function (next) {
    const lessons = this.lessons || [];
    this.totalLessonsInSection = lessons.length;
    this.completedLessons = lessons.reduce((acc, l) => acc + (l.isCompleted ? 1 : 0), 0);
    next();
});

// ---- Root schema ----
const ProgressSchema = new Schema<IProgress>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
        totalLessons: { type: Number, required: true, default: 0 }, // auto-calc
        totalCompleted: { type: Number, required: true, default: 0 }, // auto-calc
        completedSections: {
            type: [SectionProgressSchema],
            default: [],
            // đảm bảo không trùng sectionId trong mảng
            validate: {
                validator(v: ISectionProgress[]) {
                    const set = new Set(v.map((s) => String(s.sectionId)));
                    return set.size === v.length;
                },
                message: 'completedSections contains duplicated sectionId'
            }
        },
        progressPercentage: { type: Number, default: 0 } // auto-calc
    },
    { timestamps: true }
);

// Unique index để không bị trùng progress
ProgressSchema.index({ user: 1, course: 1 }, { unique: true, name: 'uniq_user_course' });

// ---- Auto-calc toàn cục ----
function recomputeRoot(this: IProgress) {
    // force revalidate từng section (đảm bảo counters section đúng)
    for (const sec of this.completedSections || []) {
        if (typeof (sec as any).validateSync === 'function') {
            (sec as any).validateSync(); // gọi pre('validate') trên subdoc
        }
    }

    this.totalLessons = (this.completedSections || []).reduce((sum, s) => sum + (s.totalLessonsInSection || 0), 0);
    this.totalCompleted = (this.completedSections || []).reduce((sum, s) => sum + (s.completedLessons || 0), 0);
    this.progressPercentage = this.totalLessons > 0 ? Math.round((this.totalCompleted / this.totalLessons) * 100) : 0;
}

ProgressSchema.pre<IProgress>('validate', function (next) {
    recomputeRoot.call(this);
    next();
});

ProgressSchema.pre<IProgress>('save', function (next) {
    // Nếu nested array biến đổi, recompute để chắc ăn
    if (this.isModified('completedSections')) {
        recomputeRoot.call(this);
        this.markModified('completedSections');
    }
    next();
});

// ---- Instance method ----
ProgressSchema.methods.calculateProgress = function () {
    const totalCompleted = (this.completedSections || []).reduce(
        (total: number, section: ISectionProgress) => total + (section.completedLessons || 0),
        0
    );
    const progressPercentage =
        (this.totalLessons || 0) > 0 ? Math.round((totalCompleted / this.totalLessons) * 100) : 0;

    return { totalCompleted, progressPercentage };
};

export default mongoose.models.Progress || mongoose.model<IProgress>('Progress', ProgressSchema);
