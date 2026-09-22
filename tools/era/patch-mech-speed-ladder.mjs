#!/usr/bin/env node
/*
 * patch-mech-speed-ladder.mjs — documentation batch for the 2026-09-22
 * speed-ladder session (tools/speed-ladder.mjs, printer.cfg 60/500 -> 150/500,
 * X/Y/Y1 stealthChop -> spreadCycle).
 *
 * Edits (anchored exact-string replacement, MISS aborts before any write,
 * SKIP if already applied):
 *   docs/MUUSIA-PLOTTER-MECH-HANDOFF.md
 *     - §9 table: max_velocity, max_accel, Draw F, Travel F, stealthChop row
 *     - §9 "Room to move" paragraph -> pointer to §9.1
 *     - new §9.1 "Speed ladder 2026-09-22" before §10
 *   docs/MUUSIA-HANDOFF.md
 *     - living tools line: add speed-ladder.mjs
 *
 * One-shot. Lives in tools/era/ once applied; do not re-run.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MECH = "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md";
const HAND = "docs/MUUSIA-HANDOFF.md";
const SENTINEL = "### 9.1 Speed ladder 2026-09-22";

for (const f of [MECH, HAND, "klipper/printer.cfg", "tools/speed-ladder.mjs"]) {
  if (!existsSync(f)) { console.log(`MISS  ${f} not found — run from the repo root`); process.exit(1); }
}

/* facts from the repo, not from the conversation */
const cfg = readFileSync("klipper/printer.cfg", "utf8");
const cfgVel = (cfg.match(/^max_velocity:\s*(\d+)/m) || [])[1];
const cfgAcc = (cfg.match(/^max_accel:\s*(\d+)/m) || [])[1];
if (cfgVel !== "150" || cfgAcc !== "500") {
  console.log(`MISS  klipper/printer.cfg reads max_velocity ${cfgVel} / max_accel ${cfgAcc}; expected 150 / 500 — apply the cfg change first`);
  process.exit(1);
}

let mech = readFileSync(MECH, "utf8");
let hand = readFileSync(HAND, "utf8");

if (mech.includes(SENTINEL)) {
  console.log(`SKIP  ${MECH} already has ${SENTINEL}`);
  if (hand.includes("speed-ladder.mjs")) { console.log(`SKIP  ${HAND} already lists speed-ladder.mjs`); console.log("DONE  (nothing to do)"); process.exit(0); }
}

const edits = [];
const edit = (file, name, from, to) => edits.push({ file, name, from, to });

/* ---- §9 table rows ---- */
edit(MECH, "table: heading date",
  "**Motion settings that produce clean plots** (2026-09-04):",
  "**Motion settings that produce clean plots** (2026-09-04; motion limits raised 2026-09-22, see §9.1):");
edit(MECH, "table: stealthchop row",
  "| `stealthchop_threshold` X/Y/Y1 | **0** (spreadCycle) | printer.cfg — stealthChop dropped steps on short fast pen-lift moves |",
  "| `stealthchop_threshold` X/Y/Y1 | **0** (spreadCycle) | printer.cfg — stealthChop dropped steps on short fast pen-lift moves. NOTE: this row was recorded on 2026-09-04 but the live cfg still read 999999 until 2026-09-22 (§9.1) — verify with grep, not with this table |");
edit(MECH, "table: max_accel",
  "| `max_accel` | 500 | printer.cfg `[printer]` |",
  "| `max_accel` | **500** | printer.cfg `[printer]` — speed ladder 2026-09-22: 800 faint ringing, 1200 visible ringing, 1800+ lost steps |");
edit(MECH, "table: max_velocity",
  "| `max_velocity` | 60 | printer.cfg `[printer]` |",
  "| `max_velocity` | **150** | printer.cfg `[printer]` — speed ladder 2026-09-22: clean to 150 mm/s at 500 mm/s², three sheets |");
edit(MECH, "table: Draw F",
  "| Draw F | 1800 | Muusia profile |",
  "| Draw F | 3600 | Muusia profile (60 mm/s; text and lines were clean at 150 mm/s, raise per pen) |");
edit(MECH, "table: Travel F",
  "| Travel F | 3000 | Muusia profile |",
  "| Travel F | 9000 | Muusia profile (150 mm/s) |");

/* ---- Room to move paragraph ---- */
edit(MECH, "room-to-move paragraph",
`Room to move: current has thermal headroom to ~2.2 A if a heavier tool needs
it, and \`max_velocity\`/\`max_accel\` can be raised stepwise now that the torque
floor is fixed — raise one at a time and re-run a long-travel job, because
short test moves will not reproduce the failure.
`,
`Room to move: current has thermal headroom to ~2.2 A if a heavier tool needs
it. Velocity and accel were measured on 2026-09-22 (§9.1): velocity is not the
limit up to 150 mm/s, accel is — 500 is the ceiling for a clean line on this
gantry until the ringing is addressed (input shaper or stiffening).
`);

/* ---- new §9.1 before §10 ---- */
edit(MECH, "insert §9.1",
  "## 10. Related project docs (software side — not needed for mechanics)",
`${SENTINEL} — motion limits measured

Belts tightened, calibration sheet clean, so the limits from §9 were raised
with a purpose-built test instead of guessing. \`tools/speed-ladder.mjs\`
(living tool) writes a G-code file in the Viivain dialect that steps
\`SET_VELOCITY_LIMIT\` through a ladder of velocity/accel pairs, one A4 row per
stage, row 0 = current cfg as the control. Nothing touches printer.cfg during
the test; the file restores base limits at the end.

\`\`\`
node tools/speed-ladder.mjs --v 60,80,100,120,150 --a 500 --out ~/Desktop/ladder-v.gcode
node tools/speed-ladder.mjs --v 150 --a 500,800,1200,1800,2500 --out ~/Desktop/ladder-a.gcode
\`\`\`

Header: \`G28 X Y\`, \`CLEAR_PAUSE\`, \`PEN_UP\`, \`PLOT_HEIGHT\` (PLOT_START leaves Z
on the 8 mm block — remove the block first, as for any job), optional \`--z\`
for felt-tip preload. Each row: a \`+\` anchor at base limits → stage limits →
hop comb (6 pen-up hops to far sheet corners/edges, a tick after each; uneven
pitch = lost steps on long travels) → nested squares (corner ringing, closure
gap) → zigzag (reversals) → circle (belt slack) → long shallow diagonal at
speed (wobble, ink) → base limits → \`×\` over the \`+\`. **A clean 8-point star
means the stage lost nothing; the offset of × from + is that stage's error in
mm with its direction.** A + at the sheet origin before stage 0 and a × after
the last stage give the whole-run error.

**Findings (three sheets):**

- **Live cfg had X/Y/Y1 in stealthChop** (\`stealthchop_threshold: 999999\`)
  although the §9 table recorded 0. The first velocity ladder showed it: the
  control row 60/500 lost ~4 mm in Y on its first long hop and every faster
  row was clean — stealthChop's pwm_autoscale tunes during the first moves
  after power-on and can drop steps on the first hard travel. Switched X/Y/Y1
  to spreadCycle (\`stealthchop_threshold: 0\`, Z stays stealth); re-run was
  clean on every row including the control. Lesson: the table is not the
  cfg — grep the live file.
- **Velocity is not the limit.** 60→150 mm/s at 500 mm/s²: every cross a
  clean star, squares/zigzags/text clean, ink kept up at 150 mm/s draw.
  Repeated on a third sheet. \`max_velocity: 150\`.
- **Accel is the limit, and line quality fails before steps do.** At 150 mm/s:
  A500 clean; A800 crosses clean, faint wave in square sides; A1200 visible
  ringing in squares and zigzag, cross a hair off; A1800 and A2500 crosses
  off by mm, the long diagonal wavy along its whole length (the 4.5 mm sprint
  to 150 excites the gantry and it does not damp out). \`max_accel: 500\` —
  800 is usable if time matters, at a small cost in line smoothness.
- **Residual ringing after long X travels.** The tick drawn after the pure-X
  hop is faintly wavy on every row regardless of speed (X-direction,
  ~0.1–0.2 mm after spreadCycle, ~0.3 mm before): the carriage still rings
  when the servo drops the pen 250 ms after arrival. Not a limit — a settle
  issue. Knobs: Muusia profile *settle before draw* (\`penDelayDown\`), or
  Klipper \`[input_shaper]\` (ring frequency estimated 30–50 Hz from the tick
  waves; measure properly before configuring). Input shaper is also the
  prerequisite for ever raising accel past 500.
- Watch item: the V60 diagonal showed a small kink near X≈245 mm on two
  sheets and none on the third — not deterministic, not acted on.

**Applied 2026-09-22:** \`max_velocity: 150\`, \`max_accel: 500\`,
\`stealthchop_threshold: 0\` on X/Y/Y1 (klipper/printer.cfg, synced to the Pi,
RESTART). Muusia profile: Draw F 3600, Travel F 9000.

## 10. Related project docs (software side — not needed for mechanics)`);

/* ---- HANDOFF living tools line ---- */
if (!hand.includes("speed-ladder.mjs")) {
  edit(HAND, "living tools: speed-ladder.mjs",
    "`validate-examples.mjs` (structural check for src/examples.js).",
    "`validate-examples.mjs` (structural check for src/examples.js), `speed-ladder.mjs` (Viivain motion-limit test G-code, MECH-HANDOFF §9.1).");
}

/* ---- check every anchor first ---- */
const text = { [MECH]: mech, [HAND]: hand };
let miss = 0;
for (const e of edits) {
  if (text[e.file].includes(SENTINEL) && e.file === MECH) { e.skip = true; continue; }
  const parts = text[e.file].split(e.from);
  if (parts.length !== 2) { console.log(`MISS  ${e.name} (${parts.length - 1} hits)`); miss++; }
}
if (miss) { console.log(`ABORT ${miss} anchor(s) missed — nothing written`); process.exit(1); }

/* ---- apply ---- */
for (const e of edits) {
  if (e.skip) { console.log(`SKIP  ${e.name}`); continue; }
  text[e.file] = text[e.file].replace(e.from, e.to);
  console.log(`OK    ${e.name}`);
}
if (text[MECH] !== mech) writeFileSync(MECH, text[MECH]);
if (text[HAND] !== hand) writeFileSync(HAND, text[HAND]);
console.log(`DONE  ${MECH}${text[HAND] !== hand ? ` + ${HAND}` : ""}`);
