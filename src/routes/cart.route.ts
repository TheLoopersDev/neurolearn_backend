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
 *     summary: Add an item to the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *             required:
 *               - productId
 *               - quantity
 *     responses:
 *       200:
 *         description: Item added to cart successfully
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
 *     summary: Remove an item from the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *             required:
 *               - productId
 *     responses:
 *       200:
 *         description: Item removed successfully
 *       400:
 *         description: Invalid productId
 *       401:
 *         description: Unauthorized
 */
router.delete('/remove-item', updateAccessToken, isAuthenticated, removeCartItem);

export default router;
