/* patch-stack-morph.mjs — Morph Layers joins Stack View's sheet-count
 * auto-detection.
 *
 * Requires patch-stack-sheets.mjs. Extends the sheetsCount graph walk:
 * a morphlayers node whose Output param is "Sheets" drives the sheet
 * count with its Layers param (Pens mode never does). Anchored, MISS
 * aborts, idempotent.
 *   node tools/era/patch-stack-morph.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const SENTINEL = 'nd.type === "morphlayers"';
if (src.includes(SENTINEL)) {
  console.log("SKIP  patch-stack-morph already applied");
  process.exit(0);
}

const anchor = '.map((ed) => ed.toPort)).size; if (c > m) m = c; } if (nd.type === "group" && nd.data) walk(nd.data); }';
const replace = '.map((ed) => ed.toPort)).size; if (c > m) m = c; } if (nd.type === "morphlayers" && nd.params && nd.params.output === "Sheets") { const c2 = Math.round(nd.params.layers) || 0; if (c2 > m) m = c2; } if (nd.type === "group" && nd.data) walk(nd.data); }';

const parts = src.split(anchor);
if (parts.length !== 2) {
  console.log(`MISS  walk anchor (${parts.length - 1} hits) — run tools/era/patch-stack-sheets.mjs first`);
  process.exit(1);
}
console.log("OK    walk anchor");
writeFileSync(FILE, parts[0] + replace + parts[1]);
console.log("DONE  1 edit written to src/App.jsx");
