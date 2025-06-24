import { Router } from 'express';
import {
  createCreditCard,
  getCurrentUserCard,
  getCreditCardByAccountNumberController,
  updateCreditCard,
  deleteCreditCard,
  getBankInfo,
} from '../controllers/creditCard.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

const router = Router();

/**
 * @swagger
 * /api/credit-cards:
 *   post:
 *     tags:
 *       - Credit Cards
 *     summary: Create a credit card for current instructor
 *     description: Creates a new credit card for the authenticated instructor
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
 *               - accountNumber
 *               - cardType
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the card holder
 *               accountNumber:
 *                 type: string
 *                 description: Account number of the card (must be unique)
 *               cardType:
 *                 type: string
 *                 description: Type or brand of the card (e.g. MBBank, Vietcombank, etc.)
 *     responses:
 *       201:
 *         description: Credit card created successfully
 *       400:
 *         description: Invalid input data or user already has a card
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.post('/', isAuthenticated, authorizeRoles('instructor'), createCreditCard);

/**
 * @swagger
 * /api/credit-cards/me:
 *   get:
 *     tags:
 *       - Credit Cards
 *     summary: Get current user's credit card
 *     description: Retrieves the credit card of the authenticated instructor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit card retrieved successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Credit card not found
 *       500:
 *         description: Server error
 */
router.get('/me', isAuthenticated, authorizeRoles('instructor'), getCurrentUserCard);

/**
 * @swagger
 * /api/credit-cards/account/{accountNumber}:
 *   get:
 *     tags:
 *       - Credit Cards
 *     summary: Get credit card by account number (Admin only)
 *     description: Retrieves a credit card by its account number
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Account number of the card
 *     responses:
 *       200:
 *         description: Credit card retrieved successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Credit card not found
 *       500:
 *         description: Server error
 */
router.get('/account/:accountNumber', isAuthenticated, authorizeRoles('admin'), getCreditCardByAccountNumberController);

/**
 * @swagger
 * /api/credit-cards:
 *   put:
 *     tags:
 *       - Credit Cards
 *     summary: Update current user's credit card
 *     description: Updates the credit card of the authenticated instructor
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
 *               accountNumber:
 *                 type: string
 *               cardType:
 *                 type: string
 *                 description: Type or brand of the card (e.g. MBBank, Vietcombank, etc.)
 *     responses:
 *       200:
 *         description: Credit card updated successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Credit card not found
 *       500:
 *         description: Server error
 */
router.put('/', isAuthenticated, authorizeRoles('instructor'), updateCreditCard);

/**
 * @swagger
 * /api/credit-cards:
 *   delete:
 *     tags:
 *       - Credit Cards
 *     summary: Delete current user's credit card
 *     description: Deletes the credit card of the authenticated instructor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit card deleted successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Credit card not found
 *       500:
 *         description: Server error
 */
router.delete('/', isAuthenticated, authorizeRoles('instructor'), deleteCreditCard);

/**
 * @swagger
 * /api/credit-cards/bank-info:
 *   get:
 *     tags:
 *       - Credit Cards
 *     summary: Get list of supported banks from MoMo
 *     description: Retrieves the list of supported banks from MoMo API
 *     responses:
 *       200:
 *         description: List of banks retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/bank-info', getBankInfo);

export default router; 