// Pure scheduling logic. Nothing in this file touches the DOM, so every function
// can be imported and unit tested on its own.

export const DAYS = ["M", "T", "W", "R", "F"];
export const DAY_NAMES = { M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri" };

export const FIRST_HOUR = 8;
export const LAST_HOUR = 20;
export const HOUR_PX = 46;
export const UNIT_LIMIT = 54;

// "09:30" -> 570 (minutes since midnight)
export function toMinutes(time) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

// "14:50" -> "2:50 PM"
export function formatTime12(time) {
  const hour = Number(time.slice(0, 2));
  return (hour % 12) + ":" + time.slice(3, 5) + (hour < 12 ? " AM" : " PM");
}

// Hour label for the week grid gutter: 13 -> "1 pm"
export function formatHourLabel(hour) {
  return (((hour + 11) % 12) + 1) + (hour < 12 ? " am" : " pm");
}

// Returns an error message string, or null if the input is valid.
// `course` is { number, name, days, start, end }.
export function validateCourse(course) {
  const courseNumberPattern = /^[0-9-]+$/;

  if (!course.number || !course.name) {
    return "Course number and title are both required.";
  }
  if (!courseNumberPattern.test(course.number)) {
    return "Course number can only contain digits and dashes.";
  }
  if (course.days.length === 0) {
    return "Pick at least one meeting day.";
  }
  if (toMinutes(course.end) <= toMinutes(course.start)) {
    return "The end time has to be after the start time.";
  }
  return null;
}

// Returns the first existing course that conflicts with `candidate`, or null.
export function findConflict(courses, candidate) {
  const startMinutes = toMinutes(candidate.start);
  const endMinutes = toMinutes(candidate.end);

  for (const course of courses) {
    let sharesADay = false;
    for (const day of candidate.days) {
      if (course.days.includes(day)) {
        sharesADay = true;
      }
    }
    if (!sharesADay) {
      continue;
    }

    const otherStart = toMinutes(course.start);
    const otherEnd = toMinutes(course.end);

    if (startMinutes < otherEnd && otherStart < endMinutes) {
      return course;
    }
  }
  return null;
}

export function totalUnits(courses) {
  let total = 0;
  for (const course of courses) {
    total += course.units;
  }
  return total;
}

export function isOverLimit(total) {
  return total > UNIT_LIMIT;
}

// Returns [{ course, index }] for courses matching the query. `index` is the
// position in the full `courses` array, which the UI needs for removal.
export function filterCourses(courses, query) {
  const q = query.trim().toLowerCase();
  const result = [];
  courses.forEach(function (course, index) {
    const haystack = (course.number + " " + course.name).toLowerCase();
    if (q && !haystack.includes(q)) {
      return;
    }
    result.push({ course: course, index: index });
  });
  return result;
}

// Vertical placement of a course block in the week grid, in pixels.
export function blockPosition(course) {
  const startMinutes = toMinutes(course.start);
  const endMinutes = toMinutes(course.end);
  const top = Math.max(0, ((startMinutes - FIRST_HOUR * 60) / 60) * HOUR_PX);
  const height = Math.max(22, ((endMinutes - startMinutes) / 60) * HOUR_PX - 2);
  return { top: top, height: height };
}
