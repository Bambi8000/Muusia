import React, { useEffect, useRef, useState } from "react";
import { filterStroke } from "./defs/nodes/drawn_path.js";

const WIDTH = 240, HEIGHT = 150, PAD = 12, MAX_POINTS = 128;
const clamp = v => Math.max(0, Math.min(1, v));
const cleanPoints = raw => (Array.isArray(raw) ? raw : [])
  .filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  .slice(0, MAX_POINTS).map(p => [clamp(p[0]), clamp(p[1])]);

function PercentField({ value, label, onCommit, control, labelColor }) {
  const [text, setText] = useState(String(Math.round(value * 100)));
  useEffect(() => setText(String(Math.round(value * 100))), [value]);
  const commit = () => {
    const n = Number(String(text).replace(",", "."));
    if (text.trim() && Number.isFinite(n)) onCommit(n);
    else setText(String(Math.round(value * 100)));
  };
  return <label style={{ fontSize: 10, color: labelColor }}>{label} % <input
    aria-label={`Draw ${label} percent`} type="text" inputMode="decimal" value={text}
    onChange={e => setText(e.target.value)} onBlur={commit}
    onKeyDown={e => { if (e.key === "Enter") { commit(); e.currentTarget.blur(); } }}
    style={{ ...control, width: 43 }} /></label>;
}

export default function DrawnPathEditor({ value, onChange, label, closed, smoothness = 70, paperW = 300, paperH = 200, margin = 12, theme: T }) {
  const points = cleanPoints(value);
  const latest = useRef(points);
  latest.current = points;
  const svg = useRef(null);
  const drag = useRef(null);
  const [mode, setMode] = useState("Points");
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, points.length - 1));
  const control = { background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", font: "inherit", fontSize: 10 };
  const pick = e => {
    const r = svg.current.getBoundingClientRect();
    return [clamp(((e.clientX - r.left) / r.width * WIDTH - PAD) / (WIDTH - 2 * PAD)),
      clamp(((e.clientY - r.top) / r.height * HEIGHT - PAD) / (HEIGHT - 2 * PAD))];
  };
  const screen = p => [PAD + p[0] * (WIDTH - 2 * PAD), PAD + p[1] * (HEIGHT - 2 * PAD)];
  const commit = next => { latest.current = next; onChange(next); };
  const capture = e => { try { svg.current.setPointerCapture(e.pointerId); } catch (_) {} };
  const movePoint = (i, point) => {
    const next = latest.current.map(p => p.slice());
    if (!next[i]) return;
    next[i] = point;
    commit(next);
  };
  const appendFreehand = point => {
    const prev = latest.current, last = prev.at(-1);
    if (last && Math.hypot((last[0] - point[0]) * (WIDTH - 2 * PAD), (last[1] - point[1]) * (HEIGHT - 2 * PAD)) < 2.2) return;
    const next = prev.length >= MAX_POINTS ? prev.filter((_, i) => i % 2 === 0) : prev.slice();
    next.push(point);
    commit(next);
  };
  const downPaper = e => {
    e.stopPropagation(); e.preventDefault();
    const p = pick(e);
    if (mode === "Freehand") {
      commit([p]);
      drag.current = { kind: "freehand" };
    } else {
      if (latest.current.length >= MAX_POINTS) return;
      const i = latest.current.length;
      commit([...latest.current, p]);
      setSelected(i);
      drag.current = { kind: "point", index: i };
    }
    capture(e);
  };
  const move = e => {
    if (!drag.current) return;
    const p = pick(e);
    if (drag.current.kind === "freehand") appendFreehand(p);
    else movePoint(drag.current.index, p);
  };
  const up = e => {
    if (drag.current?.kind === "freehand") appendFreehand(pick(e));
    drag.current = null;
  };
  const controlPoints = points.map(screen);
  const poly = controlPoints.map(p => p.join(",")).join(" ");
  const smooth = Math.max(0, Math.min(1, (+smoothness || 0) / 100));
  const paperMargin = Math.max(0, Math.min(Math.min(paperW, paperH) / 2, +margin || 0));
  const drawW = Math.max(1, paperW - 2 * paperMargin), drawH = Math.max(1, paperH - 2 * paperMargin);
  const filtered = filterStroke(points.map(p => [p[0] * drawW, p[1] * drawH]), !!closed, smooth, Math.min(drawW, drawH) * .075 * smooth);
  const drawn = filtered.map(p => screen([p[0] / drawW, p[1] / drawH]));
  const curve = drawn.length < (closed ? 3 : 2) ? "" : drawn.reduce((d, a, i) => {
    const n = drawn.length;
    if (!closed && i === n - 1) return d;
    const b = drawn[(i + 1) % n], prev = drawn[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = drawn[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    const c1 = [0, 1].map(k => a[k] + (1 - smooth) * (b[k] - a[k]) / 3 + smooth * (b[k] - prev[k]) / 6);
    const c2 = [0, 1].map(k => b[k] - (1 - smooth) * (b[k] - a[k]) / 3 - smooth * (next[k] - a[k]) / 6);
    return d + ` C${c1.join(",")} ${c2.join(",")} ${b.join(",")}`;
  }, `M${drawn[0]?.join(",") || "0,0"}`) + (closed ? " Z" : "");
  const setAxis = (axis, v) => {
    if (!Number.isFinite(v) || !latest.current[index]) return;
    const q = latest.current[index].slice(); q[axis] = clamp(v / 100);
    movePoint(index, q);
  };
  return <div style={{ marginBottom: 8 }} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <div style={{ fontSize: 10, color: T.dim, marginBottom: 4 }}>{label} · click to add, drag to edit; Freehand replaces this stroke</div>
    <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
      {["Points", "Freehand"].map(option => <button key={option} type="button" aria-pressed={mode === option}
        onClick={() => { drag.current = null; setMode(option); }}
        style={{ ...control, color: mode === option ? T.accent : T.text }}>{option}</button>)}
    </div>
    <svg ref={svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`${label} drawing area`}
      style={{ width: "100%", height: "auto", display: "block", background: T.paper, touchAction: "none", border: `1px solid ${T.line}`, borderRadius: 3, cursor: "crosshair" }}
      onPointerDown={downPaper} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
      <rect x={PAD} y={PAD} width={WIDTH - 2 * PAD} height={HEIGHT - 2 * PAD} fill="none" stroke={T.paperLine} />
      {mode === "Points" && drawn.length >= 2 && <polyline points={poly} fill="none" stroke={T.dim} strokeWidth=".7" strokeDasharray="3 3" />}
      {curve && <path d={curve} fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
      {mode === "Points" && controlPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="transparent"
        aria-label={`Point ${i + 1}`} onPointerDown={e => {
          e.stopPropagation(); e.preventDefault();
          drag.current = { kind: "point", index: i };
          setSelected(i); capture(e);
        }} />)}
      {mode === "Points" && controlPoints.map(([x, y], i) => <circle key={`mark${i}`} cx={x} cy={y} r={i === index ? 3.5 : 2.5}
        fill={i === index ? T.accent : T.dim} pointerEvents="none" />)}
    </svg>
    <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
      {mode === "Points" && points.length > 0 && <>
        <select aria-label={`${label} selected point`} value={index} onChange={e => setSelected(+e.target.value)} style={control}>
          {points.map((_, i) => <option key={i} value={i}>Point {i + 1}</option>)}
        </select>
        {["X", "Y"].map((axis, k) => <PercentField key={`${index}-${axis}`} label={axis}
          value={points[index][k]} onCommit={v => setAxis(k, v)} control={control} labelColor={T.dim} />)}
        <button type="button" style={control} onClick={() => { commit(points.filter((_, i) => i !== index)); setSelected(Math.max(0, index - 1)); }}>Remove</button>
      </>}
      <button type="button" style={control} disabled={points.length === 0} onClick={() => { commit(points.slice(0, -1)); setSelected(Math.max(0, index - 1)); }}>Undo point</button>
      <button type="button" style={control} disabled={points.length === 0} onClick={() => { commit([]); setSelected(0); }}>Clear</button>
      <span style={{ fontSize: 10, color: T.dim }}>{points.length} points</span>
    </div>
  </div>;
}
