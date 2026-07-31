import React, { useState, useRef, useEffect } from "react";

/* ============================================================
   DRO — live position readout over the Moonraker websocket.

   Self-contained: owns its WebSocket, JSON-RPC bookkeeping and
   reconnect loop. App.jsx only mounts <DroPanel url={...} />.

   Protocol (Moonraker JSON-RPC over WS):
   - on open: printer.objects.subscribe
       { motion_report: ["live_position"], toolhead: ["homed_axes"] }
     -> response carries the initial status snapshot
   - after that: "notify_status_update" notifications stream deltas
   - "notify_klippy_ready" / "notify_klippy_disconnected" /
     "notify_klippy_shutdown" track firmware state.

   Security note: the URL should point at a LAN address; Moonraker's
   cors_domains must include this app's origin (see moonraker.conf).
   ============================================================ */

const C = {
  line: "#2C3240", panel2: "#232834", text: "#CBD1DE", dim: "#828BA0",
  ok: "#5BBF7A", warn: "#E0B341", err: "#E2574A",
};
const mono = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

const RETRY_MS = 3000;

export default function DroPanel({ url }) {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem("muusia-dro-on") === "1"; } catch (e) { return false; }
  });
  /* state: off | connecting | ready | klippy-down | error */
  const [conn, setConn] = useState("off");
  const [pos, setPos] = useState(null);        /* [x, y, z, e] mm */
  const [homed, setHomed] = useState("");      /* e.g. "xyz" */
  const wsRef = useRef(null);
  const subIdRef = useRef(0);
  const retryRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("muusia-dro-on", on ? "1" : "0"); } catch (e) { /* ignore */ }
    if (!on || !url) {
      if (wsRef.current) { try { wsRef.current.close(); } catch (e) { /* ignore */ } wsRef.current = null; }
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      setConn("off"); setPos(null); setHomed("");
      return undefined;
    }
    let dead = false;

    const applyStatus = (st) => {
      if (!st) return;
      if (st.motion_report && Array.isArray(st.motion_report.live_position)) {
        setPos(st.motion_report.live_position);
      }
      if (st.toolhead && typeof st.toolhead.homed_axes === "string") {
        setHomed(st.toolhead.homed_axes);
      }
    };

    const connect = () => {
      if (dead) return;
      setConn("connecting");
      let ws;
      try { ws = new WebSocket(url); } catch (e) { setConn("error"); scheduleRetry(); return; }
      wsRef.current = ws;
      ws.onopen = () => {
        subIdRef.current = Math.floor(Math.random() * 1e6) + 1;
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          method: "printer.objects.subscribe",
          params: { objects: { motion_report: ["live_position"], toolhead: ["homed_axes"] } },
          id: subIdRef.current,
        }));
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.id === subIdRef.current) {
          if (msg.error) { setConn("klippy-down"); return; }  /* klippy not ready yet */
          setConn("ready");
          applyStatus(msg.result && msg.result.status);
          return;
        }
        if (msg.method === "notify_status_update" && msg.params && msg.params[0]) {
          applyStatus(msg.params[0]);
        } else if (msg.method === "notify_klippy_ready") {
          /* re-subscribe: klippy restart invalidates subscriptions */
          setConn("ready");
          subIdRef.current = Math.floor(Math.random() * 1e6) + 1;
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method: "printer.objects.subscribe",
            params: { objects: { motion_report: ["live_position"], toolhead: ["homed_axes"] } },
            id: subIdRef.current,
          }));
        } else if (msg.method === "notify_klippy_disconnected" || msg.method === "notify_klippy_shutdown") {
          setConn("klippy-down"); setPos(null); setHomed("");
        }
      };
      ws.onerror = () => { /* onclose fires next; keep state changes there */ };
      ws.onclose = () => {
        wsRef.current = null;
        if (dead) return;
        setConn("error"); setPos(null); setHomed("");
        scheduleRetry();
      };
    };
    const scheduleRetry = () => {
      if (dead || retryRef.current) return;
      retryRef.current = setTimeout(() => { retryRef.current = null; connect(); }, RETRY_MS);
    };

    connect();
    return () => {
      dead = true;
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      if (wsRef.current) { try { wsRef.current.close(); } catch (e) { /* ignore */ } wsRef.current = null; }
    };
  }, [on, url]);

  const dotColor =
    conn === "ready" ? C.ok :
    conn === "connecting" ? C.warn :
    conn === "klippy-down" ? C.warn :
    conn === "error" ? C.err : C.dim;
  const label =
    conn === "ready" ? "DRO" :
    conn === "connecting" ? "DRO…" :
    conn === "klippy-down" ? "DRO (klippy)" :
    conn === "error" ? "DRO (retry)" : "DRO";
  const f = (v) => (typeof v === "number" && isFinite(v) ? v.toFixed(2) : "—");
  const ax = (name, v, homedFlag) => (
    <span style={{ color: homedFlag ? C.text : C.dim, marginLeft: 6 }}>
      <span style={{ color: C.dim }}>{name}</span>{f(v)}
    </span>
  );

  return (
    <div
      title={on ? `Moonraker: ${url || "(no URL in machine profile)"}\nClick to disconnect` : "Click to connect to Moonraker (live position DRO)"}
      onClick={() => setOn((v) => !v)}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
        background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4,
        fontFamily: mono, fontSize: 10, cursor: "pointer", userSelect: "none",
        opacity: on ? 1 : 0.7,
      }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
      <span style={{ color: C.dim }}>{label}</span>
      {on && conn === "ready" && pos && (
        <span>
          {ax("X", pos[0], homed.includes("x"))}
          {ax("Y", pos[1], homed.includes("y"))}
          {ax("Z", pos[2], homed.includes("z"))}
        </span>
      )}
    </div>
  );
}
