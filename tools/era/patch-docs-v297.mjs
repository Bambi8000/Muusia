/* Era patch: documentation batch for the five-node release
   (Ray Fill, Fray, Pleat, Chronophoto, Typewriter Rain).
   Run once from the repo root after baking + version bump:  node tools/era/patch-docs-v297.mjs
   - resolves docs/ paths, reads APP_VERSION from src/App.jsx, counts from src/defs/nodes
   - anchored edits, MISS aborts before writing, SKIP if already applied
   - order: NODES.md counts + paragraphs, TAGS.json entries, HANDOFF history + counts */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const find = (name) => { for (const d of ["docs", "."]) { const p = resolve(d, name); if (existsSync(p)) return p; } throw new Error("cannot find " + name); };
const NODES = find("MUUSIA-NODES.md"), TAGS = find("MUUSIA-TAGS.json"), HANDOFF = find("MUUSIA-HANDOFF.md");
const APP = resolve("src/App.jsx");

const ver = (readFileSync(APP, "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!ver) { console.log("MISS APP_VERSION in src/App.jsx"); process.exit(1); }
const files = readdirSync(resolve("src/defs/nodes")).filter((f) => f.endsWith(".js"));
const catOf = (f) => (readFileSync(resolve("src/defs/nodes", f), "utf8").match(/cat:\s*"(\w+)"/) || [])[1];
const nGen = files.filter((f) => catOf(f) === "gen").length;
const nMod = files.filter((f) => catOf(f) === "mod").length;
const nFiles = files.length, nTotal = nFiles + 2; /* group + reititys live in App.jsx */
const NEW = ["rayfill", "fray", "pleat", "chrono", "typerain"];
for (const k of NEW) if (!files.includes(k + ".js")) { console.log("MISS baked node src/defs/nodes/" + k + ".js — bake first"); process.exit(1); }

let nodes = readFileSync(NODES, "utf8"), tagsRaw = readFileSync(TAGS, "utf8"), handoff = readFileSync(HANDOFF, "utf8");
if (nodes.includes("**Typewriter Rain** —")) { console.log("SKIP already applied (Typewriter Rain paragraph present)"); process.exit(0); }

const report = [];
let miss = false;
/* one-hit regex replace: MISS on 0 or 2+ hits */
const rx = (text, re, repl, label) => {
  const hits = text.match(new RegExp(re.source, re.flags.replace("g", "") + "g")) || [];
  if (hits.length !== 1) { report.push("MISS " + label + " (" + hits.length + " hits)"); miss = true; return text; }
  report.push("OK   " + label);
  return text.replace(re, repl);
};
const ins = (text, anchor, add, after, label) => {
  const parts = text.split(anchor);
  if (parts.length !== 2) { report.push("MISS " + label + " (" + (parts.length - 1) + " hits)"); miss = true; return text; }
  report.push("OK   " + label);
  return after ? parts[0] + anchor + add + parts[1] : parts[0] + add + anchor + parts[1];
};

/* ---------------- NODES.md ---------------- */
nodes = rx(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + ver + " — Node Reference", "NODES header version");
nodes = rx(nodes, /^All \d+ built-in nodes\./m, "All " + nTotal + " built-in nodes.", "NODES total count");
nodes = rx(nodes, /^## Generators \(\d+\)$/m, "## Generators (" + nGen + ")", "NODES generator count");
nodes = rx(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + nMod + ")", "NODES modifier count");

const GEN_PARAS = `**Typewriter Rain** — typewriter art as rain: the sheet becomes a fixed
character grid (*Size* sets the cap height, *Pitch X* / *Pitch Y* the cell in
cap-height units — a real machine sits near 1.2 × 1.7) and every column
(*Direction* Down) or row (Right) is filled with seeded runs, each run one
glyph from *Glyphs* repeated cell after cell on one pen, separated by at least
*Gap* empty cells. Repeat a character in *Glyphs* to weight it; lowercase is
typed as capitals, unknown characters are dropped, an empty field types M.
*Bars* turns a share of the runs into solid ruled lines through the cell
centres, *Slashes* forces a share into / ladders — the diagonal stairs of the
original. *Density* is the filled share of every lane (0 types nothing),
*Run length* and *Run variation* shape the runs (most short, a few long).
*Grid* Strict keeps every run on the row pitch; Free lets each run slip a
fraction of a cell like a platen that was never quite aligned. *Double strike*
overtypes each glyph with a 0.15 mm shift, once or twice, for the heavy-ribbon
look (the ink box is centred in the cell, so the shifts never leave it). *Pens
used* from *First pen* picks a seeded colour per run. Wire closed shapes into
**Mask** and the rain falls only inside them (bars break at the mask edge).
Cells are typed lane by lane, so a point-budget cut loses the far lanes first.

**Chronophoto** — Étienne-Jules Marey's chronophotographic motion analysis as
a drawing: an articulated stick figure (head, trunk, both arms and legs with
feet) is drawn at *Frames* successive instants of a motion — Long jump
(approach run, take-off, hang, landing), Walk, Run, High jump, Standing jump or
Somersault — with bone lengths held exactly constant, so the figures overlap
the way superimposed exposures do. The skeleton is 3-D (sagittal joint angles
on keyframe tables with Catmull-Rom interpolation, plus shoulder and hip
widths), so *View* Side is Marey's plate and Front turns the camera round on
the same model. Near limbs are solid and *Far limbs* Dashed as in the
originals (Solid / Hidden); *Frame style* can dash alternate or early
instants; *Head* Circle / Dot / None. *Trajectories* trace chosen joints
(head, hip, hands, feet, or all) as smooth dashed curves sampled from the
motion itself, with a marker at every instant and SFONT *Numbers* 1…N above
them. *Time window* crops the motion to a phase range, *Spacing* scales the
forward displacement (0 stacks every instant on one spot), *Stride* stretches
the travel, *Trunk lean* tilts the figure. The ground is where the lowest foot
stands: walking never leaves it, jumps lift off it, and *Ground line* draws it
with Marey's end dot. The whole sequence is centred and fitted (shrink only)
inside the margin box. Wire a line into **Path** and the pelvis follows it
instead — the motion supplies the poses, the wire supplies the route.
*Animate* turns the plate into an animation: Single instant draws one figure at
*Phase* (wire the Frame clock's t into it), Onion skin adds the previous
*Onion frames* exposures as ghosts (*Onion style* Dashed / Solid), and *Trail*
lets the trajectories write on up to the current instant (so far / full /
none) — the layout, scale and ground come from the whole time window, so the
figure travels across a fixed sheet frame by frame. Pens: Figure, Trajectory,
Labels.

**Pleat** — a ribbon of parallel lines folded like a strip of paper: the band
runs along the sheet (*Orientation* Vertical / Horizontal, *Length %* of the
margin box, *Width*) and kinks at every crease; between creases each of the
*Lines* is straight, so the strip reads as a stack of tilted panels in
perspective. Creases are written as a token script, one token per crease,
characters combining inside a token: \`-\` straight, \`/\` \`\\\` tilted by
*Tilt*, \`^\` \`v\` chevron (apex toward the start / end of the strip by
*Chevron mm*), \`<\` \`>\` shifted sideways by *Shift*, \`(\` \`)\` narrow or
wide by *Pinch*, \`x\` twist (the line order flips from that crease on — an
hourglass; a second \`x\` flips back), \`~\` or \`=\` force a fully
cylindrical or flat line distribution on that crease. *Preset* gives the
classic folds — Zigzag is the drawn-paper look (chevron creases alternating
left and right, wide fans at both ends), Accordion tilted creases, Twisted,
Fan — and Custom reads the *Folds* field (unknown characters are ignored, an
empty script is two straight creases, 60 tokens max). *Shade* pushes lines
toward the panel edges like a rolled cylinder; *Spacing variation* jitters the
crease intervals with the Seed. *Construction lines* extend every crease edge
from the ribbon corner to the margin box on *Guide pen*, the way the pencil
guides survive on the original drawing (corners already on the sheet edge get
none). Each ribbon line is one continuous stroke end to end.

`;
nodes = ins(nodes, "## Generators (" + nGen + ")\n\n", GEN_PARAS, true, "NODES generator paragraphs (newest first)");

const MOD_PARAS = `**Fray** — loose threads fraying off the source line, like yarn ends pulled
out of an embroidered outline: strands leave the path at *Spacing* intervals
(*Spacing jitter*), head Outward — or Left / Right / Both / Alternate for open
lines — within *Spread* of the normal, wave with *Wave amp* / *Wave length*,
*Wander* off course and lean toward the *Drift angle* by *Drift*; lengths
scatter by *Length variation* (most short, a few long) and stop at *Margin*
when *Clip to margin* is on. Along the way *Hitches* tie small self-crossing
loops and *Beads* hang tiny rings; every thread ends in a Coil (loose
overlapping loops), a Ring, a Knot (tight tangle), a Mix, or None (frayed tip)
at *Coil size* ± *Coil variation*. Each thread is ONE continuous stroke from
root to coil end. *Avoid source* keeps threads, beads and coils off the
interior of closed shapes. *Crossings* None makes the whole result
crossing-free: coils turn into inward spirals, hitches vanish, beads move
beside the thread, and threads steer around or stop at other threads and the
source (spatial-hash segment test). *First pen* + *Pens used* picks a seeded
colour per thread; *Inherit source pens* uses the root path's pen. *Keep
source* passes the input through.

**Ray Fill** — fills every closed shape with straight rays that fan out from a
centre and are clipped to the shape by even-odd rules, so nested shapes act as
holes. *Centres* Per shape gives each shape its own centre by *Placement*:
Centroid (starburst), Random inside (off-centre burst), Edge (a fan from the
outline) or Outside (sweeping near-parallel chords through the shape) — Mix
lets each shape draw its own kind for the varied look of a hand-filled map.
Shared scatters *Centres count* seeded centres over the margin box
(best-candidate spread); Nearest centre fills each shape only from the centre
closest to it, All centres lets every centre radiate through the whole sheet
so one burst spills across many shapes. *Spacing at rim* sets the ray gap at
the far edge — rays converge toward the core exactly like a real pen
starburst; *Core gap* opens a hole there instead of an ink pool. *Fill
fraction* fills only a seeded share of the shapes. *Jitter* wobbles ray angles,
*Min length* drops slivers, *Alternate direction* plots rays as a zigzag (off =
every ray drawn from the core outward). *Keep outlines* passes the shapes
through, *Inherit shape pens* colours the rays with each shape's pen.

`;
nodes = ins(nodes, "## Modifiers (" + nMod + ")\n\n", MOD_PARAS, true, "NODES modifier paragraphs (newest first)");

/* ---------------- TAGS.json ---------------- */
let tags;
try { tags = JSON.parse(tagsRaw); } catch (e) { report.push("MISS TAGS.json parse"); miss = true; }
if (tags) {
  const vocab = new Set(Object.values(tags).flat());
  const add = {
    rayfill: ["fill", "geometric", "hatch", "region"],
    fray: ["decoration", "deform", "organic", "texture"],
    pleat: ["geometric", "repeat", "structural"],
    chrono: ["animation", "creature", "scientific"],
    typerain: ["grid", "retro", "scatter", "text"],
  };
  for (const [k, v] of Object.entries(add)) {
    if (tags[k]) { report.push("MISS TAGS " + k + " already present"); miss = true; continue; }
    const bad = v.filter((t) => !vocab.has(t));
    if (bad.length) { report.push("MISS TAGS " + k + " uses unknown tags " + bad.join(",")); miss = true; continue; }
    tags[k] = v;
    report.push("OK   TAGS " + k);
  }
  const vocab2 = new Set(Object.values(tags).flat());
  if (vocab2.size !== vocab.size) { report.push("MISS TAGS vocabulary size changed"); miss = true; }
  else report.push("OK   TAGS vocabulary unchanged (" + vocab.size + ")");
  const sorted = {};
  for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
  tagsRaw = JSON.stringify(sorted, null, 1) + "\n";
}

/* ---------------- HANDOFF ---------------- */
handoff = rx(handoff, /\*\*\d+ files\*\* \(\d+ nodes total/, "**" + nFiles + " files** (" + nTotal + " nodes total", "HANDOFF file/node counts");
handoff = rx(handoff, /Generators \d+, Modifiers \d+\)/, "Generators " + nGen + ", Modifiers " + nMod + ")", "HANDOFF category counts");
handoff = rx(handoff, /`ls src\/defs\/nodes \| wc -l` \(\d+\)/, "`ls src/defs/nodes | wc -l` (" + nFiles + ")", "HANDOFF wc count");
const HIST = `- **${ver}** five nodes, one batch (lab → validator → visual proof → bake).
  **Ray Fill** (mod/fillstyle, \`rayfill\`): even-odd ray fill of closed
  shapes, Per shape centres (Centroid / Random inside / Edge / Outside / Mix)
  or Shared centres (Nearest / All), spacing-at-rim density, core gap, fill
  fraction; validator 115 checks with mutation-tested midpoint-inside,
  segment-vs-outline and hole oracles; bbox rejection kept output
  byte-identical at 4× speed. **Fray** (mod/deform, \`fray\`): threads off a
  source line with hitches, beads and coil/ring/knot ends, one stroke per
  thread; *Avoid source* (interior test) and *Crossings None* (spatial-hash
  steering, spiral coils, beads beside the thread) — validator 95 checks
  proves zero proper crossings over the whole result and root-on-source
  < 0.05 mm. **Pleat** (gen/geometric, \`pleat\`): folded ribbon of parallel
  lines from a crease token script (\`- / \\ ^ v < > ( ) x ~ =\`, presets
  Zigzag / Accordion / Twisted / Fan / Custom), cylinder shade, construction
  lines to the margin; validator 83 checks proves every token to the
  millimetre. **Chronophoto** (gen/scientific, \`chrono\`): Marey stick-figure
  motion analysis — 3-D skeleton, six keyframed motions, Side / Front,
  far-limb dashing, dashed joint trajectories with markers and SFONT
  numbers, ground line, optional Path pin for the pelvis route, *Animate*
  (Single instant / Onion skin, Phase wired from Frame, Trail write-on) with
  a layout fixed from the whole time window; validator 173 checks (bone
  invariance in every motion, no foot below ground, Phase 0/1 = plate first/
  last exposure, fixed ground across phases). **Typewriter Rain**
  (gen/textimg, \`typerain\`): typewriter grid with seeded glyph runs, bars
  and slash ladders, Down / Right, Strict / Free grid, double strike, Mask
  pin; validator 75 checks (single-cell strokes, one glyph + one pen per run,
  gap oracle mutation-tested). Engine lesson reconfirmed: shared geometry via
  \`this._helper\` methods (\`_plan\`, \`_roots\`, \`_layout\`, \`_frames\`,
  \`_grid\`) works because the engine calls compute/overlay as def methods.
  Doc batch: tools/era/patch-docs-v297.mjs.

`;
handoff = ins(handoff, "## Hard-won pitfalls (keep)\n", HIST, false, "HANDOFF version history entry");

for (const line of report) console.log(line);
if (miss) { console.log("ABORT — nothing written"); process.exit(1); }
writeFileSync(NODES, nodes);
writeFileSync(TAGS, tagsRaw);
writeFileSync(HANDOFF, handoff);
console.log("DONE v" + ver + " — " + nTotal + " nodes (" + nFiles + " files; gen " + nGen + ", mod " + nMod + ")");
