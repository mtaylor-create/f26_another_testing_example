import { test } from "node:test";
import assert from "node:assert/strict";

// Tests for the DOM layer (app.js), including click-to-remove on the week grid.
//
// There is no browser and no dependencies here, so these tests install a tiny fake
// `document` and `window`, import a fresh copy of app.js (which renders immediately),
// and then drive the page the way a user would: fill in fields, fire the listeners that
// app.js registered, and read back what it wrote.
//
// The starting schedule is the sample data in app.js:
//   index 0  15-113  9 units   M W      9:00-10:20
//   index 1  21-120  10 units  M W F   10:30-11:50
//   index 2  76-101  9 units   T R     1:30-2:50 PM
//   index 3  15-122  12 units  T R     3:00-4:20 PM
// That is 40 units across 4 courses, and 9 blocks in the week grid.

class FakeElement {
  constructor() {
    this._html = "";
    this.children = [];
    this.listeners = {};
    this.textContent = "";
    this.className = "";
    this.value = "";
  }
  get innerHTML() { return this._html; }
  set innerHTML(html) { this._html = html; this.children = []; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  appendChild(child) { this.children.push(child); }
}

let instance = 0;

async function loadApp() {
  const elements = {};
  const dayBoxes = ["M", "T", "W", "R", "F"].map((value) => ({ value, checked: false }));
  const app = { confirmAnswer: true, confirmMessages: [] };

  const el = (id) => (elements[id] ??= new FakeElement());

  globalThis.document = {
    getElementById: el,
    createElement: () => new FakeElement(),
    querySelectorAll: (selector) => (selector === ".day" ? dayBoxes : [])
  };
  globalThis.window = {
    confirm(message) {
      app.confirmMessages.push(message);
      return app.confirmAnswer;
    }
  };

  // A query string gives every test its own copy of app.js and its own course list.
  await import("../app.js?instance=" + (++instance));

  // What the user sees.
  app.stats = () => el("stats").innerHTML;
  app.summary = () => el("summary").innerHTML;
  app.message = () => el("message");
  app.rowsHtml = () => el("rows").children.map((tr) => tr.innerHTML).join("\n");
  app.rowCount = () => el("rows").children.length;
  app.blocks = () => {
    const found = [];
    const pattern = /class="block[^"]*" data-index="(\d+)"[^>]*style="top:([\d.]+)px[^>]*>\s*<span class="b-num">([^<]+)<\/span>/g;
    let match;
    while ((match = pattern.exec(el("grid").innerHTML)) !== null) {
      found.push({ index: Number(match[1]), top: Number(match[2]), number: match[3] });
    }
    return found;
  };
  app.blocksFor = (number) => app.blocks().filter((block) => block.number === number);
  app.blockNumbers = () => [...new Set(app.blocks().map((block) => block.number))];

  // What the user does.
  app.clickBlock = (block) => {
    el("grid").listeners.click({
      target: { closest: (sel) => (sel === ".block" ? { dataset: { index: String(block.index) } } : null) }
    });
  };
  app.clickGridBackground = () => {
    el("grid").listeners.click({ target: { closest: () => null } });
  };
  app.clickRosterRemove = (index) => {
    el("rows").listeners.click({
      target: { closest: (sel) => (sel === ".btn-remove" ? { dataset: { index: String(index) } } : null) }
    });
  };
  app.filter = (query) => {
    el("search").value = query;
    el("search").listeners.input();
  };
  app.addCourse = ({ number, name, units, days, start, end }) => {
    el("number").value = number;
    el("name").value = name;
    el("units").value = units;
    el("start").value = start;
    el("end").value = end;
    for (const box of dayBoxes) {
      box.checked = days.includes(box.value);
    }
    el("add-btn").listeners.click();
  };

  return app;
}

// Fits the sample schedule: Fridays after the 3-day calculus course ends.
const friday = { number: "03-151", name: "Friday Seminar", units: "5", days: ["F"], start: "16:30", end: "17:30" };

// ----- initial render ------------------------------------------------------

test("the page starts with 4 courses, 40 units, and a block for each meeting day", async () => {
  const app = await loadApp();
  assert.match(app.stats(), /40 units/);
  assert.match(app.stats(), /4 courses/);
  assert.match(app.summary(), /4 of 4 shown/);
  assert.equal(app.rowCount(), 4);
});

test("every block in the week grid carries the index of its course", async () => {
  const app = await loadApp();
  const indexes = {};
  for (const block of app.blocks()) {
    (indexes[block.number] ??= []).push(block.index);
  }
  assert.deepEqual(indexes, {
    "15-113": [0, 0],
    "21-120": [1, 1, 1],
    "76-101": [2, 2],
    "15-122": [3, 3]
  });
});

// ----- click a block to remove a course (the new feature) ------------------

test("clicking a block asks for confirmation and names the course", async () => {
  const app = await loadApp();
  app.clickBlock(app.blocksFor("21-120")[0]);
  assert.equal(app.confirmMessages.length, 1);
  assert.match(app.confirmMessages[0], /21-120/);
  assert.match(app.confirmMessages[0], /Differential Calculus/);
});

test("confirming removes the whole course from the roster, the grid, and the totals", async () => {
  const app = await loadApp();
  // Click the middle (Wednesday) block of a three-day course, not the first.
  app.clickBlock(app.blocksFor("21-120")[1]);

  assert.doesNotMatch(app.rowsHtml(), /21-120/);
  assert.equal(app.rowCount(), 3);
  assert.deepEqual(app.blockNumbers(), ["15-113", "76-101", "15-122"]);
  assert.equal(app.blocks().length, 6); // all three of its blocks are gone, the other six remain
  assert.match(app.stats(), /30 units/);
  assert.match(app.stats(), /3 courses/);
  assert.match(app.summary(), /3 of 3 shown/);
});

test("removing the first and the last course in the list each remove the right one", async () => {
  const app = await loadApp();
  app.clickBlock(app.blocksFor("15-113")[0]);
  assert.deepEqual(app.blockNumbers(), ["21-120", "76-101", "15-122"]);
  app.clickBlock(app.blocksFor("15-122")[0]);
  assert.deepEqual(app.blockNumbers(), ["21-120", "76-101"]);
  assert.match(app.stats(), /19 units/);
});

test("declining the confirmation leaves the schedule completely unchanged", async () => {
  const app = await loadApp();
  app.confirmAnswer = false;
  app.clickBlock(app.blocksFor("15-113")[0]);

  assert.equal(app.confirmMessages.length, 1);
  assert.equal(app.rowCount(), 4);
  assert.equal(app.blocks().length, 9);
  assert.match(app.stats(), /40 units/);
  assert.match(app.stats(), /4 courses/);
});

test("clicking empty space in the grid does not prompt or remove anything", async () => {
  const app = await loadApp();
  app.clickGridBackground();
  assert.equal(app.confirmMessages.length, 0);
  assert.equal(app.rowCount(), 4);
});

test("a block pointing at a course that no longer exists is ignored", async () => {
  const app = await loadApp();
  app.clickBlock({ index: 99 });
  assert.equal(app.confirmMessages.length, 0);
  assert.equal(app.rowCount(), 4);
});

test("removing every course shows the empty state with zero units", async () => {
  const app = await loadApp();
  for (let i = 0; i < 4; i++) {
    app.clickBlock(app.blocks()[0]);
  }
  assert.equal(app.blocks().length, 0);
  assert.equal(app.rowCount(), 1);
  assert.match(app.rowsHtml(), /No courses yet/);
  assert.match(app.stats(), /0 units/);
  assert.match(app.stats(), /0 courses/);
});

test("removing a course clears any earlier message", async () => {
  const app = await loadApp();
  app.addCourse(friday);
  assert.equal(app.message().textContent, "Added 03-151.");
  app.clickBlock(app.blocksFor("15-113")[0]);
  assert.equal(app.message().textContent, "");
});

test("removing a course frees its time slot for a new course", async () => {
  const app = await loadApp();
  const calc = { number: "21-127", name: "Concepts", units: "9", days: ["M", "W", "F"], start: "10:30", end: "11:50" };

  app.addCourse(calc);
  assert.match(app.message().className, /error/, "slot should be taken before removal");

  app.clickBlock(app.blocksFor("21-120")[0]);
  app.addCourse(calc);
  assert.match(app.message().className, /ok/);
  assert.match(app.rowsHtml(), /21-127/);
});

test("a course added later can be removed by clicking its block", async () => {
  const app = await loadApp();
  app.addCourse(friday);
  assert.deepEqual(app.blocksFor("03-151").map((block) => block.index), [4]);

  app.clickBlock(app.blocksFor("03-151")[0]);
  assert.doesNotMatch(app.rowsHtml(), /03-151/);
  assert.match(app.stats(), /40 units/);
});

test("removing a course brings the total back under the unit limit", async () => {
  const app = await loadApp();
  app.addCourse({ ...friday, units: "15" });
  assert.match(app.summary(), /Over the 54 unit limit/);
  app.clickBlock(app.blocksFor("03-151")[0]);
  assert.doesNotMatch(app.summary(), /Over the 54 unit limit/);
});

// ----- removal while a filter is active ------------------------------------

test("clicking a block while filtered removes that course, not a neighbour", async () => {
  const app = await loadApp();
  app.filter("imperative");
  // The filtered roster has one row, but the course is still index 3 in the full list.
  app.clickBlock(app.blocksFor("15-122")[0]);

  app.filter("");
  assert.deepEqual(app.blockNumbers(), ["15-113", "21-120", "76-101"]);
  assert.match(app.stats(), /28 units/);
});

test("the roster remove button while filtered removes the right course", async () => {
  const app = await loadApp();
  app.filter("calc");
  const index = Number(/data-index="(\d+)"/.exec(app.rowsHtml())[1]);
  assert.equal(index, 1);

  app.clickRosterRemove(index);
  app.filter("");
  assert.doesNotMatch(app.rowsHtml(), /21-120/);
  assert.equal(app.rowCount(), 3);
});

// ----- README: Filtering ---------------------------------------------------

test("filtering changes the listed rows but never the unit total", async () => {
  const app = await loadApp();
  app.filter("calc");
  assert.equal(app.rowCount(), 1);
  assert.match(app.summary(), /1 of 4 shown/);
  assert.match(app.stats(), /40 units/);
});

test("the unit total includes a course added while a filter hides it", async () => {
  const app = await loadApp();
  app.filter("calc");
  app.addCourse(friday);
  assert.equal(app.rowCount(), 1);
  assert.match(app.summary(), /1 of 5 shown/);
  assert.match(app.stats(), /45 units/);
});

test("filtering changes which blocks are listed in the week grid", async () => {
  const app = await loadApp();
  app.filter("imperative");
  assert.deepEqual(app.blockNumbers(), ["15-122"]);
});

test("a filter with no matches shows a no-match message", async () => {
  const app = await loadApp();
  app.filter("zzz");
  assert.match(app.rowsHtml(), /No courses match that filter/);
});

// ----- README: Conflicts, Units, Required fields ----------------------------

test("adding a valid course puts it in the roster, the grid, and the unit total", async () => {
  const app = await loadApp();
  app.addCourse(friday);
  assert.equal(app.message().textContent, "Added 03-151.");
  assert.match(app.rowsHtml(), /4:30 PM to 5:30 PM/);
  assert.equal(app.blocksFor("03-151").length, 1);
  assert.match(app.stats(), /45 units/);
  assert.match(app.stats(), /5 courses/);
});

test("a conflicting course is rejected and names the course it conflicts with", async () => {
  const app = await loadApp();
  app.addCourse({ number: "99-999", name: "Clash", units: "9", days: ["M"], start: "09:30", end: "10:00" });
  assert.match(app.message().className, /error/);
  assert.match(app.message().textContent, /15-113/);
  assert.equal(app.rowCount(), 4);
});

test("a total of exactly 54 units is not flagged, but 55 is", async () => {
  const at54 = await loadApp();
  at54.addCourse({ ...friday, units: "14" });
  assert.match(at54.stats(), /54 units/);
  assert.doesNotMatch(at54.summary(), /Over the 54 unit limit/);

  const at55 = await loadApp();
  at55.addCourse({ ...friday, units: "15" });
  assert.match(at55.stats(), /55 units/);
  assert.match(at55.summary(), /Over the 54 unit limit/);
});

for (const units of ["1", "99"]) {
  test(`units of ${units} are accepted`, async () => {
    const app = await loadApp();
    app.addCourse({ ...friday, units });
    assert.match(app.message().className, /ok/);
  });
}

for (const units of ["0", "100", "-3", "abc", "", "9.5", "3x"]) {
  test(`units of "${units}" are rejected with a message and nothing is added`, async () => {
    const app = await loadApp();
    app.addCourse({ ...friday, units });
    assert.match(app.message().className, /error/);
    assert.notEqual(app.message().textContent, "");
    assert.equal(app.rowCount(), 4);
    assert.match(app.stats(), /40 units/);
  });
}

for (const [label, overrides] of [
  ["no title", { name: "" }],
  ["a whitespace-only title", { name: "   " }],
  ["no course number", { number: "" }],
  ["no days checked", { days: [] }]
]) {
  test(`a course with ${label} is rejected and not added`, async () => {
    const app = await loadApp();
    app.addCourse({ ...friday, ...overrides });
    assert.match(app.message().className, /error/);
    assert.equal(app.rowCount(), 4);
  });
}

test("a course before 8 am is listed and its block is clamped to the top of the grid", async () => {
  const app = await loadApp();
  app.addCourse({ number: "03-100", name: "Early Bird", units: "9", days: ["F"], start: "07:00", end: "08:30" });
  assert.match(app.rowsHtml(), /03-100/);
  assert.deepEqual(app.blocksFor("03-100").map((block) => block.top), [0]);
});
