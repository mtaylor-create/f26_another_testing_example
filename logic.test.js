import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinutes, formatTime12, findConflict } from "./logic.js";

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
