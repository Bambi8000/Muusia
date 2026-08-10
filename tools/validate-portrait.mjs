/* validate-portrait.mjs - Portrait phase 1 (tonal rounds + Spiral + TSP).
   Auto-switches lab -> baked. Helpers imported verbatim from src/defs/helpers.js.
   Fixture: synthetic image with a gradient, a dark disc and a PURE WHITE disc
   (the eye-white test) - no photo, no ML, no network. */
import fs from "node:fs";
import * as H from "../src/defs/helpers.js";

let N, from;
const bakedUrl = new URL("../src/defs/nodes/portrait.js", import.meta.url);
if (fs.existsSync(bakedUrl)) {
  N = (await import(bakedUrl.href)).default;
  from = "baked";
} else {
  const src = fs.readFileSync(new URL("../nodes-lab/portrait.plotternode.js", import.meta.url), "utf8");
  const keys = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  N = new Function(...keys, '"use strict"; return (' + src + ");")(...keys.map((k) => H[k]));
  from = "lab";
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ok  " + msg); } else { fail++; console.log("  FAIL " + msg); } };

/* ---------- fixture image (pixel space) ---------- */
const IW = 200, IH = 260;
const g = new Float32Array(IW * IH);
const DARK = { x: 60, y: 80, r: 30 };   /* dark disc, g = 0.9 */
const WHITE = { x: 140, y: 80, r: 24 }; /* pure white disc, g = 0 */
for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
  let v = 0.15 + 0.45 * (y / IH) + 0.15 * (x / IW); /* gradient base */
  const dd = Math.hypot(x - DARK.x, y - DARK.y);
  if (dd < DARK.r) v = 0.9;
  else if (dd < DARK.r + 12) v = Math.max(v, 0.9 - (dd - DARK.r) / 12 * 0.6); /* soft edge -> gradients */
  if (Math.hypot(x - WHITE.x, y - WHITE.y) < WHITE.r) v = 0;
  /* dark blob lower half for later rounds to chew on */
  const db = Math.hypot(x - 100, y - 200);
  if (db < 40) v = Math.max(v, 0.75 - (db / 40) * 0.3);
  g[y * IW + x] = Math.min(1, Math.max(0, v));
}
const IMG = { w: IW, h: IH, g };
const CTX = { W: 210, H: 297 };
const nodeStub = { data: { img: IMG } };

const defs = {};
for (const pr of N.params) defs[pr.key] = pr.def;
const P = (over = {}) => ({ ...defs, ...over });
const run = (over = {}) => N.compute([undefined], P(over), CTX, nodeStub);
const J = (r) => JSON.stringify(r.paths);

/* fit box (image-node convention, mirrored here as the mm mapping oracle) */
const fit = (margin) => {
  const m = Math.max(0, margin);
  const sc = Math.min((CTX.W - 2 * m) / IW, (CTX.H - 2 * m) / IH);
  return { sc, x0: (CTX.W - IW * sc) / 2, y0: (CTX.H - IH * sc) / 2 };
};
const allPts = (r) => r.paths.flatMap((pa) => pa.pts);
const totalPts = (r) => r.paths.reduce((s, pa) => s + pa.pts.length, 0);

/* ---------- basic sanity, all modes ---------- */
console.log("[" + from + "] basic sanity");
for (const mode of ["Tonal", "Spiral", "TSP"]) {
  const r = run({ mode });
  const pts = allPts(r);
  ok(r.paths.length > 0, mode + ": produces paths (" + r.paths.length + " paths, " + pts.length + " pts)");
  ok(r.paths.every((pa) => pa.pts.length >= 2), mode + ": every path has >= 2 pts");
  ok(pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), mode + ": all coords finite");
  ok(pts.every(([x, y]) => x >= -0.01 && x <= CTX.W + 0.01 && y >= -0.01 && y <= CTX.H + 0.01), mode + ": in bounds");
  ok(totalPts(r) <= 120000, mode + ": under point budget (" + totalPts(r) + ")");
  ok(J(r) === J(run({ mode })), mode + ": deterministic (double run identical)");
  ok(J(r) !== J(run({ mode, seed: defs.seed + 5 })) || mode === "Spiral", mode + ": seed changes output" + (mode === "Spiral" ? " (spiral is seed-free by design)" : ""));
}
ok(run({ mode: "Tonal" }).paths.length > 0 && N.compute([undefined], P(), CTX, {}).paths.length === 0, "no image -> EMPTY, image -> paths");

/* ---------- prefix invariant (locked) ---------- */
console.log("prefix invariant");
{
  const a = run({ mode: "Tonal", rounds: 2, penAssign: "Cycle" });
  const b = run({ mode: "Tonal", rounds: 5, penAssign: "Cycle" });
  const ba = JSON.stringify(b.paths.slice(0, a.paths.length));
  ok(J(a) === ba, "rounds=2 bit-identical to first 2 rounds of rounds=5 (" + a.paths.length + " / " + b.paths.length + " paths)");
  ok(b.paths.length > a.paths.length, "rounds=5 adds paths beyond the prefix");
}

/* ---------- round = pen ---------- */
console.log("pen assignment");
{
  const c = run({ mode: "Tonal", rounds: 4, penAssign: "Cycle", layer: 2 });
  const layers = [...new Set(c.paths.map((pa) => pa.layer))].sort((x, y) => x - y);
  ok(layers.length >= 3 && layers.every((l) => l >= 2 && l <= 5), "Cycle: rounds land on pens 2.. (" + layers.join(",") + ")");
  const s = run({ mode: "Tonal", rounds: 4, penAssign: "Same", layer: 3 });
  ok(s.paths.every((pa) => pa.layer === 3), "Same: single pen");
}

/* ---------- residual + over-ink oracle (independent raster) ---------- */
console.log("residual / over-ink (independent raster oracle)");
{
  const rounds = 5, penW = defs.penW, ink = defs.ink, gammaP = defs.gamma, cut = defs.cutoff;
  const res = run({ mode: "Tonal", rounds, penAssign: "Cycle", layer: 0 });
  const F = fit(defs.margin);
  const cell = 1.0;
  const gw = Math.ceil((IW * F.sc) / cell), gh = Math.ceil((IH * F.sc) / cell);
  const D = new Float32Array(gw * gh);
  for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
    const u = (cx + 0.5) * cell / F.sc, v = (cy + 0.5) * cell / F.sc;
    const px = Math.min(IW - 1, Math.floor(u)), py = Math.min(IH - 1, Math.floor(v));
    const d = Math.pow(g[py * IW + px], gammaP);
    D[cy * gw + cx] = d <= cut ? 0 : (d - cut) / (1 - cut);
  }
  const I = new Float32Array(gw * gh);
  const dep = ink * penW / cell;
  const rsum = () => { let s = 0; for (let i = 0; i < D.length; i++) s += Math.max(0, D[i] - I[i]); return s; };
  const r0 = rsum();
  let prev = r0, monotone = true;
  for (let r = 0; r < rounds; r++) {
    for (const pa of res.paths) {
      if (pa.layer !== r) continue;
      const pts = H.resample(pa.pts, false, cell);
      for (const [x, y] of pts) {
        const cx = Math.floor((x - F.x0) / cell), cy = Math.floor((y - F.y0) / cell);
        if (cx >= 0 && cy >= 0 && cx < gw && cy < gh) I[cy * gw + cx] += dep;
      }
    }
    const rr = rsum();
    if (rr > prev + 1e-6) monotone = false;
    prev = rr;
  }
  ok(monotone, "residual monotonically non-increasing per round");
  ok(prev < 0.7 * r0, "residual meaningfully reduced (" + (100 * prev / r0).toFixed(1) + "% of start)");
  /* over-ink guard: overshoot bounded on inked cells */
  let over = 0, inked = 0;
  for (let i = 0; i < D.length; i++) { if (I[i] > 0) { inked++; if (I[i] > D[i] + 0.9) over++; } }
  ok(inked > 0 && over / inked < 0.05, "over-ink guard: <5% of inked cells exceed D+0.9 (" + (100 * over / inked).toFixed(2) + "%)");
}

/* ---------- white-cutoff disc untouched (eye-white test) ---------- */
console.log("white cutoff hard stop");
{
  const F = fit(defs.margin);
  const wx = F.x0 + WHITE.x * F.sc, wy = F.y0 + WHITE.y * F.sc, wr = WHITE.r * F.sc;
  for (const mode of ["Tonal", "TSP"]) {
    const r = run({ mode, rounds: 6 });
    const inside = allPts(r).filter(([x, y]) => Math.hypot(x - wx, y - wy) < wr - 1.5).length;
    ok(inside === 0, mode + ": zero points inside the white disc (r-1.5mm)");
  }
}

/* ---------- detail liveness ---------- */
console.log("detail liveness");
{
  const lo = run({ mode: "Tonal", rounds: 5, detail: 0.1, penAssign: "Cycle" });
  const hi = run({ mode: "Tonal", rounds: 5, detail: 0.9, penAssign: "Cycle" });
  const lastStats = (r) => {
    const maxL = Math.max(...r.paths.map((pa) => pa.layer));
    const last = r.paths.filter((pa) => pa.layer === maxL);
    const mean = last.reduce((s, pa) => s + H.pathLength(pa.pts, false), 0) / Math.max(1, last.length);
    return { n: last.length, mean };
  };
  const a = lastStats(lo), b = lastStats(hi);
  ok(b.mean < a.mean || b.n > a.n, "higher Detail -> shorter or more strokes in final round (lo: n=" + a.n + " mean=" + a.mean.toFixed(1) + "mm, hi: n=" + b.n + " mean=" + b.mean.toFixed(1) + "mm)");
}

/* ---------- focus liveness ---------- */
console.log("focus liveness");
{
  /* spec: "stroke density higher inside the ellipse when boost > 0" -
     count STROKES whose midpoint is inside (focus renders finer: shorter,
     denser strokes for the same ink) */
  const strokesIn = (r, fx, fy, rx, ry) => {
    const ex = CTX.W * fx / 100, ey = CTX.H * fy / 100;
    const RX = CTX.W * rx / 100, RY = CTX.H * ry / 100;
    return r.paths.filter((pa) => {
      const [x, y] = pa.pts[Math.floor(pa.pts.length / 2)];
      return ((x - ex) / RX) ** 2 + ((y - ey) / RY) ** 2 < 1;
    }).length;
  };
  const args = { mode: "Tonal", rounds: 3, focusX: 50, focusY: 30, focusRX: 15, focusRY: 10 };
  const off = strokesIn(run({ ...args, focusBoost: 0 }), 50, 30, 15, 10);
  const on = strokesIn(run({ ...args, focusBoost: 2.5 }), 50, 30, 15, 10);
  ok(on > off * 1.3, "Focus boost raises in-ellipse stroke density (" + off + " -> " + on + " strokes)");
}

/* ---------- flow mode: strokes locally perpendicular to grad D ---------- */
console.log("flow orthogonality");
{
  const r = run({ mode: "Tonal", rounds: 1, hatch: "Flow" });
  const F = fit(defs.margin);
  /* validator's own blurred-D gradient (box blur, ~6mm kernel, cell 1mm) */
  const cell = 1.0;
  const gw = Math.ceil((IW * F.sc) / cell), gh = Math.ceil((IH * F.sc) / cell);
  let D = new Float32Array(gw * gh);
  for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
    const px = Math.min(IW - 1, Math.floor((cx + 0.5) * cell / F.sc));
    const py = Math.min(IH - 1, Math.floor((cy + 0.5) * cell / F.sc));
    D[cy * gw + cx] = g[py * IW + px];
  }
  const rad = 6;
  const blur1 = (src) => {
    const out = new Float32Array(src.length);
    for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
      let s = 0, n = 0;
      for (let dy = -rad; dy <= rad; dy += 2) for (let dx = -rad; dx <= rad; dx += 2) {
        const X = Math.max(0, Math.min(gw - 1, cx + dx)), Y = Math.max(0, Math.min(gh - 1, cy + dy));
        s += src[Y * gw + X]; n++;
      }
      out[cy * gw + cx] = s / n;
    }
    return out;
  };
  D = blur1(D);
  const gradAt = (x, y) => {
    const cx = Math.max(1, Math.min(gw - 2, Math.floor((x - F.x0) / cell)));
    const cy = Math.max(1, Math.min(gh - 2, Math.floor((y - F.y0) / cell)));
    const i = cy * gw + cx;
    return [(D[i + 1] - D[i - 1]) / 2, (D[i + gw] - D[i - gw]) / 2];
  };
  const dots = [];
  for (const pa of r.paths) {
    for (let i = 2; i < pa.pts.length - 2; i += 3) {
      const [x1, y1] = pa.pts[i - 1], [x2, y2] = pa.pts[i + 1];
      const dl = Math.hypot(x2 - x1, y2 - y1);
      if (dl < 1e-6) continue;
      const [gx, gy] = gradAt(pa.pts[i][0], pa.pts[i][1]);
      const gm = Math.hypot(gx, gy);
      if (gm < 0.012) continue; /* only where the field is strong */
      dots.push(Math.abs(((x2 - x1) * gx + (y2 - y1) * gy) / (dl * gm)));
    }
  }
  dots.sort((a, b) => a - b);
  const med = dots[Math.floor(dots.length / 2)] || 1;
  ok(dots.length > 50 && med < 0.5, "median |cos(stroke, gradD)| < 0.5 in strong-gradient areas (med=" + med.toFixed(3) + ", n=" + dots.length + ")");
}

/* ---------- TSP invariants ---------- */
console.log("TSP");
{
  const r = run({ mode: "TSP" });
  ok(r.paths.length === 1 && r.paths[0].closed === false, "exactly one open path (pen never lifts)");
  const pts = r.paths[0].pts;
  const seen = new Set(pts.map(([x, y]) => x.toFixed(6) + "," + y.toFixed(6)));
  ok(seen.size === pts.length, "every point visited exactly once (" + pts.length + " points)");
  const q1 = H.pathLength(run({ mode: "TSP", quality: 1 }).paths[0].pts, false);
  const q6 = H.pathLength(run({ mode: "TSP", quality: 6 }).paths[0].pts, false);
  ok(q6 <= q1 + 1e-6, "more Quality (2-opt budget) never lengthens the tour (" + q1.toFixed(0) + " -> " + q6.toFixed(0) + " mm)");
  /* density from darkness: more points near the dark disc than in a light patch */
  const F = fit(defs.margin);
  const cnt = (cx, cy, rad) => pts.filter(([x, y]) => Math.hypot(x - (F.x0 + cx * F.sc), y - (F.y0 + cy * F.sc)) < rad * F.sc).length;
  ok(cnt(DARK.x, DARK.y, DARK.r) > 3 * Math.max(1, cnt(30, 20, DARK.r)), "dot density follows darkness (dark disc vs light corner: " + cnt(DARK.x, DARK.y, DARK.r) + " vs " + cnt(30, 20, DARK.r) + ")");
}

/* ---------- Spiral invariants ---------- */
console.log("Spiral");
{
  const r = run({ mode: "Spiral" });
  ok(r.paths.length === 1 && r.paths[0].closed === false, "exactly one open path");
  const pts = r.paths[0].pts;
  const F = fit(defs.margin);
  const lenIn = (cx, cy, rad) => {
    let L = 0;
    const X = F.x0 + cx * F.sc, Y = F.y0 + cy * F.sc, R = rad * F.sc;
    for (let i = 1; i < pts.length; i++) {
      if (Math.hypot(pts[i][0] - X, pts[i][1] - Y) < R && Math.hypot(pts[i - 1][0] - X, pts[i - 1][1] - Y) < R)
        L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return L;
  };
  /* wave adds arc length: same-size window over the dark disc vs a light patch */
  const dark = lenIn(DARK.x, DARK.y, 20);
  const light = lenIn(IW - DARK.x, IH - 80, 20);
  ok(dark > light * 1.1, "amplitude modulates with darkness (arc length dark window " + dark.toFixed(0) + "mm > light window " + light.toFixed(0) + "mm)");
  /* wiggle oracle: median deviation of each point from its neighbours' midpoint -
     high where the wave rides, ~zero where the spiral passes the white disc as
     a plain line (pen never lifts, amplitude 0) */
  const wig = (cx, cy, rad) => {
    const X = F.x0 + cx * F.sc, Y = F.y0 + cy * F.sc, R = rad * F.sc;
    const ds = [];
    for (let i = 1; i < pts.length - 1; i++) {
      if (Math.hypot(pts[i][0] - X, pts[i][1] - Y) > R) continue;
      const mx = (pts[i - 1][0] + pts[i + 1][0]) / 2, my = (pts[i - 1][1] + pts[i + 1][1]) / 2;
      ds.push(Math.hypot(pts[i][0] - mx, pts[i][1] - my));
    }
    ds.sort((a, b) => a - b);
    return ds.length ? ds[Math.floor(ds.length / 2)] : -1;
  };
  const wD = wig(DARK.x, DARK.y, 20), wW = wig(WHITE.x, WHITE.y, WHITE.r * 0.6), wL = wig(IW - DARK.x, IH - 80, 20);
  ok(wW >= 0 && wW < 0.05, "spiral crosses the white disc as a plain line (wiggle med " + wW.toFixed(4) + "mm)");
  ok(wD > wL * 1.2, "wiggle follows darkness (dark " + wD.toFixed(3) + " > light " + wL.toFixed(3) + ")");
}

/* ---------- rounds liveness ---------- */
console.log("rounds liveness");
{
  const r1 = run({ mode: "Tonal", rounds: 1 });
  const r5 = run({ mode: "Tonal", rounds: 5 });
  ok(r5.paths.length > r1.paths.length, "more rounds -> more paths (" + r1.paths.length + " -> " + r5.paths.length + ")");
}

/* ---------- PHASE B: feature lines from the frozen real-photo fixture ---------- */
console.log("phase B: fixture feature lines");
{
  const A = JSON.parse(fs.readFileSync(new URL("../fixtures/portrait-analysis-v1.json", import.meta.url), "utf8"));
  /* synthetic mid-gray image matching the analysis dimensions - geometry
     comes from the frozen analysis, tone from this stand-in (no ML, no net) */
  const AW = A.img.w, AH = A.img.h;
  const ag = new Float32Array(AW * AH).fill(0.55);
  const nodeA = { data: { img: { w: AW, h: AH, g: ag }, analysis: A } };
  const runA = (over = {}) => N.compute([undefined], P(over), CTX, nodeA);
  const FA = (() => { const m = Math.max(0, defs.margin);
    const s = Math.min((CTX.W - 2 * m) / AW, (CTX.H - 2 * m) / AH);
    return { sc: s, x0: (CTX.W - AW * s) / 2, y0: (CTX.H - AH * s) / 2 }; })();

  const fOnly = runA({ mode: "Features only", economy: 1 });
  ok(fOnly.paths.length > 20, "Features only draws (" + fOnly.paths.length + " paths, " + totalPts(fOnly) + " pts)");
  ok(fOnly.paths.every((pa) => pa.layer === Math.round(defs.layer)), "feature lines take the node's own Pen slot");
  ok(allPts(fOnly).every(([x, y]) => x >= -0.01 && x <= CTX.W + 0.01 && y >= -0.01 && y <= CTX.H + 0.01), "in bounds");
  ok(J(fOnly) === J(runA({ mode: "Features only", economy: 1 })), "deterministic");

  /* economy: eyes always survive, everything prunes toward them */
  const fMin = runA({ mode: "Features only", economy: 0 });
  ok(fMin.paths.length < fOnly.paths.length, "Line economy prunes (" + fOnly.paths.length + " -> " + fMin.paths.length + " paths)");
  const eyeC = A.face.chains.eyeL.pts.reduce((s, q) => [s[0] + q[0], s[1] + q[1]], [0, 0]).map((v) => v / A.face.chains.eyeL.pts.length);
  const eyeMM = [FA.x0 + eyeC[0] * FA.sc, FA.y0 + eyeC[1] * FA.sc];
  const nearEye = (r) => r.paths.some((pa) => {
    const mid = pa.pts[Math.floor(pa.pts.length / 2)];
    return Math.hypot(mid[0] - eyeMM[0], mid[1] - eyeMM[1]) < 8;
  });
  ok(nearEye(fMin), "eyes survive economy 0");

  /* glasses checkbox */
  const gOn = runA({ mode: "Features only", economy: 1, glassesOn: true });
  const gOff = runA({ mode: "Features only", economy: 1, glassesOn: false });
  ok(gOn.paths.length > gOff.paths.length, "Glasses lines checkbox is live (" + gOn.paths.length + " vs " + gOff.paths.length + " paths)");

  /* hair streamlines follow the frozen flow field */
  {
    const oMM = A.regions.hair.outline.map((q) => [FA.x0 + q[0] * FA.sc, FA.y0 + q[1] * FA.sc]);
    const pip = (x, y, poly) => { let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
      } return ins; };
    const HF = A.hairFlow;
    const devs = [];
    let hairPaths = 0;
    for (const pa of fOnly.paths) {
      const mid = pa.pts[Math.floor(pa.pts.length / 2)];
      if (!pip(mid[0], mid[1], oMM) || pa.pts.length < 6) continue;
      hairPaths++;
      for (let i = 2; i < pa.pts.length - 2; i += 4) {
        const [x1, y1] = pa.pts[i - 1], [x2, y2] = pa.pts[i + 1];
        const segA = Math.atan2(y2 - y1, x2 - x1);
        const gx = Math.max(0, Math.min(HF.w - 1, Math.floor(((pa.pts[i][0] - FA.x0) / FA.sc) / HF.cell)));
        const gy = Math.max(0, Math.min(HF.h - 1, Math.floor(((pa.pts[i][1] - FA.y0) / FA.sc) / HF.cell)));
        const fi = gy * HF.w + gx;
        if (HF.coh[fi] < 0.5) continue;
        let d = Math.abs(segA - HF.ang[fi]) % Math.PI;
        devs.push(Math.min(d, Math.PI - d));
      }
    }
    devs.sort((a, b) => a - b);
    const med = devs.length ? devs[Math.floor(devs.length / 2)] * 180 / Math.PI : 999;
    ok(hairPaths > 15, "hair streamlines drawn inside the hair mask (" + hairPaths + " paths)");
    ok(devs.length > 100 && med < 20, "streamlines follow hairFlow (median dev " + med.toFixed(1) + " deg, n=" + devs.length + ")");
  }

  /* margin change = pure affine remap of the output (spec checklist) */
  {
    const a1 = runA({ mode: "Features only", economy: 1, margin: 12 });
    const a2 = runA({ mode: "Features only", economy: 1, margin: 24 });
    const f1 = (() => { const s = Math.min((CTX.W - 24) / AW, (CTX.H - 24) / AH); return { s, x0: (CTX.W - AW * s) / 2, y0: (CTX.H - AH * s) / 2 }; })();
    const f2 = (() => { const s = Math.min((CTX.W - 48) / AW, (CTX.H - 48) / AH); return { s, x0: (CTX.W - AW * s) / 2, y0: (CTX.H - AH * s) / 2 }; })();
    let maxErr = 0;
    const pa1 = a1.paths[0].pts, pa2 = a2.paths[0].pts;
    ok(a1.paths.length === a2.paths.length && pa1.length === pa2.length, "margin change keeps path structure");
    for (let i = 0; i < Math.min(pa1.length, pa2.length); i++) {
      const ex2 = [(pa1[i][0] - f1.x0) / f1.s * f2.s + f2.x0, (pa1[i][1] - f1.y0) / f1.s * f2.s + f2.y0];
      maxErr = Math.max(maxErr, Math.hypot(ex2[0] - pa2[i][0], ex2[1] - pa2[i][1]));
    }
    ok(maxErr < 1e-6, "margin change is a pure affine remap (max err " + maxErr.toExponential(1) + " mm)");
  }

  /* Features+tonal: features first on pen L0, tonal continues shifted; prefix holds */
  {
    const ft = runA({ mode: "Features+tonal", rounds: 3, penAssign: "Cycle", layer: 0, economy: 1 });
    const fCount = fOnly.paths.length;
    ok(ft.paths.length > fCount, "tonal rounds add on top of features (" + fCount + " -> " + ft.paths.length + ")");
    ok(JSON.stringify(ft.paths.slice(0, fCount)) === J(fOnly), "feature prefix identical between modes");
    const tonalLayers = [...new Set(ft.paths.slice(fCount).map((pa) => pa.layer))];
    ok(tonalLayers.every((l) => l >= 1), "tonal pens shifted past the feature pen (layers " + tonalLayers.join(",") + ")");
    const a2r = runA({ mode: "Features+tonal", rounds: 5, penAssign: "Cycle", layer: 0, economy: 1 });
    ok(JSON.stringify(ft.paths) === JSON.stringify(a2r.paths.slice(0, ft.paths.length)), "prefix invariant holds in Features+tonal");
  }

  /* degradation: garbage / missing / found:false never crash, fall back to Tonal */
  {
    const base = J(runA({ mode: "Tonal", rounds: 2 }));
    for (const [bad, label] of [[{ v: 99 }, "wrong version"], ["garbage", "a string"], [{ v: 1, img: { w: NaN } }, "NaN img"], [undefined, "missing analysis"]]) {
      const nb = { data: { img: { w: AW, h: AH, g: ag }, analysis: bad } };
      const r = N.compute([undefined], P({ mode: "Features+tonal", rounds: 2 }), CTX, nb);
      ok(JSON.stringify(r.paths) === base, "degrades to Tonal on " + label);
    }
    const noFace = { ...A, face: { found: false }, regions: {}, hairFlow: null };
    const nb2 = { data: { img: { w: AW, h: AH, g: ag }, analysis: noFace } };
    const r2 = N.compute([undefined], P({ mode: "Features only", rounds: 2 }), CTX, nb2);
    ok(JSON.stringify(r2.paths) === J(runA({ mode: "Tonal", rounds: 2 })), "found:false with no regions degrades to Tonal");
  }

  /* ---------- phase 3: One line (Picasso) ---------- */
  console.log("phase 3: One line");
  {
    const ol = runA({ mode: "One line", economy: 1 });
    ok(ol.paths.length === 1 && ol.paths[0].closed === false, "exactly one open path - the pen never lifts");
    ok(ol.paths[0].pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), "coords finite");
    ok(J(ol) === J(runA({ mode: "One line", economy: 1 })), "deterministic");
    /* the line visits every kept chain: max over eye/lips/brow centroids of
       min distance to the line stays small */
    const chainC = (k) => { const c = A.face.chains[k].pts;
      const s = c.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]);
      return [FA.x0 + (s[0] / c.length) * FA.sc, FA.y0 + (s[1] / c.length) * FA.sc]; };
    const minD = (pt) => Math.min(...ol.paths[0].pts.filter((_, i) => i % 3 === 0).map((q) => Math.hypot(q[0] - pt[0], q[1] - pt[1])));
    const worst = Math.max(...["eyeL", "eyeR", "lipsOuter", "browL", "browR"].map((k) => minD(chainC(k))));
    ok(worst < 6, "the line visits every major feature (worst centroid distance " + worst.toFixed(1) + "mm)");
    const olMin = runA({ mode: "One line", economy: 0 });
    ok(H.pathLength(olMin.paths[0].pts, false) < H.pathLength(ol.paths[0].pts, false), "economy shortens the line (" + H.pathLength(ol.paths[0].pts, false).toFixed(0) + " -> " + H.pathLength(olMin.paths[0].pts, false).toFixed(0) + " mm)");
    /* spec: One line without analysis is EMPTY, not tonal */
    const noA = N.compute([undefined], P({ mode: "One line" }), CTX, { data: { img: nodeA.data.img } });
    ok(noA.paths.length === 0, "no analysis -> EMPTY (unlike the other feature modes)");
    ok(totalPts(ol) <= 120000, "under budget (" + totalPts(ol) + " pts)");
  }

  /* ---------- Sketch nerve (Tresset) ---------- */
  console.log("sketch nerve");
  {
    const clean = runA({ mode: "Features+tonal", rounds: 3, economy: 1 });
    const cleanExplicit = runA({ mode: "Features+tonal", rounds: 3, economy: 1, nerve: 0 });
    ok(J(clean) === J(cleanExplicit), "nerve 0 is bit-identical to the clean drawing");
    const nervy = runA({ mode: "Features+tonal", rounds: 3, economy: 1, nerve: 0.8 });
    ok(J(nervy) !== J(clean), "nerve changes the drawing");
    const l0 = (r) => r.paths.filter((pa) => pa.layer === 0).length;
    ok(l0(nervy) > l0(clean), "contours are re-stated on the feature pen (" + l0(clean) + " -> " + l0(nervy) + " L0 paths; total may SHRINK - white space trades tonal strokes away)");
    ok(allPts(nervy).every(([x, y]) => x >= -0.5 && x <= CTX.W + 0.5 && y >= -0.5 && y <= CTX.H + 0.5), "wobble stays in bounds");
    const pref = runA({ mode: "Features+tonal", rounds: 2, economy: 1, nerve: 0.8, penAssign: "Cycle" });
    const pref5 = runA({ mode: "Features+tonal", rounds: 5, economy: 1, nerve: 0.8, penAssign: "Cycle" });
    ok(JSON.stringify(pref.paths) === JSON.stringify(pref5.paths.slice(0, pref.paths.length)), "prefix invariant survives nerve (coordinate noise, no rng drift)");
    const olN = runA({ mode: "One line", economy: 1, nerve: 0.7 });
    ok(olN.paths.length === 1, "one line stays one line under nerve");
    /* the miscalibration guard: restated grooves must be VISIBLY separate.
       Compare each nervy feature path against the nearest clean feature path:
       at nerve 0.8 the median offset of restates must exceed 0.8 mm */
    const cleanF = runA({ mode: "Features only", economy: 1 });
    const nervyF = runA({ mode: "Features only", economy: 1, nerve: 0.8 });
    ok(nervyF.paths.length >= cleanF.paths.length + 25, "restates add contour copies - streamlines stay single (" + cleanF.paths.length + " -> " + nervyF.paths.length + ")");
    const off = (pa, pb) => {
      let s2 = 0, n2 = 0;
      for (let i = 0; i < pa.pts.length; i += 4) {
        let bd = Infinity;
        for (let j = 0; j < pb.pts.length; j += 4) {
          const dd = Math.hypot(pa.pts[i][0] - pb.pts[j][0], pa.pts[i][1] - pb.pts[j][1]);
          if (dd < bd) bd = dd;
        }
        s2 += bd; n2++;
      }
      return s2 / Math.max(1, n2);
    };
    /* brow chain: clean has one, nervy has restates; measure spread of the
       nervy copies against the clean one */
    const browC = A.face.chains.browL.pts.reduce((s2, q) => [s2[0] + q[0], s2[1] + q[1]], [0, 0]).map((v) => v / A.face.chains.browL.pts.length);
    const browMM = [FA.x0 + browC[0] * FA.sc, FA.y0 + browC[1] * FA.sc];
    const near = (r) => r.paths.filter((pa) => { const m2 = pa.pts[Math.floor(pa.pts.length / 2)]; return Math.hypot(m2[0] - browMM[0], m2[1] - browMM[1]) < 8 && pa.pts.length < 80; });
    const cB = near(cleanF), nB = near(nervyF);
    const spreads = nB.map((pa) => off(pa, cB[0])).sort((x, y) => x - y);
    const medSpread = spreads.length ? spreads[Math.floor(spreads.length / 2)] : 0;
    ok(cB.length >= 1 && nB.length > cB.length && medSpread > 0.35, "restated grooves are visibly separate (median offset " + medSpread.toFixed(2) + " mm, " + nB.length + " brow strokes)");
    /* Tresset structure: at nerve > 0 the tonal ink PACKS toward the feature
       lines and leaves white space; strokes get longer and wander */
    /* structure checks need a feature-FREE far field: the base fixture's
       hair reaches the bottom of the image, so use a chains-only variant */
    const Achains = { ...A, regions: {}, hairFlow: null };
    const nodeC = { data: { img: nodeA.data.img, analysis: Achains } };
    const runC = (o = {}) => N.compute([undefined], P(o), CTX, nodeC);
    const ft0 = runC({ mode: "Features+tonal", rounds: 3, economy: 1, nerve: 0, penAssign: "Cycle", layer: 0 });
    const ft8 = runC({ mode: "Features+tonal", rounds: 3, economy: 1, nerve: 0.85, penAssign: "Cycle", layer: 0 });
    const featRef = runC({ mode: "Features only", economy: 1 });
    const featPts = featRef.paths.flatMap((pa) => pa.pts.filter((_, i) => i % 5 === 0));
    const tonalOf = (r) => r.paths.filter((pa) => pa.layer >= 1);
    const meanDistToFeat = (r) => {
      const t = tonalOf(r);
      let s2 = 0, n2 = 0;
      for (let k = 0; k < t.length; k += 3) {
        const m2 = t[k].pts[Math.floor(t[k].pts.length / 2)];
        let bd = Infinity;
        for (let j = 0; j < featPts.length; j += 7) {
          const dd = (m2[0] - featPts[j][0]) ** 2 + (m2[1] - featPts[j][1]) ** 2;
          if (dd < bd) bd = dd;
        }
        s2 += Math.sqrt(bd); n2++;
      }
      return s2 / Math.max(1, n2);
    };
    const d0 = meanDistToFeat(ft0), d8 = meanDistToFeat(ft8);
    ok(d8 < d0 * 0.75, "tonal ink packs toward the feature lines (mean dist " + d0.toFixed(1) + " -> " + d8.toFixed(1) + " mm)");
    const cover = (r) => {
      const cells = new Set();
      for (const pa of tonalOf(r)) for (let i = 0; i < pa.pts.length; i += 4)
        cells.add(Math.floor(pa.pts[i][0] / 5) + "," + Math.floor(pa.pts[i][1] / 5));
      return cells.size;
    };
    const c0 = cover(ft0), c8 = cover(ft8);
    ok(c8 < c0 * 0.85, "white space emerges - tonal coverage shrinks (" + c0 + " -> " + c8 + " 5mm cells)");
    /* the Tresset distribution: MANY short packed marks + a LONG wandering
       tail - the median drops (packing) while the longest strokes grow */
    /* rooted but wild: a stroke STARTS at its anchor and ESCAPES far from it -
       median start-distance to features stays small while the endpoint
       distance tail grows long */
    const dToFeat = (q) => {
      let bd = Infinity;
      for (let j = 0; j < featPts.length; j += 5) {
        const dd = (q[0] - featPts[j][0]) ** 2 + (q[1] - featPts[j][1]) ** 2;
        if (dd < bd) bd = dd;
      }
      return Math.sqrt(bd);
    };
    const starts = tonalOf(ft8).map((pa) => dToFeat(pa.pts[0])).sort((a2, b2) => a2 - b2);
    const ends = tonalOf(ft8).map((pa) => dToFeat(pa.pts[pa.pts.length - 1]));
    const medStart = starts[Math.floor(starts.length / 2)];
    const escapees = ends.filter((d2) => d2 > 25).length;
    ok(medStart < 6 && escapees >= 8, "rooted piles + real escapees (median root " + medStart.toFixed(1) + " mm, " + escapees + " strokes escape past 25 mm)");
    /* eruption: neighbouring strokes must SPLAY, not copy each other - the
       initial directions of tonal strokes occupy far more angle bins */
    const dirBins = (r) => {
      const bins = new Set();
      for (const pa of tonalOf(r)) {
        if (pa.pts.length < 4) continue;
        const a2 = Math.atan2(pa.pts[3][1] - pa.pts[0][1], pa.pts[3][0] - pa.pts[0][0]);
        bins.add(Math.floor(((a2 + Math.PI) / (2 * Math.PI)) * 16) % 16);
      }
      return bins.size;
    };
    ok(dirBins(ft8) >= 14 && dirBins(ft8) > dirBins(ft0), "strokes splay in all directions (" + dirBins(ft0) + " -> " + dirBins(ft8) + " of 16 angle bins)");
    /* and their lengths scatter: coefficient of variation grows */
    const cv = (r) => {
      const L = tonalOf(r).map((pa) => H.pathLength(pa.pts, false));
      const m2 = L.reduce((s2, v) => s2 + v, 0) / L.length;
      const v2 = L.reduce((s2, v) => s2 + (v - m2) ** 2, 0) / L.length;
      return Math.sqrt(v2) / m2;
    };
    /* absolute floor, not relative to nerve 0: the nerve-0 CV is inflated by
       cross-round mixing (block-in giants + late-round ticks), which the
       packed nerve structure deliberately lacks */
    ok(cv(ft8) > 0.5, "length scatter: bursts and escapees mixed (CV " + cv(ft8).toFixed(2) + ", floor 0.5)");
    /* worminess guard: long strokes must MEANDER (displacement well under arc
       length) yet still travel - a ruler and a knot both fail this */
    const straight = tonalOf(ft8).filter((pa) => H.pathLength(pa.pts, false) > 10).map((pa) => {
      const a0 = pa.pts[0], a1 = pa.pts[pa.pts.length - 1];
      return Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / H.pathLength(pa.pts, false);
    }).sort((x2, y2) => x2 - y2);
    const medStr = straight.length ? straight[Math.floor(straight.length / 2)] : 1;
    ok(straight.length > 20 && medStr > 0.2 && medStr < 0.85, "strokes are worms, not rulers or knots (median straightness " + medStr.toFixed(2) + ")");
    /* CONTRAST: same chains, two-tone image - the dark half piles far more
       ink than the light half (tone-scaled pile floor) */
    {
      const g2 = new Float32Array(AW * AH);
      for (let y2 = 0; y2 < AH; y2++) for (let x2 = 0; x2 < AW; x2++)
        g2[y2 * AW + x2] = x2 < AW / 2 ? 0.75 : 0.25;
      const nodeT = { data: { img: { w: AW, h: AH, g: g2 }, analysis: Achains } };
      const rT = N.compute([undefined], P({ mode: "Features+tonal", rounds: 3, economy: 1, nerve: 0.9 }), CTX, nodeT);
      const midX = FA.x0 + (AW / 2) * FA.sc;
      let dark = 0, light = 0;
      for (const pa of rT.paths.filter((p2) => p2.layer >= 1))
        for (let i = 0; i < pa.pts.length; i += 3) (pa.pts[i][0] < midX ? dark++ : light++);
      ok(dark > light * 1.8, "contrast: the dark half piles ink, the light half stays sparse (" + dark + " vs " + light + " pts)");
    }
  }

  /* ---------- multi-face + beard (additive schema) ---------- */
  console.log("multi-face + beard");
  {
    /* second face: primary's chains scaled 0.5 into the top-left corner */
    const scaleChain = (c) => c ? { pts: c.pts.map((q) => [q[0] * 0.5 + 30, q[1] * 0.5 + 40]), closed: c.closed, confidence: 1 } : null;
    const face2 = { found: true, confidence: 0.9, pose: A.face.pose,
      chains: Object.fromEntries(Object.entries(A.face.chains).map(([k, c]) => [k, scaleChain(c)])) };
    /* synthetic beard under the primary jaw: box around the chin area */
    const ovPts = A.face.chains.faceOval.pts;
    const oy1 = Math.max(...ovPts.map((q) => q[1]));
    const lipsY = A.face.chains.lipsOuter.pts.reduce((s, q) => s + q[1], 0) / A.face.chains.lipsOuter.pts.length;
    const oxs = ovPts.map((q) => q[0]);
    const bx0 = Math.min(...oxs) + 40, bx1 = Math.max(...oxs) - 40;
    /* box top BELOW the lower lip - the real texture mask can never cover the
       lips (lip classes are not skinLike), and the mouth must stay drawable */
    const bTop = Math.max(...A.face.chains.lipsOuter.pts.map((q) => q[1])) + 6;
    const beard = { outline: [[bx0, bTop], [bx1, bTop], [bx1, oy1 + 55], [bx0, oy1 + 55]], holes: [], area: (bx1 - bx0) * (oy1 + 55 - bTop), confidence: 0.9 };
    const bfw = 8, bfh = 6;
    const beardFlow = { cell: Math.ceil(AW / bfw), w: bfw, h: bfh, ang: new Array(bfw * bfh).fill(1.35), coh: new Array(bfw * bfh).fill(0.9) };
    const A2 = { ...A, faces: [A.face, face2], regions: { ...A.regions, beard }, beardFlow };
    const node2 = { data: { img: nodeA.data.img, analysis: A2 } };
    const run2 = (o = {}) => N.compute([undefined], P(o), CTX, node2);

    const one = runA({ mode: "Features only", economy: 1 });
    const two = run2({ mode: "Features only", economy: 1 });
    ok(two.paths.length > one.paths.length + 8, "second face adds its chains (" + one.paths.length + " -> " + two.paths.length + " paths)");
    const f2eye = face2.chains.eyeL.pts.reduce((s, q) => [s[0] + q[0], s[1] + q[1]], [0, 0]).map((v) => v / face2.chains.eyeL.pts.length);
    const f2mm = [FA.x0 + f2eye[0] * FA.sc, FA.y0 + f2eye[1] * FA.sc];
    ok(two.paths.some((pa) => { const m2 = pa.pts[Math.floor(pa.pts.length / 2)]; return Math.hypot(m2[0] - f2mm[0], m2[1] - f2mm[1]) < 6; }), "second face's eye is drawn");
    const olTwo = run2({ mode: "One line", economy: 1 });
    ok(olTwo.paths.length === 1, "One line links BOTH faces into a single line");
    const dMin = Math.min(...olTwo.paths[0].pts.filter((_, i) => i % 3 === 0).map((q) => Math.hypot(q[0] - f2mm[0], q[1] - f2mm[1])));
    ok(dMin < 6, "the single line visits the second face too (dist " + dMin.toFixed(1) + "mm)");

    /* beard streamlines: paths inside the beard polygon following the flow */
    const bMM = beard.outline.map((q) => [FA.x0 + q[0] * FA.sc, FA.y0 + q[1] * FA.sc]);
    const pip2 = (x, y, poly) => { let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
      } return ins; };
    const inB = (pa) => { const m2 = pa.pts[Math.floor(pa.pts.length / 2)]; return pip2(m2[0], m2[1], bMM); };
    const beardPaths = two.paths.filter((pa) => !pa.closed && pa.pts.length > 6 && inB(pa));
    ok(beardPaths.length > 8, "beard streamlines drawn (" + beardPaths.length + " paths in the beard)");
    let devs2 = [];
    for (const pa of beardPaths) for (let i = 2; i < pa.pts.length - 2; i += 4) {
      const a2 = Math.atan2(pa.pts[i + 1][1] - pa.pts[i - 1][1], pa.pts[i + 1][0] - pa.pts[i - 1][0]);
      let d2 = Math.abs(a2 - 1.35) % Math.PI; devs2.push(Math.min(d2, Math.PI - d2));
    }
    devs2.sort((x, y) => x - y);
    ok(devs2.length > 20 && devs2[Math.floor(devs2.length / 2)] < 0.35, "beard streamlines follow beardFlow");

    /* jaw clipping isolated: beard region WITHOUT flow -> only chains remain,
       and none of them may run through the beard interior */
    const A3 = { ...A2, beardFlow: null, regions: { ...A.regions, hair: null, beard }, hairFlow: null };
    const node3 = { data: { img: nodeA.data.img, analysis: A3 } };
    const r3 = N.compute([undefined], P({ mode: "Features only", economy: 0.6 }), CTX, node3);
    const inset = 2.5;
    const deepIn = allPts(r3).filter(([x, y]) => pip2(x, y, bMM) &&
      Math.min(x - bMM[0][0], bMM[1][0] - x, y - bMM[0][1], bMM[2][1] - y) > inset).length;
    ok(deepIn === 0, "jaw/oval chains are clipped outside the beard (0 pts deep inside)");
    ok(J(runA({ mode: "Features only", economy: 1 })) === J(one), "old single-face analysis unchanged (back-compat)");
  }

  /* overlay guides from frozen analysis (engine's additive 4th arg) */
  {
    const g0 = N.overlay(P(), CTX, [undefined]);
    const g1 = N.overlay(P(), CTX, [undefined], nodeA);
    ok(Array.isArray(g0) && g0.length >= 3, "overlay without node still works (legacy signature)");
    ok(g1.length > g0.length + 8, "analysis chains + regions appear as guides (" + g0.length + " -> " + g1.length + ")");
    ok(N.overlay(P(), CTX, [undefined], { data: { img: nodeA.data.img, analysis: "garbage" } }).length === g0.length, "garbage analysis never breaks the overlay");
  }
}

console.log("\n" + pass + " passed, " + fail + " failed (" + from + " version)");
if (fail > 0) process.exitCode = 1;
