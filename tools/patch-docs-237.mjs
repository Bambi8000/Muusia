/* patch-docs-237.mjs — v2.37 doc updates (Single Marker + Bridges rules).
   Run from repo root: node tools/patch-docs-237.mjs
   Anchored exact-string replacement with OK/MISS reporting; safe to re-run
   (already-applied patches report MISS with an "already applied" note). */
import fs from "node:fs";

let miss = 0;
const patch = (file, edits) => {
  let txt = fs.readFileSync(file, "utf8");
  for (const [name, from, to] of edits) {
    if (to !== "" && txt.includes(to)) {
      console.log(`MISS ${file} :: ${name} (already applied)`);
      continue;
    }
    const i = txt.indexOf(from);
    if (i === -1) {
      console.log(`MISS ${file} :: ${name}`);
      miss++;
      continue;
    }
    if (txt.indexOf(from, i + 1) !== -1) {
      console.log(`MISS ${file} :: ${name} (anchor not unique)`);
      miss++;
      continue;
    }
    txt = txt.slice(0, i) + to + txt.slice(i + from.length);
    console.log(`OK   ${file} :: ${name}`);
  }
  fs.writeFileSync(file, txt);
};

/* ---------------- docs/MUUSIA-HANDOFF.md ---------------- */

patch("docs/MUUSIA-HANDOFF.md", [
  [
    "node/file counts 193/195/105 -> 194/196/106",
    "one file per node, **193 files** (195 nodes total with\n  group + reititys; Generators 105, Modifiers 63)",
    "one file per node, **194 files** (196 nodes total with\n  group + reititys; Generators 106, Modifiers 63)",
  ],
  [
    "build-routine count check 193 -> 194",
    "Node count check: `ls src/defs/nodes | wc -l` (193)",
    "Node count check: `ls src/defs/nodes | wc -l` (194)",
  ],
  [
    "version history: append 2.37 entry",
    "  measuring the node before asserting (gyroid iso sweep).\n",
    "  measuring the node before asserting (gyroid iso sweep).\n" +
      "- **2.37** new **Single Marker** generator (one movable point marker at exact\n" +
      "  X/Y mm — Dot spiral / Circle / crosses / registration styles; every style\n" +
      "  collapses to exactly one Bridges \"Path centers\" point at its center) +\n" +
      "  **Bridges** grew two Connect rules: **Source order** (connects points in\n" +
      "  Merge input order — the connect-the-dots workflow with Single Marker; Trim\n" +
      "  ends gives separated segments, new **Close loop** check returns to the\n" +
      "  first point, Max bridge splits and suppresses the loop) and **Hull\n" +
      "  (outline)** (monotone-chain convex outline only, no interior lines;\n" +
      "  interior points excluded, collinear degenerates to one segment). Old\n" +
      "  Bridges params/rules untouched — old patches load unchanged.\n",
  ],
]);

/* ---------------- docs/MUUSIA-NODES.md ---------------- */

patch("docs/MUUSIA-NODES.md", [
  [
    "header version 2.36 -> 2.37",
    "# MUUSIA v2.36 — Node Reference",
    "# MUUSIA v2.37 — Node Reference",
  ],
  [
    "total count 195 -> 196",
    "All 195 built-in nodes.",
    "All 196 built-in nodes.",
  ],
  [
    "generators count 105 -> 106",
    "## Generators (105)",
    "## Generators (106)",
  ],
  [
    "insert Single Marker paragraph after Reg Marks",
    "cross, printer's circle-and-cross, or inward corner-L; adjustable insets. For\nmulti-pen registration and scan alignment.\n",
    "cross, printer's circle-and-cross, or inward corner-L; adjustable insets. For\nmulti-pen registration and scan alignment.\n" +
      "\n**Single Marker** — one movable marker at an exact X/Y mm position — at its\n" +
      "simplest a solid ink dot (a single spiral stroke). Styles: Dot, Circle,\n" +
      "Cross +, Cross ×, Circle + cross (registration style), Circle + dot; a dashed\n" +
      "guide shows the spot while the node is selected, and X/Y are value ports so\n" +
      "the marker can be animated. Made for marking points: drop several, Merge, then\n" +
      "Bridges (*Path centers* + *Source order*) joins them in the exact order they\n" +
      "are wired into Merge. Every style collapses to exactly one Bridges point at\n" +
      "the marker's center.\n",
  ],
  [
    "Bridges paragraph: add Source order + Hull rules",
    "**Bridges** — connects points of the input with bridge lines. Points from *Path centers* (Polka Dots / Phyllotaxis circles become nodes), *Vertices* (resampled at a spacing) or *Endpoints*; rules *k-nearest*, *Within distance*, *Chain* (one continuous nearest-neighbour stroke, split at long jumps) or *Delaunay* edges. *Trim ends* stops each bridge short of its points so lines never pierce the dots.",
    "**Bridges** — connects points of the input with bridge lines. Points from *Path centers* (Polka Dots / Phyllotaxis circles become nodes), *Vertices* (resampled at a spacing) or *Endpoints*; rules *k-nearest*, *Within distance*, *Chain* (one continuous nearest-neighbour stroke, split at long jumps), *Source order* (connects points in the order their paths arrive — Merge input order, so Single Markers join exactly as wired; *Trim ends* gives separated segments and *Close loop* returns to the first point, unless *Max bridge* has split the run), *Hull (outline)* (a closed convex outline around all the points — no interior lines, interior points excluded) or *Delaunay* edges. *Trim ends* stops each bridge short of its points so lines never pierce the dots.",
  ],
]);

console.log(miss ? `\n${miss} MISS — check anchors` : "\nALL OK");
process.exit(miss ? 1 : 0);
