import { Pin, EMPTY, hash2, noise2, pathLength, applyStyle } from "../helpers.js";

export default {
  /* Mosaic - opus vermiculatum figure, opus regulatum ground, tiled border.

     One pipeline for every shape: a fine raster inside the margin box gets a
     TILE ID per cell, and tiles / seams are the boundaries where the id
     changes.

       ground   : grid cell (snapped so whole rows fill the box); the outer
                  Border rows get their own pens
       figure   : Contour rows  band k = floor(d / Tile) from the outline
                                inward, cut along the outline arc-length
                                (scaled per band so inner rows keep their
                                pitch, staggered half a tile) - where rows
                                collide the nearest-side rule yields the
                                irregular core tiles of a real mosaic
                  Grid          the ground grid continued inside, clipped
                  Fan           polar rings/sectors about the figure centre
                  None          the figure stays one blank tile
       grout    : a thin zone along the outline belongs to no tile, so ground
                  tiles stop short of the figure

     The figure field is a nearest-boundary transform (8SSEDT with exact
     sample positions: boundary cells seeded from the resampled outline, two
     propagation sweeps) giving distance d and the arc-length s of the nearest
     outline point; inside/outside by scanline parity, so holes work.

     Tiles render each id's outline (closed loop, Chaikin-smoothed, shrunk by
     Grout/2); Seams render every id boundary once. Irregularity jitters the
     cuts with seeded hashes. */
  key: "mosaic",
  name: "Mosaic",
  cat: "mod",
  group: "fillstyle",
  desc: "Mosaic tiling of the sheet with an optional figure: wire closed shapes into Shape and they are laid in opus vermiculatum (Contour rows: tile rows following the outline inward, cut at Tile × Aspect and staggered, colliding in the middle into the irregular core tiles of a real mosaic), as a clipped Grid, as a Fan of polar rings about the figure centre, or left blank (None, one outlined tile). The ground is opus regulatum, a square grid snapped so whole rows fill the margin box (Grid fit), clipped to a grout gap around the figure and continuing inside holes; the outermost Border rows get Outer row pen and Inner row pen. With nothing wired the sheet still fills with grid and border. Render Tiles draws every tile as a closed outline shrunk by Grout/2, Seams draws every tile boundary once (lightest plot), Both draws both. Smooth rounds the raster boundaries (Chaikin passes), Field cell sets the raster (0 = Tile/8), Min tile drops slivers, Irregularity jitters cuts and grid lines with the Seed for a hand-cut look. Pens: Figure, Ground, Outer row, Inner row.",
  ins: [Pin("paths", "Shape (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "tile", label: "Tile mm", type: "slider", min: 1.5, max: 20, step: 0.1, def: 4 },
    { key: "aspect", label: "Aspect (figure)", type: "slider", min: 0.5, max: 3, step: 0.05, def: 1 },
    { key: "grout", label: "Grout mm", type: "slider", min: 0, max: 3, step: 0.05, def: 0.6 },
    { key: "figStyle", label: "Figure style", type: "select", options: ["Contour rows", "Grid", "Fan", "None"], def: "Contour rows" },
    { key: "stagger", label: "Stagger rows", type: "check", def: true, showIf: (p) => p.figStyle === "Contour rows" || p.figStyle === "Fan" },
    { key: "ground", label: "Ground", type: "select", options: ["Grid", "None"], def: "Grid" },
    { key: "gridFit", label: "Grid fit", type: "check", def: true },
    { key: "borderRows", label: "Border rows", type: "slider", min: 0, max: 3, step: 1, def: 2 },
    { key: "irregular", label: "Irregularity", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "render", label: "Render", type: "select", options: ["Tiles", "Seams", "Both"], def: "Tiles" },
    { key: "smooth", label: "Smooth", type: "slider", min: 0, max: 3, step: 1, def: 1 },
    { key: "fcell", label: "Field cell mm (0 = auto)", type: "slider", min: 0, max: 1.5, step: 0.05, def: 0 },
    { key: "minTile", label: "Min tile mm", type: "slider", min: 0, max: 4, step: 0.1, def: 0.8 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "penFig", label: "Figure pen", type: "pen", def: 2 },
    { key: "penGround", label: "Ground pen", type: "pen", def: 6 },
    { key: "penOuter", label: "Outer row pen", type: "pen", def: 9, showIf: (p) => p.borderRows > 0 },
    { key: "penInner", label: "Inner row pen", type: "pen", def: 0, showIf: (p) => p.borderRows > 1 },
  ],

  _frame(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const m = Math.max(0, Math.min(Number(p.margin) || 0, Math.min(W, H) / 2 - 1));
    const bw = Math.max(1, W - 2 * m), bh = Math.max(1, H - 2 * m);
    const T = Math.max(0.5, Number(p.tile) || 4);
    const nx = Math.max(1, Math.round(bw / T)), ny = Math.max(1, Math.round(bh / T));
    const tx = p.gridFit ? bw / nx : T, ty = p.gridFit ? bh / ny : T;
    return { W, H, m, bw, bh, T, nx, ny, tx, ty };
  },

  compute(ins, p, ctx) {
    const F = this._frame(p, ctx);
    const { W, H, m, bw, bh, T, tx, ty } = F;
    if (W <= 0 || H <= 0) return EMPTY;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pen = (v) => clamp(Math.round(Number(v) || 0), 0, 11);
    const PF = pen(p.penFig), PG = pen(p.penGround), PO = pen(p.penOuter), PI = pen(p.penInner);
    const grout = clamp(Number(p.grout) || 0, 0, 10);
    const aspect = clamp(Number(p.aspect) || 1, 0.1, 10);
    const pitch = T * aspect;
    const irr = clamp(Number(p.irregular) || 0, 0, 1);
    const seed = Math.round(Number(p.seed) || 0);
    const border = clamp(Math.round(Number(p.borderRows) || 0), 0, 6);
    const smoothN = clamp(Math.round(Number(p.smooth) || 0), 0, 4);
    const minArea = Math.pow(Math.max(0, Number(p.minTile) || 0), 2);
    const fc0 = Number(p.fcell) > 0 ? Number(p.fcell) : clamp(T / 8, 0.3, 1);
    const cols = clamp(Math.round(bw / fc0), 4, 1400), rows = clamp(Math.round(bh / fc0), 4, 1400);
    const fx = bw / cols, fy = bh / rows;
    const BUDGET = 112000;

    /* ------------------------------------------------ shape -> boundary samples + mask */
    const src = (ins && ins[0]) || EMPTY;
    const polys = (src.paths || []).filter((q) => q.closed && q.pts.length >= 3).map((q) => q.pts);
    const hasFig = polys.length > 0;
    let dist = null;
    /* containment depth of every polygon and the centre of its outermost container (for Fan) */
    const pip = (x, y, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const yi = poly[a][1], yj = poly[b][1]; if ((yi > y) !== (yj > y)) { const xi = poly[a][0], xj = poly[b][0]; if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } } return c; };
    const centroid = (poly) => { let A = 0, cx = 0, cy = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; A += f; cx += (poly[j][0] + poly[i][0]) * f; cy += (poly[j][1] + poly[i][1]) * f; } if (Math.abs(A) < 1e-9) { const n = poly.length; return [poly.reduce((a, q) => a + q[0], 0) / n, poly.reduce((a, q) => a + q[1], 0) / n]; } return [cx / (3 * A), cy / (3 * A)]; };
    const info = polys.map((poly, j) => {
      const q = poly[0];
      let depth = 0, outer = j;
      polys.forEach((o, k) => { if (k !== j && pip(q[0], q[1], o)) depth++; });
      /* outermost container: the containing polygon with the smallest depth (0) */
      if (depth > 0) { let best = -1; polys.forEach((o, k) => { if (k !== j && pip(q[0], q[1], o)) { let dk = 0; polys.forEach((oo, kk) => { if (kk !== k && pip(o[0][0], o[0][1], oo)) dk++; }); if (dk === 0) best = k; } }); if (best >= 0) outer = best; }
      const per = pathLength(poly, true);
      return { hole: (depth & 1) === 1, outer, per, centre: null };
    });
    info.forEach((inf, j) => { inf.centre = centroid(polys[inf.outer]); });

    const N = cols * rows;
    const inside = new Uint8Array(N);
    const nearIdx = new Int32Array(N).fill(-1);
    const sampX = [], sampY = [], sampS = [], sampP = [];
    if (hasFig) {
      /* scanline parity for the mask */
      const rowX = new Array(rows); for (let r = 0; r < rows; r++) rowX[r] = [];
      for (const poly of polys) for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        const x0 = poly[b][0], y0 = poly[b][1], x1 = poly[a][0], y1 = poly[a][1];
        if (y0 === y1) continue;
        const yl = Math.min(y0, y1), yh = Math.max(y0, y1);
        const r0 = Math.max(0, Math.ceil((yl - m) / fy - 0.5)), r1 = Math.min(rows - 1, Math.floor((yh - m) / fy - 0.5));
        for (let r = r0; r <= r1; r++) { const y = m + (r + 0.5) * fy; if ((y0 > y) !== (y1 > y)) rowX[r].push(x0 + (x1 - x0) * (y - y0) / (y1 - y0)); }
      }
      for (let r = 0; r < rows; r++) {
        const xs = rowX[r].sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const c0 = Math.max(0, Math.ceil((xs[k] - m) / fx - 0.5)), c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - m) / fx - 0.5));
          for (let c = c0; c <= c1; c++) inside[r * cols + c] = 1;
        }
      }
      /* boundary samples every fc/2 along every outline, seeded into their cells */
      const step = Math.min(fx, fy) * 0.5;
      polys.forEach((poly, j) => {
        let s = 0;
        for (let a = 0; a < poly.length; a++) {
          const A = poly[a], B = poly[(a + 1) % poly.length];
          const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
          const n = Math.max(1, Math.ceil(L / step));
          for (let i = 0; i < n; i++) {
            const t = i / n, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t;
            const idx = sampX.length; sampX.push(x); sampY.push(y); sampS.push(s + L * t); sampP.push(j);
            const c = Math.floor((x - m) / fx), r = Math.floor((y - m) / fy);
            if (c >= 0 && r >= 0 && c < cols && r < rows && nearIdx[r * cols + c] < 0) nearIdx[r * cols + c] = idx;
          }
          s += L;
        }
      });
      /* seed the four corner cells by brute force so propagation always has a
         source even when the outline lies entirely outside the box */
      if (sampX.length) for (const [c, r] of [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]]) {
        const i = r * cols + c; if (nearIdx[i] >= 0) continue;
        const x = m + (c + 0.5) * fx, y = m + (r + 0.5) * fy;
        let best = 0, bd = Infinity;
        for (let k = 0; k < sampX.length; k++) { const dd = (x - sampX[k]) ** 2 + (y - sampY[k]) ** 2; if (dd < bd) { bd = dd; best = k; } }
        nearIdx[i] = best;
      }
      /* 8SSEDT-style propagation of the nearest sample (exact positions) */
      const d2 = new Float64Array(N).fill(Infinity);
      for (let i = 0; i < N; i++) if (nearIdx[i] >= 0) { const c = i % cols, r = (i - c) / cols; const x = m + (c + 0.5) * fx, y = m + (r + 0.5) * fy; d2[i] = (x - sampX[nearIdx[i]]) ** 2 + (y - sampY[nearIdx[i]]) ** 2; }
      const relax = (i, j) => {
        const k = nearIdx[j]; if (k < 0) return;
        const c = i % cols, r = (i - c) / cols; const x = m + (c + 0.5) * fx, y = m + (r + 0.5) * fy;
        const dd = (x - sampX[k]) ** 2 + (y - sampY[k]) ** 2;
        if (dd < d2[i]) { d2[i] = dd; nearIdx[i] = k; }
      };
      for (let pass = 0; pass < 2; pass++) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c; if (c > 0) relax(i, i - 1); if (r > 0) { relax(i, i - cols); if (c > 0) relax(i, i - cols - 1); if (c < cols - 1) relax(i, i - cols + 1); } }
        for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) { const i = r * cols + c; if (c < cols - 1) relax(i, i + 1); if (r < rows - 1) { relax(i, i + cols); if (c < cols - 1) relax(i, i + cols + 1); if (c > 0) relax(i, i + cols - 1); } }
      }
      dist = (i) => Math.sqrt(d2[i]);
    }

    /* ------------------------------------------------ tile ids */
    const ids = new Int32Array(N);
    const idPen = [];   /* id -> pen (or -1 for grout / no tile) */
    const idMap = new Map();
    const idOf = (key, penv) => { let v = idMap.get(key); if (v === undefined) { v = idPen.length; idPen.push(penv); idMap.set(key, v); } return v; };
    const GROUT = idOf("grout", -1);
    const jit = (a, b, k) => (hash2(a, b, seed + k) - 0.5);
    const groutZone = Math.max(grout * 0.25, 0.75 * Math.max(fx, fy));   /* no-tile zone along the outline; the visible gap comes from shrinking both sides by Grout/2 */
    const gridCell = (x, y, tag, penDefault) => {
      const u = x - m, v = y - m;
      let j = Math.floor(v / ty), i0 = Math.floor(u / tx);
      if (irr > 0) {
        const bj = j * ty + jit(i0, j, 11) * irr * 0.35 * ty;
        if (v < bj) j--; else if (v >= (j + 1) * ty + jit(i0, j + 1, 11) * irr * 0.35 * ty) j++;
        const bi = i0 * tx + jit(i0, j, 12) * irr * 0.35 * tx;
        if (u < bi) i0--; else if (u >= (i0 + 1) * tx + jit(i0 + 1, j, 12) * irr * 0.35 * tx) i0++;
      }
      const i = clamp(i0, 0, F.nx - 1); j = clamp(j, 0, F.ny - 1);
      let penv = penDefault;
      if (tag === "G") { const ring = Math.min(i, j, F.nx - 1 - i, F.ny - 1 - j); if (ring < border) penv = ring === 0 ? PO : PI; }
      return idOf(tag + ":" + i + "," + j, penv);
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = m + (c + 0.5) * fx, y = m + (r + 0.5) * fy;
      if (hasFig) {
        const k = nearIdx[i];
        const d = k >= 0 ? dist(i) : Infinity;
        if (inside[i]) {
          if (k < 0) { ids[i] = idOf("fig", PF); continue; }   /* no outline sample reachable: one blank figure tile */
          if (d < groutZone && p.figStyle !== "None") { ids[i] = GROUT; continue; }
          if (p.figStyle === "None") { ids[i] = idOf("fig", PF); continue; }
          if (p.figStyle === "Grid") { ids[i] = gridCell(x, y, "F", PF); continue; }
          if (p.figStyle === "Fan") {
            const inf = info[sampP[k]] || info[0];
            const dx = x - inf.centre[0], dy = y - inf.centre[1];
            const rr = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
            let ring = Math.floor(rr / T);
            if (irr > 0) { const rb = ring * T + (noise2(ang * 3, ring * 7.1, seed + 21) - 0.5) * irr * 0.8 * T; if (rr < rb) ring = Math.max(0, ring - 1); else if (rr >= (ring + 1) * T + (noise2(ang * 3, (ring + 1) * 7.1, seed + 21) - 0.5) * irr * 0.8 * T) ring++; }
            const nSect = Math.max(1, Math.round((2 * Math.PI * (ring + 0.5) * T) / pitch));
            let a = (ang + Math.PI) / (2 * Math.PI) * nSect + (p.stagger && (ring & 1) ? 0.5 : 0);
            if (irr > 0) a += jit(Math.floor(a), ring, 22) * irr * 0.4;
            const sect = ((Math.floor(a) % nSect) + nSect) % nSect;
            ids[i] = idOf("A:" + sampP[k] + ":" + ring + ":" + sect, PF); continue;
          }
          /* Contour rows */
          const inf = info[sampP[k]];
          let s = sampS[k];
          let band = Math.floor(d / T);
          if (irr > 0) { const db = band * T + (noise2(s / (2 * pitch), band * 3.7, seed + 31) - 0.5) * irr * 0.8 * T; if (d < db) band = Math.max(0, band - 1); else if (d >= (band + 1) * T + (noise2(s / (2 * pitch), (band + 1) * 3.7, seed + 31) - 0.5) * irr * 0.8 * T) band++; }
          /* keep the pitch on inner rows: scale arc-length by the band's perimeter ratio */
          const perK = Math.max(pitch, inf.per + (inf.hole ? 1 : -1) * 2 * Math.PI * (band + 0.5) * T);
          let sEff = s * perK / inf.per + (p.stagger && (band & 1) ? pitch / 2 : 0);
          const nCut = Math.max(1, Math.round(perK / pitch));
          const pitchK = perK / nCut;   /* closes the row exactly */
          let ci = Math.floor(sEff / pitchK);
          if (irr > 0) {
            const bLo = ci * pitchK + jit(ci, band, 41) * irr * 0.4 * pitchK, bHi = (ci + 1) * pitchK + jit(ci + 1, band, 41) * irr * 0.4 * pitchK;
            if (sEff < bLo) ci--; else if (sEff >= bHi) ci++;
          }
          ci = ((ci % nCut) + nCut) % nCut;
          ids[i] = idOf("C:" + sampP[k] + ":" + band + ":" + ci, PF); continue;
        }
        if (d < groutZone) { ids[i] = GROUT; continue; }
      }
      ids[i] = p.ground === "None" ? GROUT : gridCell(x, y, "G", PG);
    }

    /* ------------------------------------------------ boundaries: edges between different ids */
    /* corner (c, r) index = r * (cols + 1) + c ; horizontal cell edge between (c,r-1)/(c,r) runs corner(c,r)->corner(c+1,r) */
    const CW = cols + 1;
    const edges = [];           /* [cornerA, cornerB, idA, idB] */
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, a = ids[i];
      if (c + 1 < cols) { const b = ids[i + 1]; if (a !== b) edges.push([r * CW + c + 1, (r + 1) * CW + c + 1, a, b]); }
      if (r + 1 < rows) { const b = ids[i + cols]; if (a !== b) edges.push([(r + 1) * CW + c, (r + 1) * CW + c + 1, a, b]); }
    }
    /* box border is a boundary for tiles that touch it */
    for (let c = 0; c < cols; c++) { edges.push([c, c + 1, ids[c], -1]); edges.push([rows * CW + c, rows * CW + c + 1, ids[(rows - 1) * cols + c], -1]); }
    for (let r = 0; r < rows; r++) { edges.push([r * CW, (r + 1) * CW, ids[r * cols], -1]); edges.push([r * CW + cols, (r + 1) * CW + cols, ids[r * cols + cols - 1], -1]); }
    const cornerXY = (k) => { const c = k % CW, r = (k - c) / CW; return [m + c * fx, m + r * fy]; };

    const chaikinClosed = (pts, n) => { for (let k = 0; k < n; k++) { const o = []; for (let a = 0; a < pts.length; a++) { const A = pts[a], B = pts[(a + 1) % pts.length]; o.push([0.75 * A[0] + 0.25 * B[0], 0.75 * A[1] + 0.25 * B[1]]); o.push([0.25 * A[0] + 0.75 * B[0], 0.25 * A[1] + 0.75 * B[1]]); } pts = o; } return pts; };
    const chaikinOpen = (pts, n) => { for (let k = 0; k < n; k++) { const o = [pts[0]]; for (let a = 0; a + 1 < pts.length; a++) { const A = pts[a], B = pts[a + 1]; o.push([0.75 * A[0] + 0.25 * B[0], 0.75 * A[1] + 0.25 * B[1]]); o.push([0.25 * A[0] + 0.75 * B[0], 0.25 * A[1] + 0.75 * B[1]]); } o.push(pts[pts.length - 1]); pts = o; } return pts; };
    const simplify = (pts, eps, closed) => {
      /* Douglas-Peucker; a closed loop is run as an open path back to its start */
      const P = closed ? pts.concat([pts[0]]) : pts;
      if (P.length < 4) return pts;
      const keep = [0];
      const dp = (a, b) => {
        if (b - a < 2) return;
        const A = P[a], B = P[b]; const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
        let best = -1, bi = -1;
        for (let i = a + 1; i < b; i++) { const Q = P[i]; const t = L2 > 1e-12 ? ((Q[0] - A[0]) * dx + (Q[1] - A[1]) * dy) / L2 : 0; const d = Math.hypot(Q[0] - (A[0] + dx * t), Q[1] - (A[1] + dy * t)); if (d > best) { best = d; bi = i; } }
        if (best > eps) { dp(a, bi); keep.push(bi); dp(bi, b); }
      };
      dp(0, P.length - 1);
      keep.push(P.length - 1);
      keep.sort((x, y) => x - y);
      const out = keep.map((i) => P[i]);
      if (closed) out.pop();
      return out;
    };
    const shrink = (pts, g) => {
      if (!(g > 0)) return pts;
      let A = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) A += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
      const sgn = A > 0 ? 1 : -1;   /* interior is to the left of edge direction when A > 0 */
      const n = pts.length, out = [];
      for (let i = 0; i < n; i++) {
        const P = pts[(i - 1 + n) % n], Q = pts[i], R = pts[(i + 1) % n];
        const e1 = [Q[0] - P[0], Q[1] - P[1]], e2 = [R[0] - Q[0], R[1] - Q[1]];
        const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
        const n1 = [-e1[1] / l1 * sgn, e1[0] / l1 * sgn], n2 = [-e2[1] / l2 * sgn, e2[0] / l2 * sgn];
        let bx = n1[0] + n2[0], by = n1[1] + n2[1]; const bl = Math.hypot(bx, by);
        if (bl < 1e-6) { bx = n1[0]; by = n1[1]; } else { const cosHalf = Math.max(0.5, bl / 2); bx = bx / bl / cosHalf; by = by / bl / cosHalf; }
        out.push([Q[0] + bx * g, Q[1] + by * g]);
      }
      let A2 = 0; for (let i = 0, j = n - 1; i < n; j = i++) A2 += out[j][0] * out[i][1] - out[i][0] * out[j][1];
      return A2 * sgn > 0 ? out : null;
    };
    const area = (pts) => { let A = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) A += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return Math.abs(A) / 2; };

    const paths = [];
    let total = 0;
    const emit = (pts, closed, layer) => { if (pts.length >= 2 && total + pts.length <= BUDGET) { paths.push({ pts, closed, layer }); total += pts.length; } };
    const eps = Math.min(fx, fy) * 0.35;

    /* ---- tiles: per id, chain its edges into loops ---- */
    if (p.render === "Tiles" || p.render === "Both") {
      const perId = new Map();
      for (const e of edges) { for (const side of [e[2], e[3]]) { if (side < 0 || idPen[side] < 0) continue; let a = perId.get(side); if (!a) { a = []; perId.set(side, a); } a.push(e); } }
      for (const [id, es] of perId) {
        /* corner -> outgoing edges */
        const adj = new Map();
        const used = new Uint8Array(es.length);
        es.forEach((e, k) => { for (const c of [e[0], e[1]]) { let a = adj.get(c); if (!a) { a = []; adj.set(c, a); } a.push(k); } });
        for (let k0 = 0; k0 < es.length; k0++) {
          if (used[k0]) continue;
          used[k0] = 1;
          const loop = [es[k0][0], es[k0][1]];
          let guard = 0;
          while (guard++ < es.length + 2) {
            const cur = loop[loop.length - 1];
            if (cur === loop[0]) break;
            let next = -1;
            for (const k of adj.get(cur) || []) { if (!used[k]) { next = k; break; } }
            if (next < 0) break;
            used[next] = 1;
            const e = es[next];
            loop.push(e[0] === cur ? e[1] : e[0]);
          }
          if (loop[loop.length - 1] === loop[0]) loop.pop();
          if (loop.length < 4) continue;
          let pts = loop.map(cornerXY);
          pts = chaikinClosed(pts, smoothN);
          pts = simplify(pts, eps, true);
          if (pts.length < 3) continue;
          const sh = shrink(pts, grout / 2) || shrink(pts, grout / 4);   /* slivers: try half the grout before giving up */
          if (!sh) continue;
          if (area(sh) < minArea) continue;
          emit(sh, true, idPen[id]);
        }
      }
    }
    /* ---- seams: every boundary edge once, chained ---- */
    if (p.render === "Seams" || p.render === "Both") {
      const adj = new Map();
      const used = new Uint8Array(edges.length);
      edges.forEach((e, k) => { for (const c of [e[0], e[1]]) { let a = adj.get(c); if (!a) { a = []; adj.set(c, a); } a.push(k); } });
      const degree = (c) => (adj.get(c) || []).length;
      const grow = (chain, fromEnd) => {
        for (;;) {
          const cur = fromEnd ? chain[chain.length - 1] : chain[0];
          if (degree(cur) !== 2) return;   /* stop at junctions so seams stay simple */
          let next = -1;
          for (const k of adj.get(cur)) if (!used[k]) { next = k; break; }
          if (next < 0) return;
          used[next] = 1;
          const e = edges[next], nc = e[0] === cur ? e[1] : e[0];
          if (fromEnd) chain.push(nc); else chain.unshift(nc);
          if (nc === (fromEnd ? chain[0] : chain[chain.length - 1])) return;
        }
      };
      /* start chains at junctions first so runs between junctions come out whole */
      const order = edges.map((e, k) => k).sort((a, b) => (Math.min(degree(edges[a][0]), degree(edges[a][1])) === 2 ? 1 : 0) - (Math.min(degree(edges[b][0]), degree(edges[b][1])) === 2 ? 1 : 0));
      for (const k0 of order) {
        if (used[k0]) continue;
        used[k0] = 1;
        const chain = [edges[k0][0], edges[k0][1]];
        grow(chain, true); grow(chain, false);
        const closed = chain.length > 3 && chain[0] === chain[chain.length - 1];
        if (closed) chain.pop();
        let pts = chain.map(cornerXY);
        pts = closed ? chaikinClosed(pts, smoothN) : chaikinOpen(pts, smoothN);
        pts = simplify(pts, eps, closed);
        /* pen: the figure pen if the seam touches the figure, else ground; border seams by ring */
        const e = edges[k0]; const ida = e[2], idb = e[3];
        const pa = ida >= 0 ? idPen[ida] : -1, pb = idb >= 0 ? idPen[idb] : -1;
        const layer = pa === PF || pb === PF ? PF : Math.max(pa, pb, PG);
        emit(pts, closed, layer);
      }
    }
    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx) {
    try {
      const F = this && typeof this._frame === "function" ? this._frame(p, ctx) : null;
      if (!F) return [];
      const g = [{ kind: "rect", x: F.m, y: F.m, w: F.bw, h: F.bh }];
      const b = Math.max(0, Math.round(Number(p.borderRows) || 0));
      if (b > 0) g.push({ kind: "rect", x: F.m + b * F.tx, y: F.m + b * F.ty, w: Math.max(0, F.bw - 2 * b * F.tx), h: Math.max(0, F.bh - 2 * b * F.ty) });
      return g;
    } catch (e) { return []; }
  },
};
