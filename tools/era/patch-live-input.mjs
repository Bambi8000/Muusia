/* Era patch: wire src/live-input.jsx into App.jsx (Controller node engine seam).
   Run once from the repo root:  node tools/era/patch-live-input.mjs
   Anchored exact-string replacement: idempotent, MISS-aborts, reports per edit.

   Four edits:
     1. import the module
     2. add setParamsMulti — one setNodesL for a whole channel update, so a
        6-axis frame is one re-render instead of six
     3. undo-history gate — one snapshot per live gesture instead of one per
        400 ms, which would otherwise flush the 60-entry history
     4. mount the LIVE chip in the top bar next to the DRO chip

   All four are insertions and none inserts another's anchor, so order is free;
   they are still listed in file order for readability. */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = "src/App.jsx";
const MODULE = "src/live-input.jsx";

if (!existsSync(FILE)) { console.log("MISS  " + FILE + " not found - run from the repo root - ABORT"); process.exit(1); }
if (!existsSync(MODULE)) { console.log("MISS  " + MODULE + " not found - move it into src/ first - ABORT"); process.exit(1); }

let src = readFileSync(FILE, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.includes("./live-input.jsx")) {
  console.log("SKIP  patch-live-input already applied (sentinel found)");
  process.exit(0);
}

const vm = src.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
console.log("INFO  app version from repo: " + vm[1]);

const edits = [
  {
    name: "import LiveInput",
    old: 'import DroPanel from "./dro.jsx";\n',
    neu: 'import DroPanel from "./dro.jsx";\nimport LiveInput from "./live-input.jsx";\n',
  },
  {
    name: "setParamsMulti (batched channel write)",
    old: "  const setParam = (id, key, val) =>\n"
      + "    setNodesL((ns) => ns.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: val } } : n)));\n",
    neu: "  const setParam = (id, key, val) =>\n"
      + "    setNodesL((ns) => ns.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: val } } : n)));\n"
      + "  /* batched sibling of setParam: a live-input frame writes every channel at once */\n"
      + "  const setParamsMulti = (id, obj) =>\n"
      + "    setNodesL((ns) => ns.map((n) => (n.id === id ? { ...n, params: { ...n.params, ...obj } } : n)));\n",
  },
  {
    name: "undo-history gate for live gestures",
    old: "  useEffect(() => {\n"
      + "    const h = histRef.current;\n"
      + "    if (h.applying) { h.applying = false; prevRootRef.current = root; return; }\n"
      + "    if (prevRootRef.current !== root) {\n",
    neu: "  useEffect(() => {\n"
      + "    const h = histRef.current;\n"
      + "    if (h.applying) { h.applying = false; prevRootRef.current = root; return; }\n"
      + "    /* live input (Controller): ONE undo step per gesture. The 400 ms\n"
      + "       coalescing below is far too short for a continuous stream and would\n"
      + "       flush real history out of the 60-entry buffer. live-input.jsx raises\n"
      + "       h.live while a gesture runs and drops it after the quiet period. */\n"
      + "    if (h.live) {\n"
      + "      if (!h.liveOpen && prevRootRef.current !== root) {\n"
      + "        h.past.push(prevRootRef.current);\n"
      + "        if (h.past.length > 60) h.past.shift();\n"
      + "        h.future = [];\n"
      + "        h.liveOpen = true;\n"
      + "        setHistLens([h.past.length, 0]);\n"
      + "      }\n"
      + "      prevRootRef.current = root;\n"
      + "      return;\n"
      + "    }\n"
      + "    if (prevRootRef.current !== root) {\n",
  },
  {
    name: "mount the LIVE chip in the top bar",
    old: "        <DroPanel url={prof.moonrakerUrl} />\n",
    neu: "        <DroPanel url={prof.moonrakerUrl} />\n"
      + "        <LiveInput nodes={lvl.nodes} selIds={selIds} setParam={setParam} setParams={setParamsMulti} histRef={histRef} />\n",
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
