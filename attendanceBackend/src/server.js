import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchFile } from 'node:fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
const loadedEnv = dotenv.config({
  path: envPath,
});

if (!loadedEnv.error) {
  const configuredAttendanceUrl = loadedEnv.parsed?.PUBLIC_ATTENDANCE_URL?.trim?.() ?? '';
  if (configuredAttendanceUrl) {
    process.env.PUBLIC_ATTENDANCE_URL = configuredAttendanceUrl;
  }
}

// Watch .env for changes and hot-reload key variables into process.env.
// This means editing PUBLIC_ATTENDANCE_URL (e.g. after a new ngrok session)
// takes effect within 1 second — no server restart required.
const LIVE_RELOAD_KEYS = ['PUBLIC_ATTENDANCE_URL', 'CORS_ORIGIN'];
watchFile(envPath, { interval: 1000 }, () => {
  try {
    const fresh = dotenv.config({ path: envPath, override: true });
    if (fresh.error || !fresh.parsed) return;
    for (const key of LIVE_RELOAD_KEYS) {
      const val = fresh.parsed[key]?.trim?.();
      if (val && val !== process.env[key]) {
        process.env[key] = val;
        // eslint-disable-next-line no-console
        console.log(`[env] ${key} updated → ${val}`);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[env] Failed to reload .env:', err.message);
  }
});

const [
  { default: app },
  { connectDatabase, disconnectDatabase },
  { initializeSocket },
] = await Promise.all([
  import('./app.js'),
  import('./config/database.js'),
  import('./sockets/socket.js'),
]);

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
initializeSocket(server);

async function startServer() {
  try {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-me')) {
        // eslint-disable-next-line no-console
        console.warn('⚠️  [SECURITY WARNING] Using default or insecure JWT_SECRET in production!');
      }
      if (!process.env.DEVICE_API_KEY || process.env.DEVICE_API_KEY.includes('change-me')) {
        // eslint-disable-next-line no-console
        console.warn('⚠️  [SECURITY WARNING] Using default or insecure DEVICE_API_KEY in production!');
      }
    }

    await connectDatabase();
    server.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Attendance backend listening on port ${port} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await disconnectDatabase();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  server.close(() => process.exit(0));
});

startServer();
