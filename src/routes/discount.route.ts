import { Router } from 'express';
import { createDiscount, getAllDiscounts, validateDiscountCode } from '../controllers/discount.controller';
import { updateAccessToken } from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

const router = Router();

// Admin tạo mã giảm giá
router.post('/', updateAccessToken, isAuthenticated, authorizeRoles('admin'), createDiscount);

// Validate mã giảm giá khi checkout
router.post('/validate', updateAccessToken, isAuthenticated, validateDiscountCode);

// Xem tất cả mã giảm giá (admin)
router.get('/', updateAccessToken, isAuthenticated, authorizeRoles('admin'), getAllDiscounts);

export default router;
