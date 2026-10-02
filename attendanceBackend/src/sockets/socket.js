import { Server } from 'socket.io';
import { resolveAuthenticatedDeviceRequest } from '../middleware/auth.js';
import { resolveAuthenticatedUser, resolveUserDevice } from '../services/auth.service.js';
import { normalizeText } from '../utils/validation.js';

let socketServer = null;

export function getDeviceRoom(deviceId) {
  return `device:${deviceId}`;
}

export function initializeSocket(httpServer) {
  if (socketServer) {
    return socketServer;
  }

  socketServer = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  socketServer.use(async (socket, next) => {
    try {
      const bearerToken = normalizeText(socket.handshake.auth?.token ?? '');
      if (bearerToken) {
        const user = await resolveAuthenticatedUser(bearerToken);

        if (!user) {
          next(new Error('Invalid or expired user token.'));
          return;
        }

        const device = await resolveUserDevice(user);
        socket.data.user = user;
        socket.data.device = device;
        next();
        return;
      }

      const apiKey = normalizeText(
        socket.handshake.auth?.apiKey
        ?? socket.handshake.headers['x-api-key']
        ?? '',
      );

      if (!apiKey) {
        next(new Error('Missing socket API key.'));
        return;
      }

      const device = await resolveAuthenticatedDeviceRequest(socket, apiKey);

      if (!device) {
        next(new Error('Invalid or inactive device key.'));
        return;
      }

      socket.data.device = device;
      next();
    } catch (error) {
      next(error);
    }
  });

  socketServer.on('connection', (socket) => {
    const device = socket.data.device ?? null;
    const user = socket.data.user ?? null;

    if (device?.id) {
      socket.join(getDeviceRoom(device.id));
    }

    socket.emit('socket:ready', {
      connected: true,
      socketId: socket.id,
      deviceId: device?.deviceId ?? null,
      userId: user?.id ?? null,
    });
  });

  return socketServer;
}

export function getSocket() {
  return socketServer;
}
