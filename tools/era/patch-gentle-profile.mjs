/* Era patch: Gentle machine preset + settle dwell after the first pen-up.
   Files: src/machine.js (preset C), src/App.jsx (import, machines state, toGcode
   dwell, APP_VERSION bump by one minor), docs/MUUSIA-HANDOFF.md (version entry).
   Run from the repo root. Anchored exact-string edits: idempotent, MISS-aborts,
   reports per edit. Nothing is written unless every edit on every file lands.

   Why (2026-10-04): a 0.35 mm technical-pen tip broke at job start on Viivain's
   fixed Z block. The exporter emitted the first SET_SERVO pen-up with no dwell
   and the first G0 on the very next line, so the gantry accelerated while the
   servo was still lifting the spring-loaded pen (MECH-HANDOFF 9.3). Companion:
   tools/era/patch-plot-go.mjs (printer.cfg PLOT_GO / GENTLE_ON / GENTLE_OFF,
   shipped separately as a Viivain commit). */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const APP = "src/App.jsx";
const MACH = "src/machine.js";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";
for (const f of [APP, MACH, HANDOFF]) {
  if (!existsSync(f)) { console.log("MISS  " + f + " not found - ABORT (run from the repo root; machine.js is the 2.108 split)"); process.exit(1); }
}
let app = readFileSync(APP, "utf8");
let mach = readFileSync(MACH, "utf8");
let hand = readFileSync(HANDOFF, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

/* Idempotence: sentinel that only exists in the finished state. */
const SENTINEL = `name: "C — Gentle (technical pen)"`;
if (mach.includes(SENTINEL)) {
  console.log("SKIP  patch-gentle-profile already applied (sentinel found in " + MACH + ")");
  process.exit(0);
}

/* Facts from the repo, not the conversation. */
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
const vparts = V.split(".");
if (vparts.length !== 2 || !/^\d+$/.test(vparts[1])) { console.log("MISS  APP_VERSION '" + V + "' is not MAJOR.MINOR - ABORT"); process.exit(1); }
const NV = vparts[0] + "." + (parseInt(vparts[1], 10) + 1);
console.log("INFO  app version from repo: " + V + " -> " + NV);
if (hand.includes("- **" + NV + "**")) { console.log("MISS  HANDOFF already has a " + NV + " entry - ABORT, check the repo state"); process.exit(1); }
if (!hand.includes("- **" + V + "**")) console.log("WARN  HANDOFF has no " + V + " entry yet - the current version is undocumented, finish that batch too");

/* ---- src/machine.js: preset C right after the DEFAULT_MACHINE_B block ---- */
const PRESET_C = `/* Gentle: fragile tips (0.35 mm technical pens). Slow feeds, long settles,
   and the Viivain Klipper macros (klipper/printer.cfg): GENTLE_ON caps accel +
   corner velocity for the job, PLOT_GO leaves the fixed Z block pen-up and slow
   before lowering to plot height (it replaces a bare PLOT_HEIGHT in startG),
   GENTLE_OFF restores the limits (CANCEL_PRINT runs it too). MECH-HANDOFF 9.3. */
export const DEFAULT_MACHINE_C = {
  ...DEFAULT_MACHINE,
  name: "C — Gentle (technical pen)",
  feedDraw: 1200, feedTravel: 3000, zFeed: 300, penDelayDown: 300, penDelayUp: 350,
  startG: "G21 ; mm\\nG90 ; absolute\\nCLEAR_PAUSE\\nGENTLE_ON ; 50 mm/s, 250 mm/s2, SCV 2 for fragile tips\\nPLOT_GO ; leave the Z block pen-up and slow, then plot height",
  endG: "GENTLE_OFF ; restore printer.cfg motion limits\\nG0 X0 Y0 F3000",
};
`;
{
  const head = "export const DEFAULT_MACHINE_B = {";
  const hits = mach.split(head).length - 1;
  if (hits !== 1) MISS(MACH + ": DEFAULT_MACHINE_B block (" + (hits === 0 ? "not found" : "not unique") + ")");
  else {
    const i0 = mach.indexOf(head);
    const close = mach.indexOf("\n};\n", i0);
    if (close < 0) MISS(MACH + ": DEFAULT_MACHINE_B block has no closing '};'");
    else {
      const at = close + "\n};\n".length;
      mach = mach.slice(0, at) + PRESET_C + mach.slice(at);
      OK(MACH + ": DEFAULT_MACHINE_C inserted after DEFAULT_MACHINE_B");
    }
  }
}

/* ---- src/App.jsx ---- */
const appEdits = [
  {
    name: "import DEFAULT_MACHINE_C from ./machine.js",
    old: `import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, DEFAULT_SVG_MACHINE,`,
    neu: `import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, DEFAULT_MACHINE_C, DEFAULT_SVG_MACHINE,`,
  },
  {
    name: "templates comment lists preset C",
    old: `/* machine templates live in src/machine.js (DEFAULT_MACHINE, DEFAULT_MACHINE_B, DEFAULT_SVG_MACHINE) */`,
    neu: `/* machine templates live in src/machine.js (DEFAULT_MACHINE, DEFAULT_MACHINE_B, DEFAULT_MACHINE_C, DEFAULT_SVG_MACHINE) */`,
  },
  {
    name: "machines state: register preset C",
    old: `assignIds([DEFAULT_MACHINE, DEFAULT_MACHINE_B])`,
    neu: `assignIds([DEFAULT_MACHINE, DEFAULT_MACHINE_B, DEFAULT_MACHINE_C])`,
  },
  {
    name: "toGcode: settle dwell after the first pen-up, before the first travel",
    old: `  if (zServo) servoTo(prof.servoUp, "pen up (servo)");
  else lines.push(\`G1 Z\${f2(prof.penUp)} F\${prof.zFeed} ; pen up (bed-Z)\`);
`,
    neu: `  if (zServo) servoTo(prof.servoUp, "pen up (servo)");
  else lines.push(\`G1 Z\${f2(prof.penUp)} F\${prof.zFeed} ; pen up (bed-Z)\`);
  /* the servo must have ARRIVED before the first travel: without this the
     first G0 left with the tip still on the Z block (MECH-HANDOFF 9.3) */
  if (prof.penDelayUp > 0) lines.push(\`G4 P\${Math.round(prof.penDelayUp)} ; settle before first travel\`);
`,
  },
  {
    name: "APP_VERSION " + V + " -> " + NV,
    old: `APP_VERSION = "${V}"`,
    neu: `APP_VERSION = "${NV}"`,
  },
];

/* ---- docs/MUUSIA-HANDOFF.md ---- */
const handEdits = [
  {
    name: "HANDOFF version history: " + NV,
    old: `\n## Hard-won pitfalls (keep)\n`,
    neu: `- **${NV}** Gentle profile + first-lift dwell (hardware incident 2026-10-04:
  a 0.35 mm technical-pen tip broke at job start — MECH-HANDOFF §9.3).
  Exporter: a \`penDelayUp\` settle dwell now follows the very first pen-up,
  before the first travel; previously \`SET_SERVO\` and \`G0 ... F9000\` were
  adjacent lines and the gantry accelerated while the servo was still lifting
  the spring-loaded pen. New template **C — Gentle (technical pen)** in
  src/machine.js: Draw F1200 / Travel F3000 / Z F300, settle 300 / 350 ms,
  startG \`GENTLE_ON\` + \`PLOT_GO\`, endG \`GENTLE_OFF\`. Klipper side shipped
  as the Viivain commit before this one (tools/era/patch-plot-go.mjs):
  \`PLOT_GO\` leaves the fixed Z block pen-up with dwell, Z to block top + 6 mm,
  10 mm/s to an apron at work (10, 0), then PLOT_HEIGHT — it REPLACES a bare
  PLOT_HEIGHT in every profile startG and is the RESUME hook;
  \`GENTLE_ON/OFF\` set and restore SET_VELOCITY_LIMIT (OFF also via
  \`user_cancel_macro\`); \`block_h\` 8.0 → 8.5 (tape under the block). Saved
  profiles live in patch files, so existing Viivain profiles swap PLOT_HEIGHT →
  PLOT_GO by hand. Rule: nothing lowers Z and nothing travels fast while over
  the block. Era: tools/era/patch-gentle-profile.mjs.

## Hard-won pitfalls (keep)
`,
  },
];

function apply(label, text, edits) {
  for (const e of edits) {
    const parts = text.split(e.old);
    if (parts.length === 2) { text = parts.join(e.neu); OK(label + ": " + e.name); }
    else if (parts.length === 1) MISS(label + ": " + e.name + " (anchor not found)");
    else MISS(label + ": " + e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
  }
  return text;
}

app = apply("App.jsx", app, appEdits);
hand = apply("HANDOFF", hand, handEdits);

const total = 1 + appEdits.length + handEdits.length;
if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - nothing written");
  process.exit(1);
}
writeFileSync(MACH, mach);
writeFileSync(APP, app);
writeFileSync(HANDOFF, hand);
console.log("DONE  " + ok + "/" + total + " edits applied, " + MACH + " + " + APP + " + " + HANDOFF + " written (version " + NV + ")");
