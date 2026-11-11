import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinutes, formatTime12, findConflict, validateCourse, filterCourses, totalUnits } from "./logic.js";

// Starter tests to show the setup works. Add your own, and check expected
// values against the README (the spec), not against what the code currently does.

test("toMinutes converts HH:MM to minutes since midnight", () => {
  assert.equal(toMinutes("09:30"), 570);
});

test("formatTime12 formats an afternoon time", () => {
  assert.equal(formatTime12("14:50"), "2:50 PM");
});

test("findConflict ignores courses on different days", () => {
  const existing = [{ number: "A", name: "A", units: 9, days: ["M"], start: "09:00", end: "10:00" }];
  const candidate = { days: ["T"], start: "09:00", end: "10:00" };
  assert.equal(findConflict(existing, candidate), null);
});

// Desired Tests
// Make sure no courses are considered overlapping if the start time and end time of two classes are equivalent (back to back is ok and not a conflict)
test("findConflict allows a course that starts exactly when an existing one ends", () => {
  const existing = [{ number: "A", name: "A", units: 9, days: ["M"], start: "09:00", end: "10:20" }];
  const candidate = { days: ["M"], start: "10:20", end: "11:40" };
  assert.equal(findConflict(existing, candidate), null);
});

test("findConflict allows a course that ends exactly when an existing one starts", () => {
  const existing = [{ number: "A", name: "A", units: 9, days: ["M"], start: "10:20", end: "11:40" }];
  const candidate = { days: ["M"], start: "09:00", end: "10:20" };
  assert.equal(findConflict(existing, candidate), null);
});

// Make sure that a genuine overlap is detected and prohibited
test("findConflict returns the existing course when times genuinely overlap on a shared day", () => {
  const existing = [{ number: "A", name: "A", units: 9, days: ["M", "W"], start: "09:00", end: "10:20" }];
  const candidate = { days: ["W"], start: "10:00", end: "11:00" };
  assert.equal(findConflict(existing, candidate), existing[0]);
});

test("findConflict detects a candidate that fully contains an existing course", () => {
  const existing = [{ number: "A", name: "A", units: 9, days: ["T"], start: "10:00", end: "11:00" }];
  const candidate = { days: ["T"], start: "09:00", end: "12:00" };
  assert.equal(findConflict(existing, candidate), existing[0]);
});

// Course numbers should be only numbers and dashes
test("validateCourse accepts a course number made of digits and a dash", () => {
  const course = { number: "15-113", name: "Effective Coding", days: ["M"], start: "09:00", end: "10:00" };
  assert.equal(validateCourse(course), null);
});

test("validateCourse rejects a course number containing letters", () => {
  const course = { number: "15-11A", name: "Effective Coding", days: ["M"], start: "09:00", end: "10:00" };
  assert.notEqual(validateCourse(course), null);
});

test("validateCourse rejects a course number containing other symbols or spaces", () => {
  for (const number of ["15 113", "15_113", "15-113!"]) {
    const course = { number, name: "Effective Coding", days: ["M"], start: "09:00", end: "10:00" };
    assert.notEqual(validateCourse(course), null, `expected "${number}" to be rejected`);
  }
});

// Course end times must be after start times
test("validateCourse rejects an end time before the start time", () => {
  const course = { number: "15-113", name: "A", days: ["M"], start: "10:00", end: "09:00" };
  assert.equal(validateCourse(course), "The end time has to be after the start time.");
});

test("validateCourse rejects an end time equal to the start time", () => {
  const course = { number: "15-113", name: "A", days: ["M"], start: "10:00", end: "10:00" };
  assert.equal(validateCourse(course), "The end time has to be after the start time.");
});

test("validateCourse accepts an end time after the start time", () => {
  const course = { number: "15-113", name: "A", days: ["M"], start: "09:00", end: "10:00" };
  assert.equal(validateCourse(course), null);
});

// Every course entered should be tracked (for later display in the table below)
// The course list itself lives in app.js, so these check the logic.js functions
// the table and unit total are built from: every course must come back
// from filterCourses (with an empty filter) and be counted by totalUnits.
test("filterCourses with an empty query returns every course with its index", () => {
  const courses = [
    { number: "15-113", name: "Effective Coding", units: 9, days: ["M"], start: "09:00", end: "10:00" },
    { number: "21-120", name: "Calculus", units: 10, days: ["T"], start: "09:00", end: "10:00" },
    { number: "76-101", name: "Argument", units: 9, days: ["W"], start: "09:00", end: "10:00" }
  ];
  const result = filterCourses(courses, "");
  assert.deepEqual(result, [
    { course: courses[0], index: 0 },
    { course: courses[1], index: 1 },
    { course: courses[2], index: 2 }
  ]);
});

test("totalUnits counts every course entered", () => {
  const courses = [
    { units: 9 },
    { units: 10 },
    { units: 12 }
  ];
  assert.equal(totalUnits(courses), 31);
});

test("a newly added course is included in the table rows and the unit total", () => {
  const courses = [{ number: "15-113", name: "Effective Coding", units: 9, days: ["M"], start: "09:00", end: "10:00" }];
  const added = { number: "21-120", name: "Calculus", units: 10, days: ["T"], start: "09:00", end: "10:00" };
  assert.equal(validateCourse(added), null);
  assert.equal(findConflict(courses, added), null);
  courses.push(added);

  const rows = filterCourses(courses, "");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].course, added);
  assert.equal(totalUnits(courses), 19);
});
