import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAYS, DAY_NAMES, FIRST_HOUR, LAST_HOUR,
  toMinutes, formatTime12, formatHourLabel, findConflict, validateCourse,
  filterCourses, totalUnits, isOverLimit, blockPosition
} from "../logic.js";

// Checked against the README spec, not against what the code currently does.
// logic.test.js holds the starter tests; this file only adds what they do not cover.

function makeCourse(overrides) {
  return Object.assign(
    { number: "15-113", name: "Effective Coding", units: 9, days: ["M"], start: "09:00", end: "10:00" },
    overrides
  );
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to be close to ${expected}`);
}

// One test per row, so every failing case is reported rather than only the first.
function each(name, rows, check) {
  for (const row of rows) {
    test(`${name}: ${row.map(String).join(" -> ")}`, () => check(...row));
  }
}

// ----- constants -----------------------------------------------------------

test("the week grid spans 8 am to 8 pm, Monday to Friday, and every day has a name", () => {
  assert.equal(FIRST_HOUR, 8);
  assert.equal(LAST_HOUR, 20);
  assert.deepEqual(DAYS, ["M", "T", "W", "R", "F"]);
  for (const day of DAYS) {
    assert.equal(typeof DAY_NAMES[day], "string", `missing display name for ${day}`);
  }
});

// ----- time conversion and formatting (README: Times) ----------------------

each("toMinutes", [["00:00", 0], ["08:05", 485], ["12:00", 720], ["23:59", 1439]],
  (time, expected) => assert.equal(toMinutes(time), expected));

each("formatTime12", [
  ["09:00", "9:00 AM"],
  ["11:59", "11:59 AM"],
  ["12:00", "12:00 PM"],
  ["12:30", "12:30 PM"],
  ["13:00", "1:00 PM"],
  ["23:59", "11:59 PM"],
  ["00:00", "12:00 AM"],
  ["00:30", "12:30 AM"]
], (time, expected) => assert.equal(formatTime12(time), expected));

each("formatHourLabel", [
  [0, "12 am"], [8, "8 am"], [11, "11 am"], [12, "12 pm"], [13, "1 pm"], [20, "8 pm"]
], (hour, expected) => assert.equal(formatHourLabel(hour), expected));

// ----- validateCourse (README: Required fields, Units) ---------------------

each("validateCourse requires number and title", [[{ number: "" }], [{ name: "" }]],
  (overrides) => assert.equal(validateCourse(makeCourse(overrides)), "Course number and title are both required."));

test("validateCourse requires at least one meeting day", () => {
  assert.equal(validateCourse(makeCourse({ days: [] })), "Pick at least one meeting day.");
});

// The starter tests only try an uppercase letter, a space, an underscore, and "!".
each("validateCourse rejects number", [["15-11a"], ["abc"], ["15.113"], [" 15-113"]],
  (number) => assert.equal(
    validateCourse(makeCourse({ number })),
    "Course number can only contain digits and dashes."
  ));

test("validateCourse accepts a number with no dash", () => {
  assert.equal(validateCourse(makeCourse({ number: "113" })), null);
});

each("validateCourse accepts units", [[1], [9], [99]],
  (units) => assert.equal(validateCourse(makeCourse({ units })), null));

each("validateCourse rejects units", [[0], [-1], [100], [9.5], [NaN], [Infinity], [undefined]],
  (units) => assert.equal(typeof validateCourse(makeCourse({ units })), "string"));

// ----- findConflict (README: Conflicts) ------------------------------------
// The starter tests cover back-to-back, different days, partial overlap, and a
// candidate that contains the existing course.

test("findConflict returns null when there are no existing courses", () => {
  assert.equal(findConflict([], makeCourse()), null);
});

test("findConflict detects an identical time slot on the same day", () => {
  const existing = [makeCourse()];
  assert.equal(findConflict(existing, makeCourse({ number: "B" })), existing[0]);
});

test("findConflict detects a candidate that sits inside an existing course", () => {
  const existing = [makeCourse({ start: "09:00", end: "12:00" })];
  assert.equal(findConflict(existing, makeCourse({ start: "10:00", end: "11:00" })), existing[0]);
});

test("findConflict detects a candidate that overlaps the start of an existing course", () => {
  const existing = [makeCourse({ start: "10:00", end: "11:00" })];
  assert.equal(findConflict(existing, makeCourse({ start: "09:00", end: "10:30" })), existing[0]);
});

test("findConflict treats a one minute overlap as a conflict", () => {
  const existing = [makeCourse({ start: "09:00", end: "10:20" })];
  assert.equal(findConflict(existing, makeCourse({ start: "10:19", end: "11:00" })), existing[0]);
});

test("findConflict detects a conflict when only one of several days is shared", () => {
  const existing = [makeCourse({ days: ["M", "W", "F"] })];
  assert.equal(findConflict(existing, makeCourse({ days: ["T", "F"] })), existing[0]);
});

test("findConflict skips non-conflicting courses to find a later conflict", () => {
  const existing = [
    makeCourse({ number: "A", days: ["T"] }),
    makeCourse({ number: "B", start: "13:00", end: "14:00" }),
    makeCourse({ number: "C" })
  ];
  assert.equal(findConflict(existing, makeCourse({ number: "D" })), existing[2]);
});

test("findConflict returns the first conflicting course when several conflict", () => {
  const existing = [makeCourse({ number: "A" }), makeCourse({ number: "B" })];
  assert.equal(findConflict(existing, makeCourse({ number: "C" })), existing[0]);
});

test("findConflict returns null for a candidate with no days", () => {
  assert.equal(findConflict([makeCourse()], makeCourse({ days: [] })), null);
});

// ----- totalUnits / isOverLimit (README: Units) ----------------------------
// "Covers every course, not just the filtered ones" is tested in app.test.js,
// where a filter exists; totalUnits itself never sees one.

test("totalUnits is 0 for an empty schedule", () => {
  assert.equal(totalUnits([]), 0);
});

each("isOverLimit", [[0, false], [53, false], [54, false], [55, true]],
  (total, expected) => assert.equal(isOverLimit(total), expected));

// ----- filterCourses (README: Filtering) -----------------------------------

const catalog = [
  makeCourse({ number: "15-113", name: "Effective Coding with AI" }),
  makeCourse({ number: "21-120", name: "Differential Calculus" }),
  makeCourse({ number: "15-122", name: "Imperative Computation" })
];

function indexes(query) {
  return filterCourses(catalog, query).map((match) => match.index);
}

each("filterCourses is case-insensitive", [["calc", [1]], ["CALC", [1]], ["IMPERATIVE", [2]]],
  (query, expected) => assert.deepEqual(indexes(query), expected));

each("filterCourses matches number or title, reporting positions in the full list", [
  ["21-120", [1]],        // number
  ["ferential", [1]],     // middle of a title
  ["15-", [0, 2]]         // shared number prefix
], (query, expected) => assert.deepEqual(indexes(query), expected));

each("filterCourses shows every course for a blank query", [[""], ["   "]],
  (query) => assert.deepEqual(indexes(query), [0, 1, 2]));

test("filterCourses ignores whitespace around the query", () => {
  assert.deepEqual(indexes("  calc  "), [1]);
});

test("filterCourses returns the matching course objects themselves", () => {
  assert.equal(filterCourses(catalog, "calc")[0].course, catalog[1]);
});

each("filterCourses returns nothing", [["zzz"], ["."], ["("], ["*"]],
  (query) => assert.deepEqual(indexes(query), []));

test("filterCourses returns nothing for an empty schedule", () => {
  assert.deepEqual(filterCourses([], ""), []);
  assert.deepEqual(filterCourses([], "calc"), []);
});

test("filterCourses does not match a query that spans the number and the title", () => {
  // The README says a query matches the number OR the title.
  assert.deepEqual(indexes("113 effective"), []);
});

// ----- blockPosition (README: The week grid) -------------------------------

each("blockPosition top", [
  ["08:00", 0],
  ["08:30", 23],
  ["09:00", 46],
  ["14:00", 276],
  ["07:00", 0],     // before the grid: clamped to the top
  ["00:00", 0]
], (start, expected) => assertClose(blockPosition(makeCourse({ start, end: "21:00" })).top, expected));

each("blockPosition height", [
  ["09:00", "10:00", 44],            // 46px per hour, minus a 2px gap
  ["09:00", "10:20", (80 / 60) * 46 - 2],
  ["09:00", "09:15", 22],            // very short: minimum height
  ["09:00", "09:31", 22],            // 21.77px computed: still clamped to the minimum
  ["09:00", "09:33", (33 / 60) * 46 - 2]   // 23.3px: just above the minimum, not clamped
], (start, end, expected) => assertClose(blockPosition(makeCourse({ start, end })).height, expected));
