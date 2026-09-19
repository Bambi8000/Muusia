/* Era patch: documentation batch for the Perspective Hall node (persp_hall).
   Run from the repo root AFTER baking and bumping APP_VERSION:
     node tools/era/patch-docs-persp_hall.mjs
   Edits docs/MUUSIA-NODES.md (paragraph + header version + counts),
   docs/MUUSIA-TAGS.json (entry, keys kept sorted) and docs/MUUSIA-HANDOFF.md
   (file/node counts + version-history entry). Anchored, idempotent, MISS-aborts:
   nothing is written unless every edit lands. Version and counts are read from
   the repo, never from memory. */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const KEY = "persp_hall";
const NAME = "Perspective Hall";
const TAGS = ["3d", "geometric", "hatch", "structural"];
const NODES = "docs/MUUSIA-NODES.md";
const TAGSF = "docs/MUUSIA-TAGS.json";
const HAND = "docs/MUUSIA-HANDOFF.md";

let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

let nodes = readFileSync(NODES, "utf8");
let hand = readFileSync(HAND, "utf8");
const tagsRaw = readFileSync(TAGSF, "utf8");

if (nodes.includes("**" + NAME + "**")) {
  console.log("SKIP  patch-docs-" + KEY + " already applied (sentinel found in NODES.md)");
  process.exit(0);
}

/* ---- facts from the repo ---- */
const app = readFileSync("src/App.jsx", "utf8");
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
if (!existsSync("src/defs/nodes/" + KEY + ".js")) { console.log("MISS  src/defs/nodes/" + KEY + ".js not baked - ABORT"); process.exit(1); }
const files = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
const total = files.length + 2; /* group + reititys live inline in App.jsx */
const gen = files.filter((f) => /cat: "gen"/.test(readFileSync("src/defs/nodes/" + f, "utf8"))).length;
console.log("INFO  version " + V + ", " + files.length + " node files, " + total + " nodes, " + gen + " generators");

/* ---- NODES.md ---- */
const para = `**${NAME}** — one-point perspective corridor built as a real 3D box:
walls, floor and ceiling (plus optional *Far wall*, stepped *Ledges* and
*Doorways*) are projected through a pinhole at the vanishing point (*VP X/Y %*)
and every plane is filled with hatch at constant 3D spacing, so the lines rush
toward the VP the way a ruled perspective does. *Mode* Grid rules every plane
in both directions — the classic laser-line perspective grid; Hatch lets each
plane choose Across (lines at constant depth: vertical on walls, horizontal on
floor and ceiling), Along (lines converging to the VP), Both or None. *Gap* is
the spacing in mm at the sheet edge; where the projected spacing falls under
*Min gap* lines are dropped — every 2nd, 4th… in ruled work, at random with the
same survival rate in hand-drawn work — so the hatch continues to the vanishing
point without clogging, and the density bands where that happens sit at one
shared depth on all four planes whatever the *Aspect*. *Walls* Aspect is a
symmetric box seen from its axis; Sheet edges moves the eye off the corridor
axis so the four corner lines run exactly into the frame corners and every wall
stays on the sheet however far off-centre the VP is. *Ledges* adds blocks along
both walls at a geometric *Rhythm* (*Ledge height %*, *Ledge depth %*, *Ledge /
bay*, *Stagger sides*), with white *Doorways* of *Door height %* left between
them; occlusion is exact — blocks hide the wall and floor behind them and
nearer blocks hide farther ones, all done as t-interval arithmetic on the
projected segments with 1/Z linear along a line. *Hand* 0 is ruler-straight
2-point segments; raising it adds low-frequency wobble, a slight bow, spacing
drift, ragged over/undershooting ends, broken strokes and the occasional missed
line. *Edges* draws the construction lines (corner lines, block edges, door
frames, far wall) with *Edge pen*. Point budget 112k with early stop.

`;
{
  const m = nodes.match(/^# MUUSIA v[\d.]+ — Node Reference$/m);
  if (m && nodes.split(m[0]).length === 2) { nodes = nodes.replace(m[0], "# MUUSIA v" + V + " — Node Reference"); OK("NODES.md header version -> " + V); }
  else MISS("NODES.md header version anchor");
}
{
  const re = /^All (\d+) built-in nodes\./m;
  const m = nodes.match(re);
  if (m && nodes.split(m[0]).length === 2) { nodes = nodes.replace(m[0], "All " + total + " built-in nodes."); OK("NODES.md total " + m[1] + " -> " + total); }
  else MISS("NODES.md total-count anchor");
}
{
  const re = /^## Generators \((\d+)\)\n\n/m;
  const m = nodes.match(re);
  if (m && nodes.split(m[0]).length === 2) { nodes = nodes.replace(m[0], "## Generators (" + gen + ")\n\n" + para); OK("NODES.md generators " + m[1] + " -> " + gen + " + paragraph inserted at top of section"); }
  else MISS("NODES.md generators header anchor");
}

/* ---- TAGS.json ---- */
let tagsOut = null;
try {
  const obj = JSON.parse(tagsRaw);
  const vocab = new Set(Object.values(obj).flat());
  const bad = TAGS.filter((t) => !vocab.has(t));
  if (bad.length) MISS("TAGS.json: tag(s) not in the existing vocabulary: " + bad.join(", "));
  else if (obj[KEY]) MISS("TAGS.json: key " + KEY + " already present");
  else {
    obj[KEY] = TAGS.slice().sort();
    const sorted = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
    tagsOut = JSON.stringify(sorted, null, 1) + (tagsRaw.endsWith("\n") ? "\n" : "");
    OK("TAGS.json entry " + KEY + " [" + TAGS.join(", ") + "] (" + Object.keys(sorted).length + " keys, sorted)");
  }
} catch (e) { MISS("TAGS.json parse: " + e.message); }

/* ---- HANDOFF.md ---- */
{
  const re = /\*\*(\d+) files\*\* \((\d+) nodes total with/;
  const m = hand.match(re);
  if (m && hand.split(m[0]).length === 2) { hand = hand.replace(m[0], "**" + files.length + " files** (" + total + " nodes total with"); OK("HANDOFF counts " + m[1] + "/" + m[2] + " -> " + files.length + "/" + total); }
  else MISS("HANDOFF file/node count anchor");
}
{
  const anchor = "\n## Hard-won pitfalls (keep)";
  const entry = `- **${V}** new **${NAME}** generator (gen/structural, \`${KEY}\`): a
  one-point perspective corridor as a real 3D box (walls, floor, ceiling, far
  wall, stepped ledges with doorways) projected from the VP, every plane hatched
  at constant 3D spacing. Grid mode = classic laser-line perspective grid; Hatch
  mode = per-plane Across/Along/Both/None with *Hand* wobble, ragged ends and
  broken strokes for the organic ink-drawing look. Level of detail: when the
  projected spacing falls under *Min gap*, lines are dropped (stride doubling
  when ruled, stochastic survival when hand-drawn) so the hatch reaches the VP
  without clogging; one shared reference extent keeps the resulting density
  bands at the same depth on all planes regardless of Aspect, with a per-plane
  clog guard for walls much narrower than the reference. *Walls* = Sheet edges
  puts the eye off-axis so the corner lines hit the frame corners (asymmetric
  extents Xl/Xr/Yt/Yb throughout). Occlusion is exact t-interval arithmetic on
  projected segments (1/Z linear along a line; Cyrus–Beck against each ledge's
  convex-hull silhouette, owner excluded). 102-check validator incl. door
  emptiness, ledge occlusion, min-spacing, band alignment across aspects and
  corner hits; mutation-tested (removing occlusion, doors or LOD each trips its
  own checks).
`;
  const parts = hand.split(anchor);
  if (parts.length === 2) { hand = parts[0].replace(/\n*$/, "\n") + entry + anchor + parts[1]; OK("HANDOFF version-history entry " + V); }
  else MISS("HANDOFF history anchor (" + (parts.length - 1) + " hits)");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - nothing written");
  process.exit(1);
}
writeFileSync(NODES, nodes);
writeFileSync(TAGSF, tagsOut);
writeFileSync(HAND, hand);
console.log("DONE  " + ok + " edits applied: " + NODES + ", " + TAGSF + ", " + HAND);
