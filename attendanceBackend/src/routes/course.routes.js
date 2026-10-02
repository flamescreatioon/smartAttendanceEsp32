import { Router } from 'express';
import { getCourseRoster, listCourses, saveCourseRoster } from '../controllers/course.controller.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateUser, listCourses);
router.get('/:courseCode', authenticateUser, getCourseRoster);
router.put('/:courseCode/roster', authenticateUser, saveCourseRoster);

export default router;
