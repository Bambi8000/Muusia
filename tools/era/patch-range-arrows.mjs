/* patch-range-arrows.mjs — arrows navigate in focus mode even from a fader.
 *
 * After patch-range-keys, Space/F/L/Esc passed through from a focused range
 * slider but arrows stayed native (slider value adjust) — so right after a
 * fader drag the arrow navigation did nothing. Now, while focus mode is on,
 * arrow keys pass through from range sliders too and always navigate nodes;
 * the navigation branch blurs the active element so the stale slider focus
 * does not linger. Outside focus mode arrows on sliders stay native.
 *
 * Tradeoff (intentional): in focus mode a slider cannot be fine-tuned with
 * arrow keys — arrows are navigation there. Dragging works as always.
 *
 * Anchored exact-string edits. MISS aborts. Idempotent. Run from repo root.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "App.jsx");
if (!fs.existsSync(appPath)) {
  console.error("ABORT: src/App.jsx not found — run from the repo root");
  process.exit(1);
}
const handoffPath = ["docs/MUUSIA-HANDOFF.md", "MUUSIA-HANDOFF.md"]
  .map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
if (!handoffPath) {
  console.error("ABORT: MUUSIA-HANDOFF.md not found (looked in docs/ and root)");
  process.exit(1);
}

let app = fs.readFileSync(appPath, "utf8");
let hoff = fs.readFileSync(handoffPath, "utf8");

if (app.includes("rArrow")) {
  console.log("SKIP: range arrow passthrough already applied");
  process.exit(0);
}

const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) {
  console.error("ABORT: APP_VERSION not found in App.jsx");
  process.exit(1);
}
const oldV = vm[1] + "." + vm[2];
const newV = vm[1] + "." + (Number(vm[2]) + 1);

const J = (a) => a.join("\n");

const edits = [];

edits.push({
  name: "range guard: arrows pass through while focus mode is on",
  find: '      if (tag === "input" && ityp === "range") { const rk = e.key.toLowerCase(); if (rk !== " " && rk !== "f" && rk !== "l" && rk !== "escape") return; }',
  replace: '      if (tag === "input" && ityp === "range") { const rk = e.key.toLowerCase(); const rArrow = focusOn && e.key.startsWith("Arrow"); if (rk !== " " && rk !== "f" && rk !== "l" && rk !== "escape" && !rArrow) return; }',
});

edits.push({
  name: "arrow navigation: blur the active element (stale slider focus)",
  find: J([
    '      else if (focusOn && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {',
    '        e.preventDefault();',
    '        focusNav(e.key);',
    '      }',
  ]),
  replace: J([
    '      else if (focusOn && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {',
    '        e.preventDefault();',
    '        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();',
    '        focusNav(e.key);',
    '      }',
  ]),
});

edits.push({
  name: "version bump " + oldV + " -> " + newV,
  find: 'APP_VERSION = "' + oldV + '"',
  replace: 'APP_VERSION = "' + newV + '"',
});

const hoffEdits = [{
  name: "HANDOFF: version history entry",
  find: '## Hard-won pitfalls (keep)',
  replace: J([
    '- **' + newV + '** range arrow passthrough (era patch patch-range-arrows.mjs):',
    '  in focus mode arrow keys pass through from focused range sliders and',
    '  always navigate nodes (the branch blurs the stale slider focus first).',
    '  Intentional tradeoff: no arrow-key slider fine-tune while focus mode is',
    '  on; outside focus mode slider arrows stay native.',
    '',
    '## Hard-won pitfalls (keep)',
  ]),
}];

let miss = 0;
const check = (src, e, file) => {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error("MISS (" + n + " hits) [" + file + "] " + e.name); miss++; }
};
for (const e of edits) check(app, e, "App.jsx");
for (const e of hoffEdits) check(hoff, e, "HANDOFF");
if (miss) {
  console.error("ABORT: " + miss + " anchor(s) not found exactly once — nothing written");
  process.exit(1);
}

for (const e of edits) { app = app.split(e.find).join(e.replace); console.log("OK  " + e.name); }
for (const e of hoffEdits) { hoff = hoff.split(e.find).join(e.replace); console.log("OK  " + e.name); }

fs.writeFileSync(appPath, app);
fs.writeFileSync(handoffPath, hoff);
console.log("DONE: range arrow passthrough applied, APP_VERSION " + oldV + " -> " + newV);
