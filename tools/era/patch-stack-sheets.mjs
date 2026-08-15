/* patch-stack-sheets.mjs — Sheets-node auto-detection for Stack View.
 *
 * Requires patch-stack-view.mjs + patch-stack-export.mjs. Adds a
 * sheetsCount prop to the <StackView> wiring: a recursive scan of the
 * whole graph (groups included) for nodes of type "sheets", returning the
 * largest wired-input count found — Stack View then takes its sheet count
 * from the node instead of the ANIMATE frame count. Param wires
 * (toPort "p:key") are excluded; only numeric data-pin ports count.
 * Anchored, MISS aborts, idempotent.
 *   node tools/era/patch-stack-sheets.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const SENTINEL = "sheetsCount={";
if (src.includes(SENTINEL)) {
  console.log("SKIP  patch-stack-sheets already applied");
  process.exit(0);
}
if (!src.includes("buildZip={buildZip}")) {
  console.log("MISS  export props not wired — run tools/era/patch-stack-export.mjs first");
  process.exit(1);
}

const anchor = "buildZip={buildZip} projName={projName} fontStrokes={fontStrokes}";
const insert = `
          sheetsCount={(() => { let m = 0; const walk = (g) => { for (const nd of g.nodes) { if (nd.type === "sheets") { const c = new Set(g.edges.filter((ed) => ed.to === nd.id && typeof ed.toPort === "number").map((ed) => ed.toPort)).size; if (c > m) m = c; } if (nd.type === "group" && nd.data) walk(nd.data); } }; walk(root); return m; })()}`;

const parts = src.split(anchor);
if (parts.length !== 2) {
  console.log(`MISS  props anchor (${parts.length - 1} hits) — nothing written`);
  process.exit(1);
}
console.log("OK    props anchor");
writeFileSync(FILE, parts[0] + anchor + insert + parts[1]);
console.log("DONE  1 edit written to src/App.jsx");
