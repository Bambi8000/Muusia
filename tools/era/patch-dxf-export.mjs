#!/usr/bin/env node
/* patch-dxf-export.mjs — one-shot era patch: DXF R12 export (laser cutting).
   Adds toDXF (POLYLINE entities on PEN_n layers, y flipped to DXF y-up,
   nearest-ACI pen colors, LTYPE/LAYER tables), an EXPORT DXF button, and the
   dxf kind through preview / download / mega tiles. Run ONCE from the repo
   root AFTER patch-mega-roll.mjs:
     node tools/era/patch-dxf-export.mjs
   Anchored exact-string replacement, OK/MISS report, re-run guard (SKIP).
   NOT idempotent — do not re-run after success. */
import fs from "node:fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("function toDXF")) {
  console.log("SKIP: toDXF already present — patch already applied, nothing to do.");
  process.exitCode = 0;
} else {
  const edits = [
    {
      name: "toDXF function",
      old: `    \`</svg>\`,
  ].join("\\n");
}

/* ============================================================
   REITTISIMULAATTORI`,
      neu: `/* --- DXF R12 export: POLYLINE entities on per-pen layers (PEN_0..PEN_11), y
   flipped to DXF's y-up so the file matches the SVG/preview orientation, mm
   units implied, layer colors as the nearest ACI match of the pen color.
   R12 with an explicit LTYPE/LAYER table = maximum laser-software
   compatibility (LightBurn, RDWorks, Inkscape). Optional point z (pen plunge)
   is ignored - laser cutting is 2D. --- */
function toDXF(ps, ctx) {
  const f3 = (v) => {
    const r = Math.round(v * 1000) / 1000;
    return Object.is(r, -0) ? "0" : String(r); /* -0 breaks naive DXF parsers and dedupe keys */
  };
  const ACI = [
    [1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255],
    [6, 255, 0, 255], [7, 0, 0, 0], [8, 128, 128, 128], [9, 192, 192, 192],
    [30, 255, 127, 0], [34, 189, 126, 94], [40, 191, 255, 0], [92, 38, 140, 89],
    [140, 61, 96, 133], [200, 142, 61, 189],
  ];
  const aciOf = (hex) => {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    let best = 7, bd = Infinity;
    for (const [code, ar, ag, ab] of ACI) {
      const d = (r - ar) * (r - ar) + (g - ag) * (g - ag) + (b - ab) * (b - ab);
      if (d < bd) { bd = d; best = code; }
    }
    return best;
  };
  const drawable = ps.paths.filter((p) => p.pts.length >= 2);
  const layers = [...new Set(drawable.map((p) => p.layer))].sort((a, b) => a - b);
  const L = [];
  const P = (code, val) => { L.push(String(code)); L.push(String(val)); };
  P(0, "SECTION"); P(2, "HEADER");
  P(9, "$ACADVER"); P(1, "AC1009");
  P(9, "$EXTMIN"); P(10, "0"); P(20, "0"); P(30, "0");
  P(9, "$EXTMAX"); P(10, f3(ctx.W)); P(20, f3(ctx.H)); P(30, "0");
  P(0, "ENDSEC");
  P(0, "SECTION"); P(2, "TABLES");
  P(0, "TABLE"); P(2, "LTYPE"); P(70, 1);
  P(0, "LTYPE"); P(2, "CONTINUOUS"); P(70, 0); P(3, "Solid line"); P(72, 65); P(73, 0); P(40, "0");
  P(0, "ENDTAB");
  P(0, "TABLE"); P(2, "LAYER"); P(70, layers.length);
  for (const li of layers) {
    const pen = PENS[li % PENS.length];
    P(0, "LAYER"); P(2, "PEN_" + li); P(70, 0); P(62, aciOf(pen.c)); P(6, "CONTINUOUS");
  }
  P(0, "ENDTAB"); P(0, "ENDSEC");
  P(0, "SECTION"); P(2, "ENTITIES");
  for (const pa of drawable) {
    const name = "PEN_" + pa.layer;
    P(0, "POLYLINE"); P(8, name); P(66, 1); P(70, pa.closed ? 1 : 0);
    for (const [x, y] of pa.pts) {
      P(0, "VERTEX"); P(8, name); P(10, f3(x)); P(20, f3(ctx.H - y)); P(30, "0");
    }
    P(0, "SEQEND"); P(8, name);
  }
  P(0, "ENDSEC"); P(0, "EOF");
  return L.join("\\n") + "\\n";
}

    \`</svg>\`,
  ].join("\\n");
}

/* ============================================================
   REITTISIMULAATTORI`,
    },
    {
      name: "doExportDXF",
      old: `  const doExportSVG = () => { setGcode(megaOn ? megaPreview("svg") : toSVG(exportPS(), ctx)); setExportKind("svg"); setCopied(false); };`,
      neu: `  const doExportSVG = () => { setGcode(megaOn ? megaPreview("svg") : toSVG(exportPS(), ctx)); setExportKind("svg"); setCopied(false); };
  const doExportDXF = () => { setGcode(megaOn ? megaPreview("dxf") : toDXF(exportPS(), ctx)); setExportKind("dxf"); setCopied(false); };`,
    },
    {
      name: "megaPreview dxf branch",
      old: `    return kind === "svg"
      ? toSVG(t0, sheetCtx).replace("?>\\n", \`?>\\n<!-- \${note} -->\\n\`)
      : \`; \${note}\\n\` + toGcode(t0, sheetCtx, prof);`,
      neu: `    if (kind === "dxf") return \`999\\n\${note}\\n\` + toDXF(t0, sheetCtx);
    return kind === "svg"
      ? toSVG(t0, sheetCtx).replace("?>\\n", \`?>\\n<!-- \${note} -->\\n\`)
      : \`; \${note}\\n\` + toGcode(t0, sheetCtx, prof);`,
    },
    {
      name: "downloadMega dxf branch",
      old: `        name: \`\${projName || "patch"}-\${tileTag(i)}\${kind === "svg" ? ".svg" : ".gcode"}\`,
        text: kind === "svg" ? toSVG(t, sheetCtx) : toGcode(t, sheetCtx, prof)`,
      neu: `        name: \`\${projName || "patch"}-\${tileTag(i)}\${kind === "svg" ? ".svg" : kind === "dxf" ? ".dxf" : ".gcode"}\`,
        text: kind === "svg" ? toSVG(t, sheetCtx) : kind === "dxf" ? toDXF(t, sheetCtx) : toGcode(t, sheetCtx, prof)`,
    },
    {
      name: "download extension",
      old: `      a.download = (projName || "patch") + (exportKind === "svg" ? ".svg" : ".gcode");`,
      neu: `      a.download = (projName || "patch") + (exportKind === "svg" ? ".svg" : exportKind === "dxf" ? ".dxf" : ".gcode");`,
    },
    {
      name: "panel header kind",
      old: `{exportKind === "svg" ? "SVG" : "G-CODE"}`,
      neu: `{exportKind === "svg" ? "SVG" : exportKind === "dxf" ? "DXF" : "G-CODE"}`,
    },
    {
      name: "download button ext",
      old: `Download \${exportKind === "svg" ? ".svg" : ".gcode"}`,
      neu: `Download \${exportKind === "svg" ? ".svg" : exportKind === "dxf" ? ".dxf" : ".gcode"}`,
    },
    {
      name: "DXF export button",
      old: `              EXPORT SVG (laser / vector)
            </button>`,
      neu: `              EXPORT SVG (laser / vector)
            </button>
            <button onClick={doExportDXF} disabled={!primaryPS.paths.length}
              style={{
                width: "100%", marginTop: 6, padding: "7px 0", borderRadius: 5,
                border: \`1px solid \${primaryPS.paths.length ? T.accent : T.line}\`,
                background: "transparent", color: primaryPS.paths.length ? T.accent : T.dim,
                fontFamily: disp, fontWeight: 700, fontSize: 11, cursor: primaryPS.paths.length ? "pointer" : "default", letterSpacing: "0.03em",
              }}>
              EXPORT DXF (laser cut, R12)
            </button>`,
    },
  ];
  let miss = 0;
  for (const e of edits) {
    const n = src.split(e.old).length - 1;
    if (n !== 1) {
      console.log(`MISS (${n} matches): ${e.name}`);
      miss++;
      continue;
    }
    src = src.replace(e.old, e.neu);
    console.log(`OK: ${e.name}`);
  }
  if (miss) {
    console.log(`\n${miss} anchor(s) MISSED — file NOT written. Requires the patch-mega-roll.mjs state (tileTag).`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(FILE, src);
    console.log(`\nAll ${edits.length} edits applied — ${FILE} written.`);
    console.log('Sentinels: grep -c "function toDXF" src/App.jsx → 1 · grep -c "doExportDXF" src/App.jsx → 2');
  }
}
