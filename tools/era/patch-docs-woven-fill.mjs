/* Era patch: docs for the Woven Ribbon Fill modes (Tracks / Rays / Square wave).
   Run once from the repo root after the version bump:  node tools/era/patch-docs-woven-fill.mjs
   Resolves docs/ paths, reads APP_VERSION from src/App.jsx; anchored edits, MISS aborts, SKIP if applied. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const find = (name) => { for (const d of ["docs", "."]) { const p = resolve(d, name); if (existsSync(p)) return p; } throw new Error("cannot find " + name); };
const NODES = find("MUUSIA-NODES.md"), HANDOFF = find("MUUSIA-HANDOFF.md");
const ver = (readFileSync(resolve("src/App.jsx"), "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!ver) { console.log("MISS APP_VERSION"); process.exit(1); }
let nodes = readFileSync(NODES, "utf8"), handoff = readFileSync(HANDOFF, "utf8");
if (nodes.includes("Rays replaces them with a perpendicular comb")) { console.log("SKIP already applied"); process.exit(0); }
const report = []; let miss = false;
const rep = (text, anchor, add, label) => {
  const n = text.split(anchor).length - 1;
  if (n !== 1) { report.push("MISS " + label + " (" + n + " hits)"); miss = true; return text; }
  report.push("OK   " + label); return text.replace(anchor, add);
};
const rx = (text, re, repl, label) => {
  const hits = text.match(new RegExp(re.source, "gm")) || [];
  if (hits.length !== 1) { report.push("MISS " + label + " (" + hits.length + " hits)"); miss = true; return text; }
  report.push("OK   " + label); return text.replace(re, repl);
};
nodes = rx(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + ver + " — Node Reference", "NODES header version");
nodes = rep(nodes,
  "*End caps* close the loose ends with nested semicircles.\n",
  "*End caps* close the loose ends with nested semicircles. *Fill* Tracks draws\nthe parallel tracks; Rays replaces them with a perpendicular comb across the\nwhole ribbon width every *Ray step* along the spine — the teeth fan out on the\noutside of every bend like radial-comb lettering — and Square wave draws that\nsame comb as ONE continuous meander (across, along the edge, back across), the\nplotter-friendly version; both keep the under-pass gaps, and *Ray overhang*\nlets the teeth stick out beyond the ribbon.\n",
  "NODES Woven Ribbon paragraph");
const HIST = "- **" + ver + "** Woven Ribbon: *Fill* Tracks / Rays / Square wave (+ *Ray step*,\n  *Ray overhang*). Rays = perpendicular comb sampled every Ray step of spine\n  arclength across the full ribbon width, alternating direction; Square wave =\n  the same comb as one continuous meander (vertices identical to the Rays\n  endpoints, proven). Both honour the under-pass gap windows; Tracks output is\n  byte-identical to v2.97 (regression-checked). Era: tools/era/patch-woven-\n  fill.mjs (node) + patch-docs-woven-fill.mjs (docs); validator\n  tools/validate-woven-fill.mjs, 37 checks.\n\n";
handoff = rep(handoff, "## Hard-won pitfalls (keep)\n", HIST + "## Hard-won pitfalls (keep)\n", "HANDOFF version history entry");
for (const l of report) console.log(l);
if (miss) { console.log("ABORT — nothing written"); process.exit(1); }
writeFileSync(NODES, nodes); writeFileSync(HANDOFF, handoff);
console.log("DONE v" + ver + " docs: Woven Ribbon Fill");
