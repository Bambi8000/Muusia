/* patch-docs-v248.mjs — ONE-SHOT era script, DO NOT RE-RUN.
   v2.48 docs batch: HANDOFF version-history entry + stale-count fix + two new
   working-convention bullets; NODES.md counts from the repo (215 files, gen
   121, mod 67, 217 total); NODE-API z-writer list += Needle Punch.
   Run once from the repo root: node tools/era/patch-docs-v248.mjs
   Anchored replacements with OK/MISS/SKIP; MISS applies nothing for that
   edit and sets a non-zero exit code. */

import fs from "node:fs";

/* re-run guard: insertions are NOT idempotent — refuse if already applied */
if (fs.readFileSync("docs/MUUSIA-HANDOFF.md", "utf8").includes("- **2.48** two nodes")) {
  console.log("ALREADY APPLIED — this is a one-shot era script, refusing to re-run.");
  process.exit(0);
}

let missed = 0;
const edit = (file, label, find, replace, { regex = false } = {}) => {
  let s = fs.readFileSync(file, "utf8");
  const already = typeof replace === "string" && replace.length < 400 && s.includes(replace);
  const hit = regex ? find.test(s) : s.includes(find);
  if (!hit) {
    if (already) { console.log(`SKIP ${label} (already applied)`); return; }
    console.log(`MISS ${label}`);
    missed++;
    return;
  }
  s = regex ? s.replace(find, replace) : s.replace(find, replace);
  fs.writeFileSync(file, s);
  console.log(`OK   ${label}`);
};

const NODES = "docs/MUUSIA-NODES.md";
const HAND = "docs/MUUSIA-HANDOFF.md";
const API = "docs/MUUSIA-NODE-API.md";

/* ---------- MUUSIA-NODES.md: counts from the repo ---------- */
edit(NODES, "NODES header v2.48", /^# MUUSIA v2\.\d+ — Node Reference/m, "# MUUSIA v2.48 — Node Reference", { regex: true });
edit(NODES, "NODES total 217", /^All \d+ built-in nodes/m, "All 217 built-in nodes", { regex: true });
edit(NODES, "NODES Generators (121)", /^## Generators \(\d+\)/m, "## Generators (121)", { regex: true });
edit(NODES, "NODES Modifiers (67)", /^## Modifiers \(\d+\)/m, "## Modifiers (67)", { regex: true });

/* ---------- MUUSIA-HANDOFF.md: stale repo-layout counts ---------- */
edit(HAND, "HANDOFF files 215", "**208 files** (210 nodes total with", "**215 files** (217 nodes total with");
edit(HAND, "HANDOFF gen/mod 121/67", "group + reititys; Generators 116, Modifiers 65)", "group + reititys; Generators 121, Modifiers 67)");
edit(HAND, "HANDOFF wc-l check 215", "`ls src/defs/nodes | wc -l` (208)", "`ls src/defs/nodes | wc -l` (215)");

/* ---------- MUUSIA-HANDOFF.md: v2.48 version-history entry ---------- */
const ENTRY = `- **2.48** two nodes, the needle-toolhead workflow. **Needle Punch**
  (mod/penout: lines \u2192 piercings as degenerate 2-pt paths carrying z = plunge
  below pen-down \u2014 ZERO engine changes: the Brush Z / Fade Out z architecture
  plus the existing penDown/penUp/zHop profile fields already produce the stab
  cycle, proven by running punches through toGcode; Interval/Intersections/
  Both/Centers modes, arc-length spacing modulation Wave/Noise/Ramp/Jitter with
  a 0.1 mm progress floor, Min gap dedupe so the needle never re-stabs a hole;
  punches render as dots via the preview's round linecap). **Braille**
  (gen/textimg: Grade 1 dot circles on the 2.5 mm grid, Nordic \u00e5/\u00e4/\u00f6,
  punctuation verified against the Finnish table on fi.wikipedia \u2014 piste 3 and
  huutomerkki 256 differ from UEB; number/capital signs, cell-level stamp
  Mirror, SFONT letter overlay with Show letters toggle; one _layout method
  shared by compute and overlay so guides cannot drift \u2014 called via this,
  which works because the engine invokes compute/overlay as methods on the
  def). Lessons: bake.mjs rejects IIFE-wrapped lab files ("Unexpected token
  ')'") \u2014 lab nodes must be plain ({...}) literals, share logic via a
  this._helper instead; mirror must reflect around the CELL GRID, not the
  occupied-ink bbox; intersection punches need the adjacency skip incl. closed
  wraparound or path joints punch falsely; a stale Downloads copy ("name
  (1).ext", the known browser no-overwrite pitfall) shipped an old node once
  \u2014 grep a sentinel string after moving files; and HANDOFF's own repo-layout
  counts were stale (213 files pre-bake, not 208) \u2014 doc counts come from
  \`ls src/defs/nodes | wc -l\` + per-cat greps, never from HANDOFF.

## Hard-won pitfalls (keep)`;
edit(HAND, "HANDOFF v2.48 entry", "## Hard-won pitfalls (keep)", ENTRY);

/* ---------- MUUSIA-HANDOFF.md: two new working conventions ---------- */
const CONV = `- **Doc batches as era scripts:** version-numbered doc updates (NODES.md
  counts/paragraph anchors, HANDOFF history, NODE-API) ship as a one-shot
  script in tools/era/ (patch-docs-vXXX.mjs) with OK/MISS/SKIP reporting \u2014
  no manual file surgery. Run once from the repo root, commit the script
  with the docs.
- **File delivery:** Daniel moves downloaded lab nodes to nodes-lab/ and
  validators to tools/ himself; sessions deliver files + commands only, no
  cp-from-Downloads sequences. Lab nodes must be plain ({...}) object
  literals \u2014 bake.mjs rejects IIFEs; share compute/overlay logic via a
  this._helper method (the engine calls both as methods on the def).

## Architecture — do not break these`;
edit(HAND, "HANDOFF conventions (era scripts + file delivery)", "## Architecture — do not break these", CONV);

/* ---------- MUUSIA-NODE-API.md: z writers ---------- */
edit(API, "NODE-API z writers += Needle Punch", "(written by Brush Z;", "(written by Brush Z and Needle Punch;");

console.log(missed ? `\n${missed} MISS — inspect anchors before committing` : "\nALL APPLIED");
process.exitCode = missed ? 1 : 0;
