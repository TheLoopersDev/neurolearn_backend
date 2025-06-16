import express from 'express';
import userRoutes from '../routes/user.route';
import courseRoutes from '../routes/course.route';
import orderRoutes from '../routes/order.route';
import notificationRoutes from '../routes/notification.route';
import layoutRoutes from '../routes/layout.route';
import categoryRoutes from '../routes/category.route';
import levelRoutes from '../routes/level.route';
import quizRoutes from '../routes/quiz.route';
import progressRoutes from '../routes/progress.route';
import incomeRoutes from '../routes/income.route';
import paymentRoutes from '../routes/payment.route';
import creditCardRoutes from '../routes/creditCard.route';
import sectionRoutes from '../routes/section.route';
import lessonRoutes from '../routes/lesson.route';

const router = express.Router();

router.use('/users', userRoutes);

router.use('/courses', courseRoutes);

router.use('/sections', sectionRoutes);

router.use('/lessons', lessonRoutes);

router.use('/orders', orderRoutes);

router.use('/notifications', notificationRoutes);

router.use('/layout', layoutRoutes);

router.use('/levels', levelRoutes);

router.use('/categories', categoryRoutes);

router.use('/quizzes', quizRoutes);

router.use('/progress', progressRoutes);

router.use('/income', incomeRoutes);

router.use('/payment', paymentRoutes);

router.use('/credit-cards', creditCardRoutes);

export default router;
