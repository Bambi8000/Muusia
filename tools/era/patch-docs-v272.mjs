/* tools/era/patch-docs-v272.mjs — one-shot doc batch for the v2.72 release.

   Adds Signature, Dice Pips, Sand Painting and Vision Chart to the reference,
   the tag catalogue and the handoff history, and refreshes every node count.

   Every fact is read from disk: the version from App.jsx, the counts from
   src/defs/nodes. Nothing here is hardcoded from the session that wrote it.
   Anchored, idempotent, MISS-aborts before writing anything.

   Run once from the repo root:  node tools/era/patch-docs-v272.mjs           */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const NEW_KEYS = ["signature", "dice_pips", "sand_painting", "vision_chart"];

/* ---------- locate the docs, wherever they live ---------- */
const findDoc = (name) => {
  for (const dir of ["docs", ".", "../docs", ".."]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
};
const NODES_MD = findDoc("MUUSIA-NODES.md");
const HANDOFF_MD = findDoc("MUUSIA-HANDOFF.md");
const TAGS_JSON = findDoc("MUUSIA-TAGS.json");
const API_MD = findDoc("MUUSIA-NODE-API.md");
if (!NODES_MD || !HANDOFF_MD || !TAGS_JSON) {
  console.log("MISS  could not locate MUUSIA-NODES.md / MUUSIA-HANDOFF.md / MUUSIA-TAGS.json");
  process.exit(1);
}

/* ---------- facts from disk ---------- */
const APP = readFileSync("src/App.jsx", "utf8");
const vm = APP.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in src/App.jsx"); process.exit(1); }
const VERSION = vm[1];

const NODE_DIR = "src/defs/nodes";
const files = readdirSync(NODE_DIR).filter((f) => f.endsWith(".js"));
const catOf = {};
for (const f of files) {
  const m = readFileSync(join(NODE_DIR, f), "utf8").match(/cat:\s*"([a-z]+)"/);
  if (m) catOf[f] = m[1];
}
const count = (c) => Object.values(catOf).filter((q) => q === c).length;
/* group and reititys are defined inline in App.jsx, so they are never on disk */
const C = {
  Generators: count("gen"),
  Modifiers: count("mod"),
  Decorators: count("dec"),
  Combiners: count("duo") + 1,
  Math: count("math"),
  Routing: 1,
};
const TOTAL = Object.values(C).reduce((a, b) => a + b, 0);
const FILES = files.length;

const missing = NEW_KEYS.filter((k) => !existsSync(join(NODE_DIR, k + ".js")));
if (missing.length) { console.log("MISS  not baked yet: " + missing.join(", ")); process.exit(1); }

console.log("      version " + VERSION + ", " + FILES + " files, " + TOTAL + " nodes (" +
  Object.entries(C).map(([k, v]) => k + " " + v).join(", ") + ")");

/* ---------- SKIP guard ---------- */
if (readFileSync(NODES_MD, "utf8").includes("**Signature** —")) {
  console.log("SKIP  already applied (Signature is in MUUSIA-NODES.md)");
  process.exit(0);
}

/* ---------- edit helpers: exact anchors, unique or MISS ---------- */
let aborted = false;
const edits = [];
const insertBefore = (label, text, anchor, block) => {
  const parts = text.split(anchor);
  if (parts.length !== 2) { console.log("MISS  " + label + " (" + (parts.length - 1) + " hits, need 1)"); aborted = true; return text; }
  edits.push(label);
  return parts[0] + block + anchor + parts[1];
};
const swap = (label, text, re, make) => {
  const hits = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
  if (!hits || hits.length !== 1) { console.log("MISS  " + label + " (" + (hits ? hits.length : 0) + " hits, need 1)"); aborted = true; return text; }
  edits.push(label);
  return text.replace(re, make);
};

/* ---------- MUUSIA-NODES.md ---------- */
const PARAS = `**Signature** — the artist's mark for a finished plot: signature text, date and
edition number in the single-stroke font, anchored to a sheet corner so it lands
in the same place on every print. *Layout* runs the three fields together on one
line with the chosen *Separator*, splits the name off on two lines, or stacks all
three; *Edition* formats the copy number as n/N, No. n or n of N. *Font* is the
hand: Plain is the bare font, Italic leans it, and Hand redraws every stroke with
seeded tremor plus per-letter tilt, size and baseline drift, rounding the corners
the way a moving nib does — *Tremor* sets how much, *Seed* picks a different hand,
and the *Rule* (Underline, Box, Brackets) goes through the same hand so a written
mark is not framed by a ruler. *Anchor* places the block against a corner at
*Margin* distance with Nudge X/Y for the last millimetres, or Custom for a free
position. Plot it last on a finer pen.

**Dice Pips** — classic dice faces. *Single* draws one face; *Sequence* reads
values such as \`1-6\`, \`0 2 4 6 8\` or \`987\` and lays them out as a centred grid
that shrinks to fit the sheet. Values 1-6 are the standard die faces, 0 and 7-9
conventional domino-style extensions on the same 3x3 grid. Pips only, or a square,
rounded-square or circular frame on its own pen. *Rings* and *Spiral* fill turn
each pip into a solid plotter dot — set *Fill pitch* to suit the nib.

**Sand Painting** — a raked dry garden. *Open rake* draws calm parallel furrows;
*Flow around stones* bends them around seeded rocks; *Island rings* lays nested
contours around each stone; *Spiral rake* is one continuous basin; *Mixed garden*
combines flowing furrows with cleared ring islands. The sand is cleared wherever a
stone stands, so the rake never crosses a rock. *Rake spacing* is the physical
distance between grooves and *Detail* the curve sampling — extreme settings coarsen
themselves to hold the point budget. Stone size variation and irregularity turn the
ellipses into real lumps; sand and stones take separate pens.

**Vision Chart** — a plotter-native eye-chart studio: geometrically scaled Landolt C
and equal-arm Tumbling E logMAR charts, Chinese 5-mark and Golovin-Sivtsev layouts,
and a seeded two-pen pseudoisochromatic plate whose hidden number is packed with its
own finer dots so it reads as a figure rather than a smudge. *Distance*, *Top logMAR*
and *Scale* set true optotype size — every row is scaled by the logMAR step and the
outermost stroke lands exactly on the nominal diameter, so the chart is dimensionally
honest; the 2.5 m default suits an A4 sheet and 5 m fills it with the largest rows
only. *Ink pitch* should match the pen. Artistic and educational output — not a
certified medical test.

`;

let nodesMd = readFileSync(NODES_MD, "utf8");
nodesMd = insertBefore("NODES.md four generator paragraphs", nodesMd, "\n## Modifiers (", "\n" + PARAS.trimEnd() + "\n");
nodesMd = swap("NODES.md title version", nodesMd, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + VERSION + " — Node Reference");
nodesMd = swap("NODES.md total count", nodesMd, /All \d+ built-in nodes\./, "All " + TOTAL + " built-in nodes.");
for (const [name, n] of Object.entries(C)) {
  nodesMd = swap("NODES.md section count: " + name, nodesMd, new RegExp("^## " + name + " \\(\\d+\\)$", "m"), "## " + name + " (" + n + ")");
}

/* ---------- MUUSIA-HANDOFF.md ---------- */
const HISTORY = `- **${VERSION}** four generators baked out of nodes-lab. **Signature**
  (gen/textimg) sets name, date and edition number in the single-stroke font and
  anchors the block to a sheet corner; the Hand font is seeded tremor plus
  per-letter tilt and baseline drift with three averaging passes for nib inertia,
  and the rule runs through the same wobble at 0.55x so a hand-set mark is not
  framed by a ruler. **Dice Pips** (gen/geometric) draws die faces 0-9 from a
  range or digit string with Rings/Spiral pip fills. **Sand Painting**
  (gen/organic) rakes a dry garden around seeded stones. **Vision Chart**
  (gen/scientific) builds Landolt C, Tumbling E, Chinese 5-mark,
  Golovin-Sivtsev and pseudoisochromatic charts at true optotype size.
  Three real bugs were found by the validators rather than by eye, and all
  three were invisible in the preview: Sand Painting's size-variation and
  irregularity sliders were dead (\`Math.min(1, x) / 100\` clamps to 1 before
  dividing, so every value above 1 % meant 1 % — the stones were always clean
  ellipses); Vision Chart's hatch loops stopped short of the nominal radius by
  up to one ink pitch, which is 8.5 % of the diameter on the smallest optotypes
  and broke the 10^0.1 row scaling that is the whole point of a logMAR chart;
  and the pseudoisochromatic plate sampled its figure with the same uniform
  dart-throwing as the ground, so the hidden number never resolved at any
  density. The figure is now packed in its own phase with finer dots and an
  11 % side bearing between digits. Vision Chart's scale labels moved from a
  3x5 dot matrix to \`fontStrokes\` (697 -> 361 paths and actually legible) and
  the default viewing distance dropped 5 m -> 2.5 m, the one value that fills
  A4 for all four charts. The node was renamed from the lab key
  \`vision_chart_lab\` before baking, since keys freeze at bake.
  (tools/validate-signature.mjs, tools/validate-dice_pips.mjs,
  tools/validate-sand_painting.mjs, tools/validate-vision_chart.mjs,
  tools/era/patch-docs-v272.mjs)
`;

let handoff = readFileSync(HANDOFF_MD, "utf8");
handoff = insertBefore("HANDOFF version history entry", handoff, "\n## Hard-won pitfalls (keep)", HISTORY);
handoff = swap("HANDOFF file count", handoff, /\*\*\d+ files\*\*/, "**" + FILES + " files**");
handoff = swap("HANDOFF total in layout note", handoff, /\(\d+ nodes total with/, "(" + TOTAL + " nodes total with");
handoff = swap("HANDOFF per-category note", handoff, /Generators \d+, Modifiers \d+/, "Generators " + C.Generators + ", Modifiers " + C.Modifiers);
handoff = swap("HANDOFF node count check", handoff, /wc -l` \(\d+\)/, "wc -l` (" + FILES + ")");

/* ---------- MUUSIA-TAGS.json ---------- */
const TAGS = {
  signature: ["decoration", "text"],
  dice_pips: ["dots", "fill", "geometric", "grid"],
  sand_painting: ["flow", "nature", "organic", "texture"],
  vision_chart: ["chart", "dots", "scientific", "text"],
};
const tags = JSON.parse(readFileSync(TAGS_JSON, "utf8"));
const vocabBefore = new Set(Object.values(tags).flat());
const invented = Object.values(TAGS).flat().filter((t) => !vocabBefore.has(t));
if (invented.length) { console.log("MISS  invented tags not in the vocabulary: " + invented.join(", ")); aborted = true; }
const already = Object.keys(TAGS).filter((k) => tags[k]);
if (already.length) { console.log("MISS  tag entries already present: " + already.join(", ")); aborted = true; }
for (const [k, v] of Object.entries(TAGS)) tags[k] = v;
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
const vocabAfter = new Set(Object.values(sorted).flat());
if (vocabAfter.size !== vocabBefore.size) { console.log("MISS  tag vocabulary changed size: " + vocabBefore.size + " -> " + vocabAfter.size); aborted = true; }
if (!aborted) edits.push("TAGS.json four entries (vocabulary still " + vocabAfter.size + " tags)");

/* ---------- MUUSIA-NODE-API.md version stamp (optional) ---------- */
let api = API_MD ? readFileSync(API_MD, "utf8") : null;
let apiOut = null;
if (api) {
  const hits = api.match(/app v[\d.]+/g);
  if (hits && hits.length === 1) { apiOut = api.replace(/app v[\d.]+/, "app v" + VERSION); edits.push("NODE-API version stamp"); }
  else console.log("      NODE-API version stamp not unique, left alone");
}

/* ---------- commit or abort ---------- */
if (aborted) { console.log("ABORT nothing written"); process.exit(1); }
writeFileSync(NODES_MD, nodesMd);
writeFileSync(HANDOFF_MD, handoff);
writeFileSync(TAGS_JSON, JSON.stringify(sorted, null, 1) + "\n");
if (apiOut) writeFileSync(API_MD, apiOut);
for (const e of edits) console.log("OK    " + e);
console.log("DONE  v" + VERSION + " doc batch, " + TOTAL + " nodes");
