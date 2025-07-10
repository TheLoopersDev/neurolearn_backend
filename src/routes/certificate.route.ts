import express from 'express';
import { getCertificateById, getCertificateByCourse, getAllCertificates, getCertificateByUser } from '../controllers/certificate.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';

const router = express.Router();

// Lấy certificate theo ID
router.get('/:id', isAuthenticated, (req, res, next) => {
  getCertificateById(req, res).catch(next);
});

// Lấy tất cả certificate (admin)
router.get('/', isAuthenticated, getAllCertificates);

// Lấy certificate của user cho 1 course
router.get('/user/:userId/course/:courseId', isAuthenticated, (req, res, next) => {
  getCertificateByUser(req, res).catch(next);
});

// Lấy tất cả certificate của 1 course
router.get('/course/:courseId', isAuthenticated, (req, res, next) => {
  getCertificateByCourse(req, res).catch(next);
});

export default router;
