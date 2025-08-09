import express, { RequestHandler } from 'express';
import {
    activateUser,
    deleteUser,
    getAllInstructors,
    getAllUsers,
    getInstructorsWithSort,
    getUserInfo,
    loginUser,
    logoutUser,
    registrationUser,
    socialAuth,
    updateAccessToken,
    updatePassword,
    updateProfilePicture,
    updateUserInfo,
    updateUserRole,
    forgotPasswordUser,
    resetCodeVerify,
    resetPassword,
    refreshToken,
    updateUserSocialLinks,
    getUser,
    getTopInstructors,
    getUserDashboardData,
    getUserPurchasedCoursesMobile
} from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/register', registrationUser);

/**
 * @swagger
 * /api/users/activate-user:
 *   post:
 *     summary: Activate user account
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activation_token
 *               - activation_code
 *             properties:
 *               activation_token:
 *                 type: string
 *               activation_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: User activated successfully
 *       400:
 *         description: Invalid activation token
 */
router.post('/activate-user', activateUser);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginUser);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get('/me', updateAccessToken, isAuthenticated, getUserInfo);

/**
 * @swagger
 * /api/users/update-user:
 *   put:
 *     summary: Update user information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/update-user', updateAccessToken, isAuthenticated, updateUserInfo);

/**
 * @swagger
 * /api/users/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset code sent to email
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', forgotPasswordUser);

/**
 * @swagger
 * /api/users/resetcode-verify:
 *   post:
 *     summary: Verify reset code
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetCode
 *             properties:
 *               resetCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset code verified successfully
 *       400:
 *         description: Invalid reset code
 */
router.post('/resetcode-verify', resetCodeVerify);

/**
 * @swagger
 * /api/users/reset-password:
 *   put:
 *     summary: Reset password
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmPassword
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid input data
 */
router.put('/reset-password', resetPassword);

/**
 * @swagger
 * /api/users/logout:
 *   get:
 *     summary: Logout user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/logout', updateAccessToken, isAuthenticated, logoutUser);

/**
 * @swagger
 * /api/users/refresh:
 *   get:
 *     summary: Refresh access token
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 */
router.get('/refresh', refreshToken);

/**
 * @swagger
 * /api/users/social-auth:
 *   post:
 *     summary: Social media authentication
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - avatar
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               avatar:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *     responses:
 *       200:
 *         description: Social auth successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.post('/social-auth', socialAuth);

/**
 * @swagger
 * /api/users/update-password:
 *   put:
 *     summary: Update user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       401:
 *         description: Not authenticated or invalid password
 */
router.put('/update-password', updateAccessToken, isAuthenticated, updatePassword);

/**
 * @swagger
 * /api/users/update-avatar:
 *   put:
 *     summary: Update user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/update-avatar', updateAccessToken, isAuthenticated, updateProfilePicture);

/**
 * @swagger
 * /api/users/update-link:
 *   put:
 *     summary: Update user social links
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               facebook:
 *                 type: string
 *               twitter:
 *                 type: string
 *               linkedin:
 *                 type: string
 *               instagram:
 *                 type: string
 *     responses:
 *       200:
 *         description: Social links updated successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/update-link', updateAccessToken, isAuthenticated, updateUserSocialLinks);

/**
 * @swagger
 * /api/users/get-users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.get('/get-users', isAuthenticated, authorizeRoles('admin'), getAllUsers);

/**
 * @swagger
 * /api/users/top-instructors:
 *   get:
 *     summary: Get top rated instructors
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of top instructors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/top-instructors', getTopInstructors);

/**
 * @swagger
 * /api/users/get-instructors:
 *   get:
 *     summary: Get all instructors
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of all instructors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/get-instructors', getAllInstructors);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get('/:id', getUser);

/**
 * @swagger
 * /api/users/instructors/sort:
 *   get:
 *     summary: Get sorted instructors
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [rating, students, courses]
 *     responses:
 *       200:
 *         description: Sorted list of instructors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/instructors/sort', getInstructorsWithSort as RequestHandler);

/**
 * @swagger
 * /api/users/update-role:
 *   put:
 *     summary: Update user role (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - role
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, admin, instructor]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.put('/update-role', isAuthenticated, authorizeRoles('admin'), updateUserRole);

/**
 * @swagger
 * /api/users/delete-user/{id}:
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [Users]
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
 *         description: User deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.delete('/delete-user:id', isAuthenticated, authorizeRoles('admin'), deleteUser);

/**
 * @swagger
 * /api/users/dashboard/{userId}:
 *   get:
 *     summary: Get all dashboard data for a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           description: User ID
 *     responses:
 *       200:
 *         description: User dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   description: Thống kê tổng quan
 *                 latestCourse:
 *                   type: object
 *                   description: Khóa học gần nhất
 *                 relatedCourses:
 *                   type: array
 *                   items:
 *                     type: object
 *                 studentStats:
 *                   type: array
 *                   items:
 *                     type: object
 *                 upcomingExams:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.get('/dashboard/:userId', updateAccessToken, isAuthenticated, getUserDashboardData);

router.get('/purchase-course-mobile', getUserPurchasedCoursesMobile);

export = router;
