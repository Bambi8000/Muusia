/* validate-container.js */
const fs = require("fs");
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x,y,s){let h=Math.imul(Math.floor(x)^0x9e3779b9,2654435761);h^=Math.imul(Math.floor(y)^0x85ebca6b,2246822519);h^=Math.imul((s|0)^0xc2b2ae35,3266489917);h=(h^(h>>>15))>>>0;return h/4294967296;}
function noise2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
function resample(pts,closed,step){if(pts.length<2)return pts.map(p=>p.slice());const src=closed?[...pts,pts[0]]:pts;const out=[src[0].slice()];let acc=0;for(let i=1;i<src.length;i++){let[x0,y0]=src[i-1],[x1,y1]=src[i];let seg=Math.hypot(x1-x0,y1-y0);while(acc+seg>=step){const t=(step-acc)/seg;const nx=x0+(x1-x0)*t,ny=y0+(y1-y0)*t;out.push([nx,ny]);x0=nx;y0=ny;seg=Math.hypot(x1-x0,y1-y0);acc=0;}acc+=seg;}if(!closed)out.push(src[src.length-1].slice());return out;}
const pathLength=(pts,closed)=>{let l=0;const P=closed?[...pts,pts[0]]:pts;for(let i=1;i<P.length;i++)l+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return l;};
const applyStyle=(ps)=>ps, signedArea=()=>0;
const H_ = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const N = new Function(...Object.keys(H_), '"use strict"; return (' + fs.readFileSync(__dirname + "/container.plotternode.js","utf8") + ");")(...Object.values(H_));

const CTX = { W: 210, H: 297 };
function defaults() { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; }
function totalLen(r) { let l = 0; for (const pa of r.paths) l += pathLength(pa.pts, pa.closed); return l; }
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};

/* content: dense horizontal lines across the sheet + one long closed shape + one small closed shape */
function makeContent() {
  const paths = [];
  for (let y = 10; y <= 290; y += 8) paths.push({ pts: [[5, y], [205, y]], closed: false, layer: 0 });
  /* small square fully inside the default rect region (cx105 cy148 120x90) */
  paths.push({ pts: [[95, 138], [115, 138], [115, 158], [95, 158]], closed: true, layer: 2 });
  return { paths };
}
function blob(cx, cy, r, seed) {
  const rng = mulberry32(seed);
  const k = []; for (let i = 0; i < 8; i++) k.push(0.7 + rng() * 0.6);
  const pts = [];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const f = a / (Math.PI * 2) * 8;
    const i0 = Math.floor(f) % 8, i1 = (i0 + 1) % 8, t = f - Math.floor(f);
    pts.push([cx + Math.cos(a) * r * (k[i0] * (1 - t) + k[i1] * t), cy + Math.sin(a) * r * (k[i0] * (1 - t) + k[i1] * t)]);
  }
  return pts;
}
const POTATO = { paths: [{ pts: blob(105, 148, 45, 5), closed: true, layer: 3 }] };
const CONTENT = makeContent();

/* geometry oracles */
function insidePoly(poly, x, y) {
  let inn = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inn = !inn;
  }
  return inn;
}
function distToPoly(poly, x, y) {
  let bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    bd = Math.min(bd, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return bd;
}

/* T1: wired potato, keep inside — every output point inside potato (tol), original outside points gone */
{
  const p = { ...defaults(), shape: "Wired region", keep: "Inside" };
  const r = N.compute([CONTENT, POTATO], p, CTX, {});
  const poly = POTATO.paths[0].pts;
  let bad = 0, maxD = 0;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (!insidePoly(poly, q[0], q[1])) {
      const d = distToPoly(poly, q[0], q[1]);
      maxD = Math.max(maxD, d);
      if (d > 0.05) bad++; /* boundary points may sit epsilon outside */
    }
  }
  check("T1 wired inside: all points within potato (0.05 mm tol)", bad === 0, bad + " bad, worst " + maxD.toFixed(3) + " mm");
  check("T1 produced content", r.paths.length > 3, r.paths.length + " paths");
}

/* T2: inside + outside partition — lengths sum to original (open lines only) */
{
  const p = { ...defaults(), shape: "Wired region" };
  const openOnly = { paths: CONTENT.paths.filter((pa) => !pa.closed) };
  const rIn = N.compute([openOnly, POTATO], { ...p, keep: "Inside" }, CTX, {});
  const rOut = N.compute([openOnly, POTATO], { ...p, keep: "Outside" }, CTX, {});
  const orig = totalLen(openOnly), sum = totalLen(rIn) + totalLen(rOut);
  check("T2 inside+outside lengths ~= original", Math.abs(sum - orig) < orig * 0.005,
    sum.toFixed(1) + " vs " + orig.toFixed(1) + " mm");
}

/* T3: cut points sit on the region boundary (bisection accuracy) */
{
  const p = { ...defaults(), shape: "Wired region", keep: "Inside" };
  const openOnly = { paths: CONTENT.paths.filter((pa) => !pa.closed) };
  const r = N.compute([openOnly, POTATO], p, CTX, {});
  const poly = POTATO.paths[0].pts;
  let worst = 0;
  for (const pa of r.paths) {
    worst = Math.max(worst, distToPoly(poly, pa.pts[0][0], pa.pts[0][1]));
    worst = Math.max(worst, distToPoly(poly, pa.pts[pa.pts.length - 1][0], pa.pts[pa.pts.length - 1][1]));
  }
  check("T3 endpoints on boundary (< 0.05 mm)", worst < 0.05, worst.toFixed(4) + " mm");
}

/* T4: fully-inside closed path stays closed; potato input untouched */
{
  const p = { ...defaults(), shape: "Wired region", keep: "Inside" };
  const snap = JSON.stringify([CONTENT, POTATO]);
  const r = N.compute([CONTENT, POTATO], p, CTX, {});
  check("T4 inner closed square stays closed", r.paths.some((pa) => pa.closed && pa.layer === 2));
  check("T4 inputs untouched", JSON.stringify([CONTENT, POTATO]) === snap);
}

/* T5: gap monotonic — kept-inside length grows with gap */
{
  const p = { ...defaults(), shape: "Wired region", keep: "Inside" };
  const openOnly = { paths: CONTENT.paths.filter((pa) => !pa.closed) };
  const lens = [-8, -3, 0, 3, 8].map((g) =>
    totalLen(N.compute([openOnly, POTATO], { ...p, gap: g }, CTX, {})));
  let mono = true;
  for (let i = 1; i < lens.length; i++) if (lens[i] < lens[i - 1] - 1e-6) mono = false;
  check("T5 gap grows kept length monotonically", mono, lens.map((l) => l.toFixed(0)).join(" -> "));
}

/* T6: parametric shapes — circle radius honored, rect W/H honored, triangle has 3-fold region */
{
  const openOnly = { paths: CONTENT.paths.filter((pa) => !pa.closed) };
  const pC = { ...defaults(), shape: "Circle", cx: 105, cy: 148, cr: 40, keep: "Inside" };
  const rC = N.compute([openOnly, undefined], pC, CTX, {});
  let maxR = 0;
  for (const pa of rC.paths) for (const q of pa.pts) maxR = Math.max(maxR, Math.hypot(q[0] - 105, q[1] - 148));
  check("T6 circle: max point radius <= R + 0.05", maxR <= 40.05, maxR.toFixed(3));
  const pR = { ...defaults(), shape: "Rectangle", cx: 105, cy: 148, rw: 80, rh: 60, rot: 0, keep: "Inside" };
  const rR = N.compute([openOnly, undefined], pR, CTX, {});
  let ok = true;
  for (const pa of rR.paths) for (const q of pa.pts) {
    if (q[0] < 65 - 0.05 || q[0] > 145 + 0.05 || q[1] < 118 - 0.05 || q[1] > 178 + 0.05) ok = false;
  }
  check("T6 rect: all points inside W\u00d7H box", ok);
  /* rotated rect: corners of the kept extent rotate */
  const rR45 = N.compute([openOnly, undefined], { ...pR, rot: 45 }, CTX, {});
  check("T6 rect rot=45 differs from rot=0", JSON.stringify(rR45) !== JSON.stringify(rR));
  const pT = { ...defaults(), shape: "Triangle", cx: 105, cy: 148, cr: 50, keep: "Inside" };
  const rT = N.compute([openOnly, undefined], pT, CTX, {});
  let maxRT = 0;
  for (const pa of rT.paths) for (const q of pa.pts) maxRT = Math.max(maxRT, Math.hypot(q[0] - 105, q[1] - 148));
  check("T6 triangle: bounded by circumradius", maxRT <= 50.05, maxRT.toFixed(2));
  check("T6 triangle smaller than its circumcircle", totalLen(rT) < totalLen(rC) / (40 * 40) * (50 * 50) * 0.9);
}

/* T7: wired mode with empty region -> exact passthrough */
{
  const p = { ...defaults(), shape: "Wired region" };
  const r = N.compute([CONTENT, undefined], p, CTX, {});
  check("T7 unwired region passes content through", JSON.stringify(r) === JSON.stringify(CONTENT));
}

/* T8: multiple wired regions -> union */
{
  const TWO = { paths: [
    { pts: blob(60, 80, 25, 5), closed: true, layer: 0 },
    { pts: blob(150, 220, 25, 9), closed: true, layer: 0 },
  ] };
  const p = { ...defaults(), shape: "Wired region", keep: "Inside" };
  const openOnly = { paths: CONTENT.paths.filter((pa) => !pa.closed) };
  const r = N.compute([openOnly, TWO], p, CTX, {});
  let nearA = 0, nearB = 0;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (Math.hypot(q[0] - 60, q[1] - 80) < 40) nearA++;
    if (Math.hypot(q[0] - 150, q[1] - 220) < 40) nearB++;
  }
  check("T8 union of two regions: content in both", nearA > 0 && nearB > 0, nearA + " / " + nearB);
}

/* T9: draw region adds the outline on region pen */
{
  const p = { ...defaults(), shape: "Circle", draw: true, regionPen: 5, keep: "Inside" };
  const r = N.compute([CONTENT, undefined], p, CTX, {});
  check("T9 region outline plotted on pen 5", r.paths.some((pa) => pa.closed && pa.layer === 5));
}

/* T10: determinism (no seed -> two runs identical) */
{
  const p = { ...defaults(), shape: "Wired region" };
  const a = JSON.stringify(N.compute([CONTENT, POTATO], p, CTX, {}));
  const b = JSON.stringify(N.compute([CONTENT, POTATO], p, CTX, {}));
  check("T10 deterministic", a === b);
}

/* T11: extremes — giant gap, negative gap swallowing region, degenerate params */
{
  let ok = true, why = "";
  for (const over of [
    { shape: "Wired region", gap: 20 }, { shape: "Wired region", gap: -20 },
    { shape: "Circle", cr: 2 }, { shape: "Rectangle", rw: 5, rh: 5 },
    { shape: "Triangle", cr: 2, rot: 720 }, { shape: "Circle", cr: 250, gap: -20 },
  ]) {
    const p = { ...defaults(), ...over };
    const r = N.compute([CONTENT, POTATO], p, CTX, {});
    for (const pa of r.paths) for (const q of pa.pts) {
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { ok = false; why = JSON.stringify(over); }
    }
  }
  check("T11 extreme sweep finite, no crash", ok, why || "clean");
}

if (fails) process.exitCode = 1;

/* T12 (appended): overlay contract — wired guides with ins, [] without, parametric unaffected */
{
  const p = { ...defaults(), shape: "Wired region" };
  const gNo = N.overlay(p, CTX);                       /* old engine: 2 args */
  const gYes = N.overlay(p, CTX, [CONTENT, POTATO]);   /* patched engine: 3 args */
  const ok1 = Array.isArray(gNo) && gNo.length === 0;
  const ok2 = Array.isArray(gYes) && gYes.length === 1 && gYes[0].kind === "poly" && gYes[0].pts.length === 90;
  console.log((ok1 ? "OK  " : "FAIL") + " T12 wired overlay: [] without ins");
  console.log((ok2 ? "OK  " : "FAIL") + " T12 wired overlay: 1 poly guide with ins  [" + (gYes || []).length + "]");
  const gC = N.overlay({ ...defaults(), shape: "Circle" }, CTX);
  const ok3 = gC.length === 1 && gC[0].kind === "circle";
  console.log((ok3 ? "OK  " : "FAIL") + " T12 parametric overlay unaffected");
  if (!ok1 || !ok2 || !ok3) process.exitCode = 1;
}
console.log(process.exitCode ? "\nFAILURES PRESENT" : "\nALL PASS");
