import express from 'express';
import {
    addEmployeeByEmail,
    assignCourseToEmployee,
    getBusinessById,
    importEmployeesFromExcel
} from '../controllers/business.controller';
import { isAuthenticated } from '@/middlewares/auth/isAuthenticated';
import { updateAccessToken } from '@/controllers/user.controller';
import { authorizeBusinessRoles } from '@/middlewares/auth/authorizeRoles';
import upload from '@/utils/upload';

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
    authorizeBusinessRoles('admin'),
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
    authorizeBusinessRoles('admin'),
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
 * /api/business/{businessId}:
 *   get:
 *     summary: Get detailed information of a business
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the business to retrieve
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
 *       404:
 *         description: Business not found
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/:businessId',
    updateAccessToken,
    isAuthenticated,
    authorizeBusinessRoles('admin', 'manager'),
    getBusinessById
);

export default router;
