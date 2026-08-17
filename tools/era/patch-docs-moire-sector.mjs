/* Era patch: docs for the Moire Disc pie-slice sector cutter.
   - docs/MUUSIA-NODES.md: header version -> current APP_VERSION, Moire Disc
     paragraph extended with the sector controls (feeds the in-app catalog).
   - docs/MUUSIA-HANDOFF.md: version-history entry appended after the newest
     entry. Version read from src/App.jsx, doc paths resolved by searching.
   Idempotent, MISS-aborts writing nothing. */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const findDoc = (name) => {
  for (const p of ["docs/" + name, name]) if (existsSync(p)) return p;
  console.log("MISS  " + name + " not found in docs/ or repo root - ABORT");
  process.exit(1);
};
const NODES = findDoc("MUUSIA-NODES.md");
const HANDOFF = findDoc("MUUSIA-HANDOFF.md");

const vm = readFileSync("src/App.jsx", "utf8").match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
console.log("INFO  app version from repo: " + V);

let nodes = readFileSync(NODES, "utf8");
let handoff = readFileSync(HANDOFF, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (nodes.includes("Sector deg") && handoff.includes("pie-slice sector cutter")) {
  console.log("SKIP  patch-docs-moire-sector already applied");
  process.exit(0);
}

/* --- NODES.md header version --- */
const hm = nodes.match(/# MUUSIA v[\d.]+ \u2014 Node Reference/);
if (hm) {
  nodes = nodes.replace(hm[0], "# MUUSIA v" + V + " \u2014 Node Reference");
  OK("NODES.md header version -> " + V);
} else MISS("NODES.md header version line not found");

/* --- NODES.md Moire Disc paragraph --- */
{
  const anchor = "moire breathes through an animation.";
  const parts = nodes.split(anchor);
  if (parts.length === 2) {
    nodes = parts.join(anchor +
      " *Sector deg* cuts the disc down to a pie slice \u2014 every content mode" +
      " clips to the wedge with clean cut edges, *Sector start* turns the slice" +
      " and the rim becomes the closed wedge outline (arc + both cut radii);" +
      " wire the Frame clock into Sector deg and the disc fills up like a pie" +
      " chart, or butt two complementary sectors with different contents into" +
      " one two-fill pie.");
    OK("NODES.md Moire Disc paragraph: sector sentence");
  } else MISS("NODES.md Moire Disc anchor (" + (parts.length - 1) + " hits)");
}

/* --- HANDOFF version-history entry --- */
{
  const anchor = "(tools/era/patch-measure-tool.mjs)";
  const parts = handoff.split(anchor);
  if (parts.length === 2) {
    handoff = parts.join(anchor +
      "\n\n- **" + V + "** Moire Disc pie-slice sector cutter: new Sector deg" +
      " (0-360, default 360 keeps every old patch byte-identical - verified" +
      " against the pre-patch node on all nine content modes) and Sector start" +
      " (showIf < 360). All content clips to the wedge through a shared push" +
      " wrapper: closed loops re-seam at an outside point, cut ends land on" +
      " the sector edges by bisection (oracle tolerance 5e-3 rad), the rim" +
      " becomes the closed cake-slice outline drawn unclipped (its points ARE" +
      " the boundary), the overlay shows the wedge poly. Sector < 0.05 deg is" +
      " an explicit empty sector - a zero-width sector otherwise emits" +
      " micro-whiskers where rings cross its edge ray exactly (caught by the" +
      " validator). Frame clock into Sector deg = a filling pie; two" +
      " complementary sectors with different contents = a two-fill pie chart." +
      " (tools/era/patch-moire-sector.mjs, tools/validate-moire-sector.mjs)");
    OK("HANDOFF version-history entry v" + V);
  } else MISS("HANDOFF anchor (" + (parts.length - 1) + " hits)");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - nothing written");
  process.exit(1);
}
writeFileSync(NODES, nodes);
writeFileSync(HANDOFF, handoff);
console.log("DONE  " + ok + " edits applied, " + NODES + " + " + HANDOFF + " written");
