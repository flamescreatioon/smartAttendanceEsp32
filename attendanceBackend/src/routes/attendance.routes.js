import { Router } from 'express';
import {
  getAttendanceSession,
  lookupAttendanceStudent,
  requestOtp,
  verifyOtp,
} from '../controllers/attendance.controller.js';

const router = Router();

router.get('/:token', getAttendanceSession);
router.get('/:token/student/:matricNumber', lookupAttendanceStudent);
router.post('/:token/request-otp', requestOtp);
router.post('/:token/verify-otp', verifyOtp);

export default router;
