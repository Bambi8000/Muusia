({
  key: "ribbon_lab",
  name: "Ribbon (lab)",
  cat: "gen",
  group: "geometric",
  desc: "A band of parallel filament lines following a noise-wandering spine, pinching and swelling with Width variation. Shape Line runs the spine left to right across the sheet; Shape Ring closes it into a loop around the canvas center (Ring radius sets the base size, Wander makes the loop breathe) with seamless periodic noise, every filament a closed pen stroke. Tip: Ring + high Width variation gives a hand-drawn wreath.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "shape", label: "Shape", type: "select", options: ["Line", "Ring"], def: "Line" },
    { key: "ringR", label: "Ring radius %", type: "slider", min: 20, max: 100, step: 1, def: 70 },
    { key: "wander", label: "Wander mm", type: "slider", min: 0, max: 120, step: 1, def: 45 },
    { key: "wscale", label: "Wander scale", type: "slider", min: 0.2, max: 4, step: 0.1, def: 1 },
    { key: "width", label: "Width mm", type: "slider", min: 2, max: 80, step: 0.5, def: 28 },
    { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8 },
    { key: "lines", label: "Lines", type: "slider", min: 1, max: 60, step: 1, def: 24 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 27 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const K = Math.round(p.lines);
    const L = Math.round(p.layer);
    const paths = [];

    if (p.shape === "Ring") {
      /* ---- suljettu lenkki: periodinen kohina, ei saumaa ---- */
      const cx = W / 2, cy = H / 2;
      const Rmax = Math.min(W, H) / 2 - p.margin;
      const R = Math.max(2, Rmax * (Math.max(1, p.ringR) / 100));
      const N = 240;
      const TAU = Math.PI * 2;
      const radiusAt = (a) => {
        const v = noise2(Math.cos(a) * 2 * p.wscale + 7.7, Math.sin(a) * 2 * p.wscale + 3.3, p.seed);
        let r = R + (v - 0.5) * 2 * p.wander;
        return Math.max(1, Math.min(Math.min(W, H) / 2 - p.margin, r));
      };
      const widthAt = (a) => {
        const v = noise2(Math.cos(a) * 2.5 * p.wscale + 40, Math.sin(a) * 2.5 * p.wscale + 8.8, p.seed + 9);
        const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
        return Math.max(0.3, w);
      };
      const bb = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        const r = radiusAt(a);
        bb.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      /* normaalit: sykliset keskeisdifferenssit */
      const normals = bb.map((pt, i) => {
        const nI = (i + 1) % N, pI = (i - 1 + N) % N;
        const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        return [-ty / tl, tx / tl];
      });
      for (let k = 0; k < K; k++) {
        const f = K === 1 ? 0 : k / (K - 1) - 0.5;
        const pts = bb.map((pt, i) => {
          const w = widthAt((i / N) * TAU);
          return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
        });
        paths.push({ pts, closed: true, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }

    /* ---- Line: byte-identical to the baked ribbon ---- */
    const N = 160;
    const bb = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = p.margin + (W - 2 * p.margin) * t;
      const y = H / 2 + (noise2(t * 4 * p.wscale, 3.3, p.seed) - 0.5) * 2 * p.wander;
      bb.push([x, Math.max(p.margin, Math.min(H - p.margin, y))]);
    }
    const widthAt = (t) => {
      const v = noise2(t * 5 * p.wscale + 40, 8.8, p.seed + 9);
      const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
      return Math.max(0.3, w);
    };
    const normals = bb.map((pt, i) => {
      const nI = Math.min(i + 1, bb.length - 1), pI = Math.max(i - 1, 0);
      const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
      const tl = Math.hypot(tx, ty) || 1;
      return [-ty / tl, tx / tl];
    });
    for (let k = 0; k < K; k++) {
      const f = K === 1 ? 0 : k / (K - 1) - 0.5;
      const pts = bb.map((pt, i) => {
        const w = widthAt(i / N);
        return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
      });
      paths.push({ pts, closed: false, layer: L });
    }
    return applyStyle({ paths }, ins[0]);
  },
})
