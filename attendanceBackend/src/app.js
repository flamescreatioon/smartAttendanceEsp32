import express from 'express';
import { Prisma } from '@prisma/client';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './config/database.js';
import sessionRoutes from './routes/session.routes.js';
import deviceRoutes from './routes/device.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import courseRoutes from './routes/course.routes.js';
import authRoutes from './routes/auth.routes.js';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin '${origin}' not permitted.`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: 'Attendance backend is running.',
      services: {
        api: 'up',
        database: 'up',
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Attendance backend is running, but the database is unavailable.',
      services: {
        api: 'up',
        database: 'down',
      },
    });
  }
});

app.use('/api/device', deviceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/course', courseRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  let statusCode = Number(error.statusCode) || 500;
  let message = error.message || 'Internal server error.';

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      statusCode = 404;
      message = 'Requested record was not found.';
    }

    if (error.code === 'P2002') {
      statusCode = 409;
      message = 'A record with the same unique value already exists.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(error.details ? { details: error.details } : {}),
  });
});

export default app;
