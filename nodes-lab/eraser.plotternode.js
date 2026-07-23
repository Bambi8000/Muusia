({
  key: "eraser",
  name: "Eraser",
  cat: "mod",
  group: "cutsplit",
  desc: "Erases a region: everything inside the zone (Rectangle or Circle, dashed guide when selected) is removed and crossing paths are cut cleanly at the border. Invert keeps only the inside instead - a circular or rectangular crop for any geometry. Gap grows (+) or shrinks (-) the erased area from its edge, so a positive gap leaves breathing room at the cut. Closed paths that get cut reopen as arcs.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "shape", label: "Zone", type: "select", options: ["Rectangle", "Circle"], def: "Rectangle" },
    { key: "zx", label: "Rect X mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    { key: "zy", label: "Rect Y mm", type: "slider", min: 0, max: 400, step: 1, def: 60 },
    { key: "zw", label: "Rect W mm", type: "slider", min: 5, max: 400, step: 1, def: 100 },
    { key: "zh", label: "Rect H mm", type: "slider", min: 5, max: 400, step: 1, def: 80 },
    { key: "cx", label: "Circle X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
    { key: "cy", label: "Circle Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    { key: "cr", label: "Circle R mm", type: "slider", min: 2, max: 250, step: 1, def: 50 },
    { key: "gap", label: "Gap mm (+grow / -shrink)", type: "slider", min: -20, max: 20, step: 0.5, def: 0 },
    { key: "invert", label: "Invert (keep inside)", type: "check", def: false },
  ],
  overlay(p) {
    return p.shape === "Circle"
      ? [{ kind: "circle", cx: p.cx, cy: p.cy, r: Math.max(0.5, p.cr + p.gap) }]
      : [{ kind: "rect", x: p.zx - p.gap, y: p.zy - p.gap, w: p.zw + 2 * p.gap, h: p.zh + 2 * p.gap }];
  },
  compute(ins, p) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const g = p.gap;
    let inZone;
    if (p.shape === "Circle") {
      const r = Math.max(0.1, p.cr + g);
      const r2 = r * r;
      inZone = (q) => (q[0] - p.cx) * (q[0] - p.cx) + (q[1] - p.cy) * (q[1] - p.cy) <= r2;
    } else {
      const x0 = p.zx - g, y0 = p.zy - g;
      const x1 = p.zx + p.zw + g, y1 = p.zy + p.zh + g;
      if (x1 <= x0 || y1 <= y0) return p.invert ? EMPTY : { paths: src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      inZone = (q) => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
    }
    const erase = (q) => p.invert ? !inZone(q) : inZone(q);
    const cross = (a, b) => {
      /* bisection to the erase boundary between a kept and an erased point */
      let lo = a, hi = b;
      if (erase(a)) { lo = b; hi = a; }   /* lo kept, hi erased */
      for (let k = 0; k < 24; k++) {
        const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
        if (erase(mid)) hi = mid; else lo = mid;
      }
      return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    };
    const out = [];
    for (const pa of src.paths) {
      const pts = resample(pa.pts, pa.closed, 1);
      if (pts.length < 2) continue;
      const flags = pts.map(erase);
      if (flags.every((f) => f)) continue;                 /* fully erased */
      if (flags.every((f) => !f)) {
        out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }); /* untouched, original sampling */
        continue;
      }
      const seq = pa.closed ? pts.concat([pts[0]]) : pts;
      const fseq = pa.closed ? flags.concat([flags[0]]) : flags;
      let run = [];
      const flush = () => { if (run.length > 1) out.push({ pts: run, closed: false, layer: pa.layer }); run = []; };
      if (!fseq[0]) run.push(seq[0].slice());
      for (let i = 1; i < seq.length; i++) {
        if (fseq[i] === fseq[i - 1]) {
          if (!fseq[i]) run.push(seq[i].slice());
          continue;
        }
        const c = cross(seq[i - 1], seq[i]);
        if (fseq[i]) { run.push(c); flush(); }             /* leaving kept area */
        else { run = [c, seq[i].slice()]; }                /* entering kept area */
      }
      flush();
    }
    return { paths: out };
  },
})