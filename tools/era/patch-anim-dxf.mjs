/* patch-anim-dxf.mjs — DXF export for the per-frame (ANIMATE) pipeline.
 *
 * Extends exportAllFrames with kind === "dxf" (toDXF + .dxf extension; the
 * blob type already falls through to text/plain, which is correct for DXF),
 * adds a "DXF x N" button to the ANIMATE panel next to G-code/SVG, and
 * updates the Help ANIMATION bullet. Anchored, MISS aborts, idempotent.
 *   node tools/era/patch-anim-dxf.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const SENTINEL = 'exportAllFrames("dxf")';
if (src.includes(SENTINEL)) {
  console.log("SKIP  patch-anim-dxf already applied");
  process.exit(0);
}

const edits = [
  {
    name: "1 text branch",
    anchor: 'const text = kind === "svg" ? toSVG(ps, ctxF) : toGcode(ps, ctxF, prof);',
    replace: 'const text = kind === "svg" ? toSVG(ps, ctxF) : kind === "dxf" ? toDXF(ps, ctxF) : toGcode(ps, ctxF, prof);',
  },
  {
    name: "2 file extension",
    anchor: 'a.download = `${projName || "patch"}-f${String(f).padStart(3, "0")}${kind === "svg" ? ".svg" : ".gcode"}`;',
    replace: 'a.download = `${projName || "patch"}-f${String(f).padStart(3, "0")}${kind === "svg" ? ".svg" : kind === "dxf" ? ".dxf" : ".gcode"}`;',
  },
  {
    name: "3 panel button",
    anchor: '                  SVG {"\\u00D7"} {frameCount}\n                </button>',
    replace: '                  SVG {"\\u00D7"} {frameCount}\n                </button>\n                <button onClick={() => exportAllFrames("dxf")} disabled={!primaryPS.paths.length}\n                  style={{ flex: 1, padding: "5px 0", borderRadius: 4, border: `1px solid ${T.line}`, background: "transparent", color: primaryPS.paths.length ? T.text : T.dim, fontSize: 10, fontFamily: mono, cursor: "pointer" }}>\n                  DXF {"\\u00D7"} {frameCount}\n                </button>',
  },
  {
    name: "4 help bullet",
    anchor: '"\\u25B6 previews the animation live. G-code \\u00D7 N downloads one file per frame \\u2014 plot each on its own paper, scan, assemble.",',
    replace: '"\\u25B6 previews the animation live. G-code / SVG / DXF \\u00D7 N downloads one file per frame \\u2014 plot each on its own paper, scan, assemble.",',
  },
];

let fail = false;
for (const e of edits) {
  const parts = src.split(e.anchor);
  if (parts.length !== 2) { console.log(`MISS  ${e.name} (${parts.length - 1} hits)`); fail = true; }
  else console.log(`OK    ${e.name}`);
}
if (fail) { console.log("ABORT nothing written"); process.exit(1); }

for (const e of edits) {
  const parts = src.split(e.anchor);
  if (parts.length !== 2) { console.log(`ABORT ${e.name} anchor no longer unique — nothing written`); process.exit(1); }
  src = parts[0] + e.replace + parts[1];
}
writeFileSync(FILE, src);
console.log("DONE  4 edits written to src/App.jsx");
