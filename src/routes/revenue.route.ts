import express from 'express';
import * as revenueController from '../controllers/revenue.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

const router = express.Router();

/**
 * @swagger
 * /api/revenue:
 *   get:
 *     summary: Lấy doanh thu của giáo viên
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: (Admin) Xem doanh thu của instructor khác
 *     responses:
 *       200:
 *         description: Doanh thu của giáo viên
 *       401:
 *         description: Chưa xác thực
 */
router.get('/', isAuthenticated, revenueController.getRevenueByUser);

/**
 * @swagger
 * /api/revenue/income/me:
 *   get:
 *     summary: Lấy thu nhập của giáo viên hiện tại
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thu nhập của giáo viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 income:
 *                   type: number
 *       401:
 *         description: Chưa xác thực
 */
router.get('/income/me', isAuthenticated, revenueController.getMyIncome);

/**
 * @swagger
 * /api/revenue/income/{userId}:
 *   get:
 *     summary: (Admin) Xem thu nhập của giáo viên khác
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của giáo viên cần xem thu nhập
 *     responses:
 *       200:
 *         description: Thu nhập của giáo viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 income:
 *                   type: number
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.get('/income/:userId', isAuthenticated, authorizeRoles('admin'), revenueController.getInstructorIncomeById);

/**
 * @swagger
 * /api/revenue/submission/me:
 *   get:
 *     summary: Lấy submission (10%) của revenue của giáo viên hiện tại
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Submission amount của giáo viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 submission:
 *                   type: number
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa xác thực
 */
router.get('/submission/me', isAuthenticated, revenueController.getMySubmission);

/**
 * @swagger
 * /api/revenue/submission/{userId}:
 *   get:
 *     summary: (Admin) Xem submission (10%) của revenue của giáo viên khác
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của giáo viên cần xem submission
 *     responses:
 *       200:
 *         description: Submission amount của giáo viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 submission:
 *                   type: number
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.get('/submission/:userId', isAuthenticated, authorizeRoles('admin'), revenueController.getInstructorSubmissionById);

/**
 * @swagger
 * /api/revenue/detailed/me:
 *   get:
 *     summary: Lấy thông tin chi tiết về revenue và submission của giáo viên hiện tại
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin chi tiết về revenue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: Tổng revenue
 *                     submission:
 *                       type: number
 *                       description: Submission amount (10%)
 *                     netIncome:
 *                       type: number
 *                       description: Thu nhập thực tế (total - submission)
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa xác thực
 */
router.get('/detailed/me', isAuthenticated, revenueController.getMyDetailedRevenue);

/**
 * @swagger
 * /api/revenue/detailed/{userId}:
 *   get:
 *     summary: (Admin) Xem thông tin chi tiết về revenue và submission của giáo viên khác
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của giáo viên cần xem thông tin chi tiết
 *     responses:
 *       200:
 *         description: Thông tin chi tiết về revenue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: Tổng revenue
 *                     submission:
 *                       type: number
 *                       description: Submission amount (10%)
 *                     netIncome:
 *                       type: number
 *                       description: Thu nhập thực tế (total - submission)
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.get('/detailed/:userId', isAuthenticated, authorizeRoles('admin'), revenueController.getInstructorDetailedRevenueById);

/**
 * @swagger
 * /api/revenue/simple-submissions:
 *   get:
 *     summary: Simple submissions API for testing
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Simple submissions data
 */
router.get('/simple-submissions', isAuthenticated, authorizeRoles('admin'), revenueController.simpleAllSubmissions);

/**
 * @swagger
 * /api/revenue/test:
 *   get:
 *     summary: Test API endpoint
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test response
 */
router.get('/test', isAuthenticated, revenueController.testAllSubmissions);

/**
 * @swagger
 * /api/revenue/all-submissions:
 *   get:
 *     summary: (Admin) Lấy submission của toàn bộ instructor
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng item trên mỗi trang
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [submission, total, available, withdrawn]
 *           default: submission
 *         description: Sắp xếp theo field nào
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Danh sách submission của tất cả instructor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     submissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           userName:
 *                             type: string
 *                           userEmail:
 *                             type: string
 *                           userAvatar:
 *                             type: string
 *                             nullable: true
 *                           total:
 *                             type: number
 *                           submission:
 *                             type: number
 *                           netIncome:
 *                             type: number
 *                           withdrawn:
 *                             type: number
 *                           available:
 *                             type: number
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalItems:
 *                           type: integer
 *                         itemsPerPage:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập (chỉ admin)
 */
router.get('/all-submissions', isAuthenticated, authorizeRoles('admin'), revenueController.getAllInstructorsSubmissions);

/**
 * @swagger
 * /api/revenue/submission-statistics:
 *   get:
 *     summary: (Admin) Lấy thống kê tổng quan về submission
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê tổng quan về submission
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue:
 *                       type: number
 *                       description: Tổng revenue của tất cả instructor
 *                     totalSubmission:
 *                       type: number
 *                       description: Tổng submission (10% của total revenue)
 *                     totalWithdrawn:
 *                       type: number
 *                       description: Tổng số tiền đã rút
 *                     totalAvailable:
 *                       type: number
 *                       description: Tổng số tiền có thể rút
 *                     activeInstructors:
 *                       type: integer
 *                       description: Số instructor có revenue > 0
 *                     totalInstructors:
 *                       type: integer
 *                       description: Tổng số instructor
 *                     averageSubmission:
 *                       type: number
 *                       description: Submission trung bình mỗi instructor
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập (chỉ admin)
 */
router.get('/submission-statistics', isAuthenticated, authorizeRoles('admin'), revenueController.getSubmissionStats);

/**
 * @swagger
 * /api/revenue/submissions-summary:
 *   get:
 *     summary: (Admin) Lấy tổng quan submission với top instructor
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: top
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng top instructor muốn xem
 *     responses:
 *       200:
 *         description: Tổng quan submission với top instructor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     topSubmissions:
 *                       type: array
 *                       description: Danh sách top instructor theo submission
 *                       items:
 *                         type: object
 *                     statistics:
 *                       type: object
 *                       description: Thống kê tổng quan
 *                     summary:
 *                       type: object
 *                       properties:
 *                         topEarners:
 *                           type: integer
 *                         totalInstructors:
 *                           type: integer
 *                         activeInstructors:
 *                           type: integer
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập (chỉ admin)
 */
router.get('/submissions-summary', isAuthenticated, authorizeRoles('admin'), revenueController.getSubmissionsSummary);

export default router; 