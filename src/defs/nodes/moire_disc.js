import { Pin, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "moire_disc",
  name: "Moire Disc",
  cat: "gen",
  group: "geometric",
  desc: "One disc, filled with fine regular structure - built to be overlapped. Content picks the filling: Rings (concentric), Spiral (one continuous Archimedean line), Spokes (radial), Hatch (parallel chords), Mesh (crosshatch), Hex / Grid / Random circles (small packed circles, each optionally concentric via Circle rings), or Phyllotaxis (the sunflower lattice). Pitch is the line or lattice spacing, Angle rotates the pattern, and Disorder morphs any ordered arrangement toward chaos - positions, radii and lines wander with the seed, but the content NEVER leaks outside the disc, so overlaps stay clean. X/Y place the disc on the sheet as canvas percentages. The whole point: drop two or three of these on top of each other with a small difference - Pitch off by 5%, Angle off by 2-5 degrees, or centers a few mm apart - and the interference becomes moire. Every knob has a value port, so wire the Frame clock into Angle or X and the moire breathes. Tip: Rings vs Rings offset by half a radius is the classic pattern; Hatch vs Hatch at 3 degrees is the finest shimmer.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "x", label: "X %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "y", label: "Y %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "radius", label: "Radius mm", type: "slider", min: 5, max: 140, step: 0.5, def: 60 },
    { key: "content", label: "Content", type: "select", options: ["Rings", "Spiral", "Spokes", "Hatch", "Mesh", "Hex circles", "Grid circles", "Random circles", "Phyllotaxis"], def: "Rings" },
    { key: "pitch", label: "Pitch mm", type: "slider", min: 0.8, max: 12, step: 0.05, def: 3 },
    { key: "angle", label: "Angle deg", type: "slider", min: 0, max: 180, step: 0.5, def: 0 },
    { key: "disorder", label: "Disorder", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "csize", label: "Circle size mm", type: "slider", min: 0.4, max: 15, step: 0.1, def: 2.2 },
    { key: "crings", label: "Circle rings", type: "slider", min: 1, max: 8, step: 1, def: 1 },
    { key: "rim", label: "Rim circle", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 1 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const cx = (ctx.W * p.x) / 100, cy = (ctx.H * p.y) / 100;
    return [{ kind: "circle", cx, cy, r: Math.max(1, p.radius) }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const cx = (W * Math.max(0, Math.min(100, p.x))) / 100;
    const cy = (H * Math.max(0, Math.min(100, p.y))) / 100;
    const R = Math.max(2, p.radius);
    const pitch = Math.max(0.5, p.pitch);
    const ang = ((p.angle % 180) * Math.PI) / 180;
    const dis = Math.max(0, Math.min(1, p.disorder));
    const csize = Math.max(0.3, p.csize);
    const crings = Math.max(1, Math.min(8, Math.round(p.crings)));
    const seed = Math.round(p.seed);
    const L = Math.round(p.layer);
    const mode = p.content;

    const paths = [];
    const BUDGET = 110000;
    let total = 0;
    const push = (pts, closed) => {
      if (pts.length < 2 || total > BUDGET) return;
      total += pts.length;
      paths.push({ pts, closed: !!closed, layer: L });
    };
    const circle = (x0, y0, r, closed = true) => {
      if (r < 0.25 || total > BUDGET) return;
      const ds = Math.min(1.2, Math.max(0.6, r / 14));
      const n = Math.max(8, Math.ceil((Math.PI * 2 * r) / ds));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([x0 + Math.cos(a) * r, y0 + Math.sin(a) * r]);
      }
      push(pts, closed);
    };
    /* a packed circle with optional concentric inner rings, all inside the disc */
    const packed = (x0, y0, r) => {
      const g = r / crings;
      for (let k = 0; k < crings; k++) circle(x0, y0, r - k * g + (k ? 0 : 0));
    };
    const inDisc = (x, y, m = 0.02) => Math.hypot(x - cx, y - cy) <= R - m;

    if (p.rim) circle(cx, cy, R);

    if (mode === "Rings") {
      let idx = 0;
      for (let rr = R - pitch; rr >= pitch * 0.4; rr -= pitch) {
        const jr = dis * pitch * 0.4 * (hash2(idx, 3, seed + 7) - 0.5) * 2;
        const je = dis * Math.min(rr * 0.25, R - rr) * hash2(idx, 11, seed + 13);
        const ja = hash2(idx, 17, seed + 19) * Math.PI * 2;
        const ex = cx + Math.cos(ja) * je, ey = cy + Math.sin(ja) * je;
        const r2 = Math.min(Math.max(0.3, rr + jr), R - je - 0.05);
        if (r2 > 0.3) circle(ex, ey, r2);
        idx++;
      }
    } else if (mode === "Spiral") {
      const pts = [];
      let a = ang, r = R - 0.05;
      let guard = 0;
      while (r > 0.3 && guard++ < 200000 && total + pts.length < BUDGET) {
        const wob = dis * pitch * 0.45 * (noise2(Math.cos(a) * 3 + r * 0.05, Math.sin(a) * 3, seed + 23) - 0.5) * 2;
        const re = Math.min(r + wob, R - 0.05);
        pts.push([cx + Math.cos(a) * re, cy + Math.sin(a) * re]);
        const da = Math.min(0.6, Math.max(0.6, r) > 0 ? 0.8 / Math.max(r, 0.6) : 0.6);
        a += da;
        r -= (pitch * da) / (Math.PI * 2);
      }
      push(pts, false);
    } else if (mode === "Spokes") {
      const n = Math.max(3, Math.round((Math.PI * 2 * R) / pitch));
      for (let i = 0; i < n; i++) {
        const a = ang + (i / n) * Math.PI * 2 + dis * ((Math.PI * 2) / n) * 0.45 * (hash2(i, 5, seed + 29) - 0.5) * 2;
        const r0 = R * 0.05 + dis * R * 0.25 * hash2(i, 7, seed + 31);
        const r1 = R - 0.05 - dis * R * 0.3 * hash2(i, 9, seed + 37);
        if (r1 - r0 < 1) continue;
        push([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], false);
      }
    } else if (mode === "Hatch" || mode === "Mesh") {
      const dirs = mode === "Mesh" ? [ang, ang + Math.PI / 2] : [ang];
      for (let di = 0; di < dirs.length; di++) {
        const a = dirs[di];
        const ux = Math.cos(a), uy = Math.sin(a);      /* along the line */
        const nx = -uy, ny = ux;                        /* across lines */
        let li = 0;
        for (let d = -R + pitch * 0.5; d <= R - pitch * 0.2; d += pitch) {
          const jd = d + dis * pitch * 0.35 * (hash2(li, 41 + di, seed + 43) - 0.5) * 2;
          if (Math.abs(jd) >= R - 0.1) { li++; continue; }
          const half = Math.sqrt(Math.max(0, R * R - jd * jd)) - 0.05;
          const bx = cx + nx * jd, by = cy + ny * jd;
          let run = [];
          const n = Math.max(2, Math.ceil((2 * half) / 1.4));
          for (let k = 0; k <= n; k++) {
            const s = -half + (2 * half * k) / n;
            const w = dis * pitch * 0.4 * (noise2((bx + ux * s) * 0.05, (by + uy * s) * 0.05, seed + 47 + di) - 0.5) * 2;
            const x = bx + ux * s + nx * w, y = by + uy * s + ny * w;
            if (inDisc(x, y)) run.push([x, y]);
            else { if (run.length >= 2) push(run, false); run = []; }
          }
          if (run.length >= 2) push(run, false);
          li++;
        }
      }
    } else if (mode === "Hex circles" || mode === "Grid circles") {
      const hex = mode === "Hex circles";
      const rowH = hex ? pitch * 0.866 : pitch;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const nr = Math.ceil(R / rowH) + 2, nc = Math.ceil(R / pitch) + 2;
      for (let row = -nr; row <= nr; row++) {
        for (let col = -nc; col <= nc; col++) {
          const lx = (col + (hex && row % 2 ? 0.5 : 0)) * pitch;
          const ly = row * rowH;
          const jx = dis * pitch * 0.45 * (hash2(row, col * 2 + 1, seed + 53) - 0.5) * 2;
          const jy = dis * pitch * 0.45 * (hash2(row * 3 + 1, col, seed + 59) - 0.5) * 2;
          const x = cx + (lx + jx) * ca - (ly + jy) * sa;
          const y = cy + (lx + jx) * sa + (ly + jy) * ca;
          const r = Math.max(0.3, csize * (1 - dis * 0.5 * hash2(row * 7, col * 5 + 3, seed + 61)));
          if (Math.hypot(x - cx, y - cy) + r <= R - 0.05) packed(x, y, r);
        }
      }
    } else if (mode === "Random circles") {
      const rng = mulberry32(seed * 7919 + 67);
      const n = Math.max(1, Math.round((Math.PI * R * R) / (pitch * pitch)));
      for (let i = 0; i < Math.min(n, 6000); i++) {
        const a = rng() * Math.PI * 2;
        const rr = R * Math.sqrt(rng());
        const r = Math.max(0.3, csize * (0.35 + rng() * 0.65) * (1 - dis * 0.5 * rng()));
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (Math.hypot(x - cx, y - cy) + r <= R - 0.05) packed(x, y, r);
      }
    } else if (mode === "Phyllotaxis") {
      const GA = Math.PI * (3 - Math.sqrt(5));
      const step = pitch * 0.55;
      for (let k = 1; k < 20000; k++) {
        const rr = step * Math.sqrt(k);
        if (rr + csize > R - 0.05) break;
        const a = ang + k * GA;
        const jx = dis * pitch * 0.4 * (hash2(k, 5, seed + 71) - 0.5) * 2;
        const jy = dis * pitch * 0.4 * (hash2(k, 9, seed + 73) - 0.5) * 2;
        const x = cx + Math.cos(a) * rr + jx, y = cy + Math.sin(a) * rr + jy;
        const r = Math.max(0.3, csize * (1 - dis * 0.5 * hash2(k, 13, seed + 79)));
        if (Math.hypot(x - cx, y - cy) + r <= R - 0.05) packed(x, y, r);
        if (total > BUDGET) break;
      }
    }

    return applyStyle({ paths }, ins[0]);
  },
};
