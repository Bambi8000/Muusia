#!/usr/bin/env node
/*
 * patch-mech-hold-current.mjs — 2026-09-24: PSU swapped to a fanless Mean Well
 * UHP-500-24, which uncovered the spreadCycle standstill chopper hiss (hold
 * current was 2.0 A = run). Runtime test SET_TMC_CURRENT HOLDCURRENT=0.7
 * silenced it; cfg now sets hold_current 0.7 on X/Y/Y1.
 * MECH-HANDOFF: §1 PSU line, §9 table row, new §9.2. Anchored, MISS aborts
 * before writing, SKIP if applied. One-shot.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const MECH = "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md";
const SENTINEL = "### 9.2 Standstill hiss";
for (const f of [MECH, "klipper/printer.cfg"]) if (!existsSync(f)) { console.log(`MISS  ${f} not found — run from the repo root`); process.exit(1); }
const cfg = readFileSync("klipper/printer.cfg", "utf8");
const holds = (cfg.match(/^hold_current:\s*([\d.]+)/gm) || []).map((l) => l.split(/:\s*/)[1]);
if (holds.length !== 3 || holds.some((h) => h !== "0.7")) {
  console.log(`MISS  klipper/printer.cfg has hold_current lines: ${JSON.stringify(holds)}; expected three 0.7 — apply the cfg change first`);
  process.exit(1);
}
let mech = readFileSync(MECH, "utf8");
if (mech.includes(SENTINEL)) { console.log(`SKIP  ${MECH} already has ${SENTINEL}`); console.log("DONE  (nothing to do)"); process.exit(0); }
const edits = [
  { name: "§1 PSU line",
    from: "- **PSU:** Meishile S-500-24 (24 V, 21 A, 500 W) enclosed switching supply from\n  parts bin — correct type for motors. Verify 230 V mains selector + test\n  before use.",
    to: "- **PSU:** Mean Well UHP-500-24 (24 V, 20.9 A, 500 W, fanless) since 2026-09-24 —\n  replaced the Meishile S-500-24 whose fan was loud. Fanless means every\n  other noise is now audible; see §9.2." },
  { name: "§9 table: hold_current row",
    from: "| `run_current` Z | 1.4 A | printer.cfg |",
    to: "| `run_current` Z | 1.4 A | printer.cfg |\n| `hold_current` X/Y/Y1 | **0.7 A** | printer.cfg — spreadCycle standstill hiss at 2.0 A hold; 0.7 tested silent (§9.2) |" },
  { name: "insert §9.2",
    from: "## 10. Related project docs (software side — not needed for mechanics)",
    to: `${SENTINEL} — hold_current (2026-09-24)

After the fanless PSU went in, the XY motors hissed whenever they were
enabled and standing still; \`M84\` silenced it. Two things had changed in the
same week (spreadCycle on 09-22, PSU on 09-24), so it was tested at runtime
before touching cfg: \`SET_TMC_CURRENT STEPPER=stepper_x CURRENT=2.0
HOLDCURRENT=0.7\` (and y, y1) silenced it — the source is the spreadCycle
chopper at full 2.0 A hold current, not the PSU. stealthChop is silent at
standstill but is the wrong mode for moving (§9.1), so the fix is
\`hold_current: 0.7\` on X/Y/Y1: silent, less idle heat. Holding torque at 0.7 A
is lower — if a plot ever resumes misaligned after an M0 pen change, suspect
the carriage having been pushed during the change and raise hold_current to
1.0 before anything else. Not applied: \`stealthchop_threshold: 10\` (stealth below
10 mm/s) would be fully silent but switches chopper mode at the start of
every move under load, which Klipper's TMC docs warn about.

Second-guess tool for any noise question: \`SET_TMC_CURRENT … HOLDCURRENT=\`
and \`SET_TMC_FIELD STEPPER=… FIELD=en_pwm_mode VALUE=1\` are runtime and
reversible with \`FIRMWARE_RESTART\`; if neither changes the sound but \`M84\`
does, listen to the PSU (coil whine under load).

## 10. Related project docs (software side — not needed for mechanics)` },
];
let miss = 0;
for (const e of edits) { const n = mech.split(e.from).length - 1; if (n !== 1) { console.log(`MISS  ${e.name} (${n} hits)`); miss++; } }
if (miss) { console.log(`ABORT ${miss} anchor(s) missed — nothing written`); process.exit(1); }
for (const e of edits) { mech = mech.replace(e.from, e.to); console.log(`OK    ${e.name}`); }
writeFileSync(MECH, mech);
console.log(`DONE  ${MECH}`);
