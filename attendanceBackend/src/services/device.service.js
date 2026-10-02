import { prisma } from '../config/database.js';

function getTimeLeftSeconds(session) {
  if (!session) {
    return 0;
  }

  return Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
}

function summarizeVerifiedAttendance(records = []) {
  return records.reduce((total, record) => (
    record.attendanceStatus === 'VERIFIED' ? total + 1 : total
  ), 0);
}

export async function getDeviceStatusSnapshot(deviceId) {
  const now = new Date();
  const tzOffsetMinutes = Number(process.env.TIMEZONE_OFFSET_MINUTES ?? 0);
  const localTimeMs = now.getTime() + tzOffsetMinutes * 60 * 1000;
  const localDate = new Date(localTimeMs);

  const startOfTodayLocal = new Date(Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
  ));
  const startOfToday = new Date(startOfTodayLocal.getTime() - tzOffsetMinutes * 60 * 1000);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const activeSession = await prisma.session.findFirst({
    where: {
      deviceId,
      status: 'ACTIVE',
      expiresAt: {
        gt: now,
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
    include: {
      attendances: {
        select: {
          attendanceStatus: true,
        },
      },
    },
  });

  const presentCount = activeSession?.attendances?.length ?? 0;
  const verifiedCount = summarizeVerifiedAttendance(activeSession?.attendances ?? []);
  const todayAttendance = await prisma.attendanceRecord.count({
    where: {
      attendanceStatus: 'VERIFIED',
      verifiedAt: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
      session: {
        deviceId,
      },
    },
  });

  return {
    session: activeSession
      ? {
        active: true,
        sessionId: activeSession.id,
        status: activeSession.status,
        startedAt: activeSession.startedAt,
        expiresAt: activeSession.expiresAt,
        timeLeftSeconds: getTimeLeftSeconds(activeSession),
      }
      : {
        active: false,
        sessionId: null,
        status: 'IDLE',
        startedAt: null,
        expiresAt: null,
        timeLeftSeconds: 0,
      },
    stats: {
      sessionAttendance: verifiedCount,
      sessionPendingAttendance: Math.max(0, presentCount - verifiedCount),
      sessionPresentAttendance: presentCount,
      todayAttendance,
    },
  };
}
