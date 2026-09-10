/* patch-range-keys.mjs — F / L / Esc work while a range slider has focus.
 *
 * The v-focus-mode keydown guard let only Space through from focused range
 * inputs, so after dragging a fader F did nothing until you clicked outside
 * the node. Now Space, F, L and Escape pass through; arrows stay native
 * (slider value adjust) and Delete / letter shortcuts stay blocked so a
 * slider tweak can never accidentally delete or quick-add.
 *
 * Anchored exact-string edit. MISS aborts. Idempotent. Run from repo root.
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

const NEWLINE = '      if (tag === "input" && ityp === "range") { const rk = e.key.toLowerCase(); if (rk !== " " && rk !== "f" && rk !== "l" && rk !== "escape") return; }';

if (app.includes(NEWLINE)) {
  console.log("SKIP: range key passthrough already applied");
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

const edits = [{
  name: "range guard: pass Space, F, L and Escape through",
  find: '      if (tag === "input" && ityp === "range") { if (e.key !== " ") return; }',
  replace: NEWLINE,
}, {
  name: "version bump " + oldV + " -> " + newV,
  find: 'APP_VERSION = "' + oldV + '"',
  replace: 'APP_VERSION = "' + newV + '"',
}];

const hoffEdits = [{
  name: "HANDOFF: version history entry",
  find: '## Hard-won pitfalls (keep)',
  replace: J([
    '- **' + newV + '** range-slider key passthrough (era patch',
    '  patch-range-keys.mjs): the focus-mode keydown guard let only Space',
    '  through from a focused range input, so F did nothing right after a',
    '  fader drag. Space, F, L and Escape now pass through; arrows stay native',
    '  (slider value), Delete and letter shortcuts stay blocked from sliders.',
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
console.log("DONE: range key passthrough applied, APP_VERSION " + oldV + " -> " + newV);
