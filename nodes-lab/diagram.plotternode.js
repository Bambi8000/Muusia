({
  key: "diagram",
  name: "Diagram",
  cat: "gen",
  group: "structural",
  desc: "Flow-diagram generator: numbered circle or square nodes joined by directed orthogonal arrow lines, like a textbook state diagram. Layout places nodes on a ring, grid or at random (Jitter loosens it); a base cycle of links is always drawn and Extra links adds random chords. Line style picks thick filled arrows (outline + parallel fill strokes + solid arrowhead), thick outline only, or a plain single line with a V head. Crossings = Under cuts a clean gap into the lower line where another line passes over it (Gap clearance adds air); Cross lets them intersect. Corners are Rounded, chamfered 45\u00b0 or hard 90\u00b0 (Corner radius sets the size). Tip: drive Seed with an animation clock for an ever-reshuffling diagram.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "nodes", label: "Nodes", type: "slider", min: 2, max: 12, step: 1, def: 4 },
    { key: "shape", label: "Shape", type: "select", options: ["Circle", "Square"], def: "Circle" },
    { key: "nodeSize", label: "Node radius", type: "slider", min: 4, max: 30, step: 0.5, def: 13 },
    { key: "layout", label: "Layout", type: "select", options: ["Ring", "Grid", "Random"], def: "Ring" },
    { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "extra", label: "Extra links", type: "slider", min: 0, max: 8, step: 1, def: 2 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "style", label: "Line style", type: "select", options: ["Thick filled", "Thick outline", "Single line"], def: "Thick filled" },
    { key: "width", label: "Line width", type: "slider", min: 1, max: 12, step: 0.1, def: 4.5 },
    { key: "fillStep", label: "Fill spacing", type: "slider", min: 0.3, max: 3, step: 0.05, def: 0.8 },
    { key: "headLen", label: "Arrowhead", type: "slider", min: 3, max: 20, step: 0.5, def: 9 },
    { key: "crossing", label: "Crossings", type: "select", options: ["Under", "Cross"], def: "Under" },
    { key: "gap", label: "Gap clearance", type: "slider", min: 0, max: 6, step: 0.1, def: 1.5 },
    { key: "corners", label: "Corners", type: "select", options: ["Rounded", "45\u00b0", "90\u00b0"], def: "Rounded" },
    { key: "cornerR", label: "Corner radius", type: "slider", min: 1, max: 25, step: 0.5, def: 8 },
    { key: "labels", label: "Number labels", type: "check", def: true },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 50, step: 1, def: 15 },
    { key: "nodePen", label: "Node pen", type: "pen", def: 0 },
    { key: "linePen", label: "Line pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const N = Math.max(2, Math.round(p.nodes));
    const R = Math.max(2, p.nodeSize);
    const margin = Math.max(0, p.margin);
    const thick = p.style !== "Single line";
    const w = thick ? Math.max(0.6, p.width) : 0;
    const lineW = thick ? w : 1.2;
    const headLen = Math.max(2, p.headLen);
    const fillStep = Math.max(0.3, p.fillStep);
    const gapPad = Math.max(0, p.gap);
    const cornR = Math.max(0.5, p.cornerR);
    const nodePen = Math.round(p.nodePen) % PENS.length;
    const linePen = Math.round(p.linePen) % PENS.length;
    const rng = mulberry32(Math.round(p.seed) * 7919 + 13);

    const lo = [margin + R, margin + R];
    const hi = [W - margin - R, H - margin - R];
    if (hi[0] <= lo[0] || hi[1] <= lo[1]) return EMPTY;
    const clampP = (x, y) => [
      Math.min(hi[0], Math.max(lo[0], x)),
      Math.min(hi[1], Math.max(lo[1], y)),
    ];

    /* ---------- node layout ---------- */
    const nodes = [];
    if (p.layout === "Ring") {
      const cx = W / 2, cy = H / 2;
      const rx = Math.max(1, (W - 2 * margin) / 2 - R);
      const ry = Math.max(1, (H - 2 * margin) / 2 - R);
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + (i / N) * Math.PI * 2 +
          (rng() - 0.5) * p.jitter * (Math.PI / N);
        const rr = 1 - rng() * 0.3 * p.jitter;
        const [x, y] = clampP(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr);
        nodes.push({ x, y });
      }
    } else if (p.layout === "Grid") {
      const cols = Math.ceil(Math.sqrt(N));
      const rows = Math.ceil(N / cols);
      const cw = (hi[0] - lo[0]) / Math.max(1, cols - 1 || 1);
      const ch = (hi[1] - lo[1]) / Math.max(1, rows - 1 || 1);
      for (let i = 0; i < N; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const jx = (rng() - 0.5) * p.jitter * cw * 0.5;
        const jy = (rng() - 0.5) * p.jitter * ch * 0.5;
        const x = cols === 1 ? (lo[0] + hi[0]) / 2 : lo[0] + c * cw;
        const y = rows === 1 ? (lo[1] + hi[1]) / 2 : lo[1] + r * ch;
        const [px, py] = clampP(x + jx, y + jy);
        nodes.push({ x: px, y: py });
      }
    } else {
      const minD = R * 2.6;
      for (let i = 0; i < N; i++) {
        let best = null;
        for (let t = 0; t < 80; t++) {
          const x = lo[0] + rng() * (hi[0] - lo[0]);
          const y = lo[1] + rng() * (hi[1] - lo[1]);
          let ok = true;
          for (const n of nodes)
            if (Math.hypot(n.x - x, n.y - y) < minD) { ok = false; break; }
          if (ok) { best = [x, y]; break; }
          if (!best) best = [x, y];
        }
        nodes.push({ x: best[0], y: best[1] });
      }
    }

    /* ---------- edge list: base cycle + extra chords ---------- */
    const edges = [];
    const has = (a, b) =>
      edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (N === 2) edges.push({ a: 0, b: 1 });
    else for (let i = 0; i < N; i++) edges.push({ a: i, b: (i + 1) % N });
    const extra = Math.max(0, Math.round(p.extra));
    for (let k = 0, tries = 0; k < extra && tries < 60; tries++) {
      let a = Math.floor(rng() * N), b = Math.floor(rng() * N);
      if (rng() < 0.5) { const t = a; a = b; b = t; }
      if (a === b || has(a, b)) continue;
      edges.push({ a, b });
      k++;
    }

    /* ---------- geometry utils ---------- */
    const dedupe = (pts) => {
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const q = out[out.length - 1];
        if (Math.hypot(pts[i][0] - q[0], pts[i][1] - q[1]) > 0.05) out.push(pts[i]);
      }
      return out;
    };
    const segNodeDist = (a, b, n) => {
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const L2 = vx * vx + vy * vy;
      let t = L2 < 1e-9 ? 0 : ((n.x - a[0]) * vx + (n.y - a[1]) * vy) / L2;
      t = Math.min(1, Math.max(0, t));
      return Math.hypot(a[0] + vx * t - n.x, a[1] + vy * t - n.y);
    };
    const plen = (pts) => {
      let l = 0;
      for (let i = 1; i < pts.length; i++)
        l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return l;
    };

    // trim a center-to-center polyline to node boundaries
    const trimRoute = (pts, tipShort) => {
      let P = dedupe(pts);
      if (P.length < 2) return null;
      // start: advance R from node A along the path
      const eat = (arr, dist) => {
        let d = dist;
        while (arr.length > 1) {
          const L = Math.hypot(arr[1][0] - arr[0][0], arr[1][1] - arr[0][1]);
          if (L > d + 0.2) {
            const t = d / L;
            arr[0] = [arr[0][0] + (arr[1][0] - arr[0][0]) * t,
                      arr[0][1] + (arr[1][1] - arr[0][1]) * t];
            return arr;
          }
          d -= L;
          arr.shift();
        }
        return null;
      };
      P = eat(P, R);
      if (!P) return null;
      P = eat(P.reverse(), R + tipShort);
      if (!P) return null;
      return P.reverse();
    };

    // orthogonal route candidates between node centers
    const buildRoute = (A, B, others) => {
      const dx = B.x - A.x, dy = B.y - A.y;
      const cand = [];
      const L1 = [[A.x, A.y], [B.x, A.y], [B.x, B.y]]; // HV
      const L2 = [[A.x, A.y], [A.x, B.y], [B.x, B.y]]; // VH
      if (Math.abs(dx) >= Math.abs(dy)) cand.push(L1, L2); else cand.push(L2, L1);
      if (rng() < 0.4) cand.reverse();
      const t = 0.35 + 0.3 * rng();
      cand.push([[A.x, A.y], [A.x + dx * t, A.y], [A.x + dx * t, B.y], [B.x, B.y]]);
      cand.push([[A.x, A.y], [A.x, A.y + dy * t], [B.x, A.y + dy * t], [B.x, B.y]]);
      let best = null, bestScore = Infinity;
      for (const c of cand) {
        const P = trimRoute(c.map((q) => q.slice()), 0);
        if (!P || P.length < 2) continue;
        let score = 0;
        for (let i = 1; i < P.length; i++) {
          for (const n of others) {
            const d = segNodeDist(P[i - 1], P[i], n);
            if (d < R + lineW / 2 + 1.5) score += 10;
          }
        }
        const lastL = Math.hypot(P[P.length - 1][0] - P[P.length - 2][0],
                                 P[P.length - 1][1] - P[P.length - 2][1]);
        if (lastL < headLen + 3) score += 4;
        const firstL = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
        if (firstL < 3) score += 2;
        if (score < bestScore) { bestScore = score; best = P; }
        if (score === 0) break;
      }
      return best;
    };

    // corner treatment (Rounded / 45 / 90)
    const cornerize = (pts) => {
      if (p.corners === "90\u00b0" || pts.length < 3) return pts;
      const out = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], v = pts[i], b = pts[i + 1];
        const la = Math.hypot(v[0] - a[0], v[1] - a[1]);
        const lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
        const c = Math.min(cornR, la * 0.45, lb * 0.45);
        if (c < 0.3) { out.push(v); continue; }
        const da = [(v[0] - a[0]) / la, (v[1] - a[1]) / la];
        const db = [(b[0] - v[0]) / lb, (b[1] - v[1]) / lb];
        // nearly straight corner: arc center would land on the vertex and
        // bulge a half-circle — skip rounding collinear vertices
        if (Math.abs(da[0] * db[1] - da[1] * db[0]) < 0.03 &&
            da[0] * db[0] + da[1] * db[1] > 0) { out.push(v); continue; }
        const p1 = [v[0] - da[0] * c, v[1] - da[1] * c];
        const p2 = [v[0] + db[0] * c, v[1] + db[1] * c];
        if (p.corners === "45\u00b0") { out.push(p1, p2); continue; }
        const cx = v[0] - da[0] * c + db[0] * c;
        const cy = v[1] - da[1] * c + db[1] * c;
        const a0 = Math.atan2(p1[1] - cy, p1[0] - cx);
        const a1 = Math.atan2(p2[1] - cy, p2[0] - cx);
        let dA = a1 - a0;
        while (dA > Math.PI) dA -= 2 * Math.PI;
        while (dA < -Math.PI) dA += 2 * Math.PI;
        const steps = Math.max(4, Math.round(Math.abs(dA) / (Math.PI / 16)));
        for (let k = 0; k <= steps; k++) {
          const ang = a0 + (dA * k) / steps;
          out.push([cx + Math.cos(ang) * c, cy + Math.sin(ang) * c]);
        }
      }
      out.push(pts[pts.length - 1]);
      return dedupe(out);
    };

    /* ---------- build centerlines ---------- */
    const center = [];
    for (const e of edges) {
      const others = nodes.filter((_, i) => i !== e.a && i !== e.b);
      const P = buildRoute(nodes[e.a], nodes[e.b], others);
      center.push(P ? cornerize(P) : null);
    }

    /* ---------- crossings: cut gaps into the "under" line ---------- */
    const gaps = center.map(() => []);
    if (p.crossing === "Under") {
      const halfGap = (lineW + (thick ? 0 : 0)) / 2 + gapPad + lineW / 2;
      for (let i = 0; i < center.length; i++) {
        if (!center[i]) continue;
        for (let j = i + 1; j < center.length; j++) {
          if (!center[j]) continue;
          let si = 0;
          for (let a = 1; a < center[i].length; a++) {
            const A0 = center[i][a - 1], A1 = center[i][a];
            const segL = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]);
            for (let b = 1; b < center[j].length; b++) {
              const B0 = center[j][b - 1], B1 = center[j][b];
              const rx = A1[0] - A0[0], ry = A1[1] - A0[1];
              const sx = B1[0] - B0[0], sy = B1[1] - B0[1];
              const den = rx * sy - ry * sx;
              if (Math.abs(den) < 1e-9) continue;
              const qx = B0[0] - A0[0], qy = B0[1] - A0[1];
              const t = (qx * sy - qy * sx) / den;
              const u = (qx * ry - qy * rx) / den;
              if (t <= 0.002 || t >= 0.998 || u <= 0.002 || u >= 0.998) continue;
              gaps[i].push([si + t * segL - halfGap, si + t * segL + halfGap]);
            }
            si += segL;
          }
        }
      }
    }

    // split polyline by arclength gap intervals
    const cutGaps = (pts, iv) => {
      if (!iv.length) return [pts];
      const total = plen(pts);
      iv = iv.map(([a, b]) => [Math.max(0, a), Math.min(total, b)])
             .filter(([a, b]) => b > a)
             .sort((x, y) => x[0] - y[0]);
      const merged = [];
      for (const g of iv) {
        const m = merged[merged.length - 1];
        if (m && g[0] <= m[1]) m[1] = Math.max(m[1], g[1]);
        else merged.push(g.slice());
      }
      const keep = [];
      let cur = 0;
      for (const [a, b] of merged) {
        if (a - cur > 1) keep.push([cur, a]);
        cur = Math.max(cur, b);
      }
      if (total - cur > 1) keep.push([cur, total]);
      const at = (s) => {
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (acc + L >= s - 1e-6) {
            const t = L < 1e-9 ? 0 : (s - acc) / L;
            return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
                    pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, i];
          }
          acc += L;
        }
        return [pts[pts.length - 1][0], pts[pts.length - 1][1], pts.length - 1];
      };
      const out = [];
      for (const [a, b] of keep) {
        const [x0, y0, i0] = at(a);
        const [x1, y1, i1] = at(b);
        const sub = [[x0, y0]];
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          acc += L;
          if (acc > a + 0.05 && acc < b - 0.05) sub.push(pts[i].slice());
        }
        sub.push([x1, y1]);
        out.push(dedupe(sub));
      }
      return out.filter((s) => s.length >= 2 && plen(s) > 0.8);
    };

    // miter offset of an open polyline
    const offsetPath = (pts, d) => {
      const n = pts.length, out = [];
      for (let i = 0; i < n; i++) {
        const pnt = pts[i];
        const pv = pts[Math.max(0, i - 1)], nx = pts[Math.min(n - 1, i + 1)];
        let d1 = [pnt[0] - pv[0], pnt[1] - pv[1]];
        let d2 = [nx[0] - pnt[0], nx[1] - pnt[1]];
        const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
        if (l1 > 1e-9) { d1 = [d1[0] / l1, d1[1] / l1]; }
        if (l2 > 1e-9) { d2 = [d2[0] / l2, d2[1] / l2]; }
        if (i === 0 || l1 < 1e-9) d1 = d2;
        if (i === n - 1 || l2 < 1e-9) d2 = d1;
        const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
        let m = [n1[0] + n2[0], n1[1] + n2[1]];
        const ml = Math.hypot(m[0], m[1]);
        if (ml < 1e-6) m = n1; else m = [m[0] / ml, m[1] / ml];
        const co = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
        out.push([pnt[0] + (m[0] * d) / co, pnt[1] + (m[1] * d) / co]);
      }
      return out;
    };

    /* ---------- render ---------- */
    const paths = [];
    const pushHeadFilled = (tip, dir, len, hw) => {
      const nrm = [-dir[1], dir[0]];
      const bx = tip[0] - dir[0] * len, by = tip[1] - dir[1] * len;
      const V = [
        tip,
        [bx + nrm[0] * hw / 2, by + nrm[1] * hw / 2],
        [bx - nrm[0] * hw / 2, by - nrm[1] * hw / 2],
      ];
      const cx = (V[0][0] + V[1][0] + V[2][0]) / 3;
      const cy = (V[0][1] + V[1][1] + V[2][1]) / 3;
      const inr = Math.min(len, hw) / 3.2;
      const rings = p.style === "Thick outline" ? 1
        : Math.max(1, Math.ceil(inr / fillStep) + 1);
      for (let k = 0; k < rings; k++) {
        const t = rings === 1 ? 0 : k / rings;
        paths.push({
          pts: V.map(([x, y]) => [x + (cx - x) * t, y + (cy - y) * t]),
          closed: true, layer: linePen,
        });
      }
    };

    for (let ei = 0; ei < edges.length; ei++) {
      const C = center[ei];
      if (!C || C.length < 2) continue;
      const subs = cutGaps(C, gaps[ei]);
      if (!subs.length) continue;
      // arrow tip = end of the last subpath (true end of the route)
      const last = subs[subs.length - 1];
      const le = last[last.length - 1], lp = last[last.length - 2];
      let dir = [le[0] - lp[0], le[1] - lp[1]];
      const dl = Math.hypot(dir[0], dir[1]);
      dir = dl > 1e-9 ? [dir[0] / dl, dir[1] / dl] : [1, 0];

      if (!thick) {
        for (const s of subs)
          paths.push({ pts: s.map((q) => q.slice()), closed: false, layer: linePen });
        const hw = headLen * 0.7, nrm = [-dir[1], dir[0]];
        const bx = le[0] - dir[0] * headLen, by = le[1] - dir[1] * headLen;
        paths.push({
          pts: [[bx + nrm[0] * hw / 2, by + nrm[1] * hw / 2], le.slice(),
                [bx - nrm[0] * hw / 2, by - nrm[1] * hw / 2]],
          closed: false, layer: linePen,
        });
        continue;
      }

      const hw = Math.max(w * 1.9, w + 3);
      const hl = Math.min(headLen, plen(last) - 1);
      for (let si = 0; si < subs.length; si++) {
        let s = subs[si];
        if (si === subs.length - 1 && hl > 1) {
          s = cutGaps(s, [[plen(s) - hl, plen(s) + 1]])[0];
          if (!s || s.length < 2) { pushHeadFilled(le, dir, Math.max(2, hl), hw); continue; }
        }
        const L = offsetPath(s, w / 2), Rr = offsetPath(s, -w / 2);
        paths.push({
          pts: [...L, ...Rr.slice().reverse()],
          closed: true, layer: linePen,
        });
        if (p.style === "Thick filled") {
          let flip = false;
          for (let o = -w / 2 + fillStep; o < w / 2 - fillStep * 0.5; o += fillStep) {
            const f = offsetPath(s, o);
            paths.push({ pts: flip ? f.reverse() : f, closed: false, layer: linePen });
            flip = !flip;
          }
        }
      }
      pushHeadFilled(le, dir, Math.max(2, hl > 1 ? hl : headLen), hw);
    }

    /* ---------- node shapes + labels ---------- */
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      if (p.shape === "Circle") {
        const pts = [];
        for (let k = 0; k < 60; k++) {
          const a = (k / 60) * Math.PI * 2;
          pts.push([n.x + Math.cos(a) * R, n.y + Math.sin(a) * R]);
        }
        paths.push({ pts, closed: true, layer: nodePen });
      } else {
        paths.push({
          pts: [[n.x - R, n.y - R], [n.x + R, n.y - R],
                [n.x + R, n.y + R], [n.x - R, n.y + R]],
          closed: true, layer: nodePen,
        });
      }
      if (p.labels) {
        const size = R * 0.9;
        const g = fontStrokes(String(i + 1), size, 1);
        const ox = n.x - g.width / 2, oy = n.y - size / 2;
        for (const st of g.strokes)
          paths.push({
            pts: st.map(([x, y]) => [ox + x, oy + y]),
            closed: false, layer: nodePen,
          });
      }
    }

    return applyStyle({ paths }, ins[0]);
  },
})
