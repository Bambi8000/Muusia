import { Pin, applyStyle, signedArea } from "../helpers.js";

export default {
  /* Photo Trace — photograph an object lying on a printed Muusia marker
     sheet (public/markers/muusia-markers-a4.png / -a3.png, printed at 100%),
     upload the photo, and the node recovers the object's outline at true
     physical size and position: 3 solid + 1 donut (anchor) 15 mm markers,
     centers 20 mm from the sheet corners, fix a 4-point homography from
     photo pixels to sheet millimetres. The largest dark blob inside the
     marker rectangle is contour-traced, simplified, smoothed, offset by
     Grow, and emitted as one closed path. Wire it into Wind Tunnel's
     Obstacle, plot, then glue the object into the blank spot. */
  key: "photo_trace",
  name: "Photo Trace",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  imageMax: 1200,
  desc: "Recovers a real object's outline at true physical size and position from a photo. Print the Muusia marker sheet (A4/A3 PNG in the repo's public/markers, at 100% scale - the bar must measure 100.0 mm), lay the object on it, photograph it from above and load the photo. The node finds the four 15 mm corner markers (the hollow one is the orientation anchor, so any camera rotation works), solves the perspective from photo pixels to sheet millimetres, and traces the largest dark shape inside the markers into one closed path. Threshold sets the dark cutoff (Invert for light objects on dark sheets), Simplify and Smooth clean the contour, Grow offsets it outward in mm for glue clearance (negative shrinks). Rotate matches how the printed sheet lies on the plotter bed; As photographed keeps the outline exactly where the object lay so the plot leaves a matching blank spot - glue the object back in after plotting. Chain into Wind Tunnel's Obstacle. The camera should be as overhead as possible: the sheet plane is corrected, but object height adds a small safe-side parallax.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "file", label: "Photo (PNG/JPG)", type: "file", def: "" },
    { key: "sheet", label: "Marker sheet", type: "select", options: ["A4", "A3"], def: "A4" },
    { key: "rot", label: "Rotate", type: "select", options: ["0\u00b0", "90\u00b0 CW", "180\u00b0", "90\u00b0 CCW"], def: "0\u00b0" },
    { key: "thr", label: "Threshold", type: "slider", min: 0.1, max: 0.9, step: 0.01, def: 0.45 },
    { key: "invert", label: "Invert", type: "check", def: false },
    { key: "minarea", label: "Min object mm\u00b2", type: "slider", min: 10, max: 2000, step: 10, def: 100 },
    { key: "simplify", label: "Simplify mm", type: "slider", min: 0.1, max: 3, step: 0.1, def: 0.6 },
    { key: "smooth", label: "Smooth passes", type: "slider", min: 0, max: 3, step: 1, def: 1 },
    { key: "grow", label: "Grow mm", type: "slider", min: -5, max: 10, step: 0.5, def: 2 },
    { key: "place", label: "Placement", type: "select", options: ["As photographed", "Centered"], def: "As photographed" },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p) {
    const S = p.sheet === "A3" ? [297, 420] : [210, 297];
    const M = 20, MS = 15;
    const corners = [[M, M], [S[0] - M, M], [S[0] - M, S[1] - M], [M, S[1] - M]];
    const rotPt = (q) => {
      if (p.rot === "90\u00b0 CW") return [S[1] - q[1], q[0]];
      if (p.rot === "180\u00b0") return [S[0] - q[0], S[1] - q[1]];
      if (p.rot === "90\u00b0 CCW") return [q[1], S[0] - q[0]];
      return [q[0], q[1]];
    };
    const g = [{ kind: "poly", pts: corners.map(rotPt) }];
    for (const c of corners) {
      const r = rotPt(c);
      g.push({ kind: "rect", x: r[0] - MS / 2, y: r[1] - MS / 2, w: MS, h: MS });
    }
    return g;
  },
  compute(ins, p, ctx, node) {
    const img = node && node.data && node.data.img;
    const st = ins[0];
    if (!img || !img.g || img.w < 8 || img.h < 8) return applyStyle({ paths: [] }, st);
    const { w, h, g } = img;
    const S = p.sheet === "A3" ? [297, 420] : [210, 297];
    const M = 20, MS = 15;

    /* ---- 1. binary mask ---- */
    const thr = Math.min(0.95, Math.max(0.05, p.thr));
    const dark = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const d = p.invert ? 1 - g[i] : g[i];
      dark[i] = d > thr ? 1 : 0;
    }

    /* ---- 2. connected components (8-conn, iterative) ---- */
    const label = new Int32Array(w * h);
    const blobs = []; /* {area, x0,y0,x1,y1, sx,sy, border} per label (1-based) */
    const stack = new Int32Array(w * h);
    for (let start = 0; start < w * h; start++) {
      if (!dark[start] || label[start]) continue;
      const id = blobs.length + 1;
      const b = { area: 0, x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0, border: false };
      let sp = 0;
      stack[sp++] = start; label[start] = id;
      while (sp > 0) {
        const i = stack[--sp];
        const x = i % w, y = (i / w) | 0;
        b.area++; b.sx += x; b.sy += y;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
        if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) b.border = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (dark[ni] && !label[ni]) { label[ni] = id; stack[sp++] = ni; }
        }
      }
      blobs.push(b);
    }
    if (blobs.length < 5) return applyStyle({ paths: [] }, st);

    /* ---- 3. marker pick: per image corner the nearest compact non-border blob ---- */
    const cand = [];
    for (let bi = 0; bi < blobs.length; bi++) {
      const b = blobs[bi];
      if (b.border) continue;
      if (b.area < 20 || b.area > 0.2 * w * h) continue;
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      const ar = bw / bh;
      if (ar < 0.35 || ar > 2.9) continue;
      if (b.area / (bw * bh) < 0.3) continue;
      cand.push({ bi, cx: b.sx / b.area, cy: b.sy / b.area });
    }
    if (cand.length < 4) return applyStyle({ paths: [] }, st);
    const imgCorners = [[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]];
    const mk = [];
    const used = new Set();
    for (const c of imgCorners) {
      let best = null, bd = Infinity;
      for (const q of cand) {
        if (used.has(q.bi)) continue;
        const dd = (q.cx - c[0]) * (q.cx - c[0]) + (q.cy - c[1]) * (q.cy - c[1]);
        if (dd < bd) { bd = dd; best = q; }
      }
      if (!best) return applyStyle({ paths: [] }, st);
      used.add(best.bi);
      mk.push(best);
    }

    /* ---- 4. anchor = the marker with a hole (donut): light fraction in bbox core ---- */
    let anchor = 0, bestHole = -1;
    for (let k = 0; k < 4; k++) {
      const b = blobs[mk[k].bi];
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      const cx0 = b.x0 + Math.round(bw * 0.3), cx1 = b.x0 + Math.round(bw * 0.7);
      const cy0 = b.y0 + Math.round(bh * 0.3), cy1 = b.y0 + Math.round(bh * 0.7);
      let n = 0, light = 0;
      for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
        n++; if (!dark[y * w + x]) light++;
      }
      const f = n > 0 ? light / n : 0;
      if (f > bestHole) { bestHole = f; anchor = k; }
    }
    if (bestHole < 0.15) return applyStyle({ paths: [] }, st);

    /* ---- 5. cyclic order (clockwise on screen = ascending atan2 in y-down coords),
            rotated so anchor first; corresponds to sheet TL,TR,BR,BL ---- */
    let gx = 0, gy = 0;
    for (const q of mk) { gx += q.cx / 4; gy += q.cy / 4; }
    const order = [0, 1, 2, 3].sort((a, b2) =>
      Math.atan2(mk[a].cy - gy, mk[a].cx - gx) - Math.atan2(mk[b2].cy - gy, mk[b2].cx - gx));
    const ai = order.indexOf(anchor);
    const cyc = [0, 1, 2, 3].map((k) => mk[order[(ai + k) % 4]]);
    const sheetPts = [[M, M], [S[0] - M, M], [S[0] - M, S[1] - M], [M, S[1] - M]];

    /* ---- 6. homography px -> mm (4-point DLT, h33 = 1, Gaussian elimination) ---- */
    const A = [];
    for (let k = 0; k < 4; k++) {
      const [x, y] = [cyc[k].cx, cyc[k].cy];
      const [u, v] = sheetPts[k];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (let col = 0; col < 8; col++) {
      let piv = col;
      for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      if (Math.abs(A[piv][col]) < 1e-12) return applyStyle({ paths: [] }, st);
      const t = A[piv]; A[piv] = A[col]; A[col] = t;
      for (let r = 0; r < 8; r++) {
        if (r === col) continue;
        const f = A[r][col] / A[col][col];
        for (let c = col; c < 9; c++) A[r][c] -= f * A[col][c];
      }
    }
    const Hm = [];
    for (let r = 0; r < 8; r++) Hm.push(A[r][8] / A[r][r]);
    Hm.push(1);
    const mapPx = (x, y) => {
      const d = Hm[6] * x + Hm[7] * y + 1;
      return [(Hm[0] * x + Hm[1] * y + Hm[2]) / d, (Hm[3] * x + Hm[4] * y + Hm[5]) / d];
    };

    /* ---- 7. object = largest non-marker blob whose centroid maps inside the
            marker rectangle (inset past the markers), area >= minarea mm^2 ---- */
    const inX0 = M + MS / 2 + 3, inX1 = S[0] - M - MS / 2 - 3;
    const inY0 = M + MS / 2 + 3, inY1 = S[1] - M - MS / 2 - 3;
    let obj = -1, objArea = 0;
    for (let bi = 0; bi < blobs.length; bi++) {
      if (used.has(bi)) continue;
      const b = blobs[bi];
      if (b.border || b.area < 12) continue;
      const c0 = mapPx(b.sx / b.area, b.sy / b.area);
      if (c0[0] < inX0 || c0[0] > inX1 || c0[1] < inY0 || c0[1] > inY1) continue;
      const e = 2;
      const p0 = mapPx(b.sx / b.area - e, b.sy / b.area);
      const p1 = mapPx(b.sx / b.area + e, b.sy / b.area);
      const p2 = mapPx(b.sx / b.area, b.sy / b.area - e);
      const p3 = mapPx(b.sx / b.area, b.sy / b.area + e);
      const sx2 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / (2 * e);
      const sy2 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) / (2 * e);
      const areaMm = b.area * sx2 * sy2;
      if (areaMm < p.minarea) continue;
      if (areaMm > objArea) { objArea = areaMm; obj = bi; }
    }
    if (obj < 0) return applyStyle({ paths: [] }, st);
    const objId = obj + 1;

    /* ---- 8. Moore-neighbour boundary trace of the object blob ---- */
    const b = blobs[obj];
    let sx0 = -1, sy0 = -1;
    outer: for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (label[y * w + x] === objId) { sx0 = x; sy0 = y; break outer; }
    }
    const isObj = (x, y) => x >= 0 && y >= 0 && x < w && y < h && label[y * w + x] === objId;
    const NB = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const contour = [];
    let cx = sx0, cy = sy0, dir = 6; /* entered from above */
    const maxSteps = Math.min(200000, 8 * (w + h) * 4 + 4000);
    for (let step = 0; step < maxSteps; step++) {
      contour.push([cx, cy]);
      let found = false;
      for (let k = 0; k < 8; k++) {
        const nd = (dir + 6 + k) % 8; /* start search from backtrack+1 (CW) */
        const nx = cx + NB[nd][0], ny = cy + NB[nd][1];
        if (isObj(nx, ny)) { cx = nx; cy = ny; dir = nd; found = true; break; }
      }
      if (!found) break; /* single-pixel blob */
      if (cx === sx0 && cy === sy0 && contour.length > 2) break;
    }
    if (contour.length < 3) return applyStyle({ paths: [] }, st);

    /* ---- 9. px -> mm, simplify (RDP, closed via two-way split), smooth, grow ---- */
    let pts = contour.map((q) => mapPx(q[0] + 0.5, q[1] + 0.5));
    const tol = Math.max(0.05, p.simplify);
    const rdp = (arr, i0, i1, keep) => {
      if (i1 - i0 < 2) return;
      const ax = arr[i0][0], ay = arr[i0][1], bx = arr[i1][0], by = arr[i1][1];
      const dx = bx - ax, dy = by - ay;
      const L2 = dx * dx + dy * dy;
      let bi2 = -1, bd2 = tol * tol;
      for (let i = i0 + 1; i < i1; i++) {
        let t = L2 > 0 ? ((arr[i][0] - ax) * dx + (arr[i][1] - ay) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px2 = ax + dx * t, py2 = ay + dy * t;
        const dd = (arr[i][0] - px2) * (arr[i][0] - px2) + (arr[i][1] - py2) * (arr[i][1] - py2);
        if (dd > bd2) { bd2 = dd; bi2 = i; }
      }
      if (bi2 > 0) { rdp(arr, i0, bi2, keep); keep.add(bi2); rdp(arr, bi2, i1, keep); }
    };
    {
      let far = 0, fd = -1;
      for (let i = 1; i < pts.length; i++) {
        const dd = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
        if (dd > fd) { fd = dd; far = i; }
      }
      const keep = new Set([0, far]);
      rdp(pts, 0, far, keep);
      const arr2 = [...pts.slice(far), pts[0]];
      const keep2 = new Set([0, arr2.length - 1]);
      rdp(arr2, 0, arr2.length - 1, keep2);
      const out = [];
      for (let i = 0; i <= far; i++) if (keep.has(i)) out.push(pts[i]);
      for (let i = 1; i < arr2.length - 1; i++) if (keep2.has(i)) out.push(arr2[i]);
      pts = out;
    }
    const passes = Math.max(0, Math.min(3, Math.round(p.smooth)));
    for (let pass = 0; pass < passes && pts.length >= 3; pass++) {
      const nx = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length];
        nx.push([a[0] * 0.75 + c[0] * 0.25, a[1] * 0.75 + c[1] * 0.25]);
        nx.push([a[0] * 0.25 + c[0] * 0.75, a[1] * 0.25 + c[1] * 0.75]);
      }
      pts = nx;
    }
    if (Math.abs(p.grow) > 1e-6 && pts.length >= 3) {
      const sgn = signedArea(pts) > 0 ? 1 : -1;
      const grown = [];
      for (let i = 0; i < pts.length; i++) {
        const pr = pts[(i - 1 + pts.length) % pts.length];
        const nx2 = pts[(i + 1) % pts.length];
        let ex = nx2[0] - pr[0], ey = nx2[1] - pr[1];
        const L = Math.hypot(ex, ey) || 1;
        ex /= L; ey /= L;
        grown.push([pts[i][0] + sgn * ey * p.grow, pts[i][1] - sgn * ex * p.grow]);
      }
      pts = grown;
    }

    /* ---- 10. sheet frame -> canvas frame (rotation), placement ---- */
    const rotPt = (q) => {
      if (p.rot === "90\u00b0 CW") return [S[1] - q[1], q[0]];
      if (p.rot === "180\u00b0") return [S[0] - q[0], S[1] - q[1]];
      if (p.rot === "90\u00b0 CCW") return [q[1], S[0] - q[0]];
      return [q[0], q[1]];
    };
    pts = pts.map(rotPt);
    if (p.place === "Centered") {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of pts) {
        if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
        if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
      }
      const ddx = ctx.W / 2 - (x0 + x1) / 2, ddy = ctx.H / 2 - (y0 + y1) / 2;
      pts = pts.map((q) => [q[0] + ddx, q[1] + ddy]);
    }
    return applyStyle({ paths: [{ pts, closed: true, layer: Math.round(p.layer) }] }, st);
  },
};
