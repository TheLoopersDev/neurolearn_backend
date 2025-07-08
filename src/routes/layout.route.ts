import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { createLayout, editLayout, getLayoutByType } from '../controllers/layout.controller';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';



const router = express.Router();


router.post('/', isAuthenticated, authorizeRoles('admin'), createLayout);

router.put('/', isAuthenticated, authorizeRoles('admin'), editLayout);

router.get('/', getLayoutByType);

export = router;
