import express from 'express';
import {
    addEmployeeByEmail,
    assignCourseToEmployee,
    getBusinessById,
    getBusinessStatistics,
    getCourseDetailWithLearners,
    getEmployeeList,
    getEmployeesInBusiness,
    getUnassignedEmployeesForCourse,
    importEmployeesFromExcel,
    removeEmployeeFromBusiness,
    upgradeEmployeeRole,
    getAllBusinesses,
    getBusinessStatisticsForAdmin
} from '../controllers/business.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { updateAccessToken } from '../controllers/user.controller';
import { authorizeBusinessRoles, authorizeRoles } from '../middlewares/auth/authorizeRoles';
import upload from '../../uploads/upload';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Business
 *   description: Business management APIs
 */

/**
 * @swagger
 * /api/business/{businessId}/add-employee:
 *   post:
 *     summary: Add an employee to a business by email (Business Admin only)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the business
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 example: employee@example.com
 *               role:
 *                 type: string
 *                 example: Manager
 *     responses:
 *       200:
 *         description: User added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User employee@example.com added to business as Manager
 *       400:
 *         description: Bad request (missing fields or already in business)
 *       404:
 *         description: User or business not found
 */
router.post(
    '/:businessId/add-employee',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    addEmployeeByEmail
);

/**
 * @swagger
 * /api/business/{businessId}/employees/import:
 *   post:
 *     summary: Import multiple employees from Excel file (Business Admin only)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the business to import employees into
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx) containing list of employee emails and roles
 *     responses:
 *       200:
 *         description: Employees imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 imported:
 *                   type: integer
 *                   example: 8
 *                 skipped:
 *                   type: integer
 *                   example: 2
 *                 message:
 *                   type: string
 *                   example: Successfully imported 8 employees, 2 were skipped due to errors
 *       400:
 *         description: Invalid file format or missing data in rows
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - only business admin can perform this action
 *       404:
 *         description: Business not found
 */
router.post(
    '/:businessId/employees/import',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    upload.single('file'),
    importEmployeesFromExcel
);

/**
 * @swagger
 * /api/business/{businessId}/employees/{employeeId}/assign-course:
 *   post:
 *     summary: Assign a course to an employee (Admin/Manager only)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the business
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the employee to assign the course to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - startDate
 *               - dueDate
 *             properties:
 *               courseId:
 *                 type: string
 *                 example: 665e4c47f7a91e0d0f5489f3
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-06-21
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-07-21
 *     responses:
 *       200:
 *         description: Course assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Course assigned to employee John Doe
 *       400:
 *         description: Missing required fields or course already assigned
 *       404:
 *         description: Business, course, or employee not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - only admin or manager can perform this action
 */
router.post(
    '/:businessId/employees/:employeeId/assign-course',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    assignCourseToEmployee
);

/**
 * @swagger
 * /api/business/me:
 *   get:
 *     summary: Get detailed information of the business the current user belongs to
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 business:
 *                   type: object
 *       400:
 *         description: Business ID not found in user info
 *       404:
 *         description: Business not found
 *       401:
 *         description: Unauthorized
 */
router.get('/me', updateAccessToken, isAuthenticated, authorizeBusinessRoles('admin', 'manager'), getBusinessById);

/**
 * @swagger
 * /api/business/{businessId}/employees:
 *   get:
 *     summary: Get list of employees (role = employee) in the business
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the business
 *     responses:
 *       200:
 *         description: List of employees retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 employees:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                       role:
 *                         type: string
 *                         example: employee
 *       404:
 *         description: Business not found
 */
router.get(
    '/:businessId/employees',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    getEmployeeList
);

/**
 * @swagger
 * /api/business/{businessId}/employees/{employeeId}/up-role:
 *   put:
 *     summary: Promote an employee to manager (admin only)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the business
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the employee to upgrade
 *     responses:
 *       200:
 *         description: Role upgraded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Employee role updated to manager
 *       400:
 *         description: Already a manager or invalid data
 *       404:
 *         description: Business or employee not found
 *       403:
 *         description: Forbidden - only admin can perform this action
 */
router.put(
    '/:businessId/employees/:employeeId/up-role',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin'),
    upgradeEmployeeRole
);

/**
 * @swagger
 * /api/business/{businessId}/visible-employees:
 *   get:
 *     summary: Get list of employees visible to current user (admin sees manager + employee, manager sees employee)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the business
 *     responses:
 *       200:
 *         description: List of visible employees retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 employees:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "60c72b2f5f1b2c001cfbfa12"
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john@example.com"
 *                           avatar:
 *                             type: string
 *                             example: "https://example.com/avatar.jpg"
 *                       role:
 *                         type: string
 *                         example: "employee"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-07-19T14:23:45.000Z"
 *       403:
 *         description: Forbidden - user has no access
 *       404:
 *         description: Business not found
 */

router.get(
    '/:businessId/visible-employees',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    getEmployeesInBusiness
);

/**
 * @swagger
 * /api/business/{businessId}/employees/{employeeId}:
 *   delete:
 *     summary: Remove an employee from a business (admin can remove manager/employee, manager can remove employee)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the business
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the employee to remove
 *     responses:
 *       200:
 *         description: Employee removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Employee removed from business successfully
 *       400:
 *         description: Cannot remove yourself or invalid request
 *       403:
 *         description: You do not have permission to remove this employee
 *       404:
 *         description: Business or employee not found
 */
router.delete(
    '/:businessId/employees/:employeeId',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    removeEmployeeFromBusiness
);

/**
 * @swagger
 * /api/business/{businessId}/statistics:
 *   get:
 *     summary: Get business statistics (total employees, managers, courses, and monthly stats)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the business to retrieve statistics for
 *     responses:
 *       200:
 *         description: Business statistics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 totalEmployees:
 *                   type: number
 *                   example: 10
 *                 totalManagers:
 *                   type: number
 *                   example: 3
 *                 totalCourses:
 *                   type: number
 *                   example: 5
 *                 employeeMonthlyData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         example: Jan
 *                       value:
 *                         type: number
 *                         example: 2
 *                 managerMonthlyData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         example: Jan
 *                       value:
 *                         type: number
 *                         example: 1
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a business member
 *       404:
 *         description: Business not found
 */
router.get(
    '/:businessId/statistics',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    getBusinessStatistics
);

/**
 * @swagger
 * /api/business/courses/{courseId}/detail:
 *   get:
 *     summary: Get course details and learners assigned to the course in the current user's business
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the course
 *     responses:
 *       200:
 *         description: Course detail and list of learners retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     course:
 *                       type: object
 *                       description: Detailed information about the course
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         subTitle:
 *                           type: string
 *                         thumbnail:
 *                           type: object
 *                           properties:
 *                             url:
 *                               type: string
 *                         purchased:
 *                           type: number
 *                         author:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             email:
 *                               type: string
 *                             profession:
 *                               type: string
 *                         rating:
 *                           type: number
 *                         price:
 *                           type: number
 *                         isPublished:
 *                           type: boolean
 *                         isFree:
 *                           type: boolean
 *                         createdAt:
 *                           type: string
 *                         updatedAt:
 *                           type: string
 *                     learners:
 *                       type: array
 *                       description: List of learners assigned to the course
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           avatar:
 *                             type: object
 *                             properties:
 *                               url:
 *                                 type: string
 *                           status:
 *                             type: string
 *                             example: Learning
 *                           enrollmentDate:
 *                             type: string
 *                             example: 05 Jan, 2025
 *                           progress:
 *                             type: number
 *                             example: 50
 *                           lastOpenedContent:
 *                             type: string
 *                           quizResults:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 quizId:
 *                                   type: string
 *                                 quizName:
 *                                   type: string
 *                                 status:
 *                                   type: string
 *                                 totalAssignment:
 *                                   type: number
 *                                 maxAssignment:
 *                                   type: number
 *                                 totalScore:
 *                                   type: number
 *                                 maxScore:
 *                                   type: number
 *       400:
 *         description: Business ID not found from user
 *       404:
 *         description: Course or business not found, or course not assigned to business
 *       401:
 *         description: Unauthorized
 */

router.get(
    '/courses/:courseId/detail',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    getCourseDetailWithLearners
);

/**
 * @swagger
 * /api/business/courses/{courseId}/unassigned-employees:
 *   get:
 *     summary: Get list of employees who are NOT assigned to the given course in the current business
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the course
 *     responses:
 *       200:
 *         description: List of unassigned employees retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 employees:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       avatar:
 *                         type: object
 *                         properties:
 *                           url:
 *                             type: string
 *       400:
 *         description: Business ID not found in user
 *       404:
 *         description: Course or business not found
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/courses/:courseId/unassigned-employees',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    getUnassignedEmployeesForCourse
);

/**
 * @swagger
 * /api/business/all:
 *   get:
 *     summary: Get all businesses in database (Admin only)
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of businesses per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for business name, description, email, address, or sector
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *         description: Filter by verification status
 *     responses:
 *       200:
 *         description: List of businesses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       businessName:
 *                         type: string
 *                       description:
 *                         type: string
 *                       email:
 *                         type: string
 *                       address:
 *                         type: string
 *                       businessSector:
 *                         type: string
 *                       isVerified:
 *                         type: boolean
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       employees:
 *                         type: array
 *                         items:
 *                           type: object
 *                       courses:
 *                         type: array
 *                         items:
 *                           type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     totalBusinesses:
 *                       type: integer
 *                       example: 50
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *                     limit:
 *                       type: integer
 *                       example: 10
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
    '/all',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('admin'),
    getAllBusinesses
);

/**
 * @swagger
 * /api/business/admin/statistics:
 *   get:
 *     summary: Get business statistics for admin dashboard (Admin only)
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBusinesses:
 *                       type: integer
 *                       example: 150
 *                     verifiedBusinesses:
 *                       type: integer
 *                       example: 120
 *                     unverifiedBusinesses:
 *                       type: integer
 *                       example: 30
 *                     recentBusinesses:
 *                       type: integer
 *                       example: 15
 *                     sectorStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "Technology"
 *                           count:
 *                             type: integer
 *                             example: 45
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
    '/admin/statistics',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('admin'),
    getBusinessStatisticsForAdmin
);

export default router;
