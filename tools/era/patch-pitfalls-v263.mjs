/* patch-pitfalls-v263.mjs — two hard-won pitfalls from the v2.62/2.63
 * Stack View + Sheets sessions.
 *
 * Both come from the same root cause: an engine-facing contract written
 * from memory instead of read from source. Existing entries cover helper
 * SIGNATURES; these cover param-descriptor FIELD NAMES and the bake
 * wrapper shape. Anchored, MISS aborts, idempotent.
 *   node tools/era/patch-pitfalls-v263.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "docs/MUUSIA-HANDOFF.md";
let doc = readFileSync(FILE, "utf8");

if (doc.includes("Param descriptor FIELD NAMES")) {
  console.log("SKIP  patch-pitfalls-v263 already applied");
  process.exit(0);
}

const anchor = `- Browsers do NOT overwrite downloads (\`name (1).ext\`) — irrelevant post-C0 for
  code, still true for any downloaded file.`;

const insert = `
- Param descriptor FIELD NAMES are engine contract, not convention: a select
  param uses \`options\`, NOT \`opts\`. The inspector renders
  \`def.options.map(...)\` unguarded, so a wrong field name throws the moment
  the node's param card paints — and React unmounts the whole tree, i.e. the
  app goes WHITE the instant the node is added from the palette (v2.63
  Sheets). Worse, a hand-written validator can PASS the broken node when it
  asserts against the same wrong assumption; the v2.63 validator checked
  \`sel.opts\` and reported ALL OK. Read the field name out of an existing
  \`src/defs/nodes/*.js\` (or the inspector's renderer in App.jsx) before
  writing any descriptor, and make the validator assert the real field —
  same rule as the real-helpers rule, applied to descriptors.
- Injected helper RETURN SHAPES bite the same way: \`fontStrokes\` returns
  \`{strokes, width}\`, not an array. \`for (const s of fontStrokes(...))\`
  throws on a non-iterable and whites out the app (v2.62 Stack View sheet
  numbers). There is no error boundary in App.jsx — ANY throw inside a
  module's render or effect takes the entire UI down, so a feature that
  "crashes the browser" is almost always a contract typo, not a
  performance problem. Prove new helper use in a Node harness that imports
  the REAL \`src/defs/helpers.js\` before shipping.
- \`bake.mjs\` requires the lab file to BEGIN literally with \`({\` — a header
  comment above the literal fails the precheck with
  \`SKIP <key>: expected ({ ... }) wrapper\` (v2.63 Sheets). Documentation
  comments belong INSIDE the object literal, as the first thing after \`({\`.
  Same family as the IIFE rejection: the precheck is textual, not a parse.
- React overlays must HIDE, never UNMOUNT, cached-canvas content: a
  per-sheet visibility checkbox that renders \`cond ? null : <div>\` drops the
  canvas element, and when it remounts the draw effect does not re-run
  (visibility is not in its deps), so the sheet returns BLANK (v2.63 Stack
  View). Use \`display: "none"\`. Any \`useEffect\` that paints into a ref'd
  canvas has this hazard wherever conditional rendering can unmount it.`;

const parts = doc.split(anchor);
if (parts.length !== 2) {
  console.log(`MISS  pitfalls anchor (${parts.length - 1} hits) — nothing written`);
  process.exit(1);
}
console.log("OK    pitfalls anchor");
writeFileSync(FILE, parts[0] + anchor + insert + parts[1]);
console.log("DONE  4 pitfall entries written to docs/MUUSIA-HANDOFF.md");
