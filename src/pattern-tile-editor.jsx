import React, { useRef } from "react";

const DEFAULT = ["00011000","00111100","01100110","11000011","11000011","01100110","00111100","00011000"];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function patternGrid(value, n) {
  const raw = Array.isArray(value) ? value.slice(0, 16).filter(v => typeof v === "string") : DEFAULT;
  const h = raw.length, w = Math.max(0, ...raw.map(s => Math.min(16, s.length)));
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) =>
    !!(h && w && raw[Math.min(h - 1, Math.floor((y + .5) * h / n))]?.[Math.min(w - 1, Math.floor((x + .5) * w / n))] === "1")));
}

export default function PatternTileEditor({ value, onChange, label, grid = 8, theme: T }) {
  const n = clamp(Math.round(+grid || 8), 3, 16);
  const cells = patternGrid(value, n);
  const latest = useRef(cells);
  latest.current = cells;
  const board = useRef(null), stroke = useRef(null);
  const commit = next => { latest.current = next; onChange(next.map(row => row.map(v => v ? "1" : "0").join(""))); };
  const paint = (x, y, fill) => {
    if (x < 0 || y < 0 || x >= n || y >= n || latest.current[y][x] === fill) return;
    const next = latest.current.map(row => row.slice()); next[y][x] = fill; commit(next);
  };
  const cellAt = e => {
    const r = board.current?.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return null;
    const x = Math.floor((e.clientX - r.left) * n / r.width), y = Math.floor((e.clientY - r.top) * n / r.height);
    return x >= 0 && x < n && y >= 0 && y < n ? [x, y] : null;
  };
  const down = e => {
    e.stopPropagation(); e.preventDefault();
    const q = cellAt(e); if (!q) return;
    const fill = !latest.current[q[1]][q[0]];
    stroke.current = { fill, pointerId: e.pointerId };
    paint(q[0], q[1], fill);
    try { board.current.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const move = e => {
    if (!stroke.current || stroke.current.pointerId !== e.pointerId) return;
    const q = cellAt(e); if (q) paint(q[0], q[1], stroke.current.fill);
  };
  const stop = e => {
    if (stroke.current?.pointerId === e.pointerId) stroke.current = null;
  };
  const button = { background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 3, color: T.text, font: "inherit", fontSize: 10, padding: "3px 6px", cursor: "pointer" };
  const changeAll = fill => commit(Array.from({ length: n }, () => Array(n).fill(fill)));
  const invert = () => commit(latest.current.map(row => row.map(v => !v)));
  return <div style={{ marginBottom: 8 }} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <div style={{ color: T.dim, fontSize: 10, marginBottom: 5 }}>{label} · click or drag to paint</div>
    <div ref={board} role="grid" aria-label="Paint repeating motif" onPointerDown={down} onPointerMove={move}
      onPointerUp={stop} onPointerCancel={stop}
      style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, width: 224, height: 224,
        border: `1px solid ${T.line}`, touchAction: "none", userSelect: "none", background: T.panel2 }}>
      {cells.flatMap((row, y) => row.map((filled, x) => <button key={`${x}-${y}`} type="button"
        role="gridcell" aria-label={`Row ${y + 1}, column ${x + 1}`} aria-pressed={filled}
        onClick={e => { if (e.detail === 0) paint(x, y, !latest.current[y][x]); }}
        style={{ minWidth: 0, minHeight: 0, padding: 0, border: `1px solid ${T.line}`,
          background: filled ? T.accent : T.panel2, cursor: "crosshair" }} />))}
    </div>
    <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
      <button type="button" style={button} onClick={() => changeAll(false)}>Clear</button>
      <button type="button" style={button} onClick={() => changeAll(true)}>Fill</button>
      <button type="button" style={button} onClick={invert}>Invert</button>
    </div>
    <div style={{ color: T.dim, fontSize: 10, marginTop: 7, marginBottom: 4 }}>3 × 3 repeat preview</div>
    <div aria-label="Repeating motif preview" style={{ display: "grid", gridTemplateColumns: `repeat(${n * 3}, 1fr)`,
      width: 108, height: 108, border: `1px solid ${T.line}`, overflow: "hidden" }}>
      {Array.from({ length: n * n * 9 }, (_, i) => {
        const x = i % (n * 3), y = Math.floor(i / (n * 3));
        return <span key={i} style={{ background: cells[y % n][x % n] ? T.accent : T.panel2 }} />;
      })}
    </div>
  </div>;
}
