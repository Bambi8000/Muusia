({
  key: "parallel_lines",
  name: "Parallel Lines",
  cat: "gen",
  group: "geometric",
  desc: "A dense field of vertical parallel lines rising from the bottom margin to a terraced height field, with expressive line tops. Top style picks the character: Grass flops each tip over in a random little curl; Shoulder combs the lines near each terrace edge over a shared pivot in concentric arcs and lets them hang down the face; Cascade sweeps them over the edge into parallel diagonal falls that steepen back to vertical. Levels quantizes terrace heights (1 = one flat field), Plateau width sets terrace size, Relief how deep the steps cut. Tail length scales curls, hangs and falls; Messiness adds per-line variance, Wobble bends the vertical runs with noise. Chain into Smear or Squiggle for further abuse.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "spacing", label: "Line spacing", type: "slider", min: 0.4, max: 5, step: 0.05, def: 1.1 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "mode", label: "Top style", type: "select", options: ["Grass", "Shoulder", "Cascade"], def: "Shoulder" },
    { key: "levels", label: "Levels", type: "slider", min: 1, max: 8, step: 1, def: 3 },
    { key: "plateau", label: "Plateau width", type: "slider", min: 8, max: 150, step: 1, def: 45 },
    { key: "relief", label: "Relief", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "fall", label: "Tail length", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "mess", label: "Messiness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.15 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const spacing = Math.max(0.25, p.spacing);
    const margin = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 5));
    const levels = Math.max(1, Math.round(p.levels));
    const platW = Math.max(6, p.plateau);
    const relief = Math.max(0, Math.min(1.5, p.relief));
    const fall = Math.max(0, p.fall);
    const mess = Math.max(0, Math.min(2, p.mess));
    const wobble = Math.max(0, p.wobble);
    const mode = p.mode;
    const layer = Math.round(p.layer);

    const x0 = margin, x1 = W - margin;
    if (x1 - x0 < spacing * 2) return applyStyle(EMPTY, ins[0]);
    const bottomY = H - margin;

    // reach of the combed band from a terrace edge (Shoulder/Cascade)
    const Rmax = mode === "Grass" ? 0 : 5 + fall * (mode === "Cascade" ? 55 : 38);
    const headroom = mode === "Grass"
      ? 8
      : Math.min(Rmax + 8, (H - 2 * margin) * 0.45);
    const topMin = margin + headroom;
    const minLen = 12;
    const range = Math.max(0, relief * (bottomY - topMin - minLen));
    if (bottomY - topMin < minLen) return applyStyle(EMPTY, ins[0]);

    // ---- terraces (in mm space, independent of line spacing) ----
    const prng = mulberry32(seed * 7919 + 101);
    let plats = [];
    let xc = x0;
    while (xc < x1) {
      const w = platW * (0.55 + prng() * 0.9);
      const level = Math.floor(prng() * levels);
      plats.push({ x0: xc, x1: Math.min(x1, xc + w), level });
      xc += w;
    }
    // merge adjacent equal levels so an edge only exists at a real height change
    const merged = [];
    for (const pl of plats) {
      const last = merged[merged.length - 1];
      if (last && last.level === pl.level) last.x1 = pl.x1;
      else merged.push({ ...pl });
    }
    plats = merged;
    plats.forEach((pl, i) => {
      const f = levels > 1 ? pl.level / (levels - 1) : 0;
      pl.topY = topMin + f * range;
      let dir = hash2(i * 17 + 3, pl.level * 5 + 1, seed) < 0.5 ? -1 : 1;
      // keep the comb pivot from running off the sheet
      const pivot = dir > 0 ? pl.x1 : pl.x0;
      if (pivot + dir * (Rmax * 0.6 + 8) < 3 || pivot + dir * (Rmax * 0.6 + 8) > W - 3) dir = -dir;
      pl.dir = dir;
      pl.r0 = 2.2 + hash2(i * 31 + 7, 2, seed) * 2.5;                 // pivot base radius
      pl.sigma = (26 + hash2(i * 13 + 5, 9, seed) * 26) * Math.PI / 180; // cascade slope below horizontal
      pl.Fbase = 25 + hash2(i * 29 + 11, 4, seed) * 65;               // cascade run length base
    });

    // ---- point budget → adaptive steps ----
    const nLines = Math.floor((x1 - x0) / spacing) + 1;
    const avgLen = bottomY - (topMin + range / 2);
    let stepV = 2.2, stepA = 0.9;
    const est = nLines * (avgLen / stepV + 70);
    if (est > 110000) { const k = est / 110000; stepV *= k; stepA *= Math.min(k, 2.5); }

    const safe = (x, y) => x > 1.5 && x < W - 1.5 && y > 1.5 && y < H - 1.5;
    const paths = [];
    let pi = 0; // plateau walker

    for (let li = 0; li < nLines; li++) {
      const bx = x0 + li * spacing;
      while (pi < plats.length - 1 && bx > plats[pi].x1) pi++;
      const pl = plats[pi];
      const rng = mulberry32(seed * 7919 + li * 613 + 29);
      const yTop = pl.topY;

      // vertical run, bottom → top (point order = pen direction)
      const wobAmp = wobble * 2.2;
      const wob = (y) => {
        if (wobAmp <= 0) return 0;
        const fade = Math.min(1, (y - yTop) / 15); // continuous at the top junction
        return (noise2(bx * 0.05, y * 0.035, seed * 3 + 91) - 0.5) * 2 * wobAmp * fade;
      };
      const clampX = (x) => Math.min(W - 0.2, Math.max(0.2, x));
      const pts = [];
      for (let y = bottomY; y > yTop; y -= stepV) pts.push([clampX(bx + wob(y)), y]);
      pts.push([clampX(bx), yTop]);

      // ---- tail: turtle from the top, heading up ----
      let cx = bx, cy = yTop, phi = -Math.PI / 2;
      const emit = () => { if (safe(cx, cy)) { pts.push([cx, cy]); return true; } return false; };
      const arc = (r, dA) => {
        if (Math.abs(dA) < 1e-6 || r <= 0) return true;
        const s = Math.sign(dA);
        const Cx = cx + r * Math.cos(phi + s * Math.PI / 2);
        const Cy = cy + r * Math.sin(phi + s * Math.PI / 2);
        const th0 = phi - s * Math.PI / 2;
        const n = Math.max(2, Math.ceil((Math.abs(dA) * r) / stepA));
        for (let k = 1; k <= n; k++) {
          const t = th0 + dA * (k / n);
          cx = Cx + r * Math.cos(t); cy = Cy + r * Math.sin(t);
          if (!emit()) { phi += dA * (k / n); return false; }
        }
        phi += dA;
        return true;
      };
      const straight = (L, st) => {
        const n = Math.max(1, Math.ceil(L / st));
        for (let k = 1; k <= n; k++) {
          cx += Math.cos(phi) * (L / n); cy += Math.sin(phi) * (L / n);
          if (!emit() || cy >= bottomY - 0.5) return false;
        }
        return true;
      };

      const d = pl.dir > 0 ? pl.x1 - bx : bx - pl.x0; // distance to the flop edge
      const combed = mode !== "Grass" && d <= Rmax;

      if (mode === "Grass" || !combed) {
        // free curl (full-size in Grass, micro-hook on plateau interiors)
        const micro = mode !== "Grass";
        const gdir = micro
          ? (rng() < 0.75 ? pl.dir : -pl.dir)
          : (rng() < 0.5 ? -1 : 1);
        const r = micro
          ? 0.9 + rng() * 1.4
          : (1.3 + rng() * 2.6) * (0.5 + fall);
        let th = micro
          ? (50 + rng() * 70)
          : (60 + rng() * 110) * (0.6 + mess * 0.8);
        th = Math.max(25, Math.min(175, th)) * Math.PI / 180;
        if (arc(r, gdir * th) && !micro && fall > 0) straight(0.4 + rng() * 2 * fall, stepA);
      } else if (mode === "Shoulder") {
        // concentric comb over the shared pivot, then hang down the face
        const r = d + pl.r0;
        if (arc(r, pl.dir * Math.PI)) {
          const hang = fall * (6 + rng() * 40) * (0.7 + mess * 0.6);
          straight(Math.min(hang, bottomY - 1 - cy), stepV * 0.7);
        }
      } else {
        // Cascade: crest arc into a diagonal fall that steepens back to vertical
        const r = d + pl.r0;
        const sig = pl.sigma + (rng() - 0.5) * 2 * (5 * Math.PI / 180) * mess;
        if (arc(r, pl.dir * (Math.PI / 2 + sig))) {
          const F = fall * pl.Fbase * (0.8 + rng() * 0.4);
          const extra = (Math.PI / 2 - sig) * (0.5 + rng() * 0.5); // total extra steepening
          const st = 1.6;
          let run = 0, ok = true;
          const target = -Math.PI / 2 + pl.dir * Math.PI; // straight down, same turn sense
          while (run < F && ok) {
            cx += Math.cos(phi) * st; cy += Math.sin(phi) * st;
            ok = emit() && cy < bottomY - 0.5;
            run += st;
            if (Math.abs(target - phi) > 1e-3) {
              const dphi = pl.dir * (extra / F) * st;
              phi = pl.dir > 0 ? Math.min(target, phi + dphi) : Math.max(target, phi + dphi);
            }
          }
          if (ok && fall > 0) { phi = target; straight((3 + rng() * 12) * fall, stepV * 0.7); }
        }
      }

      if (pts.length >= 2) paths.push({ pts, closed: false, layer });
    }
    return applyStyle({ paths }, ins[0]);
  },
})
