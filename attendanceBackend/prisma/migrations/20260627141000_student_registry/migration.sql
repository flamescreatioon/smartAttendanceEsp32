-- AlterTable
ALTER TABLE "Session" ADD COLUMN "courseTitle" TEXT;

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "matricNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AttendanceRecord"
ADD COLUMN "studentId" TEXT,
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "phoneNumber" TEXT;

-- Backfill snapshot name columns from the old fullName field.
UPDATE "AttendanceRecord"
SET
  "firstName" = split_part("fullName", ' ', 1),
  "lastName" = NULLIF(substr("fullName", length(split_part("fullName", ' ', 1)) + 2), '');

-- Seed a student registry from existing attendance rows, keeping the newest snapshot per matric number.
INSERT INTO "Student" (
  "id",
  "matricNumber",
  "firstName",
  "lastName",
  "department",
  "email",
  "phoneNumber",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT ON ("matricNumber")
  md5(random()::text || clock_timestamp()::text || "matricNumber"),
  "matricNumber",
  COALESCE(NULLIF("firstName", ''), split_part("fullName", ' ', 1)),
  COALESCE(NULLIF("lastName", ''), NULLIF(substr("fullName", length(split_part("fullName", ' ', 1)) + 2), ''), 'Student'),
  "department",
  "email",
  "phoneNumber",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AttendanceRecord"
ORDER BY "matricNumber", "updatedAt" DESC;

UPDATE "AttendanceRecord" AS ar
SET "studentId" = s."id"
FROM "Student" AS s
WHERE s."matricNumber" = ar."matricNumber";

-- CreateIndex
CREATE UNIQUE INDEX "Student_matricNumber_key" ON "Student"("matricNumber");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord"
ADD CONSTRAINT "AttendanceRecord_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
