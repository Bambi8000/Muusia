import { Pin, EMPTY, PENS, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "cracked_paint",
  name: "Cracked Paint",
  cat: "gen",
  group: "organic",
  desc: "Peeling paint: a hierarchical crack network splits the sheet into flakes. Early cracks are wide dark gaps, later ones taper to hairlines (Hierarchy sets the contrast); every crack curves with noise (Wobble), swells and thins along its run and pinches to a hairline at both ends like real craquelure. Horizontal bias steers the primaries sideways, Flake size sets how far the shattering subdivides. Wide cracks draw as varying-width outlines with lengthwise fill strokes (Fill spacing = pen width); Chips bulges dark blobs along the cracks and knocks whole small flakes out as hatched voids; Edge curl adds a broken inner line beside wide cracks \u2014 the lifted flake edge. Tip: Chip pen on a second color plots the missing flakes as a separate layer.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "flake", label: "Flake size", type: "slider", min: 8, max: 60, step: 0.5, def: 22 },
    { key: "hbias", label: "Horizontal bias", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "wobble", label: "Crack wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "widthMax", label: "Crack width", type: "slider", min: 0, max: 6, step: 0.1, def: 2.6 },
    { key: "hier", label: "Hierarchy", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "chips", label: "Chips", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "fill", label: "Fill cracks", type: "check", def: true },
    { key: "fillStep", label: "Fill spacing", type: "slider", min: 0.4, max: 2, step: 0.05, def: 0.7 },
    { key: "curl", label: "Edge curl", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "chipPen", label: "Chip pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed);
    const m = Math.max(0, p.margin);
    const lox = m, loy = m, hix = W - m, hiy = H - m;
    if (hix - lox < 15 || hiy - loy < 15) return EMPTY;
    const flake = Math.max(5, p.flake);
    const pen = Math.round(p.layer) % PENS.length;
    const chipPen = Math.round(p.chipPen) % PENS.length;
    const fillStep = Math.max(0.35, p.fillStep);
    const rng = mulberry32(seed * 7919 + 13);
    const paths = [];
    let budget = 112000;
    const inR = ([x, y]) => x >= lox && x <= hix && y >= loy && y <= hiy;
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({
        pts: pts.map(([x, y]) => [Math.min(hix, Math.max(lox, x)),
                                  Math.min(hiy, Math.max(loy, y))]),
        closed, layer,
      });
    };

    /* ---------- BSP flake subdivision (curved cracks, width by generation) */
    const splitPoly = (poly, P, dx, dy) => {
      const side = poly.map(([x, y]) => (x - P[0]) * dy - (y - P[1]) * dx);
      const A = [], B = [], hits = [];
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        (side[i] >= 0 ? A : B).push(poly[i]);
        if ((side[i] > 0 && side[j] < 0) || (side[i] < 0 && side[j] > 0)) {
          const t = side[i] / (side[i] - side[j]);
          const X = [poly[i][0] + (poly[j][0] - poly[i][0]) * t,
                     poly[i][1] + (poly[j][1] - poly[i][1]) * t];
          A.push(X); B.push(X); hits.push(X);
        }
      }
      if (hits.length < 2 || A.length < 3 || B.length < 3) return null;
      return [A, B, [hits[0], hits[1]]];
    };
    const polyArea = (poly) => {
      let a = 0;
      for (let i = 0; i < poly.length; i++) {
        const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
        a += x0 * y1 - x1 * y0;
      }
      return Math.abs(a / 2);
    };
    const longestEdge = (poly) => {
      let bl = 0, be = [1, 0];
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        const ex = poly[j][0] - poly[i][0], ey = poly[j][1] - poly[i][1];
        const L = Math.hypot(ex, ey);
        if (L > bl) { bl = L; be = [ex / L, ey / L]; }
      }
      return { len: bl, dir: be };
    };

    const cracks = []; // { A, B, gen }
    const finals = [];
    const stack = [{ poly: [[lox, loy], [hix, loy], [hix, hiy], [lox, hiy]], gen: 0 }];
    let iter = 0;
    while (stack.length && iter++ < 900) {
      const { poly, gen } = stack.pop();
      const { len, dir } = longestEdge(poly);
      if (len < flake * 1.7 || polyArea(poly) < flake * flake * 1.6) {
        finals.push(poly);
        continue;
      }
      let mx = 0, my = 0;
      for (const [x, y] of poly) { mx += x; my += y; }
      mx /= poly.length; my /= poly.length;
      const P = [mx + dir[0] * (rng() - 0.5) * len * 0.4,
                 my + dir[1] * (rng() - 0.5) * len * 0.4];
      // split angle: perpendicular to the longest edge, pulled toward
      // horizontal cracks (angle ~0) by Horizontal bias, plus jitter
      let ang = Math.atan2(dir[1], dir[0]) + Math.PI / 2;
      if (rng() < p.hbias) ang = ang * 0.25; // bias split lines horizontal-ish
      ang += (rng() - 0.5) * 0.8;
      const cut = splitPoly(poly, P, Math.cos(ang), Math.sin(ang));
      if (!cut) { finals.push(poly); continue; }
      cracks.push({ A: cut[2][0], B: cut[2][1], gen });
      stack.push({ poly: cut[0], gen: gen + 1 }, { poly: cut[1], gen: gen + 1 });
    }

    /* ---------- render one crack: curved centerline + width profile ------ */
    const drawCrack = (A, B, gen, ci) => {
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (L < 2) return;
      const ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
      const nx = -uy, ny = ux;
      const n = Math.max(6, Math.ceil(L / 1.0));
      const amp = p.wobble * Math.min(6, L * 0.12);
      const wGen = p.widthMax * Math.pow(0.55, gen * p.hier);
      const C = [], Wd = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const s = t * L;
        const bend = (noise2(s * 0.04 + ci * 3.1, ci * 0.77, seed + 3) - 0.5) * 2 * amp *
          Math.sin(Math.PI * t); // pinned at both ends (junctions stay tight)
        C.push([A[0] + ux * s + nx * bend, A[1] + uy * s + ny * bend]);
        // width: noise breathing * end taper -> hairline tips
        let w = wGen * (0.3 + 0.7 * noise2(s * 0.06 + 9, ci * 0.53, seed + 11)) *
          Math.pow(Math.sin(Math.PI * t), 0.45);
        // chips: local bulges
        if (p.chips > 0) {
          const hb = hash2(ci, Math.floor(s / 14), seed + 21);
          if (hb < p.chips * 0.3) {
            const cpos = (Math.floor(s / 14) + 0.5) * 14;
            const g = Math.exp(-Math.pow((s - cpos) / 4.5, 2));
            w += wGen * (1.5 + 2 * hash2(ci, Math.floor(s / 14) + 99, seed)) * g;
          }
        }
        Wd.push(w);
      }
      const wide = Wd.some((w) => w > 0.4);
      if (!wide || p.widthMax < 0.05) {
        push(C, false, pen);
        return;
      }
      // varying-width outline via per-point normals
      const NRM = [];
      for (let i = 0; i <= n; i++) {
        const a = C[Math.max(0, i - 1)], b = C[Math.min(n, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        NRM.push([-dy / l, dx / l]);
      }
      const off = (i, f) => [C[i][0] + NRM[i][0] * (Wd[i] / 2) * f,
                             C[i][1] + NRM[i][1] * (Wd[i] / 2) * f];
      const outline = [];
      for (let i = 0; i <= n; i++) outline.push(off(i, 1));
      for (let i = n; i >= 0; i--) outline.push(off(i, -1));
      push(outline, true, pen);
      if (p.fill) {
        // lengthwise fill at fractions of the LOCAL width: strokes hug the
        // varying profile and converge into the hairline tips by themselves
        const wMax = Math.max(...Wd);
        const lines = Math.floor(wMax / fillStep) - 1;
        let flip = false;
        for (let k2 = 1; k2 <= lines; k2++) {
          const f = -1 + (2 * k2) / (lines + 1);
          const pl = [];
          for (let i = 0; i <= n; i++) pl.push(off(i, f));
          push(flip ? pl.reverse() : pl, false, pen);
          flip = !flip;
        }
      }
      // edge curl: broken inner line beside the crack on one side
      if (p.curl > 0.02 && wGen > 0.8) {
        const sideF = hash2(ci, 7, seed) < 0.5 ? 1 : -1;
        let run = [];
        const flush = () => { if (run.length >= 3) push(run, false, pen); run = []; };
        for (let i = 0; i <= n; i++) {
          const keep = hash2(ci, Math.floor((i / n) * L / 6), seed + 31) < p.curl * 0.8;
          if (keep && Wd[i] > 0.3) {
            run.push([C[i][0] + NRM[i][0] * (Wd[i] / 2 + 1.2) * sideF,
                      C[i][1] + NRM[i][1] * (Wd[i] / 2 + 1.2) * sideF]);
          } else flush();
        }
        flush();
      }
    };
    cracks.forEach((c, ci) => drawCrack(c.A, c.B, c.gen, ci));

    /* ---------- chipped flakes: small cells knocked out entirely --------- */
    if (p.chips > 0.02) {
      const rngC = mulberry32(seed * 7919 + 401);
      for (const poly of finals) {
        if (budget <= 0) break;
        const a = polyArea(poly);
        if (a > flake * flake * 1.4) continue;      // only small flakes chip
        if (rngC() > p.chips * 0.35) { rngC(); continue; }
        const angH = rngC() * Math.PI;
        // inset polygon toward centroid
        let mx = 0, my = 0;
        for (const [x, y] of poly) { mx += x; my += y; }
        mx /= poly.length; my /= poly.length;
        const ins2 = poly.map(([x, y]) => [x + (mx - x) * 0.12, y + (my - y) * 0.12]);
        push([...ins2], true, chipPen);
        // hatch fill clipped to the inset polygon
        const insidePoly = ([px, py]) => {
          let w2 = false;
          for (let i = 0, j = ins2.length - 1; i < ins2.length; j = i++) {
            const [xi, yi] = ins2[i], [xj, yj] = ins2[j];
            if ((yi > py) !== (yj > py) &&
                px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) w2 = !w2;
          }
          return w2;
        };
        const ca = Math.cos(angH), sa = Math.sin(angH);
        let ext = 0;
        for (const [x, y] of ins2) ext = Math.max(ext, Math.hypot(x - mx, y - my));
        let flip = false;
        for (let o = -ext; o <= ext; o += fillStep) {
          let run = [];
          const flush = () => { if (run.length >= 2) push(flip ? run.reverse() : run, false, chipPen); run = []; };
          for (let t = -ext; t <= ext; t += 0.9) {
            const q = [mx + ca * t - sa * o, my + sa * t + ca * o];
            if (inR(q) && insidePoly(q)) run.push(q); else flush();
          }
          flush();
          flip = !flip;
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
