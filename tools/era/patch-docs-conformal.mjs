/* Doc batch for the Conformal Grid node (key conformal).
   Run once from the repo root AFTER the version bump: node tools/era/patch-docs-conformal.mjs
   Anchored replacements; MISS aborts before anything is written; SKIP if already applied.
   Version and counts are read from disk, never hardcoded. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const KEY = "conformal", NAME = "Conformal Grid";
let miss = 0;
const OK = (m) => console.log("OK    " + m);
const MISS = (m) => { console.log("MISS  " + m); miss++; };

/* ---- locate files ---- */
const find = (name) => { for (const d of ["docs", "."]) { const f = resolve(d, name); if (existsSync(f)) return f; } return null; };
const F_NODES = find("MUUSIA-NODES.md"), F_TAGS = find("MUUSIA-TAGS.json"), F_HAND = find("MUUSIA-HANDOFF.md"), F_APP = resolve("src/App.jsx");
for (const [n, f] of [["MUUSIA-NODES.md", F_NODES], ["MUUSIA-TAGS.json", F_TAGS], ["MUUSIA-HANDOFF.md", F_HAND], ["src/App.jsx", existsSync(F_APP) ? F_APP : null]]) if (!f) MISS(n + " not found");
if (miss) { console.log("ABORT nothing written"); process.exit(1); }

/* ---- facts from disk ---- */
const app = readFileSync(F_APP, "utf8");
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
const nodeDir = resolve("src/defs/nodes");
const files = readdirSync(nodeDir).filter((f) => f.endsWith(".js"));
if (!files.includes(KEY + ".js")) { console.log("MISS  src/defs/nodes/" + KEY + ".js not baked yet - ABORT"); process.exit(1); }
const catCount = (cat) => files.filter((f) => readFileSync(resolve(nodeDir, f), "utf8").includes('cat: "' + cat + '"')).length;
const nFiles = files.length, nTotal = nFiles + 2;           /* + group + reititys inline in App.jsx */
const nGen = catCount("gen"), nMod = catCount("mod");
console.log("INFO  version " + V + " · " + nFiles + " files · " + nTotal + " nodes · gen " + nGen + " · mod " + nMod);

let nodes = readFileSync(F_NODES, "utf8"), hand = readFileSync(F_HAND, "utf8");
const tags = JSON.parse(readFileSync(F_TAGS, "utf8"));

if (nodes.includes("**" + NAME + "**") && tags[KEY] && hand.includes("**" + NAME + "**")) { console.log("SKIP  already applied"); process.exit(0); }

/* one-hit regex replace */
const rep1 = (src, re, neu, label) => {
  const hits = (src.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
  if (hits !== 1) { MISS(label + " (" + hits + " hits)"); return src; }
  OK(label); return src.replace(re, neu);
};

/* ---------------------------------------------------------- NODES.md */
const PARA = `**${NAME}** — the Smith chart and its relatives: a rectangular R × X grid
pushed through a conformal map, so the grid lines curve into circle and arc
families that stay orthogonal at every crossing. *Map* Smith is the impedance
chart ((w−1)/(w+1), right half-plane onto the unit disc — constant-R circles
tangent at the right rim, constant-X arcs through the same point), Admittance
its mirror image through the centre, Immittance both together with the
admittance grid on *Admittance pen*; Inversion 1/z, Joukowski (w+1/w)/2,
Log-polar exp(w) and Power w^n (*Exponent*) map a symmetric source grid of
*Range* with *Major lines per range*. Subdivision follows the printed chart:
each major interval is split into *Minor per major*, each minor is halved
*Fine depth* times, and a sub-level line is drawn only along the stretch
where the gap to its same-level neighbour is at least *Cell mm* — fine
hatching appears where cells are large and fades where they crowd; majors
are always drawn whole. Every line is a polyline sampled by rendered length
(*Line step mm*), so one code path serves every map. *Clip* Disc keeps the
unit disc (*Radius mm*, shrink-only fit that includes the scale rings), Sheet
lets the map run to the margin box, Wired shape clips to a wired closed path
(Region pin). Smith dressing, all optional: *Axis* (horizontal axis and centre
mark), *Scales* Angle (reflection-coefficient ring, ticks every 2°, numbers
every 10°) and Wavelength (0–0.5 clockwise from the left, ticks every 0.002,
numbers every 0.01), *Labels* (SFONT values on the majors: R vertical along
the axis, X at the rim rotated radially; *Label size*, capped for small
charts). Output is assembled coarse-first under the point budget, so a heavy
chart loses its finest hatching before its skeleton. Pens: Major, Minor,
Fine, Admittance, Scales, Labels. No randomness.

`;
nodes = rep1(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + V + " — Node Reference", "NODES header version");
nodes = rep1(nodes, /^All \d+ built-in nodes\./m, "All " + nTotal + " built-in nodes.", "NODES total count");
nodes = rep1(nodes, /^## Generators \(\d+\)\n\n/m, "## Generators (" + nGen + ")\n\n" + PARA, "NODES Generators count + paragraph");
nodes = rep1(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + nMod + ")", "NODES Modifiers count");

/* ---------------------------------------------------------- TAGS.json */
const VOCAB_BEFORE = new Set(Object.values(tags).flat()).size;
tags[KEY] = ["geometric", "grid", "math", "round", "symmetry"];
const VOCAB_AFTER = new Set(Object.values(tags).flat()).size;
if (VOCAB_AFTER !== VOCAB_BEFORE) MISS("TAGS vocabulary changed " + VOCAB_BEFORE + " -> " + VOCAB_AFTER + " (invented tag)"); else OK("TAGS entry (vocabulary unchanged at " + VOCAB_AFTER + ")");
const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];

/* ---------------------------------------------------------- HANDOFF.md */
const HIST = `- **${V}** new **${NAME}** generator (gen/geometric, \`${KEY}\`): Smith chart
  family as conformal maps of an R × X grid (Smith / Admittance / Immittance,
  Inversion, Joukowski, Log-polar, Power). Lines are polylines sampled by
  clipped rendered length (coarse 64-sample estimate → N = length / step);
  Smith parametrises R and X through tan so the infinite lines are uniform on
  their image circles. Chart-style adaptive subdivision: majors (Smith value
  list 0…50) whole, minors (÷ Minor per major) and fine levels (halvings ×
  Fine depth) gap-pruned per sample against the nearest same-or-coarser-level
  neighbour (gap ≥ Cell mm), giving the fade-out hatching of the printed
  chart. Generic clip (Disc / Sheet / Wired shape) by predicate + bisection.
  Dressing: axis, angle and wavelength rings with ticks and radially rotated
  SFONT numbers, R labels vertical on the axis, X labels at the rim; text
  size capped at 4 % of the radius. Output bucketed by level and assembled
  coarse-first under the budget (skeleton truncated if it alone exceeds the
  budget, finer levels all-or-nothing). 97-check validator: conformality from
  the OUTPUT on all five map kinds (majors cross at 90° ± 2.5° at analytic
  crossing points), rim = full unit circle, R = 1 through the centre,
  Admittance = byte-level mirror, Immittance = Smith + mirror, Cell-mm
  pruning monotonic and parallel-neighbour distance ≥ 0.9 Cell, tick counts
  (144 + 36 / 200 + 50, ticks identified as radial 2-point segments), label
  stroke counts, clip containment, shrink-only fit incl. rings; 9 mutations
  each trip their own checks (stretched map, wrong Joukowski sign, prune
  threshold, no pruning, loose clip, tick spacing, one-axis mirror, no fit,
  unprotected skeleton).

`;
hand = rep1(hand, /\n## Hard-won pitfalls \(keep\)\n/, "\n" + HIST + "## Hard-won pitfalls (keep)\n", "HANDOFF version history entry");
hand = rep1(hand, /\*\*\d+ files\*\* \(\d+ nodes total/, "**" + nFiles + " files** (" + nTotal + " nodes total", "HANDOFF file/node counts");
hand = rep1(hand, /Generators \d+, Modifiers \d+\)\. ESM format:/, "Generators " + nGen + ", Modifiers " + nMod + "). ESM format:", "HANDOFF gen/mod counts");
hand = rep1(hand, /`ls src\/defs\/nodes \| wc -l` \(\d+\)/, "`ls src/defs/nodes | wc -l` (" + nFiles + ")", "HANDOFF ls count");

if (miss) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_NODES, nodes);
writeFileSync(F_TAGS, JSON.stringify(sorted, null, 1) + "\n");
writeFileSync(F_HAND, hand);
console.log("DONE  docs written: MUUSIA-NODES.md, MUUSIA-TAGS.json, MUUSIA-HANDOFF.md (v" + V + ", " + nTotal + " nodes)");
