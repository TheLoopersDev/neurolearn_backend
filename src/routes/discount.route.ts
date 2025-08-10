import express from 'express';
import {
    createDiscount,
    getAllDiscounts,
    getDiscountById,
    updateDiscount,
    deleteDiscount,
    validateDiscountCode,
    getDiscountStatistics,
    getAvailableDiscounts
} from '../controllers/discount.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import { updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Discount
 *   description: Discount management APIs
 */

/**
 * @swagger
 * /api/discount/available:
 *   get:
 *     summary: Lấy danh sách mã giảm giá khả dụng
 *     description: |
 *       API này trả về danh sách các mã giảm giá mà người dùng hiện tại có thể sử dụng.
 *       Bao gồm:
 *         - Mã giảm giá công khai (`accessType: public`)
 *         - Mã giảm giá private nhưng user hoặc business của user được phép (`allowedUsers` hoặc `allowedBusinesses` chứa ID của user/business)
 *     tags:
 *       - Discount
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách mã giảm giá lấy thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 discounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Discount'
 *       400:
 *         description: Thiếu userId hoặc businessId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Missing userId or businessId
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi server
 */

router.get('/available', updateAccessToken, isAuthenticated, getAvailableDiscounts);

/**
 * @swagger
 * /api/discount:
 *   post:
 *     summary: Create a new discount (Admin only)
 *     tags: [Discount]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - discountType
 *               - amount
 *               - startDate
 *               - endDate
 *             properties:
 *               code:
 *                 type: string
 *                 example: "SUMMER2024"
 *                 description: Unique discount code
 *               name:
 *                 type: string
 *                 example: "Summer Sale 2024"
 *                 description: Discount name
 *               description:
 *                 type: string
 *                 example: "Get 20% off on all courses"
 *                 description: Discount description
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *                 example: "percentage"
 *                 description: Type of discount
 *               amount:
 *                 type: number
 *                 example: 20
 *                 description: Discount amount (percentage or fixed amount)
 *               maxDiscountAmount:
 *                 type: number
 *                 example: 100
 *                 description: Maximum discount amount for percentage discounts
 *               courseIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["60c72b2f5f1b2c001cfbfa12"]
 *                 description: Array of course IDs this discount applies to
 *               businessId:
 *                 type: string
 *                 example: "60c72b2f5f1b2c001cfbfa13"
 *                 description: Business ID this discount belongs to
 *               accessType:
 *                 type: string
 *                 enum: [public, private]
 *                 default: "public"
 *                 example: "public"
 *                 description: Access type of the discount
 *               allowedUsers:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["60c72b2f5f1b2c001cfbfa14"]
 *                 description: Array of user IDs allowed to use this discount
 *               allowedBusinesses:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["60c72b2f5f1b2c001cfbfa15"]
 *                 description: Array of business IDs allowed to use this discount
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-06-01T00:00:00.000Z"
 *                 description: Start date of discount validity
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-08-31T23:59:59.000Z"
 *                 description: End date of discount validity
 *               usageLimit:
 *                 type: number
 *                 example: 100
 *                 description: Maximum number of times this discount can be used
 *               minOrderAmount:
 *                 type: number
 *                 example: 50
 *                 description: Minimum order amount required to use this discount
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: Whether the discount is active
 *     responses:
 *       201:
 *         description: Discount created successfully
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
 *                   example: "Discount created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     name:
 *                       type: string
 *                     discountType:
 *                       type: string
 *                     amount:
 *                       type: number
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/', isAuthenticated, authorizeRoles('admin'), createDiscount);

/**
 * @swagger
 * /api/discount:
 *   get:
 *     summary: Get all discounts with pagination and filters (Admin only)
 *     tags: [Discount]
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
 *         description: Number of discounts per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for code, name, or description
 *       - in: query
 *         name: discountType
 *         schema:
 *           type: string
 *           enum: [percentage, fixed]
 *         description: Filter by discount type
 *       - in: query
 *         name: accessType
 *         schema:
 *           type: string
 *           enum: [public, private]
 *         description: Filter by access type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: businessId
 *         schema:
 *           type: string
 *         description: Filter by business ID
 *     responses:
 *       200:
 *         description: List of discounts retrieved successfully
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
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       discountType:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       isActive:
 *                         type: boolean
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       usedCount:
 *                         type: number
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalDiscounts:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/', isAuthenticated, authorizeRoles('admin'), getAllDiscounts);

/**
 * @swagger
 * /api/discount/{id}:
 *   get:
 *     summary: Get discount by ID (Admin only)
 *     tags: [Discount]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Discount ID
 *     responses:
 *       200:
 *         description: Discount details retrieved successfully
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
 *                     _id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     discountType:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     maxDiscountAmount:
 *                       type: number
 *                     courseIds:
 *                       type: array
 *                       items:
 *                         type: object
 *                     businessId:
 *                       type: object
 *                     accessType:
 *                       type: string
 *                     allowedUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                     allowedBusinesses:
 *                       type: array
 *                       items:
 *                         type: object
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     usageLimit:
 *                       type: number
 *                     usedCount:
 *                       type: number
 *                     minOrderAmount:
 *                       type: number
 *                     isActive:
 *                       type: boolean
 *       404:
 *         description: Discount not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/:id', isAuthenticated, authorizeRoles('admin'), getDiscountById);

/**
 * @swagger
 * /api/discount/{id}:
 *   put:
 *     summary: Update discount by ID (Admin only)
 *     tags: [Discount]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Discount ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: "SUMMER2024"
 *               name:
 *                 type: string
 *                 example: "Summer Sale 2024"
 *               description:
 *                 type: string
 *                 example: "Get 20% off on all courses"
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *               amount:
 *                 type: number
 *                 example: 20
 *               maxDiscountAmount:
 *                 type: number
 *                 example: 100
 *               courseIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               businessId:
 *                 type: string
 *               accessType:
 *                 type: string
 *                 enum: [public, private]
 *               allowedUsers:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedBusinesses:
 *                 type: array
 *                 items:
 *                   type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               usageLimit:
 *                 type: number
 *               minOrderAmount:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Discount updated successfully
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
 *                   example: "Discount updated successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request - validation error
 *       404:
 *         description: Discount not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.put('/:id', isAuthenticated, authorizeRoles('admin'), updateDiscount);

/**
 * @swagger
 * /api/discount/{id}:
 *   delete:
 *     summary: Delete discount by ID (Admin only)
 *     tags: [Discount]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Discount ID
 *     responses:
 *       200:
 *         description: Discount deleted successfully
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
 *                   example: "Discount deleted successfully"
 *       400:
 *         description: Bad request - cannot delete active discount that has been used
 *       404:
 *         description: Discount not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete('/:id', isAuthenticated, authorizeRoles('admin'), deleteDiscount);

/**
 * @swagger
 * /api/discount/validate:
 *   post:
 *     summary: Validate discount code (Public)
 *     tags: [Discount]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - orderAmount
 *             properties:
 *               code:
 *                 type: string
 *                 example: "SUMMER2024"
 *                 description: Discount code to validate
 *               courseId:
 *                 type: string
 *                 example: "60c72b2f5f1b2c001cfbfa12"
 *                 description: Course ID to check eligibility
 *               businessId:
 *                 type: string
 *                 example: "60c72b2f5f1b2c001cfbfa13"
 *                 description: Business ID for access check
 *               userId:
 *                 type: string
 *                 example: "60c72b2f5f1b2c001cfbfa14"
 *                 description: User ID for access check
 *               orderAmount:
 *                 type: number
 *                 example: 100
 *                 description: Order amount for discount calculation
 *     responses:
 *       200:
 *         description: Discount code validated successfully
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
 *                     discount:
 *                       type: object
 *                       description: Discount details
 *                     discountAmount:
 *                       type: number
 *                       example: 20
 *                       description: Calculated discount amount
 *                     finalAmount:
 *                       type: number
 *                       example: 80
 *                       description: Final amount after discount
 *                     originalAmount:
 *                       type: number
 *                       example: 100
 *                       description: Original order amount
 *       400:
 *         description: Bad request - invalid discount code or validation failed
 */
router.post('/validate', validateDiscountCode);

/**
 * @swagger
 * /api/discount/statistics:
 *   get:
 *     summary: Get discount statistics (Admin only)
 *     tags: [Discount]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Discount statistics retrieved successfully
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
 *                     totalDiscounts:
 *                       type: integer
 *                       example: 50
 *                       description: Total number of discounts
 *                     activeDiscounts:
 *                       type: integer
 *                       example: 30
 *                       description: Number of active discounts
 *                     expiredDiscounts:
 *                       type: integer
 *                       example: 15
 *                       description: Number of expired discounts
 *                     upcomingDiscounts:
 *                       type: integer
 *                       example: 5
 *                       description: Number of upcoming discounts
 *                     typeStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "percentage"
 *                           count:
 *                             type: integer
 *                             example: 35
 *                       description: Distribution by discount type
 *                     accessStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "public"
 *                           count:
 *                             type: integer
 *                             example: 40
 *                       description: Distribution by access type
 *                     mostUsedDiscounts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                             example: "SUMMER2024"
 *                           name:
 *                             type: string
 *                             example: "Summer Sale"
 *                           usedCount:
 *                             type: integer
 *                             example: 150
 *                       description: Top 5 most used discounts
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/statistics', isAuthenticated, authorizeRoles('admin'), getDiscountStatistics);

export default router;
