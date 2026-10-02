import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { createHttpError } from '../utils/http.js';
import { normalizeText } from '../utils/validation.js';

const DEFAULT_TOKEN_EXPIRY = process.env.AUTH_TOKEN_EXPIRY ?? '12h';
const DEVICE_ONLINE_WINDOW_SECONDS = Number(process.env.DEVICE_OFFLINE_AFTER_SECONDS ?? 15);

function getJwtSecret() {
  const jwtSecret = normalizeText(process.env.JWT_SECRET);
  if (!jwtSecret) {
    throw createHttpError(500, 'JWT_SECRET is not configured.');
  }

  return jwtSecret;
}

function normalizeEmail(email) {
  const normalizedEmail = normalizeText(email).toLowerCase();
  if (!normalizedEmail) {
    throw createHttpError(400, 'Email is required.');
  }

  return normalizedEmail;
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    deviceId: user.deviceId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function ensureBootstrapUser(email, password) {
  const bootstrapEmail = normalizeText(process.env.DASHBOARD_ADMIN_EMAIL).toLowerCase();
  const bootstrapPassword = normalizeText(process.env.DASHBOARD_ADMIN_PASSWORD);
  const bootstrapName = normalizeText(process.env.DASHBOARD_ADMIN_NAME) || 'Dashboard Admin';
  const bootstrapDeviceId = normalizeText(process.env.DASHBOARD_ADMIN_DEVICE_ID) || null;

  if (!bootstrapEmail || !bootstrapPassword) {
    return null;
  }

  if (email !== bootstrapEmail || password !== bootstrapPassword) {
    return null;
  }

  const existingUsersCount = await prisma.user.count();
  if (existingUsersCount > 0) {
    return null;
  }

  const assignedDevice = bootstrapDeviceId
    ? await prisma.device.findUnique({
      where: {
        deviceId: bootstrapDeviceId,
      },
    })
    : null;

  const passwordHash = await bcrypt.hash(bootstrapPassword, 10);
  return prisma.user.create({
    data: {
      email: bootstrapEmail,
      passwordHash,
      fullName: bootstrapName,
      role: 'ADMIN',
      deviceId: assignedDevice?.id ?? null,
    },
  });
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizeText(password);

  if (!normalizedPassword) {
    throw createHttpError(400, 'Password is required.');
  }

  await ensureBootstrapUser(normalizedEmail, normalizedPassword);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user || !(await bcrypt.compare(normalizedPassword, user.passwordHash))) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: DEFAULT_TOKEN_EXPIRY,
    },
  );

  return {
    token,
    user: serializeUser(user),
  };
}

export async function resolveAuthenticatedUser(token) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    return null;
  }

  try {
    const payload = jwt.verify(normalizedToken, getJwtSecret());
    const userId = typeof payload?.sub === 'string' ? payload.sub : '';
    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    return user ? serializeUser(user) : null;
  } catch {
    return null;
  }
}

export async function resolveUserDevice(user) {
  if (!user) {
    return null;
  }

  if (user.deviceId) {
    return prisma.device.findUnique({
      where: {
        id: user.deviceId,
      },
    });
  }

  const onlineSince = new Date(Date.now() - DEVICE_ONLINE_WINDOW_SECONDS * 1000);
  const onlineDevices = await prisma.device.findMany({
    where: {
      status: 'ACTIVE',
      lastSeenAt: {
        gte: onlineSince,
      },
    },
    orderBy: [
      { lastSeenAt: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: 2,
  });

  if (onlineDevices.length > 0) {
    return onlineDevices[0];
  }

  const activeDevices = await prisma.device.findMany({
    where: {
      status: 'ACTIVE',
    },
    orderBy: [
      { lastSeenAt: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: 2,
  });

  if (activeDevices.length > 0) {
    return activeDevices[0];
  }

  return null;
}
