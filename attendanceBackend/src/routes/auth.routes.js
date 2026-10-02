import { Router } from 'express';
import { currentUser, login } from '../controllers/auth.controller.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticateUser, currentUser);

export default router;
