import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { updateAccessToken } from '../controllers/user.controller';
import {
    createSection,
    updateSection,
    deleteSection,
    getAllSections,
    getSectionsByUserId,
    reorderSections,
    publishSection,
    unpublishSection,
    getSectionDetail,
    getCurriculumByCourseId,
    addQuizToSection,
    reorderSection,
    removeItemFromSection
} from '../controllers/section.controller';
import { ensureCourseEditable } from '../middlewares/ensureCourseEditable';

const router = express.Router();

/**
 * @swagger
 * /api/section/create/{courseId}:
 *   post:
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
 *               description:
 *                 type: string
 *                 description: Description of the new section
 *     responses:
 *       201:
 *         description: Section created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/create/:courseId', updateAccessToken, isAuthenticated, createSection);

/**
 * @swagger
 * /api/section/update/{id}:
 *   put:
 *     summary: Update a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               order:
 *                 type: number
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Section updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Internal server error
 */
router.put('/update/:id', updateAccessToken, isAuthenticated, updateSection);

/**
 * @swagger
 * /api/section/delete/{sectionId}:
 *   delete:
 *     summary: Delete a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section deleted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Internal server error
 */
router.delete(
    '/delete/:sectionId',
    updateAccessToken,
    isAuthenticated,
    ensureCourseEditable({ allowAdminOverride: true }),
    deleteSection
);

/**
 * @swagger
 * /api/section/course/{courseId}:
 *   get:
 *     summary: Get all sections of a course
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: List of sections
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/course/:courseId', updateAccessToken, isAuthenticated, getAllSections);

router.get('/review/:courseId', updateAccessToken, isAuthenticated, getCurriculumByCourseId);

/**
 * @swagger
 * /api/section/user/{userId}:
 *   get:
 *     summary: Get all sections by userId (author)
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (author)
 *     responses:
 *       200:
 *         description: List of sections
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/', updateAccessToken, isAuthenticated, getSectionsByUserId);

/**
 * @swagger
 * /api/section/reorder:
 *   put:
 *     summary: Reorder sections
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sectionOrders
 *             properties:
 *               sectionOrders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sectionId:
 *                       type: string
 *                     order:
 *                       type: number
 *     responses:
 *       200:
 *         description: Sections reordered successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/reorder', updateAccessToken, isAuthenticated, reorderSections);

/**
 * @swagger
 * /api/section/publish/{sectionId}:
 *   put:
 *     summary: Publish a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section published successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Internal server error
 */
router.put(
    '/publish/:sectionId',
    updateAccessToken,
    isAuthenticated,
    ensureCourseEditable({ allowAdminOverride: true }),
    publishSection
);

/**
 * @swagger
 * /api/section/unpublish/{sectionId}:
 *   put:
 *     summary: Unpublish a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section unpublished successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Internal server error
 */
router.put(
    '/unpublish/:sectionId',
    updateAccessToken,
    isAuthenticated,
    ensureCourseEditable({ allowAdminOverride: true }),
    unpublishSection
);

/**
 * @swagger
 * /api/section/detail/{sectionId}:
 *   get:
 *     summary: Get detail of a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section detail
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 */
router.get('/detail/:sectionId', updateAccessToken, isAuthenticated, getSectionDetail);

/**
 * Hủy công khai section
 */
// router.put('/unpublish/:courseId', isAuthenticated, unpublishSection);

/**
 * Lấy danh sách tất cả section của course
 */
// router.get('/course/:courseId', isAuthenticated, getSectionsOfCourse);

/**
 * Lấy chi tiết 1 section
 */
// router.get('/:sectionId', isAuthenticated, getSectionDetail);

router.patch('/:id/add-quiz', updateAccessToken, isAuthenticated, addQuizToSection);

router.patch('/:id/reorder', updateAccessToken, isAuthenticated, reorderSection);

router.patch('/:id/remove-item', updateAccessToken, isAuthenticated, removeItemFromSection);

export default router;
