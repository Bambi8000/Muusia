/* One-shot era patch for v2.49 App.jsx changes:
   - APP_VERSION 2.48 -> 2.49
   - NODE_TIPS.origami_glitch_fold updated for the movable pivot + guides
   (The 8 new v2.49 nodes carry their help in def-level `desc`, no TIPS needed.)
   Run once from repo root AFTER baking: node tools/era/patch-v249-app.mjs
   NOT idempotent beyond the SKIP guard.
   Post-patch sentinels:
     grep -c '"2.49"' src/App.jsx            -> 1
     grep -c "DroPanel" src/App.jsx          -> 2
     grep -c "AnalyzeButton" src/App.jsx     -> 3
     grep -c "oins, primaryNode" src/App.jsx -> 1
     grep -c "fileBinary" src/App.jsx        -> 1  (from patch-file-binary.mjs) */
import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes('APP_VERSION = "2.49"')) {
  console.log("SKIP  App.jsx already at 2.49");
  process.exit(0);
}

let ok = 0, miss = 0;
const rep = (name, from, to) => {
  const i = src.indexOf(from);
  if (i < 0) { console.log("MISS  " + name); miss++; return; }
  if (src.indexOf(from, i + 1) >= 0) { console.log("MISS  " + name + " (anchor not unique)"); miss++; return; }
  src = src.slice(0, i) + to + src.slice(i + from.length);
  console.log("OK    " + name);
  ok++;
};

rep("APP_VERSION 2.48 -> 2.49",
  'const APP_VERSION = "2.48";',
  'const APP_VERSION = "2.49";');

rep("NODE_TIPS origami_glitch_fold: movable pivot",
  'origami_glitch_fold: "mirrors everything on one side of an adjustable fold line back across it, with a distance-proportional crease warp; optional Keep Original for layered folds. Output clamped to the sheet.",',
  'origami_glitch_fold: "mirrors everything on one side of an adjustable fold line back across it, with a distance-proportional crease warp; optional Keep Original for layered folds. The fold pivots around a movable point (Pivot X/Y, or the canvas center) and Axis Position slides the line along its normal; dashed guides show the fold line, pivot and mirrored side. Output clamped to the sheet.",');

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - " + FILE + " NOT written");
  process.exit(1);
}
fs.writeFileSync(FILE, src);
console.log("WROTE " + FILE + " (" + ok + " replacements)");
