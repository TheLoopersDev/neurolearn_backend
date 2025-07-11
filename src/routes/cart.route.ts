import express from 'express';
import { addToCart, clearCart, getCartItems, removeCartItem } from '../controllers/cart.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Shopping cart management APIs
 */

/**
 * @swagger
 * /api/cart/add-to-cart:
 *   post:
 *     summary: Add a course to the cart
 *     tags: [Cart]
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
 *             properties:
 *               courseId:
 *                 type: string
 *                 example: 665e4c47f7a91e0d0f5489f3
 *               quantity:
 *                 type: integer
 *                 example: 5
 *                 description: Only required for business users (admin or manager)
 *     responses:
 *       201:
 *         description: Added to cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.post('/add-to-cart', updateAccessToken, isAuthenticated, addToCart);

/**
 * @swagger
 * /api/cart/clear-cart:
 *   post:
 *     summary: Clear all items in the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/clear-cart', updateAccessToken, isAuthenticated, clearCart);

/**
 * @swagger
 * /api/cart/cart-items:
 *   get:
 *     summary: Get all items in the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of cart items retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/cart-items', updateAccessToken, isAuthenticated, getCartItems);

/**
 * @swagger
 * /api/cart/remove-item:
 *   delete:
 *     summary: Remove a course from the cart
 *     tags: [Cart]
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
 *             properties:
 *               courseId:
 *                 type: string
 *                 example: 665e4c47f7a91e0d0f5489f3
 *     responses:
 *       200:
 *         description: Item removed from cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Course ID is required
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Item not found in cart or cart not found
 */
router.delete('/remove-item', updateAccessToken, isAuthenticated, removeCartItem);

export default router;
