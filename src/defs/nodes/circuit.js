import { Pin, PENS, mulberry32, applyStyle } from "../helpers.js";

export default {
  /* Circuit - constructivist schematic: solid blocks, orthogonal trace bundles,
     a baseline everything rests on.

     NO FIT-TO-BOX. Everything is generated directly in canvas millimetres
     inside the margin, so Fill spacing and Bundle pitch are already paper
     measurements and stay put when other parameters move. That is the same
     lesson Chain paid for: a normalising fit quietly turns size controls into
     density controls.

     ROUTING IS CORRIDOR-BASED, not decorative. Every candidate segment is
     tested against the block rectangles inflated by a clearance, and a route
     that cannot be found is DROPPED rather than drawn through a block. The
     alternative - drawing first and hoping - produces the one artefact that
     destroys the schematic reading, a wire crossing a solid mass.

     Compare Diagram: that node draws numbered nodes joined by arrows on a ring
     or grid. This one has no arrowheads, no symbols and no node identity; the
     blocks are mass, the composition hangs off a baseline, and the traces run
     in parallel bundles. They are different pictures, not two settings of one. */
  key: "circuit",
  name: "Circuit",
  cat: "gen",
  group: "structural",
  desc: "Constructivist circuit compositions: solid blocks in aligned columns, orthogonal trace bundles running between them, and a baseline the whole picture rests on. Blocks are stacked into Columns so they line up vertically the way a real schematic does, and every block in a column shares its width. Traces leave block edges in bundles of parallel lines at Bundle pitch and turn at right angles - L routes turn once, Z routes twice - ending on another block, on the baseline, at the sheet edge, or in a short stub. Routing is corridor-checked against the blocks with a clearance, so a bundle never crosses a solid mass; a route that cannot be found is dropped instead of drawn wrong. Crossings either overlap plainly, as in the steel-wire originals, or cut Under gaps into the lower trace. Frames adds empty outlined rectangles, the quiet counterweight to the black mass. Because a pen cannot lay down solid ink, block Fill is dense hatching - Hatch, Cross or Contour - and Fill spacing is in real paper millimetres, so it, more than anything else here, sets the plotting time. Whitespace bias slides the whole block cluster left or right and leaves the other side to the long runs, which is where the composition gets its air. Blocks and traces carry separate pens.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "blocks", label: "Blocks", type: "slider", min: 1, max: 24, step: 1, def: 9 },
    { key: "columns", label: "Columns", type: "slider", min: 1, max: 6, step: 1, def: 3 },
    { key: "grid", label: "Grid (cells across)", type: "slider", min: 8, max: 40, step: 1, def: 22 },
    { key: "bwid", label: "Block width cells", type: "slider", min: 2, max: 14, step: 1, def: 5 },
    { key: "bhgt", label: "Block height cells", type: "slider", min: 1, max: 10, step: 1, def: 3 },
    { key: "white", label: "Whitespace bias", type: "slider", min: 0, max: 100, step: 1, def: 55 },
    { key: "baselines", label: "Baselines", type: "slider", min: 0, max: 3, step: 1, def: 2 },
    { key: "traces", label: "Traces", type: "slider", min: 0, max: 40, step: 1, def: 16 },
    { key: "bundle", label: "Bundle max", type: "slider", min: 1, max: 6, step: 1, def: 3, showIf: (p) => Math.round(p.traces) > 0 },
    { key: "bpitch", label: "Bundle pitch mm", type: "slider", min: 0.8, max: 8, step: 0.1, def: 2, showIf: (p) => Math.round(p.traces) > 0 },
    { key: "turns", label: "Turns", type: "select", options: ["L", "Z", "Mixed"], def: "Mixed", showIf: (p) => Math.round(p.traces) > 0 },
    { key: "cross", label: "Crossings", type: "select", options: ["Overlap", "Under gaps"], def: "Overlap", showIf: (p) => Math.round(p.traces) > 0 },
    { key: "gapmm", label: "Under gap mm", type: "slider", min: 0.4, max: 4, step: 0.1, def: 1.2, showIf: (p) => Math.round(p.traces) > 0 && p.cross === "Under gaps" },
    { key: "frames", label: "Frames", type: "slider", min: 0, max: 8, step: 1, def: 3 },
    { key: "fill", label: "Block fill", type: "select", options: ["Hatch", "Cross", "Contour", "None"], def: "Hatch" },
    { key: "fspace", label: "Fill spacing mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.55, showIf: (p) => p.fill !== "None" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 14 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Block pen", type: "pen", def: 0 },
    { key: "tlayer", label: "Trace pen", type: "pen", def: 0 },
  ],

  /* ------------------------------------------------------------------ build
     Layout only: box, grid, blocks, baselines. compute draws it and overlay
     shows it, so both must see exactly the same rectangles. */
  _build(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 5, p.margin));
    const bw = W - 2 * m, bh = H - 2 * m;
    if (!(bw > 20) || !(bh > 20)) return { ok: false };

    const G = Math.max(6, Math.min(60, Math.round(p.grid) || 22));
    const cell = Math.min(bw, bh) / G;
    const GX = Math.max(4, Math.floor(bw / cell));
    const GY = Math.max(4, Math.floor(bh / cell));
    const X = (i) => m + i * cell;
    const Y = (j) => m + j * cell;

    const rng = mulberry32(Math.round(p.seed) * 9176 + 401);
    const nB = Math.max(1, Math.min(24, Math.round(p.blocks) || 1));
    const nC = Math.max(1, Math.min(6, Math.round(p.columns) || 1));
    const wid = Math.max(2, Math.min(14, Math.round(p.bwid) || 2));
    const hgt = Math.max(1, Math.min(10, Math.round(p.bhgt) || 1));

    /* baseline band at the bottom - blocks must not sit on top of it */
    const nBase = Math.max(0, Math.min(3, Math.round(p.baselines)));
    const baseJ = GY - 1;
    const floorJ = nBase > 0 ? baseJ - 1 : GY;

    /* Column cluster. Whitespace bias slides the cluster sideways and leaves
       the other side open for the long runs - the composition's air. */
    const clusterW = Math.min(GX - 2, Math.max(nC * (wid + 2), Math.round(GX * 0.42)));
    const c0 = Math.round((GX - clusterW) * (1 - Math.max(0, Math.min(100, p.white)) / 100));
    const colX = [];
    for (let c = 0; c < nC; c++) {
      const t = nC === 1 ? 0.5 : c / (nC - 1);
      colX.push(c0 + Math.round(t * Math.max(0, clusterW - wid)));
    }
    /* every block in a column shares its width: that is what makes the stacks
       read as one structure instead of scattered rectangles */
    const colW = colX.map(() => Math.max(2, wid + (rng() < 0.45 ? Math.round((rng() - 0.5) * 4) : 0)));

    const blocks = [];
    const clash = (a) => blocks.some((b) => !(a.i1 + 1 <= b.i0 || b.i1 + 1 <= a.i0 || a.j1 + 1 <= b.j0 || b.j1 + 1 <= a.j0));
    for (let k = 0; k < nB; k++) {
      let placed = false;
      for (let tryN = 0; tryN < 60 && !placed; tryN++) {
        const c = Math.floor(rng() * nC) % nC;
        const w = Math.min(colW[c], GX - 1);
        const h = Math.max(1, hgt + (rng() < 0.4 ? Math.round((rng() - 0.5) * 3) : 0));
        const i0 = Math.max(0, Math.min(GX - w - 1, colX[c]));
        const j0 = Math.max(1, Math.min(floorJ - h - 1, 1 + Math.floor(rng() * Math.max(1, floorJ - h - 2))));
        const a = { i0, j0, i1: i0 + w, j1: j0 + h, col: c };
        if (a.j1 >= floorJ || a.i1 >= GX) continue;
        if (clash(a)) continue;
        blocks.push(a);
        placed = true;
      }
    }
    /* blocks in mm, which is what everything downstream actually uses */
    for (const b of blocks) { b.x0 = X(b.i0); b.y0 = Y(b.j0); b.x1 = X(b.i1); b.y1 = Y(b.j1); }

    return { ok: true, m, bw, bh, cell, GX, GY, X, Y, blocks, nBase, baseJ, floorJ, rng, colX, colW };
  },

  compute(ins, p, ctx) {
    const B = this._build(p, ctx);
    if (!B || !B.ok) return applyStyle({ paths: [] }, ins[0]);
    const { m, bw, bh, cell, GX, GY, X, Y, blocks, nBase, baseJ } = B;
    const LB = Math.max(0, Math.min(PENS.length - 1, Math.round(p.layer)));
    const LT = Math.max(0, Math.min(PENS.length - 1, Math.round(p.tlayer)));
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const push = (pts, layer, closed) => {
      if (used >= BUDGET || pts.length < 2) return;
      used += pts.length;
      paths.push({ pts, closed: !!closed, layer });
    };

    /* a fresh stream for the drawing pass so layout stays stable when only
       trace parameters move */
    const rng = mulberry32(Math.round(p.seed) * 3313 + 77);

    /* ---------------- blocks: outline plus a hatched interior ---------------- */
    const fill = p.fill;
    const fs = Math.max(0.25, p.fspace);
    for (const b of blocks) {
      push([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], LB, true);
      if (fill === "None") continue;
      if (fill === "Contour") {
        for (let d = fs; d < Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 - 1e-9; d += fs) {
          push([[b.x0 + d, b.y0 + d], [b.x1 - d, b.y0 + d], [b.x1 - d, b.y1 - d], [b.x0 + d, b.y1 - d]], LB, true);
        }
        continue;
      }
      for (let x = b.x0 + fs; x < b.x1 - 1e-9; x += fs) push([[x, b.y0], [x, b.y1]], LB, false);
      if (fill === "Cross") for (let y = b.y0 + fs; y < b.y1 - 1e-9; y += fs) push([[b.x0, y], [b.x1, y]], LB, false);
    }

    /* ---------------- baselines ---------------- */
    for (let k = 0; k < nBase; k++) {
      const y = Y(baseJ) + k * Math.max(0.9, cell * 0.35);
      if (y > m + bh) break;
      push([[m, y], [m + bw, y]], LT, false);
    }

    /* ---------------- routing ---------------- */
    const CLEAR = cell * 0.35;
    const segHitsBlock = (x0, y0, x1, y1) => {
      const ax0 = Math.min(x0, x1) - 1e-9, ax1 = Math.max(x0, x1) + 1e-9;
      const ay0 = Math.min(y0, y1) - 1e-9, ay1 = Math.max(y0, y1) + 1e-9;
      for (const b of blocks) {
        if (ax1 <= b.x0 - CLEAR || ax0 >= b.x1 + CLEAR) continue;
        if (ay1 <= b.y0 - CLEAR || ay0 >= b.y1 + CLEAR) continue;
        return true;
      }
      return false;
    };
    const routeClear = (pts, ignore) => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const ax0 = Math.min(x0, x1) - 1e-9, ax1 = Math.max(x0, x1) + 1e-9;
        const ay0 = Math.min(y0, y1) - 1e-9, ay1 = Math.max(y0, y1) + 1e-9;
        for (const b of blocks) {
          if (b === ignore) continue;
          if (ax1 <= b.x0 - CLEAR || ax0 >= b.x1 + CLEAR) continue;
          if (ay1 <= b.y0 - CLEAR || ay0 >= b.y1 + CLEAR) continue;
          return false;
        }
      }
      return true;
    };
    /* parallel copy of an axis-aligned polyline: shift every segment's own
       constant coordinate and re-intersect at the corners */
    const offsetOrtho = (pts, o) => {
      if (Math.abs(o) < 1e-9) return pts.map((q) => q.slice());
      const n = pts.length;
      const lines = [];
      for (let i = 1; i < n; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const horiz = Math.abs(y1 - y0) < Math.abs(x1 - x0);
        const dir = horiz ? Math.sign(x1 - x0) || 1 : Math.sign(y1 - y0) || 1;
        /* left normal of the direction */
        lines.push(horiz ? { horiz: true, c: y0 - o * dir } : { horiz: false, c: x0 + o * dir });
      }
      const out = [];
      const first = lines[0];
      out.push(first.horiz ? [pts[0][0], first.c] : [first.c, pts[0][1]]);
      for (let i = 1; i < lines.length; i++) {
        const a = lines[i - 1], b = lines[i];
        if (a.horiz === b.horiz) { out.push(out[out.length - 1].slice()); continue; }
        out.push(a.horiz ? [b.c, a.c] : [a.c, b.c]);
      }
      const last = lines[lines.length - 1];
      out.push(last.horiz ? [pts[n - 1][0], last.c] : [last.c, pts[n - 1][1]]);
      return out;
    };

    const inBox = (x, y) => x >= m - 1e-6 && x <= m + bw + 1e-6 && y >= m - 1e-6 && y <= m + bh + 1e-6;
    const clampBox = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const nT = Math.max(0, Math.min(40, Math.round(p.traces)));
    const bmax = Math.max(1, Math.min(6, Math.round(p.bundle)));
    const bp = Math.max(0.5, p.bpitch);
    const routes = [];   /* {pts, } per drawn polyline, for the crossing pass */

    for (let t = 0; t < nT && blocks.length && used < BUDGET; t++) {
      const src = blocks[Math.floor(rng() * blocks.length) % blocks.length];
      const sides = ["R", "L", "T", "B"];
      const side = sides[Math.floor(rng() * (rng() < 0.62 ? 2 : 4)) % 4];
      const horizOut = side === "R" || side === "L";
      const dir = (side === "R" || side === "B") ? 1 : -1;
      const spanLo = horizOut ? src.y0 : src.x0;
      const spanHi = horizOut ? src.y1 : src.x1;
      const k = 1 + Math.floor(rng() * bmax);
      const width = (k - 1) * bp;
      if (width > (spanHi - spanLo) - 1e-9) continue;      /* bundle wider than the edge */
      const centre = spanLo + (spanHi - spanLo) * (0.25 + rng() * 0.5);
      const c = clampBox(centre, spanLo + width / 2 + 0.4, spanHi - width / 2 - 0.4);
      const start = horizOut ? [dir > 0 ? src.x1 : src.x0, c] : [c, dir > 0 ? src.y1 : src.y0];

      /* candidate routes, best-effort: the first corridor-clear one wins */
      let chosen = null;
      const zStyle = p.turns === "Z" ? true : p.turns === "L" ? false : rng() < 0.5;
      for (let attempt = 0; attempt < 14 && !chosen; attempt++) {
        const run1 = cell * (1.2 + rng() * 6);
        const a = horizOut ? [start[0] + dir * run1, start[1]] : [start[0], start[1] + dir * run1];
        if (!inBox(a[0], a[1])) continue;
        const kind = rng();
        /* Draw every random displacement ONCE into a variable. Calling rng()
           twice inside one route - once for a corner and again for the point
           that must share its coordinate - is how the first version produced
           diagonals in a node whose whole premise is right angles. */
        const jog = (rng() - 0.5) * cell * 8;
        let pts = null;
        if (kind < 0.34) {
          /* to another block, arriving at the middle of a facing edge */
          const dst = blocks[Math.floor(rng() * blocks.length) % blocks.length];
          if (dst === src) continue;
          if (horizOut) {
            const ty = (dst.y0 + dst.y1) / 2;
            const tx = a[0] < (dst.x0 + dst.x1) / 2 ? dst.x0 : dst.x1;
            pts = [start, a, [a[0], ty], [tx, ty]];
          } else {
            const tx = (dst.x0 + dst.x1) / 2;
            const ty = a[1] < (dst.y0 + dst.y1) / 2 ? dst.y0 : dst.y1;
            pts = [start, a, [tx, a[1]], [tx, ty]];
          }
        } else if (kind < 0.58 && nBase > 0) {
          const ty = Y(baseJ);
          if (horizOut) pts = [start, a, [a[0], ty]];
          else {
            const jx = clampBox(a[0] + jog, m, m + bw);
            pts = [start, a, [jx, a[1]], [jx, ty]];
          }
        } else if (kind < 0.8) {
          /* out to the sheet edge */
          if (horizOut) {
            const jy = clampBox(a[1] + jog, m, m + bh);
            pts = [start, a, [a[0], jy], [dir > 0 ? m + bw : m, jy]];
          } else {
            const jx = clampBox(a[0] + jog, m, m + bw);
            pts = [start, a, [jx, a[1]], [jx, dir > 0 ? m + bh : m]];
          }
        } else {
          /* a short stub with a tick across it */
          pts = [start, a];
        }
        if (!zStyle && pts.length > 3) pts = pts.slice(0, 3);
        pts = pts.filter((q, i2, arr) => i2 === 0 || Math.hypot(q[0] - arr[i2 - 1][0], q[1] - arr[i2 - 1][1]) > 1e-7);
        if (pts.length < 2) continue;
        if (!pts.every((q) => inBox(q[0], q[1]))) continue;
        if (!routeClear(pts, src)) continue;
        chosen = pts;
      }
      if (!chosen) continue;   /* dropped, never drawn through a block */

      for (let j = 0; j < k; j++) {
        const o = -width / 2 + j * bp;
        const q = offsetOrtho(chosen, o);
        if (!q.every((v) => Number.isFinite(v[0]) && Number.isFinite(v[1]))) continue;
        /* Reject, never clamp. Clamping x and y independently moves a corner
           off its own axis and silently turns an orthogonal route into a
           diagonal - the exact failure this node cannot have. */
        if (!q.every((v) => inBox(v[0], v[1]))) continue;
        if (!routeClear(q, src)) continue;
        routes.push(q);
      }
      /* stub tick: the little cross-bar the references end short runs with */
      if (chosen.length === 2 && rng() < 0.7) {
        const e = chosen[chosen.length - 1];
        const half = Math.max(1, width / 2 + bp * 0.6);
        const tick = horizOut ? [[e[0], e[1] - half], [e[0], e[1] + half]] : [[e[0] - half, e[1]], [e[0] + half, e[1]]];
        if (tick.every((v) => inBox(v[0], v[1]))) routes.push(tick);
      }
    }

    /* ---------------- crossings ---------------- */
    if (p.cross === "Under gaps" && routes.length > 1) {
      const g = Math.max(0.2, p.gapmm) / 2;
      const segsOf = (r) => { const s = []; for (let i = 1; i < r.length; i++) s.push([r[i - 1], r[i]]); return s; };
      const all = routes.map(segsOf);
      const out = [];
      for (let ri = 0; ri < routes.length; ri++) {
        const pieces = [];
        for (const [a, b] of all[ri]) {
          const horiz = Math.abs(a[1] - b[1]) < 1e-6;
          const cuts = [];
          for (let rj = ri + 1; rj < routes.length; rj++) {
            for (const [c2, d2] of all[rj]) {
              const horiz2 = Math.abs(c2[1] - d2[1]) < 1e-6;
              if (horiz === horiz2) continue;              /* parallel: no crossing */
              const hx = horiz ? [a, b] : [c2, d2];
              const vy = horiz ? [c2, d2] : [a, b];
              const yh = hx[0][1], xv = vy[0][0];
              if (xv < Math.min(hx[0][0], hx[1][0]) - 1e-9 || xv > Math.max(hx[0][0], hx[1][0]) + 1e-9) continue;
              if (yh < Math.min(vy[0][1], vy[1][1]) - 1e-9 || yh > Math.max(vy[0][1], vy[1][1]) + 1e-9) continue;
              cuts.push(horiz ? xv : yh);
            }
          }
          const p0 = horiz ? a[0] : a[1], p1 = horiz ? b[0] : b[1];
          const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
          cuts.sort((u, v) => u - v);
          let cur = lo;
          const spans = [];
          for (const cX of cuts) {
            if (cX - g > cur) spans.push([cur, cX - g]);
            cur = Math.max(cur, cX + g);
          }
          if (hi > cur) spans.push([cur, hi]);
          for (const [s0, s1] of spans) {
            if (s1 - s0 < 0.15) continue;
            pieces.push(horiz ? [[s0, a[1]], [s1, a[1]]] : [[a[0], s0], [a[0], s1]]);
          }
        }
        out.push(...pieces);
      }
      for (const q of out) push(q, LT, false);
    } else {
      for (const r of routes) push(r, LT, false);
    }

    /* ---------------- empty frames ---------------- */
    const nF = Math.max(0, Math.min(8, Math.round(p.frames)));
    for (let f = 0; f < nF && used < BUDGET; f++) {
      let done = false;
      for (let tryN = 0; tryN < 40 && !done; tryN++) {
        const w = cell * (2 + rng() * 5), h = cell * (2 + rng() * 5);
        const x = m + rng() * Math.max(1, bw - w), y = m + rng() * Math.max(1, bh - h);
        const rect = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
        if (segHitsBlock(x, y, x + w, y + h)) continue;
        push(rect, LT, true);
        done = true;
      }
    }

    return applyStyle({ paths }, ins[0]);
  },

  overlay(p, ctx) {
    try {
      const B = this && this._build ? this._build(p, ctx) : null;
      if (!B || !B.ok) return [];
      const g = [{ kind: "rect", x: B.m, y: B.m, w: B.bw, h: B.bh }];
      for (const b of B.blocks.slice(0, 24)) g.push({ kind: "rect", x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
      if (B.nBase > 0) {
        const y = B.Y(B.baseJ);
        g.push({ kind: "poly", pts: [[B.m, y], [B.m + B.bw, y]] });
      }
      return g;
    } catch (e) { return []; }
  },
};
