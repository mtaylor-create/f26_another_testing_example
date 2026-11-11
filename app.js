// Schedule Planner: DOM layer.
//
// This entire project was written by Claude, Anthropic's AI model, with very little human
// oversight. The course staff chose to generate it that way and to say so openly, rather
// than quietly passing it off as hand-written. Read it the way you should read any code you
// did not write yourself: carefully, and without assuming it is correct.
//
// The sample course data below is invented. The course numbers are real; the units, meeting
// times, and days are not.
//
// All testable logic lives in logic.js. This file only reads the page, calls that logic,
// and writes the results back to the page.

import {
  DAYS, DAY_NAMES, FIRST_HOUR, LAST_HOUR, HOUR_PX, UNIT_LIMIT,
  formatTime12, formatHourLabel, validateCourse, findConflict,
  totalUnits, isOverLimit, filterCourses, blockPosition
} from "./logic.js";

let courses = [
  { number: "15-113", name: "Effective Coding with AI",    units: 9,  days: ["M", "W"],      start: "09:00", end: "10:20" },
  { number: "21-120", name: "Differential Calculus",       units: 10, days: ["M", "W", "F"], start: "10:30", end: "11:50" },
  { number: "76-101", name: "Interpretation and Argument", units: 9,  days: ["T", "R"],      start: "13:30", end: "14:50" },
  { number: "15-122", name: "Imperative Computation",      units: 12, days: ["T", "R"],      start: "15:00", end: "16:20" }
];

function showMessage(text, kind) {
  const message = document.getElementById("message");
  message.textContent = text;
  message.className = "message " + kind;
}

function addCourse() {
  const candidate = {
    number: document.getElementById("number").value.trim(),
    name: document.getElementById("name").value.trim(),
    units: parseInt(document.getElementById("units").value),
    start: document.getElementById("start").value,
    end: document.getElementById("end").value,
    days: []
  };
  document.querySelectorAll(".day").forEach(function (box) {
    if (box.checked) {
      candidate.days.push(box.value);
    }
  });

  const error = validateCourse(candidate);
  if (error) {
    showMessage(error, "error");
    return;
  }

  const conflict = findConflict(courses, candidate);
  if (conflict) {
    showMessage("That conflicts with " + conflict.number + " (" + conflict.name + ").", "error");
    return;
  }

  courses.push(candidate);

  document.getElementById("number").value = "";
  document.getElementById("name").value = "";
  document.getElementById("units").value = "";
  document.querySelectorAll(".day").forEach(function (box) {
    box.checked = false;
  });

  showMessage("Added " + candidate.number + ".", "ok");
  render();
}

function removeCourse(index) {
  courses.splice(index, 1);
  document.getElementById("message").textContent = "";
  render();
}

function render() {
  const query = document.getElementById("search").value;

  const total = totalUnits(courses);
  const over = isOverLimit(total);

  const shown = renderRoster(query);
  renderWeek();

  document.getElementById("stats").innerHTML =
    '<span class="' + (over ? "over" : "") + '">' + total + " units</span> &middot; " +
    courses.length + (courses.length === 1 ? " course" : " courses");

  let summary = shown + " of " + courses.length + " shown.";
  if (over) {
    summary += ' <span class="over">Over the ' + UNIT_LIMIT + " unit limit, so this needs approval.</span>";
  }
  document.getElementById("summary").innerHTML = summary;
}

function renderRoster(query) {
  const rows = document.getElementById("rows");
  rows.innerHTML = "";

  const matches = filterCourses(courses, query);

  matches.forEach(function (match) {
    const course = match.course;
    const tr = document.createElement("tr");
    // No inline onclick: the remove button carries its index in data-index and
    // is wired up by the click listener on #rows (see the bottom of this file).
    tr.innerHTML =
      "<td>" + course.number + "</td>" +
      "<td>" + course.name + "</td>" +
      '<td class="num">' + course.units + "</td>" +
      '<td class="days">' + course.days.join("") + "</td>" +
      '<td class="time">' + formatTime12(course.start) + " to " + formatTime12(course.end) + "</td>" +
      '<td class="actions"><button class="btn-remove" title="Remove ' + course.number +
      '" data-index="' + match.index + '">&times;</button></td>';
    rows.appendChild(tr);
  });

  if (matches.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="empty" colspan="6">' +
      (courses.length === 0 ? "No courses yet. Add one to see your week."
                            : "No courses match that filter.") + "</td>";
    rows.appendChild(tr);
  }

  return matches.length;
}

function renderWeek() {
  const columnHeight = (LAST_HOUR - FIRST_HOUR + 1) * HOUR_PX;

  let head = '<div class="week-head"><div></div>';
  for (const day of DAYS) {
    head += "<div>" + DAY_NAMES[day] + "</div>";
  }
  head += "</div>";

  let gutter = '<div class="week-gutter">';
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    gutter += '<div class="hour">' + formatHourLabel(hour) + "</div>";
  }
  gutter += "</div>";

  let columns = "";
  DAYS.forEach(function (day) {
    columns += '<div class="week-col" style="height:' + columnHeight + 'px">';

    courses.forEach(function (course, index) {
      if (!course.days.includes(day)) {
        return;
      }
      const pos = blockPosition(course);
      columns +=
        '<div class="block tint-' + ((index % 5) + 1) + '" style="top:' + pos.top + "px;height:" + pos.height + 'px">' +
        '<span class="b-num">' + course.number + "</span>" +
        '<span class="b-time">' + formatTime12(course.start) + "</span>" +
        "</div>";
    });

    columns += "</div>";
  });

  document.getElementById("grid").innerHTML = head + '<div class="week-body">' + gutter + columns + "</div>";
}

// Event wiring (replaces the inline onclick/oninput attributes).
document.getElementById("add-btn").addEventListener("click", addCourse);
document.getElementById("search").addEventListener("input", render);
document.getElementById("rows").addEventListener("click", function (event) {
  const button = event.target.closest(".btn-remove");
  if (button) {
    removeCourse(Number(button.dataset.index));
  }
});

render();
