/* Era patch: Frame node gains a fifth output "rot °" — a loop-seamless
   rotation in degrees, rot = (frame / frameCount) * 360, for wiring into
   Rotate-style inputs. Appended AFTER the existing outputs, so every wire
   into ports 0..3 of every saved patch keeps its meaning and the four old
   values stay byte-identical.

   Run from the repo root: node tools/era/patch-frame-rot.mjs
   Reports OK / MISS / SKIP per edit and smoke-tests the patched module. */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FILE = resolve("src/defs/nodes/frame.js");
let src = readFileSync(FILE, "utf8");

/* idempotency sentinel from the finished state */
if (src.includes('"rot \u00b0"')) {
  console.log("SKIP  frame.js already carries the rot \u00b0 output");
  process.exit(0);
}

let miss = 0;
const edit = (anchor, replacement, label) => {
  const parts = src.split(anchor);
  if (parts.length !== 2) {
    console.log("MISS  " + label + " (" + (parts.length - 1) + " hits, need exactly 1)");
    miss++;
    return;
  }
  src = parts[0] + replacement + parts[1];
  console.log("OK    " + label);
};

edit(
  'Pin("value", "ping-pong")]',
  'Pin("value", "ping-pong"), Pin("value", "rot \u00b0")]',
  "outs: append rot \u00b0 pin after ping-pong"
);
edit(
  "return [t, i, wave, pp];",
  "return [t, i, wave, pp, tl * 360];",
  "compute: append tl * 360 to the return"
);

if (miss) {
  console.log("ABORT " + miss + " missed anchor(s) - nothing written");
  process.exit(1);
}
writeFileSync(FILE, src);

/* smoke-test the patched module: it must import, old outputs must be
   byte-identical to the pre-patch math, and rot must be loop-seamless */
const def = (await import(pathToFileURL(FILE).href + "?t=" + Date.now())).default;
const run = (f, n) => def.compute([], {}, { frameIdx: f, frameCount: n });
let bad = 0;
const chk = (cond, msg) => { console.log((cond ? "OK    " : "FAIL  ") + msg); if (!cond) bad++; };

const outs = typeof def.outs === "function" ? def.outs({ params: {} }) : def.outs;
chk(outs.length === 5 && outs[4].label === "rot \u00b0", "five outputs, last is rot \u00b0");
const r = run(3, 12);
const t = 3 / 11, tl = 3 / 12;
chk(r.length === 5, "compute returns five values");
chk(r[0] === t && r[1] === 3 &&
    r[2] === 0.5 - 0.5 * Math.cos(tl * Math.PI * 2) &&
    r[3] === (tl < 0.5 ? tl * 2 : 2 - tl * 2),
  "outputs 1-4 byte-identical to the old math");
chk(r[4] === 90, "rot at frame 4/12 = 90 deg");
chk(run(0, 12)[4] === 0 && run(11, 12)[4] === 330, "rot 0..330 over 12 frames (seamless loop)");
chk(Number.isFinite(run(0, 1)[4]) && run(0, 1)[4] === 0, "single-frame animation: rot finite 0");
chk(Number.isFinite(run(5, 0)[4]), "frameCount 0 guard holds");

console.log(bad === 0 ? "DONE  frame.js patched and smoke-tested" : "DONE WITH " + bad + " FAILURES");
process.exit(bad === 0 ? 0 : 1);
