-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "matricNumber" TEXT NOT NULL,
    "department" TEXT,
    "email" TEXT NOT NULL,
    "otpCodeHash" TEXT,
    "otpRequestedAt" TIMESTAMP(3),
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "otpStatus" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_sessionId_updatedAt_idx" ON "AttendanceRecord"("sessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_matricNumber_key" ON "AttendanceRecord"("sessionId", "matricNumber");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
