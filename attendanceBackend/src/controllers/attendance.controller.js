import { serializeAttendanceRecord, serializePublicSession } from '../presenters/session.presenter.js';
import {
  findRegisteredStudentForAttendance,
  getAttendanceSessionByToken,
  requestAttendanceOtp,
  verifyAttendanceOtp,
} from '../services/attendance.service.js';
import { getDeviceRoom, getSocket } from '../sockets/socket.js';

export async function getAttendanceSession(req, res, next) {
  try {
    const session = await getAttendanceSessionByToken(req.params.token);

    return res.status(200).json({
      success: true,
      data: serializePublicSession(session),
    });
  } catch (error) {
    return next(error);
  }
}

export async function lookupAttendanceStudent(req, res, next) {
  try {
    const result = await findRegisteredStudentForAttendance({
      token: req.params.token,
      matricNumber: req.params.matricNumber,
    });

    return res.status(200).json({
      success: true,
      data: {
        exists: result.exists,
        student: result.student,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function requestOtp(req, res, next) {
  try {
    const {
      firstName,
      lastName,
      matricNumber,
      department,
      email,
      phoneNumber,
    } = req.body ?? {};

    if (!matricNumber) {
      return res.status(400).json({
        success: false,
        message: 'matricNumber is required.',
      });
    }

    const result = await requestAttendanceOtp({
      token: req.params.token,
      firstName,
      lastName,
      matricNumber,
      department,
      email,
      phoneNumber,
    });

    const serializedAttendance = serializeAttendanceRecord(result.attendanceRecord);
    const io = getSocket();

    if (io) {
      const deviceRoom = getDeviceRoom(result.session.deviceId);
      io.to(deviceRoom).emit('attendance-updated', serializedAttendance);
    }

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`Development OTP for ${serializedAttendance.matricNumber}: ${result.otpCode}`);
    }

    const shouldExposeDevOtp = process.env.NODE_ENV !== 'production'
      && result.delivery?.delivered !== true;

    return res.status(200).json({
      success: true,
      message: 'OTP generated successfully.',
      data: {
        attendance: serializedAttendance,
        session: serializePublicSession(result.session),
        student: result.student,
        studentExists: result.studentExists,
        otpExpiresAt: result.otpExpiresAt,
        delivery: result.delivery?.message ?? 'OTP generated successfully.',
        deliveryChannel: result.delivery?.channel ?? 'unknown',
        ...(shouldExposeDevOtp ? { devOtpCode: result.otpCode } : {}),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { matricNumber, otpCode } = req.body ?? {};

    if (!matricNumber || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'matricNumber and otpCode are required.',
      });
    }

    const result = await verifyAttendanceOtp({
      token: req.params.token,
      matricNumber,
      otpCode,
    });

    const serializedAttendance = serializeAttendanceRecord(result.attendanceRecord);
    const io = getSocket();

    if (io) {
      const deviceRoom = getDeviceRoom(result.session.deviceId);
      io.to(deviceRoom).emit('attendance-updated', serializedAttendance);
      io.to(deviceRoom).emit('student-verified', serializedAttendance);
    }

    return res.status(200).json({
      success: true,
      message: result.alreadyVerified
        ? 'Attendance was already verified for this matric number.'
        : 'Attendance verified successfully.',
      data: {
        attendance: serializedAttendance,
        session: serializePublicSession(result.session),
        alreadyVerified: result.alreadyVerified,
      },
    });
  } catch (error) {
    return next(error);
  }
}
