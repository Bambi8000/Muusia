/* patch-drag-release.mjs — fix the "stuck hand" node drag.
 *
 * Root cause: mouseup was handled only on the canvas area div. Releasing the
 * button over the palette, toolbar, right panel, focus preview panel, or
 * outside the browser window left drag.current set — the node then followed
 * the mouse on re-entry until the next click.
 *
 * Fix:
 *   - window-level mouseup + blur listeners clear drag / pending wire state
 *     anywhere (bubble phase: port finishWire handlers still run first, so
 *     wiring is unaffected)
 *   - onAreaMouseMove clears stale state when the primary button is not
 *     down (e.buttons guard — covers a mouseup the window never saw)
 *   - APP_VERSION bumped (read from disk, minor +1), HANDOFF history entry
 *
 * Anchored exact-string edits. MISS aborts before writing. Idempotent.
 * Run from repo root.
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

if (app.includes('window.addEventListener("mouseup", upAnywhere)')) {
  console.log("SKIP: drag release fix already applied");
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
  name: "window-level mouseup/blur cleanup",
  find: '  const onAreaMouseUp = () => { drag.current = null; pending.current = null; setPendingWire(null); };',
  replace: J([
    '  const onAreaMouseUp = () => { drag.current = null; pending.current = null; setPendingWire(null); };',
    '  /* Release anywhere: mouseup used to be handled only on the area div, so',
    '     releasing over the palette / panels / outside the window left',
    '     drag.current set and the node followed the mouse on re-entry. Bubble',
    '     phase: port finishWire handlers run before this, wiring unaffected. */',
    '  useEffect(() => {',
    '    const upAnywhere = () => { drag.current = null; pending.current = null; setPendingWire(null); };',
    '    window.addEventListener("mouseup", upAnywhere);',
    '    window.addEventListener("blur", upAnywhere);',
    '    return () => {',
    '      window.removeEventListener("mouseup", upAnywhere);',
    '      window.removeEventListener("blur", upAnywhere);',
    '    };',
    '  }, []);',
  ]),
});

edits.push({
  name: "onAreaMouseMove: clear stale drag when button is not down",
  find: J([
    '  const onAreaMouseMove = (e) => {',
    '    if (drag.current) {',
  ]),
  replace: J([
    '  const onAreaMouseMove = (e) => {',
    '    if (!(e.buttons & 1) && (drag.current || pending.current)) {',
    '      drag.current = null; pending.current = null; setPendingWire(null);',
    '      return;',
    '    }',
    '    if (drag.current) {',
  ]),
});

edits.push({
  name: "version bump " + oldV + " -> " + newV,
  find: 'APP_VERSION = "' + oldV + '"',
  replace: 'APP_VERSION = "' + newV + '"',
});

const hoffEdits = [];

hoffEdits.push({
  name: "HANDOFF: version history entry",
  find: '## Hard-won pitfalls (keep)',
  replace: J([
    '- **' + newV + '** drag release fix (era patch patch-drag-release.mjs): node',
    '  drag / pending wire state was cleared only by mouseup on the canvas area',
    '  div — releasing over the palette, panels, focus preview or outside the',
    '  window left the node following the mouse ("stuck hand"). Now window-level',
    '  mouseup + blur clear the state anywhere (bubble phase, so port finishWire',
    '  still wins), and onAreaMouseMove drops stale state whenever the primary',
    '  button is up (e.buttons guard).',
    '',
    '## Hard-won pitfalls (keep)',
  ]),
});

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
console.log("DONE: drag release fix applied, APP_VERSION " + oldV + " -> " + newV);
