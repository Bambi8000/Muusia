/* Era patch: version bump + the full documentation batch for Chain, Circuit
   and Knot Tube. Run ONCE from the repo root, AFTER baking the three nodes:

     node tools/era/patch-docs-3nodes.mjs

   THE BUMP IS DONE HERE, not by a hand-written sed. Bumping with
   `sed s/APP_VERSION = "2.69"/.../` fails SILENTLY when the repo has moved on
   in a parallel session - the pattern matches nothing, the release ships
   unbumped, and the commit is mislabelled. That has happened twice. This
   script reads APP_VERSION off disk, increments it, and writes every document
   using the value it computed, so the code and the docs cannot disagree and
   there is no number to get wrong.

   Every count likewise comes from the filesystem, never from the previous
   contents of the docs: HANDOFF's counts have been stale before and copying
   them forward propagates the error. `ls src/defs/nodes` is two short of the
   true total because `group` and `reititys` are inline DEFS in App.jsx.

   Anchored exact-string replacement: idempotent, MISS-aborts before writing,
   reports per edit. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

/* ---- locate the docs: they live in docs/, not the repo root ---- */
const findDoc = (name) => {
  for (const dir of ["docs", ".", "doc"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
};
const APP = "src/App.jsx";
const NODES_DIR = "src/defs/nodes";
const F_NODES = findDoc("MUUSIA-NODES.md");
const F_TAGS = findDoc("MUUSIA-TAGS.json");
const F_HAND = findDoc("MUUSIA-HANDOFF.md");
for (const [label, p] of [["src/App.jsx", APP], ["src/defs/nodes", NODES_DIR], ["MUUSIA-NODES.md", F_NODES], ["MUUSIA-TAGS.json", F_TAGS], ["MUUSIA-HANDOFF.md", F_HAND]]) {
  if (!p || !existsSync(p)) { console.log("MISS  " + label + " not found - run from the repo root - ABORT"); process.exit(1); }
}

/* ---- the three nodes must actually be baked before we document them ---- */
const KEYS = ["chain", "circuit", "knottube"];
for (const k of KEYS) {
  if (!existsSync(join(NODES_DIR, k + ".js"))) {
    console.log("MISS  " + NODES_DIR + "/" + k + ".js not found - bake the nodes first - ABORT");
    process.exit(1);
  }
  if (existsSync(join("nodes-lab", k + ".plotternode.js"))) {
    console.log("MISS  nodes-lab/" + k + ".plotternode.js still present - delete it after baking - ABORT");
    process.exit(1);
  }
}

/* ---- idempotence ---- */
let hand = readFileSync(F_HAND, "utf8");
if (hand.includes("Chain** (gen/geometric)")) {
  console.log("SKIP  patch-docs-3nodes already applied (sentinel found in HANDOFF)");
  process.exit(0);
}

/* ---- facts from disk ---- */
let app = readFileSync(APP, "utf8");
const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in " + APP + " - ABORT"); process.exit(1); }
const VOLD = vm[1] + "." + vm[2];
const VNEW = vm[1] + "." + String(Number(vm[2]) + 1).padStart(2, "0");

const files = readdirSync(NODES_DIR).filter((f) => f.endsWith(".js"));
const catOf = (f) => {
  const m = readFileSync(join(NODES_DIR, f), "utf8").match(/\bcat:\s*"([a-z]+)"/);
  return m ? m[1] : "?";
};
const cats = {};
for (const f of files) { const c = catOf(f); cats[c] = (cats[c] || 0) + 1; }
const TOTAL = files.length + 2;          /* group + reititys are inline in App.jsx */
const GEN = cats.gen || 0;
const MOD = cats.mod || 0;
console.log("INFO  version " + VOLD + " -> " + VNEW);
console.log("INFO  " + files.length + " files on disk, " + TOTAL + " nodes total (Generators " + GEN + ", Modifiers " + MOD + ")");

/* ---- the new NODES.md paragraphs ---- */
const PARAS = `**Chain** — interlocking chain links drawn as flat hatched bands with real
hidden-line removal. Each link is a closed ribbon lying in ONE plane, which is
what makes the occlusion exact and cheap: the depth of a plane is a closed-form
solve at any screen point, so where two links cross the one behind is cut away
exactly and the over/under weave falls out of the geometry — there is no weaving
bookkeeping in the node at all. *Element* picks the outline (Circle, Triangle,
Square, Hexagon); *Corner round* is not decoration but a constraint, because the
band is the centreline offset along its own normal and the inner edge folds over
itself wherever the curve turns tighter than the half-width, so the rounding is
clamped above it. *Layout* runs the chain along a line, closes it into a ring, or
follows any paths wired into the **Spine** input. *Alternate tilt* is the
character control: 90° gives a real chain with every second link edge-on, low
values lay them nearly face-on as overlapping ellipses. *Link spin* turns each
element inside its own plane and *Spin / link* adds to that per link; *Offset*
staggers every second link sideways into a zigzag (both accumulate by index — a
constant rotation or shift would only move the whole drawing and vanish in the
centring). Hatch: Chevron, Chevron alternating (herringbone), Rungs, Diagonal,
Cross. *Link size* is a true millimetre measurement — the fit shrinks and never
grows — and *Hatch spacing* is in paper millimetres, so it survives the fit.
At one link the chain parameters hide themselves and the node is simply a
hatched ring or polygon band.

**Circuit** — constructivist circuit compositions: solid blocks in aligned
columns, orthogonal trace bundles between them, and a baseline the picture rests
on. Blocks stack into *Columns* and every block in a column shares its width, so
the stacks read as one structure. Traces leave block edges in bundles of parallel
lines at *Bundle pitch* and turn at right angles — L routes turn once, Z twice —
ending on another block, on the baseline, at the sheet edge, or in a short stub
with a cross-tick. Routing is corridor-checked against the blocks with a
clearance and a route that cannot be found is **dropped rather than drawn
through a block**. *Crossings* either overlap plainly, as in the steel-wire
originals, or cut *Under gaps* into the lower trace. *Frames* adds empty outlined
rectangles as a counterweight to the black mass. A pen cannot lay solid ink, so
block *Fill* is dense hatching (Hatch, Cross, Contour) and *Fill spacing* is in
real paper millimetres — it sets the plotting time more than anything else here.
*Whitespace bias* slides the block cluster sideways and leaves the other side to
the long runs. Compare **Diagram**: that draws numbered nodes and arrowheads on a
ring or grid; this has no arrows and no node identity, and hangs off a baseline.

**Knot Tube** — a closed 3-D knot swept into a tube and drawn as counter-wound
helices with real hidden-line removal, so the far side and everything passing
behind is cut away and the knot reads as solid. The tube is a canal surface —
the boundary of the union of spheres along the spine — which is what makes the
occlusion exact: for an orthographic camera a point is hidden exactly when some
sphere's near surface lies in front of it. *Curve* picks the spine: a p·q torus
knot, the figure-eight knot, a Lissajous knot, or *Tangle*, a seeded sum of
harmonics that is always smooth and always closed, so the Seed shuffles through
endless genuine knots. *Surface* Cross winds a right- and a left-handed helix
over each other — that is where the diamond moiré comes from — with Right and
Left helix, Rings, Cross + rings and Longitudinals as the alternatives. Density
comes from *Strands*, the number of parallel starts, more than from *Turns*.
The radius is a function of arc length, clamped locally under the curvature
radius: past it the tube's own wall folds inside its body and the drawing
dissolves, so a tight bend quietly pinches instead. Strands passing within a
tube diameter of each other are left to fuse, which the union of spheres renders
correctly. *Size* is a true millimetre measurement, shrunk only if it would run
off the sheet. Tip: wire Frame into Yaw for a spinning knot.

`;

/* ---- edits ---- */
const edits = [];

/* App.jsx: the version */
edits.push({ file: APP, name: "APP_VERSION " + VOLD + " -> " + VNEW,
  old: 'APP_VERSION = "' + VOLD + '"', neu: 'APP_VERSION = "' + VNEW + '"' });

/* NODES.md: header, counts, paragraphs */
let nodes = readFileSync(F_NODES, "utf8");
const hm = nodes.match(/^# MUUSIA v[\d.]+ — Node Reference/m);
if (!hm) { console.log("MISS  NODES.md header line not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md header version",
  old: hm[0], neu: "# MUUSIA v" + VNEW + " — Node Reference" });

const tm = nodes.match(/^All \d+ built-in nodes\./m);
if (!tm) { console.log("MISS  NODES.md total-count line not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md total count -> " + TOTAL,
  old: tm[0], neu: "All " + TOTAL + " built-in nodes." });

const gm = nodes.match(/^## Generators \(\d+\)$/m);
if (!gm) { console.log("MISS  NODES.md Generators heading not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md Generators count -> " + GEN,
  old: gm[0], neu: "## Generators (" + GEN + ")" });

const mm = nodes.match(/^## Modifiers \(\d+\)$/m);
if (!mm) { console.log("MISS  NODES.md Modifiers heading not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md three generator paragraphs",
  old: mm[0], neu: PARAS + mm[0] });

/* HANDOFF: repo-layout counts, version history, pitfalls */
const fm = hand.match(/\*\*\d+ files\*\* \(\d+ nodes total with/);
if (fm) {
  edits.push({ file: F_HAND, name: "HANDOFF repo-layout file/node counts",
    old: fm[0], neu: "**" + files.length + " files** (" + TOTAL + " nodes total with" });
} else MISS("HANDOFF repo-layout file count line (skipped, wording changed)");

const cm = hand.match(/Generators \d+, Modifiers \d+\)/);
if (cm) {
  edits.push({ file: F_HAND, name: "HANDOFF per-category counts",
    old: cm[0], neu: "Generators " + GEN + ", Modifiers " + MOD + ")" });
} else MISS("HANDOFF per-category count line (skipped, wording changed)");

const HIST = `- **${VNEW}** Three generators, all three built on exact hidden-line removal of a
  different kind. **Chain** (gen/geometric): interlocking links as FLAT hatched
  bands, one plane each — the depth of a plane is a closed-form solve at any
  screen point, so over/under at every crossing falls out of the geometry with
  no weaving bookkeeping anywhere in the node. Circle/triangle/square/hexagon
  links, chevron and herringbone hatch, per-link spin and alternating offset,
  Line/Ring/wired-spine layouts, one link upward. **Circuit** (gen/structural):
  constructivist schematic — solid hatched blocks in aligned columns, orthogonal
  trace bundles corridor-checked against the blocks (an unroutable trace is
  dropped, never drawn through a mass), baselines, empty frames, optional
  under-gap crossings. **Knot Tube** (gen/geometric): a closed 3-D knot as a
  canal surface (the union of spheres along the spine), cross-wound helices, the
  radius a function of arc length clamped locally under the curvature radius,
  and the winding closed by measuring the parallel-transport holonomy and
  spreading it over the loop. Torus, figure-eight, Lissajous and seeded Fourier
  tangle spines. Validator lessons this cycle are in the pitfalls below; each
  node's oracles were mutation-tested by disabling the invariant they guard and
  confirming the failure. (tools/validate-chain.mjs, tools/validate-circuit.mjs,
  tools/validate-knottube.mjs, tools/era/patch-docs-3nodes.mjs)

`;
const pm = hand.match(/^## Hard-won pitfalls \(keep\)$/m);
if (!pm) { console.log("MISS  HANDOFF pitfalls heading not found - ABORT"); process.exit(1); }
edits.push({ file: F_HAND, name: "HANDOFF version history entry for " + VNEW,
  old: pm[0], neu: HIST + pm[0] });

const PIT = `- A NORMALISING FIT silently converts a size control into a density
  control. Chain fitted its drawing to the margin box, so Link size never
  changed the drawing at all — it only changed how many hatch rungs were packed
  in before the scale-down, which reads as a density knob and was reported as
  "the size parameter is broken". Fit must SHRINK ONLY (\`Math.min(1, ...)\`),
  and any spacing quoted in millimetres has to be divided by that shrink or it
  is not the millimetres the label claims.
- Drawing the SAME rng() TWICE inside one route is how an orthogonal generator
  grows diagonals: Circuit computed a corner's displacement and then recomputed
  it for the point that had to share the coordinate. Finite, in bounds, in
  budget, and wrong — only a render caught it. Any node whose premise is a
  constraint (right angles, symmetry, planarity) needs that constraint asserted
  directly; and never CLAMP a point back into the box, because clamping x and y
  independently moves a corner off its own axis. Reject the route instead.
- Offsetting a curve along its own normal AMPLIFIES the source curve's faceting
  by the compression ratio at corners, until the error rivals the spacing
  between offset points and the offset edge steps backwards. The fix is density
  in the raw construction plus an arc-length resample, not a bigger tolerance.
- A canal surface's boundary circle is NOT perpendicular to the tangent where
  the radius varies: it is pulled back by r·r' and shrunk by sqrt(1 - r'^2).
  Drawing the naive circle puts the surface inside its own neighbouring spheres,
  the visibility test correctly calls those points hidden, and the tube renders
  as torn shreds (Knot Tube). Related: sample a parametric spine by ARC LENGTH
  before estimating curvature — where a Fourier or Lissajous parametrisation
  crawls, the samples bunch and the curvature estimate explodes, pinching the
  tube at a bend that is not sharp.
- Clamp ORDER matters when several bounds apply to one array: smoothing can
  RAISE a value, so a curvature clamp has to be reapplied after it, while a
  Lipschitz sweep only lowers and can safely come last. And a generous floor
  (\`Math.max(0.25, ...)\`) placed outside the clamp silently overrides it
  exactly where the clamp mattered most.
- An oracle can be wrong in the node's favour AND against it. Knot Tube's
  envelope test first measured penetration into the whole union of spheres and
  failed the correct code, because two strands of a knot fuse on purpose and a
  point of one buried inside the other is a correct picture of a merged solid.
  Narrowing the window did not fix it either. The right test was the analytic
  envelope condition (F = 0 and dF/ds = 0), which is immune to fusion — when an
  oracle fails, ask whether it is measuring the invariant or something adjacent.
`;
edits.push({ file: F_HAND, name: "HANDOFF pitfalls from this cycle",
  old: "## Hard-won pitfalls (keep)\n", neu: "## Hard-won pitfalls (keep)\n" + PIT });

/* ---- apply: every file loaded once, nothing written unless all land ---- */
const buf = { [APP]: app, [F_NODES]: nodes, [F_HAND]: hand };
for (const e of edits) {
  const parts = buf[e.file].split(e.old);
  if (parts.length === 2) { buf[e.file] = parts.join(e.neu); OK(e.name); }
  else if (parts.length === 1) MISS(e.name + " (anchor not found)");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
}

/* ---- TAGS.json: only vocabulary that already exists ---- */
const tags = JSON.parse(readFileSync(F_TAGS, "utf8"));
const VOCAB = new Set(Object.values(tags).flat());
const NEWTAGS = {
  chain: ["3d", "geometric", "hatch", "repeat", "weave"],
  circuit: ["fill", "grid", "scientific", "structural"],
  knottube: ["3d", "geometric", "spiral", "weave"],
};
let tagFail = false;
for (const [k, list] of Object.entries(NEWTAGS)) {
  for (const t of list) if (!VOCAB.has(t)) { MISS("tag '" + t + "' is not in the existing vocabulary (never invent a tag)"); tagFail = true; }
}
if (!tagFail) {
  for (const [k, list] of Object.entries(NEWTAGS)) tags[k] = list.slice().sort();
  OK("TAGS.json entries for " + Object.keys(NEWTAGS).join(", "));
}

if (miss > 0) {
  console.log("ABORT " + miss + " edit(s) missed - nothing written");
  process.exit(1);
}

writeFileSync(APP, buf[APP]);
writeFileSync(F_NODES, buf[F_NODES]);
writeFileSync(F_HAND, buf[F_HAND]);
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
writeFileSync(F_TAGS, JSON.stringify(sorted, null, 1) + "\n");

console.log("DONE  " + ok + " edits applied · v" + VNEW + " · " + TOTAL + " nodes (Generators " + GEN + ")");
console.log("      written: " + APP + ", " + F_NODES + ", " + F_TAGS + ", " + F_HAND);
