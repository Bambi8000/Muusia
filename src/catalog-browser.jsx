/* catalog-browser.jsx — the visual node catalog (discovery phase 3).
 *
 * A full-screen overlay: every node rendered as a live thumbnail (compute with
 * default params on a fixed 150x100 mm thumb canvas; modifiers get a standard
 * fixture path-set), searchable with the same deep scoring as the quick-add
 * (name/nick 3, tags 2, desc+paragraph 1, word-start AND), filterable by
 * category and tag, with a Surprise me button. Clicking a card adds the node
 * to the graph (browser stays open for further browsing).
 *
 * Thumbnails are computed lazily in small chunks so the overlay opens
 * instantly, and cached per node key for the session. Everything is
 * deterministic (default seeds), so a thumbnail never changes between opens.
 *
 * Self-contained: React comes in as a prop-free import, everything else
 * (DEFS, CATS, CATALOG, PENS, theme tokens, defaults, addNode) is injected
 * via props from App.jsx — this module never touches the engine.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";

/* --- fixed thumb canvas: uniform cards, stable cache --- */
const TW = 150, TH = 100;
const THUMB_CTX = {
  W: TW, H: TH, frameIdx: 0, frameCount: 120,
  machine: { originX: 0, originY: 0, flipY: false, laserOffX: 0, laserOffY: 0, workW: TW, workH: TH },
};
const POINT_BUDGET = 6000;

/* --- standard fixture for paths inputs: circle + open squiggle + line rows --- */
function makeFixture(withCircle) {
  const paths = [];
  if (withCircle) {
    const circ = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      circ.push([TW * 0.32 + 22 * Math.cos(a), TH * 0.5 + 22 * Math.sin(a)]);
    }
    paths.push({ pts: circ, closed: true, layer: 0 });
  }
  const sq = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    sq.push([TW * 0.52 + t * TW * 0.4, TH * 0.28 + Math.sin(t * Math.PI * 3) * 14 + t * TH * 0.3]);
  }
  paths.push({ pts: sq, closed: false, layer: 1 });
  for (let r = 0; r < 3; r++) {
    const y = TH * 0.72 + r * 7;
    const row = [];
    for (let i = 0; i <= 30; i++) row.push([TW * 0.12 + (i / 30) * TW * 0.34, y]);
    paths.push({ pts: row, closed: false, layer: 2 });
  }
  return { paths };
}
const FIXTURE = makeFixture(true);   /* first paths input: circle + squiggle + rows */
const FIXTURE_B = makeFixture(false); /* later paths inputs: squiggle + rows only, so duo nodes see two DIFFERENT sets */

/* --- compute one thumbnail: mimic the engine call exactly --- */
function computeThumb(DEFS, defaults, key) {
  const d = DEFS[key];
  if (!d || !d.compute) return { state: "none" };
  const hasFile = d.fileLabel || d.fileAccept || (d.params || []).some((p) => p.type === "file" || p.fileAccept);
  try {
    const params = defaults(key);
    const pinsDef = typeof d.ins === "function" ? d.ins(params) : (d.ins || []);
    let pi = 0;
    const ins = pinsDef.map((pin) => (pin && pin.type === "paths" ? (pi++ === 0 ? FIXTURE : FIXTURE_B) : undefined));
    const r = d.compute(ins, params, THUMB_CTX, { id: -1, data: {} });
    const outs = Array.isArray(r) ? r : [r];
    const ps = outs.find((o) => o && o.paths);
    if (!ps || !ps.paths.length) {
      if (typeof outs[0] === "number") return { state: "value", v: outs[0] };
      if (outs[0] && outs[0].kind === "style") return { state: "style" };
      return { state: hasFile ? "file" : "empty" };
    }
    const paths = [];
    let budget = POINT_BUDGET;
    for (const p of ps.paths) {
      if (budget <= 0) break;
      const pts = p.pts.length > budget ? p.pts.slice(0, budget) : p.pts;
      budget -= pts.length;
      paths.push({ pts, closed: p.closed && pts.length === p.pts.length, layer: p.layer || 0 });
    }
    return { state: "ok", paths };
  } catch (e) {
    return { state: "err" };
  }
}

function ThumbSVG({ thumb, PENS, T }) {
  if (!thumb || thumb.state === "pending") return <div style={{ fontSize: 9, color: T.dim }}>rendering…</div>;
  if (thumb.state === "file") return <div style={{ fontSize: 9, color: T.dim }}>needs a file</div>;
  if (thumb.state === "value") return <div style={{ fontSize: 18, color: T.value, fontFamily: "monospace" }}>{Math.round(thumb.v * 100) / 100}</div>;
  if (thumb.state === "style") return <div style={{ fontSize: 12, color: T.style, fontFamily: "monospace", letterSpacing: 2 }}>— — —</div>;
  if (thumb.state !== "ok") return <div style={{ fontSize: 9, color: T.dim }}>no preview</div>;
  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} style={{ width: "100%", height: "100%", display: "block" }}>
      {thumb.paths.map((p, i) => (
        <polyline key={i}
          points={(p.closed ? [...p.pts, p.pts[0]] : p.pts).map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ")}
          fill="none" stroke={(PENS[(p.layer || 0) % PENS.length] || {}).c || "#333"} strokeWidth={0.7} />
      ))}
    </svg>
  );
}

export default function CatalogBrowser({ DEFS, CATS, CATALOG, PENS, T, mono, disp, defaults, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState(null);
  const [tag, setTag] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [added, setAdded] = useState(null);
  const cacheRef = useRef({});

  const tagCloud = useMemo(() => Object.entries(
    Object.values(CATALOG).reduce((m, e) => { for (const t of e.tags || []) m[t] = (m[t] || 0) + 1; return m; }, {})
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), [CATALOG]);

  /* --- same deep scoring as the quick-add --- */
  const list = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const rescape = (w) => w.split("").map((c) => (/[a-z0-9]/.test(c) ? c : "\\" + c)).join("");
    const termRes = terms.map((w) => new RegExp("(^|[^a-z0-9])" + rescape(w)));
    const scoreOf = (t, d) => {
      if (!terms.length) return 1;
      const name = d.name.toLowerCase();
      const ce = CATALOG[t] || {};
      const tagStr = (ce.tags || []).join(" ");
      const deep = ((d.desc || "") + " " + (ce.t || "")).toLowerCase();
      let s = 0;
      for (const re of termRes) {
        if (re.test(name)) s += 3;
        else if (re.test(tagStr)) s += 2;
        else if (re.test(deep)) s += 1;
        else return 0;
      }
      return s;
    };
    return Object.entries(DEFS)
      .map(([t, d]) => {
        if (d.hidden) return null;
        if (cat !== null && d.cat !== cat) return null;
        if (tag !== null && !((CATALOG[t] || {}).tags || []).includes(tag)) return null;
        const s = scoreOf(t, d);
        return s > 0 ? [t, d, s] : null;
      })
      .filter(Boolean)
      .sort((a, b) => b[2] - a[2] || a[1].name.localeCompare(b[1].name));
  }, [DEFS, CATALOG, query, cat, tag]);

  /* --- lazy chunked thumbnail computation, filtered list first --- */
  useEffect(() => {
    let alive = true;
    const queue = list.map(([t]) => t).filter((t) => !cacheRef.current[t]);
    if (!queue.length) return;
    let i = 0;
    const step = () => {
      if (!alive) return;
      const batch = {};
      for (let n = 0; n < 3 && i < queue.length; n++, i++) {
        const key = queue[i];
        batch[key] = cacheRef.current[key] = computeThumb(DEFS, defaults, key);
      }
      setThumbs((prev) => ({ ...prev, ...batch }));
      if (i < queue.length) setTimeout(step, 0);
    };
    setTimeout(step, 0);
    return () => { alive = false; };
  }, [list, DEFS, defaults]);

  const surprise = () => {
    if (!list.length) return;
    const pick = list[Math.floor((Date.now() % 100000) / 100000 * list.length) % list.length];
    onAdd(pick[0]);
    setAdded(pick[0]);
    setTimeout(() => setAdded(null), 900);
  };

  const chip = (active, color) => ({
    fontSize: 9, fontFamily: mono, cursor: "pointer", userSelect: "none",
    padding: "2px 8px", borderRadius: 9,
    color: active ? "#0E1116" : (color || T.dim),
    background: active ? (color || T.accent) : T.panel2,
    border: `1px solid ${active ? (color || T.accent) : T.line}`,
  });

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.78)", zIndex: 96, display: "flex", justifyContent: "center", alignItems: "stretch", padding: "4vh 4vw" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ flex: 1, maxWidth: 1100, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", color: T.accent }}>NODE CATALOG</div>
          <input autoFocus type="text" value={query} placeholder="Deep search: name, tags, description…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontFamily: mono, outline: "none" }} />
          <div style={{ fontSize: 10, color: T.dim, fontFamily: mono }}>{list.length}</div>
          <button onClick={surprise} title="Add a random node from the current filter"
            style={{ ...chip(false), fontSize: 10, padding: "5px 10px", background: T.panel2, color: T.text, cursor: "pointer" }}>
            Surprise me
          </button>
          <span onClick={onClose} style={{ color: T.dim, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>×</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 14px", borderBottom: `1px solid ${T.line}` }}>
          {Object.entries(CATS).filter(([c]) => c !== "route").map(([c, meta]) => (
            <span key={c} onClick={() => setCat(cat === c ? null : c)} style={chip(cat === c, meta.color)}>{meta.label}</span>
          ))}
          <span style={{ width: 10 }} />
          {tagCloud.map(([t, c]) => (
            <span key={t} onClick={() => setTag(tag === t ? null : t)} style={chip(tag === t)}>
              {t} <span style={{ opacity: 0.55 }}>{c}</span>
            </span>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 10, alignContent: "start" }}>
          {list.map(([type, d]) => (
            <div key={type} onClick={() => { onAdd(type); setAdded(type); setTimeout(() => setAdded((a) => (a === type ? null : a)), 900); }}
              title={((CATALOG[type] || {}).t || d.desc || "").slice(0, 300)}
              style={{ background: T.panel2, border: `1px solid ${added === type ? T.accent : T.line}`, borderLeft: `3px solid ${(CATS[d.cat] || {}).color || T.dim}`, borderRadius: 6, cursor: "pointer", overflow: "hidden" }}>
              <div style={{ height: 96, background: T.paper, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ThumbSVG thumb={cacheRef.current[type] || thumbs[type] || { state: "pending" }} PENS={PENS} T={T} />
              </div>
              <div style={{ padding: "5px 8px", display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ flex: 1, fontSize: 10.5, color: added === type ? T.accent : T.text, fontFamily: mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {added === type ? "Added ✓" : d.name}
                </div>
                <div style={{ fontSize: 8, color: T.dim }}>{d.group || d.cat}</div>
              </div>
            </div>
          ))}
          {!list.length && <div style={{ padding: 20, fontSize: 11, color: T.dim }}>No matches — try fewer words or clear the tag filter.</div>}
        </div>
      </div>
    </div>
  );
}
