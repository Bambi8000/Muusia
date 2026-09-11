/* Era patch: G-code In release docs + version bump.
   Run from repo root AFTER baking: node tools/era/patch-gcode-in-docs.mjs
   - resolves doc paths by searching (docs live in docs/, never assumed)
   - APP_VERSION read from src/App.jsx and bumped by one minor
   - node counts computed from src/defs/nodes on disk (+2 inline DEFS)
   - MISS-abort if any anchor is not found exactly once; SKIP when applied
   ONE-SHOT: listed in tools/era/ per convention; the SKIP gate makes an
   accidental re-run harmless. */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const die = (m) => { console.error("MISS-ABORT: " + m); process.exit(1); };
const find = (name) => {
  for (const dir of ["docs", "."]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  die(name + " not found in docs/ or repo root");
};

const APP = "src/App.jsx";
const NODES_MD = find("MUUSIA-NODES.md");
const HANDOFF = find("MUUSIA-HANDOFF.md");
const TAGS = find("MUUSIA-TAGS.json");
if (!existsSync(APP)) die(APP + " not found (run from repo root)");
if (!existsSync("src/defs/nodes/gcode_in.js")) die("src/defs/nodes/gcode_in.js missing - bake first");

/* ---- SKIP gate ---- */
let nodesMd = readFileSync(NODES_MD, "utf8");
if (nodesMd.includes("**G-code In**")) { console.log("SKIP: G-code In already documented"); process.exit(0); }

/* ---- version from disk ---- */
let app = readFileSync(APP, "utf8");
const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) die("APP_VERSION not found in App.jsx");
const CUR = vm[1] + "." + vm[2];
const NEWV = vm[1] + "." + (parseInt(vm[2], 10) + 1);
console.log("version " + CUR + " -> " + NEWV);

/* ---- counts from disk ---- */
const nodeFiles = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
const TOTAL = nodeFiles.length + 2; /* + inline DEFS: group, reititys */
let GEN = 0;
for (const f of nodeFiles) if (/cat:\s*"gen"/.test(readFileSync(join("src/defs/nodes", f), "utf8"))) GEN++;
console.log("counts from disk: total " + TOTAL + " (files " + nodeFiles.length + " + 2 inline), generators " + GEN);

const once = (s, re, what) => {
  const m = s.match(new RegExp(re.source, re.flags.replace("g", "") + "g"));
  if (!m || m.length !== 1) die(what + " anchor found " + (m ? m.length : 0) + " times");
};

/* ---- edit 1: App.jsx version bump ---- */
once(app, /APP_VERSION = "[\d.]+"/, "App.jsx APP_VERSION");
app = app.replace(/APP_VERSION = "[\d.]+"/, 'APP_VERSION = "' + NEWV + '"');
writeFileSync(APP, app);

/* ---- edits 2-4: NODES.md header version, total, generator count ---- */
once(nodesMd, /# MUUSIA v[\d.]+ \u2014 Node Reference/, "NODES.md title");
nodesMd = nodesMd.replace(/# MUUSIA v[\d.]+ \u2014 Node Reference/, "# MUUSIA v" + NEWV + " \u2014 Node Reference");
once(nodesMd, /All \d+ built-in nodes\./, "NODES.md total count");
nodesMd = nodesMd.replace(/All \d+ built-in nodes\./, "All " + TOTAL + " built-in nodes.");
once(nodesMd, /## Generators \(\d+\)/, "NODES.md Generators heading");
nodesMd = nodesMd.replace(/## Generators \(\d+\)/, "## Generators (" + GEN + ")");

/* ---- edit 5: NODES.md paragraph, inserted before Import SVG (NEW + anchor) ---- */
const NODE_PARA = `**G-code In** \u2014 imports G-code back onto the canvas \u2014 the return leg of the
Muusia \u2192 Latu \u2192 Muusia roundtrip, and a general importer for foreign plotter
G-code. With everything on Auto, Muusia's own output returns 1:1: the header
comment gives canvas/origin/Y-flip for an exact inverse transform, CHANGE PEN
comments map to pen layers, closed paths are reconstructed, drawing order is
preserved and Brush Z immersion returns to the points' third component (*Brush
Z: Keep/Ignore*). *Pen detect*: Auto reads SET_SERVO angles or standalone bed-Z
moves in context (contact after a travel, lift after drawing \u2014 z-hop travels
stay lifted); *G0 travel / G1 draw* and *Z threshold* cover foreign files.
*Layers*: Auto (pen comments), Split at pauses, or Single pen. *Coordinates*:
Auto (header), As written, or Flip Y (content-box mirror for Y-up foreign
files). *Placement*: True scale with Offset X/Y nudges, or Fit to margin.
Understands G90/G91, G20/G21 and G2/G3 arcs (IJ and R forms, tessellated at
~0.5 mm); dips, maintenance blocks, Latu's INK_DOSE/AIR_PULSE/E words and other
macros pass through as non-motion. Simplify drops points closer than the given
pitch. Deterministic \u2014 no seed.

`;
const IMP_ANCHOR = "**Import SVG** \u2014 load an SVG file's paths onto the canvas";
if (nodesMd.split(IMP_ANCHOR).length !== 2) die("NODES.md Import SVG anchor");
nodesMd = nodesMd.replace(IMP_ANCHOR, NODE_PARA + IMP_ANCHOR);
writeFileSync(NODES_MD, nodesMd);

/* ---- edit 6: TAGS.json entry, keys kept sorted, vocab must not grow ---- */
const tags = JSON.parse(readFileSync(TAGS, "utf8"));
if (tags.gcode_in) die("TAGS.json already has gcode_in (but NODES.md did not?)");
const vocabBefore = new Set();
for (const v of Object.values(tags)) for (const t of v) vocabBefore.add(t);
tags.gcode_in = ["machine", "penout", "pens"];
const vocabAfter = new Set();
for (const v of Object.values(tags)) for (const t of v) vocabAfter.add(t);
if (vocabAfter.size !== vocabBefore.size) die("TAGS vocabulary grew (" + vocabBefore.size + " -> " + vocabAfter.size + ") - never invent tags");
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
writeFileSync(TAGS, JSON.stringify(sorted, null, 1).replace(/\n {1}/g, "\n ") + "\n");
console.log("TAGS.json: gcode_in tagged, entries " + Object.keys(sorted).length + ", vocab " + vocabAfter.size);

/* ---- edit 7: HANDOFF history entry, appended at section end (NEW + anchor) ---- */
let handoff = readFileSync(HANDOFF, "utf8");
const HIST_ENTRY = `- **${NEWV}** **G-code In** (gen/textimg) baked: imports G-code back as paths \u2014
  the Muusia\u2192Latu\u2192Muusia return leg. Auto inverts the Muusia header transform
  (canvas/origin/flipY) for a 1:1 roundtrip, maps CHANGE PEN comments to pen
  layers, reconstructs closed paths and Brush Z immersion, and classifies
  standalone bed-Z moves contextually (contact after travel, lift after draw,
  value fallback for foreign G1 travels) so z-hop and brush-pressure Z coexist;
  servo mode via SET_SERVO angles. Dip/maintenance blocks skipped via their
  comment markers (maintenance M0 is NOT a split point); Latu additions
  (INK_DOSE/AIR_PULSE/M83 E words) transparent. Foreign dialects: G0/G1 and
  Z-threshold pen detect, G90/G91, G20/G21, G2/G3 arcs (IJ+R, ~0.5 mm
  tessellation), Flip Y over content bbox, Fit to margin. Validator: 73 checks
  incl. a mutation-tested roundtrip oracle at 0.006 mm against a toGcode
  mini-port (bed-Z + z-hop + brush Z, servo, maintenance, dip, Latu fixtures).

`;
const PIT_ANCHOR = "## Hard-won pitfalls (keep)";
if (handoff.split(PIT_ANCHOR).length !== 2) die("HANDOFF pitfalls anchor");
handoff = handoff.replace(PIT_ANCHOR, HIST_ENTRY + PIT_ANCHOR);
writeFileSync(HANDOFF, handoff);

/* ---- verification ---- */
console.log("VERIFY App.jsx: " + readFileSync(APP, "utf8").match(/APP_VERSION = "[\d.]+"/)[0]);
console.log("VERIFY NODES.md: " + readFileSync(NODES_MD, "utf8").match(/# MUUSIA v[\d.]+ .*/)[0]);
console.log("VERIFY NODES.md: G-code In paragraphs = " + (readFileSync(NODES_MD, "utf8").split("**G-code In**").length - 1));
console.log("VERIFY HANDOFF: " + NEWV + " entries = " + (readFileSync(HANDOFF, "utf8").split("- **" + NEWV + "**").length - 1));
console.log("DONE " + CUR + " -> " + NEWV);
