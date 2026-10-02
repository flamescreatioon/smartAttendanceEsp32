import { prisma } from '../config/database.js';
import { createHttpError } from '../utils/http.js';
import {
  buildFullName,
  ensureNonEmptyString,
  ensureValidEmail,
  normalizeMatricNumber,
  normalizeNullableText,
  normalizePhoneNumber,
  normalizeText,
} from '../utils/validation.js';

function serializeStudent(student) {
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

function serializeCourse(course) {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    lecturerId: course.lecturerId,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    enrolledCount: course.enrollments?.length ?? 0,
    students: (course.enrollments ?? []).map((enrollment) => serializeStudent(enrollment.student)),
  };
}

export async function getCoursesForDashboard() {
  const courses = await prisma.course.findMany({
    orderBy: {
      code: 'asc',
    },
    include: {
      enrollments: {
        include: {
          student: true,
        },
        orderBy: {
          student: {
            matricNumber: 'asc',
          },
        },
      },
    },
  });

  return courses.map(serializeCourse);
}

export async function getCourseRosterByCode(courseCode) {
  const normalizedCourseCode = ensureNonEmptyString(normalizeText(courseCode).toUpperCase(), 'courseCode');
  const course = await prisma.course.findUnique({
    where: {
      code: normalizedCourseCode,
    },
    include: {
      enrollments: {
        include: {
          student: true,
        },
        orderBy: {
          student: {
            matricNumber: 'asc',
          },
        },
      },
    },
  });

  if (!course) {
    throw createHttpError(404, 'Course roster not found.');
  }

  return serializeCourse(course);
}

export async function upsertCourseRoster({
  courseCode,
  courseTitle = null,
  lecturerId = null,
  students = [],
}) {
  const normalizedCourseCode = ensureNonEmptyString(normalizeText(courseCode).toUpperCase(), 'courseCode');
  const normalizedCourseTitle = normalizeNullableText(courseTitle);
  const normalizedLecturerId = normalizeNullableText(lecturerId);

  const normalizedStudents = students.map((student, index) => {
    const fieldPrefix = `students[${index}]`;
    const matricNumber = ensureNonEmptyString(
      normalizeMatricNumber(student.matricNumber),
      `${fieldPrefix}.matricNumber`,
    );
    const firstName = ensureNonEmptyString(student.firstName, `${fieldPrefix}.firstName`);
    const lastName = ensureNonEmptyString(student.lastName, `${fieldPrefix}.lastName`);
    const department = normalizeNullableText(student.department);
    const email = ensureValidEmail(student.email);
    const phoneNumber = normalizeNullableText(normalizePhoneNumber(student.phoneNumber));

    return {
      matricNumber,
      firstName,
      lastName,
      department,
      email,
      phoneNumber,
    };
  });

  const uniqueMatricNumbers = new Set(normalizedStudents.map((student) => student.matricNumber));
  if (uniqueMatricNumbers.size !== normalizedStudents.length) {
    throw createHttpError(400, 'Each student in the roster must have a unique matric number.');
  }

  const course = await prisma.$transaction(async (tx) => {
    const nextCourse = await tx.course.upsert({
      where: {
        code: normalizedCourseCode,
      },
      create: {
        code: normalizedCourseCode,
        title: normalizedCourseTitle,
        lecturerId: normalizedLecturerId,
      },
      update: {
        title: normalizedCourseTitle,
        lecturerId: normalizedLecturerId,
      },
    });

    const studentIds = [];
    for (const student of normalizedStudents) {
      const savedStudent = await tx.student.upsert({
        where: {
          matricNumber: student.matricNumber,
        },
        create: student,
        update: student,
      });
      studentIds.push(savedStudent.id);
    }

    await tx.courseEnrollment.deleteMany({
      where: {
        courseId: nextCourse.id,
      },
    });

    if (studentIds.length > 0) {
      await tx.courseEnrollment.createMany({
        data: studentIds.map((studentId) => ({
          courseId: nextCourse.id,
          studentId,
        })),
      });
    }

    return tx.course.findUnique({
      where: { id: nextCourse.id },
      include: {
        enrollments: {
          include: {
            student: true,
          },
          orderBy: {
            student: {
              matricNumber: 'asc',
            },
          },
        },
      },
    });
  });

  return serializeCourse(course);
}
