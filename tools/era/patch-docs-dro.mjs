#!/usr/bin/env node
/* Document the Jul 31 Klipper/DRO session in both handoffs.
   Anchored replacement, OK/MISS report, writes only if ALL anchors hit once.
   ONE-SHOT — move to tools/era/ after running. Run from the repo root:
     node tools/patch-docs-dro.mjs */

import { readFileSync, writeFileSync } from "node:fs";

const JOBS = [
  {
    file: "docs/MUUSIA-HANDOFF.md",
    edits: [
      {
        name: "H1 repo layout: klipper/ folder",
        find: "MUUSIA-NODES-SRC.md (generated here by `tools/make-src-bundle.mjs`).",
        replace: `MUUSIA-NODES-SRC.md (generated here by \`tools/make-src-bundle.mjs\`).
- \`klipper/\` — machine-side configs at the repo root: \`printer.cfg\` draft for
  the BTT Kraken, \`moonraker-cors.snippet.conf\`, pen-cal drafts, README with
  the firmware build recipe. Version-controlled source of truth; live copies
  on the Pi (\`nakit\`). Outside \`src/\` and \`public/\` — never touches the Vite
  build or Pages. Details: MUUSIA-PLOTTER-MECH-HANDOFF.md §1 and §5.1.`,
      },
      {
        name: "H2 repo layout: src/dro.jsx",
        find: "  to entries (param-diff + id renumbering).",
        replace: `  to entries (param-diff + id renumbering).
- \`src/dro.jsx\` — Moonraker DRO: self-contained read-only websocket client +
  top-bar chip (live X/Y/Z, homed-axes dimming, 3 s auto-reconnect,
  re-subscribe on klippy restart). URL in the machine profile
  (\`moonrakerUrl\`). LAN/local only by design — the Pages build shows a
  red/failed DRO (https page cannot open insecure ws://; correct, not a bug).
  Wired into App.jsx via tools/era/patch-dro.mjs.`,
      },
      {
        name: "H3 UI systems: DRO bullet",
        find: "dependency-column layout (both live next to `addNodeAt` in App.jsx).",
        replace: `dependency-column layout (both live next to \`addNodeAt\` in App.jsx).
- **Moonraker DRO:** top-bar chip (src/dro.jsx) — click toggles the
  connection; green = klippy ready, amber = connecting / klippy down, red =
  retrying. Requires the local dev origins in Moonraker's cors_domains
  (klipper/moonraker-cors.snippet.conf, applied on nakit). Read-only: it
  never sends G-code.`,
      },
      {
        name: "H4 version history: DRO in the 2.38 window",
        find: "them — prefer process.exitCode.",
        replace: `them — prefer process.exitCode. Same push window: **Moonraker DRO**
  shipped (src/dro.jsx + machine-profile \`moonrakerUrl\`, applied via
  tools/era/patch-dro.mjs) — read-only live-position websocket chip in the
  top bar; see UI systems. The klipper/ folder gained printer.cfg and the
  CORS snippet in the same session (MECH handoff §1).`,
      },
    ],
  },
  {
    file: "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md",
    edits: [
      {
        name: "M1 header status",
        find: `Self-contained context for continuing the build in a new chat. Hardware-planning
stage (July 2026); nothing wired or configured yet. Next task: **design the pen
holder / carriage** together.`,
        replace: `Self-contained context for continuing the build in a new chat. Hardware
planning + host software stage (Aug 2026): the Pi software stack is installed
and configured, the Kraken has not yet arrived, nothing is wired. Next task:
**design the pen holder / carriage** together.`,
      },
      {
        name: "M2 §1 software line -> installed state",
        find: `- **Software (context only, not this task):** Klipper + Moonraker + Mainsail/
  Fluidd + KlipperScreen on the Pi.`,
        replace: `- **Software:** Klipper + Moonraker + Mainsail + KlipperScreen **installed
  and running** on the Pi (hostname \`nakit\`, 192.168.0.57; via KIAUH,
  Jul 2026). Kraken firmware pre-compiled (STM32H723, 128KiB bootloader,
  25 MHz crystal, USB PA11/PA12 — recipe in \`klipper/README.md\`); flashing +
  the real serial ID wait for the board. \`klipper/printer.cfg\` draft exists:
  official BTT pin map, slots S1=X, S2=Y-left, S3=Y-right, S4=Z, S5=brush
  (stubbed). Dual-Y homes as a pair against the single Y switch (a second
  switch on STOP2 or sensorless DIAG = future auto-square); no Z switch →
  \`[homing_override]\` virtual zero (jog Z to working height, G28 declares it
  Z=0; \`Z_ZERO_HERE\` re-declares after pen/paper changes). Pen servo macros
  PEN_UP / PEN_DOWN / PEN_RELEASE live only in printer.cfg so exported G-code
  stays hardware-agnostic. Muusia side: read-only **Moonraker DRO**
  (\`src/dro.jsx\`) shows live position over the websocket — LAN/local only;
  Moonraker cors_domains carries the local dev origins
  (\`klipper/moonraker-cors.snippet.conf\`, applied on nakit). Never
  port-forward Moonraker (7125) or Mainsail (80) to the internet.`,
      },
      {
        name: "M3 §5.1 klipper/ folder contents",
        find: "**Draft configs live in `klipper/` at the repo root** (`pen-cal.cfg`,\n`KlipperScreen-pencal.conf`, plus a README marking them as drafts).",
        replace: "**Draft configs live in `klipper/` at the repo root** (`printer.cfg`,\n`pen-cal.cfg`, `KlipperScreen-pencal.conf`, `moonraker-cors.snippet.conf`,\nplus a README with the firmware build recipe and the Pi↔repo sync\nconvention).",
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
console.log("Done. Move this script to tools/era/ — anchored patches are not idempotent.");
