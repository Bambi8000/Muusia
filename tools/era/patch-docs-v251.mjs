/* tools/era/patch-docs-v251.mjs — v2.51 documentation batch
 *
 * Anchored exact-string edits on MUUSIA-NODES.md, MUUSIA-HANDOFF.md and
 * MUUSIA-NODE-API.md, PLUS runtime-computed node counts (never derived from
 * HANDOFF): total = files in src/defs/nodes, generators = files whose source
 * matches cat: "gen". All-or-nothing across all files; SKIP-idempotent.
 *
 * After a successful run it PRINTS the computed counts — sanity-check them
 * against ls src/defs/nodes | wc -l before committing.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const FILES = {
  nodes: "docs/MUUSIA-NODES.md",
  handoff: "docs/MUUSIA-HANDOFF.md",
  api: "docs/MUUSIA-NODE-API.md",
};
const fileOf = (n) => n.startsWith("N") ? "nodes" : n.startsWith("H") ? "handoff" : "api";
const srcs = {};
for (const [k, p] of Object.entries(FILES)) srcs[k] = readFileSync(p, "utf8");

/* ---- runtime counts ---- */
const nodeFiles = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
let genCount = 0;
for (const f of nodeFiles) if (/cat:\s*"gen"/.test(readFileSync("src/defs/nodes/" + f, "utf8"))) genCount++;
const total = nodeFiles.length;
console.log(`COUNTS  total node files: ${total}, generators: ${genCount}`);

const EDITS = [
  { name: "N1 NODES.md: header version",
    find: "# MUUSIA v2.50 \u2014 Node Reference",
    repl: "# MUUSIA v2.51 \u2014 Node Reference" },
  { name: "N2 NODES.md: Image paragraph (Contours mode)",
    find: "**Image** \u2014 raster import (PNG/JPG, downsampled to grayscale). Render modes:\n*Scanline wave* (darkness raises amplitude and frequency of horizontal waves),\n*Halftone dots*, *Hatch levels* (four cross-hatch passes gated by darkness), and\n*Flow shade* (noise streamlines seeded and lengthened by darkness). Gamma, invert,\nwhite cutoff.",
    repl: "**Image** \u2014 raster import (PNG/JPG, downsampled to grayscale). Render modes:\n*Scanline wave* (darkness raises amplitude and frequency of horizontal waves),\n*Halftone dots*, *Hatch levels* (four cross-hatch passes gated by darkness),\n*Flow shade* (noise streamlines seeded and lengthened by darkness), and\n*Contours (trace)* \u2014 1-6 tonal threshold levels traced as vector contour lines\nwith a minimum-contour speck filter (the former Trace Image node, merged in 2.51;\ngamma, strength, cutoff and seed have no effect in this mode). Gamma, invert,\nwhite cutoff.\n\n**Image Underlay** \u2014 shows an image behind the preview without ever plotting it \u2014\na tracing reference for drawing over a physical print. Without calibration the\nimage fits the margin box; with *Calibrate* on, jog the machine so the laser dot\nhits 2-4 corners of the physical print, type each DRO X/Y reading into its\nanchor, and a least-squares similarity fit (position + rotation + uniform scale)\nlands the on-screen image exactly where the print lies on the bed (laser offset\nand canvas origin from the machine profile). Per-anchor residuals draw as red\narrows \u2014 a long arrow means that reading is off. The *Frame* output is the image\noutline as a closed path for region/containment masking. Uses the 2.51 bgImage\nengine seam; the photo travels inside the patch." },
  { name: "N3 NODES.md: Trace Image -> legacy alias",
    find: "**Trace Image** \u2014 threshold contours of a loaded raster image (fileImage): 1-6 tonal\nlevels traced as vector contours fitted to the margin box, with invert and a\nminimum-contour filter for specks.",
    repl: "**Trace Image** \u2014 legacy alias, hidden from the palette since 2.51: merged into\nImage as the *Contours (trace)* render mode. Old patches keep loading and\nrendering unchanged (byte-identical compute)." },
  { name: "N4 NODES.md: Single Marker DRO sentence + Clock Face paragraph",
    find: "Bridges (*Path centers* + *Source order*) joins them in the exact order they\nare wired into Merge. Every style collapses to exactly one Bridges point at\nthe marker's center.",
    repl: "Bridges (*Path centers* + *Source order*) joins them in the exact order they\nare wired into Merge. Every style collapses to exactly one Bridges point at\nthe marker's center. *Coordinates: DRO (laser)* (2.51) reads X/Y as DRO\nvalues \u2014 jog the laser dot onto the target, type the reading in, and the marker\nlands at that exact bed position (laser offset and origin from the machine\nprofile, same convention as Image Underlay anchors).\n\n**Clock Face** \u2014 a clock dial without hands or numerals: hour batons around a\ncircle (count is a parameter \u2014 12 is a clock, 24 a day dial), minute marks\nbetween them (*None / Dots / Lines*, on their own pen), an optional spiral-dot\ncenter and a rim circle at an adjustable percentage of the radius. Each baton is\na closed quad: *Keystone* tapers it (positive = wider at the rim, \u00b11 collapses\nto a triangle, like a classic radial baton) and *Quarter scale* enlarges the\nmarkers sitting on exact quarter fractions of the circle (12/3/6/9 on a\ntwelve-hour dial). Outlines only \u2014 hatch downstream for solid batons. Diameter\nand center are value ports, so the dial can be driven." },
  { name: "N5 NODES.md: Sweep 3D paragraph after Lathe",
    find: "**Lathe** \u2014 revolved profile rendered as stacked ellipses (\"Rings\"), a mirrored\nsilhouette (\"Profile\"), or both. Shed shapes: *Skirt* (the ceramic high-voltage\ninsulator default), round wave, sharp zigzag; view tilt; ends taper automatically.",
    repl: "**Lathe** \u2014 revolved profile rendered as stacked ellipses (\"Rings\"), a mirrored\nsilhouette (\"Profile\"), or both. Shed shapes: *Skirt* (the ceramic high-voltage\ninsulator default), round wave, sharp zigzag; view tilt; ends taper automatically.\n\n**Sweep 3D** \u2014 a profile repeated along a 3D path and projected flat: the\ntransparent-wireframe sweep where the overlapping outlines build a moir\u00e9 body\n(no hidden-line removal, on purpose). Profiles: Circle, Rectangle, Polygon,\nStar, Line \u2014 or wire any paths into the Profile input (fitted to the\nWidth/Height box). Paths: Helix, Cone spiral, Flat spiral, Circle, Figure 8,\nLine, with elliptical Path width/depth, Rise, Turns, Phase and *Path end %* for\nthe shrinking spirals. Along the way the profile can taper (*End scale %*),\nbreathe (*Mod amount/cycles*, a deterministic sine) and *Twist*; orthographic\n*Tilt/Yaw* view. Fully deterministic \u2014 no seed; a point budget coarsens the\nprofile before Instances \u00d7 resolution explodes." },
  { name: "H1 HANDOFF: 2.51 version-history entry",
    find: "  extract-style validator now smoke-runs the neighbour function it was\n  inserted next to.\n\n## Hard-won pitfalls (keep)",
    repl: "  extract-style validator now smoke-runs the neighbour function it was\n  inserted next to.\n- **2.51** three nodes, one merge, one marker feature, two engine seams.\n  Engine: **bgImage seam** (tools/era/patch-bg-image.mjs) \u2014 def flag\n  `bgImage` routes file intake to the Portrait image pipeline (EXIF, 1280\n  px, JPEG dataURL at node.data.src + node.data.img), `ctx.machine`\n  additively exposes the active profile subset {originX/Y, flipY,\n  laserOffX/Y, workW/H}, and the preview draws the first bgImage node's\n  `bgRender()` under the paths in both PathsSVG call sites. **A1 canvas\n  presets** (patch-a1-preset.mjs). Nodes: **Image Underlay** (bgImage\n  tracing reference; 2-4 laser/DRO corner anchors -> least-squares 2D\n  similarity fit, per-anchor mm residuals as arrow guides, Frame output\n  for masking; renamed from photo_underlay in the lab BEFORE bake \u2014 keys\n  freeze on bake), **Clock Face** (hands-free dial: parametric hour count,\n  keystone baton quads, quarter emphasis on exact quarter fractions\n  `(i*4)%hours===0`, minute dots/lines on their own pen, spiral center,\n  rim %), **Sweep 3D** (profile swept along Helix / Cone spiral / Flat\n  spiral / Circle / Figure 8 / Line; wired-profile input bbox-fitted; End\n  scale + deterministic sine modulation + Twist; ortho Tilt/Yaw; 90k point\n  budget coarsens the profile, never drops instances). **Single Marker**\n  gained *Coordinates: DRO (laser)* (patch-marker-dro.mjs) \u2014 the machine\n  inversion INLINED in compute+overlay per the this-binding pitfall, with\n  an agreement oracle; X/Y slider max 800. **Image + Trace Image merged**\n  (patch-image-merge.mjs): Image gained *Contours (trace)* as a VERBATIM\n  transcription (byte-identity proven across an 8-combo sweep in\n  validate-image-merge.mjs); traceimg is now a `hidden: true` legacy alias\n  (the Route precedent) \u2014 old patches byte-identical. Validators:\n  image_underlay 33, singlemarker 17, image-merge 23, clockface 27,\n  sweep3d 23 oracles. Lessons: an exactness oracle must measure along the\n  feature's own axis, not corner radii (clockface C4 \u2014 corner distance is\n  hypot(r, halfWidth)); equivalence harnesses must unify param DEFAULTS\n  across both defs before comparing (image-merge B1 \u2014 image cell 2.4 vs\n  traceimg 1.6 broke deep-equal until traceimg defaults won).\n\n## Hard-won pitfalls (keep)" },
  { name: "A1 NODE-API: bgImage/bgRender/hidden rows after overlay row",
    find: "a guide function must never throw. |",
    repl: "a guide function must never throw. |\n| `bgImage` | flag (2.51) | Background-underlay node: the file param intakes via the Portrait image pipeline (EXIF orientation honored, long side 1280 px, JPEG dataURL frozen at `node.data.src` + dims/grayscale at `node.data.img`), and the preview draws the node's `bgRender()` UNDER the paths \u2014 always visible, not only when selected. One bgImage node renders at a time. The image travels inside the patch. |\n| `bgRender` | function (2.51) | `(params, ctx, node) => {src, cx, cy, w, h, rotDeg, opacity, gray} \\| null` \u2014 what the preview draws for a `bgImage` node, in canvas mm. Never plotted, never exported. Must never throw; return `null` to hide. |\n| `hidden` | flag | Hides the node from the palette while old patches keep loading and rendering unchanged \u2014 the legacy-alias mechanism (Route since 2.3x, Trace Image since 2.51). |" },
  { name: "A2 NODE-API: ctx.machine",
    find: "- `ctx` \u2014 `{ W, H }` canvas size in mm.",
    repl: "- `ctx` \u2014 `{ W, H }` canvas size in mm. Since 2.51 also `ctx.machine` \u2014\n  `{ originX, originY, flipY, laserOffX, laserOffY, workW, workH }` from the\n  active machine profile, for nodes that convert DRO/machine coordinates to\n  canvas mm (Image Underlay anchors, Single Marker DRO mode). Guard it: the\n  field may be absent in older callers and bare validator harnesses." },
];

const report = [];
let miss = 0, skip = 0, ok = 0;
for (const e of EDITS) {
  const s = srcs[fileOf(e.name)];
  if (s.includes(e.repl)) { report.push(`SKIP  ${e.name}`); skip++; continue; }
  const n = s.split(e.find).length - 1;
  if (n === 1) { report.push(`OK    ${e.name}`); ok++; }
  else { report.push(`MISS  ${e.name} (found ${n}, need 1)`); miss++; }
}

/* count lines: regex with exactly-once verification */
const countEdits = [
  ["nodes", /All \d+ built-in nodes/g, `All ${total} built-in nodes`, "N6 total count"],
  ["nodes", /## Generators \(\d+\)/g, `## Generators (${genCount})`, "N7 generator count"],
];
for (const [f, re, repl, name] of countEdits) {
  const m = srcs[f].match(re) || [];
  if (m.length === 1 && m[0] === repl) { report.push(`SKIP  ${name} (already ${repl})`); skip++; }
  else if (m.length === 1) { report.push(`OK    ${name}: "${m[0]}" -> "${repl}"`); ok++; }
  else { report.push(`MISS  ${name} (matched ${m.length}, need 1)`); miss++; }
}

console.log(report.join("\n"));
if (miss > 0) { console.log(`\nABORT — ${miss} MISS, nothing written to any file.`); process.exit(1); }
if (ok === 0) { console.log("\nAll edits already applied."); process.exit(0); }
for (const e of EDITS) {
  const f = fileOf(e.name);
  if (srcs[f].includes(e.repl)) continue;
  srcs[f] = srcs[f].split(e.find).join(e.repl);
}
for (const [f, re, repl] of countEdits) srcs[f] = srcs[f].replace(re, repl);
for (const [k, p] of Object.entries(FILES)) writeFileSync(p, srcs[k]);
console.log(`\nWROTE ${Object.values(FILES).join(", ")} — ${ok} applied, ${skip} skipped.`);
console.log(`Counts written: All ${total} built-in nodes / Generators (${genCount}).`);
