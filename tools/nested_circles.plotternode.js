({
  key: "nested_circles",
  name: "Nested Circles",
  cat: "gen",
  group: "geometric",
  desc: "Overlapping discs filled with concentric rings or radial rays, woven into an over/under illusion. Count discs sit on a ring around the group center (Spread = distance, Rotate turns the arrangement). Weave order: Weave interlocks them \u2014 two discs split their overlap along the center line so each is on top on one side (the classic yin-yang interlock), three or more form a cyclic pinwheel where every disc tucks under its neighbour; Stack is a simple painter order. Background: Opaque gives every disc a solid backing — it hides whatever lies beneath it, even between its own rings; Transparent skips occlusion so complete discs overprint like stacked pen layers (moiré). Weave fill decides the top disc by angular sector from the group center — a globally consistent order, so the central multi-overlap fills with rings meeting at sector seams instead of leaving a void. The disc underneath is cut with a clean white halo (Gap) around the covering disc's edge. Fill picks Rings at Spacing pitch or Rays (count set by Rays), Hole leaves a donut center. Discs alternate between Pen A and Pen B. Tip: two discs, Rings, red and black pens reproduces the classic poster.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Discs", type: "slider", min: 2, max: 6, step: 1, def: 2 },
    { key: "radius", label: "Disc radius", type: "slider", min: 10, max: 90, step: 0.5, def: 45 },
    { key: "spread", label: "Spread", type: "slider", min: 0, max: 100, step: 0.5, def: 28 },
    { key: "rotate", label: "Rotate", type: "slider", min: 0, max: 360, step: 1, def: 45 },
    { key: "hole", label: "Hole", type: "slider", min: 0, max: 60, step: 0.5, def: 0 },
    { key: "fill", label: "Fill", type: "select", options: ["Rings", "Rays"], def: "Rings" },
    { key: "spacing", label: "Spacing", type: "slider", min: 1.5, max: 10, step: 0.1, def: 3.2 },
    { key: "rays", label: "Rays", type: "slider", min: 8, max: 120, step: 1, def: 56 },
    { key: "weave", label: "Order", type: "select", options: ["Weave", "Weave fill", "Stack"], def: "Weave" },
    { key: "bg", label: "Background", type: "select", options: ["Opaque", "Transparent"], def: "Opaque" },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 5, step: 0.1, def: 1.3 },
    { key: "cx", label: "Center X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Center Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "penA", label: "Pen A", type: "pen", def: 0 },
    { key: "penB", label: "Pen B", type: "pen", def: 2 },
  ],
  overlay(p, ctx) {
    const X = (ctx.W * p.cx) / 100, Y = (ctx.H * p.cy) / 100;
    const n = Math.max(2, Math.round(p.count));
    const rot = (p.rotate * Math.PI) / 180;
    const g = [{ kind: "point", x: X, y: Y }];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      g.push({ kind: "circle", cx: X + Math.cos(a) * p.spread,
               cy: Y + Math.sin(a) * p.spread, r: Math.max(1, p.radius) });
    }
    return g;
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const X = (W * p.cx) / 100, Y = (H * p.cy) / 100;
    const n = Math.max(2, Math.round(p.count));
    const R = Math.max(2, p.radius);
    const hole = Math.min(Math.max(0, p.hole), R - 1);
    const spacing = Math.max(1, p.spacing);
    const nrays = Math.max(4, Math.round(p.rays));
    const gap = Math.max(0, p.gap);
    const rot = (p.rotate * Math.PI) / 180;
    const penA = Math.round(p.penA) % PENS.length;
    const penB = Math.round(p.penB) % PENS.length;

    const C = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      C.push([X + Math.cos(a) * p.spread, Y + Math.sin(a) * p.spread]);
    }

    // Is disc j over disc i at point pt?
    const dirs = [];
    for (let i = 0; i < n; i++) dirs.push(rot + (i / n) * Math.PI * 2);
    const angDiff = (a, b) => {
      let d = Math.abs(a - b) % (2 * Math.PI);
      return d > Math.PI ? 2 * Math.PI - d : d;
    };
    const overAt = (i, j, pt) => {
      if (p.weave === "Stack") return j > i;
      if (p.weave === "Weave fill") {
        // the disc whose direction sector contains the point is on top:
        // a globally consistent order, so the multi-overlap center stays filled
        const a = Math.atan2(pt[1] - Y, pt[0] - X);
        const di = angDiff(a, dirs[i]), dj = angDiff(a, dirs[j]);
        if (Math.abs(di - dj) < 1e-9) return j < i;
        return dj < di;
      }
      if (n === 2) {
        // split the lens along the line through both centers:
        // one side i is on top, the other side j is on top
        const dx = C[1][0] - C[0][0], dy = C[1][1] - C[0][1];
        const side = (pt[0] - C[0][0]) * dy - (pt[1] - C[0][1]) * dx;
        const jTopSide = side > 0;
        return j === 1 ? jTopSide : !jTopSide;
      }
      // cyclic pinwheel: each disc tucks under its predecessor
      if ((i + 1) % n === j) return false;      // successor is under i
      if ((j + 1) % n === i) return true;       // predecessor is over i
      return j > i;                             // non-adjacent: stack order
    };
    const keepFor = (i) => p.bg === "Transparent"
      ? () => true // no occlusion: full discs overprint like pen layers
      : (pt) => {
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        if (Math.hypot(pt[0] - C[j][0], pt[1] - C[j][1]) < R + gap &&
            overAt(i, j, pt)) return false;
      }
      return true;
    };

    const paths = [];
    let budget = 110000;
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed, layer });
    };
    // clip a sampled polyline against the keep test
    const emitClipped = (pts, closed, keep, layer) => {
      const ok = pts.map(keep);
      if (closed && ok.every(Boolean)) { push(pts, true, layer); return; }
      let start = 0;
      if (closed) { start = ok.findIndex((v) => !v); if (start < 0) start = 0; }
      let run = [];
      const flush = () => {
        if (run.length >= 2 && pathLength(run, false) > 0.8) push(run, false, layer);
        run = [];
      };
      for (let s = 0; s < pts.length; s++) {
        const k = closed ? (start + s) % pts.length : s;
        if (ok[k]) run.push(pts[k].slice());
        else flush();
      }
      flush();
    };
    const circlePts = (cx0, cy0, r) => {
      const m = Math.max(24, Math.ceil((2 * Math.PI * r) / 0.8));
      const pts = [];
      for (let k = 0; k < m; k++) {
        const a = (k / m) * Math.PI * 2;
        pts.push([cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r]);
      }
      return pts;
    };

    for (let i = 0; i < n && budget > 0; i++) {
      const layer = i % 2 === 0 ? penA : penB;
      const keep = keepFor(i);
      const [cx0, cy0] = C[i];
      if (p.fill === "Rings") {
        for (let r = R; r > Math.max(hole, spacing * 0.4); r -= spacing)
          emitClipped(circlePts(cx0, cy0, r), true, keep, layer);
        if (hole > 0.5) emitClipped(circlePts(cx0, cy0, hole), true, keep, layer);
      } else {
        // rim + hole outlines, then radial rays between them
        emitClipped(circlePts(cx0, cy0, R), true, keep, layer);
        if (hole > 0.5) emitClipped(circlePts(cx0, cy0, hole), true, keep, layer);
        for (let k = 0; k < nrays; k++) {
          const a = rot + (k / nrays) * Math.PI * 2;
          const dx = Math.cos(a), dy = Math.sin(a);
          const pts = [];
          const r0 = Math.max(hole, 0.4);
          const m = Math.max(4, Math.ceil((R - r0) / 0.8));
          for (let s = 0; s <= m; s++) {
            const r = r0 + ((R - r0) * s) / m;
            pts.push([cx0 + dx * r, cy0 + dy * r]);
          }
          emitClipped(k % 2 ? pts.reverse() : pts, false, keep, layer);
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
