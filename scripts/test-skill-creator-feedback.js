"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Blob } = require("node:buffer");

const viewer = fs.readFileSync(path.join(__dirname,
  "../plugins/srulik-toolkit/skills/skill-creator/eval-viewer/viewer.html"), "utf8");
const source = viewer.slice(viewer.indexOf("    function saveCurrentFeedback()"),
  viewer.indexOf("    function closeDoneDialog()"));
const tasks = [];
const urls = new Map();
let downloaded;
const anchor = {
  isConnected: false,
  click() {
    assert(this.isConnected, "feedback download anchor must be attached");
    tasks.push([0, () => {
      assert(urls.has(this.href), "feedback URL was revoked before the download started");
      assert.equal(this.download, "feedback.json");
      downloaded = urls.get(this.href);
    }]);
  },
  remove() { this.isConnected = false; },
};
const elements = {
  feedback: { value: "Synthetic feedback" },
  "feedback-status": {},
  "done-overlay": { classList: { add() {} } },
};
vm.runInNewContext(source + "\nshowDoneDialog();", {
  Blob, JSON,
  currentIndex: 0,
  feedbackMap: {},
  EMBEDDED_DATA: { runs: [{ id: "primary" }, { id: "baseline" }] },
  document: {
    body: { appendChild(a) { a.isConnected = true; } },
    createElement(tag) { assert.equal(tag, "a"); return anchor; },
    getElementById(id) { return elements[id]; },
  },
  URL: {
    createObjectURL(blob) { urls.set("blob:fixture", blob); return "blob:fixture"; },
    revokeObjectURL(url) { urls.delete(url); },
  },
  setTimeout(callback, delay) { tasks.push([delay, callback]); },
});
tasks.sort((a, b) => a[0] - b[0]).forEach(([, callback]) => callback());
assert.equal(anchor.isConnected, false);
assert.equal(urls.size, 0, "temporary feedback URL was not released");
downloaded.text().then(text => {
  assert.deepEqual(JSON.parse(text), {
    reviews: [{ run_id: "primary", feedback: "Synthetic feedback" },
      { run_id: "baseline", feedback: "" }],
    status: "complete",
  });
  process.stdout.write("Skill creator feedback download lifecycle passed.\n");
}).catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
