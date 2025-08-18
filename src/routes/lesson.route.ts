// routes/lesson.routes.ts
import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import {
    createLesson,
    updateLesson,
    deleteLesson,
    getAllLessons,
    getLessonById,
    reorderLesson,
    publishLesson,
    unpublishLesson,
    uploadLessonVideo
} from '../controllers/lesson.controller';
import { updateAccessToken } from '../controllers/user.controller';
import { upload } from '../middlewares/upload';
import { ensureLessonDeletable } from '../middlewares/ensureCourseEditable';

const router = express.Router();

/**
 * ..swagger
 * tags:
 *   name: Lesson
 *   description: Lesson management endpoints
 */

/**
 * ..swagger
 * /api/lesson/create/{courseId}/{sectionId}:
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
 *       - name: sectionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the section to add the lesson to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
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

router.post('/create/:courseId/:sectionId', updateAccessToken, isAuthenticated, createLesson);

/**
 * ..swagger
 * /api/lesson/section/{sectionId}:
 *   get:
 *     summary: Get all lessons of a section
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sectionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the section
 *     responses:
 *       200:
 *         description: List of lessons
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 */

router.get('/section/:sectionId', updateAccessToken, isAuthenticated, getAllLessons);

/**
 * ..swagger
 * /api/lesson/{lessonId}:
 *   get:
 *     summary: Get lesson details
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: lessonId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the lesson
 *     responses:
 *       200:
 *         description: Lesson details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 */

router.get('/:lessonId', updateAccessToken, isAuthenticated, getLessonById);

/**
 * ..swagger
 * /api/lesson/update/{lessonId}:
 *   put:
 *     summary: Update a lesson
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: lessonId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the lesson
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
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
 *       200:
 *         description: Lesson updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 */

router.put('/update/:lessonId', updateAccessToken, isAuthenticated, updateLesson);

/**
 * ..swagger
 * /api/lesson/delete/{lessonId}:
 *   delete:
 *     summary: Delete a lesson
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: lessonId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the lesson
 *     responses:
 *       200:
 *         description: Lesson deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 */

router.delete(
    '/delete/:lessonId',
    updateAccessToken,
    isAuthenticated,
    ensureLessonDeletable({ allowAdminOverride: true }),
    deleteLesson
);

/**
 * ..swagger
 * /api/lesson/reorder/{sectionId}:
 *   put:
 *     summary: Reorder lessons in a section
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sectionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the section
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lessons
 *             properties:
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
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 */

router.put(
    '/reorder/:sectionId',
    updateAccessToken,
    isAuthenticated,
    reorderLesson
);

/**
 * ..swagger
 * /api/lesson/publish/{lessonId}:
 *   put:
 *     summary: Publish a lesson
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: lessonId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the lesson
 *     responses:
 *       200:
 *         description: Lesson published successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 */

router.put('/publish/:lessonId', updateAccessToken, isAuthenticated, publishLesson);

/**
 * ..swagger
 * /api/lesson/unpublish/{lessonId}:
 *   put:
 *     summary: Unpublish a lesson
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: lessonId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the lesson
 *     responses:
 *       200:
 *         description: Lesson unpublished successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 */

router.put('/unpublish/:lessonId', updateAccessToken, isAuthenticated, unpublishLesson);

export default router;

/**
 * ..swagger
 * /api/courses/upload-lesson-video/{id}:
 *   put:
 *     summary: Upload lesson video
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - sectionId
 *               - lessonId
 *               - video
 *             properties:
 *               sectionId:
 *                 type: string
 *               lessonId:
 *                 type: string
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Video uploaded successfully
 *       401:
 *         description: Not authenticated
 */
router.put(
    '/upload-lesson-video/',
    updateAccessToken,
    isAuthenticated,
    upload.single('video'),
    uploadLessonVideo
);