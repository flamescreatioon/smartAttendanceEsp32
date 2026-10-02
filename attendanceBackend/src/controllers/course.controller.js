import {
  getCourseRosterByCode,
  getCoursesForDashboard,
  upsertCourseRoster,
} from '../services/course.service.js';

export async function listCourses(req, res, next) {
  try {
    const courses = await getCoursesForDashboard();

    return res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCourseRoster(req, res, next) {
  try {
    const course = await getCourseRosterByCode(req.params.courseCode);

    return res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    return next(error);
  }
}

export async function saveCourseRoster(req, res, next) {
  try {
    const {
      courseTitle = null,
      lecturerId = null,
      students = [],
    } = req.body ?? {};

    const course = await upsertCourseRoster({
      courseCode: req.params.courseCode,
      courseTitle,
      lecturerId,
      students,
    });

    return res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    return next(error);
  }
}
