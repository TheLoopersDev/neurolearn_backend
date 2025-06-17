// routes/lesson.routes.ts
import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { createLesson, reorderLesson } from '../controllers/lesson.controller';
import { updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Lesson
 *   description: Lesson management endpoints
 */

/**
 * @swagger
 * /api/lesson/create/{courseId}:
 *   post:
 *     summary: Create a lesson under a section
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: courseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the course to which the lesson belongs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sectionId
 *               - title
 *             properties:
 *               sectionId:
 *                 type: string
 *                 description: ID of the section to add the lesson to
 *               title:
 *                 type: string
 *                 description: Title of the lesson
 *               description:
 *                 type: string
 *               videoUrl:
 *                 type: object
 *                 properties:
 *                   public_id:
 *                     type: string
 *                   url:
 *                     type: string
 *               videoLength:
 *                 type: number
 *               isFree:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Lesson created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Course or Section not found
 */

router.post('/create/:courseId', isAuthenticated, createLesson); 

/**
 * @swagger
 * /api/courses/reorder-lesson/{id}:
 *   put:
 *     summary: Reorder lessons in section
 *     tags: [Courses]
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
 *               - sectionId
 *               - lessons
 *             properties:
 *               sectionId:
 *                 type: string
 *               lessons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     order:
 *                       type: number
 *     responses:
 *       200:
 *         description: Lessons reordered successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/reorder-lesson/:id', updateAccessToken, isAuthenticated, reorderLesson);

export = router;
