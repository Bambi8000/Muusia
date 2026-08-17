import React, { useState, useRef, useEffect } from "react";

/* ============================================================
   LIVE INPUT — the engine seam behind the Controller node.

   WHY THIS EXISTS AT ALL. Nodes are pure: no DOM, no devices, no
   clock. So live input can never be read inside compute, and it must
   not ride in ctx either — ctx is re-evaluated for exports, thumbnails
   and animation frames, and a value that differs between those runs
   breaks determinism. The only correct place for it is the PARAMS.
   This module listens to the keyboard and the Gamepad API and writes
   normalised 0..1 values into v1..v6 of every Controller node
   (type "ctrl") in the CURRENT graph level. Those params save with the
   patch, so a gesture replays exactly on export.

   Two costs are managed here, both learned the hard way:

   1. RE-EVALUATION. Every param write re-runs the whole graph. A 60 Hz
      input stream on a heavy patch would lock the UI. Writes are
      therefore capped at WRITE_MS per node and skipped entirely when
      nothing moved by more than EPS.

   2. UNDO HISTORY. App.jsx coalesces changes inside 400 ms, which is
      not enough for a continuous stream — a long twiddle would fill the
      60-entry history with junk and destroy real history. histRef gets
      a `live` flag while a gesture is in progress; the history effect
      in App.jsx pushes ONE snapshot at the start of the gesture and
      skips the rest. The flag clears IDLE_MS after the last write.

   ADOPTION RACE. setParam is async, so on the frame after a write the
   node prop still carries the old value. Adopting it would fight our
   own local value and produce jitter. Each channel therefore carries a
   `pend` flag: while a write is in flight we ignore the incoming param
   and only resume adopting (i.e. honouring a manual slider edit or an
   undo) once the prop has caught up with what we wrote.

   Scope: the current level only, because setParam writes there. A
   Controller inside a group is inert until you open the group.
   ============================================================ */

const NODE_KEY = "ctrl";
const CHAN_MAX = 6;
const WRITE_MS = 50;     /* 20 Hz ceiling on graph re-evaluation */
const IDLE_MS = 600;     /* gesture considered finished after this quiet period */
const EPS = 0.0005;      /* below this a channel counts as unmoved */
const KEY_STEP = 0.02;   /* arrow-key nudge; Shift x5, Alt /4 */

const C = {
  line: "#2C3240", panel: "#1E222B", panel2: "#232834", text: "#CBD1DE",
  dim: "#828BA0", accent: "#5B8DEF", ok: "#5BBF7A", warn: "#E0B341",
};
const mono = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

/* PURE-BEGIN — everything between these markers is free of React, the DOM and
   the device APIs, and tools/validate-live-input.mjs extracts and tests it
   verbatim. Keep it that way: no hooks, no navigator, no window in here. */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const isCtrl = (n) => n && n.type === NODE_KEY && n.params;

/* Why nothing is armed — the two cases need different fixes, so name them. */
function ctrlsHint(nodes) {
  const k = (nodes || []).filter(isCtrl).length;
  if (!k) return "no Controller node in this level";
  return "nothing armed — click a Controller once, or pick one in this panel";
}

function chanCount(node) {
  const c = Math.round((node.params && node.params.count) || 1);
  return Math.max(1, Math.min(CHAN_MAX, Number.isFinite(c) ? c || 1 : 1));
}

/* One axis sample -> the new normalised channel value.
   Absolute maps stick position across the full range; Jog integrates the
   deflection, which is what a self-centring stick or a 3D mouse needs — let go
   and the value stays where it got to. The deadzone is rescaled rather than
   subtracted, so leaving it does not jump the value. */
function stepAxis(raw, cur, dz, jog, rate, dt) {
  if (typeof raw !== "number" || !isFinite(raw)) return cur;
  const d = Math.max(0, Math.min(0.9, isFinite(dz) ? dz : 0));
  const m = Math.abs(raw);
  const a = m <= d ? 0 : Math.sign(raw) * ((m - d) / (1 - d));
  if (!jog) return clamp01((a + 1) / 2);
  if (a === 0) return cur;
  const r = Math.max(0.01, isFinite(rate) ? rate : 0.6);
  const t = Math.max(0, Math.min(0.1, isFinite(dt) ? dt : 0));
  return clamp01(cur + a * r * t);
}

/* Reconcile the local channel mirror with the node's params.
   st = { v: local values, w: what we last wrote, pend: write in flight }.

   The pending flag is the whole point. setParam is async, so on the frame
   after a write the incoming params still carry the OLD value; adopting it
   would fight our own value and produce jitter. While a write is in flight we
   ignore the prop and only resume adopting once it has caught up — which is
   how a manual slider edit, a patch load or an undo still wins. */
function syncState(st, params, n) {
  for (let i = 0; i < n; i++) {
    const raw = params["v" + (i + 1)];
    const p = Number.isFinite(raw) ? clamp01(raw) : 0;
    if (st.w[i] === undefined) { st.v[i] = p; st.w[i] = p; st.pend[i] = false; continue; }
    if (st.pend[i]) { if (Math.abs(p - st.w[i]) < 1e-9) st.pend[i] = false; continue; }
    if (Math.abs(p - st.w[i]) > 1e-9) { st.v[i] = p; st.w[i] = p; }
  }
  return st;
}

/* Which channels actually need writing. Returns null when nothing moved, so
   the caller can skip the setParam (and therefore a whole graph re-evaluation)
   entirely. Values are rounded to the v1..v6 slider step. */
function planWrite(st, n, eps) {
  let obj = null;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(st.v[i])) { st.v[i] = st.w[i] || 0; continue; }
    if (Math.abs(st.v[i] - st.w[i]) <= eps) continue;
    const r = Math.round(st.v[i] * 1000) / 1000;
    if (r === st.w[i]) continue;
    if (!obj) obj = {};
    obj["v" + (i + 1)] = r;
    st.w[i] = r;
    st.pend[i] = true;
  }
  return obj;
}

/* Binding string -> { pad, axes[] }. Forgiving on purpose: this is a text
   field a human types into. "auto" (or anything unparseable) = the FIRST
   connected pad and axes 0..n-1. pad is null when unspecified rather than 0,
   because the browser assigns gamepad indices by connection order and a
   Bluetooth pad that reconnects routinely lands on index 1, 2 or 3 — pinning
   the default to slot 0 makes a perfectly working pad look dead.
   Understood: "pad:1", "axis:0-5", "axis:0,1,3", or both. */
function parseBind(s, n) {
  const str = String(s == null ? "" : s).toLowerCase();
  let pad = null;
  const pm = str.match(/pad\s*:\s*(\d+)/);
  if (pm) pad = Math.max(0, Math.min(3, parseInt(pm[1], 10) || 0));
  let axes = null;
  const am = str.match(/axis\s*:\s*([0-9,\s-]+)/);
  if (am) {
    const list = [];
    for (const part of am[1].split(",")) {
      const t = part.trim();
      const r = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (r) {
        const a = +r[1], b = +r[2];
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) list.push(i);
      } else if (/^\d+$/.test(t)) list.push(+t);
    }
    if (list.length) axes = list;
  }
  if (!axes) axes = Array.from({ length: n }, (_, i) => i);
  return { pad, axes };
}

/* PURE-END */

export default function LiveInput({ nodes, selIds, setParam, setParams, histRef, overlay }) {
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [chan, setChan] = useState(0);
  const [padName, setPadName] = useState(null);
  const [padDrag, setPadDrag] = useState(false);

  /* ARMED, not selected. Selection cannot be the handle here: the big preview
     only opens when the selected node outputs paths, so a Controller can never
     be both selected and visible on the big canvas. Instead, selecting a
     Controller ARMS it and it stays armed while you go on to select and preview
     the output node. A single Controller in the level arms itself. */
  const [armed, setArmed] = useState(null);
  const ctrls = (nodes || []).filter(isCtrl);
  useEffect(() => {
    const id = (selIds || [])[0];
    const n = (nodes || []).find((q) => q.id === id);
    if (isCtrl(n) && n.id !== armed) setArmed(n.id);
  }, [selIds, nodes, armed]);
  const target = ctrls.find((n) => n.id === armed) || (ctrls.length === 1 ? ctrls[0] : null);

  /* everything the listeners read lives in a ref, so neither the rAF loop nor
     the key handler has to be torn down and rebuilt on every render */
  const R = useRef({ nodes: [], sel: [], chan: 0, st: {}, t: {}, timer: 0,
    diag: { keys: 0, frames: 0, writes: 0, why: "idle", pad: "none", axes: "" } });
  R.current.nodes = nodes || [];
  R.current.sel = selIds || [];
  R.current.chan = chan;
  R.current.armed = target ? target.id : null;
  /* setParam/setParamsMulti close over the CURRENT graph level, so a long-lived
     rAF loop holding an old copy would write into the level you just left when
     you enter or exit a group. Keep them in the ref and always call the latest. */
  R.current.setParam = setParam;
  R.current.setParams = setParams;

  useEffect(() => () => clearTimeout(R.current.timer), []);

  /* the diagnostics block lives in a ref (it must not cost a render per frame),
     so repaint it slowly and only while the popover is actually open */
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!open) return undefined;
    const iv = setInterval(() => setBeat((b) => b + 1), 250);
    return () => clearInterval(iv);
  }, [open]);

  /* ---- writing ---- */

  const markLive = () => {
    const h = histRef && histRef.current;
    if (!h) return;
    h.live = true;
    clearTimeout(R.current.timer);
    R.current.timer = setTimeout(() => {
      const hh = histRef && histRef.current;
      if (hh) { hh.live = false; hh.liveOpen = false; }
    }, IDLE_MS);
  };

  /* local mirror of a node's channels, reconciled with the props */
  const stateOf = (node) => {
    let st = R.current.st[node.id];
    if (!st) st = R.current.st[node.id] = { v: [], w: [], pend: [] };
    return syncState(st, node.params, chanCount(node));
  };

  /* Diagnostics. The popover shows these live, and window.MUUSIA_LIVE_DEBUG = true
     mirrors them to the console. They exist because a silent live-input path has
     exactly one symptom - nothing happens - and guessing between "the listener
     never fired", "it bailed on a condition" and "the write never landed" costs
     far more than counting them. */
  const say = (why) => {
    const d = R.current.diag;
    if (d.why !== why && typeof window !== "undefined" && window.MUUSIA_LIVE_DEBUG) console.log("[live]", why);
    d.why = why;
  };

  const write = (node, st, n, immediate) => {
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const last = R.current.t[node.id] || 0;
    if (!immediate && now - last < WRITE_MS) { say("throttled"); return; }
    const obj = planWrite(st, n, EPS);
    if (!obj) { say("nothing moved past the epsilon"); return; }
    R.current.t[node.id] = now;
    R.current.diag.writes++;
    markLive();
    const many = R.current.setParams, one = R.current.setParam;
    if (!many && !one) { say("NO SETTER - era patch did not pass setParams"); return; }
    if (many) many(node.id, obj);
    else for (const k in obj) one(node.id, k, obj[k]);
    say("writing " + Object.keys(obj).join(","));
    if (typeof window !== "undefined" && window.MUUSIA_LIVE_DEBUG) console.log("[live] write", node.id, obj);
  };

  /* ---- gamepad polling ---- */

  const gpTargets = (nodes || []).filter((n) => isCtrl(n) && n.params.source === "Gamepad" && !n.params.freeze);
  const needsPoll = on && gpTargets.length > 0 && typeof navigator !== "undefined" && !!navigator.getGamepads;

  useEffect(() => {
    if (!needsPoll) { setPadName(null); return undefined; }
    let raf = 0;
    let prev = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const S = R.current;
      S.diag.frames++;
      const pads = navigator.getGamepads() || [];
      let seen = null;
      let found = 0;
      for (const node of S.nodes) {
        if (!isCtrl(node) || node.params.source !== "Gamepad" || node.params.freeze) continue;
        found++;
        const n = chanCount(node);
        const b = parseBind(node.params.bind, n);
        const gp = b.pad == null ? pads.find((g) => g && g.connected !== false) : pads[b.pad];
        if (!gp) {
          say(b.pad == null
            ? "no pad seen — press a button on it while this page has focus"
            : "no pad on index " + b.pad + " — try clearing Binding back to auto");
          continue;
        }
        if (!gp.axes || !gp.axes.length) { say("pad '" + gp.id + "' reports no axes"); continue; }
        seen = gp.id;
        S.diag.pad = gp.id + " @" + gp.index + " (" + gp.axes.length + " axes)";
        S.diag.axes = Array.prototype.map.call(gp.axes, (a) => (typeof a === "number" ? a.toFixed(2) : "?")).join(" ");
        const st = stateOf(node);
        const dz = (+node.params.dead || 0) / 100;
        const jog = node.params.mode === "Jog (integrate)";
        const rate = +node.params.rate;
        let moved = false;
        for (let i = 0; i < n; i++) {
          const raw = gp.axes[b.axes[i]];
          if (typeof raw === "number" && Math.abs(raw) > dz) moved = true;
          st.v[i] = stepAxis(raw, st.v[i], dz, jog, rate, dt);
        }
        if (!moved) say("pad connected, all bound axes inside the deadzone");
        write(node, st, n, false);
      }
      if (!found) say("no Controller with Source Gamepad in this level");
      if (seen !== R.current.padSeen) { R.current.padSeen = seen; setPadName(seen); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPoll]);

  /* ---- keyboard: arrows drive the SELECTED Controller ----
     Arrow keys are the only keys free of App.jsx's global hotkeys (letters are
     all taken by quick-add and the overlays), so no arm/disarm mode is needed:
     selection IS the arming. */

  useEffect(() => {
    if (!on) return undefined;
    const onKey = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const S = R.current;
      S.diag.keys++;
      const tag = (e.target && e.target.tagName ? e.target.tagName : "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") { say("focus is in a " + tag + " - click the node header"); return; }
      if (e.metaKey || e.ctrlKey) { say("modifier held"); return; }
      const id = S.armed;
      if (id == null) { say(ctrlsHint(S.nodes)); return; }
      const node = S.nodes.find((q) => q.id === id);
      if (!node) { say("armed node " + id + " is not in this level"); return; }
      if (!isCtrl(node)) { say("armed node is '" + node.type + "', not a Controller"); return; }
      if (node.params.source !== "Keyboard") { say("Source is '" + node.params.source + "', not Keyboard"); return; }
      if (node.params.freeze) { say("node is frozen"); return; }
      const n = chanCount(node);
      e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        setChan((c) => (e.key === "ArrowRight" ? Math.min(n - 1, c + 1) : Math.max(0, c - 1)));
        say("channel switch");
        return;
      }
      const st = stateOf(node);
      const i = Math.min(n - 1, Math.max(0, S.chan));
      let step = KEY_STEP;
      if (e.shiftKey) step *= 5;
      if (e.altKey) step /= 4;
      st.v[i] = clamp01(st.v[i] + (e.key === "ArrowUp" ? step : -step));
      write(node, st, n, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  /* ---- XY pad: drags channels 1 and 2 of the armed Controller ---- */

  const tN = target ? chanCount(target) : 0;

  const padSet = (ev, el) => {
    if (!target || target.params.freeze) return;
    const r = el.getBoundingClientRect();
    const x = clamp01((ev.clientX - r.left) / Math.max(1, r.width));
    const y = clamp01((ev.clientY - r.top) / Math.max(1, r.height));
    const st = stateOf(target);
    st.v[0] = x;
    if (tN >= 2) st.v[1] = 1 - y; /* screen y is down; up should mean more */
    write(target, st, tN, false);
  };

  /* ---- chip ---- */

  const anyCtrl = (nodes || []).some(isCtrl);
  const dot = !anyCtrl ? C.dim : !on ? C.warn : (padName || (target && target.params.source === "Keyboard")) ? C.ok : C.accent;
  const cur = target ? Math.min(tN - 1, chan) : 0;
  const curVal = target ? target.params["v" + (cur + 1)] : undefined;
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "\u2014");

  const title = !anyCtrl
    ? "No Controller node in this graph — add one from the Math category"
    : "Live input for Controller nodes\nClick a Controller once to arm it; it stays armed while you select and preview other nodes\nArrow keys drive it (Shift coarse, Alt fine)\nClick for the XY pad and channel readout";

  /* The big preview is a fixed, full-screen overlay at zIndex 100, so the top
     bar — and this chip with it — is buried. Driving values while watching the
     large canvas is exactly the case this node exists for, so mirror a compact
     readout above the overlay while it is open. */
  const hud = overlay && target ? (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", top: 12, left: 14, zIndex: 200,
        display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
        background: "rgba(30,34,43,0.94)", border: `1px solid ${C.line}`, borderRadius: 5,
        fontFamily: mono, fontSize: 10, color: C.text, userSelect: "none",
        boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
      }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, display: "inline-block" }} />
      <span style={{ color: C.dim }}>LIVE</span>
      {Array.from({ length: tN }, (_, i) => (
        <span key={i} style={{
          fontVariantNumeric: "tabular-nums",
          color: i === cur ? C.text : C.dim,
          borderBottom: i === cur ? `1px solid ${C.accent}` : "1px solid transparent",
        }}>
          {i + 1}:{fmt(target.params["v" + (i + 1)])}
        </span>
      ))}
      <span style={{ color: C.dim }}>{"\u2191\u2193 \u2190\u2192"}</span>
    </div>
  ) : null;

  return (
    <div style={{ position: "relative" }}>
      {hud}
      <div
        title={title}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
          background: C.panel2, border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 4,
          fontFamily: mono, fontSize: 10, cursor: "pointer", userSelect: "none",
          opacity: anyCtrl ? 1 : 0.6,
        }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, display: "inline-block" }} />
        <span style={{ color: C.dim }}>LIVE</span>
        <span style={{
          display: "inline-block", width: 62, textAlign: "left", whiteSpace: "nowrap",
          overflow: "hidden", fontVariantNumeric: "tabular-nums",
          color: target ? C.text : C.dim,
        }}>
          <span style={{ color: C.dim }}>{target ? "CH" + (cur + 1) + " " : "" }</span>{target ? fmt(curVal) : "\u2014"}
        </span>
      </div>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: 26, left: 0, zIndex: 60, width: 232,
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
            padding: 10, fontFamily: mono, fontSize: 10, color: C.text,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: C.dim }}>LIVE INPUT</span>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
              <span>Active</span>
            </label>
          </div>

          {ctrls.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              <span style={{ color: C.dim, alignSelf: "center" }}>arm</span>
              {ctrls.map((n) => (
                <button key={n.id} onClick={() => setArmed(n.id)}
                  style={{
                    background: target && n.id === target.id ? C.accent : C.panel2,
                    border: `1px solid ${target && n.id === target.id ? C.accent : C.line}`,
                    color: target && n.id === target.id ? "#0D1117" : C.text,
                    borderRadius: 3, fontSize: 9, padding: "2px 7px", cursor: "pointer", fontFamily: mono,
                  }}>
                  #{n.id}
                </button>
              ))}
            </div>
          )}

          {!target && (
            <div style={{ color: C.dim, lineHeight: 1.5 }}>
              Click a Controller node once to arm it. It stays armed while you
              select and preview other nodes, so the arrow keys keep working with
              the big preview open.
            </div>
          )}
          {target && (
            <>
              <div style={{ color: C.dim, marginBottom: 6 }}>
                {target.params.source} · {tN} ch{target.params.freeze ? " · FROZEN" : ""}
              </div>

              <div
                onMouseDown={(e) => { setPadDrag(true); padSet(e, e.currentTarget); }}
                onMouseMove={(e) => { if (padDrag) padSet(e, e.currentTarget); }}
                onMouseUp={() => setPadDrag(false)}
                onMouseLeave={() => setPadDrag(false)}
                style={{
                  position: "relative", height: 116, marginBottom: 8,
                  background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4,
                  cursor: target.params.freeze ? "not-allowed" : "crosshair",
                  backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
                  backgroundSize: "25% 25%",
                }}>
                <span style={{
                  position: "absolute", width: 11, height: 11, borderRadius: "50%",
                  background: C.accent, border: `2px solid ${C.panel}`, pointerEvents: "none",
                  left: `calc(${clamp01(target.params.v1) * 100}% - 5.5px)`,
                  top: `calc(${(1 - (tN >= 2 ? clamp01(target.params.v2) : 0.5)) * 100}% - 5.5px)`,
                }} />
              </div>

              {Array.from({ length: tN }, (_, i) => (
                <div key={i}
                  onClick={() => setChan(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, marginBottom: 3, cursor: "pointer",
                    color: i === cur ? C.text : C.dim,
                  }}>
                  <span style={{ width: 26 }}>{i === cur ? "\u25B8" : " "}CH{i + 1}</span>
                  <span style={{ flex: 1, height: 5, background: C.panel2, borderRadius: 3, overflow: "hidden" }}>
                    <span style={{
                      display: "block", height: "100%", borderRadius: 3,
                      width: (clamp01(target.params["v" + (i + 1)]) * 100) + "%",
                      background: i === cur ? C.accent : C.line,
                    }} />
                  </span>
                  <span style={{ width: 38, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(target.params["v" + (i + 1)])}
                  </span>
                </div>
              ))}

              <div style={{ color: C.dim, lineHeight: 1.5, marginTop: 7, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                {target.params.source === "Keyboard"
                  ? "\u2191\u2193 value · \u2190\u2192 channel · Shift coarse · Alt fine"
                  : target.params.source === "Gamepad"
                    ? (padName ? "pad: " + padName : "no pad seen \u2014 press a button on it once")
                    : "Manual: sliders and the pad only"}
              </div>
            </>
          )}

          {/* Always-on diagnostics. Cheap, and it turns "nothing happens" from a
              guessing game into a single readable line. */}
          <div data-beat={beat} style={{
            marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.line}`,
            color: C.dim, lineHeight: 1.6, fontSize: 9, wordBreak: "break-word",
          }}>
            <div>arrows seen <span style={{ color: C.text }}>{R.current.diag.keys}</span>
              {" · writes "}<span style={{ color: C.text }}>{R.current.diag.writes}</span>
              {" · frames "}<span style={{ color: C.text }}>{R.current.diag.frames}</span></div>
            <div>armed <span style={{ color: C.text }}>{target ? "#" + target.id : "none"}</span>
              {" · ctrl nodes here "}<span style={{ color: C.text }}>{ctrls.length}</span></div>
            <div>pad <span style={{ color: C.text }}>{R.current.diag.pad}</span></div>
            <div>axes <span style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{R.current.diag.axes || "\u2014"}</span></div>
            <div>last: <span style={{ color: C.text }}>{R.current.diag.why}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
