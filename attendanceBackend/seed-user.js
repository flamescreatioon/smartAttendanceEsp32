import bcrypt from 'bcryptjs';
import { prisma } from './src/config/database.js';

async function seedExactUserAndDevice() {
  console.log('Seeding exact user and device from .env and secrets.h into Neon database...');

  const deviceId = 'Attendance_terminal_001';
  const apiKey = 'change-me-for-local-testing';
  const email = 'admin@example.com';
  const password = 'change-me-now';
  const fullName = 'Dashboard Admin';

  // 1. Clean up seed device from earlier test if exists
  await prisma.user.deleteMany({
    where: {
      email: { in: ['admin@example.com'] },
    },
  });

  await prisma.device.deleteMany({
    where: {
      deviceId: { in: ['esp32-terminal-1', 'Attendance_terminal_001', 'local-bootstrap-device'] },
    },
  });

  // 2. Create the exact device from secrets.h and .env
  const device = await prisma.device.create({
    data: {
      deviceId,
      name: 'Attendance Terminal 001',
      location: 'Default Terminal Location',
      apiKey,
      status: 'ACTIVE',
    },
  });

  console.log(`Device created: ID=${device.deviceId}, DB_ID=${device.id}`);

  // 3. Create the exact user from .env
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: 'ADMIN',
      deviceId: device.id,
    },
  });

  console.log(`User created: ${user.fullName} (${user.email})`);
  console.log('Seed completed successfully!');
  await prisma.$disconnect();
}

seedExactUserAndDevice().catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
