import { Pin, resample, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "lettering",
  name: "Lettering",
  cat: "gen",
  group: "textimg",
  desc: "Heavy plotter lettering with a 3D side. Three faces: Bold sweeps the built-in capitals with a round pen, Block with a square pen, Roman with a broad nib at Nib angle so thickness follows stroke direction. Every stroke is stamped into a distance field and the union is traced as one clean outline, so joints never double up; Fill shades the face from the same field as Outline, Hatch or Inline (concentric outlines). Depth extrudes the letters toward Depth angle like sign-painter's block letters: the extruded body is the field's sliding minimum along the depth vector, only the sides whose outline faces that way are visible, and Side texture draws them as Zigzag (a sawtooth stripe along the side), Lines (rules from face to back), Hatch or a plain Outline; lines stop where they would run into another letter. Rotate turns the whole block, Slant shears it. Lines with |, Align, Tracking, Line height, Y offset; the block shrinks to the margins when it is too big.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Lines")],
  params: [
    { key: "text", label: "Text (| = new line)", type: "text", def: "BUNDLE|EVERYTHING" },
    { key: "font", label: "Font", type: "select", options: ["Bold", "Block", "Roman"], def: "Bold" },
    { key: "size", label: "Size mm", type: "slider", min: 4, max: 120, step: 0.5, def: 30 },
    { key: "weight", label: "Weight %", type: "slider", min: 3, max: 45, step: 1, def: 24 },
    { key: "nib", label: "Nib angle °", type: "slider", min: 0, max: 90, step: 1, def: 35, showIf: (p) => p.font === "Roman" },
    { key: "slant", label: "Slant °", type: "slider", min: -30, max: 30, step: 1, def: 0 },
    { key: "fill", label: "Fill", type: "select", options: ["Outline", "Hatch", "Inline"], def: "Outline" },
    { key: "hatch", label: "Hatch mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1.2, showIf: (p) => p.fill !== "Outline" },
    { key: "hangle", label: "Hatch angle °", type: "slider", min: 0, max: 180, step: 1, def: 45, showIf: (p) => p.fill === "Hatch" },
    { key: "depth", label: "Depth mm", type: "slider", min: 0, max: 40, step: 0.5, def: 7 },
    { key: "dangle", label: "Depth angle °", type: "slider", min: 0, max: 360, step: 1, def: 120, showIf: (p) => p.depth > 0 },
    { key: "side", label: "Side texture", type: "select", options: ["Zigzag", "Lines", "Hatch", "Outline"], def: "Zigzag", showIf: (p) => p.depth > 0 },
    { key: "sidegap", label: "Side pitch mm", type: "slider", min: 0.5, max: 6, step: 0.1, def: 1.8, showIf: (p) => p.depth > 0 && p.side !== "Outline" },
    { key: "rotate", label: "Rotate °", type: "slider", min: -45, max: 45, step: 1, def: 0 },
    { key: "tracking", label: "Tracking", type: "slider", min: 0.6, max: 2, step: 0.05, def: 1 },
    { key: "lineh", label: "Line height", type: "slider", min: 1, max: 3, step: 0.05, def: 1.5 },
    { key: "align", label: "Align", type: "select", options: ["Center", "Left", "Right"], def: "Center" },
    { key: "yoff", label: "Y offset mm", type: "slider", min: -140, max: 140, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const font = p.font;
    const size = Math.max(1, Number(p.size) || 30);
    const weight = clamp(Number(p.weight) || 24, 1, 60) / 100;
    const nibA = (clamp(Number(p.nib) || 0, 0, 90)) * Math.PI / 180;
    const slant = clamp(Number(p.slant) || 0, -45, 45) * Math.PI / 180;
    const tracking = clamp(Number(p.tracking) || 1, 0.3, 3);
    const lineh = clamp(Number(p.lineh) || 1.5, 0.8, 4);
    const margin = Math.max(0, Number(p.margin) || 0);
    const depthMM = Math.max(0, Number(p.depth) || 0);
    const dA = (Number(p.dangle) || 0) * Math.PI / 180;
    const rot = clamp(Number(p.rotate) || 0, -180, 180) * Math.PI / 180;
    const BUDGET = 112000;

    /* geometric capitals from the shared font: y flipped to up, 10 units = cap height */
    const capGlyph = (ch) => {
      const g = SFONT[ch] || null;
      if (!g) return null;
      return { w: g.w, strokes: g.s.filter((s) => s.length >= 2).map((s) => s.map(([x, y]) => [x, 10 - y])) };
    };
    /* one line -> strokes in glyph units (y up) */
    const layoutLine = (line) => {
      const strokes = [];
      let x = 0;
      const gap = 2 * tracking;
      for (const ch of line.toUpperCase()) {
        if (ch === " ") { x += 5 * tracking; continue; }
        const cg = capGlyph(ch);
        if (!cg) { x += 3; continue; }
        for (const s of cg.strokes) strokes.push({ pts: s.map(([gx, gy]) => [x + gx, gy]) });
        x += cg.w + gap;
      }
      return { strokes, width: Math.max(0, x - gap) };
    };

    /* ----------------------------------------------------- SDF raster for thick fonts */
    const chain = (segs) => {
      const key = (q) => Math.round(q[0] * 50) + "," + Math.round(q[1] * 50);
      const ends = new Map();
      const used = new Array(segs.length).fill(false);
      segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
      const out = [];
      for (let i = 0; i < segs.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        const line = [segs[i][0], segs[i][1]];
        for (const dir of [1, -1]) {
          for (let guard = 0; guard < 20000; guard++) {
            const tip = dir === 1 ? line[line.length - 1] : line[0];
            const cand = (ends.get(key(tip)) || []).find((j) => !used[j]);
            if (cand === undefined) break;
            used[cand] = true;
            const s = segs[cand];
            const next = key(s[0]) === key(tip) ? s[1] : s[0];
            if (dir === 1) line.push(next); else line.unshift(next);
          }
        }
        const closed = line.length > 3 && Math.hypot(line[0][0] - line[line.length - 1][0], line[0][1] - line[line.length - 1][1]) < 0.05;
        if (closed) line.pop();
        out.push({ pts: line, closed });
      }
      return out;
    };
    /* prims: {kind:"seg", a, b, r, sq} or {kind:"quad", q:[4 pts]} in mm. Returns paths (mm). */
    const rasterise = (prims, cellMM, fill, hatchMM, hatchAng, D, side, sideGap) => {
      if (!prims.length) return [];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const grow = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
      for (const pr of prims) { if (pr.kind === "seg") { grow(pr.a[0], pr.a[1], pr.r); grow(pr.b[0], pr.b[1], pr.r); } else for (const q of pr.q) grow(q[0], q[1], 0); }
      const pad = cellMM * 3;
      x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      if (D) { x0 = Math.min(x0, x0 + D[0]); y0 = Math.min(y0, y0 + D[1]); x1 = Math.max(x1, x1 + D[0]); y1 = Math.max(y1, y1 + D[1]); }
      const cols = Math.min(2400, Math.ceil((x1 - x0) / cellMM) + 1), rows = Math.min(2400, Math.ceil((y1 - y0) / cellMM) + 1);
      const cell = Math.max((x1 - x0) / (cols - 1), (y1 - y0) / (rows - 1));
      const FAR = cell * 4;
      const f = new Float32Array(cols * rows).fill(FAR);
      const stamp = (bx0, by0, bx1, by1, sd) => {
        const cx0 = Math.max(0, Math.floor((bx0 - x0) / cell) - 1), cx1 = Math.min(cols - 1, Math.ceil((bx1 - x0) / cell) + 1);
        const cy0 = Math.max(0, Math.floor((by0 - y0) / cell) - 1), cy1 = Math.min(rows - 1, Math.ceil((by1 - y0) / cell) + 1);
        for (let cy = cy0; cy <= cy1; cy++) { const py = y0 + cy * cell; for (let cx = cx0; cx <= cx1; cx++) { const d = sd(x0 + cx * cell, py); const i = cy * cols + cx; if (d < f[i]) f[i] = d; } }
      };
      for (const pr of prims) {
        if (pr.kind === "seg") {
          const [ax, ay] = pr.a, [bx, by] = pr.b, r = pr.r, sq = pr.sq;
          const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
          const m = r + cell * 2;
          stamp(Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m, (x, y) => {
            const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
            const px = ax + dx * t - x, py = ay + dy * t - y;
            return (sq ? Math.max(Math.abs(px), Math.abs(py)) : Math.hypot(px, py)) - r;
          });
        } else {
          const q = pr.q;
          let area = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; area += a[0] * b[1] - b[0] * a[1]; }
          const sgn = area >= 0 ? 1 : -1;
          const edges = [];
          for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1e-9; edges.push([a[0], a[1], (ey / el) * sgn, (-ex / el) * sgn]); }
          const xs = q.map((v) => v[0]), ys = q.map((v) => v[1]);
          const m = cell * 2;
          stamp(Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m, (x, y) => {
            let d = -1e9;
            for (const [ax, ay, nx, ny] of edges) { const v = (x - ax) * nx + (y - ay) * ny; if (v > d) d = v; }
            return d;
          });
        }
      }
      const at = (cx, cy) => f[cy * cols + cx];
      const iso = (level) => {
        const segs = [];
        for (let cy = 0; cy < rows - 1; cy++) for (let cx = 0; cx < cols - 1; cx++) {
          const v = [at(cx, cy) - level, at(cx + 1, cy) - level, at(cx + 1, cy + 1) - level, at(cx, cy + 1) - level];
          if ((v[0] < 0) === (v[1] < 0) && (v[1] < 0) === (v[2] < 0) && (v[2] < 0) === (v[3] < 0)) continue;
          const P = [[x0 + cx * cell, y0 + cy * cell], [x0 + (cx + 1) * cell, y0 + cy * cell], [x0 + (cx + 1) * cell, y0 + (cy + 1) * cell], [x0 + cx * cell, y0 + (cy + 1) * cell]];
          const pts = [];
          for (let e = 0; e < 4; e++) { const a = v[e], b = v[(e + 1) % 4]; if ((a < 0) !== (b < 0)) { const t = a / (a - b); const A = P[e], B = P[(e + 1) % 4]; pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); } }
          if (pts.length === 2) segs.push(pts);
          else if (pts.length === 4) { const c = (v[0] + v[1] + v[2] + v[3]) / 4; if ((c < 0) === (v[0] < 0)) { segs.push([pts[0], pts[3]]); segs.push([pts[1], pts[2]]); } else { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); } }
        }
        return chain(segs);
      };
      const plen = (q) => { let l = 0; for (let i = 1; i < q.pts.length; i++) l += Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1]); return l; };
      const sampleF = (F) => (x, y) => {
        const gx = (x - x0) / cell, gy = (y - y0) / cell;
        const ix = Math.floor(gx), iy = Math.floor(gy);
        if (ix < 0 || iy < 0 || ix >= cols - 1 || iy >= rows - 1) return FAR;
        const tx = gx - ix, ty = gy - iy;
        return F[iy * cols + ix] * (1 - tx) * (1 - ty) + F[iy * cols + ix + 1] * tx * (1 - ty) + F[(iy + 1) * cols + ix + 1] * tx * ty + F[(iy + 1) * cols + ix] * (1 - tx) * ty;
      };
      const sample = sampleF(f);
      const isoOf = (F, level) => {
        const segs = [];
        const atF = (cx, cy) => F[cy * cols + cx];
        for (let cy = 0; cy < rows - 1; cy++) for (let cx = 0; cx < cols - 1; cx++) {
          const v = [atF(cx, cy) - level, atF(cx + 1, cy) - level, atF(cx + 1, cy + 1) - level, atF(cx, cy + 1) - level];
          if ((v[0] < 0) === (v[1] < 0) && (v[1] < 0) === (v[2] < 0) && (v[2] < 0) === (v[3] < 0)) continue;
          const P = [[x0 + cx * cell, y0 + cy * cell], [x0 + (cx + 1) * cell, y0 + cy * cell], [x0 + (cx + 1) * cell, y0 + (cy + 1) * cell], [x0 + cx * cell, y0 + (cy + 1) * cell]];
          const pts = [];
          for (let e = 0; e < 4; e++) { const a = v[e], b = v[(e + 1) % 4]; if ((a < 0) !== (b < 0)) { const t = a / (a - b); const A = P[e], B = P[(e + 1) % 4]; pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); } }
          if (pts.length === 2) segs.push(pts);
          else if (pts.length === 4) { const c = (v[0] + v[1] + v[2] + v[3]) / 4; if ((c < 0) === (v[0] < 0)) { segs.push([pts[0], pts[3]]); segs.push([pts[1], pts[2]]); } else { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); } }
        }
        return segs;
      };
      const isoClean = (F, lv) => chain(isoOf(F, lv)).filter((q) => plen(q) > cell * 1.5);
      const hatchInto = (inside, spacing, angDeg, out) => {
        const a = angDeg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
        const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2;
        const diag = Math.hypot(x1 - x0, y1 - y0);
        const step = cell * 0.7;
        for (let o = -diag / 2; o <= diag / 2; o += spacing) {
          let cur = null, prevIn = false, px = 0, py = 0;
          for (let s = -diag / 2; s <= diag / 2; s += step) {
            const x = cxm + nx * o + dx * s, y = cym + ny * o + dy * s;
            const isIn = inside(x, y);
            if (isIn && !prevIn) cur = [[x, y]];
            else if (!isIn && prevIn && cur) { cur.push([px, py]); if (plen({ pts: cur }) > step) out.push({ pts: cur, closed: false }); cur = null; }
            prevIn = isIn; px = x; py = y;
          }
          if (cur && prevIn) { cur.push([px, py]); if (plen({ pts: cur }) > step) out.push({ pts: cur, closed: false }); }
        }
      };

      /* ---- face ---- */
      const faceOutline = isoClean(f, 0);
      const out = faceOutline.slice();
      if (fill === "Inline") {
        let lv = -hatchMM; let guard = 0;
        while (guard++ < 60) { const c = isoClean(f, lv); if (!c.length) break; c.forEach((q) => out.push(q)); lv -= hatchMM; }
      } else if (fill === "Hatch") hatchInto((x, y) => sample(x, y) < 0, hatchMM, hatchAng, out);

      /* ---- extrusion ---- */
      if (D && Math.hypot(D[0], D[1]) > cell) {
        const dl = Math.hypot(D[0], D[1]);
        /* sliding minimum along -D in whole-cell shifts: the extruded body */
        const K = Math.max(1, Math.ceil(dl / cell));
        const g = Float32Array.from(f);
        for (let k = 1; k <= K; k++) {
          const sx = Math.round(-D[0] * k / K / cell), sy = Math.round(-D[1] * k / K / cell);
          if (k > 1 && sx === Math.round(-D[0] * (k - 1) / K / cell) && sy === Math.round(-D[1] * (k - 1) / K / cell)) continue;
          const cy0 = Math.max(0, -sy), cy1 = Math.min(rows, rows - sy), cx0 = Math.max(0, -sx), cx1 = Math.min(cols, cols - sx);
          for (let cy = cy0; cy < cy1; cy++) { const ro = cy * cols, rs = (cy + sy) * cols + sx; for (let cx = cx0; cx < cx1; cx++) { const v = f[rs + cx]; if (v < g[ro + cx]) g[ro + cx] = v; } }
        }
        const sampleG = sampleF(g);
        /* back silhouette: only where it is not the face outline itself */
        const back = chain(isoOf(g, 0).filter((sg) => sample((sg[0][0] + sg[1][0]) / 2, (sg[0][1] + sg[1][1]) / 2) > cell * 0.8)).filter((q) => plen(q) > cell * 1.5);
        back.forEach((q) => out.push(q));
        /* sides: the outline stretches whose outward normal points along D */
        const ux = D[0] / dl, uy = D[1] / dl;
        const grad = (x, y) => { const e = cell * 0.5; const gx = sample(x + e, y) - sample(x - e, y), gy = sample(x, y + e) - sample(x, y - e); const l = Math.hypot(gx, gy) || 1e-9; return [gx / l, gy / l]; };
        const facing = (x, y) => { const n = grad(x, y); return n[0] * ux + n[1] * uy > 0.15; };
        /* walk a line from a face point back along D, stopping at another letter's face */
        const ray = (x, y, t0, t1) => {
          const pts = [[x + D[0] * t0, y + D[1] * t0]];
          const steps = Math.max(1, Math.ceil(dl * (t1 - t0) / (cell * 0.8)));
          for (let i = 1; i <= steps; i++) {
            const t = t0 + (t1 - t0) * i / steps;
            const qx = x + D[0] * t, qy = y + D[1] * t;
            if (sample(qx, qy) < -cell * 0.5) break;
            pts.push([qx, qy]);
          }
          return pts;
        };
        if (side === "Hatch") hatchInto((x, y) => sampleG(x, y) < 0 && sample(x, y) > 0, sideGap, hatchAng, out);
        else if (side === "Lines" || side === "Zigzag") {
          for (const q of faceOutline) {
            /* resample the outline at the side pitch */
            const rs = resample(q.pts, q.closed, sideGap);
            if (side === "Lines") {
              for (const [x, y] of rs) { if (!facing(x, y)) continue; const r = ray(x, y, 0, 1); if (r.length >= 2) out.push({ pts: r, closed: false }); }
            } else {
              let zig = [], k = 0;
              const flush = () => { if (zig.length >= 3) out.push({ pts: zig, closed: false }); zig = []; };
              for (let i = 0; i < rs.length; i++) {
                const [x, y] = rs[i];
                if (!facing(x, y)) { flush(); continue; }
                const t = k % 2 === 0 ? 0.28 : 0.72;
                const qx = x + D[0] * t, qy = y + D[1] * t;
                if (sample(qx, qy) < -cell * 0.5) { flush(); continue; }
                zig.push([qx, qy]); k++;
              }
              flush();
            }
          }
        }
      }
      return out;
    };

    /* ----------------------------------------------------------- assemble */
    const lines = String(p.text || "").split("|");
    const laid = lines.map(layoutLine);
    const unit0 = size / 10;
    const tanS = Math.tan(slant);
    const over = weight * 10;
    const widest = Math.max(1e-6, ...laid.map((l) => l.width + Math.abs(tanS) * 10 + over));
    const unitsH = (laid.length - 1) * 10 * lineh + 10 + over;
    const unit = Math.max(1e-6, Math.min(unit0, (W - 2 * margin) / widest, (H - 2 * margin) / unitsH));   /* shrink only, both axes */
    const lineAdv = 10 * lineh * unit;
    const totalH = unitsH * unit;
    const yTop = (H - totalH) / 2 + (Number(p.yoff) || 0) + (over / 2) * unit;
    const D = depthMM > 0 ? [Math.cos(dA) * depthMM, Math.sin(dA) * depthMM] : null;
    let paths = [];
    let total = 0;

    const prims = [];
    const wMM = weight * 10 * unit;
    laid.forEach((L, li) => {
      const lw = L.width * unit;
      const ov = (over / 2) * unit;
      const xLeft = p.align === "Left" ? margin + ov : p.align === "Right" ? W - margin - lw - ov : (W - lw) / 2;
      const baseY = yTop + 10 * unit + li * lineAdv;
      const toMM = ([gx, gy]) => [xLeft + (gx + gy * tanS) * unit, baseY - gy * unit];
      for (const s of L.strokes) {
        const pts = s.pts.map(toMM);
        if (font === "Roman") {
          const vx = Math.cos(-nibA) * wMM / 2, vy = Math.sin(-nibA) * wMM / 2;
          for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; prims.push({ kind: "quad", q: [[a[0] - vx, a[1] - vy], [b[0] - vx, b[1] - vy], [b[0] + vx, b[1] + vy], [a[0] + vx, a[1] + vy]] }); }
        } else {
          for (let i = 0; i < pts.length - 1; i++) prims.push({ kind: "seg", a: pts[i], b: pts[i + 1], r: wMM / 2, sq: font === "Block" });
        }
      }
    });
    /* one field for the whole block, so a line's extrusion is cut by the letters below it */
    const cellMM = clamp((10 * unit) / 110, 0.08, 0.6);
    const hatchMM = Math.max(0.2, Number(p.hatch) || 1.2);
    const res = rasterise(prims, cellMM, p.fill, hatchMM, Number(p.hangle) || 0, D, p.side, Math.max(0.3, Number(p.sidegap) || 1.8));
    for (const q of res) if (q.pts.length >= 2) paths.push({ pts: q.pts, closed: q.closed, layer: pen });

    /* rotate about the sheet centre, then fit the whole block into the margins: shrink only, and slide inside */
    if (Math.abs(rot) > 1e-6) { const c = Math.cos(rot), sn = Math.sin(rot), cx = W / 2, cy = H / 2; paths = paths.map((q) => ({ ...q, pts: q.pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c]) })); }
    if (paths.length) {
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const q of paths) for (const [x, y] of q.pts) { if (x < bx0) bx0 = x; if (y < by0) by0 = y; if (x > bx1) bx1 = x; if (y > by1) by1 = y; }
      const bw = Math.max(1e-6, bx1 - bx0), bh = Math.max(1e-6, by1 - by0);
      const k = Math.min(1, (W - 2 * margin) / bw, (H - 2 * margin) / bh);
      const cxm = (bx0 + bx1) / 2, cym = (by0 + by1) / 2;
      const hw = bw * k / 2, hh = bh * k / 2;
      const ncx = Math.min(W - margin - hw, Math.max(margin + hw, cxm)), ncy = Math.min(H - margin - hh, Math.max(margin + hh, cym));
      if (k < 0.9999 || Math.abs(ncx - cxm) > 1e-9 || Math.abs(ncy - cym) > 1e-9) paths = paths.map((q) => ({ ...q, pts: q.pts.map(([x, y]) => [ncx + (x - cxm) * k, ncy + (y - cym) * k]) }));
    }
    const outPaths = [];
    for (const q of paths) { if (total > BUDGET) break; outPaths.push(q); total += q.pts.length; }
    return applyStyle({ paths: outPaths }, ins[0]);
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      return [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
    } catch (e) { return []; }
  },
};
