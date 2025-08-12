import express from 'express';
import { getCertificateById, getCertificateByCourse, getAllCertificates, getCertificateByUser } from '../controllers/certificate.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { catchAsync } from '../utils/catchAsync';

const router = express.Router();

// Lấy certificate theo ID
router.get('/:id', isAuthenticated, catchAsync(getCertificateById));

// Lấy tất cả certificate (admin)
router.get('/', isAuthenticated, getAllCertificates);

// Lấy certificate của user cho 1 course
router.get('/user/:userId/course/:courseId', isAuthenticated, catchAsync(getCertificateByUser));

// Lấy tất cả certificate của 1 course
router.get('/course/:courseId', isAuthenticated, catchAsync(getCertificateByCourse));

export default router;
