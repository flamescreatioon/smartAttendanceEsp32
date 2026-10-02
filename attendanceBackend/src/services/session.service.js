import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { createHttpError } from '../utils/http.js';
import { normalizeNullableText, parseIntegerInRange } from '../utils/validation.js';

const DEFAULT_SESSION_DURATION_MINUTES = Number(process.env.SESSION_DURATION_MINUTES ?? 30);
const MAX_SESSION_DURATION_MINUTES = Number(process.env.MAX_SESSION_DURATION_MINUTES ?? 180);
const SERIALIZABLE_RETRY_LIMIT = Number(process.env.SESSION_START_RETRY_LIMIT ?? 3);
const attendanceRecordPublicSelect = {
  id: true,
  sessionId: true,
  studentId: true,
  firstName: true,
  lastName: true,
  fullName: true,
  matricNumber: true,
  department: true,
  phoneNumber: true,
  otpStatus: true,
  attendanceStatus: true,
  otpRequestedAt: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
};
const sessionInclude = {
  device: true,
  course: {
    include: {
      enrollments: {
        include: {
          student: true,
        },
      },
    },
  },
  attendances: {
    select: attendanceRecordPublicSelect,
    orderBy: [
      { verifiedAt: 'desc' },
      { updatedAt: 'desc' },
    ],
  },
};

export function generateSessionToken() {
  return crypto.randomBytes(12).toString('hex');
}

export async function syncExpiredSessions(db = prisma, now = new Date()) {
  await db.session.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: 'EXPIRED',
      endedAt: now,
    },
  });
}

export async function createSession({
  deviceId,
  courseCode = null,
  courseTitle = null,
  lecturerId = null,
  durationMinutes = DEFAULT_SESSION_DURATION_MINUTES,
}) {
  const normalizedDurationMinutes = parseIntegerInRange(durationMinutes, {
    fieldName: 'durationMinutes',
    defaultValue: DEFAULT_SESSION_DURATION_MINUTES,
    min: 1,
    max: MAX_SESSION_DURATION_MINUTES,
  });

  for (let attempt = 0; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();
        await syncExpiredSessions(tx, now);
        const normalizedCourseCode = normalizeNullableText(courseCode);
        const normalizedCourseTitle = normalizeNullableText(courseTitle);
        const normalizedLecturerId = normalizeNullableText(lecturerId);

        let course = null;
        if (normalizedCourseCode) {
          course = await tx.course.upsert({
            where: {
              code: normalizedCourseCode,
            },
            create: {
              code: normalizedCourseCode,
              title: normalizedCourseTitle,
              lecturerId: normalizedLecturerId,
            },
            update: {
              title: normalizedCourseTitle,
              lecturerId: normalizedLecturerId,
            },
          });
        }

        const existingActiveSession = await tx.session.findFirst({
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
          include: sessionInclude,
        });

        if (existingActiveSession) {
          return {
            session: existingActiveSession,
            created: false,
          };
        }

        const token = generateSessionToken();
        const startedAt = now;
        const expiresAt = new Date(startedAt.getTime() + normalizedDurationMinutes * 60 * 1000);

        const session = await tx.session.create({
          data: {
            deviceId,
            courseId: course?.id ?? null,
            courseCode: normalizedCourseCode,
            courseTitle: normalizedCourseTitle,
            lecturerId: normalizedLecturerId,
            token,
            startedAt,
            expiresAt,
          },
          include: sessionInclude,
        });

        return {
          session,
          created: true,
        };
      }, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (error?.code !== 'P2034' || attempt === SERIALIZABLE_RETRY_LIMIT) {
        throw error;
      }
    }
  }

  throw createHttpError(500, 'Unable to start session right now. Please try again.');
}

export async function endSession({ sessionId, deviceId }) {
  return prisma.$transaction(async (tx) => {
    await syncExpiredSessions(tx);

    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: sessionInclude,
    });

    if (!session) {
      throw createHttpError(404, 'Session not found.');
    }

    if (session.deviceId !== deviceId) {
      throw createHttpError(403, 'You are not allowed to end this session.');
    }

    if (session.status !== 'ACTIVE') {
      return session;
    }

    return tx.session.update({
      where: { id: sessionId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
      include: sessionInclude,
    });
  });
}

export async function getCurrentActiveSession(deviceId) {
  return prisma.session.findFirst({
    where: {
      deviceId,
      status: 'ACTIVE',
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { startedAt: 'desc' },
    include: sessionInclude,
  });
}

export async function getRecentSessions(deviceId, limit = 12) {
  return prisma.session.findMany({
    take: limit,
    where: {
      deviceId,
    },
    orderBy: {
      startedAt: 'desc',
    },
    include: {
      ...sessionInclude,
      attendances: {
        select: attendanceRecordPublicSelect,
      },
    },
  });
}

export async function getSessionByIdForDevice(sessionId, deviceId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });

  if (!session) {
    throw createHttpError(404, 'Session not found.');
  }

  if (session.deviceId !== deviceId) {
    throw createHttpError(403, 'You are not allowed to access this session.');
  }

  return session;
}
