import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import {
    createCategory,
    createSubCategory,
    getCategories,
    getCategory,
    getSubCategoriesByCategoryId,
    getAllCategoriesWithSubcategories,
    seedSubCategories
} from '../controllers/category.controller';

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of all categories
 */
router.get('/', getCategories);

/**
 * @swagger
 * /api/categories/all-with-subcategories:
 *   get:
 *     summary: Get all categories with their subcategories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of all categories with their subcategories
 */
router.get('/all-with-subcategories', getAllCategoriesWithSubcategories);

// TEMP/ADMIN: Seed default subcategories
router.post('/seed-subcategories', seedSubCategories);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 */
router.get('/:id', getCategory);

/**
 * @swagger
 * /api/categories/sub-category/{id}:
 *   get:
 *     summary: Get subcategories by category ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of subcategories
 *       404:
 *         description: Category not found
 */
router.get('/sub-category/:id', getSubCategoriesByCategoryId);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
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
 *       201:
 *         description: Category created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.post('/', isAuthenticated, authorizeRoles('admin'), createCategory);

/**
 * @swagger
 * /api/categories/{id}/sub-category:
 *   post:
 *     summary: Create a new subcategory (Admin only)
 *     tags: [Categories]
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
 *       201:
 *         description: Subcategory created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Category not found
 */
router.post('/:id/sub-category', isAuthenticated, authorizeRoles('admin'), createSubCategory);

export = router;
