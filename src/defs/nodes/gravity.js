import { Pin, EMPTY, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  /* Gravity - a regular grid of stamps lets go from the bottom up.

     Every grid element carries a release score: its row position plus a
     noise2 clump field plus a hashed softness term. Elements over the release
     line fall with a hashed fall fraction f (Progress skews it), and along
     the fall Drift (noise2), Spin (hashed direction) and Size mod ramp with f.
     Landed elements are dropped into a 1-D height field in seeded order and
     roll to the lower neighbour column like sand, which builds the heap;
     Pile spread pulls landing points toward the middle for a central mound.

     Stamps are the built-in shapes or the wired Stamp paths, normalised to a
     unit box and scaled to Stamp size x cell. Colours follow the element
     from the grid into the heap (Assign by diagonal / row / column / hash).
     All randomness is hash2 / noise2 with the seed; the layout is stable
     under every parameter that does not touch the fall. */
  key: "gravity",
  name: "Gravity",
  cat: "gen",
  group: "geometric",
  desc: "A regular grid of stamps lets go from the bottom up: rows below the Release line detach, fall, and pile into a heap on the floor of the margin box while the top of the grid stays intact. Stamp is a Dot, Ring, Square, Diamond or Cross, or the wired Stamp paths normalised and repeated in every cell (Stamp size × cell). Release sets how much of the sheet has let go, Softness blurs the line, Clumps adds a noise field that frees clusters higher up. Progress is the share of released elements that have already landed; the rest hang mid-fall, most of them just below the line, and along the fall Drift moves it sideways with noise, Spin rotates it, Size mod shrinks or grows it; Spin / size apply to chooses whether those two ramp with the fall (Fallen only) or every element, intact ones included, carries its own hashed spin and size (All); Grid jitter shakes the intact elements near the line. Pile Heap stacks landed elements into a height field that rolls like sand (Pile spread pulls landings toward the middle, Packing sets stacking density), Floor lays them on the floor line, None drops them off the sheet. Palette 1 to 4 pens assigned by Diagonal (the i + j pattern of the classic print), Rows, Columns or Random; the colour travels with the element. Seed moves only the released elements and the jitter.",
  ins: [Pin("paths", "Stamp (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "cols", label: "Cols", type: "slider", min: 2, max: 80, step: 1, def: 24 },
    { key: "rows", label: "Rows", type: "slider", min: 2, max: 80, step: 1, def: 16 },
    { key: "stamp", label: "Stamp", type: "select", options: ["Dot", "Ring", "Square", "Diamond", "Cross"], def: "Dot" },
    { key: "stampSize", label: "Stamp size", type: "slider", min: 0.1, max: 1, step: 0.01, def: 0.5 },
    { key: "release", label: "Release", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "softness", label: "Softness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "clumps", label: "Clumps", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "progress", label: "Progress (landed share)", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "drift", label: "Drift mm", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
    { key: "spin", label: "Spin deg", type: "slider", min: 0, max: 720, step: 5, def: 0 },
    { key: "sizeMod", label: "Size mod", type: "slider", min: -1, max: 1, step: 0.05, def: 0 },
    { key: "modulate", label: "Spin / size apply to", type: "select", options: ["Fallen only", "All"], def: "Fallen only" },
    { key: "gridJitter", label: "Grid jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
    { key: "pile", label: "Pile", type: "select", options: ["Heap", "Floor", "None"], def: "Heap" },
    { key: "spread", label: "Pile spread", type: "slider", min: 0.05, max: 1, step: 0.05, def: 0.6, showIf: (p) => p.pile === "Heap" },
    { key: "packing", label: "Packing", type: "slider", min: 0.5, max: 1.5, step: 0.05, def: 0.9, showIf: (p) => p.pile === "Heap" },
    { key: "palette", label: "Palette", type: "slider", min: 1, max: 4, step: 1, def: 4 },
    { key: "assign", label: "Assign", type: "select", options: ["Diagonal", "Rows", "Columns", "Random"], def: "Diagonal", showIf: (p) => p.palette > 1 },
    { key: "penA", label: "Pen A", type: "pen", def: 1 },
    { key: "penB", label: "Pen B", type: "pen", def: 2, showIf: (p) => p.palette > 1 },
    { key: "penC", label: "Pen C", type: "pen", def: 11, showIf: (p) => p.palette > 2 },
    { key: "penD", label: "Pen D", type: "pen", def: 10, showIf: (p) => p.palette > 3 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],

  /* grid frame shared with the overlay */
  _frame(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const m = Math.max(0, Math.min(Number(p.margin) || 0, Math.min(W, H) / 2 - 1));
    const bw = Math.max(1, W - 2 * m), bh = Math.max(1, H - 2 * m);
    const cols = Math.max(1, Math.round(Number(p.cols) || 1)), rows = Math.max(1, Math.round(Number(p.rows) || 1));
    const cell = Math.min(bw / cols, bh / rows);
    const gx = m + (bw - cols * cell) / 2, gy = m;      /* grid hangs from the top of the box, centred */
    return { W, H, m, bw, bh, cols, rows, cell, gx, gy, floor: m + bh };
  },

  /* the element layout: returns elements [{i, j, x, y, r, ang, pen, state}] */
  _layout(p, ctx, ins) {
    const F = this._frame(p, ctx);
    const { m, bw, cols, rows, cell, gx, gy, floor } = F;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const seed = Math.round(Number(p.seed) || 0);
    const release = clamp(Number(p.release) || 0, 0, 1), soft = clamp(Number(p.softness) || 0, 0, 1), clumps = clamp(Number(p.clumps) || 0, 0, 1);
    const progress = clamp(Number(p.progress) || 0, 0, 1);
    const drift = Math.max(0, Number(p.drift) || 0), spin = Math.max(0, Number(p.spin) || 0), sizeMod = clamp(Number(p.sizeMod) || 0, -1, 1);
    const gj = clamp(Number(p.gridJitter) || 0, 0, 1);
    const spread = clamp(Number(p.spread) || 0.6, 0.02, 1), packing = clamp(Number(p.packing) || 0.9, 0.2, 3);
    const r0 = Math.max(0.05, cell * clamp(Number(p.stampSize) || 0.5, 0.02, 1) / 2);
    const nPal = clamp(Math.round(Number(p.palette) || 1), 1, 4);
    const pens = [p.penA, p.penB, p.penC, p.penD].slice(0, nPal).map((v) => clamp(Math.round(Number(v) || 0), 0, 11));
    const penOf = (i, j) => {
      if (nPal === 1) return pens[0];
      const k = p.assign === "Rows" ? j : p.assign === "Columns" ? i : p.assign === "Random" ? Math.floor(hash2(i, j, seed + 9) * nPal) : i + j;
      return pens[((k % nPal) + nPal) % nPal];
    };
    const edge = 1 - release;
    const els = [];
    const landed = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x0 = gx + (i + 0.5) * cell, y0 = gy + (j + 0.5) * cell;
      const yN = (j + 0.5) / rows;
      const score = yN + clumps * 0.6 * (noise2(i * 0.35 + 0.5, j * 0.35 + 0.5, seed + 1) - 0.5) + soft * 0.5 * (hash2(i, j, seed + 2) - 0.5);
      const rel = release > 0 && score > edge;
      const e = { i, j, x: x0, y: y0, r: r0, ang: 0, pen: penOf(i, j), state: "grid" };
      /* All: every element carries its own hashed spin and size, intact ones
         included; Fallen only: both ramp with the fall fraction */
      const all = p.modulate === "All";
      const spinDir = (hash2(i, j, seed + 7) - 0.5) * 2;
      const sizeAmt = hash2(i, j, seed + 11);
      if (all) { e.ang = (spin * Math.PI / 180) * spinDir; e.r = r0 * clamp(1 + sizeMod * sizeAmt, 0.05, 3); }
      if (!rel) {
        /* intact: small shake that grows toward the release line */
        if (gj > 0 && release > 0) {
          const w = clamp(1 - (edge - score) / 0.3, 0, 1);
          e.x += (hash2(i, j, seed + 5) - 0.5) * cell * 0.5 * gj * w;
          e.y += (hash2(i, j, seed + 6) - 0.5) * cell * 0.5 * gj * w;
        }
        els.push(e); continue;
      }
      /* Progress = share of released elements that have landed; the rest hang
         with a fall fraction skewed toward "just let go" */
      const h = hash2(i, j, seed + 3);
      const f = h < progress ? 1 : Math.pow((h - progress) / Math.max(1e-9, 1 - progress), 2.2);
      e.f = f;
      if (!all) { e.r = r0 * clamp(1 + sizeMod * f, 0.05, 3); e.ang = (spin * Math.PI / 180) * f * spinDir; }
      const dx = drift * f * (noise2(i * 0.21 + f * 2.7, j * 0.21, seed + 4) - 0.5) * 2;
      if (f >= 1) { e.state = "landed"; e.x = x0 + dx; landed.push(e); continue; }
      e.state = "falling";
      e.x = x0 + dx;
      e.y = y0 + f * (floor - e.r - y0);
      els.push(e);
    }
    /* ---- landing ---- */
    if (p.pile === "Floor") {
      for (const e of landed) { e.y = floor - e.r; e.x = clamp(e.x, m + e.r, m + bw - e.r); els.push(e); }
    } else if (p.pile === "Heap" && landed.length) {
      /* seeded landing order, then a 1-D sandpile */
      landed.sort((a, b) => hash2(a.i, a.j, seed + 8) - hash2(b.i, b.j, seed + 8));
      const colW = Math.max(0.5, 2 * r0 * 0.9);
      const nCol = Math.max(1, Math.round(bw / colW));
      const cw = bw / nCol;
      const hgt = new Float64Array(nCol);
      const xc = m + bw / 2;
      for (const e of landed) {
        let x = xc + (e.x - xc) * spread;
        let k = clamp(Math.floor((x - m) / cw), 0, nCol - 1);
        /* roll downhill while a neighbour column is at least one diameter lower */
        for (let step = 0; step < nCol; step++) {
          const dl = k > 0 ? hgt[k] - hgt[k - 1] : -Infinity, dr = k < nCol - 1 ? hgt[k] - hgt[k + 1] : -Infinity;
          const th = 2 * e.r * packing * 0.9;
          if (dl < th && dr < th) break;
          if (dl > dr || (dl === dr && hash2(e.i, e.j, seed + step + 20) < 0.5)) k--; else k++;
        }
        e.x = m + (k + 0.5) * cw + (hash2(e.i, e.j, seed + 10) - 0.5) * cw * 0.3;
        e.y = floor - hgt[k] - e.r;
        hgt[k] += 2 * e.r * packing;
        els.push(e);
      }
    }
    /* Pile None: landed elements fall off the sheet */
    return { F, els, r0, landedCount: landed.length };
  },

  compute(ins, p, ctx) {
    const L = this._layout(p, ctx, ins);
    const { els, F } = L;
    if (!els.length) return EMPTY;
    const BUDGET = 112000;
    /* ---- stamp geometry in a unit frame (radius 1), as [pts, closed] ---- */
    const src = (ins && ins[0]) || EMPTY;
    const wired = (src.paths || []).filter((q) => q.pts && q.pts.length >= 2);
    let stamp;
    if (wired.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of wired) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const s = 2 / Math.max(1e-6, Math.max(x1 - x0, y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      stamp = wired.map((q) => [q.pts.map(([x, y]) => [(x - cx) * s, (y - cy) * s]), !!q.closed]);
    } else {
      const circle = (rad, n) => { const o = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; o.push([Math.cos(a) * rad, Math.sin(a) * rad]); } return o; };
      /* circle segments by plotted size; budget aware */
      const rMean = els.reduce((a, e) => a + e.r, 0) / els.length;
      let n = Math.max(8, Math.min(32, Math.round((2 * Math.PI * rMean) / 0.45)));
      while (els.length * n * (p.stamp === "Ring" ? 2 : 1) > BUDGET && n > 6) n--;
      if (p.stamp === "Dot") stamp = [[circle(1, n), true]];
      else if (p.stamp === "Ring") stamp = [[circle(1, n), true], [circle(0.55, Math.max(6, Math.round(n * 0.6))), true]];
      else if (p.stamp === "Square") stamp = [[[[-1, -1], [1, -1], [1, 1], [-1, 1]], true]];
      else if (p.stamp === "Diamond") stamp = [[[[0, -1], [1, 0], [0, 1], [-1, 0]], true]];
      else stamp = [[[[-1, 0], [1, 0]], false], [[[0, -1], [0, 1]], false]];
    }
    const paths = [];
    let total = 0;
    for (const e of els) {
      const c = Math.cos(e.ang), s = Math.sin(e.ang);
      for (const [pts, closed] of stamp) {
        if (total + pts.length > BUDGET) break;
        paths.push({ pts: pts.map(([u, v]) => [e.x + (u * c - v * s) * e.r, e.y + (u * s + v * c) * e.r]), closed, layer: e.pen });
        total += pts.length;
      }
    }
    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx) {
    try {
      const F = this && typeof this._frame === "function" ? this._frame(p, ctx) : null;
      if (!F) return [];
      return [
        { kind: "rect", x: F.m, y: F.m, w: F.bw, h: F.bh },
        { kind: "rect", x: F.gx, y: F.gy, w: F.cols * F.cell, h: F.rows * F.cell },
        { kind: "poly", pts: [[F.m, F.floor], [F.m + F.bw, F.floor]] },
      ];
    } catch (e) { return []; }
  },
};
