/* Era patch: documentation batch for Zine, Video Test Card and Polyhedron
   Studio. Run AFTER baking all three and bumping APP_VERSION, and BEFORE
   tools/make-catalog.mjs (the catalog is generated from NODES.md).

   - docs/MUUSIA-NODES.md: header version, the three category counts and the
     total, plus one paragraph per new node in the right section.
   - docs/MUUSIA-TAGS.json: entries using ONLY the existing vocabulary.
   - docs/MUUSIA-HANDOFF.md: one version-history entry.

   Every number is read from disk, never from the conversation. Anchored
   exact-string replacement, idempotent, MISS-aborts writing nothing. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const findDoc = (name) => {
  for (const q of ["docs/" + name, name]) if (existsSync(q)) return q;
  console.log("MISS  " + name + " not found in docs/ or repo root - ABORT");
  process.exit(1);
};
const NODES = findDoc("MUUSIA-NODES.md");
const TAGS = findDoc("MUUSIA-TAGS.json");
const HANDOFF = findDoc("MUUSIA-HANDOFF.md");

/* ---- facts from disk ---- */
const app = readFileSync("src/App.jsx", "utf8");
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];

const DIR = "src/defs/nodes";
const files = readdirSync(DIR).filter((f) => f.endsWith(".js"));
/* group and reititys are inline DEFS in App.jsx, not files: +2, both Routing */
const TOTAL = files.length + 2;
const catCount = {};
for (const f of files) {
  const src = readFileSync(DIR + "/" + f, "utf8");
  const m = src.match(/cat:\s*"([a-z]+)"/);
  if (m) catCount[m[1]] = (catCount[m[1]] || 0) + 1;
}
const GEN = catCount.gen || 0, MOD = catCount.mod || 0, DEC = catCount.dec || 0;
const MATH = catCount.math || 0;
/* the two inline DEFS in App.jsx are not files: Group counts as a Combiner
   and Reititys as Routing, so the Combiner total is one above the file count */
const DUO = (catCount.duo || 0) + 1;
const ROUTING = TOTAL - (GEN + MOD + DEC + DUO + MATH);
console.log("INFO  version " + V + ", " + TOTAL + " nodes: gen " + GEN + " mod " + MOD
  + " dec " + DEC + " duo " + DUO + " math " + MATH + " routing " + ROUTING);

for (const key of ["zine", "videotest", "polystudio"]) {
  if (!existsSync(DIR + "/" + key + ".js")) {
    console.log("MISS  " + DIR + "/" + key + ".js not baked yet - ABORT");
    process.exit(1);
  }
}

let nodes = readFileSync(NODES, "utf8");
let handoff = readFileSync(HANDOFF, "utf8");
const tags = JSON.parse(readFileSync(TAGS, "utf8"));
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (nodes.includes("**Polyhedron Studio**") && tags.polystudio && handoff.includes("Polyhedron Studio")) {
  console.log("SKIP  patch-docs-v" + V + "-three-nodes already applied");
  process.exit(0);
}

const sub = (hay, old, neu, name) => {
  const parts = hay.split(old);
  if (parts.length === 2) { OK(name); return parts.join(neu); }
  MISS(name + " (" + (parts.length - 1) + " hits)");
  return hay;
};

/* ---- NODES.md: header, counts ---- */
{
  const hm = nodes.match(/# MUUSIA v[\d.]+ \u2014 Node Reference/);
  if (hm) { nodes = nodes.replace(hm[0], "# MUUSIA v" + V + " \u2014 Node Reference"); OK("NODES.md header -> v" + V); }
  else MISS("NODES.md header line");
  const tm = nodes.match(/All (\d+) built-in nodes\./);
  if (!tm) MISS("NODES.md total count line");
  else if (Number(tm[1]) + 3 !== TOTAL) {
    MISS("NODES.md total: doc says " + tm[1] + ", disk says " + TOTAL
      + ", expected " + (Number(tm[1]) + 3) + " - counts disagree, ABORT");
  } else {
    nodes = nodes.replace(tm[0], "All " + TOTAL + " built-in nodes.");
    OK("NODES.md total " + tm[1] + " -> " + TOTAL);
  }
  /* cross-check the disk count against the doc: this release adds exactly two
     generators and one combiner, so any other delta means the count is wrong */
  for (const [label, n, added] of [["Generators", GEN, 2], ["Combiners", DUO, 1]]) {
    const re = new RegExp("^## " + label + " \\((\\d+)\\)$", "m");
    const mm = nodes.match(re);
    if (!mm) { MISS("NODES.md " + label + " heading"); continue; }
    const old = Number(mm[1]);
    if (old + added !== n) {
      MISS("NODES.md " + label + ": doc says " + old + ", disk says " + n
        + ", expected " + (old + added) + " - counts disagree, ABORT");
      continue;
    }
    nodes = nodes.replace(mm[0], "## " + label + " (" + n + ")");
    OK("NODES.md " + label + " " + old + " -> " + n);
  }
}

/* ---- NODES.md: the three paragraphs ---- */
const ZINE = `

**Zine** \u2014 imposition for folded booklets: wired compositions are laid onto the
sheet in the order the FOLDS require, so the plotted sheet folds into a finished
zine. Each input is a full-canvas composition scaled into its page panel, as in
Mini Canvas, and the page pins appear and disappear with the Format \u2014 *8-page
mini zine* (the classic one-sheet, one-cut zine: the top row prints upside down
and the middle slit is drawn for you), *4-page folio*, *8-* and *16-page saddle
stitch* (2-up per sheet side, Sheet picks the sheet of the stack) and
*Accordion* (3\u201312 panels, optionally continuing on the back). Double-sided work
runs through *Side*: plot Front, turn the paper over, switch to Back and plot
again. The back imposition is derived, never typed \u2014 the reverse of page k is
its own recto/verso partner and its panel mirrors according to *Flip axis*
(Long edge keeps the artwork upright, Short edge turns it 180\u00B0) \u2014 so pages land
back-to-back with no hand arithmetic. Registration marks print at identical
sheet coordinates on both sides and are symmetric under both flips, so they
overprint themselves when the sheet is turned. Because a page panel rarely has
the sheet's proportions, *Scaling* decides who gives way: Fit letterboxes, Fill
crops (the overlay then draws the surviving source region on the canvas),
Stretch distorts, and Rotate 90 + Fit lands exactly on A-series page
proportions \u2014 an A4 landscape canvas rotated is an A4 portrait page, full bleed
and no distortion, the artwork simply reading sideways on the sheet. Trim marks,
fold ticks or dashed fold lines, the cut slit and panel frames go on the Mark
pen; *Page numbers* draws a numeral in each panel in that panel's own
orientation \u2014 print once, fold it, and the imposition is proven.`;

const VIDEOTEST = `

**Video Test Card** \u2014 a collection of broadcast and imaging test cards redrawn
as pen-plotter line art: *Philips circle* (the PM5544 composite \u2014 19\u00D714
crosshatch, geometry circle, castellations, colour bar band, multiburst
gratings, staircase and the two station-text boxes), *EIA 1956 resolution*
(converging TVL wedges at the centre and in all four corners, focus circles,
greyscale steps, stripe boxes, overscan border arrows), *Monoscope grid*,
*Convergence crosshatch*, *Convergence dots*, *Siemens star*, *Zone plate* (true
Fresnel spacing \u2014 ring radii follow the square root of the index, so every ring
encloses the same area), *Multiburst sweep*, *Colour bars* (the EBU seven over
reversed castellations, a PLUGE wedge and the white/black references),
*Greyscale staircase*, *Overscan frames*, *Focus chart*, *Checkerboard*,
*Line-pair ladder* and *Circle geometry*. A pen cannot lay down grey, so every
tone is hatched: *Tone* and *Ink spacing* set the density and the greyscale
steps ramp their hatch spacing instead of their darkness \u2014 the honest
translation of a grey ramp. *Aspect* letterboxes the card into a true 4:3, 16:9
or 1:1 frame, because a test card drawn at the wrong ratio tests nothing.
Colour elements map onto the palette (bars run Gray / Ochre / Sky / Green /
Magenta / Red / Blue, the closest analogues of the EBU order) or collapse onto
one pen. Two knobs turn the instrument back into an image: *CRT warp* barrels or
pincushions the card (pinned at the corners, so it never leaves the sheet) and
*Line jitter* tears each scan line sideways with seeded noise.`;

const POLY = `

**Polyhedron Studio** \u2014 polyhedra rendered face by face in 3D. The catalogue is
generated rather than tabulated: the five Platonic solids are exact and every
Archimedean and Catalan form is derived from them by three operators the node
implements \u2014 rectify (edge midpoints), truncate (corner cutting) and dual (polar
reciprocal) \u2014 so Cuboctahedron is a rectified cube, Rhombicosidodecahedron a
twice-rectified icosahedron and Rhombic triacontahedron the dual of the
icosidodecahedron, all with planar faces. Prisms, antiprisms, pyramids and
bipyramids take any side count; *Geodesic sphere* subdivides an icosahedron 1\u20134
times onto the sphere. Each face is filled IN ITS OWN PLANE before projection,
so the pattern rides the perspective instead of lying flat on the paper:
*Concentric inset* nests the face into itself (pair it with *Face inset* for the
white channel along every edge), *Face hatch*, *Spiral*, *Nested rings*,
*Centroid fan* and *Dots*. Back faces are culled by their true normal, kept
(*Transparent*) or thinned (*X-ray*); *Even density* divides the fill spacing by
each face's foreshortening so a face seen almost edge-on thins out instead of
collapsing into a solid sliver. *Stellate* raises each face on a pyramid along
its normal \u2014 negative dimples it inward \u2014 and reshapes the real solid, so it
reaches the Mesh output; *Explode* slides faces apart as a drawing convention
only. Three outputs: Faces, Silhouette (the projected outline as one closed
path, for a heavier pen or a cut line) and Mesh \u2014 the rotated, normalised
triangle payload, so Mesh Slice cuts exactly what the screen shows. Rotations
and Stellate are value ports.`;

nodes = sub(nodes, "\n\n## Modifiers (" + MOD + ")", VIDEOTEST + POLY + "\n\n## Modifiers (" + MOD + ")",
  "NODES.md Generators: Video Test Card + Polyhedron Studio");
nodes = sub(nodes, "\n\n## Math (" + MATH + ")", ZINE + "\n\n## Math (" + MATH + ")",
  "NODES.md Combiners: Zine");

/* ---- TAGS.json: existing vocabulary only ---- */
{
  const VOCAB = new Set(Object.values(tags).flat());
  const NEW = {
    zine: ["clip", "combine", "grid", "repeat", "structural"],
    videotest: ["chart", "geometric", "grid", "halftone", "retro", "scientific"],
    polystudio: ["3d", "geometric", "mesh", "space", "structural"],
  };
  let bad = [];
  for (const [k, ts] of Object.entries(NEW)) for (const t of ts) if (!VOCAB.has(t)) bad.push(k + ":" + t);
  if (bad.length) MISS("TAGS.json invented tags " + bad.join(" "));
  else {
    for (const [k, ts] of Object.entries(NEW)) tags[k] = ts;
    OK("TAGS.json entries for zine, videotest, polystudio");
  }
}

/* ---- HANDOFF version history ---- */
{
  const last = handoff.match(/\n- \*\*\d+\.\d+\*\*/g);
  if (!last) MISS("HANDOFF version-history entries not found");
  else {
    const prev = last[last.length - 1];
    const at = handoff.lastIndexOf(prev);
    const end = handoff.indexOf("\n\n", at + 1);
    if (end < 0) MISS("HANDOFF: could not find the end of the last entry");
    else {
      const entry = "\n\n- **" + V + "** Three nodes. **Zine** (duo): imposition for"
        + " folded booklets - 8-page mini zine, 4-page folio, 8/16-page saddle"
        + " stitch and accordion, with page pins created by the Format (dynamic"
        + " `ins`) and one output plus a Side selector for double-sided work. The"
        + " back imposition is DERIVED, not tabulated: the reverse of page k is its"
        + " recto/verso partner and its panel mirrors by Flip axis (short-edge flip"
        + " also turns the artwork 180 deg), proven by a geometric oracle that"
        + " mirrors every front panel and finds its twin. Registration marks sit at"
        + " identical sheet coordinates on both sides and are symmetric under both"
        + " flips. Scaling gained Fill (crop, with a Liang-Barsky clip) and"
        + " Rotate 90 modes after the first version letterboxed landscape canvases"
        + " into portrait pages - Rotate 90 + Fit is exact on A-series at margin 0."
        + " **Video Test Card** (gen/scientific): 15 real cards (PM5544 composite,"
        + " EIA 1956, monoscope, convergence, Siemens star, Fresnel zone plate,"
        + " multiburst, EBU bars + PLUGE, greyscale, overscan, focus, checkerboard,"
        + " line-pair ladder, circle geometry). Tone is hatch density throughout,"
        + " since a pen has no grey; CRT warp is pinned at the card corners so the"
        + " distortion can never walk off the sheet. **Polyhedron Studio**"
        + " (gen/space): 21 solids GENERATED by rectify / truncate / dual from the"
        + " five Platonics - Euler V-E+F=2 is validated for every one - with"
        + " per-face fills computed in the face plane before projection, Even"
        + " density (spacing divided by foreshortening) so edge-on faces do not"
        + " collapse into slivers, and three outputs (Faces, Silhouette, Mesh)."
        + " Stellate reshapes the solid and reaches the mesh; Explode is drawing"
        + " only, and a validator oracle enforces that split."
        + " (tools/validate-zine.mjs, tools/validate-videotest.mjs,"
        + " tools/validate-polystudio.mjs)";
      handoff = handoff.slice(0, end) + entry + handoff.slice(end);
      OK("HANDOFF version-history entry v" + V);
    }
  }
}

if (miss > 0) {
  console.log("ABORT " + miss + " edit(s) missed - nothing written");
  process.exit(1);
}
writeFileSync(NODES, nodes);
writeFileSync(TAGS, JSON.stringify(tags, null, 1) + "\n");
writeFileSync(HANDOFF, handoff);
console.log("DONE  " + ok + " edits applied: " + NODES + ", " + TAGS + ", " + HANDOFF);
