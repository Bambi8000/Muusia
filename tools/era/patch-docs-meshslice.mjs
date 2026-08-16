/* patch-docs-meshslice.mjs — documentation batch for the Mesh Slice release.
 *
 * Does the whole doc side of the release in one shot:
 *   1. bumps APP_VERSION in src/App.jsx (reads the current value, never assumes one)
 *   2. MUUSIA-NODES.md   — Mesh Slice paragraph + title/count refresh from disk
 *   3. MUUSIA-TAGS.json  — meshslice tag entry (existing vocabulary only)
 *   4. MUUSIA-HANDOFF.md — version-history entry appended after the LAST entry,
 *                          found by pattern rather than by a hardcoded version,
 *                          so a parallel session moving the repo cannot misfile it
 *
 * Counts come from src/defs/nodes, never from HANDOFF (which has been stale before).
 * Anchored, MISS-aborts, idempotent (SKIP when already applied).
 * Usage: node tools/era/patch-docs-meshslice.mjs [newVersion]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const NODES_DIR = "src/defs/nodes";
const APP = "src/App.jsx";

/* The docs do not live in a fixed place (repo root in some checkouts, docs/ in
   others), so find them instead of assuming. Shallow walk, obvious dirs skipped. */
const SKIP = new Set(["node_modules", ".git", "dist", "build", "nodes-lab", ".vite"]);
const findFile = (name, dir, depth) => {
  if (depth > 3) return null;
  let ents;
  try { ents = readdirSync(dir); } catch (e) { return null; }
  if (ents.includes(name)) return join(dir, name);
  for (const e of ents) {
    if (SKIP.has(e) || e.startsWith(".")) continue;
    let st;
    try { st = statSync(join(dir, e)); } catch (err) { continue; }
    if (!st.isDirectory()) continue;
    const hit = findFile(name, join(dir, e), depth + 1);
    if (hit) return hit;
  }
  return null;
};
const resolve = (name) => {
  const hit = findFile(name, ".", 0);
  if (!hit) {
    console.error("MISS: " + name + " not found anywhere under the repo - aborting, nothing written");
    process.exit(1);
  }
  return hit;
};

if (!existsSync(APP)) {
  console.error("MISS: " + APP + " not found - run this from the repo root");
  process.exit(1);
}
if (!existsSync(NODES_DIR)) {
  console.error("MISS: " + NODES_DIR + " not found - run this from the repo root");
  process.exit(1);
}
const MD = resolve("MUUSIA-NODES.md");
const TAGS = resolve("MUUSIA-TAGS.json");
const HANDOFF = resolve("MUUSIA-HANDOFF.md");
console.log("  docs: " + MD + ", " + TAGS + ", " + HANDOFF);
if (!existsSync(NODES_DIR + "/meshslice.js")) {
  console.error("MISS: " + NODES_DIR + "/meshslice.js not found - bake the node first:");
  console.error("      node tools/bake.mjs meshslice");
  process.exit(1);
}

/* ---------- 0. live repo state ---------- */
let app = readFileSync(APP, "utf8");
const vm = app.match(/APP_VERSION\s*=\s*"([^"]+)"/);
if (!vm) {
  console.error("MISS: APP_VERSION not found in " + APP);
  process.exit(1);
}
const CUR = vm[1];
const argV = process.argv[2];
const bumped = (() => {
  const m = CUR.match(/^(\d+)\.(\d+)$/);
  if (!m) return null;
  return m[1] + "." + (parseInt(m[2], 10) + 1);
})();
const NEXT = argV || bumped;
if (!NEXT) {
  console.error("MISS: cannot derive the next version from '" + CUR + "' - pass one explicitly:");
  console.error("      node tools/era/patch-docs-meshslice.mjs 2.65");
  process.exit(1);
}

const files = readdirSync(NODES_DIR).filter((f) => f.endsWith(".js"));
const TOTAL = files.length;
let GEN = 0;
for (const f of files) {
  const m = readFileSync(NODES_DIR + "/" + f, "utf8").match(/\bcat:\s*"([a-z]+)"/);
  if (m && m[1] === "gen") GEN++;
}
console.log("  repo state: APP_VERSION " + CUR + " -> " + NEXT + ", " + TOTAL + " nodes (" + GEN + " generators)");

let md = readFileSync(MD, "utf8");
let handoff = readFileSync(HANDOFF, "utf8");

if (md.includes("**Mesh Slice**") && handoff.includes("NEW GEN meshslice")) {
  console.log("SKIP: already applied (Mesh Slice documented)");
  process.exit(0);
}

/* ---------- 1. APP_VERSION ---------- */
app = app.replace(/APP_VERSION\s*=\s*"[^"]+"/, 'APP_VERSION = "' + NEXT + '"');

/* ---------- 2. MUUSIA-NODES.md ---------- */
const PARA = `**Mesh Slice** — imports an STL and cuts it into flat sheet contours for
building a layered object (lamp, sculpture) out of cardboard or plexi. Binary
and ASCII STL, up to 120k triangles (decimate larger meshes first); the model
is centred, scaled so its longest dimension is *Size*, rotated by *Rot X/Y/Z*,
then sliced by horizontal planes at each sheet's mid-height — *Slice by* Count
or by real *Sheet thickness*. Up to three negative primitives (Sphere, Cube,
Dodecahedron; position and size in % of Size) carve the interior: the holes are
cut per-plane in 2D rather than by 3D CSG, so the outer contour is clipped
outside them and the hole contours are clipped inside the slice, and where a
primitive breaks the surface the shell opens into a window. *Rod holes* adds
1-4 threaded-rod clearance holes (ISO medium fit M3-M10, or Custom) on every
sheet, evenly spaced on a ring or placed by hand — a hole disappears on sheets
with no material under it. The workflow runs preview first, cut second. CUT
outputs are always true scale and never fitted to the canvas: *Single slice*,
*Frames (ANIMATE)* (one slice per frame), *Grid layout* (the run tiled from the
bed corner, columns fitted between the *Bed margins*, overflowing downwards
when it is long) and *Grid pages (ANIMATE)* (the same tiling split into
canvas-sized pages, one page per frame, each labelled P n/total — set the frame
count to the page count and export SVG xN / DXF xN for the whole job as one
zip). PREVIEW outputs are scaled to fit and stamped PREVIEW NOT TO SCALE:
*Contact sheet* shows every sheet shrunk onto one canvas, which is how the
negative primitives get placed without touching Size, and *Isometric stack*
projects the real sliced geometry as a 3D stack (*View angle*, *View
elevation*, *Layer spacing x* for an exploded view). *Preview every Nth sheet*
thins dense runs, and preview sampling coarsens automatically so no sheet is
ever dropped from the overview. *All contours* overlays every contour in place,
a topographic drawing — and the honest way to find the core where every sheet
has material before choosing a rod ring radius. The mesh travels inside the
patch, so decimate before loading.

`;
const MD_ANCHOR = "**Sweep 3D** —";
if (md.split(MD_ANCHOR).length - 1 !== 1) {
  console.error("MISS: '" + MD_ANCHOR + "' anchor not unique in " + MD + " - aborting, nothing written");
  process.exit(1);
}
md = md.replace(MD_ANCHOR, PARA + MD_ANCHOR);

const titleRe = /^# MUUSIA v[\d.]+ — Node Reference$/m;
if (!titleRe.test(md)) {
  console.error("MISS: NODES.md title line not found - aborting, nothing written");
  process.exit(1);
}
md = md.replace(titleRe, "# MUUSIA v" + NEXT + " — Node Reference");

const allRe = /^All \d+ built-in nodes\./m;
if (!allRe.test(md)) {
  console.error("MISS: NODES.md 'All N built-in nodes.' line not found - aborting, nothing written");
  process.exit(1);
}
md = md.replace(allRe, "All " + TOTAL + " built-in nodes.");

const genRe = /^## Generators \(\d+\)$/m;
if (!genRe.test(md)) {
  console.error("MISS: NODES.md '## Generators (N)' heading not found - aborting, nothing written");
  process.exit(1);
}
md = md.replace(genRe, "## Generators (" + GEN + ")");

/* ---------- 3. MUUSIA-TAGS.json ---------- */
const tags = JSON.parse(readFileSync(TAGS, "utf8"));
const VOCAB = new Set(Object.values(tags).flat());
const MINE = ["3d", "grid", "mesh", "stack", "structural"];
for (const t of MINE) {
  if (!VOCAB.has(t)) {
    console.error("MISS: tag '" + t + "' is not in the existing vocabulary - aborting, nothing written");
    process.exit(1);
  }
}
tags.meshslice = MINE;
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];

/* ---------- 4. MUUSIA-HANDOFF.md ---------- */
const ENTRY = `- **${NEXT}** Mesh Slice node (STL in, cut sheets out — the layered-object
  workflow gets its own geometry source). NEW GEN meshslice (structural):
  binary + ASCII STL intake via a \`type: "file"\` param with fileBinary
  (the definition-level onFile/fileAccept/fileLabel fields do NOT render a
  picker on their own — the param row is what creates it, caught only when
  the node reached the browser and the inspector came up empty), 120k
  triangle cap with a decimate message, normalised to a unit box at intake.
  Z-plane slicing at band mid-heights, segments chained on a 0.01 mm weld
  grid with 3x3 neighbour lookup so non-watertight AI meshes still yield
  open runs instead of nothing. Negative primitives (Sphere/Cube/
  Dodecahedron, 0-3) are cut per-plane in 2D, NOT by 3D CSG: the shell is
  clipped outside the hole sections and the hole sections are clipped
  inside the shell (even-odd point-in-polygon with a bbox pretest), runs
  under 0.5 mm dropped as chips. Dodecahedron sections come from the 20
  golden-ratio vertices and 30 edges via edge-plane intersections ordered
  by atan2. Rod holes 1-4, ring (radius + angle, a single hole ignoring
  the radius) or manual per-hole XY; a rod clips away where no material
  sits under it. Modes: Single, Frames, All contours, Grid layout and Grid
  pages (ANIMATE, canvas-sized pages labelled P n/total) — all true scale,
  the grid anchored to the bed corner with columns fitted between the Bed
  margins — plus two PREVIEW modes stamped PREVIEW NOT TO SCALE: Contact
  sheet (whole run shrunk to fit, unscaled number gutter so labels survive
  any shrink factor) and Isometric stack (axonometric projection of the
  real sliced geometry, View angle/elevation/Layer spacing). Preview
  sampling coarsens ADAPTIVELY (previewStep) because the fixed budget
  silently truncated a 40-sheet 400 mm run at sheet 31 — a preview that
  drops sheets is worse than a coarse one. Preview every Nth sheet thins
  dense runs. Tags 3d/grid/mesh/stack/structural. Validator
  tools/validate-meshslice.mjs (real helpers, lab/baked auto-switch, 158
  checks): synthetic STLs built in code (binary cube/box/sphere, ASCII
  tetra), parser rejections, cube slice perimeter/area/centring against
  exact numbers, hole clipping geometry, dodecahedron section radius,
  M4/M5 clearance diameters and ring spacing, rod-inside-void removal,
  grid disjointness and true scale, page coverage (5 pages x 12 = 50
  sheets exactly, frame clamping), preview fit and no-truncation at 200
  sheets, budget, non-watertight survival, every select option, showIf
  predicates, extremes, overlay guides in every mode, determinism and
  non-mutation. Two engine patches shipped alongside:
  tools/era/patch-frames-zip.mjs bundles the per-frame exports into ONE
  zip via the existing buildZip (they used to fire N separate downloads
  450 ms apart, which browsers throttle or block outright at 50 frames, so
  long runs arrived incomplete) with a percentage readout on the xN
  buttons, and tools/era/patch-stack-max48.mjs raises the Stack View sheet
  cap from 12 to 48.
`;

const lines = handoff.split("\n");
let lastIdx = -1;
for (let i = 0; i < lines.length; i++) if (/^- \*\*\d+\.\d+\*\*/.test(lines[i])) lastIdx = i;
if (lastIdx < 0) {
  console.error("MISS: no version-history entries found in " + HANDOFF + " - aborting, nothing written");
  process.exit(1);
}
let end = lastIdx + 1;
while (end < lines.length && (lines[end].startsWith("  ") || lines[end].trim() === "")) {
  if (lines[end].trim() === "" && end + 1 < lines.length && !lines[end + 1].startsWith("  ")) break;
  end++;
}
const lastVer = lines[lastIdx].match(/^- \*\*(\d+\.\d+)\*\*/)[1];
console.log("  handoff: last entry is " + lastVer + ", inserting " + NEXT + " after line " + (end + 1));
lines.splice(end, 0, ENTRY.replace(/\n$/, ""));
handoff = lines.join("\n");

/* ---------- write ---------- */
writeFileSync(APP, app);
writeFileSync(MD, md);
writeFileSync(TAGS, JSON.stringify(sorted, null, 1) + "\n");
writeFileSync(HANDOFF, handoff);
console.log("  OK  " + APP + " (APP_VERSION " + NEXT + ")");
console.log("  OK  " + MD + " (Mesh Slice paragraph, " + TOTAL + " nodes / " + GEN + " generators)");
console.log("  OK  " + TAGS + " (meshslice: " + MINE.join(", ") + ")");
console.log("  OK  " + HANDOFF + " (v" + NEXT + " entry)");
console.log("APPLIED: documentation batch complete for v" + NEXT);
