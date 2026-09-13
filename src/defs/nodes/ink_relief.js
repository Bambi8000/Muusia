import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "ink_relief",
  name: "Ink Relief",
  cat: "mod",
  group: "deform",
  desc: "Finds the places where the pen inks the same spot over and over and thins them out, leaving the rest of the drawing alone. Two kinds of pile-up get detected. Corners: nested rings from Offset or Morph Layers all turn at the same vertex, the pen decelerates to a near stop each time and a ballpoint leaves a glossy bead — Round replaces the corner with a fillet so the pen never stops, Fan pushes the stacked corners outward along the spike by rank so they spread over a few millimetres, Notch cuts a gap so no ink reaches the corner at all. Overlaps: where a shape pinches, dozens of rings collapse onto the same straight run and the pen redraws one line thirty times — Spread offsets each run perpendicular by rank so a black bar becomes a band of separate lines, Thin keeps every Nth pass and cuts the run out of the others, and Taper cuts most from the middle of the stack and nothing from the outermost, hollowing the bar while keeping its silhouette. Relief scales with how crowded each pile is, set by Min corners and Full strength at, so a stack of thirty gets the full Amount and a stack of six barely any. Target Both runs the corner pass first and looks for overlaps in its result. Show hotspots draws each detected pile on its own pen, which is the fastest way to check the detection before committing a sheet.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "target", label: "Target", type: "select", options: ["Corners", "Overlaps", "Both"], def: "Both" },
    { key: "amount", label: "Amount mm", type: "slider", min: 0.1, max: 10, step: 0.1, def: 1.2 },
    { key: "minCount", label: "Min passes", type: "slider", min: 2, max: 40, step: 1, def: 6 },
    { key: "fullAt", label: "Full strength at", type: "slider", min: 3, max: 120, step: 1, def: 30 },

    { key: "cornerMode", label: "Corner relief", type: "select", options: ["Round", "Fan", "Notch"], def: "Round", showIf: (p) => p.target !== "Overlaps" },
    { key: "radius", label: "Corner radius mm", type: "slider", min: 0.2, max: 20, step: 0.2, def: 2, showIf: (p) => p.target !== "Overlaps" },
    { key: "minTurn", label: "Min turn deg", type: "slider", min: 5, max: 150, step: 1, def: 25, showIf: (p) => p.target !== "Overlaps" },
    { key: "steps", label: "Fillet steps", type: "slider", min: 2, max: 16, step: 1, def: 5, showIf: (p) => p.target !== "Overlaps" && p.cornerMode === "Round" },

    { key: "overlapMode", label: "Overlap relief", type: "select", options: ["Spread", "Thin", "Taper"], def: "Spread", showIf: (p) => p.target !== "Corners" },
    { key: "oTol", label: "Overlap gap mm", type: "slider", min: 0.1, max: 5, step: 0.1, def: 0.6, showIf: (p) => p.target !== "Corners" },
    { key: "oAngle", label: "Overlap angle deg", type: "slider", min: 1, max: 30, step: 1, def: 8, showIf: (p) => p.target !== "Corners" },
    { key: "oSpan", label: "Min run mm", type: "slider", min: 0.5, max: 40, step: 0.5, def: 3, showIf: (p) => p.target !== "Corners" },
    { key: "keepEvery", label: "Keep every Nth", type: "slider", min: 2, max: 10, step: 1, def: 3, showIf: (p) => p.target !== "Corners" && p.overlapMode === "Thin" },

    { key: "showMarks", label: "Show hotspots", type: "check", def: false },
    { key: "markPen", label: "Hotspot pen", type: "pen", def: 1, showIf: (p) => !!p.showMarks },
  ],

  compute(ins, p) {
    const src = ins[0] || EMPTY;
    if (!src.paths || !src.paths.length) return applyStyle({ paths: [] }, ins[0]);

    const amount = Math.max(0, Number(p.amount) || 0);
    const minCount = Math.max(2, Math.round(Number(p.minCount) || 2));
    const fullAt = Math.max(minCount, Math.round(Number(p.fullAt) || minCount));
    const target = p.target || "Both";
    const marks = [];
    let budget = 200000;

    /* crowding -> strength, shared by both passes so one Amount means one thing */
    const strength = (dens) =>
      Math.max(0, Math.min(1, (dens - minCount + 1) / Math.max(1, fullAt - minCount + 1)));

    /* ================= corner pass ================= */
    const cornerPass = (paths) => {
      const radius = Math.max(0.05, Number(p.radius) || 0.05);
      const minTurn = Math.max(0, Number(p.minTurn) || 0);
      const cand = [];
      for (let pi = 0; pi < paths.length; pi++) {
        const pa = paths[pi], pts = pa.pts;
        if (!pts || pts.length < 3) continue;
        const n = pts.length, closed = !!pa.closed;
        const lo = closed ? 0 : 1, hi = closed ? n - 1 : n - 2;
        for (let i = lo; i <= hi; i++) {
          const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
          const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
          const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          if (l1 < 1e-9 || l2 < 1e-9) continue;
          const turn = Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y)) * 180 / Math.PI;
          if (turn < minTurn) continue;
          cand.push({ pi, vi: i, x: b[0], y: b[1], l1, l2, ax: v1x / l1, ay: v1y / l1, bx: v2x / l2, by: v2y / l2 });
        }
      }
      if (!cand.length) return paths;

      const cell = radius, key = (gx, gy) => gx + "," + gy;
      const grid = new Map();
      for (let i = 0; i < cand.length; i++) {
        const k = key(Math.floor(cand[i].x / cell), Math.floor(cand[i].y / cell));
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
      const near = (i) => {
        const c = cand[i], gx = Math.floor(c.x / cell), gy = Math.floor(c.y / cell), out = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const list = grid.get(key(gx + dx, gy + dy));
          if (!list) continue;
          for (const j of list) if (Math.hypot(cand[j].x - c.x, cand[j].y - c.y) <= radius) out.push(j);
        }
        return out;
      };
      const taken = new Int8Array(cand.length);
      const clusters = [];
      for (let i = 0; i < cand.length; i++) {
        if (taken[i]) continue;
        const members = near(i).filter((j) => !taken[j]);
        if (members.length < minCount) continue;
        /* seed stays put: a drifting centroid would make membership depend on
           the order members happened to be visited */
        const cl = { x: cand[i].x, y: cand[i].y, members: [] };
        for (const j of members) { taken[j] = 1; cl.members.push(j); }
        cl.members.sort((a, b) =>
          Math.hypot(cand[a].x - cl.x, cand[a].y - cl.y) - Math.hypot(cand[b].x - cl.x, cand[b].y - cl.y) || a - b);
        clusters.push(cl);
      }
      if (!clusters.length) return paths;

      const act = new Map();
      for (const cl of clusters) {
        marks.push({ kind: "spot", x: cl.x, y: cl.y, r: radius });
        const amt = amount * strength(cl.members.length);
        if (amt <= 1e-6) continue;
        for (let r = 0; r < cl.members.length; r++) {
          const c = cand[cl.members[r]];
          let dx = c.ax - c.bx, dy = c.ay - c.by;
          const dl = Math.hypot(dx, dy);
          if (dl < 1e-9) { dx = -c.ay; dy = c.ax; } else { dx /= dl; dy /= dl; }
          const rank = cl.members.length > 1 ? r / (cl.members.length - 1) : 1;
          if (!act.has(c.pi)) act.set(c.pi, new Map());
          act.get(c.pi).set(c.vi, { amt, dx, dy, rank, l1: c.l1, l2: c.l2 });
        }
      }

      const mode = p.cornerMode || "Round";
      const steps = Math.max(2, Math.round(Number(p.steps) || 2));
      const out = [];
      for (let pi = 0; pi < paths.length; pi++) {
        const pa = paths[pi], m = act.get(pi);
        if (!m || !pa.pts || pa.pts.length < 3) { out.push({ ...pa }); continue; }
        const pts = pa.pts, n = pts.length, closed = !!pa.closed;

        if (mode === "Fan") {
          out.push({ ...pa, pts: pts.map((q, i) => {
            const v = m.get(i);
            if (!v) return [q[0], q[1], q[2]];
            const d = v.amt * v.rank;
            return [q[0] + v.dx * d, q[1] + v.dy * d, q[2]];
          }) });
          continue;
        }
        if (mode === "Round") {
          const np = [];
          for (let i = 0; i < n; i++) {
            const v = m.get(i), b = pts[i];
            if (!v) { np.push([b[0], b[1], b[2]]); continue; }
            const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
            const r = Math.min(v.amt, 0.45 * v.l1, 0.45 * v.l2);
            if (r <= 1e-6) { np.push([b[0], b[1], b[2]]); continue; }
            const p1 = [b[0] + (a[0] - b[0]) / v.l1 * r, b[1] + (a[1] - b[1]) / v.l1 * r];
            const p2 = [b[0] + (c[0] - b[0]) / v.l2 * r, b[1] + (c[1] - b[1]) / v.l2 * r];
            for (let s = 0; s <= steps; s++) {
              const u = s / steps, w = 1 - u;
              np.push([w * w * p1[0] + 2 * w * u * b[0] + u * u * p2[0],
                       w * w * p1[1] + 2 * w * u * b[1] + u * u * p2[1], b[2]]);
            }
          }
          if (budget - np.length < 0) { out.push({ ...pa }); continue; }
          budget -= np.length;
          out.push({ ...pa, pts: np });
          continue;
        }
        /* Notch */
        const cuts = [...m.keys()].filter((i) => closed || (i > 0 && i < n - 1)).sort((a, b) => a - b);
        if (!cuts.length) { out.push({ ...pa }); continue; }
        const at = (i, frac, toward) => {
          const b = pts[i], o = pts[toward];
          const L = Math.hypot(o[0] - b[0], o[1] - b[1]);
          if (L < 1e-9) return [b[0], b[1], b[2]];
          const g = Math.min(frac, 0.45 * L);
          return [b[0] + (o[0] - b[0]) / L * g, b[1] + (o[1] - b[1]) / L * g, b[2]];
        };
        const pieces = [];
        if (closed) {
          for (let ci = 0; ci < cuts.length; ci++) {
            const s = cuts[ci], e = cuts[(ci + 1) % cuts.length];
            const seg = [at(s, m.get(s).amt, (s + 1) % n)];
            let i = (s + 1) % n, guard = 0;
            while (i !== e && guard++ < n) { seg.push([pts[i][0], pts[i][1], pts[i][2]]); i = (i + 1) % n; }
            seg.push(at(e, m.get(e).amt, (e - 1 + n) % n));
            if (seg.length >= 2) pieces.push(seg);
          }
        } else {
          let from = 0;
          for (const ci of cuts) {
            const seg = [];
            for (let i = from; i < ci; i++) seg.push([pts[i][0], pts[i][1], pts[i][2]]);
            seg.push(at(ci, m.get(ci).amt, ci - 1));
            if (seg.length >= 2) pieces.push(seg);
            from = ci;
          }
          const last = cuts[cuts.length - 1];
          const tail = [at(last, m.get(last).amt, last + 1)];
          for (let i = last + 1; i < n; i++) tail.push([pts[i][0], pts[i][1], pts[i][2]]);
          if (tail.length >= 2) pieces.push(tail);
        }
        for (const seg of pieces) {
          if (budget - seg.length < 0) break;
          budget -= seg.length;
          out.push({ ...pa, pts: seg, closed: false });
        }
      }
      return out;
    };

    /* ================= overlap pass ================= */
    const overlapPass = (paths) => {
      const tol = Math.max(0.05, Number(p.oTol) || 0.05);
      const angTol = Math.max(0.5, Number(p.oAngle) || 0.5);
      const minSpan = Math.max(0.1, Number(p.oSpan) || 0.1);
      const mode = p.overlapMode || "Spread";
      const keepEvery = Math.max(2, Math.round(Number(p.keepEvery) || 2));

      /* sample every segment into a grid keyed by cell AND heading, so two runs
         crossing at an angle never count as one pile */
      const cell = tol;
      const grid = new Map();
      const segs = [];
      for (let pi = 0; pi < paths.length; pi++) {
        const pa = paths[pi], pts = pa.pts;
        if (!pts || pts.length < 2) continue;
        const n = pts.length, closed = !!pa.closed;
        const last = closed ? n : n - 1;
        for (let i = 0; i < last; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const L = Math.hypot(dx, dy);
          if (L < 1e-9) continue;
          let ang = Math.atan2(dy, dx) * 180 / Math.PI;
          ang = ((ang % 180) + 180) % 180;
          const si = segs.length;
          segs.push({ pi, i, L, ang, nx: -dy / L, ny: dx / L, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, hot: false });
          const steps = Math.max(1, Math.ceil(L / cell));
          for (let s = 0; s <= steps; s++) {
            const t = s / steps, x = a[0] + dx * t, y = a[1] + dy * t;
            const k = Math.floor(x / cell) + "," + Math.floor(y / cell) + "," + Math.round(ang / angTol);
            if (!grid.has(k)) grid.set(k, { segs: new Set(), paths: new Set() });
            const g = grid.get(k);
            g.segs.add(si);
            g.paths.add(pi);
          }
        }
      }
      if (!segs.length) return paths;

      /* a segment is hot if it shares a cell with enough OTHER paths */
      const hotCells = [];
      for (const [, g] of grid) {
        if (g.paths.size < minCount) continue;
        hotCells.push(g);
        for (const si of g.segs) segs[si].hot = true;
      }
      if (!hotCells.length) return paths;

      /* group hot segments into per-path contiguous runs */
      const runs = [];
      const byPath = new Map();
      for (const s of segs) {
        if (!byPath.has(s.pi)) byPath.set(s.pi, []);
        byPath.get(s.pi).push(s);
      }
      for (const [pi, list] of byPath) {
        list.sort((a, b) => a.i - b.i);
        let cur = null;
        for (const s of list) {
          if (s.hot && cur && s.i === cur.end + 1) { cur.end = s.i; cur.len += s.L; cur.segs.push(s); }
          else if (s.hot) { cur = { pi, start: s.i, end: s.i, len: s.L, segs: [s] }; runs.push(cur); }
          else cur = null;
        }
      }
      const keep = runs.filter((r) => r.len >= minSpan);
      if (!keep.length) return paths;

      /* rank each run across its pile by signed perpendicular position */
      for (const r of keep) {
        const mid = r.segs[Math.floor(r.segs.length / 2)];
        r.ang = mid.ang; r.nx = mid.nx; r.ny = mid.ny;
        r.s = mid.mx * mid.nx + mid.my * mid.ny;
        r.mx = mid.mx; r.my = mid.my;
      }
      const groups = [];
      const used = new Int8Array(keep.length);
      for (let i = 0; i < keep.length; i++) {
        if (used[i]) continue;
        const g = [keep[i]]; used[i] = 1;
        for (let j = i + 1; j < keep.length; j++) {
          if (used[j]) continue;
          const d = Math.hypot(keep[j].mx - keep[i].mx, keep[j].my - keep[i].my);
          let da = Math.abs(keep[j].ang - keep[i].ang);
          if (da > 90) da = 180 - da;
          if (d <= Math.max(keep[i].len, keep[j].len) && da <= angTol) { used[j] = 1; g.push(keep[j]); }
        }
        if (g.length >= minCount) groups.push(g);
      }
      if (!groups.length) return paths;

      const edit = new Map();
      for (const g of groups) {
        g.sort((a, b) => a.s - b.s || a.pi - b.pi);
        const amt = amount * strength(g.length);
        const cx = g.reduce((a, r) => a + r.mx / g.length, 0);
        const cy = g.reduce((a, r) => a + r.my / g.length, 0);
        /* a pile-up along a line is marked as that line, not as a circle the
           size of the run — a 50 mm circle says nothing about what was found */
        const gl = g.reduce((a, r) => Math.max(a, r.len), 0) / 2;
        const dirx = -g[0].ny, diry = g[0].nx;
        marks.push({ kind: "run", x: cx, y: cy, dx: dirx * gl, dy: diry * gl });
        if (amt <= 1e-6) continue;
        for (let r = 0; r < g.length; r++) {
          const run = g[r];
          const t = g.length > 1 ? r / (g.length - 1) : 0.5;
          if (!edit.has(run.pi)) edit.set(run.pi, []);
          edit.get(run.pi).push({ run, t, amt });
        }
      }

      const out = [];
      for (let pi = 0; pi < paths.length; pi++) {
        const pa = paths[pi], list = edit.get(pi);
        if (!list || !pa.pts) { out.push({ ...pa }); continue; }
        const pts = pa.pts, n = pts.length, closed = !!pa.closed;

        if (mode === "Spread") {
          const off = new Map();
          for (const e of list) {
            const d = (e.t - 0.5) * e.amt;
            for (let i = e.run.start; i <= e.run.end + 1; i++) off.set(i % n, [e.run.nx * d, e.run.ny * d]);
          }
          out.push({ ...pa, pts: pts.map((q, i) => {
            const o = off.get(i);
            return o ? [q[0] + o[0], q[1] + o[1], q[2]] : [q[0], q[1], q[2]];
          }) });
          continue;
        }

        /* Thin and Taper both remove a centred slice of the run */
        const cutRanges = [];
        for (const e of list) {
          const rank = Math.round(e.t * 1000);
          let frac;
          if (mode === "Thin") frac = (rank % keepEvery === 0) ? 0 : 1;
          else frac = 1 - Math.abs(e.t - 0.5) * 2;   /* Taper: hollow the middle, keep the silhouette */
          if (frac <= 0.02) continue;
          const a = e.run.start, b = e.run.end + 1;
          const mid = (a + b) / 2, half = ((b - a) * frac) / 2;
          cutRanges.push([Math.max(a, Math.ceil(mid - half)), Math.min(b, Math.floor(mid + half))]);
        }
        if (!cutRanges.length) { out.push({ ...pa }); continue; }
        const cut = new Set();
        for (const [a, b] of cutRanges) for (let i = a; i <= b; i++) cut.add(i % n);
        const pieces = [];
        let seg = [];
        const order = closed ? n + 1 : n;
        for (let k = 0; k < order; k++) {
          const i = k % n;
          if (cut.has(i)) { if (seg.length >= 2) pieces.push(seg); seg = []; }
          else seg.push([pts[i][0], pts[i][1], pts[i][2]]);
        }
        if (seg.length >= 2) pieces.push(seg);
        for (const s of pieces) {
          if (budget - s.length < 0) break;
          budget -= s.length;
          out.push({ ...pa, pts: s, closed: false });
        }
      }
      return out;
    };

    /* ================= run the passes ================= */
    let paths = src.paths.map((q) => ({ ...q }));
    if (target !== "Overlaps") paths = cornerPass(paths);
    if (target !== "Corners") paths = overlapPass(paths);

    if (p.showMarks) {
      const mp = Math.max(0, Math.min(11, Math.round(Number(p.markPen) || 0)));
      for (const m of marks) {
        if (m.kind === "run") {
          paths.push({ pts: [[m.x - m.dx, m.y - m.dy], [m.x + m.dx, m.y + m.dy]], closed: false, layer: mp });
          continue;
        }
        const ring = [];
        for (let s = 0; s < 24; s++) {
          const a = (s / 24) * Math.PI * 2;
          ring.push([m.x + Math.cos(a) * m.r, m.y + Math.sin(a) * m.r]);
        }
        paths.push({ pts: ring, closed: true, layer: mp });
      }
    }

    return applyStyle({ paths }, ins[0]);
  },
};
