/* patch-stack-export.mjs — physical-export props for the StackView wiring.
 *
 * Requires tools/era/patch-stack-view.mjs to be applied first. Adds
 * exportText / buildZip / projName / fontStrokes to the <StackView> render
 * block so the overlay can write per-sheet SVG/DXF/G-code files as one ZIP.
 * Anchored, MISS aborts, idempotent.
 *   node tools/era/patch-stack-export.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const SENTINEL = "buildZip={buildZip}";
if (src.includes(SENTINEL)) {
  console.log("SKIP  patch-stack-export already applied");
  process.exit(0);
}
if (!src.includes("<StackView")) {
  console.log("MISS  StackView not wired — run tools/era/patch-stack-view.mjs first");
  process.exit(1);
}

const anchor = "frameCount={frameCount} primaryPS={primaryPS}";
const insert = `
          exportText={(kind, ps, ctxE) => kind === "svg" ? toSVG(ps, ctxE) : kind === "dxf" ? toDXF(ps, ctxE) : toGcode(ps, ctxE, prof)}
          buildZip={buildZip} projName={projName} fontStrokes={fontStrokes}`;

const parts = src.split(anchor);
if (parts.length !== 2) {
  console.log(`MISS  props anchor (${parts.length - 1} hits) — nothing written`);
  process.exit(1);
}
console.log("OK    props anchor");
writeFileSync(FILE, parts[0] + anchor + insert + parts[1]);
console.log("DONE  1 edit written to src/App.jsx");
