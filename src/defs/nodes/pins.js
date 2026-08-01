import { Pin, PENS, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "pins",
  name: "Pins",
  cat: "gen",
  group: "geometric",
  desc: "Sewing pins: straight shafts with a ball head at the tip. Chaos runs from a neat grid where every pin points at Angle (0) to a fully scattered jumble of random positions and directions (1). The shaft stops at the ball's edge; Head fill draws the ball as an outline, concentric rings, or one continuous spiral. Head pens cycles the balls across several pens from Head pen onward, like a real pin assortment, while shafts stay on Shaft pen. Bend curves the needles slightly. Every pin is shifted whole to fit inside the margin. Unlike Comets, whose few tails all point away from a shared sun direction, Pins is an order-to-chaos field of up to 200 needles with filled multi-pen heads.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "pins", label: "Pins", type: "slider", min: 1, max: 200, step: 1, def: 40 },
    { key: "length", label: "Length mm", type: "slider", min: 5, max: 100, step: 0.5, def: 30 },
    { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "headSize", label: "Head size mm", type: "slider", min: 0.5, max: 10, step: 0.1, def: 3 },
    { key: "headVar", label: "Head variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
    { key: "chaos", label: "Chaos (order \u2192 mess)", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7 },
    { key: "angle", label: "Angle \u00b0 (at order)", type: "slider", min: 0, max: 360, step: 1, def: 90 },
    { key: "bend", label: "Bend", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "headFill", label: "Head fill", type: "select", options: ["Outline", "Rings", "Spiral"], def: "Spiral" },
    { key: "headPens", label: "Head pens", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "headPen", label: "Head pen", type: "pen", def: 1 },
    { key: "shaftPen", label: "Shaft pen", type: "pen", def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 42 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
    const bw = x1 - x0, bh = y1 - y0;
    if (bw < 4 || bh < 4) return applyStyle({ paths: [] }, ins[0]);
    const NPINS = Math.max(1, Math.round(p.pins));
    const chaos = Math.max(0, Math.min(1, p.chaos));
    const baseA = (p.angle * Math.PI) / 180;
    const SP = Math.round(p.shaftPen);
    const HP0 = Math.round(p.headPen);
    const NHP = Math.max(1, Math.round(p.headPens));
    const nPens = PENS.length;

    /* grid: as square cells as possible for the pin count */
    const cols = Math.max(1, Math.round(Math.sqrt((NPINS * bw) / bh)));
    const rows = Math.max(1, Math.ceil(NPINS / cols));

    const paths = [];
    for (let i = 0; i < NPINS; i++) {
      const rng = mulberry32(p.seed * 7919 + i * 613 + 11);
      /* --- pose: lerp grid -> random by chaos --- */
      const gx = x0 + ((i % cols) + 0.5) * (bw / cols);
      const gy = y0 + (Math.floor(i / cols) + 0.5) * (bh / rows);
      const rx = x0 + rng() * bw;
      const ry = y0 + rng() * bh;
      const cx = gx + (rx - gx) * chaos;
      const cy = gy + (ry - gy) * chaos;
      const ang = baseA + (rng() - 0.5) * 2 * Math.PI * chaos;
      let len = Math.max(2, p.length * (1 - p.lenVar * rng()));
      let hr = Math.max(0.15, (p.headSize / 2) * (1 - p.headVar * rng()));
      /* the whole pin must be able to fit the margin box */
      const boxMin = Math.min(bw, bh);
      hr = Math.min(hr, boxMin / 2 - 0.1);
      const bendMax = p.bend * len * 0.12;
      len = Math.min(len, Math.max(1, boxMin - 2 * hr - 2 * bendMax - 0.2));
      const dx = Math.cos(ang), dy = Math.sin(ang);

      /* pin from tail (cx,cy) to head center; shift whole pin into the margin rect */
      let tx = cx - dx * len / 2, ty = cy - dy * len / 2;      /* tail */
      let hx = cx + dx * len / 2, hy = cy + dy * len / 2;      /* head center */
      const bendAmp = p.bend * len * 0.12;
      /* bounding extremes incl. head radius and bend bulge */
      const minX = Math.min(tx, hx - hr) - bendAmp, maxX = Math.max(tx, hx + hr) + bendAmp;
      const minY = Math.min(ty, hy - hr) - bendAmp, maxY = Math.max(ty, hy + hr) + bendAmp;
      let sx = 0, sy = 0;
      if (minX < x0) sx = x0 - minX; else if (maxX > x1) sx = x1 - maxX;
      if (minY < y0) sy = y0 - minY; else if (maxY > y1) sy = y1 - maxY;
      tx += sx; ty += sy; hx += sx; hy += sy;

      /* --- shaft: tail -> ball edge, optional quadratic bend --- */
      const ex = hx - dx * hr, ey = hy - dy * hr; /* stop at ball edge */
      const nx = -dy, ny = dx;
      const bendSign = rng() > 0.5 ? 1 : -1;
      const nSeg = p.bend > 0 ? 12 : 1;
      const shaft = [];
      for (let s = 0; s <= nSeg; s++) {
        const t = s / nSeg;
        const bx = tx + (ex - tx) * t;
        const by = ty + (ey - ty) * t;
        const bulge = p.bend > 0 ? Math.sin(Math.PI * t) * bendAmp * bendSign : 0;
        shaft.push([bx + nx * bulge, by + ny * bulge]);
      }
      paths.push({ pts: shaft, closed: false, layer: SP });

      /* --- head --- */
      const HL = (HP0 + (NHP > 1 ? Math.floor(rng() * NHP) : 0)) % nPens;
      const circle = (r) => {
        const n = Math.max(8, Math.ceil((Math.PI * 2 * r) / 0.6));
        const pts = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          pts.push([hx + Math.cos(a) * r, hy + Math.sin(a) * r]);
        }
        return { pts, closed: true, layer: HL };
      };
      if (p.headFill === "Outline") {
        paths.push(circle(hr));
      } else if (p.headFill === "Rings") {
        for (let r = hr; r > 0.15; r -= 0.45) paths.push(circle(r));
      } else { /* Spiral: outline + one continuous archimedean stroke inward */
        paths.push(circle(hr));
        const pitch = 0.45;
        const turns = hr / pitch;
        const nPts = Math.max(12, Math.ceil(turns * 26));
        const pts = [];
        for (let k = 0; k <= nPts; k++) {
          const t = k / nPts;
          const a = t * turns * Math.PI * 2;
          const r = hr * (1 - t);
          pts.push([hx + Math.cos(a) * r, hy + Math.sin(a) * r]);
        }
        paths.push({ pts, closed: false, layer: HL });
      }
    }
    /* safety clamp: a no-op at sane parameters, guarantees the margin at extremes */
    for (const pa of paths) {
      for (const q of pa.pts) {
        q[0] = Math.max(x0, Math.min(x1, q[0]));
        q[1] = Math.max(y0, Math.min(y1, q[1]));
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
