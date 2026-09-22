#!/usr/bin/env node
/*
 * patch-mech-klipperscreen.mjs — documents the KlipperScreen plotter menus
 * (klipper/viivain-screen.conf, 2026-09-22): MECH-HANDOFF §7.1 + HANDOFF
 * klipper/ file list. Anchored, MISS aborts before writing, SKIP if applied.
 * One-shot; lives in tools/era/ once applied.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const MECH = "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md";
const HAND = "docs/MUUSIA-HANDOFF.md";
const SENTINEL = "### 7.1 KlipperScreen";
for (const f of [MECH, HAND, "klipper/viivain-screen.conf"]) {
  if (!existsSync(f)) { console.log(`MISS  ${f} not found — run from the repo root`); process.exit(1); }
}
const conf = readFileSync("klipper/viivain-screen.conf", "utf8");
const nMain = (conf.match(/^\[menu __main [a-z_]+\]$/gm) || []).length;
const nPrint = (conf.match(/^\[menu __print [a-z_]+\]$/gm) || []).length;
let mech = readFileSync(MECH, "utf8");
let hand = readFileSync(HAND, "utf8");
const edits = [];
if (!mech.includes(SENTINEL)) edits.push({ file: MECH, name: "insert §7.1", from: "## 8. Session log 2026-08-12 — workflow commissioning (keep the pitfalls)", to:
`${SENTINEL} — plotter menus (2026-09-22)

The touchscreen no longer shows the 3D-printer defaults. \`klipper/viivain-screen.conf\`
(repo, live copy in \`~/printer_data/config/\`) is pulled in by a single
\`[include viivain-screen.conf]\` line at the top of \`KlipperScreen.conf\`, so
KlipperScreen's own auto-generated section in that file survives edits.
\`[main] use_default_menu: False\` replaces the default menu; \`auto_open_extrude:
False\` stops the Extrude panel popping up when a job pauses for a pen change.

- **Idle menu** (${nMain} top-level buttons): Pen Up, Pen Down, Plot Start (runs
  \`PLOT_START\`, no confirmation), Print (file browser), Move (jog + homing),
  Macros (every macro without a leading underscore), Console, More (Motors Off,
  Pen Release, Restart Klipper, Settings, Network, Update).
- **Job menu** (${nPrint} buttons, the menu button on the job status page — also
  while paused at an M0 pen change): Pen Up, Pen Down, Move, Macros, Console.
  Resume/Cancel stay on the job status page itself.
- Macro buttons carry \`enable: {{ 'NAME' in printer.gcode_macros.list }}\` so a
  renamed macro hides its button instead of breaking the menu.
- Icons are file names in \`~/KlipperScreen/styles/z-bolt/images/\`; a missing
  icon renders a blank button.
- Deploy: \`scp klipper/viivain-screen.conf viivain:~/printer_data/config/\` then
  \`curl -X POST "http://viivain:7125/machine/services/restart?service=KlipperScreen"\`
  (Moonraker manages the service — no sudo). Check
  \`grep -a 'Config path\\|Traceback' ~/printer_data/logs/KlipperScreen.log | tail\`.
- **Trap:** \`PEN_UP\`/\`PEN_DOWN\` are defined in both \`printer.cfg\` and the
  not-yet-included \`pen-cal.cfg\`. Klipper refuses duplicate sections — remove
  them from pen-cal.cfg before ever including it (§5.1).

## 8. Session log 2026-08-12 — workflow commissioning (keep the pitfalls)` });
else console.log(`SKIP  ${MECH} already has ${SENTINEL}`);
if (!hand.includes("viivain-screen.conf")) edits.push({ file: HAND, name: "klipper/ file list", from: "`moonraker-cors.snippet.conf`, pen-cal drafts,", to: "`moonraker-cors.snippet.conf`, `viivain-screen.conf` (KlipperScreen menus, MECH-HANDOFF §7.1), pen-cal drafts," });
else console.log(`SKIP  ${HAND} already lists viivain-screen.conf`);
const text = { [MECH]: mech, [HAND]: hand };
let miss = 0;
for (const e of edits) { const n = text[e.file].split(e.from).length - 1; if (n !== 1) { console.log(`MISS  ${e.name} (${n} hits)`); miss++; } }
if (miss) { console.log(`ABORT ${miss} anchor(s) missed — nothing written`); process.exit(1); }
for (const e of edits) { text[e.file] = text[e.file].replace(e.from, e.to); console.log(`OK    ${e.name}`); }
if (text[MECH] !== mech) writeFileSync(MECH, text[MECH]);
if (text[HAND] !== hand) writeFileSync(HAND, text[HAND]);
console.log(`DONE  ${edits.length ? edits.map((e) => e.file).join(" + ") : "(nothing to do)"}`);
