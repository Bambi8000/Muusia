({
  key: "roundcanvas",
  name: "Round Canvas",
  cat: "mod",
  group: "cutsplit",
  desc: "Crops everything to a round canvas whose rim can be distorted: Distort pushes seeded noise into the outline and Lobes sets how many bulges it gets, from a clean circle to a wobbly blob or a splashy stain. Content is clipped at the rim (Edge gap keeps a quiet margin inside it), Invert keeps the outside instead, and Draw edge plots the rim itself with its own pen. Offset X/Y moves the canvas off the sheet center. Put it last in a chain to give any patch a round-format presentation, or feed the same seed to two of them for registration across layers.",
  ins: [Pin("paths", "Paths")],
  outs: [Pin("paths")],
  params: [
    { key: "radius", label: "Radius mm", type: "slider", min: 10, max: 200, step: 1, def: 90 },
    { key: "distort", label: "Distort", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "lobes", label: "Lobes", type: "slider", min: 1, max: 12, step: 0.5, def: 3 },
    { key: "ox", label: "Offset X mm", type: "slider", min: -150, max: 150, step: 1, def: 0 },
    { key: "oy", label: "Offset Y mm", type: "slider", min: -150, max: 150, step: 1, def: 0 },
    { key: "gap", label: "Edge gap mm", type: "slider", min: 0, max: 20, step: 0.5, def: 0 },
    { key: "invert", label: "Invert (keep outside)", type: "check", def: false },
    { key: "edge", label: "Draw edge", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "layer", label: "Edge pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const R = Math.max(2, p.radius);
    const dist = Math.max(0, Math.min(1.5, p.distort));
    const lobes = Math.max(0.5, p.lobes);
    const gap = Math.max(0, p.gap);
    const cx = W / 2 + p.ox, cy = H / 2 + p.oy;
    const TAU = Math.PI * 2;
    const fbm2 = (x, y, s) => noise2(x, y, s) * 0.6 + noise2(x * 2.3 + 5, y * 2.3 + 9, s + 7) * 0.4;

    /* rim radius LUT: star-shaped, so a polar test is exact */
    const NB = 512;
    const rLUT = new Float32Array(NB);
    for (let b = 0; b < NB; b++) {
      const a = (b / NB) * TAU;
      rLUT[b] = R * (1 + dist * 0.35 * (fbm2(Math.cos(a) * lobes * 0.5 + 13, Math.sin(a) * lobes * 0.5 + 4, seed * 3 + 1) - 0.5) * 2);
    }
    const rimR = (a) => {
      const f = ((((a / TAU) % 1) + 1) % 1) * NB;
      const b0 = Math.floor(f) % NB, b1 = (b0 + 1) % NB, t = f - Math.floor(f);
      return rLUT[b0] + (rLUT[b1] - rLUT[b0]) * t;
    };
    const inside = (x, y) => {
      const dx = x - cx, dy = y - cy;
      const keep = Math.hypot(dx, dy) <= rimR(Math.atan2(dy, dx)) - gap;
      return p.invert ? !keep : keep;
    };

    const out = [];
    for (const pa of src.paths) {
      const P = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
      if (P.length < 2) continue;
      /* fully-inside closed paths stay closed */
      if (pa.closed) {
        let all = true;
        for (const [x, y] of pa.pts) if (!inside(x, y)) { all = false; break; }
        if (all) { out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }); continue; }
      }
      let cur = [];
      const flush = () => { if (cur.length >= 2) out.push({ pts: cur, closed: false, layer: pa.layer }); cur = []; };
      for (let i = 1; i < P.length; i++) {
        const [ax, ay] = P[i - 1], [bx, by] = P[i];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.7));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) {
          const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
          if (inside(x, y)) cur.push([x, y]);
          else flush();
        }
      }
      flush();
    }

    if (p.edge) {
      const pts = [];
      for (let b = 0; b < 360; b++) {
        const a = (b / 360) * TAU;
        const r = rimR(a);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      out.push({ pts, closed: true, layer: Math.round(p.layer) });
    }
    return { paths: out };
  },
})
