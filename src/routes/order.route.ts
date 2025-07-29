import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import {
    createOrder,
    getAllOrders,
    getOrder,
    getUserOrders,
    newPayment,
    sendStripePublishKey
} from '../controllers/order.controller';
import { updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

router.post('/create-order', updateAccessToken, isAuthenticated, createOrder);

router.get('/get-orders', isAuthenticated, authorizeRoles('admin'), getAllOrders);

router.post('/user-orders', updateAccessToken, isAuthenticated, getUserOrders);

router.get('/:id', updateAccessToken, isAuthenticated, getOrder);

router.get('/payment/stripepublishablekey', sendStripePublishKey);

router.post('/payment', updateAccessToken, isAuthenticated, newPayment);

export = router;
