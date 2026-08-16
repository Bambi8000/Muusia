import { readFileSync, writeFileSync } from "node:fs";

let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

const CMYK = "src/defs/nodes/cmyk_registration.js";
const RAST = "src/defs/nodes/image_rasterise.js";
let cm = readFileSync(CMYK, "utf8");
let ra = readFileSync(RAST, "utf8");

if (cm.includes("showIf") || ra.includes("showIf")) {
  console.log("SKIP  patch-nodes-showif-v262 already applied (showIf found)");
  process.exit(0);
}

const MARKS = ["mCross", "mBull", "mStar", "mTomboC", "mTomboK", "mCrop", "mBar", "mLadder", "mEye", "mQuart", "mMicro", "mSteps", "mScale"];

const edits = [];

edits.push({
  file: "cmyk",
  name: "Single mark dropdown visible only in Single layout",
  old: 'options: ["Crosshair target", "Bullseye", "Star target", "Tombo center", "Tombo corner", "Crop marks", "Color bar", "Ladder gauge", "Eye marks", "Quartered target", "Micro cross", "Collation steps", "Scale cross"], def: "Crosshair target" },',
  neu: 'options: ["Crosshair target", "Bullseye", "Star target", "Tombo center", "Tombo corner", "Crop marks", "Color bar", "Ladder gauge", "Eye marks", "Quartered target", "Micro cross", "Collation steps", "Scale cross"], def: "Crosshair target", showIf: (p) => p.layout === "Single" },',
});

for (const k of MARKS) {
  const label = {
    mCross: "Crosshair target", mBull: "Bullseye", mStar: "Star target", mTomboC: "Tombo center",
    mTomboK: "Tombo corner", mCrop: "Crop marks", mBar: "Color bar", mLadder: "Ladder gauge",
    mEye: "Eye marks", mQuart: "Quartered target", mMicro: "Micro cross", mSteps: "Collation steps",
    mScale: "Scale cross",
  }[k];
  edits.push({
    file: "cmyk",
    name: "mark checkbox " + k + " hidden in Single layout",
    old: '{ key: "' + k + '", label: "' + label + '", type: "check", def: true },',
    neu: '{ key: "' + k + '", label: "' + label + '", type: "check", def: true, showIf: (p) => p.layout !== "Single" },',
  });
}

edits.push({
  file: "cmyk",
  name: "Count hidden in Single and Press sheet (fixed populations)",
  old: '{ key: "count", label: "Count", type: "slider", min: 1, max: 60, step: 1, def: 14 },',
  neu: '{ key: "count", label: "Count", type: "slider", min: 1, max: 60, step: 1, def: 14, showIf: (p) => p.layout !== "Single" && p.layout !== "Press sheet" },',
});

for (const [k, label, def] of [["angC", "Cyan angle", 15], ["angM", "Magenta angle", 75], ["angY", "Yellow angle", 0], ["angK", "Black angle", 45]]) {
  edits.push({
    file: "rast",
    name: "angle slider " + k + " visible only in Custom angles",
    old: '{ key: "' + k + '", label: "' + label + '", type: "slider", min: 0, max: 90, step: 0.5, def: ' + def + ' },',
    neu: '{ key: "' + k + '", label: "' + label + '", type: "slider", min: 0, max: 90, step: 0.5, def: ' + def + ', showIf: (p) => p.angles === "Custom" },',
  });
}

edits.push({
  file: "rast",
  name: "imageMax: 480 (sharper raster intake, opt-in so other fileImage nodes are untouched)",
  old: '  fileImage: true,',
  neu: '  fileImage: true,\n  imageMax: 480,',
});

edits.push({
  file: "rast",
  name: "desc: document the 480 px intake",
  old: 'Needs an app build that stores RGB in the image intake;',
  neu: 'This node opts into a 480 px image intake (other fileImage nodes keep the 160 px default, so their output is unchanged). Needs an app build that stores RGB in the image intake;',
});

for (const e of edits) {
  const target = e.file === "cmyk" ? cm : ra;
  const parts = target.split(e.old);
  if (parts.length === 2) {
    if (e.file === "cmyk") cm = parts.join(e.neu); else ra = parts.join(e.neu);
    OK(e.name);
  } else if (parts.length === 1) MISS(e.name + " (anchor not found)");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - NOTHING written");
  process.exit(1);
}
writeFileSync(CMYK, cm);
writeFileSync(RAST, ra);
console.log("DONE  " + ok + " edits applied to both node files");
