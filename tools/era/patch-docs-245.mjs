// tools/era/patch-docs-245.mjs — v2.45 documentation batch (ONE-SHOT, do NOT re-run).
// Anchored exact-string edits, OK/MISS/SKIP report. Run from repo root:
//   node tools/era/patch-docs-245.mjs
// Applies:
//   docs/MUUSIA-NODES.md    — header v2.43->v2.45, counts 208->210 / Generators 114->116,
//                             Mini Squares + Color Mesh paragraphs appended to Generators
//   docs/MUUSIA-HANDOFF.md  — node counts 206->208 files / 114->116 gens, wc -l check,
//                             v2.45 version-history entry, harness-drift pitfall bullet
//   docs/MUUSIA-NODE-API.md — §9 harness hash2/noise2/mulberry32 synced to the REAL
//                             src/defs/helpers.js implementations (they had drifted),
//                             header bumped to v1.3 / app v2.45
import fs from "node:fs";

let miss = 0, ok = 0, skip = 0;
function patchFile(path, edits) {
  let src = fs.readFileSync(path, "utf8");
  console.log("== " + path);
  for (const [label, oldStr, newStr] of edits) {
    if (src.includes(newStr)) { console.log("  SKIP " + label + " (already applied)"); skip++; continue; }
    if (!src.includes(oldStr)) { console.log("  MISS " + label); miss++; continue; }
    if (src.split(oldStr).length !== 2) { console.log("  MISS " + label + " (anchor not unique)"); miss++; continue; }
    src = src.replace(oldStr, newStr);
    console.log("  OK   " + label);
    ok++;
  }
  fs.writeFileSync(path, src);
}

// ---------------- docs/MUUSIA-NODES.md ----------------
const MINI_SQUARES_PARA = `**Mini Squares** — a field of axis-aligned squares packed on a hidden grid: larger
multi-cell squares (*Max square*) are placed first, then single cells fill in around
them against an occupancy grid, so neighbours share edges like a mosaic. Density is
patchy fBm noise multiplied by a *Spread* falloff (Full / Corner / Center / Linear,
strength via *Fade*) so the field crumbles away at its edge. *Nest depth* tucks
smaller squares inside squares — concentric insets or corner-anchored knots (*Mixed*
picks per square; each square keeps its own rng stream keyed to its cell, so its
interior is stable while other params move). *Gap* shrinks every top-level square so
shared edges separate. Structural invariant (validated): any two squares are
interior-disjoint or strictly nested. Chain into Container or Wind Tunnel as an
obstacle field, or drive Density with a value wire for animated growth.

**Color Mesh** — crumpled-paper facet field filled with fine cross-hatch mesh. The
sheet is fractured into convex facets by random BSP cuts; each facet gets its own
hatch angle (*Angle* + *Angle spread*) and a line-spacing gradient aligned to the
global *Light angle*, so facets shade like folded paper. Facets take pens from a
coarse noise field (*First pen* + *Pens used*, region size via *Color patch*),
producing large coherent color regions. **Mode 3D** lifts every facet corner to a
deterministic hash height (*Relief*) — shared cut vertices lift identically, so the
surface never tears — interpolates facet interiors over centroid-fan triangles for
sharp folds, bends the resampled hatch over them, applies true Lambert spacing
modulation (facets facing away from the Light go denser; normalized so Relief 0
reproduces Flat line-for-line), then tilts the sheet (*Tilt*) and refits it to the
margin box. Lines alternate direction per facet for efficient plotting; *Outline*
draws facet borders, folded too in 3D.

## Modifiers (65)`;

patchFile("docs/MUUSIA-NODES.md", [
  ["header version v2.43 -> v2.45",
    "# MUUSIA v2.43 — Node Reference",
    "# MUUSIA v2.45 — Node Reference"],
  ["total count 208 -> 210",
    "All 208 built-in nodes.",
    "All 210 built-in nodes."],
  ["Generators count 114 -> 116",
    "## Generators (114)",
    "## Generators (116)"],
  ["append Mini Squares + Color Mesh before Modifiers",
    "## Modifiers (65)",
    MINI_SQUARES_PARA],
]);

// ---------------- docs/MUUSIA-HANDOFF.md ----------------
const V245_ENTRY = `  routine: \`grep -c "DroPanel" src/App.jsx\` must print 2.
- **2.45** two nodes. **Mini Squares** (gen/geometric: occupancy-grid square
  mosaic, big-first placement, fBm x spread-falloff density, concentric/corner
  nesting with per-cell rng streams; validator proves every square pair
  interior-disjoint or strictly nested across seeds/styles/gaps). **Color Mesh**
  (gen/geometric: BSP convex facets + per-facet cross-hatch with light-aligned
  spacing gradient, noise-zoned pens; **Mode 3D**: hash-lifted vertices —
  bitwise-identical shared cut points keep the surface continuous —
  fan-triangle fold interpolation, adaptive resample + tilt + margin refit,
  Lambert spacing modulation normalized so relief 0 reproduces Flat
  line-for-line; output z stripped, since a third point component means pen
  plunge). Validator lessons: harness helper stubs MUST be verbatim copies of
  src/defs/helpers.js — the NODE-API §9 snippet had drifted (different
  hash2/noise2 family), making a lab-mode pass and a baked-mode fail on the
  same node (fixed in NODE-API v1.3 this release); a stub \`resample\` silently
  skipped the whole 3D lift (straight lines, zero deviation); and single-facet
  oracles must size the facet so the effect exceeds the detection threshold
  (an A4 facet under ±15 mm relief tilts <1° — the Lambert check needed a
  60x60 canvas to have power).`;

patchFile("docs/MUUSIA-HANDOFF.md", [
  ["node file count 206 -> 208",
    "- `src/defs/nodes/*.js` — one file per node, **206 files** (208 nodes total with",
    "- `src/defs/nodes/*.js` — one file per node, **208 files** (210 nodes total with"],
  ["generator count 114 -> 116",
    "  group + reititys; Generators 114, Modifiers 65). ESM format:",
    "  group + reititys; Generators 116, Modifiers 65). ESM format:"],
  ["wc -l check 206 -> 208",
    "- Node count check: `ls src/defs/nodes | wc -l` (206) — the old",
    "- Node count check: `ls src/defs/nodes | wc -l` (208) — the old"],
  ["insert v2.45 version-history entry",
    '  routine: `grep -c "DroPanel" src/App.jsx` must print 2.',
    V245_ENTRY],
  ["pitfall: harness helper drift",
    "  documents — a missing one fails silently as an empty node.",
    `  documents — a missing one fails silently as an empty node.
- Validator harness helpers must be verbatim copies of src/defs/helpers.js —
  stubs or drifted snippets pass in lab mode and fail (or worse, silently
  under-test) in baked mode. When lab and baked runs disagree, diff the
  harness helpers against helpers.js first.`],
]);

// ---------------- docs/MUUSIA-NODE-API.md ----------------
patchFile("docs/MUUSIA-NODE-API.md", [
  ["header v1.2/app 2.29 -> v1.3/app 2.45",
    "# Muusia — Custom Node API (v1.2, app v2.29)",
    "# Muusia — Custom Node API (v1.3, app v2.45)"],
  ["harness mulberry32 -> real helpers.js implementation",
    "function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}",
    "function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}"],
  ["harness hash2 -> real helpers.js implementation",
    "function hash2(x,y,s){let h=Math.imul(Math.floor(x)^0x9e3779b9,2654435761);h^=Math.imul(Math.floor(y)^0x85ebca6b,2246822519);h^=Math.imul((s|0)^0xc2b2ae35,3266489917);h=(h^(h>>>15))>>>0;return h/4294967296;}",
    "function hash2(x,y,seed){let h=seed+x*374761393+y*668265263;h=(h^(h>>>13))*1274126177;return((h^(h>>>16))>>>0)/4294967296;}"],
  ["harness noise2 -> real helpers.js implementation",
    "function noise2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}",
    "function noise2(x,y,seed){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash2(xi,yi,seed),b=hash2(xi+1,yi,seed);const c=hash2(xi,yi+1,seed),d=hash2(xi+1,yi+1,seed);return(a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;}"],
  ["harness sync warning added to section 9 intro",
    "ten-line harness — the same practice used for every built-in node:",
    "ten-line harness — the same practice used for every built-in node. **Keep these\nhelper snippets verbatim-identical to `src/defs/helpers.js`** — a drifted or stubbed\nhelper makes the harness test a different node than the app runs (v2.45 lesson):"],
]);

console.log("\n" + ok + " OK, " + miss + " MISS, " + skip + " SKIP");
if (miss > 0) console.log("MISS means the anchor was not found or not unique — inspect the doc, do not re-run blindly.");
process.exitCode = miss > 0 ? 1 : 0;
