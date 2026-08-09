#!/usr/bin/env node
/* patch-roll-labels-text.mjs — one-shot era patch: the Mega Canvas "Tile labels"
   checkbox text now follows the Kind (Roll pieces are labeled "S# P#", not
   number + row/col). Run ONCE from the repo root AFTER patch-mega-roll.mjs:
     node tools/era/patch-roll-labels-text.mjs
   Anchored exact-string replacement, OK/MISS report, re-run guard (SKIP).
   NOT idempotent — do not re-run after success. */
import fs from "node:fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

const OLD = `                  Tile labels (number + row/col, mark pen)`;
const NEU = `                  {megaKind === "Roll" ? "Piece labels (S strip P piece, mark pen)" : "Tile labels (number + row/col, mark pen)"}`;

if (src.includes(`Piece labels (S strip P piece`)) {
  console.log("SKIP: piece-label text already present — patch already applied.");
  process.exitCode = 0;
} else {
  const n = src.split(OLD).length - 1;
  if (n !== 1) {
    console.log(`MISS (${n} matches): tile-labels text — file NOT written. Run patch-mega-roll.mjs first.`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(FILE, src.replace(OLD, NEU));
    console.log("OK: tile-labels text — src/App.jsx written.");
    console.log('Sentinel: grep -c "Piece labels (S strip P piece" src/App.jsx → 1');
  }
}
