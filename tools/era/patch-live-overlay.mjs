/* Era patch: tell LiveInput when the big preview overlay is open.
   Run once from the repo root:  node tools/era/patch-live-overlay.mjs

   The big preview is `position: fixed; inset: 0; zIndex: 100`, so it buries the
   whole top bar including the LIVE chip. Driving values while watching the large
   canvas is the main reason the Controller node exists, so LiveInput needs to
   know and mirror a compact readout above the overlay. One prop does it.

   Follows patch-live-input.mjs — that patch's mount line is this one's anchor. */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = "src/App.jsx";

if (!existsSync(FILE)) { console.log("MISS  " + FILE + " not found - run from the repo root - ABORT"); process.exit(1); }

let src = readFileSync(FILE, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.includes("overlay={bigPreview}")) {
  console.log("SKIP  patch-live-overlay already applied (sentinel found)");
  process.exit(0);
}
if (!src.includes("./live-input.jsx")) {
  console.log("MISS  patch-live-input has not been applied yet - run it first - ABORT");
  process.exit(1);
}

const vm = src.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
console.log("INFO  app version from repo: " + vm[1]);

const edits = [
  {
    name: "pass bigPreview to LiveInput",
    old: "        <LiveInput nodes={lvl.nodes} selIds={selIds} setParam={setParam} setParams={setParamsMulti} histRef={histRef} />\n",
    neu: "        <LiveInput nodes={lvl.nodes} selIds={selIds} setParam={setParam} setParams={setParamsMulti} histRef={histRef} overlay={bigPreview} />\n",
  },
];

for (const e of edits) {
  const parts = src.split(e.old);
  if (parts.length === 2) { src = parts.join(e.neu); OK(e.name); }
  else if (parts.length === 1) MISS(e.name + " (anchor not found)");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - " + FILE + " NOT written");
  process.exit(1);
}

writeFileSync(FILE, src);
console.log("DONE  " + ok + "/" + edits.length + " edits applied, " + FILE + " written");
