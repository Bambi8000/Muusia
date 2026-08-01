#!/usr/bin/env node
/* tools/patch-fadeout-gcode.mjs
   Companion to the Fade Out node (2.42 batch): the G-code export clamped the
   point z component to [0, 6] mm of plunge, so a negative z (lift ABOVE
   pen-down - the slow-lift comet tail) never reached the machine. Widen the
   clamp to [-6, 6] and cap the resulting Z at the profile's pen-up so a tail
   can never fly higher than a normal lift. Plunge behaviour (Brush Z) is
   byte-identical. Also updates the z-component spec in MUUSIA-NODE-API.md.
   Run from repo root:
     node tools/patch-fadeout-gcode.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const APP = "src/App.jsx";
const API = "docs/MUUSIA-NODE-API.md";

const EDITS = [
  {
    file: APP,
    label: "toGcode: brushZ clamp allows negative lift, capped at pen-up",
    guard: "Math.max(-6, Math.min(6, q[2]))",
    old: `  const brushZ = (q) => (!zServo && typeof q[2] === "number" && isFinite(q[2]))
    ? \` Z\${f2(prof.penDown - Math.max(0, Math.min(6, q[2])))}\`
    : "";`,
    new: `  const brushZ = (q) => (!zServo && typeof q[2] === "number" && isFinite(q[2]))
    ? \` Z\${f2(Math.min(prof.penUp, prof.penDown - Math.max(-6, Math.min(6, q[2]))))}\`
    : "";`,
  },
  {
    file: APP,
    label: "toGcode: z-component comment mentions lift",
    guard: "Fade Out -hannat",
    old: `  /* Brush Z: pisteen 3. komponentti = upotus mm pen-downin alle (Brush Z -node).
     Vain bed-Z-tilassa; klampattu 6 mm turvarajaan. */`,
    new: `  /* Pisteen 3. komponentti = upotus mm pen-downin alle (Brush Z; negatiivinen
     = nosto pen-downin ylle, Fade Out -hannat). Vain bed-Z-tilassa; klampattu
     \u00b16 mm, tulos katkaistaan penUp-tasoon. */`,
  },
  {
    file: API,
    label: "NODE-API: z spec covers negative lift",
    guard: "negative values lift ABOVE",
    old: `- Points MAY carry an optional third component \`[x, y, z]\`: millimetres of
  Z plunge below the machine profile's pen-down contact (written by Brush Z,
  read by the G-code export as simultaneous Z moves, clamped to 6 mm). The`,
    new: `- Points MAY carry an optional third component \`[x, y, z]\`: millimetres of
  Z plunge below the machine profile's pen-down contact (written by Brush Z;
  negative values lift ABOVE contact - written by Fade Out for slow-lift
  tails). The G-code export turns it into simultaneous Z moves, clamped to
  \u00b16 mm and capped at the profile's pen-up height. The`,
  },
];

let miss = 0;
for (const e of EDITS) {
  let txt;
  try { txt = readFileSync(e.file, "utf8"); }
  catch { console.log("MISS " + e.label + "  [" + e.file + " not found]"); miss++; continue; }
  if (e.guard && txt.includes(e.guard)) { console.log("SKIP " + e.label + "  [already applied]"); continue; }
  const n = txt.split(e.old).length - 1;
  if (n !== 1) { console.log("MISS " + e.label + "  [anchor found " + n + " times]"); miss++; continue; }
  writeFileSync(e.file, txt.replace(e.old, e.new));
  console.log("OK   " + e.label);
}
process.exit(miss ? 1 : 0);
