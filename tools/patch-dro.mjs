#!/usr/bin/env node
/* Wire the Moonraker DRO panel into App.jsx.
   Anchored string replacement with OK/MISS reporting; writes only if ALL
   anchors match exactly once. Run from the repo root:
     node tools/patch-dro.mjs
   Requires src/dro.jsx to exist (copy it in first). */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = "src/App.jsx";
if (!existsSync("src/dro.jsx")) {
  console.error("MISS  src/dro.jsx not found — copy the DRO module in first.");
  process.exit(1);
}
let src = readFileSync(FILE, "utf8");

const edits = [
  {
    name: "E1 import DroPanel",
    find: `from "./defs/helpers.js";`,
    replace: `from "./defs/helpers.js";\nimport DroPanel from "./dro.jsx";`,
  },
  {
    name: "E2 moonrakerUrl in DEFAULT_MACHINE",
    find: `laserOnCmd: "SET_PIN PIN=laser VALUE=1", laserOffCmd: "SET_PIN PIN=laser VALUE=0",`,
    replace: `laserOnCmd: "SET_PIN PIN=laser VALUE=1", laserOffCmd: "SET_PIN PIN=laser VALUE=0",\n    moonrakerUrl: "ws://192.168.0.57:7125/websocket",`,
  },
  {
    name: "E3 mount DroPanel in top bar",
    find: `<span style={{ color: T.dim, fontWeight: 500, fontSize: 11, marginLeft: 8 }}>{"v" + APP_VERSION}</span>\n        </div>`,
    replace: `<span style={{ color: T.dim, fontWeight: 500, fontSize: 11, marginLeft: 8 }}>{"v" + APP_VERSION}</span>\n        </div>\n        <DroPanel url={prof.moonrakerUrl} />`,
  },
  {
    name: "E4 Moonraker URL field in machine profile",
    find: `<div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.05em", margin: "10px 0 4px" }}>Z MODE</div>`,
    replace: `<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Moonraker WS URL</div>
                  <input type="text" value={prof.moonrakerUrl || ""} onChange={(e) => setProf((pr) => ({ ...pr, moonrakerUrl: e.target.value }))}
                    placeholder="ws://192.168.0.57:7125/websocket"
                    style={{ flex: 1, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                </div>
                <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.05em", margin: "10px 0 4px" }}>Z MODE</div>`,
  },
];

let ok = true;
for (const e of edits) {
  const n = src.split(e.find).length - 1;
  if (n !== 1) {
    console.error(`MISS  ${e.name} — anchor found ${n}x (expected 1)`);
    ok = false;
  }
}
if (!ok) {
  console.error("No changes written.");
  process.exit(1);
}
for (const e of edits) {
  src = src.replace(e.find, e.replace);
  console.log(`OK    ${e.name}`);
}
writeFileSync(FILE, src);
console.log(`Wrote ${FILE}. Next: npm run build (syntax gate), then npm run dev and click the DRO chip in the top bar.`);
