import { catchAsync } from '../utils/catchAsync';
import { NextFunction, Request, Response } from 'express';
import { redis } from '../utils/redis';
import Quiz from '../models/Quiz.model'; // Adjust the import path as needed
import ErrorHandler from '../utils/ErrorHandler';
import mongoose from 'mongoose';
import { IQuestion } from '../interfaces/Quiz';
import cloudinary from 'cloudinary';
const TAG_QUIZZES = 'tag:quizzes';

export async function getCache(key: string) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
}

export async function setCache(key: string, value: unknown, ttlSeconds = 3600) {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    await redis.sadd(TAG_QUIZZES, key);
}

export async function invalidateQuizzesCache() {
    const keys = await redis.smembers(TAG_QUIZZES);
    if (keys.length) {
        await redis.del(...keys);
        await redis.del(TAG_QUIZZES);
    }
}
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
        courseId,
        description,
        difficulty,
        passingScore,
        maxAttempts,
        isPublished,
        sectionId, // ✅ nếu muốn gán quiz vào section ngay từ đầu
        order // ✅ thứ tự trong section
    } = req.body;

    const instructorId = req.user?._id;
    if (!instructorId) {
        return next(new ErrorHandler('Instructor ID not found from auth', 401));
    }

    // Tạo quiz document
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
        sectionId: sectionId || undefined, // optional
        order: typeof order === 'number' ? order : 0, // optional
        description,
        difficulty,
        passingScore,
        maxAttempts,
        isPublished,
        totalQuestions: Array.isArray(questions) ? questions.length : 0
    });

    await invalidateQuizzesCache();

    res.status(201).json({
        success: true,
        quiz
    });
});

// GET /api/quizzes - Fetch all quizzes (without pagination)
export const getAllQuizzes = catchAsync(async (req, res) => {
    const {
        courseId,
        difficulty,
        noCache,
        instructorId: qInstructorId
    } = req.query as {
        courseId?: string;
        difficulty?: string;
        noCache?: string;
        instructorId?: string;
    };

    const authUserId = (req.user?._id as string | undefined) || undefined;
    const instructorId = qInstructorId || authUserId;

    const cacheKey = `quizzes:${courseId || 'all'}:${difficulty || 'all'}:${instructorId || 'all'}`;

    if (noCache !== '1') {
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.status(200).json({ success: true, quizzes: cached, cached: true });
        }
    }

    const query: any = {};
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) query.courseId = courseId;
    if (difficulty) query.difficulty = difficulty;
    if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) query.instructorId = instructorId;

    const quizzes = await Quiz.find(query)
        .populate('instructorId', 'name email avatar')
        .populate('courseId', 'title tags')
        .lean();

    await setCache(cacheKey, quizzes, 3600);

    res.status(200).json({ success: true, quizzes });
});

// PUT /api/quizzes/:quizId - Update a quiz + upload Cloudinary
import { Readable } from 'stream';

function bufferToStream(buffer: Buffer) {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    return readable;
}

// Rút public_id từ secure URL cũ (không cần đổi schema)
function extractPublicIdFromUrl(url?: string | null): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        const parts = u.pathname.split('/');
        const uploadIdx = parts.findIndex((p) => p === 'upload');
        if (uploadIdx === -1) return null;
        const afterUpload = parts.slice(uploadIdx + 1);
        const first = afterUpload[0] || '';
        const rest = /^\s*v\d+\s*$/.test(first) ? afterUpload.slice(1) : afterUpload;
        if (rest.length === 0) return null;
        const last = rest[rest.length - 1];
        const filenameNoExt = last.replace(/\.[^.]+$/, '');
        const folder = rest.length > 1 ? rest.slice(0, -1).join('/') : '';
        return folder ? `${folder}/${filenameNoExt}` : filenameNoExt;
    } catch {
        return null;
    }
}

export const updateQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = (req.params.quizId || req.params.id) as string;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return next(new ErrorHandler('Quiz not found', 404));

    // -------- LOG CHẨN ĐOÁN --------
    console.log('[updateQuiz] quizId =', quizId);
    console.log(
        '[updateQuiz] has file?',
        !!(req as any).file,
        'removeImage=',
        req.body?.removeImage,
        'has imageBase64?',
        !!req.body?.imageBase64
    );

    // ====== xử lý cover image ======
    const removeImage = String(req.body.removeImage || '').toLowerCase() === 'true';

    // A) XÓA ẢNH
    if (removeImage && quiz.imageUrl) {
        const oldId = extractPublicIdFromUrl(quiz.imageUrl);
        if (oldId) {
            try {
                const delRes = await cloudinary.v2.uploader.destroy(oldId);
                console.log('[updateQuiz] destroyed old image:', delRes);
            } catch (e) {
                console.warn('[updateQuiz] destroy old image failed:', (e as Error).message);
            }
        }
        quiz.imageUrl = undefined;
    }

    // B) UPLOAD FILE (multer)
    if ((req as any).file) {
        const file = (req as any).file as Express.Multer.File;
        // Validate thêm ở backend
        if (!file.mimetype.startsWith('image/')) {
            return next(new ErrorHandler('Invalid file type. Only images are allowed.', 400));
        }
        if (file.size > 5 * 1024 * 1024) {
            return next(new ErrorHandler('Image size must be ≤ 5MB.', 400));
        }

        try {
            const uploadRes = await cloudinary.v2.uploader.upload(
                `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                {
                    folder: 'quizzes',
                    resource_type: 'image'
                }
            );
            console.log('[updateQuiz] upload file ok:', uploadRes.public_id, uploadRes.secure_url);

            // dọn ảnh cũ nếu khác
            if (quiz.imageUrl) {
                const oldId = extractPublicIdFromUrl(quiz.imageUrl);
                if (oldId && oldId !== uploadRes.public_id) {
                    try {
                        const delRes = await cloudinary.v2.uploader.destroy(oldId);
                        console.log('[updateQuiz] destroyed previous image:', delRes);
                    } catch (e) {
                        console.warn('[updateQuiz] destroy previous failed:', (e as Error).message);
                    }
                }
            }

            quiz.imageUrl = uploadRes.secure_url;
        } catch (e: any) {
            console.error('[updateQuiz] upload file error:', e?.message);
            return next(new ErrorHandler('Upload to Cloudinary failed', 500));
        }
    }

    // C) UPLOAD BASE64 (data URL)
    const imageBase64 = req.body.imageBase64 as string | undefined;
    if (imageBase64 && imageBase64.startsWith('data:image/')) {
        try {
            const up = await cloudinary.v2.uploader.upload(imageBase64, { folder: 'quizzes', resource_type: 'image' });
            console.log('[updateQuiz] upload base64 ok:', up.public_id, up.secure_url);

            if (quiz.imageUrl) {
                const oldId = extractPublicIdFromUrl(quiz.imageUrl);
                if (oldId && oldId !== up.public_id) {
                    try {
                        const delRes = await cloudinary.v2.uploader.destroy(oldId);
                        console.log('[updateQuiz] destroyed previous image:', delRes);
                    } catch (e) {
                        console.warn('[updateQuiz] destroy previous failed:', (e as Error).message);
                    }
                }
            }
            quiz.imageUrl = up.secure_url;
        } catch (e: any) {
            console.error('[updateQuiz] upload base64 error:', e?.message);
            return next(new ErrorHandler('Upload base64 to Cloudinary failed', 500));
        }
    }

    // ====== cập nhật các field khác (KHÔNG cho body đè imageUrl) ======
    const allowedFields: (keyof typeof quiz)[] = [
        'name',
        'examTitle',
        'duration',
        'category',
        'progress',
        'questions',
        'instructorId',
        'courseId',
        'description',
        'difficulty',
        'passingScore',
        'maxAttempts',
        'isPublished'
        // 'imageUrl',  // <-- CẤM: không cho body đè URL ảnh
    ] as any;

    // parse questions nếu là string
    let incomingQuestions = (req.body as any).questions;
    if (typeof incomingQuestions === 'string') {
        try {
            incomingQuestions = JSON.parse(incomingQuestions);
        } catch {
            /* ignore */
        }
    }
    if (Array.isArray(incomingQuestions)) {
        (quiz as any).questions = incomingQuestions;
        (quiz as any).totalQuestions = incomingQuestions.length;
    }

    allowedFields.forEach((field: any) => {
        if (field === 'questions') return; // đã xử lý trên
        if ((req.body as any)[field] !== undefined) {
            (quiz as any)[field] = (req.body as any)[field];
        }
    });

    await quiz.save();
    console.log('[updateQuiz] saved quiz.imageUrl =', quiz.imageUrl);

    await redis.del(`quiz:${quizId}`);
    await invalidateQuizzesCache();

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
    await invalidateQuizzesCache();

    res.status(200).json({
        success: true,
        message: 'Quiz deleted successfully'
    });
});

// POST /api/quizzes/:quizId/submit - Submit quiz answers
// POST /api/quizzes/:id/submit
export const submitQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const quizId = req.params.id;
  const { answers, timeTakenSeconds, meta, isTimeOut } = req.body as {
    answers: { questionId: string; selectedOptionIds: (string | number)[] }[];
    timeTakenSeconds?: number;
    meta?: Record<string, unknown> & { isTimeOut?: boolean; courseId?: string };
    isTimeOut?: boolean;
  };

  // ---------- helpers ----------
  const logOn = process.env.NODE_ENV !== 'production' || process.env.QUIZ_DEBUG === '1';
  const dbg = (label: string, payload?: any) => {
    if (!logOn) return;
    try {
      // tránh crash vì circular
      const safe = payload && typeof payload === 'object'
        ? JSON.parse(JSON.stringify(payload))
        : payload;
      // eslint-disable-next-line no-console
      console.log(`[QUIZ:submit] ${label}`, safe);
    } catch {
      console.log(`[QUIZ:submit] ${label}`, payload);
    }
  };

  const isIndexArray = (arr: any[]) =>
    Array.isArray(arr) && arr.length > 0 && arr.every(v => typeof v === 'number' || /^\d+$/.test(String(v)));

  const toStringArray = (arr: any[]) => (Array.isArray(arr) ? arr.map(v => String(v)) : []);

  const getOptionIdByIndex = (q: any, i: number) => {
    const opt = Array.isArray(q?.options) ? q.options[i] : null;
    return String(opt?.id ?? opt?._id ?? opt?.optionId ?? i);
  };

  // ---------- validate ----------
  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    return next(new ErrorHandler('Invalid quiz ID format', 400));
  }

  const authUser = (req as any).user;
  const userId = authUser?._id || authUser?.id;
  if (!userId) {
    return next(new ErrorHandler('Unauthorized', 401));
  }

  if (!Array.isArray(answers)) {
    return next(new ErrorHandler('`answers` must be an array', 400));
  }

  // ---------- fetch ----------
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    return next(new ErrorHandler('Quiz not found', 404));
  }

  dbg('incoming', {
    quizId,
    userId,
    answersLen: answers.length,
    timeTakenSeconds,
    meta,
  });

  // ---------- build userAnswer map ----------
  const userAnswerMap = new Map<string, (string | number)[]>();
  for (const a of answers) {
    if (!a || !a.questionId) continue;
    const arr = Array.isArray(a.selectedOptionIds) ? a.selectedOptionIds : [];
    userAnswerMap.set(String(a.questionId), arr);
  }

  // Helper: question id safe
  const makeSafeQId = (q: any, fallback: string) => {
    const raw = q?._id ?? q?.id ?? q?.questionId ?? q?.uuid ?? q?.slug ?? null;
    return raw != null ? String(raw) : fallback;
  };

  let totalScore = 0;
  let maxPossibleScore = 0;
  let attemptedQuestions = 0;
  let correctQuestions = 0;
  let incorrectQuestions = 0;
  let skippedQuestions = 0;

  const breakdown: Array<{
    questionNumber: number;
    questionId: string;
    status: 'correct' | 'incorrect' | 'skipped';
    pointsEarned: number;
    maxPoints: number;
    userSelectedOptionIds: string[];
    correctAnswerIds: string[];
  }> = [];

  // ---------- grade ----------
  quiz.questions.forEach((q: any, idx: number) => {
    const qId = makeSafeQId(q, String(idx));
    const rawSelected = userAnswerMap.get(qId) ?? [];

    // normalize user selected -> IDs
    const selectedIds: string[] = isIndexArray(rawSelected)
      ? (rawSelected as any[]).map(n => getOptionIdByIndex(q, Number(n)))
      : toStringArray(rawSelected);

    // normalize correct answers -> IDs
    let rawCorrect: any[] = [];
    if (Array.isArray(q?.correctAnswerIds)) rawCorrect = q.correctAnswerIds;
    else if (Array.isArray(q?.correctAnswers)) rawCorrect = q.correctAnswers;
    else if (q?.correctAnswer != null) rawCorrect = [q.correctAnswer];

    const correctIds: string[] = isIndexArray(rawCorrect)
      ? rawCorrect.map(n => getOptionIdByIndex(q, Number(n)))
      : toStringArray(rawCorrect);

    const maxPoints = Number(q?.points ?? 0);
    maxPossibleScore += maxPoints;

    let status: 'correct' | 'incorrect' | 'skipped' = 'skipped';
    let pointsEarned = 0;

    if (selectedIds.length === 0) {
      skippedQuestions++;
    } else {
      attemptedQuestions++;
      const a = [...selectedIds].sort();
      const b = [...correctIds].sort();
      const ok = a.length === b.length && a.every((v, i) => v === b[i]);
      if (ok) {
        status = 'correct';
        pointsEarned = maxPoints;
        totalScore += pointsEarned;
        correctQuestions++;
      } else {
        status = 'incorrect';
        incorrectQuestions++;
      }
    }

    breakdown.push({
      questionNumber: Number(q?.questionNumber ?? idx + 1),
      questionId: qId,
      status,
      pointsEarned,
      maxPoints,
      userSelectedOptionIds: selectedIds,
      correctAnswerIds: correctIds,
    });

    dbg('grade.item', {
      idx,
      qId,
      number: q?.questionNumber,
      selectedIds,
      correctIds,
      status,
      pointsEarned,
      maxPoints,
    });
  });

  const passingScore: number = Number(quiz.passingScore ?? 0);
  const isPassed = totalScore >= passingScore;
  const overallStatus =
    (meta && typeof (meta as any).isTimeOut === 'boolean')
      ? ((meta as any).isTimeOut ? 'time-out' : 'completed')
      : (isTimeOut ? 'time-out' : 'completed');

  dbg('grade.summary', {
    totalQuestions: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
    attemptedQuestions,
    correctQuestions,
    incorrectQuestions,
    skippedQuestions,
    totalScore,
    maxPossibleScore,
    passingScore,
    isPassed,
    overallStatus,
  });

  // ---------- persist attempt ----------
  try {
    quiz.userScores.push({
      user: userId,
      score: totalScore,
      attemptedAt: new Date(),
      timeTakenSeconds: Number(timeTakenSeconds ?? 0),
      meta: meta ?? {},
    });

    await quiz.save();
    await invalidateQuizzesCache();
    dbg('persist.ok', { saved: true });
  } catch (e) {
    dbg('persist.error', e);
    // không fail request vì lỗi ghi lịch sử, nhưng log để điều tra
  }

  // ---------- (optional) update course progress ----------
  // TIP: nếu bạn có enrollment/progress model, cập nhật ở đây:
  // try {
  //   const courseId = (quiz as any)?.course || (meta as any)?.courseId;
  //   if (courseId) {
  //     await CourseEnrollment.updateOne(
  //       { user: userId, course: courseId },
  //       {
  //         $setOnInsert: { user: userId, course: courseId },
  //         $set: { updatedAt: new Date() },
  //         $addToSet: { completedItems: { kind: 'quiz', id: quizId } },
  //       },
  //       { upsert: true }
  //     );
  //     dbg('progress.updated', { courseId, quizId });
  //   }
  // } catch (e) {
  //   dbg('progress.error', e);
  // }

  // ---------- response ----------
  return res.status(200).json({
    success: true,
    message: 'Quiz submitted successfully',
    data: {
      totalQuestions: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
      attemptedQuestions,
      correctQuestions,
      incorrectQuestions,
      skippedQuestions,
      totalScore,
      maxPossibleScore,
      overallStatus,
      isPassed,
      score: totalScore,
      passingScore,
      breakdown,
    },
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
    await invalidateQuizzesCache();

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
    await invalidateQuizzesCache();

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
    await invalidateQuizzesCache();

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

    const index = quiz.questions.findIndex((q: { questionNumber: number }) => q.questionNumber === questionNumber);
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
    await invalidateQuizzesCache();

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
    await invalidateQuizzesCache();

    res.status(201).json({
        success: true,
        message: 'Question added successfully',
        question: newQuestion
    });
});