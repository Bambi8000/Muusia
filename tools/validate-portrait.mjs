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
