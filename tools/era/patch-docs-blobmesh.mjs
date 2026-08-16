/* patch-docs-blobmesh.mjs — documentation batch for the Blob Mesh release.
 *
 *   1. bumps APP_VERSION (read from disk, never assumed)
 *   2. MUUSIA-NODE-API.md — documents the FOURTH pin type, "mesh", and the
 *      payload contract behind it. This is the part that matters beyond one
 *      node: any future generator or consumer of 3D geometry has to agree on
 *      { kind, tri, v, dims } and on the centre/unit-box normalisation, or the
 *      two ends will disagree about scale and nobody will know why.
 *   3. MUUSIA-NODES.md — Blob Mesh paragraph, Mesh Slice paragraph updated for
 *      the new input, all counts recomputed from disk
 *   4. MUUSIA-TAGS.json — blobmesh entry (existing vocabulary only)
 *   5. MUUSIA-HANDOFF.md — version-history entry after the LAST entry, found by
 *      pattern; plus the pin-type list in Architecture
 *
 * Anchored, MISS-aborts, idempotent (SKIP when already applied).
 * Usage: node tools/era/patch-docs-blobmesh.mjs [newVersion]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const NODES_DIR = "src/defs/nodes";
const APP = "src/App.jsx";

const SKIPDIR = new Set(["node_modules", ".git", "dist", "build", "nodes-lab", ".vite"]);
const findFile = (name, dir, depth) => {
  if (depth > 3) return null;
  let ents;
  try { ents = readdirSync(dir); } catch (e) { return null; }
  if (ents.includes(name)) return join(dir, name);
  for (const e of ents) {
    if (SKIPDIR.has(e) || e.startsWith(".")) continue;
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
  if (!hit) { console.error("MISS: " + name + " not found under the repo - aborting, nothing written"); process.exit(1); }
  return hit;
};

if (!existsSync(APP) || !existsSync(NODES_DIR)) {
  console.error("MISS: " + APP + " / " + NODES_DIR + " not found - run this from the repo root");
  process.exit(1);
}
if (!existsSync(NODES_DIR + "/blobmesh.js")) {
  console.error("MISS: " + NODES_DIR + "/blobmesh.js not found - bake the node first:");
  console.error("      node tools/bake.mjs blobmesh");
  process.exit(1);
}
const MD = resolve("MUUSIA-NODES.md");
const API = resolve("MUUSIA-NODE-API.md");
const TAGS = resolve("MUUSIA-TAGS.json");
const HANDOFF = resolve("MUUSIA-HANDOFF.md");
console.log("  docs: " + [MD, API, TAGS, HANDOFF].join(", "));

/* ---------- version + counts from disk ---------- */
let app = readFileSync(APP, "utf8");
const vm = app.match(/APP_VERSION\s*=\s*"([^"]+)"/);
if (!vm) { console.error("MISS: APP_VERSION not found in " + APP); process.exit(1); }
const CUR = vm[1];
const bumped = (() => { const m = CUR.match(/^(\d+)\.(\d+)$/); return m ? m[1] + "." + (parseInt(m[2], 10) + 1) : null; })();
const NEXT = process.argv[2] || bumped;
if (!NEXT) { console.error("MISS: cannot derive a version from '" + CUR + "' - pass one explicitly"); process.exit(1); }

const SECTION = { gen: "Generators", mod: "Modifiers", dec: "Decorators", duo: "Combiners", math: "Math", route: "Routing" };
const counts = {};
const files = readdirSync(NODES_DIR).filter((f) => f.endsWith(".js"));
for (const f of files) {
  const m = readFileSync(NODES_DIR + "/" + f, "utf8").match(/\bcat:\s*"([a-z]+)"/);
  if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
}
const inline = [...readFileSync(APP, "utf8").matchAll(/name:\s*"([^"]+)",\s*cat:\s*"([a-z]+)"/g)].map((m) => ({ name: m[1], cat: m[2] }));
if (inline.length < 1 || inline.length > 5) {
  console.error("MISS: expected 1-5 inline DEFS entries, found " + inline.length + " - aborting, nothing written");
  process.exit(1);
}
for (const e of inline) counts[e.cat] = (counts[e.cat] || 0) + 1;
const TOTAL = Object.values(counts).reduce((a, b) => a + b, 0);
console.log("  repo: APP_VERSION " + CUR + " -> " + NEXT + " | " + files.length + " files + " + inline.length + " inline = " + TOTAL);

let md = readFileSync(MD, "utf8");
let api = readFileSync(API, "utf8");
let handoff = readFileSync(HANDOFF, "utf8");

if (md.includes("**Blob Mesh**") && api.includes('`"mesh"`')) {
  console.log("SKIP: already applied (Blob Mesh documented)");
  process.exit(0);
}

/* ---------- 1. NODE-API: the mesh pin type ---------- */
const A_PIN = "**Pins:** create with `Pin(type, label?)` where type is `\"paths\"`, `\"value\"`, or\n`\"style\"`. Only equal types connect.";
if (api.split(A_PIN).length - 1 !== 1) {
  console.error("MISS: NODE-API pin-type sentence not found or not unique - aborting, nothing written");
  process.exit(1);
}
const B_PIN = `**Pins:** create with \`Pin(type, label?)\` where type is \`"paths"\`, \`"value"\`,
\`"style"\` or \`"mesh"\`. Only equal types connect.`;
api = api.replace(A_PIN, B_PIN);

const A_PINEX = "`outs: (node) => Array.from({length: Math.round(node.params.count)}, (_, i) => Pin(\"paths\", String(i+1)))`.\n";
if (api.split(A_PINEX).length - 1 !== 1) {
  console.error("MISS: NODE-API pin example line not found or not unique - aborting, nothing written");
  process.exit(1);
}
const MESH_DOC = A_PINEX + `
### The \`"mesh"\` pin (v${NEXT})

The fourth pin type carries a triangle mesh between nodes, so a generator can
feed a consumer directly instead of the user exporting an STL and loading it
back. Blob Mesh produces one, Mesh Slice consumes one.

The payload is a plain object and **both ends must agree on it**:

\`\`\`js
{ kind: "mesh", tri: <triangle count>, v: [x,y,z, x,y,z, x,y,z, ...], dims: [dx,dy,dz] }
\`\`\`

- \`v\` is flat, 9 numbers per triangle, \`v.length === tri * 9\`.
- **Normalised at the source:** centred on the origin and scaled so the longest
  dimension is exactly 1, with coordinates rounded to 1e-4. \`dims\` holds the
  resulting proportions (its largest entry is 1). The consumer decides real-world
  size in mm. An STL loaded from disk is normalised the same way at intake, so a
  wired mesh and an imported file slice identically — do not skip this or the two
  paths will disagree about scale with no visible error.
- The mesh is **not paths**: it never reaches the canvas, the exporters or the
  route optimiser. A node whose port 0 is a mesh will preview as blank, so put a
  paths output first when the node should show itself (Blob Mesh outputs
  Wireframe, Silhouette, then Mesh).
- \`defaultFor("mesh")\` is \`null\`, so an unconnected mesh input arrives as \`null\`.
  Guard with \`ins[i] && ins[i].kind === "mesh"\` — an EMPTY \`{paths:[]}\` can also
  turn up if something else is wired in by mistake.
- Adding a pin type means adding a \`TYPE_COLOR\` entry in App.jsx: the port dot
  reads \`TYPE_COLOR[pin.type]\` with no fallback and renders invisible without one.
`;
api = api.replace(A_PINEX, MESH_DOC);

/* ---------- 2. NODES.md ---------- */
const PARA = `**Blob Mesh** — a procedural 3D blob built to be sliced, wired straight into
Mesh Slice with no STL round-trip. The body is 1-5 metaballs fused by a
smooth-min union and solved as a star-shaped radius per direction, so
overlapping balls melt into one swollen mass instead of reading as separate
spheres; *Blend* sets how far they melt (0 leaves a hard crease). Placement is
*Seeded* (Spread, Size variation, shuffled by the seed) or *Manual*, which
exposes X/Y/Z and size per ball — drag a ball outwards and the surface stretches
into a lobe behind it, the direct way to sculpt something asymmetric. *Radius
X/Y/Z* squashes round to oval. *Profile* reshapes further: presets (Egg, Pear,
Hourglass, Barrel, Teardrop) or any paths wired into the **Profile** input, read
either as a *Cross-section* (the outline becomes the horizontal shape — wire a
Superformula star and the blob goes star-shaped in plan) or as a *Vertical
profile* (half-width as radius per height, the Sweep 3D convention); *Profile
amount* blends it in, and at 0 the profile does nothing at all. Surface
distortion is three seeded layers: fBm noise along the normal, angular *Lobes*
and *Vertical waves*, finished with *Twist* and *Taper*. Outputs **Wireframe**
(ring/meridian cage at View angle/elevation, no hidden-line removal, every Nth
line), **Silhouette** (the true outline — edges where a front face meets a back
face, chained, so interior folds appear too) and **Mesh** for Mesh Slice. The
mesh is centred and normalised exactly like an imported STL, so both sources
slice identically. Keep Rings x Segments low while sculpting and raise it before
slicing.

`;
const MD_ANCHOR = "**Mesh Slice** —";
if (md.split(MD_ANCHOR).length - 1 !== 1) {
  console.error("MISS: NODES.md '**Mesh Slice** —' anchor not found or not unique - aborting, nothing written");
  process.exit(1);
}
md = md.replace(MD_ANCHOR, PARA + MD_ANCHOR);

const A_MS = "Binary\nand ASCII STL, up to 120k triangles";
const B_MS = "Takes geometry from either\nsource: a mesh wired into the **Mesh** input (Blob Mesh, or any future mesh\ngenerator) wins, and unplugging it falls back to the loaded file. Binary\nand ASCII STL, up to 120k triangles";
if (md.split(A_MS).length - 1 === 1) {
  md = md.replace(A_MS, B_MS);
  console.log("  OK  Mesh Slice paragraph notes the Mesh input");
} else {
  console.log("  --  Mesh Slice paragraph reworded, left alone (add the Mesh input note by hand)");
}

const titleRe = /^# MUUSIA v[\d.]+ — Node Reference$/m;
const allRe = /^All \d+ built-in nodes\./m;
if (!titleRe.test(md) || !allRe.test(md)) {
  console.error("MISS: NODES.md title or 'All N' line not found - aborting, nothing written");
  process.exit(1);
}
md = md.replace(titleRe, "# MUUSIA v" + NEXT + " — Node Reference").replace(allRe, "All " + TOTAL + " built-in nodes.");
for (const [cat, name] of Object.entries(SECTION)) {
  if (!counts[cat]) continue;
  const re = new RegExp("^## " + name + " \\(\\d+\\)$", "m");
  if (!re.test(md)) { console.error("MISS: NODES.md heading '## " + name + "' not found - aborting, nothing written"); process.exit(1); }
  md = md.replace(re, "## " + name + " (" + counts[cat] + ")");
}

/* ---------- 3. TAGS ---------- */
const tags = JSON.parse(readFileSync(TAGS, "utf8"));
const VOCAB = new Set(Object.values(tags).flat());
const MINE = ["3d", "mesh", "noise", "organic", "structural"];
for (const t of MINE) {
  if (!VOCAB.has(t)) { console.error("MISS: tag '" + t + "' is not in the vocabulary - aborting, nothing written"); process.exit(1); }
}
tags.blobmesh = MINE;
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];

/* ---------- 4. HANDOFF ---------- */
const A_ARCH = "- `src/defs/helpers.js` — shared node helpers:";
if (handoff.split(A_ARCH).length - 1 !== 1) {
  console.error("MISS: HANDOFF helpers bullet not found or not unique - aborting, nothing written");
  process.exit(1);
}
handoff = handoff.replace(
  A_ARCH,
  `- **Pin types are a closed set of four:** \`paths\`, \`value\`, \`style\`, \`mesh\`
  (\`mesh\` added ${NEXT}). finishWire compares the type strings, so a new type
  refuses wrong connections for free — but it also needs a \`TYPE_COLOR\` entry
  (the port dot reads it with no fallback and renders invisible without one)
  and a \`defaultFor\` branch. Mesh payload contract in MUUSIA-NODE-API.md.
` + A_ARCH
);

const ENTRY = `- **${NEXT}** Blob Mesh + a fourth pin type (generated geometry can now
  reach Mesh Slice without an STL round-trip). NEW PIN TYPE \`mesh\` via
  tools/era/patch-mesh-pin.mjs: finishWire already compares type strings so
  the connection rules needed nothing, but TYPE_COLOR did (the port dot reads
  \`TYPE_COLOR[pin.type]\` with NO fallback, so an undocumented type renders as
  an invisible circle) plus a \`defaultFor\` -> null branch. Payload
  \`{ kind:"mesh", tri, v, dims }\`, flat 9-per-triangle, centred and scaled to a
  unit longest dimension at the SOURCE so a wired mesh and an imported STL
  slice identically. tools/era/patch-meshslice-input.mjs adds Mesh at ins
  index 1 (after Style, so existing Style wires keep their port number); the
  wire wins over a loaded file and unplugging falls back to it. NEW GEN
  blobmesh (structural): body = 1-5 metaballs fused with a polynomial
  smooth-min, surface found by marching each ray and bisecting the OUTERMOST
  crossing — the naive inside-out bisection broke as soon as manual placement
  put the origin outside the union, so the sampling origin is the
  radius-weighted centroid of the ball centres. Placement Seeded or Manual
  (X/Y/Z + size per ball, seed ignored). Profile presets or wired paths, read
  as Cross-section (DEFAULT) or Vertical profile — the first release only had
  the vertical reading and a wired Superformula star therefore looked ignored,
  which is also how the second bug surfaced: the profile was mapped against a
  guessed height (\`rz * 1.05\`) instead of the real one, so Ball size 120%
  pushed the ends past the table and flattened them. Now two-pass: measure the
  Z extent, then apply profile/taper/twist against it. Surface distortion =
  seam-free fBm (three noise2 lookups on the direction vector, never on
  theta/phi, which would seam at 0/2pi) + angular lobes + vertical waves.
  Outputs Wireframe, Silhouette, Mesh in that order because the engine
  previews port 0 and a mesh there renders blank; the silhouette is real
  (front-face/back-face edge pairs chained), not a projected hull. Tags
  3d/mesh/noise/organic/structural. Validator tools/validate-blobmesh.mjs
  (113 checks): mesh contract (v.length === tri*9, unit normalisation,
  centring, 1e-4 rounding, S*(2R-2) triangle count), sphere/oval ratios,
  every profile option, cross-section vs vertical readings, Profile amount 0
  proven to be a true no-op, Hourglass pinch at ball size 120%, per-ball
  XYZ/size liveness, balls pulled fully apart, lobe/wave/noise liveness,
  wireframe ring+meridian counts, silhouette within the outline, view angle
  NOT affecting the mesh, budget at 128x128, extremes, and a live handshake
  slicing the generated mesh through the baked Mesh Slice. Mesh Slice
  validator grew to 169 (wired mesh precedence, fallback, EMPTY and garbage
  on the pin).
`;
const lines = handoff.split("\n");
let lastIdx = -1;
for (let i = 0; i < lines.length; i++) if (/^- \*\*\d+\.\d+\*\*/.test(lines[i])) lastIdx = i;
if (lastIdx < 0) { console.error("MISS: no version-history entries in HANDOFF - aborting, nothing written"); process.exit(1); }
let end = lastIdx + 1;
while (end < lines.length && (lines[end].startsWith("  ") || lines[end].trim() === "")) {
  if (lines[end].trim() === "" && end + 1 < lines.length && !lines[end + 1].startsWith("  ")) break;
  end++;
}
console.log("  handoff: last entry " + lines[lastIdx].match(/^- \*\*(\d+\.\d+)\*\*/)[1] + ", inserting " + NEXT);
lines.splice(end, 0, ENTRY.replace(/\n$/, ""));
handoff = lines.join("\n");

/* ---------- write ---------- */
app = app.replace(/APP_VERSION\s*=\s*"[^"]+"/, 'APP_VERSION = "' + NEXT + '"');
writeFileSync(APP, app);
writeFileSync(API, api);
writeFileSync(MD, md);
writeFileSync(TAGS, JSON.stringify(sorted, null, 1) + "\n");
writeFileSync(HANDOFF, handoff);
console.log("  OK  " + APP + " (APP_VERSION " + NEXT + ")");
console.log("  OK  " + API + " (mesh pin type + payload contract)");
console.log("  OK  " + MD + " (Blob Mesh paragraph, All " + TOTAL + ", headings recomputed)");
console.log("  OK  " + TAGS + " (blobmesh: " + MINE.join(", ") + ")");
console.log("  OK  " + HANDOFF + " (v" + NEXT + " entry + pin-type rule)");
console.log("APPLIED: documentation batch complete for v" + NEXT);
