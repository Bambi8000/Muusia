import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "woven_ribbon",
  name: "Woven Ribbon",
  cat: "gen",
  group: "structural",
  desc: "A multi-track ribbon woven over and under itself. A seeded walk on a grid lays out the spine (never reusing an edge; at an already-visited point it passes straight through, creating a perpendicular crossing), corners become exact arcs, and the spine is offset into a center line plus Offset pairs parallel tracks at Track spacing. At every self-crossing the under pass is clipped by the full width of the over pass plus Gap - the classic cover-underpasses weave, so nothing in the output ever intersects. Weave picks who goes under: Alternate (checkerboard basket weave), Later over, or Earlier over. End caps close the loose ends with nested semicircles. Grid sets the cell size in mm, Steps the walk length, Straightness the urge to keep going straight (1 = only turns when forced). Track spacing auto-shrinks if the tracks would not fit the grid corners.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "grid", label: "Grid (mm)", type: "slider", min: 8, max: 40, step: 1, def: 20 },
    { key: "steps", label: "Steps", type: "slider", min: 10, max: 120, step: 1, def: 46 },
    { key: "straight", label: "Straightness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "pairs", label: "Offset pairs", type: "slider", min: 1, max: 8, step: 1, def: 5 },
    { key: "spacing", label: "Track spacing", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.5 },
    { key: "weave", label: "Weave", type: "select", options: ["Alternate", "Later over", "Earlier over"], def: "Alternate" },
    { key: "gap", label: "Gap (mm)", type: "slider", min: 0, max: 3, step: 0.1, def: 0.9 },
    { key: "caps", label: "End caps", type: "check", def: true },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(ctx.W, ctx.H) / 2 - 2));
    return [{ kind: "rect", x: mg, y: mg, w: ctx.W - 2 * mg, h: ctx.H - 2 * mg }];
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const S = Math.round(+p.seed || 0);
    const G = Math.max(4, +p.grid || 20);
    const steps = Math.max(4, Math.min(400, Math.round(+p.steps || 46)));
    const straight = Math.max(0, Math.min(1, +p.straight || 0));
    const pairs = Math.max(1, Math.min(12, Math.round(+p.pairs || 5)));
    const clear = Math.max(0, +p.gap || 0);
    const layer = Math.round(+p.layer || 0);
    const mode = String(p.weave || "Alternate");

    // track spacing auto-clamped so all tracks fit around a grid corner arc
    const eff = Math.max(0.3, Math.min(+p.spacing || 1.5, (G / 2 - 1.5) / pairs));
    const off = pairs * eff;
    const R = Math.min(G / 2, off + Math.max(1.5, G * 0.1));
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const inset = mg + off + 1;
    // compact board (side ~ sqrt(steps)) so the walk weaves through itself
    // instead of wandering; centered in the margin box
    const side = Math.ceil(Math.sqrt(steps)) + 1;
    const nx = Math.min(side, Math.floor((W - 2 * inset) / G));
    const ny = Math.min(side, Math.floor((H - 2 * inset) / G));
    if (nx < 2 || ny < 2) return EMPTY;
    const ox = inset + (W - 2 * inset - nx * G) / 2;
    const oy = inset + (H - 2 * inset - ny * G) / 2;
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

    // ---- seeded rollout walk: no edge reuse, straight-through at revisited
    // vertices (perpendicular crossings only), vertex crossed max twice.
    // Many cheap random rollouts, best scored by length + crossings.
    const doWalk = (attempt) => {
      const rng = mulberry32(S * 7919 + attempt * 613 + 29);
      const edges = new Set();
      const vAxes = new Map(); // "x,y" -> { 0: walkIdx, 1: walkIdx }
      const walk = [];
      const crossings = [];
      const eKey = (a, b) => (a[0] + a[1] * 1000 < b[0] + b[1] * 1000)
        ? a[0] + "," + a[1] + ":" + b[0] + "," + b[1]
        : b[0] + "," + b[1] + ":" + a[0] + "," + a[1];
      let pos = [1 + Math.floor(rng() * (nx - 1)), 1 + Math.floor(rng() * (ny - 1))];
      let d = Math.floor(rng() * 4);
      walk.push(pos.slice());
      vAxes.set(pos[0] + "," + pos[1], { [d % 2]: 0 });
      for (let st = 0; st < steps; st++) {
        const here = vAxes.get(pos[0] + "," + pos[1]) || {};
        const atCrossing = here[0] !== undefined && here[1] !== undefined;
        const cand = [];
        for (const nd of atCrossing ? [d] : [d, (d + 1) % 4, (d + 3) % 4]) {
          const t = [pos[0] + DIRS[nd][0], pos[1] + DIRS[nd][1]];
          if (t[0] < 0 || t[0] > nx || t[1] < 0 || t[1] > ny) continue;
          if (edges.has(eKey(pos, t))) continue;
          const rec = vAxes.get(t[0] + "," + t[1]);
          if (rec && rec[nd % 2] !== undefined) continue; // collinear overlap
          let wgt = nd === d ? (straight >= 1 ? 1e9 : 0.4 + straight * 4) : 1;
          if (rec && rec[(nd + 1) % 2] !== undefined) wgt *= 3.5; // seek crossings
          if (t[0] === 0 || t[0] === nx || t[1] === 0 || t[1] === ny) wgt *= 0.5;
          cand.push([nd, t, wgt]);
        }
        if (!cand.length) break;
        let sum = 0;
        for (const c of cand) sum += c[2];
        let r = rng() * sum, pick = cand[0];
        for (const c of cand) { r -= c[2]; if (r <= 0) { pick = c; break; } }
        edges.add(eKey(pos, pick[1]));
        d = pick[0];
        pos = pick[1];
        const idx = walk.length;
        const rec = vAxes.get(pos[0] + "," + pos[1]);
        if (rec && rec[(d + 1) % 2] !== undefined && rec[d % 2] === undefined) {
          crossings.push({ vx: pos[0], vy: pos[1], i1: rec[(d + 1) % 2], i2: idx });
        }
        if (!rec) vAxes.set(pos[0] + "," + pos[1], { [d % 2]: idx });
        else if (rec[d % 2] === undefined) rec[d % 2] = idx;
        walk.push(pos.slice());
      }
      // never end ON a crossing: pop trailing crossing arrivals
      while (walk.length > 2) {
        const last = walk.length - 1;
        const hit = crossings.findIndex((c) => c.i2 === last);
        if (hit < 0) break;
        crossings.splice(hit, 1);
        walk.pop();
      }
      return { walk, crossings, score: walk.length + crossings.length * 6 };
    };
    let best = null;
    for (let a = 0; a < 40; a++) {
      const w = doWalk(a);
      if (!best || w.score > best.score) best = w;
    }
    const { walk, crossings } = best;
    if (walk.length < 3) return EMPTY;
    const XY = (v) => [ox + v[0] * G, oy + v[1] * G];

    // ---- centerline: lines + exact corner arcs, dense samples [x,y,s,tx,ty]
    let clen = (walk.length - 1) * G;
    let turns = 0;
    for (let i = 1; i < walk.length - 1; i++) {
      const a = walk[i - 1], b = walk[i], c = walk[i + 1];
      if ((c[0] - b[0]) !== (b[0] - a[0]) || (c[1] - b[1]) !== (b[1] - a[1])) turns++;
    }
    clen += turns * ((Math.PI / 2) * R - 2 * R);
    const tracks = 2 * pairs + 1;
    const DS = Math.max(0.45, Math.min(1.2, (clen * tracks) / 90000));

    const pts = [];
    const sAt = new Array(walk.length).fill(-1);
    let s = 0;
    let cur = XY(walk[0]);
    const pushLine = (to, tx, ty, endIdx) => {
      const len = Math.hypot(to[0] - cur[0], to[1] - cur[1]);
      const n = Math.max(1, Math.ceil(len / DS));
      for (let u = 1; u <= n; u++) {
        const t = u / n;
        pts.push([cur[0] + (to[0] - cur[0]) * t, cur[1] + (to[1] - cur[1]) * t, s + len * t, tx, ty]);
      }
      s += len;
      cur = to;
      if (endIdx !== undefined) sAt[endIdx] = s;
    };
    const pushArc = (O, a0, sweep, midIdx) => {
      const len = Math.abs(sweep) * R;
      const n = Math.max(2, Math.ceil(len / DS));
      for (let u = 1; u <= n; u++) {
        const a = a0 + sweep * (u / n);
        const sg = Math.sign(sweep);
        pts.push([O[0] + Math.cos(a) * R, O[1] + Math.sin(a) * R, s + len * (u / n), -Math.sin(a) * sg, Math.cos(a) * sg]);
      }
      if (midIdx !== undefined) sAt[midIdx] = s + len / 2;
      s += len;
      cur = pts[pts.length - 1].slice(0, 2);
    };
    {
      const d0 = [walk[1][0] - walk[0][0], walk[1][1] - walk[0][1]];
      pts.push([cur[0], cur[1], 0, d0[0], d0[1]]);
      sAt[0] = 0;
    }
    for (let i = 1; i < walk.length; i++) {
      const din = [walk[i][0] - walk[i - 1][0], walk[i][1] - walk[i - 1][1]];
      if (i === walk.length - 1) { pushLine(XY(walk[i]), din[0], din[1], i); break; }
      const dout = [walk[i + 1][0] - walk[i][0], walk[i + 1][1] - walk[i][1]];
      if (din[0] === dout[0] && din[1] === dout[1]) {
        pushLine(XY(walk[i]), din[0], din[1], i);
      } else {
        const P = XY(walk[i]);
        const A = [P[0] - din[0] * R, P[1] - din[1] * R];
        const O = [A[0] + dout[0] * R, A[1] + dout[1] * R];
        pushLine(A, din[0], din[1]);
        const a0 = Math.atan2(A[1] - O[1], A[0] - O[0]);
        const sweep = (Math.PI / 2) * Math.sign(din[0] * dout[1] - din[1] * dout[0]);
        pushArc(O, a0, sweep, i);
      }
    }
    const totalS = s;

    // ---- under-pass clip windows on the centerline arclength
    const hg = off + eff * 0.5 + clear;
    let windows = [];
    for (const c of crossings) {
      const s1 = sAt[c.i1], s2 = sAt[c.i2];
      if (s1 < 0 || s2 < 0) continue;
      let under;
      if (mode === "Later over") under = s1;
      else if (mode === "Earlier over") under = s2;
      else under = (c.vx + c.vy) % 2 === 0 ? s2 : s1;
      windows.push([under - hg, under + hg]);
    }
    windows.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const w of windows) {
      if (merged.length && w[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], w[1]);
      } else merged.push(w.slice());
    }
    const inGap = (sv) => {
      for (const [a, b] of merged) { if (sv >= a && sv <= b) return true; if (a > sv) break; }
      return false;
    };

    // ---- emit tracks (split at gaps) + optional end caps
    const paths = [];
    for (let k = -pairs; k <= pairs; k++) {
      const d = k * eff;
      let run = [];
      for (const q of pts) {
        if (inGap(q[2])) {
          if (run.length >= 2) paths.push({ pts: run, closed: false, layer });
          run = [];
          continue;
        }
        run.push([q[0] - q[4] * d, q[1] + q[3] * d]);
      }
      if (run.length >= 2) paths.push({ pts: run, closed: false, layer });
    }
    if (p.caps) {
      const capAt = (P, t, forward, sEdge) => {
        const nearWin = merged.some(([a, b]) => sEdge > a - (off + 1) && sEdge < b + (off + 1));
        if (nearWin) return;
        const nA = Math.atan2(t[0], -t[1]); // normal angle (-ty,tx)
        const mid = Math.atan2(forward ? t[1] : -t[1], forward ? t[0] : -t[0]);
        let sg = Math.sin(mid - nA) > 0 ? 1 : -1;
        for (let k = 1; k <= pairs; k++) {
          const r = k * eff;
          const n = Math.max(6, Math.ceil((Math.PI * r) / DS));
          const arc = [];
          for (let u = 0; u <= n; u++) {
            const a = nA + sg * Math.PI * (u / n);
            arc.push([P[0] + Math.cos(a) * r, P[1] + Math.sin(a) * r]);
          }
          paths.push({ pts: arc, closed: false, layer });
        }
      };
      const p0 = pts[0], pE = pts[pts.length - 1];
      capAt([p0[0], p0[1]], [p0[3], p0[4]], false, 0);
      capAt([pE[0], pE[1]], [pE[3], pE[4]], true, totalS);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
