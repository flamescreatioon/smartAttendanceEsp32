import { Router } from 'express';
import { deviceStatus } from '../controllers/device.controller.js';
import { authenticateDevice } from '../middleware/auth.js';

const router = Router();

router.get('/status', authenticateDevice, deviceStatus);

export default router;
