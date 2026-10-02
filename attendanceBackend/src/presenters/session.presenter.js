function buildAttendanceUrl(token) {
  const baseUrl = (process.env.PUBLIC_ATTENDANCE_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '');
  return `${baseUrl}/attendance/${token}`;
}

function getDeviceOfflineAfterSeconds() {
  const configuredValue = Number(process.env.DEVICE_OFFLINE_AFTER_SECONDS ?? 15);
  return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 15;
}

function isDeviceOnline(device) {
  if (!device?.lastSeenAt || device?.status !== 'ACTIVE') {
    return false;
  }

  const lastSeenTime = new Date(device.lastSeenAt).getTime();
  if (Number.isNaN(lastSeenTime)) {
    return false;
  }

  return Date.now() - lastSeenTime <= getDeviceOfflineAfterSeconds() * 1000;
}

export function serializeDevice(device) {
  if (!device) {
    return null;
  }

  return {
    id: device.id,
    deviceId: device.deviceId,
    name: device.name,
    location: device.location,
    status: device.status,
    isOnline: isDeviceOnline(device),
    lastSeenAt: device.lastSeenAt,
    offlineAfterSeconds: getDeviceOfflineAfterSeconds(),
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

export function serializeAttendanceRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    sessionId: record.sessionId,
    studentId: record.studentId ?? null,
    name: record.fullName,
    fullName: record.fullName,
    firstName: record.firstName ?? null,
    lastName: record.lastName ?? null,
    matricNumber: record.matricNumber,
    department: record.department ?? 'Unknown department',
    phoneNumber: record.phoneNumber ?? null,
    otpStatus: record.otpStatus,
    attendanceStatus: record.attendanceStatus,
    requestedAt: record.otpRequestedAt ?? record.createdAt,
    checkInTime: record.verifiedAt ?? record.createdAt,
    verifiedAt: record.verifiedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function summarizeAttendance(records = []) {
  const serializedRecords = records.map((record) => (
    typeof record?.name === 'string' ? record : serializeAttendanceRecord(record)
  ));

  const present = serializedRecords.length;
  const verified = serializedRecords.filter((record) => record.attendanceStatus === 'VERIFIED').length;

  return {
    present,
    pending: Math.max(0, present - verified),
    verified,
  };
}

export function summarizeSessionAnalytics(session, attendanceRecords = []) {
  const enrollmentRecords = session?.course?.enrollments ?? [];
  const enrolledCount = enrollmentRecords.length;
  const presentCount = attendanceRecords.length;
  const verifiedCount = attendanceRecords.filter((record) => record.attendanceStatus === 'VERIFIED').length;
  const pendingCount = Math.max(0, presentCount - verifiedCount);
  const absentCount = Math.max(0, enrolledCount - verifiedCount);
  const attendancePercentage = enrolledCount > 0
    ? Number(((verifiedCount / enrolledCount) * 100).toFixed(1))
    : 0;
  const checkedInPercentage = enrolledCount > 0
    ? Number(((presentCount / enrolledCount) * 100).toFixed(1))
    : 0;

  return {
    enrolledCount,
    presentCount,
    verifiedCount,
    pendingCount,
    absentCount,
    attendancePercentage,
    checkedInPercentage,
    rosterAvailable: enrolledCount > 0,
  };
}

function getDurationSeconds(session) {
  return Math.max(
    0,
    Math.floor((new Date(session.expiresAt).getTime() - new Date(session.startedAt).getTime()) / 1000),
  );
}

function getTimeLeftSeconds(session) {
  return session.status === 'ACTIVE'
    ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
    : 0;
}

function getEffectiveSessionStatus(session) {
  if (session.status === 'ACTIVE' && new Date(session.expiresAt).getTime() <= Date.now()) {
    return 'EXPIRED';
  }

  return session.status;
}

export function serializeSession(
  session,
  {
    includeAttendanceRecords = true,
    includeDevice = true,
    includeToken = false,
  } = {},
) {
  if (!session) {
    return null;
  }

  const attendanceRecords = (session.attendances ?? []).map(serializeAttendanceRecord);
  const status = getEffectiveSessionStatus(session);
  const payload = {
    id: session.id,
    courseCode: session.courseCode,
    courseTitle: session.courseTitle,
    lecturerId: session.lecturerId,
    status,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    endedAt: session.endedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    attendanceUrl: buildAttendanceUrl(session.token),
    durationSeconds: getDurationSeconds(session),
    timeLeftSeconds: getTimeLeftSeconds(session),
    attendanceStats: summarizeAttendance(attendanceRecords),
    attendanceAnalytics: summarizeSessionAnalytics(session, attendanceRecords),
  };

  if (includeToken) {
    payload.token = session.token;
  }

  if (includeDevice) {
    payload.device = serializeDevice(session.device);
  }

  if (includeAttendanceRecords) {
    payload.attendanceRecords = attendanceRecords;
  }

  return payload;
}

export function serializePublicSession(session) {
  if (!session) {
    return null;
  }

  const serializedSession = serializeSession(session, {
    includeAttendanceRecords: false,
    includeDevice: false,
    includeToken: false,
  });

  return {
    ...serializedSession,
    active: serializedSession.status === 'ACTIVE' && serializedSession.timeLeftSeconds > 0,
  };
}
