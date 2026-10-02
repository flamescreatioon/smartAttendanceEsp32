import { Router } from 'express';
import {
  currentSession,
  sessionCsvExport,
  sessionHistory,
  sessionReport,
  startSession,
  terminateSession,
} from '../controllers/session.controller.js';
import { authenticateUser, authenticateUserOrDevice, requireUserDevice } from '../middleware/auth.js';

const router = Router();

router.get('/current', authenticateUser, requireUserDevice, currentSession);
router.get('/history', authenticateUser, requireUserDevice, sessionHistory);
router.get('/:sessionId/report', authenticateUser, requireUserDevice, sessionReport);
router.get('/:sessionId/export.csv', authenticateUser, requireUserDevice, sessionCsvExport);
router.post('/start', authenticateUser, requireUserDevice, startSession);
router.post('/end', authenticateUserOrDevice, terminateSession);

export default router;
