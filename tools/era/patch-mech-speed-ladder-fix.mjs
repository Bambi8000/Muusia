#!/usr/bin/env node
/*
 * patch-mech-speed-ladder-fix.mjs — corrects §9.1 of MUUSIA-PLOTTER-MECH-HANDOFF.md
 * after klippy.log showed that the stealthChop→spreadCycle switch never reached
 * the Pi before the ladder sheets: all three measurement sheets ran in
 * stealthChop, the switch landed 2026-09-22 12:10 (after the measurements),
 * and a fourth sheet validated 150/500 in spreadCycle.
 *
 * Anchored exact-string replacement on text inserted by
 * patch-mech-speed-ladder.mjs. MISS aborts before any write; SKIP if applied.
 * One-shot, lives in tools/era/ once applied.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MECH = "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md";
const SENTINEL = "so all three measurement sheets";
if (!existsSync(MECH)) { console.log(`MISS  ${MECH} not found — run from the repo root`); process.exit(1); }
let mech = readFileSync(MECH, "utf8");
if (mech.includes(SENTINEL)) { console.log(`SKIP  ${MECH} already corrected`); console.log("DONE  (nothing to do)"); process.exit(0); }

const edits = [];
const edit = (name, from, to) => edits.push({ name, from, to });

edit("§9.1 stealthChop bullet",
`- **Live cfg had X/Y/Y1 in stealthChop** (\`stealthchop_threshold: 999999\`)
  although the §9 table recorded 0. The first velocity ladder showed it: the
  control row 60/500 lost ~4 mm in Y on its first long hop and every faster
  row was clean — stealthChop's pwm_autoscale tunes during the first moves
  after power-on and can drop steps on the first hard travel. Switched X/Y/Y1
  to spreadCycle (\`stealthchop_threshold: 0\`, Z stays stealth); re-run was
  clean on every row including the control. Lesson: the table is not the
  cfg — grep the live file.`,
`- **Live cfg had X/Y/Y1 in stealthChop** (\`stealthchop_threshold: 999999\`)
  although the §9 table recorded 0 — the table is not the cfg, grep the live
  file. On the first velocity ladder the control row 60/500 lost ~4 mm in Y
  on its first long hop while every faster row was clean. stealthChop's
  autotune on the first moves after power-on was a plausible story, but it is
  **not established**: the attempted switch to spreadCycle never reached the
  Pi (the awk edit was never applied — klippy.log's per-start config dumps
  show 999999 at every start until 12:10), so all three measurement sheets
  ran in stealthChop, and the "confirming" re-run changed nothing. The 4 mm
  loss did not recur on the next three sheets: recorded as a one-off, cause
  unknown. X/Y/Y1 were switched to spreadCycle at 12:10 after the
  measurements, on §9's standing recommendation and because stealthChop is
  the wrong mode for fast travel; a fourth velocity ladder in spreadCycle was
  clean on every row. **Lesson: before crediting a re-run to a cfg change,
  check klippy.log — \`grep -a -n -E '^Start printer at|^<setting>'\` shows what
  each start actually loaded.**`);

edit("§9.1 velocity bullet: sheet count",
  "  Repeated on a third sheet. `max_velocity: 150`.",
  "  Repeated on a third sheet (stealthChop) and a fourth (spreadCycle).\n  `max_velocity: 150`.");

edit("§9.1 ringing bullet: spreadCycle claim",
`  hop is faintly wavy on every row regardless of speed (X-direction,
  ~0.1–0.2 mm after spreadCycle, ~0.3 mm before): the carriage still rings`,
`  hop was faintly wavy on every row regardless of speed on the three
  stealthChop sheets (X-direction, ~0.1–0.3 mm, varying sheet to sheet with
  no cfg change) and absent on the one spreadCycle sheet — one observation,
  not yet a conclusion: the carriage may still ring`);

edit("§9.1 watch item: sheet count",
  "  sheets and none on the third — not deterministic, not acted on.",
  "  sheets and none on the third or fourth — not deterministic, not acted on.");

edit("§9.1 applied line: timing",
`**Applied 2026-09-22:** \`max_velocity: 150\`, \`max_accel: 500\`,
\`stealthchop_threshold: 0\` on X/Y/Y1 (klipper/printer.cfg, synced to the Pi,
RESTART). Muusia profile: Draw F 3600, Travel F 9000.`,
`**Applied 2026-09-22:** \`max_velocity: 150\`, \`max_accel: 500\` (12:09) and
\`stealthchop_threshold: 0\` on X/Y/Y1 (12:10, after all ladder measurements;
klipper/printer.cfg synced to the Pi, RESTART, verified in klippy.log).
Muusia profile: Draw F 3600, Travel F 9000.`);

let miss = 0;
for (const e of edits) {
  const n = mech.split(e.from).length - 1;
  if (n !== 1) { console.log(`MISS  ${e.name} (${n} hits)`); miss++; }
}
if (miss) { console.log(`ABORT ${miss} anchor(s) missed — nothing written`); process.exit(1); }
for (const e of edits) { mech = mech.replace(e.from, e.to); console.log(`OK    ${e.name}`); }
writeFileSync(MECH, mech);
console.log(`DONE  ${MECH}`);
