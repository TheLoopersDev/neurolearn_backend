import express, { RequestHandler } from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import {
    addAnswer,
    addQuestion,
    addReplyToReview,
    addReview,
    deleteCourse,
    getAllCourses,
    getAllCoursesWithoutPurchase,
    getCoursesLimitWithPagination,
    getPurchasedCourseByUser,
    getSingleCourse,
    getTopCourses,
    updateCourse,
    uploadCourse,
    getCourseStatistics,
    getCoursesByUser,
    searchCoursesAndInstructors,
    getUploadedCourseByInstructor,
    updateLesson,
    uploadLessonVideo,
    generateVideoCloudinarySignature,
    getSignatureForDelete,
    deleteLesson,
    publishLesson,
    unPublishLesson,
    publishSection,
    unpublishSection,
    deleteSection,
    publishCourse,
    unpublishCourse,
    getAllUploadedAndPurchasedCoursesOfInstructor,
    getAllPurchasedCoursesOfUser,
    getCoursesWithSort
} from '../controllers/course.controller';
import { getUserInfo, updateAccessToken } from '../controllers/user.controller';
import { createSection, updateSection } from '@/controllers/section.controller';

/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: Course management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/courses/user-courses:
 *   get:
 *     summary: Get courses by user
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's courses
 *       401:
 *         description: Not authenticated
 */
router.get('/user-courses', updateAccessToken, isAuthenticated, getCoursesByUser, getUserInfo);

/**
 * @swagger
 * /api/courses/sort:
 *   get:
 *     summary: Get sorted courses
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [rating, students, price]
 *     responses:
 *       200:
 *         description: Sorted list of courses
 */
router.get('/sort', getCoursesWithSort as RequestHandler);

/**
 * @swagger
 * /api/courses/create-course:
 *   post:
 *     summary: Create a new course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - price
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *     responses:
 *       201:
 *         description: Course created successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/create-course', updateAccessToken, isAuthenticated, uploadCourse);

/**
 * @swagger
 * /api/courses/update-course/{id}:
 *   put:
 *     summary: Update course information
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Course not found
 */
router.put('/update-course/:id', updateAccessToken, isAuthenticated, updateCourse);

/**
 * @swagger
 * /api/courses/publish-course/{id}:
 *   put:
 *     summary: Publish a course
 *     tags: [Courses]
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
 *         description: Course published successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Course not found
 */
router.put('/publish-course/:id', updateAccessToken, isAuthenticated, publishCourse);

/**
 * @swagger
 * /api/courses/unpublish-course/{id}:
 *   put:
 *     summary: Unpublish a course
 *     tags: [Courses]
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
 *         description: Course unpublished successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Course not found
 */
router.put('/unpublish-course/:id', updateAccessToken, isAuthenticated, unpublishCourse);

/**
 * @swagger
 * /api/courses/pagination:
 *   get:
 *     summary: Get paginated courses
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Paginated list of courses
 */
router.get('/pagination', getCoursesLimitWithPagination);

/**
 * @swagger
 * /api/courses/search:
 *   post:
 *     summary: Search courses and instructors
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchTerm
 *             properties:
 *               searchTerm:
 *                 type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/search', searchCoursesAndInstructors);

/**
 * @swagger
 * /api/courses/top-courses:
 *   get:
 *     summary: Get top rated courses
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: List of top rated courses
 */
router.get('/top-courses', getTopCourses);

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Get course by ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course details
 *       404:
 *         description: Course not found
 */
router.get('/:id', getSingleCourse);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Get all courses without purchase
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: List of all courses
 */
router.get('/', getAllCoursesWithoutPurchase);

/**
 * @swagger
 * /api/courses/purchased/my-course:
 *   get:
 *     summary: Get all purchased courses of current user
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of purchased courses
 *       401:
 *         description: Not authenticated
 */
router.get('/purchased/my-course', updateAccessToken, isAuthenticated, getAllPurchasedCoursesOfUser);

/**
 * @swagger
 * /api/courses/purchased/{id}:
 *   get:
 *     summary: Get purchased course by ID
 *     tags: [Courses]
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
 *         description: Purchased course details
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Course not found
 */
router.get('/purchased/:id', updateAccessToken, isAuthenticated, getPurchasedCourseByUser);

/**
 * @swagger
 * /api/courses/uploaded/{id}:
 *   get:
 *     summary: Get uploaded course by instructor
 *     tags: [Courses]
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
 *         description: Uploaded course details
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Course not found
 */
router.get('/uploaded/:id', updateAccessToken, isAuthenticated, getUploadedCourseByInstructor);

/**
 * @swagger
 * /api/courses/instructor/all:
 *   get:
 *     summary: Get all uploaded and purchased courses of instructor
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of instructor's courses
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.get(
    '/instructor/all',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('instructor', 'user'),
    getAllUploadedAndPurchasedCoursesOfInstructor
);

/**
 * @swagger
 * /api/courses/add-question:
 *   put:
 *     summary: Add question to course
 *     tags: [Courses]
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
 *               - content
 *             properties:
 *               courseId:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Question added successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/add-question', updateAccessToken, isAuthenticated, addQuestion);

/**
 * @swagger
 * /api/courses/add-answer:
 *   put:
 *     summary: Add answer to question
 *     tags: [Courses]
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
 *               - questionId
 *               - answer
 *             properties:
 *               courseId:
 *                 type: string
 *               questionId:
 *                 type: string
 *               answer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Answer added successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/add-answer', updateAccessToken, isAuthenticated, addAnswer);

/**
 * @swagger
 * /api/courses/add-review/{id}:
 *   put:
 *     summary: Add review to course
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
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review added successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/add-review/:id', updateAccessToken, isAuthenticated, addReview);

/**
 * @swagger
 * /api/courses/add-reply:
 *   put:
 *     summary: Add reply to review
 *     tags: [Courses]
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
 *               - reviewId
 *               - reply
 *             properties:
 *               courseId:
 *                 type: string
 *               reviewId:
 *                 type: string
 *               reply:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply added successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/add-reply', updateAccessToken, isAuthenticated, addReplyToReview);

/**
 * @swagger
 * /api/courses/get-courses:
 *   get:
 *     summary: Get all courses (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all courses
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.get('/get-courses', isAuthenticated, authorizeRoles('admin'), getAllCourses);

/**
 * @swagger
 * /api/courses/delete-course/{id}:
 *   delete:
 *     summary: Delete course
 *     tags: [Courses]
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
 *         description: Course deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 */
router.delete(
    '/delete-course/:id',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('instructor', 'admin'),
    deleteCourse
);

/**
 * @swagger
 * /api/courses/create-section/{id}:
 *   put:
 *     summary: Create new section in course
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
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Section created successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/create-section/:id', updateAccessToken, isAuthenticated, createSection);

/**
 * @swagger
 * /api/courses/reorder-section/{id}:
 *   put:
 *     summary: Reorder sections in course
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
 *               - sections
 *             properties:
 *               sections:
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
 *         description: Sections reordered successfully
 *       401:
 *         description: Not authenticated
 */

router.put('/update-section/:id', updateAccessToken, isAuthenticated, updateSection);

/**
 * @swagger
 * /api/courses/update-lesson/{id}:
 *   put:
 *     summary: Update lesson
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
 *               - lessonId
 *               - title
 *             properties:
 *               sectionId:
 *                 type: string
 *               lessonId:
 *                 type: string
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lesson updated successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/update-lesson/:id', updateAccessToken, isAuthenticated, updateLesson);

/**
 * @swagger
 * /api/courses/delete-lesson/{id}:
 *   put:
 *     summary: Delete lesson
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
 *               - lessonId
 *             properties:
 *               sectionId:
 *                 type: string
 *               lessonId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lesson deleted successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/delete-lesson/:id', updateAccessToken, isAuthenticated, deleteLesson);

/**
 * @swagger
 * /api/courses/publish-lesson/{id}:
 *   put:
 *     summary: Publish lesson
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
 *               - lessonId
 *             properties:
 *               sectionId:
 *                 type: string
 *               lessonId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lesson published successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/publish-lesson/:id', updateAccessToken, isAuthenticated, publishLesson);

/**
 * @swagger
 * /api/courses/unpublish-lesson/{id}:
 *   put:
 *     summary: Unpublish lesson
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
 *               - lessonId
 *             properties:
 *               sectionId:
 *                 type: string
 *               lessonId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lesson unpublished successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/unpublish-lesson/:id', updateAccessToken, isAuthenticated, unPublishLesson);

/**
 * @swagger
 * /api/courses/publish-section/{id}:
 *   put:
 *     summary: Publish section
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
 *             properties:
 *               sectionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Section published successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/publish-section/:id', updateAccessToken, isAuthenticated, publishSection);

/**
 * @swagger
 * /api/courses/unpublish-section/{id}:
 *   put:
 *     summary: Unpublish section
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
 *             properties:
 *               sectionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Section unpublished successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/unpublish-section/:id', updateAccessToken, isAuthenticated, unpublishSection);

/**
 * @swagger
 * /api/courses/delete-section/{id}:
 *   put:
 *     summary: Delete section
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
 *             properties:
 *               sectionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Section deleted successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/delete-section/:id', updateAccessToken, isAuthenticated, deleteSection);

/**
 * @swagger
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
router.put('/upload-lesson-video/:id', updateAccessToken, isAuthenticated, uploadLessonVideo);

/**
 * @swagger
 * /api/courses/sign-upload:
 *   post:
 *     summary: Get signature for video upload
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signature generated successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/sign-upload', generateVideoCloudinarySignature);

/**
 * @swagger
 * /api/courses/sign-delete:
 *   post:
 *     summary: Get signature for video deletion
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signature generated successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/sign-delete', getSignatureForDelete);

export = router;
