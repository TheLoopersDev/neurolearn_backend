import { Document, Types } from 'mongoose';

export interface ILessonProgress {
    lessonId: Types.ObjectId;
    isCompleted: boolean;
}

export interface ISectionProgress {
    sectionId: Types.ObjectId;
    completedLessons: number; // số bài đã hoàn thành trong section này
    totalLessonsInSection: number; // tổng số bài trong section
    lessons: ILessonProgress[]; // chi tiết từng bài học
}

export interface IProgress extends Document {
    user: Types.ObjectId;
    course: Types.ObjectId;
    totalLessons: number; // tổng số bài của toàn course
    totalCompleted: number; // tổng số bài đã hoàn thành (sum theo các section)
    completedSections: ISectionProgress[];
    progressPercentage: number; // % tiến độ (rounded)

    // giữ phương thức nếu bạn đang dùng:
    calculateProgress(): { totalCompleted: number; progressPercentage: number };
}
