import express from 'express';
import { getUserIncome, getUserIncomeChart } from '../controllers/income.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import { updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

router.get('/:userId', updateAccessToken, isAuthenticated, authorizeRoles('instructor'), getUserIncome);

router.get('/:userId/chart', updateAccessToken, isAuthenticated, authorizeRoles('instructor'), getUserIncomeChart);

export = router;
