({
  key: "ripple",
  name: "Ripple",
  cat: "mod",
  group: "distort",
  desc: "Water reflection with surface disturbance. Everything above the Waterline is mirrored below it, and the reflection is disturbed by horizontal ripple bands whose displacement grows with depth — reed stalks wiggle, a boulder's underside gets the jagged zigzag rim, exactly like a calm-evening lake. Breakup fragments the reflection into dashes the deeper it goes, Stretch lengthens or shortens it, Band scale sets the ripple frequency, and Pen shift moves reflections onto another pen (originals keep theirs and pass through untouched). Ripple originals too also disturbs any input already below the line, for content meant to sit in the water. Area confines the whole effect to an adjustable region under the waterline — Pool is a half-ellipse pond with a wobbly rim, Box a crisp rectangle (both use offset, width, depth; Draw pool edge plots the rim on the Pen shift pen). The region and waterline show as dashed guides when the node is selected. Pairs with Water for the surface itself and Sunset skies above.",
  ins: [Pin("paths", "Paths")],
  outs: [Pin("paths")],
  overlay(p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const yw = Math.max(0.05, Math.min(0.98, p.waterline)) * H;
    const g = [{ kind: "poly", pts: [[0, yw], [W, yw]] }];
    if (p.area === "Box") {
      const pcx = W / 2 + p.poolx, prx = Math.max(5, p.poolw) / 2, pry = Math.max(5, p.poold);
      g.push({ kind: "rect", x: pcx - prx, y: yw, w: 2 * prx, h: pry });
    } else if (p.area === "Pool") {
      const pcx = W / 2 + p.poolx, prx = Math.max(5, p.poolw) / 2, pry = Math.max(5, p.poold);
      const fbmA = (a) => noise2(Math.cos(a) * 2 + 13, Math.sin(a) * 2 + 4, seed * 9 + 3) * 0.6 +
                          noise2(Math.cos(a) * 4.6 + 5, Math.sin(a) * 4.6 + 9, seed * 9 + 10) * 0.4;
      const pts = [];
      for (let b = 0; b <= 72; b++) {
        const a = (b / 72) * Math.PI;
        const rr = 1 + Math.max(0, Math.min(1, p.pooledge)) * 0.3 * (fbmA(a) - 0.5) * 2;
        pts.push([pcx + Math.cos(a) * prx * rr, yw + Math.sin(a) * pry * rr]);
      }
      g.push({ kind: "poly", pts });
    }
    return g;
  },
  params: [
    { key: "area", label: "Area", type: "select", options: ["Full", "Pool", "Box"], def: "Full" },
    { key: "waterline", label: "Waterline", type: "slider", min: 0.1, max: 0.95, step: 0.01, def: 0.55 },
    { key: "poolx", label: "Pool offset X mm", type: "slider", min: -120, max: 120, step: 1, def: 0 },
    { key: "poolw", label: "Pool width mm", type: "slider", min: 20, max: 220, step: 1, def: 130 },
    { key: "poold", label: "Pool depth mm", type: "slider", min: 10, max: 160, step: 1, def: 65 },
    { key: "pooledge", label: "Pool edge wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "edge", label: "Draw pool edge", type: "check", def: false },
    { key: "amp", label: "Ripple mm", type: "slider", min: 0, max: 8, step: 0.1, def: 2.5 },
    { key: "scale", label: "Band scale", type: "slider", min: 0.05, max: 1, step: 0.01, def: 0.3 },
    { key: "breakup", label: "Breakup", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "stretch", label: "Stretch", type: "slider", min: 0.3, max: 1.5, step: 0.01, def: 1 },
    { key: "penshift", label: "Pen shift", type: "slider", min: 0, max: 11, step: 1, def: 0 },
    { key: "below", label: "Ripple originals too", type: "check", def: false },
    { key: "seed", label: "Seed", type: "seed", def: 12 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const yw = Math.max(0.05, Math.min(0.98, p.waterline)) * H;
    const amp = Math.max(0, p.amp);
    const sc = Math.max(0.02, p.scale);
    const brk = Math.max(0, Math.min(1, p.breakup));
    const stretch = Math.max(0.1, p.stretch);
    const shift = Math.round(p.penshift);
    const pool = p.area === "Pool";
    const pcx = W / 2 + p.poolx, prx = Math.max(5, p.poolw) / 2, pry = Math.max(5, p.poold);
    const fbmA = (a) => noise2(Math.cos(a) * 2 + 13, Math.sin(a) * 2 + 4, seed * 9 + 3) * 0.6 +
                        noise2(Math.cos(a) * 4.6 + 5, Math.sin(a) * 4.6 + 9, seed * 9 + 10) * 0.4;
    const poolRim = (a) => 1 + Math.max(0, Math.min(1, p.pooledge)) * 0.3 * (fbmA(a) - 0.5) * 2;
    const box = p.area === "Box";
    const inPool = (x, y) => {
      if (!pool && !box) return true;
      if (y < yw - 0.01) return false;
      if (box) return Math.abs(x - pcx) <= prx && y <= yw + pry;
      const u = (x - pcx) / prx, v = (y - yw) / pry;
      const d = Math.hypot(u, v);
      return d <= poolRim(Math.atan2(v, u));
    };

    /* budget-aware sampling step */
    let step = 0.7;
    const totLen = src.paths.reduce((s, pa) => s + pathLength(pa.pts, pa.closed), 0);
    if (totLen / step > 90000) step = totLen / 90000;

    const band = (x, y) =>
      (noise2(x * 0.02 + 7, y * sc, seed * 3 + 1) - 0.5) * 2 * 0.7 +
      (noise2(x * 0.05 + 31, y * sc * 2.3 + 9, seed * 3 + 8) - 0.5) * 2 * 0.3;
    const disturb = (x, y) => {
      const d = Math.max(0, y - yw);
      const A = amp * (0.15 + 0.85 * Math.min(1, d / 35));
      return [
        x + A * band(x, y),
        y + A * 0.25 * (noise2(x * 0.03 + 51, y * sc * 1.7 + 23, seed * 5 + 2) - 0.5) * 2,
      ];
    };
    const dropped = (x, y) => {
      if (brk <= 0) return false;
      const d = Math.max(0, y - yw);
      return hash2(Math.round(x * 7.3), Math.round(y * 13.1), seed * 7 + 5) < brk * Math.min(1, d / 50) * 0.92;
    };

    const out = [];
    const emitRuns = (samples, closedIfAll, layer) => {
      /* samples: [[x,y,keepFlag]] — split into runs at drops/out-of-sheet */
      let cur = [];
      let all = true;
      for (const s of samples) {
        if (s) cur.push([s[0], s[1]]);
        else {
          all = false;
          if (cur.length >= 2) out.push({ pts: cur, closed: false, layer });
          cur = [];
        }
      }
      if (cur.length >= 2) out.push({ pts: cur, closed: closedIfAll && all, layer });
    };
    const sampleSeg = (P, closed, fn) => {
      const Q = closed ? [...P, P[0]] : P;
      const res = [];
      for (let i = 1; i < Q.length; i++) {
        const [ax, ay] = Q[i - 1], [bx, by] = Q[i];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
        for (let k = i === 1 ? 0 : 1; k <= n; k++)
          res.push(fn(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n));
      }
      if (closed) res.pop();
      return res;
    };

    for (const pa of src.paths) {
      if (pa.pts.length < 2) { out.push(pa); continue; }
      const layer = pa.layer;

      /* originals: untouched, unless "below" ripples their underwater part */
      if (!p.below) {
        out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) });
      } else {
        const samples = sampleSeg(pa.pts, pa.closed, (x, y) => {
          if (y <= yw || !inPool(x, y)) return [x, y];
          if (dropped(x, y)) return null;
          const [dx, dy] = disturb(x, y);
          return dx < 0.2 || dx > W - 0.2 || dy > H - 0.2 ? null : [dx, dy];
        });
        emitRuns(samples, pa.closed, layer);
      }

      /* reflection of the above-water portion */
      const rl = ((layer + shift) % 12 + 12) % 12;
      const refl = sampleSeg(pa.pts, pa.closed, (x, y) => {
        if (y > yw) return null;
        const ym = yw + (yw - y) * stretch;
        if (ym > H - 0.2) return null;
        if (!inPool(x, ym)) return null;
        if (dropped(x, ym)) return null;
        const [dx, dy] = disturb(x, ym);
        return dx < 0.2 || dx > W - 0.2 || dy > H - 0.2 || dy < 0.2 ? null : [dx, dy];
      });
      emitRuns(refl, pa.closed, rl);
    }
    if (box && p.edge) {
      const x0 = Math.max(0.2, pcx - prx), x1 = Math.min(W - 0.2, pcx + prx);
      const y1 = Math.min(H - 0.2, yw + pry);
      out.push({ pts: [[x0, yw], [x0, y1], [x1, y1], [x1, yw]], closed: false, layer: ((shift % 12) + 12) % 12 });
    }
    if (pool && p.edge) {
      const pts = [];
      for (let b = 0; b <= 180; b++) {
        const a = (b / 180) * Math.PI;
        const rr = poolRim(a);
        const x = pcx + Math.cos(a) * prx * rr, y = yw + Math.sin(a) * pry * rr;
        if (x > 0.2 && x < W - 0.2 && y < H - 0.2) pts.push([x, y]);
      }
      if (pts.length >= 2) out.push({ pts, closed: false, layer: ((shift % 12) + 12) % 12 });
    }
    return { paths: out };
  },
})
