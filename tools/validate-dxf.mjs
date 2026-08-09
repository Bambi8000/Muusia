#!/usr/bin/env node
/* validate-dxf.mjs — oracles for the toDXF R12 exporter.
   toDXF lives inside src/App.jsx (engine-bound, next to toSVG), so the
   validator extracts the function source by brace matching and instantiates it
   with the real PENS from src/defs/helpers.js. Run from the repo root:
     node tools/validate-dxf.mjs */
import fs from "node:fs";
import { PENS } from "../src/defs/helpers.js";

const src = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const start = src.indexOf("function toDXF(");
if (start < 0) { console.error("FAIL: function toDXF not found in src/App.jsx"); process.exitCode = 1; process.exit(); }
let depth = 0, end = -1;
for (let i = start; i < src.length; i++) {
  const ch = src[i];
  if (ch === "{") depth++;
  else if (ch === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
const toDXF = new Function("PENS", `return (${src.slice(start, end).replace("function toDXF", "function")});`)(PENS);

let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
};

/* group-code pair parser */
const parse = (text) => {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  if (lines.length % 2 !== 0) return null;
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) pairs.push([Number(lines[i]), lines[i + 1]]);
  return pairs;
};

const ctx = { W: 300, H: 200 };
const ps = {
  paths: [
    { pts: [[10, 20], [110, 20], [110, 120], [10, 120]], closed: true, layer: 0 },  /* square */
    { pts: [[0, 200], [50, 137.5]], closed: false, layer: 3 },                       /* touches y=H -> flipped y hits 0 */
    { pts: [[5, 5, -1.2], [25, 5, -1.2], [25, 25, -1.2]], closed: false, layer: 11 },/* carries z (plunge) */
    { pts: [[42, 42]], closed: false, layer: 5 },                                    /* degenerate: must be skipped */
  ],
};

const text = toDXF(ps, ctx);
const pairs = parse(text);
check("even group-code/value pair stream", !!pairs);
if (!pairs) { console.log("\n1 FAILURE(S)"); process.exitCode = 1; process.exit(); }

/* 1. determinism */
check("determinism (double run identical)", text === toDXF(ps, ctx));

/* 2. skeleton */
{
  const seq = pairs.filter(([c]) => c === 0).map(([, v]) => v);
  check("ends with EOF", seq[seq.length - 1] === "EOF");
  const sections = seq.filter((v) => v === "SECTION").length;
  const endsecs = seq.filter((v) => v === "ENDSEC").length;
  check("SECTION/ENDSEC balanced (3 each)", sections === 3 && endsecs === 3, `${sections}/${endsecs}`);
  check("LTYPE CONTINUOUS present", text.includes("CONTINUOUS"));
  check("AC1009 (R12) header", text.includes("AC1009"));
}

/* 3. EXTMIN/EXTMAX */
{
  const i = pairs.findIndex(([c, v]) => c === 9 && v === "$EXTMAX");
  const ok = i >= 0 && pairs[i + 1][1] === "300" && pairs[i + 2][1] === "200";
  check("EXTMAX = canvas W,H", ok);
}

/* 4. entity counts: 3 drawable paths -> 3 POLYLINE + 3 SEQEND, degenerate skipped */
{
  const zeros = pairs.filter(([c]) => c === 0).map(([, v]) => v);
  const np = zeros.filter((v) => v === "POLYLINE").length;
  const ns = zeros.filter((v) => v === "SEQEND").length;
  const nv = zeros.filter((v) => v === "VERTEX").length;
  check("POLYLINE count = drawable paths (degenerate skipped)", np === 3, `${np}`);
  check("SEQEND per POLYLINE", ns === 3, `${ns}`);
  check("VERTEX count = total points", nv === 4 + 2 + 3, `${nv}`);
}

/* 5. per-polyline checks: layer name, closed flag, vertex roundtrip with y flip, z ignored */
{
  /* walk entities */
  const ents = [];
  let cur = null;
  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];
    if (c === 0 && v === "POLYLINE") { cur = { layer: null, closed: null, verts: [] }; ents.push(cur); }
    else if (c === 0 && v === "SEQEND") cur = null;
    else if (cur && c === 8 && cur.layer === null) cur.layer = v;
    else if (cur && c === 70 && cur.closed === null) cur.closed = Number(v);
    else if (cur && c === 0 && v === "VERTEX") {
      const x = Number(pairs[i + 2][1]), y = Number(pairs[i + 3][1]), z = Number(pairs[i + 4][1]);
      cur.verts.push([x, y, z]);
    }
  }
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const e0 = ents[0], e1 = ents[1], e2 = ents[2];
  check("layers PEN_0 / PEN_3 / PEN_11", e0.layer === "PEN_0" && e1.layer === "PEN_3" && e2.layer === "PEN_11");
  check("closed square 70=1, open paths 70=0", e0.closed === 1 && e1.closed === 0 && e2.closed === 0);
  const rt = ps.paths[0].pts.every((p, i) => near(e0.verts[i][0], p[0]) && near(e0.verts[i][1], ctx.H - p[1]));
  check("square vertices roundtrip with y flip", rt);
  check("vertex z always 0 (plunge z ignored)", ents.every((e) => e.verts.every((v) => v[2] === 0)));
  check("y = H flips to exactly 0, never -0", near(e1.verts[0][1], 0) && !text.includes("-0\n"));
}

/* 6. LAYER table: entry per used layer, ACI in 1..255 */
{
  const used = ["PEN_0", "PEN_3", "PEN_11"];
  const tbl = [];
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] === 0 && pairs[i][1] === "LAYER") {
      const name = pairs[i + 1][1];
      const aci = Number(pairs.slice(i, i + 6).find(([c]) => c === 62)?.[1]);
      tbl.push([name, aci]);
    }
  }
  check("LAYER table = exactly the drawable pen layers", used.every((u) => tbl.some(([n]) => n === u)) && tbl.length === used.length, JSON.stringify(tbl));
  check("layer ACI colors are integers in 1..255", tbl.every(([, a]) => Number.isInteger(a) && a >= 1 && a <= 255));
}

/* 7. module-scope + toSVG integrity: toDXF must sit OUTSIDE toSVG (the original
      dxf patch nested it inside toSVG's return array, where the following
      template literal became a tagged-template call — valid syntax, runtime
      corpse), and toSVG must still run and produce an SVG document */
{
  const s0 = src.indexOf("function toSVG(");
  let d2 = 0, e2 = -1;
  for (let i = s0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") d2++;
    else if (ch === "}") { d2--; if (d2 === 0) { e2 = i + 1; break; } }
  }
  const svgSrc = src.slice(s0, e2);
  check("toDXF is NOT nested inside toSVG", !svgSrc.includes("toDXF"));
  check("toDXF sits after toSVG at module scope", start > e2);
  try {
    const toSVG = new Function("PENS", `return (${svgSrc.replace("function toSVG", "function")});`)(PENS);
    const out = toSVG({ paths: [{ pts: [[0, 0], [10, 10]], closed: false, layer: 0 }] }, { W: 300, H: 200 });
    check("toSVG smoke: returns an SVG document", typeof out === "string" && out.startsWith("<?xml") && out.includes("</svg>"));
  } catch (err) {
    check("toSVG smoke: returns an SVG document", false, err.message);
  }
}

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
