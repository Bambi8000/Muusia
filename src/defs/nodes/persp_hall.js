import { Pin, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  /* Perspective Hall - one-point perspective corridor built as a real 3D box
     (walls, floor, ceiling, optional far wall, stepped ledges and doorways),
     projected through a pinhole at the vanishing point and filled with hatch.
     Every plane keeps constant 3D spacing, so the hatch rushes toward the VP
     the way a ruled perspective does. Hand > 0 turns the laser lines into
     hand-drawn ones: wobble, spacing jitter, ragged ends and broken strokes.
     Occlusion is exact: ledges hide the wall and floor behind them, nearer
     ledges hide farther ones. */
  key: "persp_hall",
  name: "Perspective Hall",
  cat: "gen",
  group: "structural",
  desc: "One-point perspective corridor: walls, floor and ceiling (plus optional far wall, ledges and doorways) are a real 3D box projected from the vanishing point, and every plane is filled with hatch at constant 3D spacing so the lines rush toward the VP. Mode Grid rules every plane in both directions (the classic laser-line perspective grid); Mode Hatch lets each plane choose Across (lines at constant depth: vertical on walls, horizontal on floor/ceiling), Along (lines converging to the VP), Both or None. Gap sets the spacing in mm at the sheet edge, Min gap stops the hatch where it would clog. Ledges adds stepped blocks along both walls at a geometric Rhythm, with Doorways left white between them; blocks hide whatever is behind them. Hand 0 is ruler-straight; raise it for hand-drawn wobble, ragged ends and broken strokes. Walls = Sheet edges moves the eye off the corridor axis so the four corner lines run exactly into the frame corners - every wall stays on the sheet however far off-centre the VP is (Aspect is ignored); Aspect keeps a symmetric box seen from its axis. Far wall closes the tunnel into a room. Edges draws the construction lines with a second pen. Tip: VP off-centre plus Aspect wide gives a cinematic corridor; Grid mode with Hand 0 is the reference perspective, Hatch with Hand 0.6 the organic drawing.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 3 },
    { key: "mode", label: "Mode", type: "select", options: ["Hatch", "Grid"], def: "Hatch" },
    { key: "vpx", label: "VP X %", type: "slider", min: 5, max: 95, step: 0.5, def: 50 },
    { key: "vpy", label: "VP Y %", type: "slider", min: 5, max: 95, step: 0.5, def: 47 },
    { key: "walls", label: "Walls", type: "select", options: ["Aspect", "Sheet edges"], def: "Aspect" },
    { key: "aspect", label: "Aspect (w/h)", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1.2, showIf: (p) => p.walls !== "Sheet edges" },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 6 },
    { key: "gap", label: "Gap (mm)", type: "slider", min: 0.6, max: 10, step: 0.1, def: 2.2 },
    { key: "minGap", label: "Min gap (mm)", type: "slider", min: 0.2, max: 3, step: 0.05, def: 0.45 },
    { key: "wallDir", label: "Walls", type: "select", options: ["Across", "Along", "Both", "None"], def: "Across", showIf: (p) => p.mode !== "Grid" },
    { key: "floorDir", label: "Floor", type: "select", options: ["Across", "Along", "Both", "None"], def: "Across", showIf: (p) => p.mode !== "Grid" },
    { key: "ceilDir", label: "Ceiling", type: "select", options: ["Across", "Along", "Both", "None"], def: "Along", showIf: (p) => p.mode !== "Grid" },
    { key: "far", label: "Far wall %", type: "slider", min: 0, max: 60, step: 1, def: 0 },
    { key: "ledges", label: "Ledges", type: "slider", min: 0, max: 24, step: 1, def: 7 },
    { key: "rhythm", label: "Rhythm", type: "slider", min: 0.15, max: 1.5, step: 0.01, def: 0.55, showIf: (p) => p.ledges > 0 },
    { key: "ledgeH", label: "Ledge height %", type: "slider", min: 2, max: 45, step: 1, def: 13, showIf: (p) => p.ledges > 0 },
    { key: "ledgeD", label: "Ledge depth %", type: "slider", min: 2, max: 40, step: 1, def: 11, showIf: (p) => p.ledges > 0 },
    { key: "ledgeFill", label: "Ledge / bay", type: "slider", min: 0.15, max: 0.9, step: 0.01, def: 0.5, showIf: (p) => p.ledges > 0 },
    { key: "stagger", label: "Stagger sides", type: "check", def: false, showIf: (p) => p.ledges > 0 },
    { key: "doors", label: "Doorways", type: "check", def: true, showIf: (p) => p.ledges > 0 },
    { key: "doorH", label: "Door height %", type: "slider", min: 10, max: 95, step: 1, def: 42, showIf: (p) => p.ledges > 0 && p.doors },
    { key: "hand", label: "Hand", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "edges", label: "Edges", type: "check", def: false },
    { key: "edgePen", label: "Edge pen", type: "pen", def: 1, showIf: (p) => !!p.edges },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    /* same frame / VP / corner-ray math as compute, inlined */
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const x0 = mg, x1 = W - mg, y0 = mg, y1 = H - mg;
    const vpx = Math.max(x0 + 2, Math.min(x1 - 2, (W * (+p.vpx || 50)) / 100));
    const vpy = Math.max(y0 + 2, Math.min(y1 - 2, (H * (+p.vpy || 50)) / 100));
    const edges = p.walls === "Sheet edges";
    const hw = Math.max(0.05, +p.aspect || 1);
    const EX = edges ? [-(vpx - x0) / 100, (x1 - vpx) / 100] : [-hw, hw];
    const EY = edges ? [-(vpy - y0) / 100, (y1 - vpy) / 100] : [-1, 1];
    const out = [{ kind: "rect", x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, { kind: "point", x: vpx, y: vpy }];
    for (const dx of EX) for (const dy of EY) {
      let t = Infinity;
      if (dx > 0) t = Math.min(t, (x1 - vpx) / dx); else if (dx < 0) t = Math.min(t, (x0 - vpx) / dx);
      if (dy > 0) t = Math.min(t, (y1 - vpy) / dy); else if (dy < 0) t = Math.min(t, (y0 - vpy) / dy);
      if (!Number.isFinite(t)) continue;
      out.push({ kind: "poly", pts: [[vpx, vpy], [vpx + dx * t, vpy + dy * t]] });
    }
    return out;
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const x0 = mg, x1 = W - mg, y0 = mg, y1 = H - mg;
    const vpx = Math.max(x0 + 2, Math.min(x1 - 2, (W * (+p.vpx || 50)) / 100));
    const vpy = Math.max(y0 + 2, Math.min(y1 - 2, (H * (+p.vpy || 50)) / 100));
    const K = 100; /* focal scale: page = vp + XY * K / Z */
    /* corridor cross-section in 3D units, relative to the eye: Xl < 0 < Xr, Yt < 0 < Yb.
       Aspect: symmetric box, eye on its axis. Sheet edges: the eye sits off-axis so that the
       four corner lines run exactly into the frame corners - every wall stays on the sheet. */
    const sheetEdges = p.walls === "Sheet edges";
    const hw = Math.max(0.05, +p.aspect || 1);
    const Xl = sheetEdges ? -(vpx - x0) / K : -hw, Xr = sheetEdges ? (x1 - vpx) / K : hw;
    const Yt = sheetEdges ? -(vpy - y0) / K : -1, Yb = sheetEdges ? (y1 - vpy) / K : 1;
    const wid = Xr - Xl, hgt = Yb - Yt;
    const extMax = Math.max(-Xl, Xr, -Yt, Yb), extMin = Math.min(-Xl, Xr, -Yt, Yb);
    const gap = Math.max(0.2, +p.gap || 2);
    const minGap = Math.max(0.1, +p.minGap || 0.4);
    const grid = p.mode === "Grid";
    const hand = Math.max(0, Math.min(1, +p.hand || 0));
    const S = Math.round(+p.seed || 0);
    const pen = Math.max(0, Math.min(11, Math.round(+p.layer || 0)));
    const ePen = Math.max(0, Math.min(11, Math.round(+p.edgePen || 0)));
    const BUDGET = 112000;

    const px = (X, Y, Z) => [vpx + (X * K) / Z, vpy + (Y * K) / Z];

    /* near depth of each plane = where it crosses the frame edge */
    const ZnF = (Yb * K) / Math.max(1e-6, y1 - vpy);
    const ZnC = (-Yt * K) / Math.max(1e-6, vpy - y0);
    const ZnL = (-Xl * K) / Math.max(1e-6, vpx - x0);
    const ZnR = (Xr * K) / Math.max(1e-6, x1 - vpx);
    const planes = [[ZnF, Yb], [ZnC, -Yt], [ZnL, -Xl], [ZnR, Xr]];
    let Z0 = Infinity, e0 = Yb;
    for (const [z, e] of planes) if (z < Z0 - 1e-9 || (Math.abs(z - Z0) <= 1e-9 && e > e0)) { Z0 = z; e0 = e; }
    const farPct = Math.max(0, Math.min(90, +p.far || 0));
    const Zfar = farPct > 0 ? ((hgt / 2) * K) / Math.max(0.5, (H * farPct) / 200) : Infinity;
    /* constant 3D depth step so the nearest plane shows exactly `gap` at the frame edge */
    const dZ = (gap * Z0 * Z0) / (e0 * K);
    /* depth of the last useful line: the corridor opening is a few min gaps wide */
    const Zmax = Math.min(Zfar, (extMax * K) / (1.5 * minGap));
    const Zs = [];
    for (let k = 0; k < 6000; k++) { const z = Z0 + k * dZ; if (z >= Zmax) break; Zs.push(z); }
    const stochastic = hand > 0 && !grid;
    /* one reference extent for all four planes, so the density bands where lines are
       dropped sit at the same depth on walls, floor and ceiling whatever the Aspect -
       min() keeps every plane at or above Min gap */
    const eRef = Math.max(extMin, extMax / 2.5);
    /* one 3D spacing for all along-lines: a shared lattice, shared drop depth */
    const dAlong = (gap * Z0) / K;
    /* level of detail: as the projected spacing of lines at constant depth falls under
       Min gap, lines are dropped - every 2nd, 4th ... (ruled look) or at random with the
       matching survival rate (hand-drawn look). e = 3D distance of the plane from the eye axis. */
    const keepAcross = (k, e, z, id, eOwn) => {
      /* e = shared reference extent (bands line up); eOwn = the plane's real extent, a
         clog guard for planes much narrower than the reference (Sheet edges, VP far off-centre) */
      const sp = (e * K * dZ) / (z * z);
      const spOwn = eOwn === undefined ? sp : Math.min(sp, (eOwn * K * dZ) / (z * z));
      if (spOwn >= minGap) return true;
      if (stochastic) return hash2(k, id, S * 3 + 11) < spOwn / minGap;
      const stride = Math.pow(2, Math.ceil(Math.log2(minGap / spOwn)));
      return k % stride === 0;
    };
    /* along-lines: line j runs to depth zBase (where spacing hits Min gap), and 1/m of them
       survive to m * zBase */
    const alongEnd = (j, zBase, id) => {
      let m;
      if (stochastic) m = 1 / Math.max(1 / 4096, hash2(j, id, S * 5 + 3));
      else { m = 1; let q = j; while (q > 0 && (q & 1) === 0) { m *= 2; q >>= 1; } if (j === 0) m = 4096; }
      return Math.min(Zmax, zBase * m);
    };

    /* ---------- ledges (boxes) ---------- */
    const nL = Math.max(0, Math.min(40, Math.round(+p.ledges || 0)));
    const r = 1 + Math.max(0.05, +p.rhythm || 0.5);
    const lh = Math.max(0.02 * hgt, Math.min(0.95 * hgt, ((+p.ledgeH || 10) / 100) * hgt));
    const ld = Math.max(0.01 * wid, Math.min(0.9 * wid, ((+p.ledgeD || 10) / 100) * wid));
    const fill = Math.max(0.05, Math.min(0.95, +p.ledgeFill || 0.5));
    const doors = !!p.doors && nL > 0;
    const doorTop = Yb - Math.max(0.025 * hgt, Math.min(0.975 * hgt, ((+p.doorH || 40) / 100) * hgt));
    const boxes = []; /* {s, Za, Zb, hull, cx, cy, Zd0, Zd1} */
    for (const s of [-1, 1]) {
      const Zb0 = Math.max(Math.min(ZnL, ZnR) * 0.9, ZnF * 0.95) * (p.stagger && s > 0 ? Math.sqrt(r) : 1);
      for (let k = 0; k < nL; k++) {
        const Za = Zb0 * Math.pow(r, k);
        if (Za >= Zfar) break;
        const bay = Za * (r - 1);
        const Zb = Math.min(Za + bay * fill, Zfar);
        if ((lh * K) / Za < minGap * 2.5) break; /* too small to matter */
        const pts = [];
        const Xw = s > 0 ? Xr : Xl;
        for (const X of [Xw, Xw - s * ld]) for (const Y of [Yb - lh, Yb]) for (const Z of [Za, Zb]) pts.push(px(X, Y, Z));
        const gZ0 = Zb, gZ1 = Za + bay, gL = gZ1 - gZ0;
        boxes.push({ s, Za, Zb, hull: convexHull(pts), Zd0: gZ0 + gL * 0.22, Zd1: gZ1 - gL * 0.22, hasDoor: doors && gZ1 < Zfar });
      }
    }
    for (const b of boxes) { let cx = 0, cy = 0; for (const q of b.hull) { cx += q[0]; cy += q[1]; } b.cx = cx / b.hull.length; b.cy = cy / b.hull.length; }

    function convexHull(P) {
      const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const q of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
      for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
      lo.pop(); up.pop();
      return lo.concat(up);
    }

    /* ---------- items: straight 3D segments with depth at both ends ---------- */
    /* item = { a:[x,y], b:[x,y], za, zb, owner, wall(s or 0), ya, yb (3D Y for wall door test), pen } */
    const items = [];
    const seg = (A, B, owner, extra, penId) => {
      const a = px(A[0], A[1], A[2]), b = px(B[0], B[1], B[2]);
      if (!Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) return;
      items.push({ a, b, za: A[2], zb: B[2], owner, wall: 0, ya: A[1], yb: B[1], pen: penId === undefined ? pen : penId, ...extra });
    };

    const dirOf = (sel) => (grid ? "Both" : sel);
    const across = (d) => d === "Across" || d === "Both";
    const along = (d) => d === "Along" || d === "Both";
    const wD = dirOf(p.wallDir), fD = dirOf(p.floorDir), cD = dirOf(p.ceilDir);

    /* floor & ceiling */
    for (const [Y, Zn, d, id] of [[Yb, ZnF, fD, 1], [Yt, ZnC, cD, 2]]) {
      if (d === "None") continue;
      if (across(d)) Zs.forEach((z, k) => { if (keepAcross(k, eRef, z, id, Math.abs(Y))) seg([Xl, Y, z], [Xr, Y, z], -1, {}); });
      if (along(d)) {
        const dX = dAlong;
        const n = Math.min(700, Math.floor(wid / dX));
        const zBase = Math.min(Zmax, (dX * K) / minGap);
        const zs = Zn * 0.6;
        for (let j = 0; j <= n; j++) { const ze = alongEnd(j, zBase, id); if (ze > zs) seg([Xl + j * dX, Y, zs], [Xl + j * dX, Y, ze], -1, {}); }
      }
    }
    /* walls */
    for (const [s, Zn, id] of [[-1, ZnL, 3], [1, ZnR, 4]]) {
      if (wD === "None") continue;
      const X = s > 0 ? Xr : Xl;
      if (across(wD)) Zs.forEach((z, k) => { if (keepAcross(k, eRef, z, id, Math.abs(X))) seg([X, Yt, z], [X, Yb, z], -1, { wall: s }); });
      if (along(wD)) {
        const dY = dAlong;
        const n = Math.min(700, Math.floor(hgt / dY));
        const zBase = Math.min(Zmax, (dY * K) / minGap);
        const zs = Zn * 0.6;
        for (let j = 0; j <= n; j++) { const ze = alongEnd(j, zBase, id); if (ze > zs) seg([X, Yt + j * dY, zs], [X, Yt + j * dY, ze], -1, { wall: s }); }
      }
    }
    /* far wall: page-space hatch */
    if (Number.isFinite(Zfar)) {
      const g = Math.max(minGap, (gap * Z0) / Zfar);
      const dY = (g * Zfar) / K;
      const n = Math.min(900, Math.floor(hgt / dY));
      for (let j = 0; j <= n; j++) { const Y = Yt + j * dY; seg([Xl, Y, Zfar], [Xr, Y, Zfar], -1, {}); }
      if (grid) { const m = Math.min(900, Math.floor(wid / dY)); for (let j = 0; j <= m; j++) { const X = Xl + j * dY; seg([X, Yt, Zfar], [X, Yb, Zfar], -1, {}); } }
    }
    /* boxes: top, inner, front faces */
    boxes.forEach((b, bi) => {
      const s = b.s, Xw = s > 0 ? Xr : Xl, Xi = Xw - s * ld, Yt2 = Yb - lh, Yf = Yb;
      Zs.forEach((z, k) => {
        if (z <= b.Za || z >= b.Zb) return;
        if (Yt2 > 0 && keepAcross(k, Yt2, z, 5 + bi)) seg([Xw, Yt2, z], [Xi, Yt2, z], bi, {}); /* top, seen from above */
        if (keepAcross(k, Math.abs(Xi), z, 45 + bi)) seg([Xi, Yt2, z], [Xi, Yf, z], bi, {}); /* inner face */
      });
      const g = Math.max(minGap, (gap * Z0) / b.Za);
      const dY = (g * b.Za) / K;
      const n = Math.min(400, Math.floor(lh / dY));
      for (let j = 1; j < n; j++) { const Y = Yt2 + j * dY; seg([Xw, Y, b.Za], [Xi, Y, b.Za], bi, {}); } /* front face */
      if (grid) { const m = Math.min(400, Math.floor(ld / dY)); for (let j = 1; j < m; j++) { const X = Xw - s * j * dY; seg([X, Yt2, b.Za], [X, Yf, b.Za], bi, {}); } }
      if (grid && Yt2 > 0) { const m = Math.min(400, Math.floor(ld / dY)); for (let j = 1; j < m; j++) { const X = Xw - s * j * dY; seg([X, Yt2, b.Za], [X, Yt2, b.Zb], bi, {}); } }
      if (grid) for (let j = 1; j < n; j++) { const Y = Yt2 + j * dY; seg([Xi, Y, b.Za], [Xi, Y, b.Zb], bi, {}); } /* inner face along */
    });
    /* edges */
    if (p.edges) {
      const zeAll = Zmax;
      for (const cx of [Xl, Xr]) for (const cy of [Yt, Yb]) seg([cx, cy, Z0 * 0.5], [cx, cy, zeAll], -1, {}, ePen);
      if (Number.isFinite(Zfar)) { const C = [[Xl, Yt], [Xr, Yt], [Xr, Yb], [Xl, Yb]]; for (let i = 0; i < 4; i++) seg([C[i][0], C[i][1], Zfar], [C[(i + 1) % 4][0], C[(i + 1) % 4][1], Zfar], -1, {}, ePen); }
      boxes.forEach((b, bi) => {
        const s = b.s, Xw = s > 0 ? Xr : Xl, Xi = Xw - s * ld, Yt2 = Yb - lh, Yf = Yb;
        seg([Xw, Yt2, b.Za], [Xw, Yt2, b.Zb], bi, {}, ePen); seg([Xi, Yt2, b.Za], [Xi, Yt2, b.Zb], bi, {}, ePen);
        seg([Xw, Yt2, b.Za], [Xi, Yt2, b.Za], bi, {}, ePen); seg([Xw, Yt2, b.Zb], [Xi, Yt2, b.Zb], bi, {}, ePen);
        seg([Xi, Yf, b.Za], [Xi, Yf, b.Zb], bi, {}, ePen); seg([Xi, Yt2, b.Za], [Xi, Yf, b.Za], bi, {}, ePen); seg([Xi, Yt2, b.Zb], [Xi, Yf, b.Zb], bi, {}, ePen);
        seg([Xw, Yf, b.Za], [Xi, Yf, b.Za], bi, {}, ePen); seg([Xw, Yt2, b.Za], [Xw, Yf, b.Za], bi, {}, ePen);
        if (b.hasDoor) {
          seg([Xw, doorTop, b.Zd0], [Xw, doorTop, b.Zd1], -1, {}, ePen);
          seg([Xw, doorTop, b.Zd0], [Xw, Yb, b.Zd0], -1, {}, ePen); seg([Xw, doorTop, b.Zd1], [Xw, Yb, b.Zd1], -1, {}, ePen);
        }
      });
    }

    /* ---------- visibility: t-interval arithmetic on each straight item ---------- */
    /* 1/Z is linear along a projected segment */
    const tOfZ = (it, z) => { const ia = 1 / it.za, ib = 1 / it.zb; if (Math.abs(ib - ia) < 1e-12) return null; return (1 / z - ia) / (ib - ia); };
    const zAtT = (it, t) => 1 / (1 / it.za + t * (1 / it.zb - 1 / it.za));
    const subtract = (iv, u0, u1) => { /* remove [u0,u1] from interval list */
      if (u1 <= u0) return iv;
      const out = [];
      for (const [a, b] of iv) {
        if (u1 <= a || u0 >= b) { out.push([a, b]); continue; }
        if (u0 > a) out.push([a, u0]);
        if (u1 < b) out.push([u1, b]);
      }
      return out;
    };
    const zRange = (it, z) => { /* t-interval where Z > z (or null) */
      const t = tOfZ(it, z);
      if (t === null) return it.za > z ? [0, 1] : null;
      const inc = it.zb > it.za;
      const lo = inc ? Math.max(0, t) : 0, hi = inc ? 1 : Math.min(1, t);
      return hi > lo ? [lo, hi] : null;
    };
    const insideConvex = (P, Q, poly, cx, cy) => { /* Cyrus-Beck: t-interval of PQ inside poly */
      let t0 = 0, t1 = 1;
      const dx = Q[0] - P[0], dy = Q[1] - P[1];
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length];
        let nx = -(B[1] - A[1]), ny = B[0] - A[0];
        if (nx * (cx - A[0]) + ny * (cy - A[1]) < 0) { nx = -nx; ny = -ny; }
        const num = nx * (A[0] - P[0]) + ny * (A[1] - P[1]);
        const den = nx * dx + ny * dy;
        if (Math.abs(den) < 1e-12) { if (num > 0) return null; continue; }
        const t = num / den;
        if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
        if (t0 >= t1) return null;
      }
      return [t0, t1];
    };

    const pieces = []; /* { a, b, pen, id } straight page segments after visibility */
    let lineId = 0;
    for (const it of items) {
      let iv = [[0, 1]];
      /* doorways: wall items lose the part below door top inside a door's depth range */
      if (doors && it.wall !== 0) {
        for (const b of boxes) {
          if (b.s !== it.wall || !b.hasDoor) continue;
          const zr = zRange(it, b.Zd0); if (!zr) continue;
          const zr2 = zRange(it, b.Zd1); /* part beyond the door */
          let lo = zr[0], hi = zr[1];
          if (zr2) { if (it.zb > it.za) hi = Math.min(hi, zr2[0]); else lo = Math.max(lo, zr2[1]); }
          if (hi <= lo) continue;
          /* Y below door top: Y linear in t only for constant-Z lines; along lines have constant Y */
          if (Math.abs(it.za - it.zb) < 1e-9) {
            const ta = (doorTop - it.ya) / (it.yb - it.ya || 1e-9);
            const y0t = it.ya < it.yb ? Math.max(0, ta) : 0, y1t = it.ya < it.yb ? 1 : Math.min(1, ta);
            lo = Math.max(lo, y0t); hi = Math.min(hi, y1t);
          } else if (it.ya <= doorTop) continue;
          if (hi > lo) iv = subtract(iv, lo, hi);
        }
      }
      /* occlusion by nearer boxes */
      for (let bi = 0; bi < boxes.length && iv.length; bi++) {
        if (bi === it.owner) continue;
        const b = boxes[bi];
        if (Math.max(it.za, it.zb) <= b.Za) continue;
        const zr = zRange(it, b.Za); if (!zr) continue;
        const ci = insideConvex(it.a, it.b, b.hull, b.cx, b.cy); if (!ci) continue;
        const lo = Math.max(zr[0], ci[0]), hi = Math.min(zr[1], ci[1]);
        if (hi > lo) iv = subtract(iv, lo, hi);
      }
      for (const [t0, t1] of iv) {
        const a = [it.a[0] + (it.b[0] - it.a[0]) * t0, it.a[1] + (it.b[1] - it.a[1]) * t0];
        const b = [it.a[0] + (it.b[0] - it.a[0]) * t1, it.a[1] + (it.b[1] - it.a[1]) * t1];
        pieces.push({ a, b, pen: it.pen, id: lineId });
      }
      lineId++;
    }

    /* ---------- hand-drawn pass + frame clip ---------- */
    const clipRect = (pts) => { /* Liang-Barsky per segment, splits at exits */
      const out = []; let cur = [];
      const inside = (q) => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
      for (let i = 0; i + 1 < pts.length; i++) {
        const P = pts[i], Q = pts[i + 1];
        let t0 = 0, t1 = 1;
        const dx = Q[0] - P[0], dy = Q[1] - P[1];
        const clipE = (pp, qq) => { if (pp === 0) return qq >= 0; const t = qq / pp; if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
        const okS = clipE(-dx, P[0] - x0) && clipE(dx, x1 - P[0]) && clipE(-dy, P[1] - y0) && clipE(dy, y1 - P[1]);
        if (!okS) { if (cur.length >= 2) out.push(cur); cur = []; continue; }
        const A = [P[0] + dx * t0, P[1] + dy * t0], B = [P[0] + dx * t1, P[1] + dy * t1];
        if (cur.length === 0 || t0 > 0) { if (cur.length >= 2) out.push(cur); cur = [A]; }
        cur.push(B);
        if (t1 < 1 || !inside(Q)) { if (cur.length >= 2) out.push(cur); cur = []; }
      }
      if (cur.length >= 2) out.push(cur);
      return out;
    };

    const paths = [];
    let total = 0;
    const emit = (pts, penId) => {
      for (const c of clipRect(pts)) {
        if (total + c.length > BUDGET) return false;
        paths.push({ pts: c, closed: false, layer: penId }); total += c.length;
      }
      return true;
    };
    const fbm = (x, y, sd) => noise2(x, y, sd) * 0.65 + noise2(x * 2.1 + 7.3, y * 2.1, sd + 31) * 0.35;

    outer: for (const pc of pieces) {
      const dx = pc.b[0] - pc.a[0], dy = pc.b[1] - pc.a[1];
      const L = Math.hypot(dx, dy);
      if (L < 0.25) continue;
      if (hand <= 0) { if (!emit([pc.a, pc.b], pc.pen)) break; continue; }
      const rng = mulberry32(S * 7919 + pc.id * 613 + 17);
      if (rng() < hand * 0.04) continue; /* the occasional missed stroke */
      const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      /* whole-line drift across the hatch direction */
      const drift = (rng() - 0.5) * hand * Math.min(gap, 2) * 0.28;
      /* ragged ends: overshoot or fall short */
      const e0 = (rng() - 0.5) * 2 * hand * Math.min(3, 0.12 * L);
      const e1 = (rng() - 0.5) * 2 * hand * Math.min(3, 0.12 * L);
      const s0 = -e0, s1 = L + e1;
      if (s1 - s0 < 0.25) continue;
      const bow = (rng() - 0.5) * 2 * hand * Math.min(1.2, L * 0.012);
      const amp = hand * 0.45;
      const off = rng() * 1000;
      const breakAt = L > 12 && rng() < hand * 0.35 ? s0 + (s1 - s0) * (0.3 + rng() * 0.4) : -1;
      const gapB = 0.8 + rng() * 1.2;
      const ranges = breakAt > 0 ? [[s0, breakAt - gapB / 2], [breakAt + gapB / 2, s1]] : [[s0, s1]];
      for (const [q0, q1] of ranges) {
        const len = q1 - q0;
        if (len < 0.25) continue;
        const n = Math.max(1, Math.ceil(len / 2));
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const sPos = q0 + (len * i) / n;
          const t = (sPos - s0) / (s1 - s0);
          const w = drift + bow * Math.sin(Math.PI * t) + amp * (fbm(sPos * 0.045 + off, pc.id * 0.37, S) * 2 - 1);
          pts.push([pc.a[0] + ux * sPos + nx * w, pc.a[1] + uy * sPos + ny * w]);
        }
        if (!emit(pts, pc.pen)) break outer;
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
