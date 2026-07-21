import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "mathknot",
  name: "Knot",
  cat: "gen",
  group: "geometric",
  desc: "A torus knot p·q drawn flat with real over/under crossings: at every planar self-intersection the strand that passes underneath is cut with a gap, so the knot reads as woven. p and q set the winding frequencies (coprime values give true knots), Tube the torus thickness.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "fp", label: "p (freq 1)", type: "slider", min: 1, max: 12, step: 1, def: 2 },
    { key: "fq", label: "q (freq 2)", type: "slider", min: 1, max: 12, step: 1, def: 3 },
    { key: "tube", label: "Tube", type: "slider", min: 0.1, max: 0.9, step: 0.05, def: 0.5 },
    { key: "gap", label: "Crossing gap mm", type: "slider", min: 0, max: 8, step: 0.1, def: 2.2 },
    { key: "step", label: "Sample step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
    { key: "rot", label: "Rotate °", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const m = Math.max(0, p.margin);
    const availW = W - 2 * m, availH = H - 2 * m;
    if (availW < 10 || availH < 10) return applyStyle({ paths: [] }, ins[0]);

    const fp = Math.max(1, Math.min(12, Math.round(p.fp)));
    const fq = Math.max(1, Math.min(12, Math.round(p.fq)));
    const tube = Math.max(0.05, Math.min(0.95, p.tube));
    const step = Math.max(0.25, p.step);
    const n = Math.max(240, Math.min(1600, Math.round(720 / step)));
    const TWO = Math.PI * 2;

    /* --- sample the 3D curve --- */
    const rr = p.rot * Math.PI / 180;
    const cr = Math.cos(rr), sr = Math.sin(rr);
    const xs = new Float64Array(n), ys = new Float64Array(n), zs = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * TWO;
      const rad = 1 + tube * Math.cos(fq * t);
      const x = rad * Math.cos(fp * t);
      const y = rad * Math.sin(fp * t);
      const z = tube * Math.sin(fq * t);
      xs[i] = x * cr - y * sr;
      ys[i] = x * sr + y * cr;
      zs[i] = z;
    }

    /* --- fit to canvas --- */
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (let i = 0; i < n; i++) {
      if (xs[i] < bx0) bx0 = xs[i]; if (xs[i] > bx1) bx1 = xs[i];
      if (ys[i] < by0) by0 = ys[i]; if (ys[i] > by1) by1 = ys[i];
    }
    const bw = (bx1 - bx0) || 1, bh = (by1 - by0) || 1;
    const sc = Math.min(availW / bw, availH / bh);
    const ox = m + (availW - bw * sc) / 2 - bx0 * sc;
    const oy = m + (availH - bh * sc) / 2 - by0 * sc;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([xs[i] * sc + ox, ys[i] * sc + oy]);

    /* --- arc-length table --- */
    const segLen = new Float64Array(n);
    const cum = new Float64Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      cum[i] = total;
      const j = (i + 1) % n;
      segLen[i] = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
      total += segLen[i];
    }
    if (total < 2) return applyStyle({ paths: [] }, ins[0]);

    /* --- find planar self-intersections, cut the strand that is UNDER --- */
    const gapHalf = Math.max(0, p.gap) / 2;
    const cuts = [];
    if (gapHalf > 0.01) {
      for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;
        const ax = pts[i][0], ay = pts[i][1];
        const bx = pts[i2][0], by = pts[i2][1];
        const ix0 = Math.min(ax, bx), ix1 = Math.max(ax, bx);
        const iy0 = Math.min(ay, by), iy1 = Math.max(ay, by);
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue; /* adjacent around the wrap */
          const j2 = (j + 1) % n;
          const cx = pts[j][0], cy = pts[j][1];
          const dx = pts[j2][0], dy = pts[j2][1];
          /* bbox reject */
          if (Math.max(cx, dx) < ix0 || Math.min(cx, dx) > ix1) continue;
          if (Math.max(cy, dy) < iy0 || Math.min(cy, dy) > iy1) continue;
          const rX = bx - ax, rY = by - ay;
          const sX = dx - cx, sY = dy - cy;
          const den = rX * sY - rY * sX;
          if (Math.abs(den) < 1e-12) continue;
          const qpX = cx - ax, qpY = cy - ay;
          const t = (qpX * sY - qpY * sX) / den;
          const u = (qpX * rY - qpY * rX) / den;
          if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
          const za = zs[i] + (zs[i2] - zs[i]) * t;
          const zb = zs[j] + (zs[j2] - zs[j]) * u;
          if (Math.abs(za - zb) < 1e-9) continue; /* grazing: leave uncut */
          const s = za < zb ? cum[i] + t * segLen[i] : cum[j] + u * segLen[j];
          cuts.push(s);
        }
      }
    }

    if (!cuts.length) {
      return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);
    }

    /* --- drop vertices within gap/2 (arc distance) of each under-cut --- */
    const kept = new Uint8Array(n).fill(1);
    const circD = (a, b) => {
      let d = Math.abs(a - b);
      return Math.min(d, total - d);
    };
    for (const s of cuts) {
      /* binary search: lo = last vertex with cum <= s */
      let lo = 0, hi = n - 1;
      if (cum[hi] <= s) { lo = hi; hi = 0; }
      else {
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1;
          if (cum[mid] <= s) lo = mid; else hi = mid;
        }
      }
      /* walk forward from the vertex after s */
      let j = (lo + 1) % n, guard = 0;
      while (guard++ < n && circD(cum[j], s) < gapHalf) { kept[j] = 0; j = (j + 1) % n; }
      /* walk backward from the vertex before/at s */
      j = lo; guard = 0;
      while (guard++ < n && circD(cum[j], s) < gapHalf) { kept[j] = 0; j = (j - 1 + n) % n; }
    }

    /* --- collect circular runs of kept vertices --- */
    let allKept = true, noneKept = true;
    for (let i = 0; i < n; i++) {
      if (kept[i]) noneKept = false; else allKept = false;
    }
    if (noneKept) return applyStyle({ paths: [] }, ins[0]);
    if (allKept) return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);

    const paths = [];
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      if (!kept[i] || kept[prev]) continue; /* run starts where prev was cut */
      const run = [];
      let j = i, guard = 0;
      while (kept[j] && guard <= n) {
        run.push(pts[j].slice());
        j = (j + 1) % n; guard++;
      }
      if (run.length >= 2) paths.push({ pts: run, closed: false, layer: L });
    }
    return applyStyle({ paths }, ins[0]);
  },
};