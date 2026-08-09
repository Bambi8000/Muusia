#!/usr/bin/env node
/* patch-mega-roll.mjs — one-shot era patch: Mega Canvas "Roll" kind (wallpaper mode).
   Adds sliceRoll (strips of fixed roll width, seamless pieces along the roll,
   registration ticks + S/P labels), roll state + UI, per-tile W/H in export,
   jig split, patch save/load fields. Run ONCE from the repo root:
     node tools/era/patch-mega-roll.mjs
   Anchored exact-string replacement, OK/MISS report, re-run guard (SKIP).
   NOT idempotent — do not re-run after success. */
import fs from "node:fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("function sliceRoll")) {
  console.log("SKIP: sliceRoll already present — patch already applied, nothing to do.");
  process.exitCode = 0;
} else {
  const edits = [
    {
      name: "sliceRoll function",
      old: `/* ---- Magnet placement: grid cells, exact clearance, chamfer ranking ---- */`,
      neu: `/* --- Wallpaper roll slicer: C adjacent strips of fixed roll width (seam join in X,
   Overlap = wall overlap + double-cut, Gap = hang with spacing), each strip cut into
   pieces along the roll with NO seam in Y - the roll is advanced between pieces and
   re-registered. marks: registration ticks on both roll edges at every internal piece
   boundary (piece r draws them at its bottom edge, piece r+1 redraws them at y=0 -
   after advancing the roll, align the pen/laser at y=0 with the plotted ticks).
   labels: "S{strip} P{piece}" bottom-left, mark pen. Tiles carry their own W/H (the
   last piece may be shorter) and are returned row-major like sliceMega. --- */
function sliceRoll(ps, rw, segH, C, totalLen, seam, mode, marks, markPen = 0, labels = false) {
  const gap = mode === "Gap";
  const strideX = gap ? rw + seam : rw - seam;
  const R = Math.max(1, Math.ceil(totalLen / Math.max(1, segH)));
  const tiles = [];
  for (let r = 0; r < R; r++) {
    const y0 = r * segH;
    const th = Math.min(segH, totalLen - y0);
    for (let c = 0; c < C; c++) {
      const x0 = c * strideX;
      const clipSeg = (ax, ay, bx, by) => {
        let t0 = 0, t1 = 1;
        const dx = bx - ax, dy = by - ay;
        const P = [-dx, dx, -dy, dy];
        const Q = [ax - x0, x0 + rw - ax, ay - y0, y0 + th - ay];
        for (let i = 0; i < 4; i++) {
          if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return null; }
          else {
            const rr = Q[i] / P[i];
            if (P[i] < 0) { if (rr > t1) return null; if (rr > t0) t0 = rr; }
            else { if (rr < t0) return null; if (rr < t1) t1 = rr; }
          }
        }
        return [ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1, t1];
      };
      const paths = [];
      for (const pa of ps.paths) {
        const allIn = pa.pts.every(([x, y]) => x >= x0 && x <= x0 + rw && y >= y0 && y <= y0 + th);
        if (allIn) {
          paths.push({ pts: pa.pts.map(([x, y]) => [x - x0, y - y0]), closed: pa.closed, layer: pa.layer });
          continue;
        }
        const src = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: pa.layer }); run = []; };
        for (let i = 1; i < src.length; i++) {
          const cseg = clipSeg(src[i - 1][0], src[i - 1][1], src[i][0], src[i][1]);
          if (!cseg) { flush(); continue; }
          const A = [cseg[0] - x0, cseg[1] - y0], B = [cseg[2] - x0, cseg[3] - y0];
          if (run.length && Math.hypot(run[run.length - 1][0] - A[0], run[run.length - 1][1] - A[1]) < 1e-6) {
            run.push(B);
          } else {
            flush();
            run = [A, B];
          }
          if (cseg[4] < 1) flush(); /* exited the piece mid-segment */
        }
        flush();
      }
      if (marks) {
        const LP = Math.max(0, Math.round(markPen));
        const MK = 4;
        const tick = (y) => {
          paths.push({ pts: [[0, y], [MK, y]], closed: false, layer: LP });
          paths.push({ pts: [[rw - MK, y], [rw, y]], closed: false, layer: LP });
        };
        if (r > 0) tick(0);
        if (r < R - 1) tick(th);
      }
      if (labels) {
        const LP = Math.max(0, Math.round(markPen));
        const txt = "S" + (c + 1) + " P" + (r + 1);
        const fsx = fontStrokes(txt, 4, 1);
        for (const st of fsx.strokes) {
          paths.push({ pts: st.map(([gx, gy]) => [6 + gx, th - 11 + gy]), closed: false, layer: LP });
        }
      }
      tiles.push({ paths, W: rw, H: th });
    }
  }
  return tiles;
}

/* ---- Magnet placement: grid cells, exact clearance, chamfer ranking ---- */`,
    },
    {
      name: "roll state",
      old: `  const [megaMarkPen, setMegaMarkPen] = useState(0); /* own pen for marks: pencil / fine liner */`,
      neu: `  const [megaMarkPen, setMegaMarkPen] = useState(0); /* own pen for marks: pencil / fine liner */
  const [megaKind, setMegaKind] = useState("Sheets"); /* Sheets: grid of paper sheets | Roll: wallpaper strips */
  const [rollW, setRollW] = useState(530);         /* wallpaper roll width mm */
  const [rollLen, setRollLen] = useState(2400);    /* strip length mm (e.g. wall height) */
  const [rollStrips, setRollStrips] = useState(2); /* adjacent strips */
  const [rollSeg, setRollSeg] = useState(800);     /* plotted piece length per machine setup mm */`,
    },
    {
      name: "mega dims + cols/rows",
      old: `  const megaW = megaOn ? (megaMode === "Gap" ? megaC * canvasW + (megaC - 1) * megaSeam : megaC * canvasW - (megaC - 1) * megaSeam) : canvasW;
  const megaH = megaOn ? (megaMode === "Gap" ? megaR * canvasH + (megaR - 1) * megaSeam : megaR * canvasH - (megaR - 1) * megaSeam) : canvasH;`,
      neu: `  const megaRoll = megaOn && megaKind === "Roll";
  const rollPieces = Math.max(1, Math.ceil(rollLen / Math.max(1, rollSeg)));
  const megaCols = megaRoll ? rollStrips : megaC;
  const megaRows = megaRoll ? rollPieces : megaR;
  const megaW = megaOn
    ? (megaRoll
      ? (megaMode === "Gap" ? rollStrips * rollW + (rollStrips - 1) * megaSeam : rollStrips * rollW - (rollStrips - 1) * megaSeam)
      : (megaMode === "Gap" ? megaC * canvasW + (megaC - 1) * megaSeam : megaC * canvasW - (megaC - 1) * megaSeam))
    : canvasW;
  const megaH = megaOn ? (megaRoll ? rollLen : (megaMode === "Gap" ? megaR * canvasH + (megaR - 1) * megaSeam : megaR * canvasH - (megaR - 1) * megaSeam)) : canvasH;`,
    },
    {
      name: "megaTiles + tileTag",
      old: `  const megaTiles = () => sliceMega(exportPS(), canvasW, canvasH, megaC, megaR, megaSeam, megaMode, megaMarks, megaMarkPen, megaLabels);`,
      neu: `  const megaTiles = () => megaRoll
    ? sliceRoll(exportPS(), rollW, rollSeg, rollStrips, rollLen, megaSeam, megaMode, megaMarks, megaMarkPen, megaLabels)
    : sliceMega(exportPS(), canvasW, canvasH, megaC, megaR, megaSeam, megaMode, megaMarks, megaMarkPen, megaLabels).map((t) => ({ ...t, W: canvasW, H: canvasH }));
  const tileTag = (i) => {
    const rr = Math.floor(i / megaCols) + 1, cc = (i % megaCols) + 1;
    return megaRoll
      ? \`strip-\${String(cc).padStart(2, "0")}-piece-\${String(rr).padStart(2, "0")}\`
      : \`tile-\${String(i + 1).padStart(2, "0")}-r\${rr}c\${cc}\`;
  };`,
    },
    {
      name: "auto-jig mega branch",
      old: `        const dx = megaMode === "Gap" ? canvasW + megaSeam : canvasW - megaSeam;
        const dy = megaMode === "Gap" ? canvasH + megaSeam : canvasH - megaSeam;
        megaTiles().forEach((t, i) => {
          const rr = Math.floor(i / megaC), cc = i % megaC;
          const r = magnetPlacement(t, canvasW, canvasH, opts);
          for (const q of r.positions) gs.push([cc * dx + q[0], rr * dy + q[1]]);
        });`,
      neu: `        const dx = megaRoll ? (megaMode === "Gap" ? rollW + megaSeam : rollW - megaSeam) : (megaMode === "Gap" ? canvasW + megaSeam : canvasW - megaSeam);
        const dy = megaRoll ? rollSeg : (megaMode === "Gap" ? canvasH + megaSeam : canvasH - megaSeam);
        megaTiles().forEach((t, i) => {
          const rr = Math.floor(i / megaCols), cc = i % megaCols;
          const r = magnetPlacement(t, t.W ?? canvasW, t.H ?? canvasH, opts);
          for (const q of r.positions) gs.push([cc * dx + q[0], rr * dy + q[1]]);
        });`,
    },
    {
      name: "megaPreview",
      old: `  const megaPreview = (kind) => {
    const tiles = megaTiles();
    const sheetCtx = { W: canvasW, H: canvasH, frameIdx, frameCount };
    const note = \`MEGA CANVAS \\u2014 previewing tile 1/\${tiles.length}. Download saves all \${tiles.length} numbered tiles.\`;
    return kind === "svg"
      ? toSVG(tiles[0], sheetCtx).replace("?>\\n", \`?>\\n<!-- \${note} -->\\n\`)
      : \`; \${note}\\n\` + toGcode(tiles[0], sheetCtx, prof);
  };`,
      neu: `  const megaPreview = (kind) => {
    const tiles = megaTiles();
    const t0 = tiles[0];
    const sheetCtx = { W: t0.W ?? canvasW, H: t0.H ?? canvasH, frameIdx, frameCount };
    const note = megaRoll
      ? \`MEGA CANVAS ROLL \\u2014 previewing strip 1 piece 1. Download saves all \${tiles.length} pieces (\${rollStrips} strips \\u00d7 \${rollPieces}).\`
      : \`MEGA CANVAS \\u2014 previewing tile 1/\${tiles.length}. Download saves all \${tiles.length} numbered tiles.\`;
    return kind === "svg"
      ? toSVG(t0, sheetCtx).replace("?>\\n", \`?>\\n<!-- \${note} -->\\n\`)
      : \`; \${note}\\n\` + toGcode(t0, sheetCtx, prof);
  };`,
    },
    {
      name: "downloadMega files",
      old: `    const sheetCtx = { W: canvasW, H: canvasH, frameIdx, frameCount };
    const files = tiles.map((t, i) => {
      const rr = Math.floor(i / megaC) + 1, cc = (i % megaC) + 1;
      return {
        name: \`\${projName || "patch"}-tile-\${String(i + 1).padStart(2, "0")}-r\${rr}c\${cc}\${kind === "svg" ? ".svg" : ".gcode"}\`,
        text: kind === "svg" ? toSVG(t, sheetCtx) : toGcode(t, sheetCtx, prof)
      };
    });`,
      neu: `    const files = tiles.map((t, i) => {
      const sheetCtx = { W: t.W ?? canvasW, H: t.H ?? canvasH, frameIdx, frameCount };
      return {
        name: \`\${projName || "patch"}-\${tileTag(i)}\${kind === "svg" ? ".svg" : ".gcode"}\`,
        text: kind === "svg" ? toSVG(t, sheetCtx) : toGcode(t, sheetCtx, prof)
      };
    });`,
    },
    {
      name: "jig manual mega branch",
      old: `        const dx = megaMode === "Gap" ? canvasW + megaSeam : canvasW - megaSeam;
        const dy = megaMode === "Gap" ? canvasH + megaSeam : canvasH - megaSeam;
        const perTile = Array.from({ length: megaC * megaR }, () => []);
        for (const [x, y] of manualMags) {
          const cc = Math.max(0, Math.min(megaC - 1, Math.floor(x / dx)));
          const rr = Math.max(0, Math.min(megaR - 1, Math.floor(y / dy)));
          const lx = Math.max(0, Math.min(canvasW, x - cc * dx));
          const ly = Math.max(0, Math.min(canvasH, y - rr * dy));
          perTile[rr * megaC + cc].push([Math.round(lx * 10) / 10, Math.round(ly * 10) / 10]);
        }
        perTile.forEach((pos, i) => {
          if (!pos.length) return;
          const rr = Math.floor(i / megaC) + 1, cc = (i % megaC) + 1;
          const g = jigGcode(pos, prof, canvasW, canvasH, \`manual - tile \${i + 1}/\${megaC * megaR} r\${rr}c\${cc}\`);
          g.warnings.forEach((w) => notes.push(\`tile \${i + 1}: \${w}\`));
          files.push({ name: \`\${projName || "patch"}-tile-\${String(i + 1).padStart(2, "0")}-r\${rr}c\${cc}-jig.gcode\`, text: g.text });
        });`,
      neu: `        const tileW = megaRoll ? rollW : canvasW;
        const dx = megaMode === "Gap" ? tileW + megaSeam : tileW - megaSeam;
        const dy = megaRoll ? rollSeg : (megaMode === "Gap" ? canvasH + megaSeam : canvasH - megaSeam);
        const rowH = (rr) => megaRoll ? Math.min(rollSeg, rollLen - rr * rollSeg) : canvasH;
        const perTile = Array.from({ length: megaCols * megaRows }, () => []);
        for (const [x, y] of manualMags) {
          const cc = Math.max(0, Math.min(megaCols - 1, Math.floor(x / dx)));
          const rr = Math.max(0, Math.min(megaRows - 1, Math.floor(y / dy)));
          const lx = Math.max(0, Math.min(tileW, x - cc * dx));
          const ly = Math.max(0, Math.min(rowH(rr), y - rr * dy));
          perTile[rr * megaCols + cc].push([Math.round(lx * 10) / 10, Math.round(ly * 10) / 10]);
        }
        perTile.forEach((pos, i) => {
          if (!pos.length) return;
          const rr = Math.floor(i / megaCols);
          const g = jigGcode(pos, prof, tileW, rowH(rr), \`manual - \${tileTag(i)} (\${i + 1}/\${megaCols * megaRows})\`);
          g.warnings.forEach((w) => notes.push(\`tile \${i + 1}: \${w}\`));
          files.push({ name: \`\${projName || "patch"}-\${tileTag(i)}-jig.gcode\`, text: g.text });
        });`,
    },
    {
      name: "jig auto mega branch",
      old: `      tiles.forEach((t, i) => {
        const rr = Math.floor(i / megaC) + 1, cc = (i % megaC) + 1;
        const r = magnetPlacement(t, canvasW, canvasH, opts);
        if (r.error) notes.push(\`tile \${i + 1} r\${rr}c\${cc}: \${r.error}\`);
        if (r.positions.length) {
          const g = jigGcode(r.positions, prof, canvasW, canvasH, \`tile \${i + 1}/\${tiles.length} r\${rr}c\${cc}\`);
          g.warnings.forEach((w) => notes.push(\`tile \${i + 1}: \${w}\`));
          files.push({ name: \`\${projName || "patch"}-tile-\${String(i + 1).padStart(2, "0")}-r\${rr}c\${cc}-jig.gcode\`, text: g.text });
        }
      });`,
      neu: `      tiles.forEach((t, i) => {
        const r = magnetPlacement(t, t.W ?? canvasW, t.H ?? canvasH, opts);
        if (r.error) notes.push(\`tile \${i + 1} \${tileTag(i)}: \${r.error}\`);
        if (r.positions.length) {
          const g = jigGcode(r.positions, prof, t.W ?? canvasW, t.H ?? canvasH, \`\${tileTag(i)} (\${i + 1}/\${tiles.length})\`);
          g.warnings.forEach((w) => notes.push(\`tile \${i + 1}: \${w}\`));
          files.push({ name: \`\${projName || "patch"}-\${tileTag(i)}-jig.gcode\`, text: g.text });
        }
      });`,
    },
    {
      name: "patch save mega fields",
      old: `mega: megaOn ? { C: megaC, R: megaR, seam: megaSeam, mode: megaMode, marks: megaMarks, markPen: megaMarkPen, labels: megaLabels } : null`,
      neu: `mega: megaOn ? { C: megaC, R: megaR, seam: megaSeam, mode: megaMode, marks: megaMarks, markPen: megaMarkPen, labels: megaLabels, kind: megaKind, rollW, rollLen, rollStrips, rollSeg } : null`,
    },
    {
      name: "patch load mega fields",
      old: `setMegaLabels(!!data.mega.labels); } else { setMegaOn(false); }`,
      neu: `setMegaLabels(!!data.mega.labels); setMegaKind(data.mega.kind || "Sheets"); setRollW(data.mega.rollW || 530); setRollLen(data.mega.rollLen || 2400); setRollStrips(data.mega.rollStrips || 2); setRollSeg(data.mega.rollSeg || 800); } else { setMegaOn(false); }`,
    },
    {
      name: "UI kind select",
      old: `            {megaOn && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7, fontSize: 11, color: T.text }}>`,
      neu: `            {megaOn && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7, fontSize: 11, color: T.text }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.dim }}>Kind</span>
                  <select value={megaKind} onChange={(e) => setMegaKind(e.target.value)}
                    style={{ background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }}>
                    <option>Sheets</option>
                    <option>Roll</option>
                  </select>
                  <span style={{ color: T.dim }}>{megaKind === "Roll" ? "wallpaper strips" : "grid of sheets"}</span>
                </div>`,
    },
    {
      name: "UI sheets/roll rows",
      old: `                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.dim }}>Sheets</span>
                  <input type="number" value={megaC} min={1} max={6} onChange={(e) => setMegaC(Math.max(1, Math.min(6, Math.round(+e.target.value || 1))))}
                    style={{ width: 40, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  ×
                  <input type="number" value={megaR} min={1} max={8} onChange={(e) => setMegaR(Math.max(1, Math.min(8, Math.round(+e.target.value || 1))))}
                    style={{ width: 40, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  <span style={{ color: T.dim }}>cols × rows</span>
                </div>`,
      neu: `                {megaKind !== "Roll" && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.dim }}>Sheets</span>
                  <input type="number" value={megaC} min={1} max={6} onChange={(e) => setMegaC(Math.max(1, Math.min(6, Math.round(+e.target.value || 1))))}
                    style={{ width: 40, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  ×
                  <input type="number" value={megaR} min={1} max={8} onChange={(e) => setMegaR(Math.max(1, Math.min(8, Math.round(+e.target.value || 1))))}
                    style={{ width: 40, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  <span style={{ color: T.dim }}>cols × rows</span>
                </div>}
                {megaKind === "Roll" && <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: T.dim }}>Roll width</span>
                    <input type="number" value={rollW} min={100} max={1200} step={1} onChange={(e) => setRollW(Math.max(100, Math.min(1200, +e.target.value || 100)))}
                      style={{ width: 52, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                    <span style={{ color: T.dim }}>mm</span>
                    <span style={{ color: T.dim }}>Strips</span>
                    <input type="number" value={rollStrips} min={1} max={12} onChange={(e) => setRollStrips(Math.max(1, Math.min(12, Math.round(+e.target.value || 1))))}
                      style={{ width: 40, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: T.dim }}>Length</span>
                    <input type="number" value={rollLen} min={100} max={30000} step={10} onChange={(e) => setRollLen(Math.max(100, Math.min(30000, +e.target.value || 100)))}
                      style={{ width: 52, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                    <span style={{ color: T.dim }}>mm</span>
                    <span style={{ color: T.dim }}>Piece</span>
                    <input type="number" value={rollSeg} min={50} max={2000} step={10} onChange={(e) => setRollSeg(Math.max(50, Math.min(2000, +e.target.value || 50)))}
                      style={{ width: 52, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                    <span style={{ color: T.dim }}>mm</span>
                  </div>
                </>}`,
    },
    {
      name: "UI marks label",
      old: `                    Crop marks`,
      neu: `                    {megaKind === "Roll" ? "Registration ticks (piece boundaries)" : "Crop marks"}`,
    },
    {
      name: "UI summary",
      old: `                <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5 }}>
                  Total {megaW} × {megaH} mm · {megaC * megaR} sheets of {canvasW} × {canvasH} mm.
                  {megaMode === "Overlap" ? " Sheets repeat the seam strip — cut through it and butt-join." : " A seam-wide strip is skipped between sheets — mount with spacing."}
                  {" Export previews tile 1; Download saves all numbered tiles."}
                </div>`,
      neu: `                <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5 }}>
                  {megaKind === "Roll" ? <>
                    Total {megaW} × {megaH} mm · {rollStrips} strip(s) × {rollPieces} piece(s) of {rollW} × {rollSeg} mm (last piece {Math.round((rollLen - (rollPieces - 1) * rollSeg) * 10) / 10} mm).
                    {megaMode === "Overlap" ? " Adjacent strips repeat the seam strip — overlap on the wall and double-cut." : " A seam-wide strip is skipped between strips — hang with spacing."}
                    {" Pieces continue seamlessly along the roll: registration ticks mark every boundary — advance the roll, align the pen at y=0 with the plotted ticks."}
                    {(rollW > prof.workW || rollSeg > prof.workH) ? " ⚠ Piece exceeds the machine work area." : ""}
                  </> : <>
                    Total {megaW} × {megaH} mm · {megaC * megaR} sheets of {canvasW} × {canvasH} mm.
                    {megaMode === "Overlap" ? " Sheets repeat the seam strip — cut through it and butt-join." : " A seam-wide strip is skipped between sheets — mount with spacing."}
                  </>}
                  {" Export previews tile 1; Download saves all numbered tiles."}
                </div>`,
    },
    {
      name: "jigs button count",
      old: `Download \${megaC * megaR} jigs (.zip)`,
      neu: `Download \${megaCols * megaRows} jigs (.zip)`,
    },
    {
      name: "tiles button count",
      old: `Download \${megaC * megaR} tiles (.zip)`,
      neu: `Download \${megaCols * megaRows} tiles (.zip)`,
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
    console.log(`\n${miss} anchor(s) MISSED — file NOT written.`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(FILE, src);
    console.log(`\nAll ${edits.length} edits applied — ${FILE} written.`);
    console.log('Sentinels: grep -c "function sliceRoll" src/App.jsx → 1 · grep -c "megaKind" src/App.jsx → >0');
  }
}
