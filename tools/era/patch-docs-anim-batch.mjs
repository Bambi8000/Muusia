/* Era patch: docs + version for the animation batch release.
 *
 * Covers: Frame Grid, Frame Split, Collect Frames, TV Antennas, Snarled Line
 * (five baked nodes), the frameFan v2 engine seam, the Frame node rot output
 * and Galaxy Extended colors.
 *
 * Everything is computed from disk: APP_VERSION is read from src/App.jsx and
 * bumped +0.01; section counts and the node total are read from the docs and
 * the src/defs/nodes listing (+2 for the inline DEFS entries); doc paths are
 * resolved by searching. Requires the five nodes to be BAKED already — run
 * after bake, aborts otherwise. MISS-aborts if any anchor is not found
 * exactly once; SKIPs when already applied. TAGS.json is roundtrip-guarded:
 * if reformatting would change existing bytes, nothing is written.
 *
 * Run from the repo root: node tools/era/patch-docs-anim-batch.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const KEYS = ["frame_grid", "frame_split", "collect_frames", "antenna", "snarl"];
const find = (cands, label) => {
  for (const c of cands) if (existsSync(resolve(c))) return resolve(c);
  console.log("ABORT " + label + " not found (tried: " + cands.join(", ") + ")");
  process.exit(1);
};
const APP = find(["src/App.jsx"], "App.jsx");
const NODES = find(["MUUSIA-NODES.md", "docs/MUUSIA-NODES.md"], "MUUSIA-NODES.md");
const HANDOFF = find(["docs/MUUSIA-HANDOFF.md", "MUUSIA-HANDOFF.md"], "MUUSIA-HANDOFF.md");
const TAGS = find(["MUUSIA-TAGS.json", "docs/MUUSIA-TAGS.json"], "MUUSIA-TAGS.json");

for (const k of KEYS) {
  if (!existsSync(resolve("src/defs/nodes/" + k + ".js"))) {
    console.log("ABORT " + k + " is not baked - run node tools/bake.mjs " + k + " first");
    process.exit(1);
  }
}

let nodesMd = readFileSync(NODES, "utf8");
if (nodesMd.includes("**Frame Grid**")) {
  console.log("SKIP  docs already carry the animation batch");
  process.exit(0);
}
let appSrc = readFileSync(APP, "utf8");
let handoff = readFileSync(HANDOFF, "utf8");

let miss = 0;
const edit = (getSrc, setSrc, anchor, replacement, label) => {
  const src = getSrc();
  const parts = src.split(anchor);
  if (parts.length !== 2) {
    console.log("MISS  " + label + " (" + (parts.length - 1) + " hits, need exactly 1)");
    miss++;
    return;
  }
  setSrc(parts[0] + replacement + parts[1]);
  console.log("OK    " + label);
};
const eNodes = (a, r, l) => edit(() => nodesMd, (s) => { nodesMd = s; }, a, r, l);

/* ---- versions and counts, from disk ---- */
const vm = appSrc.match(/const APP_VERSION = "([\d.]+)"/);
if (!vm) { console.log("ABORT APP_VERSION not found in App.jsx"); process.exit(1); }
const CUR = vm[1];
const NEW = (Math.round((parseFloat(CUR) + 0.01) * 100) / 100).toFixed(2);
const diskCount = readdirSync(resolve("src/defs/nodes")).filter((f) => f.endsWith(".js")).length + 2;
console.log("INFO  version " + CUR + " -> " + NEW + ", node total from disk: " + diskCount);

const hm = nodesMd.match(/# MUUSIA v([\d.]+) \u2014 Node Reference/);
const tm = nodesMd.match(/All (\d+) built-in nodes\./);
const gm = nodesMd.match(/## Generators \((\d+)\)/);
const cm = nodesMd.match(/## Combiners \((\d+)\)/);
if (!hm || !tm || !gm || !cm) { console.log("ABORT NODES.md header/section anchors not found"); process.exit(1); }
if (parseInt(tm[1]) + KEYS.length !== diskCount) {
  console.log("ABORT count mismatch: doc says " + tm[1] + " + 5 != disk " + diskCount);
  process.exit(1);
}

edit(() => appSrc, (s) => { appSrc = s; },
  'const APP_VERSION = "' + CUR + '"', 'const APP_VERSION = "' + NEW + '"', "App.jsx: version " + NEW);
eNodes("# MUUSIA v" + hm[1] + " \u2014 Node Reference", "# MUUSIA v" + NEW + " \u2014 Node Reference", "NODES.md: header version");
eNodes("All " + tm[1] + " built-in nodes.", "All " + diskCount + " built-in nodes.", "NODES.md: total " + diskCount);
eNodes("## Generators (" + gm[1] + ")", "## Generators (" + (parseInt(gm[1]) + 2) + ")", "NODES.md: Generators +2");
eNodes("## Combiners (" + cm[1] + ")", "## Combiners (" + (parseInt(cm[1]) + 3) + ")", "NODES.md: Combiners +3");

/* ---- new paragraphs, newest-first under their section headings ---- */
const GEN_PARAS =
"**TV Antennas** \u2014 the analog-era rooftop antenna forest planted along a wired\n" +
"*Roofline* path (a Base Y baseline when unwired; the node only ADDS ink, so\n" +
"Merge the roofline alongside). The mast is the unit: each carries 1..*Heads*\n" +
"stacked heads and every head rolls its own type, size, boom tilt and element\n" +
"foreshortening \u2014 no two antennas are copies; *Vary* spreads mast heights\n" +
"0.5\u20132.2\u00d7. Types: Yagi (folded dipole, shrinking directors), forward-swept\n" +
"Log-periodic, VHF/UHF combo fishbone, mesh Panel with X-brace, radial FM star,\n" +
"offset satellite Dish with LNB arm \u2014 and Mixed turns a share of sites into\n" +
"parapet-level dish clusters under the masts. Braces lean diagonal struts (or\n" +
"guy wires), Cables hangs catenaries between level mast tops and drops\n" +
"feedlines to the roof; Cartoon's *Wonk* bows booms, jitters elements, caps\n" +
"tips with dots and doubles the masts. Orientation Up keeps masts vertical on\n" +
"sloped roofs, Aim Same way points the whole neighbourhood at one transmitter.\n" +
"Oversized masts retry at 0.72\u00d7 / 0.5\u00d7 before skipping, keeping edges clean.\n" +
"\n" +
"**Snarled Line** \u2014 a tangle of fishing line: each strand is one continuous\n" +
"stroke with coil memory \u2014 curvature relaxes toward the spool loop (*Coil mm*,\n" +
"*Memory* sets how firmly), a phase machine alternates loop clusters with long\n" +
"lazy runs, *Mess* shakes headings and flips handedness into figure-eights, and\n" +
"*Loop vary* rolls every coiling phase its own loop size from a log-spread so\n" +
"no two loops need match. *Clumping* pulls strands into attractor centers\n" +
"(seeded *Clumps*, or wire a path into *Clump at* to place them \u2014 the overlay\n" +
"shows the circles), *Clump size* sets the dense zone, *Tighten* shrinks loops\n" +
"inside it and *Clump pen* splits in-zone segments onto their own pen \u2014 the\n" +
"dense-core-in-a-halo look. Strands start from the Edges, the Clumps or\n" +
"Random; soft walls keep the tangle on the sheet.\n";

const DUO_PARAS =
"**Frame Grid** \u2014 animation frame imposition: frames land in a grid on one\n" +
"sheet with photo_trace-compatible fiducial markers (hatch-filled squares,\n" +
"centers exactly 20 mm from the corners, top-left orientation hole) so a\n" +
"camera pipeline can homography the frames back out. Fill *Animate* (default)\n" +
"takes the WHOLE animation through one input via the frameFan engine seam:\n" +
"*Total frames* defines the frame domain (the upstream Frame node sees\n" +
"frameCount = Total), and overflow pages onto further sheets \u2014 the outer\n" +
"ANIMATE frame is the SHEET index, so set panel Frames = ceil(Total / cells);\n" +
"per-frame export writes one file per sheet, numbering runs globally and a\n" +
"P n/N tag lands bottom-right. Fill *Inputs* gives one pin per cell\n" +
"(Sheets-shaped, one plot); *Clock* places a single input into cell frameIdx\n" +
"for per-frame export merging. The whole canvas maps into every cell with ONE\n" +
"shared scale so frames stay registered; *Fit each* is the contact-sheet\n" +
"alternative. Cell frames, frame numbers, a Label line and a marker pen\n" +
"complete the sheet. Evaluation cost multiplies by Total in Animate.\n" +
"\n" +
"**Frame Split** \u2014 chops ONE drawing into animation frames: N outputs that\n" +
"wire straight into Frame Grid. Split by exact *Ink length* (paths cut\n" +
"mid-stroke at the arc position, a z component interpolates through) or by\n" +
"whole *Path count* in draw order; frames *Build-up* cumulatively (the plot\n" +
"draws itself \u2014 the last frame is the whole piece) or hold disjoint\n" +
"*Windows*; *Ease* curves the boundary spacing and *Reverse* un-draws from\n" +
"the end. A closed path stays closed only once fully inside a frame.\n" +
"\n" +
"**Collect Frames** \u2014 the animation fan-out: wire a Frame-clock-animated\n" +
"branch in and every animation frame comes out as its own output (the engine\n" +
"frameFan seam re-evaluates the level once per frame with frameIdx 0..N-1 and\n" +
"frameCount = N \u2014 the *Frames* count here defines the frame domain, whatever\n" +
"the ANIMATE panel says). Evaluation cost multiplies by the frame count; one\n" +
"collector per dependency chain, and inside a Group the group's bound inputs\n" +
"arrive frozen at the outer frame.\n";

eNodes("## Generators (" + (parseInt(gm[1]) + 2) + ")\n\n", "## Generators (" + (parseInt(gm[1]) + 2) + ")\n\n" + GEN_PARAS + "\n", "NODES.md: TV Antennas + Snarled Line paragraphs");
eNodes("## Combiners (" + (parseInt(cm[1]) + 3) + ")\n\n", "## Combiners (" + (parseInt(cm[1]) + 3) + ")\n\n" + DUO_PARAS + "\n", "NODES.md: Frame Grid + Frame Split + Collect Frames paragraphs");

eNodes(
  "Yaw / Pitch rotate in 3D",
  "*Colors* Extended adds three more pens \u2014 Halo pen separates the halo from\n" +
  "the bulge, *Inner disc %* + Inner disc pen split the disc across a dithered\n" +
  "blend zone, and *HII regions %* re-tags arm stars as star-forming knots on\n" +
  "HII pen drawn 1.5\u00d7 \u2014 six pens in one galaxy, while Classic (3 pens) keeps\n" +
  "the original output byte-identical. Yaw / Pitch rotate in 3D",
  "NODES.md: Galaxy Extended colors sentence");

eNodes(
  "Reads the ANIMATE panel's frame state.",
  "Reads the ANIMATE panel's frame state \u2014 or a frameFan collector's frame\n" +
  "domain when one drives the graph. A fifth output `rot \u00b0` gives a\n" +
  "loop-seamless rotation in degrees, (frame / frameCount) \u00b7 360, for wiring\n" +
  "straight into Rotate inputs.",
  "NODES.md: Frame node rot \u00b0 output");

/* ---- HANDOFF history entry ---- */
const HISTORY =
"- **" + NEW + "** the animation batch: five nodes baked plus an engine seam.\n" +
"  **frameFan seam v2** in evalLevel: a def with `frameFan: true` re-evaluates\n" +
"  the level once per output frame (ctx.frameIdx 0..N-1, frameCount = N,\n" +
"  ctx._ff recursion guard) and fans the collected input out as its own\n" +
"  outputs; `frameFan` as a function (node, merged) => N instead hands the N\n" +
"  collected frames to compute AS the ins array (returning 0 opts out).\n" +
"  Applied era patches: patch-frame-fan2.mjs (installs clean or upgrades v1,\n" +
"  extract-and-run proves both forms), patch-frame-rot.mjs (Frame node fifth\n" +
"  output `rot \u00b0` = tl\u00b7360, old outputs byte-identical), patch-galaxy-\n" +
"  colors.mjs (Galaxy Colors Extended: Halo pen, dithered Inner disc split,\n" +
"  HII knots \u00d71.5 \u2014 Classic proven byte-identical pre/post across a sweep).\n" +
"  **Frame Grid** (duo): flipbook imposition with photo_trace-language plotted\n" +
"  markers; Animate fill = the whole animation through one input, overflow\n" +
"  pages to sheets (outer frameIdx = sheet, P n/N tag, global numbers);\n" +
"  Inputs and Clock fills for manual workflows; one shared canvas\u2192cell scale\n" +
"  preserves frame registration. **Frame Split** (duo): ink-length /\n" +
"  path-count chopper \u2014 exact arc cuts, z interpolation, build-up / windows,\n" +
"  ease, reverse. **Collect Frames** (duo): the generic frame fan-out on the\n" +
"  seam. **TV Antennas** (gen/structural): mast-as-unit rooftop forest \u2014\n" +
"  stacked heads with per-head type / size / boom tilt / foreshortening,\n" +
"  Panel and FM-star types, parapet dish clusters, struts, inter-mast cables,\n" +
"  retry-shrink at canvas edges. **Snarled Line** (gen/organic): coil-memory\n" +
"  strand physics with a coil/run phase machine, Loop vary log-spread loop\n" +
"  sizes, multi-clump attractors (wire Clump at to place them), Tighten and\n" +
"  Clump pen core split; validators prove the clump ink fraction (0.03\u21920.80)\n" +
"  and log-radius spread growth.\n\n";

edit(() => handoff, (s) => { handoff = s; },
  "\n## Hard-won pitfalls (keep)", "\n" + HISTORY + "## Hard-won pitfalls (keep)", "HANDOFF: v" + NEW + " history entry");

/* ---- TAGS.json, roundtrip-guarded ---- */
const NEWTAGS = {
  frame_grid: ["animation", "combine", "grid", "machine"],
  frame_split: ["animation", "combine", "pathops"],
  collect_frames: ["animation", "combine", "stack"],
  antenna: ["structural", "retro", "repeat"],
  snarl: ["organic", "chaos", "flow"],
};
const tagsRaw = readFileSync(TAGS, "utf8");
const tagsObj = JSON.parse(tagsRaw);
const trail = tagsRaw.endsWith("\n") ? "\n" : "";
if (JSON.stringify(tagsObj, null, 1) + trail !== tagsRaw) {
  console.log("MISS  TAGS.json formatting is not JSON.stringify(obj, null, 1) - not rewriting");
  miss++;
} else {
  const vocab = new Set(Object.values(tagsObj).flat());
  for (const [k, tg] of Object.entries(NEWTAGS)) {
    for (const t of tg) if (!vocab.has(t)) { console.log("MISS  unknown tag '" + t + "' for " + k); miss++; }
  }
  Object.assign(tagsObj, NEWTAGS);
  console.log("OK    TAGS.json: 5 entries staged (total " + Object.keys(tagsObj).length + ")");
}

if (miss) {
  console.log("ABORT " + miss + " missed anchor(s)/checks - nothing written");
  process.exit(1);
}
writeFileSync(APP, appSrc);
writeFileSync(NODES, nodesMd);
writeFileSync(HANDOFF, handoff);
const sorted = {};
for (const k of Object.keys(tagsObj).sort()) sorted[k] = tagsObj[k];
writeFileSync(TAGS, JSON.stringify(sorted, null, 1) + trail);

/* ---- verification ---- */
let bad = 0;
const chk = (cond, msg) => { console.log((cond ? "OK    " : "FAIL  ") + msg); if (!cond) bad++; };
chk(readFileSync(APP, "utf8").includes('APP_VERSION = "' + NEW + '"'), "verify: App.jsx at " + NEW);
const nm2 = readFileSync(NODES, "utf8");
chk(nm2.includes("All " + diskCount + " built-in nodes."), "verify: NODES.md total " + diskCount);
for (const nm of ["**TV Antennas**", "**Snarled Line**", "**Frame Grid**", "**Frame Split**", "**Collect Frames**"]) {
  chk(nm2.includes(nm), "verify: paragraph " + nm);
}
chk(readFileSync(HANDOFF, "utf8").includes("- **" + NEW + "**"), "verify: HANDOFF entry " + NEW);
chk(JSON.parse(readFileSync(TAGS, "utf8")).snarl.includes("chaos"), "verify: TAGS entries");
console.log(bad === 0 ? "DONE  docs + version at " + NEW : "DONE WITH " + bad + " FAILURES");
process.exit(bad === 0 ? 0 : 1);
