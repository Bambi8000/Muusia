/* Era patch: docs for Woven Ribbon Two-tone comb.
   Run once from the repo root after the version bump:  node tools/era/patch-docs-woven-twotone.mjs */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const find = (name) => { for (const d of ["docs", "."]) { const p = resolve(d, name); if (existsSync(p)) return p; } throw new Error("cannot find " + name); };
const NODES = find("MUUSIA-NODES.md"), HANDOFF = find("MUUSIA-HANDOFF.md");
const ver = (readFileSync(resolve("src/App.jsx"), "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!ver) { console.log("MISS APP_VERSION"); process.exit(1); }
let nodes = readFileSync(NODES, "utf8"), handoff = readFileSync(HANDOFF, "utf8");
if (nodes.includes("*Two-tone comb* cuts every tooth")) { console.log("SKIP already applied"); process.exit(0); }
const report = []; let miss = false;
const rep = (text, anchor, add, label) => { const n = text.split(anchor).length - 1; if (n !== 1) { report.push("MISS " + label + " (" + n + " hits)"); miss = true; return text; } report.push("OK   " + label); return text.replace(anchor, add); };
const rx = (text, re, repl, label) => { const hits = text.match(new RegExp(re.source, "gm")) || []; if (hits.length !== 1) { report.push("MISS " + label + " (" + hits.length + " hits)"); miss = true; return text; } report.push("OK   " + label); return text.replace(re, repl); };
nodes = rx(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + ver + " — Node Reference", "NODES header version");
nodes = rep(nodes, "lets the teeth stick out beyond the ribbon.\n", "lets the teeth stick out beyond the ribbon. *Two-tone comb* cuts every tooth\nat the *Split* line (0 = the spine, ±1 = an edge) and draws the two halves on\n*Pen* and *Second pen* — for Square wave that is two meanders sharing the\nsplit line, each zigzagging on its own.\n", "NODES Woven Ribbon paragraph");
const HIST = "- **" + ver + "** Woven Ribbon: *Two-tone comb* (+ *Split*, *Second pen*) for Rays /\n  Square wave — every tooth cut at the split line, halves on two pens, the\n  meander becomes two meanders sharing the split line. Two-tone off is\n  byte-identical to v2.98 in all three fills (regression-checked). Era:\n  tools/era/patch-woven-twotone.mjs + patch-docs-woven-twotone.mjs;\n  validate-woven-fill.mjs now 50 checks.\n\n";
handoff = rep(handoff, "## Hard-won pitfalls (keep)\n", HIST + "## Hard-won pitfalls (keep)\n", "HANDOFF version history entry");
for (const l of report) console.log(l);
if (miss) { console.log("ABORT — nothing written"); process.exit(1); }
writeFileSync(NODES, nodes); writeFileSync(HANDOFF, handoff);
console.log("DONE v" + ver + " docs: Woven Ribbon Two-tone comb");
