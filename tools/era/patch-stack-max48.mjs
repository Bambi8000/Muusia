/* patch-stack-max48.mjs — raise Stack View sheet cap 12 -> 48.
 *
 * Mesh Slice cuts objects into up to 200 sheets; ANIMATE already allows 999
 * frames and the per-frame exports (SVG xN / DXF xN / G-code xN) are uncapped.
 * Only the Stack View 3D preview clamps at MAX_SHEETS = 12. 48 keeps the
 * cached-canvas memory sane while covering real lamp builds.
 *
 * Anchored, MISS-aborts, idempotent (SKIP when already applied).
 * Usage: node tools/era/patch-stack-max48.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/stack-view.jsx";
let src = readFileSync(FILE, "utf8");

if (src.includes("MAX_SHEETS = 48")) {
  console.log("SKIP: already applied (MAX_SHEETS = 48)");
  process.exit(0);
}

const edits = [
  {
    name: "MAX_SHEETS constant",
    find: "export const MAX_SHEETS = 12;          /* hard cap on stacked sheets */",
    repl: "export const MAX_SHEETS = 48;          /* hard cap on stacked sheets */",
  },
  {
    name: "header comment",
    find: "each frame becomes one sheet. Capped at 12.",
    repl: "each frame becomes one sheet. Capped at 48.",
  },
  {
    name: "Frames button tooltip",
    find: "(ANIMATE frame count, max 12)",
    repl: "(ANIMATE frame count, max 48)",
  },
];

for (const e of edits) {
  if (!src.includes(e.find)) {
    console.error("MISS: anchor not found for '" + e.name + "' - aborting, file untouched");
    process.exit(1);
  }
  if (src.split(e.find).length !== 2) {
    console.error("MISS: anchor for '" + e.name + "' is not unique - aborting, file untouched");
    process.exit(1);
  }
}
for (const e of edits) {
  src = src.replace(e.find, e.repl);
  console.log("  OK  " + e.name);
}
writeFileSync(FILE, src);
console.log("APPLIED: " + FILE + " - Stack View sheet cap is now 48");
