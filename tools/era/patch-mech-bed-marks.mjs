#!/usr/bin/env node
/*
 * patch-mech-bed-marks.mjs — documents the permanent bed alignment marks
 * (tools/bed-marks.mjs, drawn 2026-09-22): MECH-HANDOFF §5.3 + HANDOFF tools
 * line. Anchored, MISS aborts before writing, SKIP if applied. One-shot.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const MECH = "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md";
const HAND = "docs/MUUSIA-HANDOFF.md";
const SENTINEL = "### 5.3 Bed alignment marks";
for (const f of [MECH, HAND, "tools/bed-marks.mjs"]) {
  if (!existsSync(f)) { console.log(`MISS  ${f} not found — run from the repo root`); process.exit(1); }
}
let mech = readFileSync(MECH, "utf8");
let hand = readFileSync(HAND, "utf8");
const edits = [];
if (!mech.includes(SENTINEL)) edits.push({ file: MECH, name: "insert §5.3", from: "## 6. What to design next", to:
`${SENTINEL} (drawn 2026-09-22)

The steel bed carries permanent paper-alignment marks, drawn by the machine
itself with a Texmark 500 marker from \`tools/bed-marks.mjs\` (living tool,
deterministic; regenerate with \`node tools/bed-marks.mjs --out
~/Desktop/bed-marks.gcode\` and run it after PLOT_START with no paper on the
bed — work Z0 is the steel because the fixed block stands on it). All
coordinates are in the paper frame PLOT_START sets up (machine 42,20), so the
marks and every Muusia export share one origin corner.

What is on the bed:

- Baselines x=0 and y=0 over the reachable area, 10 mm outward ticks every
  50 mm, 12 mm numbers every 100 mm just inside the lines. Numbers that would
  touch a format edge are deliberately absent (300 and 600 on X, 600 on Y).
- A4, A3, A2 in portrait (P) and landscape (L): the two far edges as 15/15 mm
  dashed lines (overlapping spans inked once), L-brackets at the three
  non-origin corners with legs continuing the edges 15 mm outside the sheet
  so the corners stay visible under paper, 18 mm label at the far corner.
- A1 partial: A1 P (594×841) right-edge guide + \`TOP +48\`; A1 L (841×594)
  top-edge guide + \`RIGHT +90\`. A1 lies on the bed but overhangs the
  reachable area by that much in either orientation.
- \`MAX 751X793\` at the reachable-area corner.

Reachable area from the paper origin is **751 × 793 mm** (position_max
793 × 813 minus the 42/20 origin). A4–A2 fit in both orientations; A1 never
fits fully (841 > 813 in any orientation); A0 is out. Largest full-reach
sheet: a cut 751 × 793 or a 610 mm roll × 793.

Tool options worth knowing: \`--passes 2\` (double-ink for a weak marker),
\`--text\` (label height, numbers 2/3 of it), \`--a1 0\`, \`--origin\`/\`--travel\`
if PLOT_START or position_max change, \`--clear N\` re-enables an exclusion of
outward marks near the origin corner (default off — the Z block does not reach
them).

## 6. What to design next` });
else console.log(`SKIP  ${MECH} already has ${SENTINEL}`);
if (!hand.includes("bed-marks.mjs")) edits.push({ file: HAND, name: "living tools: bed-marks.mjs",
  from: "`speed-ladder.mjs` (Viivain motion-limit test G-code, MECH-HANDOFF §9.1).",
  to: "`speed-ladder.mjs` (Viivain motion-limit test G-code, MECH-HANDOFF §9.1), `bed-marks.mjs` (permanent bed alignment marks, MECH-HANDOFF §5.3)." });
else console.log(`SKIP  ${HAND} already lists bed-marks.mjs`);
const text = { [MECH]: mech, [HAND]: hand };
let miss = 0;
for (const e of edits) { const n = text[e.file].split(e.from).length - 1; if (n !== 1) { console.log(`MISS  ${e.name} (${n} hits)`); miss++; } }
if (miss) { console.log(`ABORT ${miss} anchor(s) missed — nothing written`); process.exit(1); }
for (const e of edits) { text[e.file] = text[e.file].replace(e.from, e.to); console.log(`OK    ${e.name}`); }
if (text[MECH] !== mech) writeFileSync(MECH, text[MECH]);
if (text[HAND] !== hand) writeFileSync(HAND, text[HAND]);
console.log(`DONE  ${edits.length ? edits.map((e) => e.file).join(" + ") : "(nothing to do)"}`);
