import express from 'express';
import {
    createQuiz,
    getAllQuizzes,
    updateQuiz,
    deleteQuiz,
    submitQuiz,
    createQuestion,
    deleteQuestion,
    getAllQuestions,
    getQuestionById,
    getQuizById,
    updateQuestion,
    reorderQuestion
} from '../controllers/quiz.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { updateAccessToken } from '../controllers/user.controller';

/**
 * @swagger
 * tags:
 *   name: Quizzes
 *   description: Quiz management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/quizzes:
 *   post:
 *     summary: Create a new quiz
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - title
 *               - questions
 *             properties:
 *               courseId:
 *                 type: string
 *               title:
 *                 type: string
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - question
 *                     - options
 *                     - correctAnswer
 *                   properties:
 *                     question:
 *                       type: string
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                     correctAnswer:
 *                       type: string
 *     responses:
 *       201:
 *         description: Quiz created successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/', updateAccessToken, isAuthenticated, createQuiz);

/**
 * @swagger
 * /api/quizzes/{id}:
 *   get:
 *     summary: Get quiz by ID
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz details
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Quiz not found
 */
router.get('/:id', updateAccessToken, isAuthenticated, getQuizById);

// GET /api/quizzes - Fetch all quizzes (without pagination)
router.get('/', updateAccessToken, isAuthenticated, getAllQuizzes);

// PUT /api/quizzes/:quizId - Update a quiz
router.put('/:id', updateAccessToken, isAuthenticated, updateQuiz);

// DELETE /api/quizzes/:quizId - Delete a quiz
router.delete('/:id', updateAccessToken, isAuthenticated, deleteQuiz);

/**
 * @swagger
 * /api/quizzes/{id}/submit:
 *   post:
 *     summary: Submit quiz answers
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - selectedAnswer
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     selectedAnswer:
 *                       type: string
 *     responses:
 *       200:
 *         description: Quiz submitted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Quiz not found
 */
router.post('/:id/submit', updateAccessToken, isAuthenticated, submitQuiz);

router.get('/:id/questions/:questionId', updateAccessToken, isAuthenticated, getQuestionById);

router.get('/:id/questions', updateAccessToken, isAuthenticated, getAllQuestions);

router.post('/:id/questions', updateAccessToken, isAuthenticated, createQuestion);

router.put('/:id/questions/:questionNumber', updateAccessToken, isAuthenticated, updateQuestion);

router.put('/:id/questions/reorder', updateAccessToken, isAuthenticated, reorderQuestion);

router.delete('/:id/questions/:questionNumber', updateAccessToken, isAuthenticated, deleteQuestion);

export = router;
