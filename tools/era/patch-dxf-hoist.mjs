#!/usr/bin/env node
/* patch-dxf-hoist.mjs — one-shot REPAIR patch for patch-dxf-export.mjs, which
   inserted the toDXF function INSIDE toSVG's return array (syntactically valid
   JS — the following `</svg>` template literal became a tagged-template call on
   the function expression — so the build passed while toSVG threw at runtime
   and toDXF vanished from module scope: SVG and DXF exports both died, G-code
   untouched). This moves the toDXF block to AFTER toSVG's closing brace.
   Run ONCE from the repo root:
     node tools/era/patch-dxf-hoist.mjs
   Re-run guard: SKIP when toDXF already sits after toSVG. NOT idempotent. */
import fs from "node:fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

const iDxf = src.indexOf("/* --- DXF R12 export:");
const iSvgEnd = src.indexOf("    `</svg>`,");
if (iDxf < 0) {
  console.log("MISS: toDXF block not found — run patch-dxf-export.mjs first.");
  process.exitCode = 1;
} else if (iSvgEnd >= 0 && iDxf > iSvgEnd) {
  console.log("SKIP: toDXF already after toSVG — repair already applied.");
  process.exitCode = 0;
} else {
  const chunk = src.slice(iDxf, iSvgEnd);
  if (!chunk.includes("function toDXF") || !chunk.endsWith("}\n\n")) {
    console.log("MISS: unexpected toDXF block shape — file NOT written.");
    process.exitCode = 1;
  } else {
    src = src.slice(0, iDxf) + src.slice(iSvgEnd);
    const ANCHOR = "  ].join(\"\\n\");\n}\n\n/* ============================================================\n   REITTISIMULAATTORI";
    const n = src.split(ANCHOR).length - 1;
    if (n !== 1) {
      console.log(`MISS (${n} matches): toSVG end anchor — file NOT written.`);
      process.exitCode = 1;
    } else {
      src = src.replace(ANCHOR, "  ].join(\"\\n\");\n}\n\n" + chunk + "/* ============================================================\n   REITTISIMULAATTORI");
      fs.writeFileSync(FILE, src);
      console.log("OK: toDXF hoisted out of toSVG — src/App.jsx written.");
      console.log("Sentinel: node tools/validate-dxf.mjs must PASS incl. the new toSVG smoke oracles.");
    }
  }
}
