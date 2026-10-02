import { serializeSession } from '../presenters/session.presenter.js';
import {
  createSession,
  endSession,
  getCurrentActiveSession,
  getRecentSessions,
  getSessionByIdForDevice,
} from '../services/session.service.js';
import { getDeviceRoom, getSocket } from '../sockets/socket.js';
import { createHttpError } from '../utils/http.js';

function getScopedDevice(req) {
  const scopedDevice = req.userDevice ?? req.device ?? null;
  if (!scopedDevice) {
    throw createHttpError(409, 'No device is available for this request.');
  }

  return scopedDevice;
}

export async function startSession(req, res, next) {
  try {
    const {
      courseCode = null,
      courseTitle = null,
      lecturerId = null,
      durationMinutes,
    } = req.body ?? {};

    const { session, created } = await createSession({
      deviceId: getScopedDevice(req).id,
      courseCode,
      courseTitle,
      lecturerId,
      durationMinutes,
    });

    const serializedSession = serializeSession(session);
    const payload = {
      success: true,
      sessionId: session.id,
      expiresIn: serializedSession.durationSeconds,
      attendanceUrl: serializedSession.attendanceUrl,
      reusedExistingSession: !created,
      data: serializedSession,
    };

    const io = getSocket();
    if (io && created) {
      const deviceRoom = getDeviceRoom(session.deviceId);
      io.to(deviceRoom).emit('session:started', serializedSession);
      io.to(deviceRoom).emit('session-created', serializedSession);
    }

    return res.status(created ? 201 : 200).json(payload);
  } catch (error) {
    return next(error);
  }
}

export async function terminateSession(req, res, next) {
  try {
    const { sessionId } = req.body ?? {};

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }

    const session = await endSession({
      sessionId,
      deviceId: getScopedDevice(req).id,
    });
    const io = getSocket();
    const serializedSession = serializeSession(session);

    if (io) {
      const deviceRoom = getDeviceRoom(session.deviceId);
      io.to(deviceRoom).emit('session:ended', serializedSession);
      io.to(deviceRoom).emit('session-ended', serializedSession);
    }

    return res.status(200).json({ success: true, sessionId: session.id, status: session.status });
  } catch (error) {
    return next(error);
  }
}

export async function currentSession(req, res, next) {
  try {
    const session = await getCurrentActiveSession(getScopedDevice(req).id);

    return res.status(200).json({
      success: true,
      data: serializeSession(session),
    });
  } catch (error) {
    return next(error);
  }
}

export async function sessionHistory(req, res, next) {
  try {
    const requestedLimit = Number(req.query.limit ?? 12);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 12;
    const sessions = await getRecentSessions(getScopedDevice(req).id, limit);

    return res.status(200).json({
      success: true,
      data: sessions.map((session) => serializeSession(session, { includeAttendanceRecords: false })),
    });
  } catch (error) {
    return next(error);
  }
}

function escapeCsvCell(value) {
  const normalizedValue = String(value ?? '');
  return /[",\n]/.test(normalizedValue)
    ? `"${normalizedValue.replaceAll('"', '""')}"`
    : normalizedValue;
}

function formatCsvDate(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
  } catch {
    return String(value);
  }
}

function buildSessionCsvReport(session, absentStudents = []) {
  const analytics = session.attendanceAnalytics ?? {};
  const recordMatricNumbers = new Set(
    (session.attendanceRecords ?? []).map((r) => r.matricNumber),
  );

  const absentRows = (absentStudents ?? [])
    .filter((student) => !recordMatricNumbers.has(student.matricNumber))
    .map((student) => ([
      student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      student.matricNumber || '',
      student.department || '',
      student.phoneNumber || '',
      'NONE',
      'ABSENT',
      '',
      '',
    ]));

  const rows = [
    ['Course', session.courseTitle ? `${session.courseCode || ''} ${session.courseTitle}`.trim() : (session.courseCode || '')],
    ['Lecturer', session.lecturerId ?? ''],
    ['Enrolled', analytics.enrolledCount ?? 0],
    ['Present', analytics.presentCount ?? session.attendanceStats?.present ?? 0],
    ['Verified', analytics.verifiedCount ?? session.attendanceStats?.verified ?? 0],
    ['Pending', analytics.pendingCount ?? session.attendanceStats?.pending ?? 0],
    ['Absent', analytics.absentCount ?? 0],
    ['Attendance Percentage', analytics.attendancePercentage ?? 0],
    [],
    [
      'Name',
      'Matric Number',
      'Department',
      'Phone Number',
      'OTP Status',
      'Attendance Status',
      'Requested At',
      'Verified At',
    ],
    ...(session.attendanceRecords ?? []).map((record) => ([
      record.fullName ?? record.name ?? '',
      record.matricNumber ?? '',
      record.department ?? '',
      record.phoneNumber ?? '',
      record.otpStatus ?? '',
      record.attendanceStatus ?? '',
      formatCsvDate(record.requestedAt),
      formatCsvDate(record.verifiedAt),
    ])),
    ...absentRows,
  ];

  return rows
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function buildAbsentStudents(session) {
  const verifiedMatricNumbers = new Set(
    (session.attendances ?? [])
      .filter((record) => record.attendanceStatus === 'VERIFIED')
      .map((record) => record.matricNumber),
  );

  return (session.course?.enrollments ?? [])
    .map((enrollment) => enrollment.student)
    .filter((student) => !verifiedMatricNumbers.has(student.matricNumber))
    .map((student) => ({
      id: student.id,
      matricNumber: student.matricNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      department: student.department,
      email: student.email,
      phoneNumber: student.phoneNumber,
    }));
}

export async function sessionReport(req, res, next) {
  try {
    const session = await getSessionByIdForDevice(req.params.sessionId, getScopedDevice(req).id);
    const serializedSession = serializeSession(session);

    return res.status(200).json({
      success: true,
      data: {
        ...serializedSession,
        absentStudents: buildAbsentStudents(session),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function sessionCsvExport(req, res, next) {
  try {
    const session = await getSessionByIdForDevice(req.params.sessionId, getScopedDevice(req).id);
    const serializedSession = serializeSession(session);
    const safeCourseCode = (serializedSession.courseCode || 'attendance-session')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      || 'attendance-session';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeCourseCode}-${serializedSession.id}.csv"`,
    );

    return res.status(200).send(buildSessionCsvReport(serializedSession, buildAbsentStudents(session)));
  } catch (error) {
    return next(error);
  }
}
