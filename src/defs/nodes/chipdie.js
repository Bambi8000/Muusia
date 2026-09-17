import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "chipdie",
  name: "Chip Die",
  cat: "gen",
  group: "structural",
  desc: "A microchip die shot drawn the way a die is built. The outer edge carries a seal ring and a ring of bond pads; inside, the core area is split hierarchically into blocks with routing channels left between them, and every channel carries a bus of parallel traces whose width shrinks with the depth of the split. Each block gets a texture from its type: SRAM as sub-arrays of dense word lines broken by bit-line groups with a decoder strip between them, standard-cell logic as power-rail rows filled with cell ticks and short metal stubs, analog as interdigitated transistor fingers and a rectangular spiral inductor, capacitor arrays as a lattice of squares, IO as nested frames, and empty silicon as sparse dummy fill. Routed blocks are the tangle of a 1970s die: thick Manhattan traces walked on a grid so they never cross, a via square at every end, drawn as centre lines or as outlined rods at Trace width. Style picks the floorplan: Processor repeats identical cores mirrored like a real multicore with L2 arrays above and an IO strip below, Memory is banks of arrays with decoder logic, FPGA a uniform grid of tiles with channels on every row and column, Analog a few large mixed-signal blocks, Vintage one routed die with a wide power ring and a handful of big pads, Random a seeded floorplan of everything. Colour by type puts every class on its own pen counted up from Pen (seal and pads, SRAM +1, logic +2, analog +3, IO +4, buses +5, routing +6) so a multi-pen plot reads like a false-colour die shot; Bond wires arc from every pad out past the die edge. Density sets the feature pitch; Blocks output carries the closed block outlines for fill nodes.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Lines"), Pin("paths", "Blocks")],
  params: [
    { key: "style", label: "Style", type: "select", options: ["Processor", "Memory", "FPGA", "Analog", "Vintage", "Random"], def: "Processor" },
    { key: "cores", label: "Cores / banks", type: "slider", min: 1, max: 8, step: 1, def: 4, showIf: (p) => p.style === "Processor" || p.style === "Memory" || p.style === "FPGA" },
    { key: "depth", label: "Split depth", type: "slider", min: 1, max: 6, step: 1, def: 4, showIf: (p) => p.style === "Random" || p.style === "Analog" },
    { key: "density", label: "Density", type: "slider", min: 0, max: 100, step: 1, def: 55 },
    { key: "trace", label: "Trace width mm", type: "slider", min: 0, max: 3, step: 0.05, def: 0.9, showIf: (p) => p.style === "Vintage" || p.style === "Random" || p.style === "Analog" },
    { key: "colours", label: "Colour by type", type: "check", def: false },
    { key: "bondwires", label: "Bond wires", type: "check", def: false, showIf: (p) => p.pads },
    { key: "gutter", label: "Channel mm", type: "slider", min: 0.5, max: 8, step: 0.1, def: 3 },
    { key: "buses", label: "Buses", type: "check", def: true },
    { key: "pads", label: "Bond pads", type: "check", def: true },
    { key: "seal", label: "Seal ring", type: "check", def: true },
    { key: "mirror", label: "Mirror cores", type: "check", def: true, showIf: (p) => p.style === "Processor" },
    { key: "size", label: "Die width mm", type: "slider", min: 20, max: 280, step: 1, def: 150 },
    { key: "aspect", label: "Aspect (h/w)", type: "slider", min: 0.4, max: 2.5, step: 0.05, def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 21 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const seed = Math.round(Number(p.seed) || 0);
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const style = p.style;
    const density = clamp(Number(p.density) || 0, 0, 100) / 100;
    const margin = Math.max(0, Number(p.margin) || 0);
    const BUDGET = 112000;
    const rng = mulberry32(seed * 7919 + 13);

    /* ------------------------------------------------------------- die */
    const aspect = clamp(Number(p.aspect) || 1, 0.2, 5);
    let dw = Math.max(5, Number(p.size) || 150), dh = dw * aspect;
    const wireRoom = p.pads && p.bondwires ? Math.min(12, dw * 0.1) : 0;           /* bond wires need room outside the die, inside the margin */
    const fit = Math.min(1, (W - 2 * margin - 2 * wireRoom) / dw, (H - 2 * margin - 2 * wireRoom) / dh);   /* shrink only */
    dw *= fit; dh *= fit;
    const dx0 = (W - dw) / 2, dy0 = (H - dh) / 2;
    const die = { x: dx0, y: dy0, w: dw, h: dh };
    const ds = (1.35 - density * 1.05) * Math.max(0.3, Math.min(1.4, dw / 120));   /* feature pitch in mm */
    const gut = Math.max(0.3, Number(p.gutter) || 3) * fit;

    const lines = [], blocks = [];
    let total = 0;
    const PEN_OFF = { frame: 0, sram: 1, logic: 2, analog: 3, cap: 3, comb: 3, spiral: 3, io: 4, bus: 5, routed: 6, dummy: 0 };
    const penFor = (cls) => (p.colours ? (pen + (PEN_OFF[cls] || 0)) % 12 : pen);
    let curPen = pen;
    const L = (pts, closed) => { if (pts.length >= 2 && total < BUDGET) { lines.push({ pts, closed: !!closed, layer: curPen }); total += pts.length; } };
    const traceW = Math.max(0, Number(p.trace) || 0) * fit;
    /* a Manhattan polyline drawn as an outlined rod with square ends */
    const rod = (pts, w) => {
      if (w <= 0.05 || pts.length < 2) { L(pts, false); return; }
      const h = w / 2, Lp = [], Rp = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        if (i === 0) { tx = pts[1][0] - pts[0][0]; ty = pts[1][1] - pts[0][1]; }
        if (i === pts.length - 1) { tx = pts[i][0] - pts[i - 1][0]; ty = pts[i][1] - pts[i - 1][1]; }
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        /* at a corner, offset along both directions so the rod keeps square corners */
        let ox = -ty * h, oy = tx * h;
        if (i > 0 && i < pts.length - 1) {
          const ax = pts[i][0] - pts[i - 1][0], ay = pts[i][1] - pts[i - 1][1], al = Math.hypot(ax, ay) || 1;
          const bx = pts[i + 1][0] - pts[i][0], by = pts[i + 1][1] - pts[i][1], bl = Math.hypot(bx, by) || 1;
          const n1x = -ay / al * h, n1y = ax / al * h, n2x = -by / bl * h, n2y = bx / bl * h;
          const cross = (ax / al) * (by / bl) - (ay / al) * (bx / bl);
          if (Math.abs(cross) > 0.5) { ox = n1x + n2x; oy = n1y + n2y; }
        }
        Lp.push([pts[i][0] + ox, pts[i][1] + oy]); Rp.push([pts[i][0] - ox, pts[i][1] - oy]);
      }
      L(Lp.concat(Rp.reverse()), true);
    };
    const rect = (r) => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    const inset = (r, m) => ({ x: r.x + m, y: r.y + m, w: r.w - 2 * m, h: r.h - 2 * m });
    const okR = (r) => r.w > ds * 1.5 && r.h > ds * 1.5;

    /* ------------------------------------------------- seal ring + pads */
    let inner = die;
    curPen = penFor("frame");
    L(rect(die), true);
    if (p.seal) {
      const sw = Math.max(0.6, ds * 1.2);
      L(rect(inset(die, sw)), true);
      L(rect(inset(die, sw * 1.6)), true);
      inner = inset(die, sw * 2.2);
    }
    const padPos = [];
    if (p.pads) {
      const vintage = style === "Vintage";
      const padS = Math.max(1.2, ds * (vintage ? 6 : 3.2)), padPitch = padS * (vintage ? 2.6 : 1.6);
      const ring = inset(inner, padS * 0.4);
      const along = (x0, y0, dxp, dyp, n) => {
        for (let i = 0; i < n; i++) {
          const cx = x0 + dxp * i, cy = y0 + dyp * i;
          const r = { x: cx - padS / 2, y: cy - padS / 2, w: padS, h: padS };
          L(rect(r), true);
          L(rect(inset(r, padS * 0.22)), true);
          padPos.push([cx, cy]);
        }
      };
      const nx = Math.max(2, Math.floor((ring.w - padS) / padPitch)), ny = Math.max(2, Math.floor((ring.h - padS) / padPitch));
      const sx = (ring.w - padS) / nx, sy = (ring.h - padS) / ny;
      along(ring.x + padS / 2, ring.y + padS / 2, sx, 0, nx);
      along(ring.x + padS / 2, ring.y + ring.h - padS / 2, sx, 0, nx);
      along(ring.x + padS / 2, ring.y + padS / 2 + sy, 0, sy, ny - 1);
      along(ring.x + ring.w - padS / 2, ring.y + padS / 2 + sy, 0, sy, ny - 1);
      inner = inset(inner, padS * 1.9);
    }
    inner = inset(inner, gut * 0.5);
    if (p.pads && p.bondwires) {
      const rr = mulberry32(seed * 43 + 5);
      const cxd = die.x + die.w / 2, cyd = die.y + die.h / 2;
      for (const [px, py] of padPos) {
        /* out through the nearest edge, a loop rising then landing beyond the die */
        const dxs = Math.abs(px - die.x) < Math.abs(px - die.x - die.w) ? -1 : 1, dys = Math.abs(py - die.y) < Math.abs(py - die.y - die.h) ? -1 : 1;
        const horiz = Math.min(Math.abs(px - die.x), Math.abs(px - die.x - die.w)) < Math.min(Math.abs(py - die.y), Math.abs(py - die.y - die.h));
        const len = wireRoom * 0.92 * (0.7 + rr() * 0.3);
        if (len < 1) continue;
        const ex = horiz ? px + dxs * len : px + (rr() - 0.5) * len * 0.6, ey = horiz ? py + (rr() - 0.5) * len * 0.6 : py + dys * len;
        const mx = (px + ex) / 2 + (horiz ? 0 : (rr() - 0.5) * len * 0.3), my = (py + ey) / 2 + (horiz ? (rr() - 0.5) * len * 0.3 : 0);
        const pts = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10, u = 1 - t; pts.push([u * u * px + 2 * u * t * mx + t * t * ex, u * u * py + 2 * u * t * my + t * t * ey]); }
        L(pts, false);
        L(rect({ x: ex - ds * 0.5, y: ey - ds * 0.5, w: ds, h: ds }), true);
      }
    }

    /* ---------------------------------------------------- block textures */
    const sram = (r, k) => {
      if (!okR(r)) return;
      const cols = clamp(Math.round(r.w / (ds * 14)), 1, 6), rows = clamp(Math.round(r.h / (ds * 14)), 1, 6);
      const dec = ds * 1.4;            /* decoder strip between sub-arrays */
      const cw = (r.w - dec * (cols - 1)) / cols, ch = (r.h - dec * (rows - 1)) / rows;
      const wl = ds * 0.55, bl = wl * 7;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const s = { x: r.x + i * (cw + dec), y: r.y + j * (ch + dec), w: cw, h: ch };
        L(rect(s), true);
        const m = inset(s, wl * 1.2);
        if (m.w <= 0 || m.h <= 0) continue;
        for (let y = m.y + wl; y < m.y + m.h; y += wl) L([[m.x, y], [m.x + m.w, y]], false);
        for (let x = m.x + bl; x < m.x + m.w; x += bl) L([[x, m.y], [x, m.y + m.h]], false);
      }
      /* row decoder: a thin comb along the left of each row of arrays */
      if (dec > 0.8) for (let j = 0; j < rows - 1; j++) { const y = r.y + (j + 1) * (ch + dec) - dec / 2; L([[r.x, y], [r.x + r.w, y]], false); }
    };
    const logic = (r, k) => {
      if (!okR(r)) return;
      const rh = ds * 3.2;
      const rows = Math.max(1, Math.floor(r.h / rh));
      const rr = mulberry32(seed * 31 + k * 17 + 3);
      for (let j = 0; j <= rows; j++) { const y = r.y + j * rh; if (y <= r.y + r.h + 1e-6) L([[r.x, y], [r.x + r.w, y]], false); }
      for (let j = 0; j < rows; j++) {
        const y0 = r.y + j * rh, y1 = y0 + rh;
        let x = r.x + ds * 0.5;
        let guard = 0;
        while (x < r.x + r.w - ds * 0.5 && guard++ < 4000) {
          const cw = ds * (0.8 + Math.floor(rr() * 4) * 0.5);
          if (x + cw > r.x + r.w) break;
          const kind = rr();
          if (kind < 0.55) L([[x, y0 + rh * (0.15 + rr() * 0.3)], [x, y1 - rh * (0.15 + rr() * 0.3)]], false);          /* poly / cell edge */
          else if (kind < 0.8) { const y = y0 + rh * (0.25 + rr() * 0.5); L([[x, y], [x + cw * 0.9, y]], false); }          /* metal stub */
          else { const y = y0 + rh * (0.3 + rr() * 0.4); L([[x, y0 + rh * 0.2], [x, y], [x + cw * 0.8, y]], false); }       /* L-shaped route */
          x += cw;
        }
      }
    };
    const capArray = (r, k) => {
      if (!okR(r)) return;
      const c = ds * 1.6, g = ds * 0.7;
      const nx = Math.floor((r.w - g) / (c + g)), ny = Math.floor((r.h - g) / (c + g));
      const ox = r.x + (r.w - nx * (c + g) + g) / 2, oy = r.y + (r.h - ny * (c + g) + g) / 2;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) L(rect({ x: ox + i * (c + g), y: oy + j * (c + g), w: c, h: c }), true);
    };
    const comb = (r, k) => {
      if (!okR(r)) return;
      const m = inset(r, ds * 0.8);
      if (m.w <= ds || m.h <= ds) return;
      L([[m.x, m.y], [m.x + m.w, m.y]], false);
      L([[m.x, m.y + m.h], [m.x + m.w, m.y + m.h]], false);
      const pitch = ds * 0.9;
      let i = 0;
      for (let x = m.x + pitch; x < m.x + m.w - pitch * 0.5; x += pitch, i++) {
        if (i % 2 === 0) L([[x, m.y], [x, m.y + m.h * 0.82]], false); else L([[x, m.y + m.h], [x, m.y + m.h * 0.18]], false);
      }
    };
    const spiral = (r, k) => {
      if (!okR(r)) return;
      const m = inset(r, ds);
      const pitch = ds * 1.1;
      const pts = [];
      let x0 = m.x, y0 = m.y, x1 = m.x + m.w, y1 = m.y + m.h;
      let guard = 0;
      pts.push([x0, y0]);
      while (x1 - x0 > pitch * 2 && y1 - y0 > pitch * 2 && guard++ < 200) {
        pts.push([x1, y0]); pts.push([x1, y1]); x0 += pitch; pts.push([x0, y1]); y0 += pitch; pts.push([x0, y0]); x1 -= pitch; y1 -= pitch;
      }
      L(pts, false);
      /* a lead out from the centre */
      const c = pts[pts.length - 1];
      L([[c[0], c[1]], [c[0] + pitch * 0.5, c[1]], [c[0] + pitch * 0.5, m.y + m.h + ds * 0.4]], false);
    };
    const analog = (r, k) => {
      if (!okR(r)) return;
      const rr = mulberry32(seed * 53 + k * 7 + 1);
      /* split into two or three sub-blocks: combs, a spiral if there is room, a cap array */
      const parts = r.w > r.h ? [{ x: r.x, y: r.y, w: r.w * 0.45, h: r.h }, { x: r.x + r.w * 0.5, y: r.y, w: r.w * 0.5, h: r.h }] : [{ x: r.x, y: r.y, w: r.w, h: r.h * 0.45 }, { x: r.x, y: r.y + r.h * 0.5, w: r.w, h: r.h * 0.5 }];
      parts.forEach((q, i) => {
        L(rect(q), true);
        const kind = rr();
        if (i === 0 && Math.min(q.w, q.h) > ds * 8 && kind < 0.6) spiral(q, k + i);
        else if (kind < 0.5) comb(inset(q, ds * 0.3), k + i);
        else capArray(inset(q, ds * 0.4), k + i);
      });
    };
    const io = (r, k) => {
      if (!okR(r)) return;
      const n = Math.max(1, Math.floor(r.w / (ds * 6)));
      const cw = r.w / n;
      for (let i = 0; i < n; i++) {
        const c = { x: r.x + i * cw + ds * 0.4, y: r.y + ds * 0.4, w: cw - ds * 0.8, h: r.h - ds * 0.8 };
        if (c.w <= 0 || c.h <= 0) continue;
        L(rect(c), true);
        const m = inset(c, Math.min(c.w, c.h) * 0.22);
        if (m.w > 0 && m.h > 0) L(rect(m), true);
        for (let y = m.y + ds; y < m.y + m.h; y += ds * 1.5) L([[m.x, y], [m.x + m.w, y]], false);
      }
    };
    const dummy = (r, k) => {
      if (!okR(r)) return;
      const rr = mulberry32(seed * 11 + k * 5 + 9);
      const c = ds * 0.7, pitch = ds * 2.2;
      for (let x = r.x + pitch * 0.5; x < r.x + r.w - c; x += pitch) for (let y = r.y + pitch * 0.5; y < r.y + r.h - c; y += pitch) if (rr() < 0.7) L(rect({ x, y, w: c, h: c }), true);
    };
    /* vintage routing: wires walked on a grid, never crossing, a via square at each end */
    let routedObstacles = [];
    const routed = (r, k) => {
      if (!okR(r)) return;
      const rr = mulberry32(seed * 71 + k * 13 + 2);
      const cell = Math.max(traceW * 1.9, ds * 1.6);
      const nx = Math.floor(r.w / cell), ny = Math.floor(r.h / cell);
      if (nx < 2 || ny < 2) return;
      const ox = r.x + (r.w - nx * cell) / 2 + cell / 2, oy = r.y + (r.h - ny * cell) / 2 + cell / 2;
      const occ = new Uint8Array(nx * ny);
      /* islands (transistor cells) block the routing grid with a one-cell moat */
      for (const o of routedObstacles) {
        const gx0 = Math.floor((o.x - cell - ox) / cell + 0.5), gx1 = Math.ceil((o.x + o.w + cell - ox) / cell - 0.5);
        const gy0 = Math.floor((o.y - cell - oy) / cell + 0.5), gy1 = Math.ceil((o.y + o.h + cell - oy) / cell - 0.5);
        for (let gy = Math.max(0, gy0); gy <= Math.min(ny - 1, gy1); gy++) for (let gx = Math.max(0, gx0); gx <= Math.min(nx - 1, gx1); gx++) occ[gy * nx + gx] = 1;
      }
      const free = (x, y) => x >= 0 && y >= 0 && x < nx && y < ny && !occ[y * nx + x];
      const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const wires = Math.round(nx * ny * 0.22);
      for (let w = 0; w < wires; w++) {
        let x = Math.floor(rr() * nx), y = Math.floor(rr() * ny);
        if (!free(x, y)) continue;
        let d = Math.floor(rr() * 4);
        const pts = [[x, y]];
        occ[y * nx + x] = 1;
        const len = 3 + Math.floor(rr() * 12);
        for (let i = 0; i < len; i++) {
          if (rr() < 0.3) { const turn = rr() < 0.5 ? 1 : -1; d = d < 2 ? (2 + (turn > 0 ? 0 : 1)) : (turn > 0 ? 0 : 1); }
          let [dx, dy] = DIRS[d];
          if (!free(x + dx, y + dy)) {
            const alt = DIRS.map((v, j) => j).filter((j) => free(x + DIRS[j][0], y + DIRS[j][1]));
            if (!alt.length) break;
            d = alt[Math.floor(rr() * alt.length)]; [dx, dy] = DIRS[d];
          }
          x += dx; y += dy; occ[y * nx + x] = 1;
          const last = pts[pts.length - 1], prev = pts[pts.length - 2];
          if (prev && ((prev[0] === last[0] && last[0] === x) || (prev[1] === last[1] && last[1] === y))) pts[pts.length - 1] = [x, y]; else pts.push([x, y]);
        }
        if (pts.length < 2) continue;
        const mm = pts.map(([gx, gy]) => [ox + gx * cell, oy + gy * cell]);
        rod(mm, traceW);
        const v = Math.max(traceW * 0.9, ds * 0.8);
        for (const e of [mm[0], mm[mm.length - 1]]) L(rect({ x: e[0] - v / 2, y: e[1] - v / 2, w: v, h: v }), true);
      }
    };
    const FILL = { sram, logic, cap: capArray, comb, spiral, analog, io, dummy, routed };

    /* ---------------------------------------------------- floorplan */
    const gutters = [];    /* { x, y, w, h, depth } channel strips */
    const leaves = [];     /* { r, type, k } */
    let kCounter = 0;
    const split = (r, depth, maxDepth, rr, typer) => {
      const g = gut * Math.pow(0.7, depth);
      const minSide = ds * 10;
      if (depth >= maxDepth || Math.max(r.w, r.h) < minSide * 2.2 || rr() < 0.12 * depth) { leaves.push({ r, type: typer(r, depth, rr), k: kCounter++ }); return; }
      const vertical = r.w > r.h * 1.15 ? true : r.h > r.w * 1.15 ? false : rr() < 0.5;
      const t = 0.3 + rr() * 0.4;
      if (vertical) {
        const xs = r.x + r.w * t;
        gutters.push({ x: xs - g / 2, y: r.y, w: g, h: r.h, depth });
        split({ x: r.x, y: r.y, w: xs - g / 2 - r.x, h: r.h }, depth + 1, maxDepth, rr, typer);
        split({ x: xs + g / 2, y: r.y, w: r.x + r.w - xs - g / 2, h: r.h }, depth + 1, maxDepth, rr, typer);
      } else {
        const ys = r.y + r.h * t;
        gutters.push({ x: r.x, y: ys - g / 2, w: r.w, h: g, depth });
        split({ x: r.x, y: r.y, w: r.w, h: ys - g / 2 - r.y }, depth + 1, maxDepth, rr, typer);
        split({ x: r.x, y: ys + g / 2, w: r.w, h: r.y + r.h - ys - g / 2 }, depth + 1, maxDepth, rr, typer);
      }
    };
    const weighted = (table) => (r, depth, rr) => { let s = 0; for (const t of table) s += t[1]; let v = rr() * s; for (const t of table) { v -= t[1]; if (v <= 0) return t[0]; } return table[0][0]; };
    const cores = clamp(Math.round(Number(p.cores) || 1), 1, 8);
    const maxDepth = clamp(Math.round(Number(p.depth) || 4), 1, 6);

    /* a core: its own small floorplan, generated once and stamped (mirrored) into every core slot */
    const stampCore = (slot, template, mirrorX) => {
      const sx = slot.w / template.r.w, sy = slot.h / template.r.h;
      const T = (rr) => ({ x: slot.x + (mirrorX ? (template.r.x + template.r.w - (rr.x + rr.w)) : (rr.x - template.r.x)) * sx, y: slot.y + (rr.y - template.r.y) * sy, w: rr.w * sx, h: rr.h * sy });
      for (const lf of template.leaves) leaves.push({ r: T(lf.r), type: lf.type, k: lf.k });
      for (const gg of template.gutters) gutters.push({ ...T(gg), depth: gg.depth });
    };
    const makeTemplate = (r, typer, maxD) => {
      const savedL = leaves.length, savedG = gutters.length;
      const rr = mulberry32(seed * 101 + 77);
      split(r, 1, maxD, rr, typer);
      const t = { r, leaves: leaves.splice(savedL), gutters: gutters.splice(savedG) };
      return t;
    };

    if (style === "Processor") {
      const l2h = inner.h * 0.26, ioh = inner.h * 0.12;
      const l2 = { x: inner.x, y: inner.y, w: inner.w, h: l2h - gut / 2 };
      const ioStrip = { x: inner.x, y: inner.y + inner.h - ioh + gut / 2, w: inner.w, h: ioh - gut / 2 };
      const coreBand = { x: inner.x, y: inner.y + l2h + gut / 2, w: inner.w, h: inner.h - l2h - ioh - gut };
      gutters.push({ x: inner.x, y: inner.y + l2h - gut / 2, w: inner.w, h: gut, depth: 0 });
      gutters.push({ x: inner.x, y: inner.y + inner.h - ioh - gut / 2, w: inner.w, h: gut, depth: 0 });
      /* L2: banks of sram side by side with one analog/PLL block at the end */
      const nb = clamp(cores, 2, 6);
      const bw = (l2.w - gut * (nb - 1)) / nb;
      for (let i = 0; i < nb; i++) { const b = { x: l2.x + i * (bw + gut), y: l2.y, w: bw, h: l2.h }; leaves.push({ r: b, type: i === nb - 1 && nb > 2 ? "analog" : "sram", k: kCounter++ }); if (i < nb - 1) gutters.push({ x: b.x + b.w, y: l2.y, w: gut, h: l2.h, depth: 1 }); }
      /* cores */
      const cw = (coreBand.w - gut * (cores - 1)) / cores;
      const tmplRect = { x: 0, y: 0, w: cw, h: coreBand.h };
      const tmpl = makeTemplate(tmplRect, weighted([["logic", 5], ["sram", 3], ["comb", 1], ["cap", 1]]), 3);
      for (let i = 0; i < cores; i++) { const slot = { x: coreBand.x + i * (cw + gut), y: coreBand.y, w: cw, h: coreBand.h }; stampCore(slot, tmpl, p.mirror && i % 2 === 1); if (i < cores - 1) gutters.push({ x: slot.x + slot.w, y: coreBand.y, w: gut, h: coreBand.h, depth: 1 }); }
      /* IO strip: io cells with an analog block at one end */
      const aw = Math.min(ioStrip.w * 0.25, ioStrip.h * 2.5);
      leaves.push({ r: { x: ioStrip.x, y: ioStrip.y, w: aw - gut / 2, h: ioStrip.h }, type: "analog", k: kCounter++ });
      gutters.push({ x: ioStrip.x + aw - gut / 2, y: ioStrip.y, w: gut, h: ioStrip.h, depth: 1 });
      leaves.push({ r: { x: ioStrip.x + aw + gut / 2, y: ioStrip.y, w: ioStrip.w - aw - gut / 2, h: ioStrip.h }, type: "io", k: kCounter++ });
    } else if (style === "Memory") {
      const nb = cores;
      const ioh = inner.h * 0.1;
      const banks = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - ioh - gut / 2 };
      const cols = nb <= 2 ? nb : Math.ceil(Math.sqrt(nb)), rows = Math.ceil(nb / cols);
      const bw = (banks.w - gut * (cols - 1)) / cols, bh = (banks.h - gut * (rows - 1)) / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        if (j * cols + i >= nb) continue;
        const b = { x: banks.x + i * (bw + gut), y: banks.y + j * (bh + gut), w: bw, h: bh };
        /* each bank: array with a decoder strip along one edge */
        const decW = Math.min(b.w * 0.14, ds * 8);
        leaves.push({ r: { x: b.x, y: b.y, w: b.w - decW - gut * 0.4, h: b.h }, type: "sram", k: kCounter++ });
        leaves.push({ r: { x: b.x + b.w - decW, y: b.y, w: decW, h: b.h }, type: "logic", k: kCounter++ });
        if (i < cols - 1) gutters.push({ x: b.x + b.w, y: b.y, w: gut, h: b.h, depth: 1 });
        if (j < rows - 1) gutters.push({ x: b.x, y: b.y + b.h, w: b.w, h: gut, depth: 1 });
      }
      gutters.push({ x: inner.x, y: banks.y + banks.h, w: inner.w, h: gut, depth: 0 });
      leaves.push({ r: { x: inner.x, y: inner.y + inner.h - ioh + gut / 2, w: inner.w * 0.7, h: ioh - gut / 2 }, type: "io", k: kCounter++ });
      leaves.push({ r: { x: inner.x + inner.w * 0.7 + gut, y: inner.y + inner.h - ioh + gut / 2, w: inner.w * 0.3 - gut, h: ioh - gut / 2 }, type: "analog", k: kCounter++ });
    } else if (style === "FPGA") {
      const n = clamp(cores + 2, 3, 10);
      const g = gut * 0.8;
      const tw = (inner.w - g * (n - 1)) / n, th = (inner.h - g * (n - 1)) / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const t = { x: inner.x + i * (tw + g), y: inner.y + j * (th + g), w: tw, h: th };
        const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
        const type = edge ? "io" : ((i + j) % 4 === 0 ? "sram" : "logic");
        leaves.push({ r: t, type, k: kCounter++ });
        if (i < n - 1) gutters.push({ x: t.x + t.w, y: t.y, w: g, h: t.h, depth: 1 });
        if (j < n - 1) gutters.push({ x: t.x, y: t.y + t.h, w: t.w, h: g, depth: 1 });
      }
    } else if (style === "Vintage") {
      /* one routed die with a wide power ring and a couple of big analog cells */
      const ringW = Math.max(traceW * 1.6, ds * 2.2);
      const ring = inner;
      curPen = penFor("bus");
      rod([[ring.x, ring.y], [ring.x + ring.w, ring.y], [ring.x + ring.w, ring.y + ring.h], [ring.x, ring.y + ring.h], [ring.x, ring.y]], ringW);
      const core = inset(ring, ringW * 1.6);
      const rr = mulberry32(seed * 101 + 77);
      /* two or three big transistor cells as routed islands' neighbours */
      const nCells = 2 + Math.floor(rr() * 2);
      const cw = core.w / (nCells * 2.2);
      for (let i = 0; i < nCells; i++) { const cx = core.x + core.w * (0.2 + 0.6 * i / Math.max(1, nCells - 1)) - cw / 2, cy = core.y + core.h * (0.3 + rr() * 0.4) - cw / 2; leaves.push({ r: { x: cx, y: cy, w: cw, h: cw * 1.2 }, type: "comb", k: kCounter++ }); }
      routedObstacles = leaves.filter((l) => l.type === "comb").map((l) => l.r);
      leaves.push({ r: core, type: "routed", k: kCounter++ });
    } else if (style === "Analog") {
      split(inner, 0, Math.min(maxDepth, 3), mulberry32(seed * 101 + 77), weighted([["analog", 4], ["comb", 3], ["cap", 3], ["spiral", 2], ["routed", 2], ["logic", 1], ["io", 1]]));
      /* an analog die always has at least one inductor: give the largest block a spiral if none rolled */
      if (!leaves.some((l) => l.type === "spiral")) { let big = leaves[0]; for (const l of leaves) if (l.r.w * l.r.h > big.r.w * big.r.h) big = l; if (big) big.type = "spiral"; }
    } else {
      split(inner, 0, maxDepth, mulberry32(seed * 101 + 77), weighted([["logic", 4], ["sram", 4], ["analog", 2], ["routed", 2], ["cap", 1], ["io", 1], ["dummy", 1], ["comb", 1]]));
    }

    /* ------------------------------------------------------------ draw */
    /* routed blocks in Vintage are the background: draw them first so islands sit on top */
    leaves.sort((a, b) => (a.type === "routed" ? 0 : 1) - (b.type === "routed" ? 0 : 1));
    for (const lf of leaves) {
      if (lf.r.w <= 0 || lf.r.h <= 0) continue;
      curPen = penFor(lf.type);
      if (!(style === "Vintage" && lf.type === "routed")) L(rect(lf.r), true);
      blocks.push({ pts: rect(lf.r), closed: true, layer: curPen });
      const fn = FILL[lf.type] || dummy;
      fn(inset(lf.r, ds * 0.6), lf.k);
    }
    curPen = penFor("bus");
    if (p.buses) {
      for (const g of gutters) {
        const horizontal = g.w > g.h;
        const width = horizontal ? g.h : g.w;
        const pitch = ds * 0.5;
        const n = Math.max(1, Math.floor((width - pitch) / pitch));
        const off = (width - (n - 1) * pitch) / 2;
        for (let i = 0; i < n; i++) {
          if (horizontal) { const y = g.y + off + i * pitch; L([[g.x, y], [g.x + g.w, y]], false); }
          else { const x = g.x + off + i * pitch; L([[x, g.y], [x, g.y + g.h]], false); }
        }
      }
    }
    return [applyStyle({ paths: lines }, ins[0]), { paths: blocks }];
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      const aspect = Math.max(0.2, Number(p.aspect) || 1);
      let dw = Math.max(5, Number(p.size) || 150), dh = dw * aspect;
      const fit = Math.min(1, (W - 2 * m) / dw, (H - 2 * m) / dh);
      dw *= fit; dh *= fit;
      return [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }, { kind: "rect", x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh }];
    } catch (e) { return []; }
  },
};
