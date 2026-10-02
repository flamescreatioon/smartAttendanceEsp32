-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "lecturerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "courseId" TEXT;

-- Seed course table from existing sessions where a course code already exists.
INSERT INTO "Course" ("id", "code", "title", "lecturerId", "createdAt", "updatedAt")
SELECT DISTINCT ON ("courseCode")
  md5(random()::text || clock_timestamp()::text || "courseCode"),
  "courseCode",
  "courseTitle",
  "lecturerId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Session"
WHERE "courseCode" IS NOT NULL
ORDER BY "courseCode", "updatedAt" DESC;

-- Link existing sessions to the seeded courses.
UPDATE "Session" AS s
SET "courseId" = c."id"
FROM "Course" AS c
WHERE c."code" = s."courseCode";

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_studentId_key" ON "CourseEnrollment"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_idx" ON "CourseEnrollment"("studentId");

-- AddForeignKey
ALTER TABLE "Session"
ADD CONSTRAINT "Session_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment"
ADD CONSTRAINT "CourseEnrollment_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment"
ADD CONSTRAINT "CourseEnrollment_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
