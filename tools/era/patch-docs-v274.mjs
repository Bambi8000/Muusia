/* tools/era/patch-docs-v274.mjs — one-shot doc batch for the v2.74 release.

   Adds Calibration Sheet to the reference and the tag catalogue, and writes
   two handoff entries: v2.73 (the exporter bounds guard and the pen-colour
   announcement, released without a doc batch) and v2.74.

   Every fact is read from disk: version from App.jsx, counts from
   src/defs/nodes. Anchored, idempotent, MISS-aborts before writing anything.

   Run once from the repo root:  node tools/era/patch-docs-v274.mjs           */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
if (!NODES_MD || !HANDOFF_MD || !TAGS_JSON) { console.log("MISS  docs not found"); process.exit(1); }

const APP = readFileSync("src/App.jsx", "utf8");
const vm = APP.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in src/App.jsx"); process.exit(1); }
const VERSION = vm[1];

const NODE_DIR = "src/defs/nodes";
const files = readdirSync(NODE_DIR).filter((f) => f.endsWith(".js"));
const cats = files.map((f) => (readFileSync(join(NODE_DIR, f), "utf8").match(/cat:\s*"([a-z]+)"/) || [])[1]);
const count = (c) => cats.filter((q) => q === c).length;
const C = {
  Generators: count("gen"), Modifiers: count("mod"), Decorators: count("dec"),
  Combiners: count("duo") + 1, Math: count("math"), Routing: 1,
};
const TOTAL = Object.values(C).reduce((a, b) => a + b, 0);
const FILES = files.length;

if (!existsSync(join(NODE_DIR, "calib_sheet.js"))) { console.log("MISS  calib_sheet is not baked yet"); process.exit(1); }
console.log("      version " + VERSION + ", " + FILES + " files, " + TOTAL + " nodes (" +
  Object.entries(C).map(([k, v]) => k + " " + v).join(", ") + ")");

if (readFileSync(NODES_MD, "utf8").includes("**Calibration Sheet** —")) {
  console.log("SKIP  already applied (Calibration Sheet is in MUUSIA-NODES.md)");
  process.exit(0);
}

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
const PARA = `**Calibration Sheet** — a test sheet for measuring the machine rather than the
pen: a square of exactly *Size* mm with both diagonals, corner registration
crosses, a tick ruler along two edges, and the same square traced *Repeat
passes* times, each pass starting from a different corner and alternating
direction so backlash shows as a doubled line. Measure the sides for step
calibration, the two diagonals against each other for gantry squareness, and
the repeats for backlash. Unlike Test Card this node **never scales to fit** —
a millimetre on the sheet is a millimetre, and a square that does not fit the
canvas is refused with a printed warning instead of quietly shrunk. *Origin
cross* draws an identical cross as the first and last stroke of the file: if
the two do not land on top of each other the machine lost steps during the
plot, which needs *Optimize route* switched off, since a nearest-neighbour sort
sees two identical crosses as zero travel and plots them back to back. The
square is on its own pen, every mark and label on a second.

`;

let nodesMd = readFileSync(NODES_MD, "utf8");
nodesMd = insertBefore("NODES.md Calibration Sheet paragraph", nodesMd, "\n## Modifiers (", "\n" + PARA.trimEnd() + "\n");
nodesMd = swap("NODES.md title version", nodesMd, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + VERSION + " — Node Reference");
nodesMd = swap("NODES.md total count", nodesMd, /All \d+ built-in nodes\./, "All " + TOTAL + " built-in nodes.");
for (const [name, n] of Object.entries(C)) {
  nodesMd = swap("NODES.md section count: " + name, nodesMd, new RegExp("^## " + name + " \\(\\d+\\)$", "m"), "## " + name + " (" + n + ")");
}

/* ---------- MUUSIA-HANDOFF.md ---------- */
const HISTORY = `- **2.73** two exporter changes driven by a real plot going wrong. A
  **pre-flight bounds guard** now scans the finished G-code for moves outside
  the machine work area and, if it finds any, splices a \`; !! OUT OF BOUNDS\`
  block plus an M117 above the first command. The magnet-jig exporter had a
  per-move check all along; the plot exporter only warned when the whole canvas
  was oversized, so a label overhanging by 4 mm shipped silently and was found
  on paper. Scanning the emitted lines rather than the path data means
  start/end G-code and macro-driven moves are covered too. Note it cannot see a
  runtime \`SET_GCODE_OFFSET\`, so an origin set by PLOT_START shifts the real
  extent. Second, an opt-in **pen colour announcement**: with *Announce pen
  colour* on, each pen change emits \`RESPOND PREFIX=tgalarm MSG="Pen n: Name"\`
  before the pause, which moonraker-telegram-bot forwards to the phone with a
  notification. Opt-in because RESPOND aborts a print on a Klipper without
  \`[respond]\`. (tools/era/patch-export-guard-tgpen.mjs)

- **${VERSION}** **Calibration Sheet** (gen/structural) baked: an exact-size
  square with diagonals, corner crosses, a tick ruler, repeat passes that
  alternate direction, and an origin cross drawn first and last as a step-loss
  detector. The node refuses to scale — the validator proves side lengths to
  1e-9 mm and renders the same params on four canvas sizes to assert the
  geometry is byte-identical, so a fit transform added later turns the suite
  red. Two bugs were caught by writing that suite: a label on a narrow square
  overhung the footprint (now shrunk to the square's width), and a large
  *Cross size* pushed the origin cross to a negative coordinate that Klipper
  would refuse (now clamped to the sheet).
  (tools/validate-calib_sheet.mjs, tools/era/patch-docs-v274.mjs)
`;

let handoff = readFileSync(HANDOFF_MD, "utf8");
handoff = insertBefore("HANDOFF version history entries", handoff, "\n## Hard-won pitfalls (keep)", HISTORY);
handoff = swap("HANDOFF file count", handoff, /\*\*\d+ files\*\*/, "**" + FILES + " files**");
handoff = swap("HANDOFF total in layout note", handoff, /\(\d+ nodes total with/, "(" + TOTAL + " nodes total with");
handoff = swap("HANDOFF per-category note", handoff, /Generators \d+, Modifiers \d+/, "Generators " + C.Generators + ", Modifiers " + C.Modifiers);
handoff = swap("HANDOFF node count check", handoff, /wc -l` \(\d+\)/, "wc -l` (" + FILES + ")");

/* ---------- MUUSIA-TAGS.json ---------- */
const TAGS = { calib_sheet: ["geometric", "grid", "text"] };
const tags = JSON.parse(readFileSync(TAGS_JSON, "utf8"));
const vocabBefore = new Set(Object.values(tags).flat());
const invented = Object.values(TAGS).flat().filter((t) => !vocabBefore.has(t));
if (invented.length) { console.log("MISS  tags outside the vocabulary: " + invented.join(", ")); aborted = true; }
if (tags.calib_sheet) { console.log("MISS  calib_sheet already tagged"); aborted = true; }
for (const [k, v] of Object.entries(TAGS)) tags[k] = v;
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
if (new Set(Object.values(sorted).flat()).size !== vocabBefore.size) { console.log("MISS  tag vocabulary changed size"); aborted = true; }
if (!aborted) edits.push("TAGS.json calib_sheet entry (vocabulary still " + vocabBefore.size + " tags)");

/* ---------- NODE-API version stamp ---------- */
let apiOut = null;
if (API_MD) {
  const api = readFileSync(API_MD, "utf8");
  const hits = api.match(/app v[\d.]+/g);
  if (hits && hits.length === 1) { apiOut = api.replace(/app v[\d.]+/, "app v" + VERSION); edits.push("NODE-API version stamp"); }
  else console.log("      NODE-API version stamp not unique, left alone");
}

if (aborted) { console.log("ABORT nothing written"); process.exit(1); }
writeFileSync(NODES_MD, nodesMd);
writeFileSync(HANDOFF_MD, handoff);
writeFileSync(TAGS_JSON, JSON.stringify(sorted, null, 1) + "\n");
if (apiOut) writeFileSync(API_MD, apiOut);
for (const e of edits) console.log("OK    " + e);
console.log("DONE  v" + VERSION + " doc batch, " + TOTAL + " nodes");
