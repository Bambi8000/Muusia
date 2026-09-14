/* Era patch: Shuffle Seams release.
   Bumps APP_VERSION, adds the node to docs/MUUSIA-NODES.md (+ counts),
   docs/MUUSIA-TAGS.json and the docs/MUUSIA-HANDOFF.md version history.
   Reads version and counts from the repo at runtime. Idempotent (SKIP),
   MISS on any anchor aborts with nothing written.
   Run from the repo root: node tools/era/patch-seams.mjs */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const APP = "src/App.jsx";
const NODES = "docs/MUUSIA-NODES.md";
const TAGS = "docs/MUUSIA-TAGS.json";
const HAND = "docs/MUUSIA-HANDOFF.md";

let fails = 0;
const miss = (m) => { console.log("MISS " + m); fails++; };
const okay = (m) => console.log("OK   " + m);

const app = readFileSync(APP, "utf8");
const nodesMd = readFileSync(NODES, "utf8");
const handMd = readFileSync(HAND, "utf8");
const tagsRaw = readFileSync(TAGS, "utf8");

if (nodesMd.includes("**Shuffle Seams** —")) {
  console.log("SKIP already applied");
  process.exit(0);
}

const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { miss("APP_VERSION in " + APP); process.exit(1); }
const cur = vm[1] + "." + vm[2];
const next = vm[1] + "." + (parseInt(vm[2], 10) + 1);
if (!existsSync("src/defs/nodes/seams.js")) {
  miss("src/defs/nodes/seams.js must exist (bake first)");
  process.exit(1);
}
const filesN = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js")).length;
const total = filesN + 2;

const rep1 = (src, from, to, label) => {
  const parts = src.split(from);
  if (parts.length !== 2) { miss(label + " (" + (parts.length - 1) + " hits)"); return src; }
  okay(label);
  return parts.join(to);
};

let appOut = rep1(app, 'APP_VERSION = "' + cur + '"', 'APP_VERSION = "' + next + '"', "App.jsx version " + cur + " -> " + next);

let nOut = nodesMd;
nOut = rep1(nOut, "# MUUSIA v" + cur + " — Node Reference", "# MUUSIA v" + next + " — Node Reference", "NODES.md header version");
const allM = nOut.match(/All (\d+) built-in nodes/);
if (!allM) miss("NODES.md 'All N built-in nodes'");
else if (parseInt(allM[1], 10) + 1 !== total) miss("NODES.md count drift: doc says " + allM[1] + " but disk implies " + (total - 1) + " before this patch");
else nOut = rep1(nOut, "All " + allM[1] + " built-in nodes", "All " + total + " built-in nodes", "NODES.md total " + allM[1] + " -> " + total);
const modM = nOut.match(/## Modifiers \((\d+)\)/);
if (!modM) miss("NODES.md '## Modifiers (N)'");
else nOut = rep1(nOut, "## Modifiers (" + modM[1] + ")", "## Modifiers (" + (parseInt(modM[1], 10) + 1) + ")", "NODES.md Modifiers " + modM[1] + " -> " + (parseInt(modM[1], 10) + 1));

const seamsDoc = `**Shuffle Seams** — moves the start point of every closed path so pen-down
seams stop lining up: concentric Rings fills otherwise plot a visible seam
column where every circle starts and ends. *Golden spiral* steps each seam by
the golden angle so no two ever align (the right choice for nested rings and
needs no seed), *Random* scatters them with the *Seed*, *Fixed step* rotates
each successive path by *Step* degrees. The cut lands at an exact arc-length
position — a new point is interpolated, z plunge values included — so the
geometry is untouched, only the draw order around the loop changes. *Overlap*
makes each path run past its seam by that many millimetres and emits it as an
open path, hiding the pen dot under fresh ink (0 keeps paths closed; try
0.8–1.5 mm for gel pens on dark paper). Open paths pass through untouched.

`;
nOut = rep1(nOut, "**Reverse** —", seamsDoc + "**Reverse** —", "NODES.md insert Shuffle Seams before Reverse");

let tagsOut = tagsRaw;
{
  const t = JSON.parse(tagsRaw);
  const vocab = new Set(Object.values(t).flat());
  if (t.seams) console.log("SKIP TAGS.json 'seams' already present");
  else if (!vocab.has("pathops")) miss("TAGS.json vocabulary missing 'pathops'");
  else {
    t.seams = ["pathops"];
    okay("TAGS.json add 'seams' [pathops]");
    const sorted = {};
    for (const k of Object.keys(t).sort()) sorted[k] = t[k];
    tagsOut = JSON.stringify(sorted, null, 1) + "\n";
  }
}

const bullet = `- **${next}** new **Shuffle Seams** modifier (mod/pathops): rotates every
  closed path's start point (Golden spiral / Random / Fixed step) via exact
  arc-length cut with z interpolation so nested-ring pen-down seams never
  line up; optional Overlap mm runs past the seam as an open path to hide
  the pen dot. Born from the first Belt Drive plot on Viivain.

`;
let hOut = rep1(handMd, "\n## Hard-won pitfalls (keep)", "\n" + bullet + "## Hard-won pitfalls (keep)", "HANDOFF version-history bullet " + next);

if (fails > 0) {
  console.log(fails + " MISS - nothing written, aborting");
  process.exit(1);
}
writeFileSync(APP, appOut);
writeFileSync(NODES, nOut);
writeFileSync(TAGS, tagsOut);
writeFileSync(HAND, hOut);
console.log("DONE v" + cur + " -> v" + next + " (registry " + total + " nodes)");
