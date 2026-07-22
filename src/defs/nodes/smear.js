import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "smear",
  name: "Smear",
  cat: "mod",
  group: "deform",
  desc: "Pixel-stretch for lines inside a rectangular zone. Vertical and Horizontal replace zone content with straight axis-aligned streaks at boundary crossings; Free (bridge) joins each path's entry and exit with one straight chord so the line continues unbroken. From edge picks which zone edge feeds the effect: with e.g. Right selected, only right-edge crossings continue - seamlessly attached to their outside line, straight along their own tangent, through the zone - while crossings on other edges are simply cut at the border. Streak length 0 runs to the far zone edge; Keep zone content overlays the original inside the zone.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Streaks", type: "select", options: ["Vertical", "Horizontal", "Free (bridge)"], def: "Vertical" },
    { key: "edge", label: "From edge", type: "select", options: ["All", "Left", "Right", "Top", "Bottom"], def: "All" },
    { key: "zx", label: "Zone X mm", type: "slider", min: 0, max: 400, step: 1, def: 20 },
    { key: "zy", label: "Zone Y mm", type: "slider", min: 0, max: 400, step: 1, def: 15 },
    { key: "zw", label: "Zone W mm", type: "slider", min: 5, max: 400, step: 1, def: 260 },
    { key: "zh", label: "Zone H mm", type: "slider", min: 5, max: 400, step: 1, def: 95 },
    { key: "len", label: "Streak length mm (0 = zone edge)", type: "slider", min: 0, max: 400, step: 1, def: 0 },
    { key: "keep", label: "Keep zone content", type: "check", def: false },
  ],
  overlay(p) {
    return [{ kind: "rect", x: p.zx, y: p.zy, w: p.zw, h: p.zh }];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const x0 = p.zx, y0 = p.zy;
    const x1 = p.zx + Math.max(1, p.zw), y1 = p.zy + Math.max(1, p.zh);
    const inZ = (q) => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
    const bridge = p.mode === "Free (bridge)";
    const fromEdge = p.edge || "All";
    const out = [];
    const cross = (a, b) => {
      let lo = a, hi = b;
      if (inZ(a)) { lo = b; hi = a; }
      for (let k = 0; k < 24; k++) {
        const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
        if (inZ(m)) hi = m; else lo = m;
      }
      return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    };
    const edgeOf = (c) => {
      const d = [
        [Math.abs(c[0] - x0), "Left"], [Math.abs(c[0] - x1), "Right"],
        [Math.abs(c[1] - y0), "Top"], [Math.abs(c[1] - y1), "Bottom"],
      ].sort((a, b) => a[0] - b[0]);
      return d[0][1];
    };
    const edgeOk = (c) => fromEdge === "All" || edgeOf(c) === fromEdge;
    const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
    const rayEnd = (c, d) => {
      let t = Infinity;
      if (d[0] > 1e-9) t = Math.min(t, (x1 - c[0]) / d[0]);
      if (d[0] < -1e-9) t = Math.min(t, (x0 - c[0]) / d[0]);
      if (d[1] > 1e-9) t = Math.min(t, (y1 - c[1]) / d[1]);
      if (d[1] < -1e-9) t = Math.min(t, (y0 - c[1]) / d[1]);
      if (!isFinite(t)) t = 0;
      if (p.len > 0.5) t = Math.min(t, p.len);
      return [c[0] + d[0] * t, c[1] + d[1] * t];
    };
    const streakDir = (tan) => {
      const [ux, uy] = unit(tan);
      if (p.mode === "Horizontal") return [ux >= 0 ? 1 : -1, 0];
      return [0, uy >= 0 ? 1 : -1];
    };
    for (const pa of src.paths) {
      const pts = resample(pa.pts, pa.closed, 1);
      const N = pts.length;
      if (N < 2) { out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }); continue; }
      const anyIn = pts.some(inZ);
      if (!anyIn) { out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }); continue; }
      const seq = pa.closed ? pts.concat([pts[0]]) : pts;
      const L = pa.layer;
      let run = [];
      let insideRun = [];
      let rayDone = false;
      const flushOut = () => { if (run.length > 1) out.push({ pts: run, closed: false, layer: L }); run = []; };
      const flushIn = () => {
        if (p.keep && insideRun.length > 1) out.push({ pts: insideRun, closed: false, layer: L });
        insideRun = [];
      };
      let inside = inZ(seq[0]);
      if (!inside) run.push(seq[0].slice()); else insideRun.push(seq[0].slice());
      for (let i = 1; i < seq.length; i++) {
        const q = seq[i], prev = seq[i - 1];
        const nowIn = inZ(q);
        if (nowIn === inside) {
          if (inside) insideRun.push(q.slice()); else run.push(q.slice());
          continue;
        }
        const c = cross(prev, q);
        const inward = unit(nowIn ? [q[0] - prev[0], q[1] - prev[1]] : [prev[0] - q[0], prev[1] - q[1]]);
        if (!inside && nowIn) {
          /* -------- entering the zone -------- */
          run.push(c.slice());
          if (bridge && fromEdge === "All") {
            /* chord: keep the run open, it continues at the exit crossing */
          } else if (bridge) {
            if (edgeOk(c)) {
              const e = rayEnd(c, inward);
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) run.push(e);
            }
            flushOut();
          } else {
            flushOut();
            if (edgeOk(c)) {
              const e = rayEnd(c, streakDir(inward));
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) out.push({ pts: [c.slice(), e], closed: false, layer: L });
              rayDone = true;
            }
          }
          insideRun = [c.slice(), q.slice()];
        } else {
          /* -------- leaving the zone -------- */
          insideRun.push(c.slice());
          if (bridge && fromEdge === "All") {
            run.push(c.slice());
            run.push(q.slice());
          } else if (bridge) {
            run = [];
            if (edgeOk(c)) {
              const e = rayEnd(c, inward);
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) run.push(e);
            }
            run.push(c.slice());
            run.push(q.slice());
          } else {
            const wantExit = fromEdge === "All" ? !rayDone : edgeOk(c);
            if (wantExit) {
              const e = rayEnd(c, streakDir(inward));
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) out.push({ pts: [c.slice(), e], closed: false, layer: L });
            }
            run = [c.slice(), q.slice()];
          }
          flushIn();
          rayDone = false;
        }
        inside = nowIn;
      }
      flushOut();
      flushIn();
    }
    return { paths: out };
  },
};