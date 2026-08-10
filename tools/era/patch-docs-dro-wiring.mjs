#!/usr/bin/env node
/* Document the TM1637 DRO service: pin plan, cable colors, open items.
   Anchored replacement, OK/MISS report, writes only if ALL anchors hit once.
   ONE-SHOT — lives in tools/era/ after running. Run from the repo root:
     node tools/era/patch-docs-dro-wiring.mjs */

import { readFileSync, writeFileSync } from "node:fs";

const JOBS = [
  {
    file: "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md",
    edits: [
      {
        name: "W1 §1: DRO hardware bullet after the software bullet",
        find: `  port-forward Moonraker (7125) or Mainsail (80) to the internet.`,
        replace: `  port-forward Moonraker (7125) or Mainsail (80) to the internet.
- **DRO displays:** 3× TM1637 6-digit 7-seg (X/Y/Z work coordinates), driven
  by \`klipper/dro/dro_tm1637.py\` — a stdlib-only Python service (systemd unit
  \`dro.service\`, installed and running on nakit) polling Moonraker over HTTP
  at 10 Hz (\`gcode_move.gcode_position\`); GPIO via python3-lgpio, TM1637
  bit-banged (2-wire, NOT I2C). **Power from 3V3 (phys 17), never 5 V** —
  the modules pull CLK/DIO up to VCC and Pi GPIO is not 5 V tolerant.
  GND = phys 39. Pin + cable-color plan (soldering in progress):

  | Display | CLK (BCM / phys / color) | DIO (BCM / phys / color) |
  |---|---|---|
  | X | GPIO5 / 29 / white | GPIO6 / 31 / orange |
  | Y | GPIO13 / 33 / white | GPIO19 / 35 / orange |
  | Z | GPIO26 / 37 / orange | GPIO16 / 36 / black |

  Power pair: red + white (red = 3V3, white = GND — confirm at hookup).
  Open item: \`DIGIT_MAP\` — 6-digit TM1637 boards often cross-wire the two
  3-digit groups ("123456" renders "321654"); verify with
  \`python3 ~/dro-service/dro_tm1637.py --test\` (stop \`dro.service\` first,
  both claim the same GPIO lines) and fix the map in BOTH the Pi copy and
  \`klipper/dro/\`. The service shows \`------\` while Moonraker is unreachable.`,
      },
    ],
  },
  {
    file: "klipper/README.md",
    edits: [
      {
        name: "W2 README table: dro/ row",
        find: `| Applied on nakit 2026-07-31 |`,
        replace: `| Applied on nakit 2026-07-31 |
| \`dro/\` | TM1637 DRO service: \`dro_tm1637.py\` (stdlib + python3-lgpio; polls Moonraker HTTP 10 Hz, bit-banged TM1637, \`--test\` mode for solder/digit-order checks) + \`dro.service\` systemd unit. Pin/cable plan in MECH handoff §1. Power from 3V3 only. | Service running on nakit 2026-08-10; DIGIT_MAP pending first hookup test |`,
      },
    ],
  },
];

let ok = true;
const results = [];
for (const job of JOBS) {
  const src = readFileSync(job.file, "utf8");
  for (const e of job.edits) {
    const n = src.split(e.find).length - 1;
    if (n !== 1) { console.error(`MISS  ${e.name} — anchor found ${n}x (expected 1) in ${job.file}`); ok = false; }
  }
  results.push({ job, src });
}
if (!ok) { console.error("No changes written."); process.exit(1); }
for (const { job, src } of results) {
  let out = src;
  for (const e of job.edits) { out = out.replace(e.find, e.replace); console.log(`OK    ${e.name}`); }
  writeFileSync(job.file, out);
  console.log(`Wrote ${job.file}`);
}
