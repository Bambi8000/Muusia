/* Era patch: BG Fill release docs + version bump. Run ONCE from the repo root,
   AFTER `node tools/bake.mjs bg_fill`.
   - bumps APP_VERSION in src/App.jsx (read from disk, minor +1)
   - docs/MUUSIA-NODES.md: header version, total + Generators counts, BG Fill paragraph
   - docs/MUUSIA-TAGS.json: bg_fill entry (alphabetical slot, existing vocabulary only)
   - docs/MUUSIA-HANDOFF.md: repo-layout counts + version history entry
   Every anchor is verified to match exactly once; any MISS aborts before writing.
   Idempotent: prints SKIP and exits 0 when already applied. */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const F = {
  app: "src/App.jsx",
  nodes: "docs/MUUSIA-NODES.md",
  tags: "docs/MUUSIA-TAGS.json",
  hand: "docs/MUUSIA-HANDOFF.md",
};
const S = {};
for (const k of Object.keys(F)) S[k] = readFileSync(F[k], "utf8");

if (S.nodes.includes("**BG Fill**")) { console.log("SKIP already applied"); process.exit(0); }

let miss = 0;
const missIf = (cond, what) => { if (cond) { console.log("MISS " + what); miss++; } };
const ok = (what) => console.log("OK   " + what);

/* ---- facts from disk ---- */
const nodeFiles = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
missIf(!nodeFiles.includes("bg_fill.js"), "src/defs/nodes/bg_fill.js missing - bake first");
let gens = 0;
for (const f of nodeFiles) {
  if (/cat:\s*"gen"/.test(readFileSync("src/defs/nodes/" + f, "utf8"))) gens++;
}
const total = nodeFiles.length + 2; /* + inline group & reititys in App.jsx */
const vm = S.app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
missIf(!vm, 'APP_VERSION = "X.Y" in src/App.jsx');
const oldV = vm ? vm[1] + "." + vm[2] : "?";
const newV = vm ? vm[1] + "." + (parseInt(vm[2], 10) + 1) : "?";

/* ---- single-match regex verification ---- */
const uniq = (src, re, what) => {
  const m = src.match(new RegExp(re, "g"));
  missIf(!m || m.length !== 1, what + " (matches: " + (m ? m.length : 0) + ")");
};
uniq(S.app, 'APP_VERSION = "' + oldV.replace(".", "\\.") + '"', "App.jsx APP_VERSION anchor");
uniq(S.nodes, "# MUUSIA v[\\d.]+ \u2014 Node Reference", "NODES.md header");
uniq(S.nodes, "All \\d+ built-in nodes", "NODES.md total count");
uniq(S.nodes, "## Generators \\(\\d+\\)", "NODES.md Generators count");
uniq(S.nodes, "\\n## Modifiers \\(\\d+\\)", "NODES.md Modifiers heading (insertion anchor)");
uniq(S.tags, '\\n "bitcrush": \\[', "TAGS.json bitcrush anchor");
missIf(S.tags.includes('"bg_fill"'), "TAGS.json already has bg_fill but NODES.md does not - inconsistent state");
uniq(S.hand, "\\*\\*\\d+ files\\*\\* \\(\\d+ nodes total with", "HANDOFF file/node counts");
uniq(S.hand, "Generators \\d+, Modifiers \\d+\\)", "HANDOFF category counts");
uniq(S.hand, "\\n## Hard-won pitfalls \\(keep\\)", "HANDOFF version-history end anchor");

const vocabBefore = new Set(Object.values(JSON.parse(S.tags)).flat());

if (miss) { console.log(miss + " MISS - nothing written"); process.exit(1); }

/* ---- edits ---- */
S.app = S.app.replace('APP_VERSION = "' + oldV + '"', 'APP_VERSION = "' + newV + '"');
ok("App.jsx APP_VERSION " + oldV + " -> " + newV);

S.nodes = S.nodes.replace(/# MUUSIA v[\d.]+ \u2014 Node Reference/, "# MUUSIA v" + newV + " \u2014 Node Reference");
S.nodes = S.nodes.replace(/All \d+ built-in nodes/, "All " + total + " built-in nodes");
S.nodes = S.nodes.replace(/## Generators \(\d+\)/, "## Generators (" + gens + ")");
ok("NODES.md header v" + newV + ", total " + total + ", Generators " + gens);

const PARA = `**BG Fill** \u2014 seven full-sheet background fills in one node, picked with *Mode*.
*Drape*: concentric fur-stroke arc bands folded by sharp creases like hanging
fabric. *Magnet*: iron-filing dashes tracing a two-pole field, *Attract* or
*Repel*. *Grain*: dense woodgrain lines that part around voids \u2014 seeded blobs,
an optional *Crack*, or whatever is wired. *Scales*: staggered fish-scale rows
as a rain of vertical dashes (lovely with a light pen on dark paper). *Torn*:
fine strokes fanning off a diagonal spine into a wobbly rip lens \u2014 wire a path
into Void and IT becomes the rip, rays leaving it *From center* or
*Perpendicular* (open lines ray both sides). *Pleat*: vertical lines pinched
into a diamond pleat grid like folded wallpaper. *Circles*: greedy largest-first
circle packing, tangent at *Gap* 0 for the Apollonian look; *Rings* fills every
circle with concentric rings at *Line pitch*. The Void input works in every mode
with Negative Space semantics: closed interiors cut out, and every wired line \u2014
open or closed \u2014 carves a *Void clearance* band, so a Ribbon clears its own
channel; in Grain the flow also bends around wired shapes like riverbanks.
*Line pitch* is the master density. Tip: two BG Fills on different pens with
different modes make an instant layered backdrop.

`;
S.nodes = S.nodes.replace(/\n## Modifiers \(/, "\n" + PARA + "## Modifiers (");
ok("NODES.md BG Fill paragraph inserted before Modifiers");

const TAG_ENTRY = ` "bg_fill": [
  "fill",
  "flow",
  "geometric",
  "hatch",
  "region",
  "texture"
 ],
`;
S.tags = S.tags.replace('\n "bitcrush": [', "\n" + TAG_ENTRY + ' "bitcrush": [');
const parsed = JSON.parse(S.tags);
const keys = Object.keys(parsed);
const sortedOk = keys.every((k, i) => i === 0 || keys[i - 1] < k);
const vocabAfter = new Set(Object.values(parsed).flat());
const newTags = [...vocabAfter].filter((t) => !vocabBefore.has(t));
if (!sortedOk || newTags.length) {
  console.log("MISS TAGS.json post-check failed (sorted=" + sortedOk + ", new tags: " + newTags.join(",") + ") - nothing written");
  process.exit(1);
}
ok("TAGS.json bg_fill entry (6 tags, vocabulary unchanged at " + vocabAfter.size + ", keys sorted)");

S.hand = S.hand.replace(/\*\*\d+ files\*\* \(\d+ nodes total with/, "**" + nodeFiles.length + " files** (" + total + " nodes total with");
S.hand = S.hand.replace(/Generators \d+, Modifiers \d+\)/, "Generators " + gens + ", Modifiers " + (total - gens - countOther()) + ")");
function countOther() {
  /* everything that is neither gen nor mod: dec/duo/math files + the 2 inline entries */
  let other = 2;
  for (const f of nodeFiles) {
    const t = readFileSync("src/defs/nodes/" + f, "utf8");
    if (!/cat:\s*"gen"/.test(t) && !/cat:\s*"mod"/.test(t)) other++;
  }
  return other;
}
ok("HANDOFF counts: " + nodeFiles.length + " files, " + total + " nodes, Generators " + gens);

const ENTRY = `- **${newV}** **BG Fill** (gen/geometric) baked: seven background fills under
  one Mode select \u2014 Drape (fur-stroke arc bands folded by sharp creases),
  Magnet (iron-filing dipole dashes, Attract/Repel), Grain (woodgrain flow
  parting around voids, optional Crack), Scales (fish-scale dash rain), Torn
  (strokes fanning off a spine into a wobbly rip lens), Pleat (triangle-wave
  diamond pleats, amplitude clamped below the line-crossing bound k < cw/4)
  and Circles (greedy largest-first packing with occupancy-grid dart pruning;
  Rings fills each circle at Line pitch, big-first emission so a budget cut
  eats small circles). Void input = Negative Space semantics: closed
  interiors cut AND every wired line (open or closed) carves a Void clearance
  band via bucketed segment distance; the band uses RAW input points when
  affordable \u2014 resampling shaved sharp star corners ~1 mm, caught by the
  validator's exact-edge test. Grain deflects around open lines with a
  VECTOR-SUM push over nearby segments so a ribbon's opposite banks cancel
  inside the corridor \u2014 nearest-seg push shoved lines across into the far
  bank's cut zone. Torn with a wired path makes IT the rip: rays From center
  or Perpendicular (\u00b13-sample smoothed tangents), open polylines ray both
  sides, box entry/exit binary-refined; unwired keeps the lens fallback.
  tools/validate-bg_fill.mjs: 207 checks \u2014 per-mode invariants, clearance
  violations by segment distance, mutation smoke on the void oracle,
  Rings + min-pitch budget.

`;
S.hand = S.hand.replace("\n## Hard-won pitfalls (keep)", "\n" + ENTRY + "## Hard-won pitfalls (keep)");
ok("HANDOFF version history entry " + newV);

for (const k of Object.keys(F)) writeFileSync(F[k], S[k]);
console.log("DONE " + oldV + " -> " + newV + " (verify: grep -o 'APP_VERSION = \"[^\"]*\"' src/App.jsx)");
