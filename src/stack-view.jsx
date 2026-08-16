/* stack-view.jsx — 3D layer stack preview + physical export (Stack View).
 *
 * A full-screen overlay for layered physical pieces: the drawing is split
 * into sheets (animation frames or pens) and the sheets are stacked in 3D
 * as translucent plexi/glass panes. Drag to rotate, adjust sheet spacing
 * (mm), flip stacking order, toggle individual sheets, auto-orbit.
 *
 * Two sheet sources:
 *   - Frames: the graph is re-evaluated per frame (same mechanism as the
 *     "all frames" export) — each frame becomes one sheet. Capped at 48.
 *   - Pens:   one evaluation, split by pen index — each used pen is a sheet.
 *
 * Rendering: each sheet is drawn ONCE onto its own transparent canvas
 * (cached), and the stack is posed with CSS 3D transforms (perspective +
 * rotateX/rotateY + per-sheet translateZ). Rotating the view never
 * re-evaluates the graph — only a CSS transform changes.
 *
 * PHYSICAL EXPORT (v2): per-sheet files as ONE ZIP (no browser
 * multi-download permission needed) in SVG / DXF / G-code. Transforms:
 *   - Sheet margin (mm): the physical sheet is canvas + margin per edge;
 *     art is translated inward, marks live in the margin zone.
 *   - Mirror: for painting/engraving the sheet BACK — the plot file is
 *     mirrored so the piece reads correct from the front. The 3D preview
 *     always shows the front view.
 *   - Drill marks: M3/M4/M5 clearance circles (3.2/4.3/5.3 mm) at a
 *     corner inset, identical on every sheet, on the Mark pen.
 *   - Sheet numbers: SFONT "n/N" near the bottom-left corner, Mark pen.
 * Preview shows margin, drill marks and numbers live (unmirrored).
 * Hidden sheets are a preview aid only — export always writes all sheets.
 *
 * Self-contained: React only; everything else (PENS, theme tokens, canvas
 * size, frameCount, primaryPS, evalFrame, exportText, buildZip, projName,
 * fontStrokes) is injected via props from App.jsx — this module never
 * touches the engine. Wired by tools/era/patch-stack-view.mjs +
 * tools/era/patch-stack-export.mjs.
 *
 * Mega Canvas and the stack do not combine: single-sheet canvas only.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";

export const MAX_SHEETS = 48;          /* hard cap on stacked sheets */
export const DRAW_BUDGET = 120000;     /* max points drawn per sheet canvas */

/* @pure-begin splitByPens */
function splitByPens(ps) {
  /* group paths by pen index; pens sorted ascending, path order preserved
     within each pen; never mutates the input */
  const byPen = new Map();
  const paths = (ps && ps.paths) || [];
  for (const p of paths) {
    const pen = ((p.layer ?? 0) % 12 + 12) % 12;
    if (!byPen.has(pen)) byPen.set(pen, []);
    byPen.get(pen).push(p);
  }
  return [...byPen.keys()].sort((a, b) => a - b)
    .map((pen) => ({ pen, ps: { paths: byPen.get(pen) } }));
}
/* @pure-end */

/* @pure-begin sheetZ */
function sheetZ(i, n, gapMm, reverse) {
  /* z offset (mm) of sheet i in a stack of n, centered on the stack middle
     so rotation pivots around the stack, not around sheet 0 */
  const k = reverse ? (n - 1 - i) : i;
  return (k - (n - 1) / 2) * gapMm;
}
/* @pure-end */

export const DRILL_DIA = { M3: 3.2, M4: 4.3, M5: 5.3 };  /* clearance holes, mm */

/* @pure-begin mirrorX */
function mirrorX(ps, W) {
  /* horizontal mirror across the sheet width for back-painting; preserves
     the optional z (plunge depth) component; never mutates the input */
  return { paths: ((ps && ps.paths) || []).map((p) => ({
    ...p, pts: p.pts.map((pt) => [W - pt[0], ...pt.slice(1)]),
  })) };
}
/* @pure-end */

/* @pure-begin translatePS */
function translatePS(ps, dx, dy) {
  /* translate all points; preserves the optional z component; no mutation */
  return { paths: ((ps && ps.paths) || []).map((p) => ({
    ...p, pts: p.pts.map((pt) => [pt[0] + dx, pt[1] + dy, ...pt.slice(2)]),
  })) };
}
/* @pure-end */

/* @pure-begin drillMarks */
function drillMarks(W, H, inset, dia, pen) {
  /* four clearance circles at the sheet corners, identical on every sheet */
  const r = dia / 2, out = [];
  for (const [cx, cy] of [[inset, inset], [W - inset, inset], [W - inset, H - inset], [inset, H - inset]]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    out.push({ pts, closed: true, layer: pen });
  }
  return out;
}
/* @pure-end */

function drawSheet(canvas, ps, W, H, PENS, dispW, dispH) {
  /* one-time render of a sheet onto its transparent canvas; returns true
     if the point budget truncated the drawing */
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  canvas.width = Math.round(dispW * dpr);
  canvas.height = Math.round(dispH * dpr);
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  const s = (dispW * dpr) / W;
  g.lineWidth = Math.max(1, 0.9 * dpr);
  g.lineCap = "round";
  g.lineJoin = "round";
  let budget = DRAW_BUDGET, truncated = false;
  for (const p of (ps && ps.paths) || []) {
    if (!p.pts || p.pts.length < 2) continue;
    if (budget <= 0) { truncated = true; break; }
    g.strokeStyle = PENS[(((p.layer ?? 0) % 12) + 12) % 12].c;
    g.beginPath();
    g.moveTo(p.pts[0][0] * s, p.pts[0][1] * s);
    const m = Math.min(p.pts.length, budget);
    for (let i = 1; i < m; i++) g.lineTo(p.pts[i][0] * s, p.pts[i][1] * s);
    if (p.closed && m === p.pts.length) g.closePath();
    g.stroke();
    budget -= p.pts.length;
    if (m < p.pts.length) truncated = true;
  }
  return truncated;
}

export default function StackView({ PENS, T, mono, disp, W, H, frameCount, primaryPS, evalFrame, exportText, buildZip, projName, fontStrokes, sheetsCount, onClose }) {
  const [mode, setMode] = useState("frames");        /* "frames" | "pens" */
  const [frameSheets, setFrameSheets] = useState([]); /* [{ label, ps }] built lazily */
  const [gap, setGap] = useState(10);                 /* sheet spacing, mm */
  const [persp, setPersp] = useState(55);             /* 0 flat .. 100 strong */
  const [reverse, setReverse] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [plexi, setPlexi] = useState(true);           /* sheet outline + glass tint */
  const [bg, setBg] = useState("dark");               /* dark | paper | custom */
  const [bgCustom, setBgCustom] = useState("#223344");
  const [hidden, setHidden] = useState(() => new Set());
  const [trunc, setTrunc] = useState(() => new Set());
  const [rot, setRot] = useState({ yaw: -24, pitch: 14 });
  /* --- physical export state --- */
  const [margin, setMargin] = useState(0);            /* sheet margin per edge, mm */
  const [mirror, setMirror] = useState(false);        /* paint-on-back: mirror the plot files */
  const [drill, setDrill] = useState("off");          /* off | M3 | M4 | M5 */
  const [inset, setInset] = useState(8);              /* drill mark corner inset, mm */
  const [numbers, setNumbers] = useState(false);      /* SFONT n/N sheet numbers */
  const [markPen, setMarkPen] = useState(8);          /* pen for drill marks + numbers */
  const dragRef = useRef(null);
  const stageRef = useRef(null);
  const canvasesRef = useRef(new Map());
  const [box, setBox] = useState({ w: 900, h: 640 });

  /* a Sheets node in the graph drives the sheet count (its wired inputs);
     otherwise the ANIMATE frame count does */
  const fromSheetsNode = (sheetsCount || 0) > 0;
  const nFrames = Math.min(MAX_SHEETS, Math.max(1, (fromSheetsNode ? sheetsCount : frameCount) || 1));
  const unit = fromSheetsNode ? "sheet" : "frame";

  /* --- ESC closes --- */
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  /* --- measure the stage for display scale --- */
  useEffect(() => {
    const measure = () => {
      const el = stageRef.current;
      if (el) { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* --- frames mode: lazy chunked evaluation, one frame per tick --- */
  useEffect(() => {
    if (mode !== "frames") return;
    let alive = true;
    const acc = [];
    setFrameSheets([]);
    const step = (f) => {
      if (!alive) return;
      let ps = { paths: [] };
      try { ps = evalFrame(f, nFrames) || { paths: [] }; } catch (err) { /* keep the overlay alive */ }
      acc.push({ label: `${unit} ${f + 1}/${nFrames}`, ps });
      setFrameSheets(acc.slice());
      if (f + 1 < nFrames) setTimeout(() => step(f + 1), 16);
    };
    step(0);
    return () => { alive = false; };
  }, [mode, nFrames]);

  /* --- pens mode: instant split of the current output --- */
  const penSheets = useMemo(() => {
    if (mode !== "pens") return [];
    return splitByPens(primaryPS).slice(0, MAX_SHEETS)
      .map((s) => ({ label: `${s.pen}: ${PENS[s.pen].name}`, pen: s.pen, ps: s.ps }));
  }, [mode, primaryPS, PENS]);

  const sheets = mode === "pens" ? penSheets : frameSheets;
  const loading = mode === "frames" && frameSheets.length < nFrames;

  /* --- physical sheet = canvas + margin; art translated inward, marks in
     the margin zone. Used by BOTH the preview and the export so what you
     see is what plots (preview is the front view — mirror export-only) --- */
  const sheetW = W + 2 * margin, sheetH = H + 2 * margin;
  const decorate = (s, i, forExport) => {
    let paths = translatePS(s.ps, margin, margin).paths;
    if (drill !== "off") paths = paths.concat(drillMarks(sheetW, sheetH, inset, DRILL_DIA[drill], markPen));
    if (numbers && fontStrokes) {
      const x0 = inset + (drill !== "off" ? DRILL_DIA[drill] : 0) + 2;
      const y0 = sheetH - inset - 5;
      /* fontStrokes returns { strokes, width } — iterate .strokes */
      for (const st of fontStrokes(`${i + 1}/${sheets.length}`, 5, 1).strokes) {
        paths = paths.concat([{ pts: st.map(([x, y]) => [x0 + x, y0 + y]), closed: false, layer: markPen }]);
      }
    }
    let out = { paths };
    if (forExport && mirror) out = mirrorX(out, sheetW);
    return out;
  };

  /* --- per-sheet files as one ZIP: no browser multi-download permission --- */
  const exportZip = (kind) => {
    if (!sheets.length || loading || !exportText || !buildZip) return;
    const ext = kind === "svg" ? "svg" : kind === "dxf" ? "dxf" : "gcode";
    const files = sheets.map((s, i) => ({
      name: `${projName || "stack"}-sheet${String(i + 1).padStart(2, "0")}.${ext}`,
      text: exportText(kind, decorate(s, i, true), { W: sheetW, H: sheetH, frameIdx: i, frameCount: sheets.length }),
    }));
    try {
      const blob = new Blob([buildZip(files)], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${projName || "stack"}-sheets-${ext}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    } catch (err) { /* sandbox may block downloads */ }
  };

  /* --- display size: fit the physical sheet into the stage with room to rotate --- */
  const dispW = Math.max(120, Math.min(box.w * 0.56, (box.h * 0.62) * (sheetW / sheetH), 680));
  const dispH = dispW * (sheetH / sheetW);
  const pxPerMm = dispW / sheetW;

  /* --- draw each sheet once (or when the sheet list / physical params change) --- */
  useEffect(() => {
    const t = new Set();
    sheets.forEach((s, i) => {
      const cv = canvasesRef.current.get(i);
      if (cv && drawSheet(cv, decorate(s, i, false), sheetW, sheetH, PENS, dispW, dispH)) t.add(i);
    });
    setTrunc(t);
  }, [sheets, W, H, PENS, dispW, dispH, margin, drill, inset, numbers, markPen]);

  /* --- reset per-sheet visibility on mode change --- */
  useEffect(() => { setHidden(new Set()); }, [mode]);

  /* --- auto-orbit --- */
  useEffect(() => {
    if (!orbit) return;
    const iv = setInterval(() => {
      if (!dragRef.current) setRot((r) => ({ ...r, yaw: (r.yaw + 0.6) % 360 }));
    }, 30);
    return () => clearInterval(iv);
  }, [orbit]);

  /* --- drag to rotate --- */
  const onDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, yaw: rot.yaw, pitch: rot.pitch };
    e.preventDefault();
  };
  const onMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setRot({
      yaw: d.yaw + (e.clientX - d.x) * 0.4,
      pitch: Math.max(-85, Math.min(85, d.pitch - (e.clientY - d.y) * 0.4)),
    });
  };
  const onUp = () => { dragRef.current = null; };

  const perspPx = 3000 - persp * 26;   /* 0 -> 3000 (near-flat), 100 -> 400 (strong) */
  const bgCol = bg === "dark" ? "#10141A" : bg === "paper" ? "#FCFAF4" : bgCustom;
  const chipCol = (s) => (mode === "pens" ? PENS[s.pen].c : T.accent);

  const lbl = { fontSize: 9, color: T.dim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 };
  const row = { marginBottom: 10 };
  const btn = (on) => ({
    padding: "4px 10px", borderRadius: 4, border: `1px solid ${on ? T.accent : T.line}`,
    background: on ? T.accent + "22" : "transparent", color: on ? T.accent : T.text,
    fontSize: 10, fontFamily: mono, cursor: "pointer",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.82)", zIndex: 96, display: "flex", padding: "3vh 3vw", gap: 14 }}
      onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>

      {/* ---------- stage ---------- */}
      <div ref={stageRef} onMouseDown={onDown}
        style={{ flex: 1, background: bgCol, border: `1px solid ${T.line}`, borderRadius: 8, overflow: "hidden", cursor: dragRef.current ? "grabbing" : "grab", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", perspective: `${perspPx}px` }}>
          <div style={{ position: "relative", width: 0, height: 0, transformStyle: "preserve-3d", transform: `rotateX(${rot.pitch}deg) rotateY(${rot.yaw}deg)` }}>
            {sheets.map((s, i) => (
              <div key={`${mode}-${i}`}
                style={{
                  /* hide via display, never unmount: an unmounted canvas
                     comes back BLANK because the draw effect's deps don't
                     include visibility (regression: sheet checkbox) */
                  display: hidden.has(i) ? "none" : "block",
                  position: "absolute", left: -dispW / 2, top: -dispH / 2, width: dispW, height: dispH,
                  transform: `translateZ(${sheetZ(i, sheets.length, gap, reverse) * pxPerMm}px)`,
                  background: plexi ? "rgba(168,212,200,0.055)" : "transparent",
                  border: plexi ? "1px solid rgba(168,212,200,0.28)" : "none",
                  boxSizing: "border-box", backfaceVisibility: "visible",
                }}>
                <canvas ref={(el) => { if (el) canvasesRef.current.set(i, el); else canvasesRef.current.delete(i); }}
                  style={{ width: "100%", height: "100%", display: "block" }} />
              </div>
            ))}
          </div>
        </div>
        {sheets.length === 0 && !loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, fontSize: 11, fontFamily: mono, pointerEvents: "none" }}>
            {mode === "pens" ? "no output on the selected node" : "no frames to show"}
          </div>
        )}
        <div style={{ position: "absolute", left: 10, bottom: 8, fontSize: 9, color: bg === "paper" ? "#8A8F98" : T.dim, fontFamily: mono, pointerEvents: "none" }}>
          drag to rotate {"\u00B7"} {loading ? `evaluating ${frameSheets.length}/${nFrames}\u2026` : `${sheets.length - hidden.size}/${sheets.length} sheets`} {"\u00B7"} preview only — exports unchanged
        </div>
      </div>

      {/* ---------- controls ---------- */}
      <div style={{ width: 232, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, overflowY: "auto", fontFamily: mono, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", color: T.text, flex: 1 }}>STACK VIEW</div>
          <button onClick={onClose} style={{ ...btn(false), padding: "3px 9px" }}>Esc</button>
        </div>

        <div style={row}>
          <div style={lbl}>Sheets from</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...btn(mode === "frames"), flex: 1 }} onClick={() => setMode("frames")}
              title="Re-evaluates the graph per frame (ANIMATE frame count, max 48) — each frame is one sheet">Frames</button>
            <button style={{ ...btn(mode === "pens"), flex: 1 }} onClick={() => setMode("pens")}
              title="Splits the selected node's output by pen — each used pen is one sheet">Pens</button>
          </div>
          {mode === "frames" && fromSheetsNode && (
            <div style={{ fontSize: 9, color: T.dim, marginTop: 4 }}>sheet count from the Sheets node: {nFrames} wired input{nFrames === 1 ? "" : "s"}</div>
          )}
          {mode === "frames" && !fromSheetsNode && frameCount > MAX_SHEETS && (
            <div style={{ fontSize: 9, color: T.dim, marginTop: 4 }}>frame count {frameCount} capped to {MAX_SHEETS} sheets</div>
          )}
        </div>

        <div style={row}>
          <div style={lbl}>Sheet spacing {"\u2014"} {gap} mm</div>
          <input type="range" min={1} max={60} step={1} value={gap} onChange={(e) => setGap(+e.target.value)}
            style={{ width: "100%", accentColor: T.accent }} title="Physical distance between sheet faces: plexi thickness + air gap" />
        </div>

        <div style={row}>
          <div style={lbl}>Perspective {"\u2014"} {persp}</div>
          <input type="range" min={0} max={100} step={1} value={persp} onChange={(e) => setPersp(+e.target.value)}
            style={{ width: "100%", accentColor: T.accent }} title="0 = near-orthographic, 100 = strong perspective" />
        </div>

        <div style={{ ...row, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={btn(reverse)} onClick={() => setReverse((v) => !v)} title="Flip stacking order (which sheet is in front)">Reverse</button>
          <button style={btn(orbit)} onClick={() => setOrbit((v) => !v)} title="Slow automatic rotation">Orbit</button>
          <button style={btn(plexi)} onClick={() => setPlexi((v) => !v)} title="Sheet outline + glass tint">Plexi</button>
        </div>

        <div style={row}>
          <div style={lbl}>Background</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button style={btn(bg === "dark")} onClick={() => setBg("dark")}>Dark</button>
            <button style={btn(bg === "paper")} onClick={() => setBg("paper")}>Paper</button>
            <button style={btn(bg === "custom")} onClick={() => setBg("custom")}>{"\u2026"}</button>
            {bg === "custom" && (
              <input type="color" value={bgCustom} onChange={(e) => setBgCustom(e.target.value)}
                style={{ width: 26, height: 22, padding: 0, border: `1px solid ${T.line}`, borderRadius: 3, background: "transparent", cursor: "pointer" }} />
            )}
          </div>
        </div>

        <div style={row}>
          <div style={lbl}>Sheets {"\u2014"} front {reverse ? "last" : "first"}</div>
          {sheets.map((s, i) => (
            <label key={`${mode}-row-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.text, marginBottom: 3, cursor: "pointer" }}>
              <input type="checkbox" checked={!hidden.has(i)}
                onChange={() => setHidden((h) => { const n2 = new Set(h); n2.has(i) ? n2.delete(i) : n2.add(i); return n2; })}
                style={{ accentColor: T.accent }} />
              <span style={{ width: 8, height: 8, borderRadius: 2, background: chipCol(s), flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
              {trunc.has(i) && <span style={{ fontSize: 8, color: T.dim }} title={`over ${DRAW_BUDGET} points — drawing truncated`}>trunc</span>}
            </label>
          ))}
          {loading && <div style={{ fontSize: 9, color: T.dim }}>{"\u2026"}</div>}
        </div>

        <div style={{ borderTop: `1px solid ${T.line}`, margin: "10px 0", paddingTop: 10 }}>
          <div style={{ ...lbl, color: T.accent }}>Physical export</div>

          <div style={row}>
            <div style={lbl}>Sheet margin {"\u2014"} {margin} mm {margin > 0 ? `(sheet ${sheetW}\u00D7${sheetH})` : ""}</div>
            <input type="range" min={0} max={40} step={1} value={margin} onChange={(e) => setMargin(+e.target.value)}
              style={{ width: "100%", accentColor: T.accent }}
              title="Physical sheet = canvas + margin per edge; marks live in the margin zone" />
          </div>

          <div style={{ ...row, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button style={btn(mirror)} onClick={() => setMirror((v) => !v)}
              title="Paint/engrave the sheet BACK: plot files are mirrored so the piece reads correct from the front. Preview always shows the front view.">Mirror</button>
            <button style={btn(numbers)} onClick={() => setNumbers((v) => !v)}
              title="Engrave n/N near the bottom-left corner on the Mark pen">Numbers</button>
          </div>

          <div style={row}>
            <div style={lbl}>Drill marks</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["off", "M3", "M4", "M5"].map((d) => (
                <button key={d} style={{ ...btn(drill === d), flex: 1 }} onClick={() => setDrill(d)}
                  title={d === "off" ? "No drill marks" : `${d} clearance \u2300 ${DRILL_DIA[d]} mm at every corner, identical on all sheets`}>
                  {d === "off" ? "Off" : d}
                </button>
              ))}
            </div>
            {drill !== "off" && (
              <div style={{ marginTop: 6 }}>
                <div style={lbl}>Corner inset {"\u2014"} {inset} mm</div>
                <input type="range" min={4} max={20} step={1} value={inset} onChange={(e) => setInset(+e.target.value)}
                  style={{ width: "100%", accentColor: T.accent }} />
              </div>
            )}
          </div>

          {(drill !== "off" || numbers) && (
            <div style={row}>
              <div style={lbl}>Mark pen</div>
              <select value={markPen} onChange={(e) => setMarkPen(+e.target.value)}
                style={{ width: "100%", background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 10, fontFamily: mono }}>
                {PENS.map((p, i) => <option key={i} value={i}>{i}: {p.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ ...row, display: "flex", gap: 6 }}>
            {["svg", "dxf", "gcode"].map((k) => (
              <button key={k} onClick={() => exportZip(k)} disabled={loading || !sheets.length}
                style={{ flex: 1, padding: "5px 0", borderRadius: 4, border: `1px solid ${T.line}`, background: "transparent", color: loading || !sheets.length ? T.dim : T.text, fontSize: 10, fontFamily: mono, cursor: "pointer" }}
                title={`One ZIP with ${sheets.length || "N"} per-sheet ${k.toUpperCase()} files`}>
                {k === "gcode" ? "G-code" : k.toUpperCase()} .zip
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.5, marginTop: 8 }}>
          Preview shows the front view with margin and marks live; Mirror applies
          to the plot files only. Export writes ALL sheets {"\u2014"} hiding a sheet is a
          preview aid. One ZIP, no browser multi-download prompt. Spacing = sheet
          thickness + air gap. Mega Canvas and the stack don{"\u2019"}t combine.
        </div>
      </div>
    </div>
  );
}
