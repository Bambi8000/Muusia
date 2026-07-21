import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "gravity_cascade",
  name: "Gravity Cascade",
  cat: "gen",
  group: "scientific",
  desc: "Particles launched into a field of gravity wells trace decaying orbits. Wells layout places the attractors (Triangle is the classic three; Line, Ring, Center + ring and Random use the Wells count). Launch picks the start: Ring around the center, Top rain falling from the upper edge, or Spiral with staggered radii. Paths end at the sheet edge.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 888 },
    { key: "wells", label: "Wells layout", type: "select", options: ["Triangle", "Line", "Ring", "Center + ring", "Random"], def: "Triangle" },
    { key: "wellN", label: "Wells (non-triangle)", type: "slider", min: 1, max: 6, step: 1, def: 3 },
    { key: "launch", label: "Launch", type: "select", options: ["Ring", "Top rain", "Spiral"], def: "Ring" },
    { key: "orbits", label: "Orbit Count", type: "slider", min: 5, max: 80, step: 1, def: 35 },
    { key: "steps", label: "Steps per Orbit", type: "slider", min: 100, max: 2000, step: 50, def: 800 },
    { key: "pull", label: "Gravity Strength", type: "slider", min: 0.1, max: 3.0, step: 0.1, def: 1.2 },
    { key: "damping", label: "Friction Decay", type: "slider", min: 0.0, max: 0.02, step: 0.001, def: 0.003 },
    { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 8 },
    { key: "layer", label: "Pen Index", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
    const rng = mulberry32(p.seed * 4321 + 93);
    const paths = [];
    const L = Math.round(p.layer);

    /* wells: Triangle keeps the classic layout AND rng call order (old patches
       render identically); other layouts use the Wells count */
    const jit = () => (rng() - 0.5) * Math.min(W, H) * 0.08;
    const NW = Math.max(1, Math.round(p.wellN));
    let centers;
    if (p.wells === "Line") {
      centers = [];
      for (let i = 0; i < NW; i++) {
        const u = NW === 1 ? 0.5 : 0.2 + 0.6 * (i / (NW - 1));
        centers.push([W * u + jit() * 0.5, H * 0.5 + jit() * 0.5]);
      }
    } else if (p.wells === "Ring") {
      centers = [];
      const rr = Math.min(W, H) * 0.22;
      for (let i = 0; i < NW; i++) {
        const a = (i / NW) * Math.PI * 2 + rng() * 0.4;
        centers.push([W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr]);
      }
    } else if (p.wells === "Center + ring") {
      centers = [[W / 2 + jit() * 0.3, H / 2 + jit() * 0.3]];
      const rr = Math.min(W, H) * 0.27;
      for (let i = 0; i < Math.max(0, NW - 1); i++) {
        const a = (i / Math.max(1, NW - 1)) * Math.PI * 2 + rng() * 0.4;
        centers.push([W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr]);
      }
    } else if (p.wells === "Random") {
      centers = [];
      for (let i = 0; i < NW; i++) {
        centers.push([W * (0.25 + rng() * 0.5), H * (0.25 + rng() * 0.5)]);
      }
    } else {
      centers = [
        [W * 0.5 + jit(), H * 0.3 + jit()],
        [W * 0.35 + jit(), H * 0.65 + jit()],
        [W * 0.65 + jit(), H * 0.65 + jit()]
      ];
    }

    const orbitCount = Math.round(p.orbits);
    const maxSteps = Math.round(p.steps);
    const dt = 0.4;
    const BUDGET = 110000;
    let totalPts = 0;
    const inside = (x, y) => x >= m && x <= W - m && y >= m && y <= H - m;

    for (let o = 0; o < orbitCount && totalPts < BUDGET; o++) {
      let px, py, vx, vy;
      if (p.launch === "Top rain") {
        const u = orbitCount === 1 ? 0.5 : o / (orbitCount - 1);
        px = m + 4 + u * (W - 2 * m - 8) + (rng() - 0.5) * 4;
        py = m + 3 + rng() * Math.min(20, H * 0.06);
        const speed = 1.2 * (0.85 + rng() * 0.3);
        vx = (rng() - 0.5) * 0.6;
        vy = speed;
      } else if (p.launch === "Spiral") {
        const angle = (o / orbitCount) * Math.PI * 6;
        const shell = Math.min(W, H) * (0.1 + 0.3 * (o / orbitCount)) * (0.9 + rng() * 0.2);
        px = W * 0.5 + Math.cos(angle) * shell;
        py = H * 0.5 + Math.sin(angle) * shell;
        const speed = 1.8 * (0.85 + rng() * 0.3);
        vx = -Math.sin(angle) * speed;
        vy = Math.cos(angle) * speed;
      } else {
        /* Ring: classic launch, classic rng order */
        const angle = (o / orbitCount) * Math.PI * 2;
        const shell = Math.min(W, H) * 0.25 * (0.85 + rng() * 0.3);
        px = W * 0.5 + Math.cos(angle) * shell;
        py = H * 0.5 + Math.sin(angle) * shell;
        const speed = 1.8 * (0.85 + rng() * 0.3);
        vx = -Math.sin(angle) * speed;
        vy = Math.cos(angle) * speed;
      }

      const pts = [[px, py]];
      let lastX = px, lastY = py;
      for (let s = 0; s < maxSteps; s++) {
        let ax = 0, ay = 0;
        for (let c = 0; c < centers.length; c++) {
          const dx = centers[c][0] - px;
          const dy = centers[c][1] - py;
          const distSq = dx * dx + dy * dy + 15.0;
          const dist = Math.sqrt(distSq);
          const force = p.pull / distSq;
          ax += (dx / dist) * force;
          ay += (dy / dist) * force;
        }
        vx += ax * dt; vy += ay * dt;
        vx *= (1.0 - p.damping); vy *= (1.0 - p.damping);
        px += vx * dt; py += vy * dt;
        /* end the path AT the sheet: out-of-canvas points must not be emitted */
        if (!inside(px, py)) break;
        /* decimation: tight orbits crawl; only emit once the pen has moved */
        if (Math.hypot(px - lastX, py - lastY) >= 0.35) {
          pts.push([px, py]);
          lastX = px; lastY = py;
          totalPts++;
          if (totalPts >= BUDGET) break;
        }
      }
      if (pts.length > 2) paths.push({ pts, closed: false, layer: L });
    }
    return applyStyle({ paths }, ins[0]);
  }
};