import { prisma } from '../config/database.js';
import { createHttpError } from '../utils/http.js';
import { resolveAuthenticatedUser, resolveUserDevice } from '../services/auth.service.js';
import { normalizeText } from '../utils/validation.js';

const HEARTBEAT_HEADER = 'X-Device-Heartbeat';
const DEVICE_ID_HEADER = 'X-Device-Id';

function isHeartbeatRequest(req) {
  return String(req.header(HEARTBEAT_HEADER) ?? '').toLowerCase() === 'true';
}

function getRequestedDeviceId(source) {
  return normalizeText(source?.header?.(DEVICE_ID_HEADER) ?? source?.handshake?.headers?.['x-device-id'] ?? '');
}

async function syncDeviceIdentity(device, requestedDeviceId) {
  if (!device || !requestedDeviceId || device.deviceId === requestedDeviceId) {
    return device;
  }

  // Only auto-sync deviceId if it's the unconfigured local bootstrap device
  const isBootstrapDevice = device.deviceId === 'local-bootstrap-device';
  const allowDynamicSync = String(process.env.ALLOW_DYNAMIC_DEVICE_ID_SYNC ?? '').toLowerCase() === 'true';

  if (!isBootstrapDevice && !allowDynamicSync) {
    return device;
  }

  const existingDevice = await prisma.device.findUnique({
    where: {
      deviceId: requestedDeviceId,
    },
  });

  if (existingDevice && existingDevice.id !== device.id) {
    return device;
  }

  return prisma.device.update({
    where: {
      id: device.id,
    },
    data: {
      deviceId: requestedDeviceId,
    },
  });
}

export async function resolveAuthenticatedDevice(apiKey) {
  const normalizedApiKey = normalizeText(apiKey);

  if (!normalizedApiKey) {
    return null;
  }

  // Handle local development bootstrap device
  if (process.env.DEVICE_API_KEY && normalizedApiKey === process.env.DEVICE_API_KEY) {
    return prisma.device.upsert({
      where: { apiKey: normalizedApiKey },
      create: {
        deviceId: 'local-bootstrap-device',
        name: 'Local bootstrap device',
        location: 'Local development',
        apiKey: normalizedApiKey,
      },
      update: {
        apiKey: normalizedApiKey,
        status: 'ACTIVE',
      },
    });
  }

  const device = await prisma.device.findUnique({
    where: {
      apiKey: normalizedApiKey,
    },
  });

  if (!device || device.status !== 'ACTIVE') {
    return null;
  }

  return device;
}

export async function resolveAuthenticatedDeviceRequest(source, apiKey) {
  const device = await resolveAuthenticatedDevice(apiKey);
  if (!device) {
    return null;
  }

  return syncDeviceIdentity(device, getRequestedDeviceId(source));
}

async function touchDeviceHeartbeat(deviceId) {
  return prisma.device.update({
    where: { id: deviceId },
    data: {
      lastSeenAt: new Date(),
    },
  });
}

export async function authenticateDevice(req, res, next) {
  try {
    const apiKey = normalizeText(req.header('X-API-Key'));

    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'Missing X-API-Key header.' });
    }

    const device = await resolveAuthenticatedDeviceRequest(req, apiKey);

    if (!device || device.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid or inactive device key.' });
    }

    req.device = isHeartbeatRequest(req)
      ? await touchDeviceHeartbeat(device.id)
      : device;

    return next();
  } catch (error) {
    return next(error);
  }
}

function getBearerToken(req) {
  const authorizationHeader = normalizeText(req.header('Authorization'));
  if (!authorizationHeader?.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return normalizeText(authorizationHeader.slice(7));
}

export async function authenticateUser(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing bearer token.' });
    }

    const user = await resolveAuthenticatedUser(token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired user token.' });
    }

    req.user = user;
    req.userDevice = await resolveUserDevice(user);
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function authenticateUserOrDevice(req, res, next) {
  try {
    const bearerToken = getBearerToken(req);

    if (bearerToken) {
      const user = await resolveAuthenticatedUser(bearerToken);

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid or expired user token.' });
      }

      req.user = user;
      req.userDevice = await resolveUserDevice(user);
      return next();
    }

    return authenticateDevice(req, res, next);
  } catch (error) {
    return next(error);
  }
}

export function requireUserDevice(req, res, next) {
  if (!req.user) {
    return next(createHttpError(500, 'User context is missing.'));
  }

  if (!req.userDevice) {
    return res.status(409).json({
      success: false,
      message: 'No dashboard device is assigned. Assign a device to this user or keep only one active device.',
    });
  }

  return next();
}
