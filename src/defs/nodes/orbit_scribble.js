import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "orbit_scribble",
  name: "Orbit Scribble",
  cat: "gen",
  group: "organic",
  desc: "The looping-thread tangle: each strand is ONE continuous pen stroke that keeps drawing circles while its center wanders inside a noise cloud and the loop radius slowly breathes - like scribbling orbits freehand without lifting the pen. Spread sets the cloud size, Wander how restlessly the center travels, Radius / Radius variation the loop sizes, Wobble the hand-drawn line shake. Beads stamps ink dots (tiny filled spirals) along the strands at Bead gap spacing on their own pen; Core falloff thins them toward the cloud edge so the fringe loops run bare, exactly like the reference - 0 beads everywhere, 1 only the dense core. Lines on one pen + beads on black is the classic look. Wire Frame into Seed for a boiling animation.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "strands", label: "Strands", type: "slider", min: 1, max: 20, step: 1, def: 6 },
    { key: "loops", label: "Loops per strand", type: "slider", min: 3, max: 60, step: 1, def: 18 },
    { key: "radius", label: "Loop radius mm", type: "slider", min: 4, max: 80, step: 1, def: 22 },
    { key: "radVar", label: "Radius variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "spread", label: "Cloud spread mm", type: "slider", min: 5, max: 150, step: 1, def: 55 },
    { key: "wander", label: "Wander", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "beads", label: "Beads", type: "check", def: true },
    { key: "beadGap", label: "Bead gap mm", type: "slider", min: 1.5, max: 15, step: 0.5, def: 4.5 },
    { key: "beadSize", label: "Bead size mm", type: "slider", min: 0.2, max: 1.5, step: 0.05, def: 0.55 },
    { key: "falloff", label: "Core falloff", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "beadPen", label: "Bead pen", type: "pen", def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "layer", label: "Line pen", type: "pen", def: 1 },
  ],
  overlay(p, ctx) {
    /* the cloud region the centers wander in, plus reach of the largest loops */
    const { W, H } = ctx;
    return [
      { kind: "circle", cx: W / 2, cy: H / 2, r: Math.max(1, p.spread) },
      { kind: "circle", cx: W / 2, cy: H / 2, r: Math.max(1, p.spread + p.radius) },
      { kind: "point", x: W / 2, y: H / 2 },
    ];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const CX = W / 2, CY = H / 2;
    const rng = mulberry32(p.seed * 2711 + 19);
    const L = Math.round(p.layer), BP = Math.round(p.beadPen);
    const nS = Math.max(1, Math.min(20, Math.round(p.strands)));
    const loops = Math.max(1, Math.round(p.loops));
    const spread = Math.max(1, p.spread);
    const clampP = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];

    const paths = [];
    const BUDGET = 120000;
    let total = 0;
    const emit = (pts, closed, layer) => {
      if (pts.length < 2 || total + pts.length > BUDGET) return;
      total += pts.length;
      paths.push({ pts: pts.map(clampP), closed, layer });
    };

    const STEP = 0.9; /* arc step along the loop, mm */
    const beadPts = []; /* [x, y, sizeMul] gathered while walking the strands */
    for (let k = 0; k < nS; k++) {
      const ph = rng() * Math.PI * 2;        /* loop phase */
      const ox = rng() * 90 + 7;             /* per-strand noise offsets */
      const oy = rng() * 90 + 53;
      const or2 = rng() * 90 + 131;
      const ow = rng() * 90 + 211;
      const thEnd = loops * Math.PI * 2;
      const pts = [];
      let th = 0, arc = 0, nextBead = p.beadGap * (0.4 + rng() * 0.6);
      let prev = null;
      while (th < thEnd) {
        const t = th / (Math.PI * 2); /* loop count so far, the slow clock */
        /* center wanders inside a bounded noise cloud - no drift escape;
           soft radial limit rounds the cloud instead of a square noise box */
        let wx = (noise2(t * (0.12 + p.wander * 0.5), ox, p.seed * 3 + 1) - 0.5) * 2 * spread;
        let wy = (noise2(t * (0.12 + p.wander * 0.5), oy, p.seed * 3 + 2) - 0.5) * 2 * spread;
        const wd = Math.hypot(wx, wy) / spread;
        const wl = 1 / Math.sqrt(1 + wd * wd * 0.8);
        const cx2 = CX + wx * wl;
        const cy2 = CY + wy * wl;
        /* radius breathes slowly, plus hand wobble */
        let r = p.radius * (1 + (noise2(t * 0.35, or2, p.seed * 5 + 3) - 0.5) * 1.4 * p.radVar);
        r = Math.max(2, r);
        r += p.wobble * 1.4 * (noise2(th * 0.9, ow, p.seed * 7 + 4) - 0.5) * 2;
        const x = cx2 + Math.cos(th + ph) * r;
        const y = cy2 + Math.sin(th + ph) * r;
        pts.push([x, y]);
        if (prev) {
          const d = Math.hypot(x - prev[0], y - prev[1]);
          arc += d;
          if (p.beads && arc >= nextBead) {
            /* bead probability falls off with distance from the cloud core */
            const dc = Math.hypot(x - CX, y - CY) / (spread + p.radius);
            const prob = p.falloff <= 0 ? 1 : Math.exp(-dc * dc * p.falloff * 4);
            if (rng() < prob) beadPts.push([x, y, 0.5 + rng() * 0.5, prob]);
            nextBead = arc + p.beadGap * (0.6 + rng() * 0.8);
          }
        }
        prev = [x, y];
        th += STEP / Math.max(4, r);
      }
      emit(pts, false, L); /* one continuous stroke per strand */
    }

    /* beads as tiny filled spirals (solid ink blobs), on their own pen */
    if (p.beads) {
      for (const [bx, by, szMul, prob] of beadPts) {
        const bR = Math.max(0.12, p.beadSize * szMul * (0.75 + 0.25 * prob));
        const turns = 1.7, nP = Math.max(10, Math.round(turns * 10));
        const sp = [];
        for (let i = 0; i <= nP; i++) {
          const a = (i / nP) * turns * Math.PI * 2;
          const rr = bR * (i / nP);
          sp.push([bx + Math.cos(a) * rr, by + Math.sin(a) * rr]);
        }
        emit(sp, false, BP);
      }
    }
    return applyStyle({ paths }, ins[0]);
  }
};
