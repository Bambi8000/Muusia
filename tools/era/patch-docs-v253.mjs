#!/usr/bin/env node
/* Document the canvas check feature (v2.53) + the silent-sed pitfall.
   Anchored replacement, OK/MISS report, writes only if ALL anchors hit once.
   ONE-SHOT — lives in tools/era/ after running. Run from the repo root:
     node tools/era/patch-docs-v253.mjs */

import { readFileSync, writeFileSync } from "node:fs";

const JOBS = [
  {
    file: "docs/MUUSIA-HANDOFF.md",
    edits: [
      {
        name: "V1 version history: 2.53 canvas check",
        find: "  rollouts beat both pure randomness and backtracking for generative walks.",
        replace: `  rollouts beat both pure randomness and backtracking for generative walks.
- **2.53** cross-stack feature: **Canvas check** — laser-framed job bounds
  before plotting. Klipper side: \`klipper/canvas-check.cfg\` (\`CANVAS_CHECK\`
  macro: pen up, laser traces the bounds rectangle, refuses unhomed or
  beyond machine travel — doubles as an oversized-job guard; inside a job it
  PAUSEs with a Continue/Abort touch prompt; runs laser-dark with an M117
  note until \`[output_pin laser]\` exists, so it smoke-tests without the
  laser). Muusia side: \`toGcode()\` emits \`CANVAS_CHECK X_MIN=.. Y_MAX=..
  LASER_OFF_X=..\` right after startG from real path bounds (through fx/fy so
  origin + flipY are baked in; \`__stop\` marker paths excluded), gated by
  profile \`canvasCheckOn\` (opt-in — the macro pauses the job); CANVAS CHECK
  toggle sits after the laser-jig section. Extract-and-run validated:
  origin, flipY, opt-out, stop-only cases. Shipped as commit cb72882
  mislabeled "v2.45" + bump 29a03fa — the repo was already at 2.52 (see the
  sed pitfall below).`,
      },
      {
        name: "V2 pitfall: silent sed version bumps",
        find: `  has demonstrably reverted to the unpatched state — the OK/MISS anchor
  report is the proof either way.`,
        replace: `  has demonstrably reverted to the unpatched state — the OK/MISS anchor
  report is the proof either way.
- Version bumps via \`sed\` fail SILENTLY when the assumed current version is
  wrong (the "v2.45" mislabel: the repo had moved to 2.52 in other sessions,
  sed matched nothing, and the feature shipped under an unbumped version in
  a mislabeled commit). The \`grep -o 'APP_VERSION = ...'\` line after every
  bump is not decoration — READ its output before building. Between chats
  the repo moves: verify version numbers in command sequences against the
  working copy, never against the previous session's state.`,
      },
    ],
  },
  {
    file: "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md",
    edits: [
      {
        name: "V3 §5.2 canvas check workflow",
        find: `final versions move to the Pi's \`~/printer_data/config/\` once the Kraken arrives,
with \`klipper/\` remaining the version-controlled source of truth.`,
        replace: `final versions move to the Pi's \`~/printer_data/config/\` once the Kraken arrives,
with \`klipper/\` remaining the version-controlled source of truth.

### 5.2 Canvas check (laser framing)

Exported G-code can open with \`CANVAS_CHECK\` (macro in
\`klipper/canvas-check.cfg\`, included from printer.cfg): pen up, the laser
traces the job's bounding box, then the job pauses with a Continue/Abort
prompt on the touchscreen — paper size and placement get verified before a
single line is drawn. Bounds and the laser offset arrive baked into the call
by Muusia's exporter (machine-profile toggle \`canvasCheckOn\`, off by
default). The macro also refuses frames beyond machine travel, which doubles
as an oversized-job guard, and runs laser-dark with a console note until
\`[output_pin laser]\` is wired — same laser and same pin TODO as the
magnet-jig and pen-cal workflows above.`,
      },
    ],
  },
  {
    file: "klipper/README.md",
    edits: [
      {
        name: "V4 README table: canvas-check.cfg row",
        find: `| Service running on nakit 2026-08-10; DIGIT_MAP pending first hookup test |`,
        replace: `| Service running on nakit 2026-08-10; DIGIT_MAP pending first hookup test |
| \`canvas-check.cfg\` | \`CANVAS_CHECK\` macro — laser-framed job-bounds check: travel guard, Continue/Abort touch prompt, laser-dark smoke mode until the laser pin exists. Called from Muusia's exported G-code (profile toggle \`canvasCheckOn\`, v2.53). | Draft — laser pin TODO; motion untested until the Kraken |`,
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
