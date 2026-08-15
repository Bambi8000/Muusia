/* patch-stack-docs.mjs — docs batch for the Stack View release.
 *
 * Edits docs/MUUSIA-HANDOFF.md: adds the src/stack-view.jsx bullet to the
 * repo-layout list and a version-history entry before the pitfalls section.
 * The version number is READ FROM src/App.jsx at run time — run this AFTER
 * the APP_VERSION bump. Anchored, MISS aborts, idempotent.
 *   node tools/era/patch-stack-docs.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const APP = readFileSync("src/App.jsx", "utf8");
const vm = APP.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in src/App.jsx"); process.exit(1); }
const V = vm[1];

const FILE = "docs/MUUSIA-HANDOFF.md";
let doc = readFileSync(FILE, "utf8");

if (doc.includes("src/stack-view.jsx")) {
  console.log("SKIP  patch-stack-docs already applied");
  process.exit(0);
}

const edits = [
  {
    name: "1 repo-layout bullet",
    anchor: "  tools/era/patch-catalog-browser-v259.mjs.",
    insert: `
- \`src/stack-view.jsx\` — 3D layer stack preview + physical export (S /
  toolbar Stack): the drawing split into sheets (animation frames, max 12,
  or pens) and stacked as translucent plexi/glass panes in a rotatable
  CSS-3D view — drag to rotate, sheet spacing in mm, reverse order,
  per-sheet visibility, plexi tint, dark/paper/custom background,
  auto-orbit. Sheets render once to cached canvases; rotation never
  re-evaluates the graph. PHYSICAL EXPORT: per-sheet SVG/DXF/G-code files
  as ONE ZIP (buildZip — no browser multi-download prompt), sheet margin
  (physical sheet = canvas + margin), Mirror for back-painting (plot files
  only; preview stays the front view), drill marks M3/M4/M5 (clearance
  3.2/4.3/5.3 mm, corner inset param) and SFONT n/N sheet numbers on a
  selectable Mark pen. Preview shows margin + marks live. Mega Canvas and
  the stack don't combine. Self-contained (PENS/theme/evalFrame/exportText/
  buildZip/fontStrokes injected as props), wired via
  tools/era/patch-stack-view.mjs + tools/era/patch-stack-export.mjs.`,
  },
  {
    name: "2 version-history entry",
    anchor: "\n## Hard-won pitfalls (keep)",
    insert_before: true,
    insert: `
- **${V}** Stack View (3D layer stack preview, phase 1 of the layered
  plexi/glass workflow). NEW MODULE src/stack-view.jsx (dro/catalog
  pattern: self-contained, everything injected as props, wired by
  tools/era/patch-stack-view.mjs): a full-screen overlay — S key or the
  toolbar Stack button — that splits the drawing into sheets and stacks
  them in 3D as translucent panes. Sheet sources: *Frames* (per-frame
  graph re-evaluation via the exportAllFrames mechanism, lazy one frame
  per tick, capped at 12 sheets) and *Pens* (one evaluation split by pen
  index, full pen colors per sheet). Each sheet draws once onto its own
  transparent canvas (120k-point budget with a "trunc" badge); the stack
  is posed with CSS 3D (perspective + drag rotateX/rotateY + per-sheet
  translateZ centered on the stack middle), so rotating costs a CSS
  transform, never a re-evaluation. Controls: spacing (mm = sheet
  thickness + air gap), perspective amount, reverse order, per-sheet
  visibility, plexi outline/tint, dark/paper/custom background,
  auto-orbit. PHYSICAL EXPORT in the overlay
  (tools/era/patch-stack-export.mjs injects exportText/buildZip/
  projName/fontStrokes): per-sheet SVG/DXF/G-code files written as ONE
  ZIP via buildZip — sidesteps the browser multi-download permission
  entirely. Transforms shared by preview and export (WYSIWYG, decorate):
  sheet margin (physical sheet = canvas + margin per edge, art translated
  inward, marks in the margin zone), drill marks M3/M4/M5 (clearance
  3.2/4.3/5.3 mm, corner inset param, identical on every sheet), SFONT
  n/N sheet numbers, all on a selectable Mark pen; Mirror (for painting/
  engraving the sheet BACK) applies to the plot files only — the 3D
  preview always shows the front view. Export writes ALL sheets; hiding
  a sheet is a preview aid. Planned phase: a Sheets node (Merge-shaped
  frame-domain selector: input i passes on frame i). Validator
  tools/validate-stack-view.mjs extracts the pure functions VERBATIM
  from the module (splitByPens, sheetZ, mirrorX incl. z-component
  preservation and double-mirror identity, translatePS, drillMarks
  centers/radius/closed) plus contract sentinels and wiring checks.
  ALSO: the per-frame (ANIMATE) export gains DXF — exportAllFrames
  handles kind "dxf" via toDXF, a "DXF x N" button joins G-code/SVG in
  the panel, Help bullet updated (tools/era/patch-anim-dxf.mjs).
`,
  },
];

let fail = false;
for (const e of edits) {
  const parts = doc.split(e.anchor);
  if (parts.length !== 2) { console.log(`MISS  ${e.name} (${parts.length - 1} hits)`); fail = true; }
  else console.log(`OK    ${e.name}`);
}
if (fail) { console.log("ABORT nothing written"); process.exit(1); }

for (const e of edits) {
  const parts = doc.split(e.anchor);
  if (parts.length !== 2) { console.log(`ABORT ${e.name} anchor no longer unique — nothing written`); process.exit(1); }
  doc = e.insert_before
    ? parts[0] + e.insert + e.anchor + parts[1]
    : parts[0] + e.anchor + e.insert + parts[1];
}
writeFileSync(FILE, doc);
console.log(`DONE  2 edits written to ${FILE} (version ${V})`);
