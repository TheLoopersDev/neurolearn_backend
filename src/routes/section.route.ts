import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import {
    createSection,
    updateSection,
    // publishSection,
    // unpublishSection,
    // deleteSection,
    // getSectionsOfCourse,
    // getSectionDetail
} from '../controllers/section.controller';

const router = express.Router();

/**
 * @swagger
 * /api/section/create/{courseId}:
 *   put:
 *     summary: Create a new section in a course
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the course where the section will be added
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the new section
 *     responses:
 *       200:
 *         description: Section created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/create/:courseId', isAuthenticated, createSection);

/**
 * Cập nhật section
 */
router.put('/update/:courseId', isAuthenticated, updateSection);

/**
 * Công khai section
 */
// router.put('/publish/:courseId', isAuthenticated, publishSection);

/**
 * Hủy công khai section
 */
// router.put('/unpublish/:courseId', isAuthenticated, unpublishSection);

/**
 * Xóa section
 */
// router.put('/delete/:courseId', isAuthenticated, deleteSection);

/**
 * Lấy danh sách tất cả section của course
 */
// router.get('/course/:courseId', isAuthenticated, getSectionsOfCourse);

/**
 * Lấy chi tiết 1 section
 */
// router.get('/:sectionId', isAuthenticated, getSectionDetail);

export default router;
