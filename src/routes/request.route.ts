import express from 'express';
import {
    createCourseApprovalRequest,
    getAllPendingRequests,
    getCourseApprovalRequestByCourseId,
    handleRequestActionCourse,
    createBusinessVerificationRequest,
    handleRequestActionBusiness,
    createInstructorVerificationRequest,
    handleRequestActionInstructor,
    getAllInstructorCourseRequest,
    updateCourseApprovalRequest,
    cleanupProcessedRequests,
    forceCleanupAllRequests,
    forceCleanupDeletedRequests,
    getRequestStatistics
} from '../controllers/request.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import { updateAccessToken } from '../controllers/user.controller';
import { businessUpload } from '../middlewares/upload';

/**
 * @swagger
 * tags:
 *   name: Request
 *   description: Course and Business approval request endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/request/create-request-course:
 *   post:
 *     summary: Create a course approval request (Instructor only)
 *     tags: [Request]
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
 *               - userId
 *             properties:
 *               courseId:
 *                 type: string
 *                 example: "664e2c34ad4..."
 *               userId:
 *                 type: string
 *                 example: "663a1c9fef4..."
 *               message:
 *                 type: string
 *                 example: "Please approve my course."
 *     responses:
 *       201:
 *         description: Request created successfully
 *       400:
 *         description: Bad request or request already pending
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/create-request-course',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('instructor'),
    createCourseApprovalRequest
);

/**
 * @swagger
 * /api/request/create-request-business:
 *   post:
 *     summary: Create a business verification request  (User only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessName
 *             properties:
 *               businessName:
 *                 type: string
 *                 example: "OpenAI Corp"
 *               description:
 *                 type: string
 *                 example: "An AI research company"
 *     responses:
 *       201:
 *         description: Business verification request created
 *       400:
 *         description: Bad request or already pending
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/create-request-business',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('user'),
    createBusinessVerificationRequest
);

/**
 * @swagger
 * /api/request/get-request/{courseId}:
 *   get:
 *     summary: Get course approval request by course ID (Instructor only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request found
 *       400:
 *         description: Course ID is required
 *       404:
 *         description: Request not found
 */
router.get(
    '/get-request/:courseId',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('instructor'),
    getCourseApprovalRequestByCourseId
);

/**
 * @swagger
 * /api/request/get-request-pending:
 *   get:
 *     summary: Get all pending requests (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [course_approval, business_verification, instructor_verification]
 *     responses:
 *       200:
 *         description: List of pending requests
 *       404:
 *         description: No pending requests found
 */
router.get('/get-request-pending', isAuthenticated, authorizeRoles('admin'), getAllPendingRequests);

/**
 * @swagger
 * /api/request/handle-request-course/{requestId}:
 *   put:
 *     summary: Approve or reject a course approval request (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *     responses:
 *       200:
 *         description: Request handled
 *       400:
 *         description: Invalid action
 *       404:
 *         description: Request not found
 */
router.put(
    '/handle-request-course/:requestId',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('admin'),
    handleRequestActionCourse
);

/**
 * @swagger
 * /api/request/handle-request-business/{requestId}:
 *   put:
 *     summary: Approve or reject a business verification request (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *     responses:
 *       200:
 *         description: Request handled
 *       400:
 *         description: Invalid action
 *       404:
 *         description: Request not found
 */
router.put(
    '/handle-request-business/:requestId',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('admin'),
    handleRequestActionBusiness
);

/**
 * @swagger
 * /api/request/instructor-verification:
 *   post:
 *     summary: Create a instructor verification request (User only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *               - dob
 *               - address
 *               - category
 *               - description
 *               - experience
 *               - role
 *               - company
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 example: "123-456-7890"
 *               dob:
 *                 type: string
 *                 example: "2000-01-01"
 *               address:
 *                 type: string
 *                 example: "123 Main St"
 *               category:
 *                 type: string
 *                 example: "Software Engineer"
 *               description:
 *                 type: string
 *                 example: "Experienced in full-stack development"
 *               experience:
 *                 type: string
 *                 example: "5 years"
 *               role:
 *                 type: string
 *                 example: "Software Engineer"
 *               company:
 *                 type: string
 *                 example: "Tech Corp"
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["/path/to/doc1.pdf", "/path/to/doc2.jpg"]
 *     responses:
 *       201:
 *         description: Instructor verification request created
 *       400:
 *         description: Bad request or already pending
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/instructor-verification',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('user'),
    createInstructorVerificationRequest
);

/**
 * @swagger
 * /api/request/instructor-verification/{requestId}/action:
 *   put:
 *     summary: Approve or reject a instructor verification request (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *     responses:
 *       200:
 *         description: Request handled
 *       400:
 *         description: Invalid action
 *       404:
 *         description: Request not found
 */
router.put(
    '/instructor-verification/:requestId/action',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('admin'),
    handleRequestActionInstructor
);

router.get(
    '/instructor/course-requests',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('instructor'),
    getAllInstructorCourseRequest
);

router.put('/update-course-approval-request', isAuthenticated, updateAccessToken, updateCourseApprovalRequest);


/**
 * @swagger
 * /api/request/cleanup-processed:
 *   delete:
 *     summary: Cleanup processed requests older than 24 hours (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup completed
 *       401:
 *         description: Unauthorized
 */
router.delete(
    '/cleanup-processed',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('admin'),
    cleanupProcessedRequests
);

/**
 * @swagger
 * /api/request/force-cleanup:
 *   delete:
 *     summary: Force cleanup all approved/rejected/processed requests (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Force cleanup completed
 *       401:
 *         description: Unauthorized
 */
router.delete('/force-cleanup', updateAccessToken, isAuthenticated, authorizeRoles('admin'), forceCleanupAllRequests);

/**
 * @swagger
 * /api/request/force-cleanup-deleted:
 *   delete:
 *     summary: Force cleanup all deleted requests immediately (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Force cleanup deleted requests completed
 *       401:
 *         description: Unauthorized
 */
router.delete(
    '/force-cleanup-deleted',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('admin'),
    forceCleanupDeletedRequests
);

/**
 * @swagger
 * /api/request/statistics:
 *   get:
 *     summary: Get request statistics (Admin only)
 *     tags: [Request]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request statistics
 *       401:
 *         description: Unauthorized
 */
router.get('/statistics', updateAccessToken, isAuthenticated, authorizeRoles('admin'), getRequestStatistics);

export = router;
