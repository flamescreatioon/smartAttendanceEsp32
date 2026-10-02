import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { createHttpError } from '../utils/http.js';
import {
  buildFullName,
  ensureNonEmptyString,
  ensureValidEmail,
  normalizeMatricNumber,
  normalizeNullableText,
  normalizePhoneNumber,
  parseIntegerInRange,
} from '../utils/validation.js';
import { sendAttendanceOtpEmail } from './otp-delivery.service.js';
import { syncExpiredSessions } from './session.service.js';

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES ?? 5);
const MAX_OTP_ATTEMPTS = Number(process.env.MAX_OTP_ATTEMPTS ?? 5);

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

const sessionAttendanceInclude = {
  device: true,
  attendances: {
    select: attendanceRecordPublicSelect,
    orderBy: [
      { verifiedAt: 'desc' },
      { updatedAt: 'desc' },
    ],
  },
};

function getOtpSecret() {
  return process.env.OTP_SECRET || process.env.DEVICE_API_KEY || 'local-otp-secret';
}

function hashOtpCode(otpCode) {
  return crypto
    .createHash('sha256')
    .update(`${otpCode}:${getOtpSecret()}`)
    .digest('hex');
}

function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function normalizeOptionalEmail(email) {
  if (email === undefined || email === null || email === '') {
    return null;
  }

  return ensureValidEmail(email);
}

function normalizeOptionalPhoneNumber(phoneNumber) {
  const normalizedPhoneNumber = normalizeNullableText(normalizePhoneNumber(phoneNumber));
  return normalizedPhoneNumber || null;
}

function serializeRegisteredStudent(student) {
  if (!student) {
    return null;
  }

  return {
    id: student.id,
    matricNumber: student.matricNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    fullName: buildFullName(student.firstName, student.lastName),
    department: student.department,
    email: student.email,
    phoneNumber: student.phoneNumber,
  };
}

async function getSessionByToken(token) {
  await syncExpiredSessions();

  return prisma.session.findUnique({
    where: { token },
    include: sessionAttendanceInclude,
  });
}

function ensureSessionCanAcceptAttendance(session) {
  if (!session) {
    throw createHttpError(404, 'Attendance session not found.');
  }

  if (session.status !== 'ACTIVE') {
    throw createHttpError(400, 'This attendance session is no longer active.');
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw createHttpError(400, 'This attendance session has expired.');
  }
}

export async function getAttendanceSessionByToken(token) {
  const session = await getSessionByToken(token);

  if (!session) {
    throw createHttpError(404, 'Attendance session not found.');
  }

  return session;
}

export async function findRegisteredStudentForAttendance({ token, matricNumber }) {
  const session = await getSessionByToken(token);
  ensureSessionCanAcceptAttendance(session);

  const normalizedMatricNumber = ensureNonEmptyString(normalizeMatricNumber(matricNumber), 'matricNumber');
  const student = await prisma.student.findUnique({
    where: {
      matricNumber: normalizedMatricNumber,
    },
  });

  return {
    session,
    student: serializeRegisteredStudent(student),
    exists: Boolean(student),
  };
}

export async function requestAttendanceOtp({
  token,
  firstName,
  lastName,
  matricNumber,
  department,
  email,
  phoneNumber,
}) {
  const session = await getSessionByToken(token);
  ensureSessionCanAcceptAttendance(session);

  const normalizedMatricNumber = ensureNonEmptyString(normalizeMatricNumber(matricNumber), 'matricNumber');
  const normalizedDepartment = normalizeNullableText(department);
  const normalizedEmail = normalizeOptionalEmail(email);
  const normalizedPhoneNumber = normalizeOptionalPhoneNumber(phoneNumber);
  const existingStudent = await prisma.student.findUnique({
    where: {
      matricNumber: normalizedMatricNumber,
    },
  });

  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: {
      sessionId_matricNumber: {
        sessionId: session.id,
        matricNumber: normalizedMatricNumber,
      },
    },
  });

  if (existingRecord?.attendanceStatus === 'VERIFIED') {
    throw createHttpError(409, 'Attendance has already been verified for this matric number.');
  }

  const now = new Date();
  const otpCode = generateOtpCode();
  const otpExpiryMinutes = parseIntegerInRange(OTP_EXPIRY_MINUTES, {
    fieldName: 'OTP_EXPIRY_MINUTES',
    defaultValue: 5,
    min: 1,
    max: 30,
  });
  const otpExpiresAt = new Date(now.getTime() + otpExpiryMinutes * 60 * 1000);

  let student;
  let normalizedFirstName;
  let normalizedLastName;

  if (existingStudent) {
    // Prevent unauthenticated public attendance form from overwriting registered student profile
    student = existingStudent;
    normalizedFirstName = existingStudent.firstName;
    normalizedLastName = existingStudent.lastName;
  } else {
    normalizedFirstName = ensureNonEmptyString(firstName, 'firstName');
    normalizedLastName = ensureNonEmptyString(lastName, 'lastName');
    const requiredDepartment = ensureNonEmptyString(normalizedDepartment, 'department');
    const requiredEmail = ensureValidEmail(email);
    const requiredPhoneNumber = ensureNonEmptyString(normalizedPhoneNumber, 'phoneNumber');

    student = await prisma.student.create({
      data: {
        matricNumber: normalizedMatricNumber,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        department: requiredDepartment,
        email: requiredEmail,
        phoneNumber: requiredPhoneNumber,
      },
    });
  }

  const normalizedFullName = ensureNonEmptyString(
    buildFullName(student.firstName, student.lastName),
    'fullName',
  );

  const attendanceRecord = await prisma.attendanceRecord.upsert({
    where: {
      sessionId_matricNumber: {
        sessionId: session.id,
        matricNumber: normalizedMatricNumber,
      },
    },
    create: {
      sessionId: session.id,
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: normalizedFullName,
      matricNumber: normalizedMatricNumber,
      department: student.department,
      email: student.email,
      phoneNumber: student.phoneNumber,
      otpCodeHash: hashOtpCode(otpCode),
      otpRequestedAt: now,
      otpExpiresAt,
      otpStatus: 'PENDING',
      attendanceStatus: 'PENDING',
      otpAttemptCount: 0,
    },
    update: {
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: normalizedFullName,
      department: student.department,
      email: student.email,
      phoneNumber: student.phoneNumber,
      otpCodeHash: hashOtpCode(otpCode),
      otpRequestedAt: now,
      otpExpiresAt,
      otpStatus: 'PENDING',
      attendanceStatus: 'PENDING',
      verifiedAt: null,
      otpAttemptCount: 0,
    },
    select: attendanceRecordPublicSelect,
  });
  const updatedSession = await getSessionByToken(token);
  const delivery = await sendAttendanceOtpEmail({
    email: student.email,
    studentName: normalizedFullName,
    sessionTitle: session.courseTitle || session.courseCode || 'your class session',
    otpCode,
    expiresAt: otpExpiresAt,
  });

  return {
    session: updatedSession,
    attendanceRecord,
    student: serializeRegisteredStudent(student),
    studentExists: Boolean(existingStudent),
    otpCode,
    otpExpiresAt,
    delivery,
  };
}

export async function verifyAttendanceOtp({
  token,
  matricNumber,
  otpCode,
}) {
  const session = await getSessionByToken(token);
  ensureSessionCanAcceptAttendance(session);

  const normalizedMatricNumber = ensureNonEmptyString(normalizeMatricNumber(matricNumber), 'matricNumber');
  const normalizedOtpCode = ensureNonEmptyString(otpCode, 'otpCode');
  const maxOtpAttempts = parseIntegerInRange(MAX_OTP_ATTEMPTS, {
    fieldName: 'MAX_OTP_ATTEMPTS',
    defaultValue: 5,
    min: 1,
    max: 10,
  });

  const result = await prisma.$transaction(async (tx) => {
    const attendanceRecord = await tx.attendanceRecord.findUnique({
      where: {
        sessionId_matricNumber: {
          sessionId: session.id,
          matricNumber: normalizedMatricNumber,
        },
      },
    });

    if (!attendanceRecord) {
      throw createHttpError(404, 'No OTP request was found for this matric number.');
    }

    if (attendanceRecord.attendanceStatus === 'VERIFIED') {
      const verifiedRecord = await tx.attendanceRecord.findUnique({
        where: { id: attendanceRecord.id },
        select: attendanceRecordPublicSelect,
      });

      return {
        attendanceRecord: verifiedRecord,
        alreadyVerified: true,
      };
    }

    if (!attendanceRecord.otpCodeHash || !attendanceRecord.otpExpiresAt) {
      throw createHttpError(400, 'OTP has not been requested yet for this attendance session.');
    }

    if (attendanceRecord.otpAttemptCount >= maxOtpAttempts) {
      await tx.attendanceRecord.update({
        where: { id: attendanceRecord.id },
        data: {
          otpStatus: 'EXPIRED',
          otpCodeHash: null,
          otpExpiresAt: null,
        },
      });

      throw createHttpError(429, 'Too many invalid OTP attempts. Please request a new code.');
    }

    if (new Date(attendanceRecord.otpExpiresAt).getTime() <= Date.now()) {
      await tx.attendanceRecord.update({
        where: { id: attendanceRecord.id },
        data: {
          otpStatus: 'EXPIRED',
        },
      });

      throw createHttpError(400, 'The OTP has expired. Please request a new code.');
    }

    if (hashOtpCode(normalizedOtpCode) !== attendanceRecord.otpCodeHash) {
      const nextAttemptCount = attendanceRecord.otpAttemptCount + 1;

      await tx.attendanceRecord.update({
        where: { id: attendanceRecord.id },
        data: {
          otpAttemptCount: {
            increment: 1,
          },
          ...(nextAttemptCount >= maxOtpAttempts
            ? {
              otpStatus: 'EXPIRED',
              otpCodeHash: null,
              otpExpiresAt: null,
            }
            : {}),
        },
      });

      throw createHttpError(
        nextAttemptCount >= maxOtpAttempts ? 429 : 400,
        nextAttemptCount >= maxOtpAttempts
          ? 'Too many invalid OTP attempts. Please request a new code.'
          : 'The OTP you entered is invalid.',
      );
    }

    const verifiedRecord = await tx.attendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: {
        otpStatus: 'VERIFIED',
        attendanceStatus: 'VERIFIED',
        verifiedAt: new Date(),
        otpCodeHash: null,
        otpExpiresAt: null,
        otpAttemptCount: 0,
      },
      select: attendanceRecordPublicSelect,
    });

    return {
      attendanceRecord: verifiedRecord,
      alreadyVerified: false,
    };
  });

  const updatedSession = await getSessionByToken(token);

  return {
    session: updatedSession,
    attendanceRecord: result.attendanceRecord,
    alreadyVerified: result.alreadyVerified,
  };
}

