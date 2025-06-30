import { catchAsync } from '../utils/catchAsync';
import { NextFunction, Request, Response } from 'express';
import { redis } from '../utils/redis';
import Quiz from '../models/Quiz.model'; // Adjust the import path as needed
import Course from '../models/Course.model'; // Import Course model
import ErrorHandler from '../utils/ErrorHandler';
import mongoose from 'mongoose';
import { IQuestion } from '@/interfaces/Quiz';

// GET /api/quizzes/:quizId - Fetch a quiz by ID
export const getQuizById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    // Try cache from Redis
    const cachedQuiz = await redis.get(`quiz:${id}`);
    if (cachedQuiz) {
        return res.status(200).json({
            success: true,
            quiz: JSON.parse(cachedQuiz),
            cached: true
        });
    }

    // Find quiz and populate related fields
    const quiz = await Quiz.findById(id)
        .populate('instructorId', 'name email avatar')
        .populate('courseId', 'title tags');

    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Cache result
    await redis.set(`quiz:${id}`, JSON.stringify(quiz), 'EX', 3600); // 1 hour cache

    res.status(200).json({
        success: true,
        quiz
    });
});

// Create a new quiz
export const createQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const {
        name,
        examTitle,
        duration,
        imageUrl,
        category,
        progress,
        questions,
        instructorId,
        courseId,
        description,
        difficulty,
        passingScore,
        maxAttempts,
        isPublished,
        sectionOrder,
        lessonOrder
    } = req.body;

    // Validate required fields
    if (!name || !duration || !difficulty || !passingScore || !maxAttempts || !instructorId || !courseId) {
        return next(new ErrorHandler('Missing required fields', 400));
    }

    // Optional: Validate if course exists
    const courseExists = await Course.findById(courseId);
    if (!courseExists) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Create quiz document
    const quiz = await Quiz.create({
        name,
        examTitle,
        duration,
        imageUrl,
        category,
        progress,
        questions,
        instructorId,
        courseId,
        description,
        difficulty,
        passingScore,
        maxAttempts,
        isPublished,
        sectionOrder,
        lessonOrder,
        totalQuestions: questions?.length || 0
    });

    res.status(201).json({
        success: true,
        quiz
    });
});

// GET /api/quizzes - Fetch all quizzes (without pagination)
export const getAllQuizzes = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, difficulty } = req.query;

    // Tạo key cache theo query
    const cacheKey = `quizzes:${courseId || 'all'}:${difficulty || 'all'}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        return res.status(200).json({
            success: true,
            quizzes: JSON.parse(cached),
            cached: true
        });
    }

    // Xây query
    const query: any = {};
    if (courseId && mongoose.Types.ObjectId.isValid(courseId.toString())) {
        query.courseId = courseId;
    }
    if (difficulty) {
        query.difficulty = difficulty;
    }

    // Truy vấn DB
    const quizzes = await Quiz.find(query)
        .populate('instructorId', 'name email avatar')
        .populate('courseId', 'title tags');

    // Lưu cache
    await redis.set(cacheKey, JSON.stringify(quizzes), 'EX', 3600); // 1 giờ

    res.status(200).json({
        success: true,
        quizzes
    });
});

// PUT /api/quizzes/:quizId - Update a quiz
export const updateQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    // Find existing quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Update fields
    const allowedFields = [
        'name',
        'examTitle',
        'duration',
        'imageUrl',
        'category',
        'progress',
        'questions',
        'instructorId',
        'courseId',
        'description',
        'difficulty',
        'passingScore',
        'maxAttempts',
        'isPublished',
        'sectionOrder',
        'lessonOrder'
    ];

    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            (quiz as any)[field] = req.body[field];
        }
    });

    // Auto-update totalQuestions if question list was replaced
    if (Array.isArray(req.body.questions)) {
        quiz.totalQuestions = req.body.questions.length;
    }

    await quiz.save();

    // Clear cache if exists
    await redis.del(`quiz:${quizId}`);

    res.status(200).json({
        success: true,
        message: 'Quiz updated successfully',
        quiz
    });
});

// DELETE /api/quizzes/:quizId - Delete a quiz
export const deleteQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;

    // Kiểm tra định dạng ObjectId
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    // Tìm quiz trong DB
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Xóa quiz
    await quiz.deleteOne();

    // Xóa cache nếu có
    await redis.del(`quiz:${quizId}`);

    res.status(200).json({
        success: true,
        message: 'Quiz deleted successfully'
    });
});

// POST /api/quizzes/:quizId/submit - Submit quiz answers
export const submitQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;
    const { userId, answers } = req.body;

    // Validate quizId format
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Calculate the score
    let score = 0;
    quiz.questions.forEach((question: any, index: any) => {
        if (question.correctAnswer === answers[index]) {
            score += question.points;
        }
    });

    // Save the user's score
    quiz.userScores.push({
        user: userId,
        score,
        attemptedAt: new Date()
    });

    // Save the updated quiz
    await quiz.save();

    // Return the result
    res.status(200).json({
        success: true,
        message: 'Quiz submitted successfully',
        score,
        passingScore: quiz.passingScore,
        isPassed: score >= quiz.passingScore
    });
});

export const updateQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;
    const questionNumber = parseInt(req.params.questionNumber, 10); // từ URL

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    if (isNaN(questionNumber)) {
        return next(new ErrorHandler('Invalid question number', 400));
    }

    const { title, questionType, questionImage, choicesConfig, options, correctAnswerIds, points, isRequired } =
        req.body;

    // Tìm quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return next(new ErrorHandler('Quiz not found', 404));

    // Tìm question theo questionNumber
    const question = quiz.questions.find((q: IQuestion) => q.questionNumber === questionNumber);
    if (!question) return next(new ErrorHandler('Question not found in quiz', 404));

    // Cập nhật các trường nếu tồn tại
    if (title !== undefined) question.title = title;
    if (questionType !== undefined) question.questionType = questionType;
    if (questionImage !== undefined) question.questionImage = questionImage;
    if (choicesConfig !== undefined) question.choicesConfig = choicesConfig;
    if (options !== undefined) question.options = options;
    if (correctAnswerIds !== undefined) question.correctAnswerIds = correctAnswerIds;
    if (points !== undefined) question.points = points;
    if (isRequired !== undefined) question.isRequired = isRequired;

    await quiz.save();

    res.status(200).json({
        success: true,
        message: 'Question updated successfully',
        question
    });
});

export const reorderQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;
    const { newOrder } = req.body;
    console.log(newOrder);

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    if (!Array.isArray(newOrder) || newOrder.some((n) => typeof n !== 'number')) {
        return next(new ErrorHandler('Invalid newOrder array', 400));
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return next(new ErrorHandler('Quiz not found', 404));

    const questionMap = new Map<number, any>();
    quiz.questions.forEach((q: any) => questionMap.set(q.questionNumber, q));

    const invalidNumbers = newOrder.filter((qNum) => !questionMap.has(qNum));
    if (invalidNumbers.length > 0) {
        return next(new ErrorHandler(`Invalid question number(s): ${invalidNumbers.join(', ')}`, 400));
    }

    // Rebuild question list in new order, and reassign questionNumber
    const reorderedQuestions = newOrder.map((qNum, index) => {
        const question = questionMap.get(qNum);
        return {
            ...question.toObject(),
            questionNumber: index + 1 // Reassign question number based on new position
        };
    });

    quiz.questions = reorderedQuestions;
    await quiz.save();

    res.status(200).json({
        success: true,
        message: 'Questions reordered successfully',
        questions: quiz.questions
    });
});

// GET /api/quizzes/:quizId/questions/:questionId - Get a specific question in a quiz
export const getQuestionById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id, questionId } = req.params;

    // Kiểm tra quizId và questionId
    if (!id || !questionId) {
        return next(new ErrorHandler('Please provide quiz ID and question ID', 400));
    }

    // Tìm quiz trong database
    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Tìm câu hỏi trong quiz
    const question = quiz.questions.id(questionId);
    if (!question) {
        return next(new ErrorHandler('Question not found in the quiz', 404));
    }

    // Trả về câu hỏi
    res.status(200).json({
        success: true,
        question
    });
});

// GET /api/quizzes/:quizId/questions - Get all questions in a quiz
export const getAllQuestions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Kiểm tra quizId
    if (!id) {
        return next(new ErrorHandler('Please provide a quiz ID', 400));
    }

    // Tìm quiz trong database
    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Trả về tất cả câu hỏi trong quiz
    res.status(200).json({
        success: true,
        questions: quiz.questions
    });
});

// DELETE /api/quizzes/:quizId/questions/:questionId - Delete a specific question in a quiz
export const deleteQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;
    const questionNumber = parseInt(req.params.questionNumber, 10);

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    if (isNaN(questionNumber)) {
        return next(new ErrorHandler('Invalid question number', 400));
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return next(new ErrorHandler('Quiz not found', 404));

    const index = quiz.questions.findIndex((q: { questionNumber: number; }) => q.questionNumber === questionNumber);
    if (index === -1) {
        return next(new ErrorHandler(`Question number ${questionNumber} not found`, 404));
    }

    // Xóa câu hỏi khỏi mảng
    quiz.questions.splice(index, 1);
    quiz.totalQuestions = quiz.questions.length;

    // Gán lại questionNumber cho đúng thứ tự (nếu cần)
    quiz.questions.forEach((q: { questionNumber: any }, idx: number) => {
        q.questionNumber = idx + 1;
    });

    await quiz.save();

    res.status(200).json({
        success: true,
        message: `Question ${questionNumber} deleted successfully`,
        questions: quiz.questions
    });
});

// POST /api/quizzes/:quizId/questions - Create a new question in a quiz
export const createQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    const {
        questionNumber,
        title,
        questionType,
        questionImage = null,
        choicesConfig,
        options,
        correctAnswerIds,
        points,
        isRequired = false
    } = req.body;

    // Validate cơ bản
    if (
        typeof questionNumber !== 'number' ||
        !title ||
        !['single-choice', 'multiple-choice'].includes(questionType) ||
        !Array.isArray(options) ||
        !Array.isArray(correctAnswerIds) ||
        typeof points !== 'string' ||
        !choicesConfig ||
        typeof choicesConfig.isMultipleAnswer !== 'boolean' ||
        typeof choicesConfig.isAnswerWithImageEnabled !== 'boolean'
    ) {
        return next(new ErrorHandler('Invalid or missing question fields', 400));
    }

    // Tìm quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return next(new ErrorHandler('Quiz not found', 404));

    // Tạo question object
    const newQuestion = {
        questionNumber,
        title,
        questionType,
        questionImage,
        choicesConfig,
        options,
        correctAnswerIds,
        points,
        isRequired
    };

    // Thêm vào mảng questions
    quiz.questions.push(newQuestion);
    quiz.totalQuestions = quiz.questions.length;

    await quiz.save();

    res.status(201).json({
        success: true,
        message: 'Question added successfully',
        question: newQuestion
    });
});