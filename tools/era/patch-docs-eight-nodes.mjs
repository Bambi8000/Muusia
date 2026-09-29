/* Era patch: version bump + documentation batch for eight new nodes
   (scaffolding, fruits, cagedipole, duga, stripediscs, ribbontype, reedsnow,
   datachart). Run from the repo root AFTER baking - node counts are read from
   src/defs/nodes. Anchored exact-string / single-match regex edits; MISS aborts
   before anything is written; SKIP if already applied. Edits:
     src/App.jsx           APP_VERSION  x.N -> x.(N+1)   (read from the repo)
     docs/MUUSIA-TAGS.json 8 entries, existing vocabulary only, keys kept sorted
     docs/MUUSIA-NODES.md  header version, total, section counts, 8 paragraphs
     docs/MUUSIA-HANDOFF.md file/node counts, version-history entry            */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const F_APP = "src/App.jsx", F_TAGS = "docs/MUUSIA-TAGS.json", F_NODES = "docs/MUUSIA-NODES.md", F_HAND = "docs/MUUSIA-HANDOFF.md";
let app = readFileSync(F_APP, "utf8"), tagsTxt = readFileSync(F_TAGS, "utf8"), nodes = readFileSync(F_NODES, "utf8"), hand = readFileSync(F_HAND, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

/* ---- idempotence sentinel: the NODES.md paragraph that only exists after this patch ---- */
if (nodes.includes("**Duga Array** —")) { console.log("SKIP  patch-docs-eight-nodes already applied (sentinel found)"); process.exit(0); }

/* ---- facts from the repo ---- */
const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V_OLD = vm[1] + "." + vm[2], V_NEW = vm[1] + "." + (parseInt(vm[2], 10) + 1);
console.log("INFO  version " + V_OLD + " -> " + V_NEW);
const KEYS = ["scaffolding", "fruits", "cagedipole", "duga", "stripediscs", "ribbontype", "reedsnow", "datachart"];
const files = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
for (const k of KEYS) if (!files.includes(k + ".js")) { console.log("MISS  src/defs/nodes/" + k + ".js not baked yet - ABORT"); process.exit(1); }
const cats = { gen: 0, mod: 0 };
for (const f of files) { const s = readFileSync("src/defs/nodes/" + f, "utf8"); const c = s.match(/\bcat:\s*"(\w+)"/); if (c && cats[c[1]] !== undefined) cats[c[1]]++; }
const N_FILES = files.length, N_TOTAL = N_FILES + 2;   /* group + reititys live inline in App.jsx */
console.log("INFO  files " + N_FILES + ", nodes " + N_TOTAL + ", gen " + cats.gen + ", mod " + cats.mod);

/* ---- helpers ---- */
const one = (src, old, neu, name) => { const parts = src.split(old); if (parts.length === 2) { OK(name); return parts.join(neu); } MISS(name + (parts.length === 1 ? " (anchor not found)" : " (anchor not unique: " + (parts.length - 1) + " hits)")); return src; };
const oneRe = (src, re, neu, name) => { const hits = src.match(new RegExp(re.source, re.flags.replace("g", "") + "g")) || []; if (hits.length === 1) { OK(name); return src.replace(re, neu); } MISS(name + " (regex hits: " + hits.length + ")"); return src; };
const wrap = (t, w = 78, indent = "") => { const words = t.replace(/\s+/g, " ").trim().split(" "); const lines = []; let cur = ""; for (const wd of words) { const lim = lines.length ? w - indent.length : w; if ((cur + " " + wd).trim().length > lim && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); } if (cur) lines.push(cur); return lines.map((l, i) => (i ? indent + l : l)).join("\n"); };

/* ---- 1. App.jsx version ---- */
app = one(app, 'APP_VERSION = "' + V_OLD + '"', 'APP_VERSION = "' + V_NEW + '"', "App.jsx APP_VERSION " + V_OLD + " -> " + V_NEW);

/* ---- 2. TAGS.json: parse, add, re-serialise sorted with the file's 1-space indent ---- */
const TAGS_NEW = {
  scaffolding: ["3d", "grid", "repeat", "structural"],
  fruits: ["nature", "organic", "plants", "scatter"],
  cagedipole: ["3d", "machine", "repeat", "retro", "structural"],
  duga: ["3d", "machine", "repeat", "retro", "structural"],
  stripediscs: ["clip", "deform", "geometric", "hatch", "round"],
  ribbontype: ["geometric", "hatch", "round", "text"],
  reedsnow: ["nature", "organic", "plants", "texture"],
  datachart: ["chart", "hatch", "scientific", "text"],
};
let tags;
try { tags = JSON.parse(tagsTxt); } catch (e) { MISS("TAGS.json does not parse"); tags = null; }
if (tags) {
  const vocab = new Set(Object.values(tags).flat());
  let bad = 0;
  for (const [k, v] of Object.entries(TAGS_NEW)) {
    if (tags[k]) { MISS("TAGS.json already has " + k); bad++; continue; }
    const unknown = v.filter((t) => !vocab.has(t));
    if (unknown.length) { MISS("TAGS.json unknown tag(s) for " + k + ": " + unknown.join(",")); bad++; continue; }
    tags[k] = v;
  }
  if (!bad) { const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k]; tagsTxt = JSON.stringify(sorted, null, 1) + "\n"; OK("TAGS.json +8 entries (vocabulary " + vocab.size + " tags, unchanged)"); }
}

/* ---- 3. NODES.md ---- */
nodes = oneRe(nodes, /^# MUUSIA v\d+\.\d+ — Node Reference$/m, "# MUUSIA v" + V_NEW + " — Node Reference", "NODES.md header version");
nodes = oneRe(nodes, /^All \d+ built-in nodes\./m, "All " + N_TOTAL + " built-in nodes.", "NODES.md total count -> " + N_TOTAL);
nodes = oneRe(nodes, /^## Generators \(\d+\)$/m, "## Generators (" + cats.gen + ")", "NODES.md Generators count -> " + cats.gen);
nodes = oneRe(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + cats.mod + ")", "NODES.md Modifiers count -> " + cats.mod);

const GEN_PARAS = [
  `**Data Chart** — plottable charts from your own data. Load a CSV, TSV or JSON file with the file button (first column labels, further columns numeric series, header row optional; semicolon CSV with decimal commas as Excel writes it; JSON as an array of objects or arrays — the parsed table travels inside the patch), or paste rows into *Data* separated by ; with label,value cells (the default demo table draws with nothing loaded). *Chart* Bars, Stacked bars, Lollipop, Lines (*Smooth* rounds them), Area (hatched under the curve), Scatter (the first two numeric columns as x and y, a third scales the marker; series names become axis titles), Donut or Radar. *Axes*, *Grid* (on *Grid pen*) and *Ticks* draw the frame with a nice 1-2-5 value scale that always includes zero; *Labels* writes categories, tick values, legend and *Title* in the stroke font at *Label size* — long category names run up at 45° and every label is shifted, never clipped, to stay inside *Margin*. *Fill* hatches bars and wedges (None / Hatch / Cross at *Fill density*), *Bar width* is the bar-to-slot ratio, *Markers* dots data points, *Sort* reorders categories by the first series. Series take one pen each from *Series pen* when *Cycle pens* is on; the frame draws on *Frame pen*.`,
  `**Reeds in Snow** — a charcoal sketch of winter reeds on blank paper. *Stalks* rise from a shallow ground band (*Ground*, *Ground depth*) to heights scattered by *Height* / *Height variation*, curving with *Bend*, leaning with *Lean* ± *Lean variation*, trembling with *Roughness*. Each stalk has its own weight: *Weight* and *Weight variation* decide how many parallel passes it gets at 0.18 mm pitch, and *Taper* makes the passes converge so the stalk thins toward the tip (a 0.3 mm pen fuses them into one dark line, a finer pen leaves separate strands). *Broken* turns a share into dotted lines, *Fallen* tips a share over as long crossing diagonals (shortened to fit the sheet, never clipped). On the *Light pen*: *Wind marks*, faint near-horizontal strokes across the snow surface; *Tangles*, small scribbled knots at stalk tips or on the ground; *Wisps*, long faint sweeps. The snow itself stays empty. Overlay shows the ground band.`,
  `**Ribbon Type** — brush lettering as parallel hairlines, after the ribbon-lettering paintings where a wide flat brush is dragged through geometric letterforms. Every letter is a monoline skeleton of stems, bowls and arches (lowercase a–z; capitals fold to lowercase, digits and punctuation keep an advance but draw nothing) swept by a flat brush of *Ribbon width* (× x-height), drawn as offset curves *Line gap* apart. Straight strokes become parallel lines, bowls and arches concentric arcs that collapse into a pinhole at the centre once the ribbon is wider than the curve, corners mitre so diagonals read as folded tape. *Stretch X* / *Stretch Y* / *Slant* deform the skeleton while the ribbon keeps its width; *Ascender* and *Descender* (× x-height) set how far stems run; *Facets per quarter* samples arcs coarsely for an angular folded alphabet (1 = diamonds, 8 = round). *Asymmetry* Grow / Shrink / Alternate / Random scales each successive stroke of a letter from its own baseline anchor by *Asymmetry amount* — the second arch of an m, the top bowl of an s, the hook of a g, the bowl of a b grow while feet stay on the baseline and the advance follows (Random uses *Seed*). *Letter spacing* is the gap between ribbon edges (0 = touching), *Align*, *Baseline* and *Fit* (shrink only) place the word inside *Margin*; *Pen per letter* cycles the palette. Wire Frame into Stretch Y or Slant to animate.`,
  `**Duga Array** — the Chernobyl-2 over-the-horizon radar receiver (Duga-1, the "Russian Woodpecker", often miscalled Duga-3) as a rotatable 3-D wireframe: a low-band curtain about 150 m tall and 500 m long and a high-band curtain about 90 × 250 m beside it, each a row of free-standing square lattice masts (*Mast width*, *Tower detail* Full lattice / Light / Outline) carrying horizontal trusses, wire-cage dipoles hung in every bay at *Dipole pitch* on stand-off pipes (*Stand-off*) in front of the masts, ladder-line *Feed lines* up each bay and a wire reflector *Screen* behind (Vertical / Mesh at *Screen wire spacing*). *Sections* Both / Low band / High band with their mast counts, heights, *Mast spacing* and *Section gap* in metres; *Dipole length* (× bay), *Cage diameter*, *Cage wires*, *Stagger levels*, *Ground line*. *View* Camera uses *Yaw* / *Pitch* / *Perspective* / *Eye height* (a true camera — far masts shrink and converge toward the eye's horizon; wire Frame into Yaw to orbit), *View* Front elevation is the orthographic 2-D drawing. Fits inside *Margin*; masts on *Mast pen*, cages and feeds on *Dipole pen*, screen and ground on *Screen pen*.`,
  `**Cage Dipoles** — the broadband wire-cage "fat dipoles" of the UTR-2 radio telescope at Kharkiv, the same family the Duga radar used: two cage arms on a common boom, each a cylinder of longitudinal *Wires* closed by a cone to the feed *Gap* and a cone to the boom end, *Hoops* at the cylinder ends and along it, four diagonal *Stays*. *Diameter* and *Cylinder* shape the cage (× dipole length). *Per row* puts dipoles end to end on one boom, *Rows* lines up booms at *Row gap*, *Poles* carries them on posts of *Pole height* with a cross-arm, *Ground frame* draws the field outline. Every wire is one 4-point polyline apex–hoop–hoop–apex and consecutive wires run in opposite directions, so the pen walks the cage without lifting. Camera: *Yaw* (wire Frame to orbit), *Pitch*, *Perspective* and *Eye height* — the default is the field photographed from the ground, near row large, far rows sinking toward the horizon. Fits inside *Margin*; poles and ground on *Pole pen*. No seed: the geometry is fully deterministic.`,
  `**Fruits** — the Kosmos Botanika fruit bowl, Root Vegetables' companion: *Kind* Lemon, Apple, Pear, Kiwi, Avocado, Fig, Starfruit, Dragon fruit, Pomegranate or Mix (every kind before any repeats). *Cut* Whole / Halved / Mix — a halved kiwi shows its seed ring and pale core, an avocado its pit, a lemon its segments and peel band, a starfruit its five-point star with seed pockets, a pomegranate its honeycomb of arils between membranes, a dragon fruit its speckled flesh and scale tips, apple and pear their core, seeds and stem. Every specimen is an outline from a kind-specific profile (Catmull-Rom lemon with collar and nipple, dimpled apple, necked pear, teardrop fig) roughened by *Irregularity* with a per-kind weight; *Fill* hatches, contours or stipples the peel at *Fill density* — only the peel band on halved fruit, and never under the sticker; *Details* adds what belongs to the kind: lemon pores, kiwi fuzz, avocado bumps, fig meridians, starfruit ridges, dragon-fruit bracts, the pomegranate crown. *Stems & leaves* on *Leaf pen*; *Sticker* Oval / Round puts a produce sticker with *Sticker label* (stroke font, kept upright on fruit lying on its side) on whole fruit, on *Sticker pen*; interior details on *Detail pen*. *Specimens*, *Size* (body height), *Size variation*, *Placement* No overlap / Loose, *Rotation* Upright / Tilt / Random (lemons and kiwis lie on their side), *Margin*.`,
  `**Scaffolding** — tube-and-coupler scaffolding as a 3-D wireframe: standards, ledgers, transoms, a kick lift at the base, facade and end braces, deck boards, guardrails, toe boards, base plates and couplers. *Bays* × *Lifts* × *Rows* sets the grid, *Lift height* and *Depth* (× bay) its proportions; *Shape* Full / Ragged / Stairs / Pyramid with *Vary* makes a half-built skyline, and where a deck sits on a column's top the standard runs on to guardrail height as a real scaffold does. *Braces* None / Ends / Zigzag / Lattice / Random on the outer face plus end faces; *Decks* None / Top / Every lift / Alternate with *Boards per deck* (on *Deck pen*, with *Guardrails + toe boards*); *Couplers* marks every ledger joint; *Tube* Line keeps a bare wireframe, Double draws every tube as two lines *Tube width* apart with open-end caps, ledgers stopping at the standard's surface. *Yaw* (wire Frame to orbit), *Pitch*, *Perspective*; fits inside *Margin*. Point budget guarded for the largest grids.`,
];
const MOD_PARAS = [
  `**Stripe Discs** — op-art rotated discs after Bridget Riley: a field of stripes is cut by circles, and inside each circle the field is rotated about the circle's centre while outside it runs on untouched, so the stripes twist through round lenses and meet the rim point-exactly (segment/circle intersections are solved analytically; collinear points are dropped so straight stripes stay 2-point lines). With nothing wired the node draws its own stripes (*Stripe spacing*, *Stripe angle*); wire any lines into the optional *Field* input to twist those instead — hatch, text, a map. *Layout* Grid (*Columns* × *Rows*, *Jitter*) or Random (*Count*, *Radius variation*, no overlap); *Radius*. *Rotation* modulates the disc angles: Progressive steps by *Angle step* disc by disc, Rows / Columns per row or column, Alternate flips ± step, Random and Noise are seeded; *Angle* is the base — wire Frame into it to spin every disc. *Gap* parts the rotated content from the rim, *Rim* draws the circle, *Disc pen* recolours the twisted content. Overlay shows the discs and the margin box.`,
];
const genAnchor = "## Generators (" + cats.gen + ")\n\n";
const modAnchor = "## Modifiers (" + cats.mod + ")\n\n";
nodes = one(nodes, genAnchor, genAnchor + GEN_PARAS.map((t) => wrap(t)).join("\n\n") + "\n\n", "NODES.md +7 generator paragraphs");
nodes = one(nodes, modAnchor, modAnchor + MOD_PARAS.map((t) => wrap(t)).join("\n\n") + "\n\n", "NODES.md +1 modifier paragraph");

/* ---- 4. HANDOFF.md counts + version entry ---- */
hand = oneRe(hand, /one file per node, \*\*\d+ files\*\* \(\d+ nodes total with/, "one file per node, **" + N_FILES + " files** (" + N_TOTAL + " nodes total with", "HANDOFF repo-layout counts");
hand = oneRe(hand, /Node count check: `ls src\/defs\/nodes \| wc -l` \(\d+\)/, "Node count check: `ls src/defs/nodes | wc -l` (" + N_FILES + ")", "HANDOFF node-count check");
const entry = (`- **${V_NEW}** Eight new nodes (${N_TOTAL} nodes, ${cats.gen} generators, ${cats.mod} modifiers). **Scaffolding** (\`scaffolding\`, structural): tube-and-coupler scaffold as a 3-D wireframe with Full / Ragged / Stairs / Pyramid skylines, braces, decks, guardrails, couplers, Line / Double tubes, camera yaw / pitch / perspective. **Fruits** (\`fruits\`, nature): Root Vegetables' companion, 9 kinds whole or halved, outline + peel Fill (Hatch / Contours / Stipple clipped to the peel band and around the sticker) + kind Details, produce Sticker with stroke-font label, Catmull-Rom \`spline()\` profile helper. **Cage Dipoles** (\`cagedipole\`, structural): UTR-2 fat dipoles, wires as single 4-point polylines alternating direction, rows / fields on poles, true camera with Eye height. **Duga Array** (\`duga\`, structural): Chernobyl-2 receiver in metres — two curtains of square lattice masts, cage dipoles on stand-offs, ladder feeds, reflector screen; View Camera / Front elevation (orthographic 2-D). **Stripe Discs** (\`stripediscs\`, deform): Riley-style rotated-disc lens on the built-in stripes or any wired Field; analytic circle clipping, Grid / Random layout, six rotation modulations, \`_discs()\` shared by compute + overlay. **Ribbon Type** (\`ribbontype\`, textimg): monoline skeleton alphabet a–z swept as offset curves — mitre / bevel joins, curvature collapse to a pinhole, Facets 1–8, Stretch X/Y + Slant on the skeleton only, Asymmetry per stroke (chained strokes scale about their join, \`["@",x,y]\` pins an anchor). **Reeds in Snow** (\`reedsnow\`, nature): charcoal reeds — multi-pass weight at 0.18 mm pitch with taper, broken / fallen stalks, wind marks / tangles / wisps on a light pen. **Data Chart** (\`datachart\`, scientific): first data-import node — CSV / TSV / semicolon-CSV (decimal comma) / JSON via onFile → node.data.svg, or pasted Data; 8 chart types, nice 1-2-5 axes, stroke-font labels shifted (never clipped) into the margin, hatch fills. Validators tools/validate-<key>.mjs (88 / 118 / 54 / 77 / 74 / 90 / 60 / 134 checks). Lessons: two params defaulting to the same pen make layer-based oracles ambiguous — set distinct pens in the test base; rotated text and marker radii must be reserved in the layout, not clipped afterwards; a generator whose specimen may not fit must check the body-only bbox before building details (Fruits went from 2.7 s to 0 ms on skipped sizes). Docs era: tools/era/patch-docs-eight-nodes.mjs.`);
hand = one(hand, "\n## Hard-won pitfalls (keep)", "\n" + wrap(entry, 78, "  ") + "\n\n## Hard-won pitfalls (keep)", "HANDOFF version-history entry " + V_NEW);

/* ---- write only if everything landed ---- */
if (miss > 0) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_APP, app); writeFileSync(F_TAGS, tagsTxt); writeFileSync(F_NODES, nodes); writeFileSync(F_HAND, hand);
console.log("DONE  " + ok + " edits applied: " + [F_APP, F_TAGS, F_NODES, F_HAND].join(", "));
