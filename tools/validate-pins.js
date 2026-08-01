/* validate-pins.js */
const fs = require("fs");
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x,y,s){let h=Math.imul(Math.floor(x)^0x9e3779b9,2654435761);h^=Math.imul(Math.floor(y)^0x85ebca6b,2246822519);h^=Math.imul((s|0)^0xc2b2ae35,3266489917);h=(h^(h>>>15))>>>0;return h/4294967296;}
function noise2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
function resample(pts,closed,step){if(pts.length<2)return pts.map(p=>p.slice());const src=closed?[...pts,pts[0]]:pts;const out=[src[0].slice()];let acc=0;for(let i=1;i<src.length;i++){let[x0,y0]=src[i-1],[x1,y1]=src[i];let seg=Math.hypot(x1-x0,y1-y0);while(acc+seg>=step){const t=(step-acc)/seg;const nx=x0+(x1-x0)*t,ny=y0+(y1-y0)*t;out.push([nx,ny]);x0=nx;y0=ny;seg=Math.hypot(x1-x0,y1-y0);acc=0;}acc+=seg;}if(!closed)out.push(src[src.length-1].slice());return out;}
const pathLength=(pts)=>{let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return l;};
const applyStyle=(ps)=>ps, signedArea=()=>0;
const H_ = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const N = new Function(...Object.keys(H_), '"use strict"; return (' + fs.readFileSync(__dirname + "/pins.plotternode.js","utf8") + ");")(...Object.values(H_));

const CTX = { W: 210, H: 297 };
function defaults() { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; }
function countPts(r) { let n = 0; for (const pa of r.paths) n += pa.pts.length; return n; }
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};
/* group output into pins: shaft (open, shaftPen) followed by its head paths */
function groupPins(r, p) {
  const pins = [];
  let cur = null;
  for (const pa of r.paths) {
    if (!pa.closed && pa.layer === Math.round(p.shaftPen) && (pins.length === 0 || cur.heads.length > 0 || p.headFill !== "Spiral" || cur.spiral)) {
      cur = { shaft: pa, heads: [], spiral: null };
      pins.push(cur);
    } else if (!pa.closed && cur) {
      cur.spiral = pa; /* spiral stroke shares openness but sits on head pen */
    } else if (cur) {
      cur.heads.push(pa);
    }
  }
  return pins;
}

/* T1: defaults — finite, on-sheet within margin, budget, count */
{
  const p = defaults();
  const r = N.compute([undefined], p, CTX, {});
  let finite = true, maxOut = 0;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
    maxOut = Math.max(maxOut, p.margin - q[0], q[0] - (CTX.W - p.margin), p.margin - q[1], q[1] - (CTX.H - p.margin));
  }
  check("T1 finite", finite);
  check("T1 everything inside margin rect", maxOut <= 1e-9, "overshoot " + maxOut.toFixed(3) + " mm");
  check("T1 budget", countPts(r) < 120000, countPts(r) + " pts");
  const shafts = r.paths.filter((pa) => !pa.closed && pa.layer === p.shaftPen).length;
  /* spiral stroke is open on the head pen, so with default pens 0/1 shafts are exactly countable */
  check("T1 shaft count = pins", shafts === p.pins, shafts);
}

/* T2: shaft geometry — last shaft point sits on the ball edge, first is the tail */
{
  const p = { ...defaults(), headFill: "Outline", bend: 0, headVar: 0, lenVar: 0, chaos: 0.6 };
  const r = N.compute([undefined], p, CTX, {});
  const hr = p.headSize / 2;
  let ok = true, worst = 0;
  const shafts = r.paths.filter((pa) => !pa.closed);
  const heads = r.paths.filter((pa) => pa.closed);
  check("T2 one head per shaft", shafts.length === heads.length, shafts.length + "/" + heads.length);
  for (let i = 0; i < shafts.length; i++) {
    const s = shafts[i], h = heads[i];
    /* head center = mean of circle points */
    let cx = 0, cy = 0;
    for (const q of h.pts) { cx += q[0]; cy += q[1]; }
    cx /= h.pts.length; cy /= h.pts.length;
    const dEnd = Math.hypot(s.pts[s.pts.length - 1][0] - cx, s.pts[s.pts.length - 1][1] - cy);
    const dTail = Math.hypot(s.pts[0][0] - cx, s.pts[0][1] - cy);
    worst = Math.max(worst, Math.abs(dEnd - hr));
    if (Math.abs(dEnd - hr) > 0.02) ok = false;        /* shaft ends at ball edge */
    if (dTail < dEnd) ok = false;                       /* tail is the far end -> pen travels tail->head */
  }
  check("T2 shaft stops at ball edge (tail->head order)", ok, "max err " + worst.toFixed(4) + " mm");
}

/* T3: chaos=0 — perfect order: all angles equal to Angle, positions on grid */
{
  const p = { ...defaults(), chaos: 0, bend: 0, lenVar: 0, pins: 24, angle: 90 };
  const r = N.compute([undefined], p, CTX, {});
  const shafts = r.paths.filter((pa) => !pa.closed && pa.layer === p.shaftPen);
  let angOk = true;
  const angs = [];
  for (const s of shafts) {
    const a = Math.atan2(s.pts[s.pts.length - 1][1] - s.pts[0][1], s.pts[s.pts.length - 1][0] - s.pts[0][0]);
    angs.push(a);
    if (Math.abs(a - Math.PI / 2) > 1e-9) angOk = false;
  }
  check("T3 chaos=0: every shaft at exactly 90\u00b0", angOk);
  /* x positions repeat in columns */
  const xs = [...new Set(shafts.map((s) => s.pts[0][0].toFixed(4)))];
  check("T3 chaos=0: grid columns", xs.length <= Math.ceil(Math.sqrt(24 * CTX.W / CTX.H)) + 1, xs.length + " distinct x");
}

/* T4: chaos=1 — angles spread (not all equal) */
{
  const p = { ...defaults(), chaos: 1, pins: 60 };
  const r = N.compute([undefined], p, CTX, {});
  const shafts = r.paths.filter((pa) => !pa.closed && pa.layer === p.shaftPen);
  const angs = shafts.map((s) => Math.atan2(s.pts[s.pts.length - 1][1] - s.pts[0][1], s.pts[s.pts.length - 1][0] - s.pts[0][0]));
  const spread = Math.max(...angs) - Math.min(...angs);
  check("T4 chaos=1: angle spread > 180\u00b0", spread > Math.PI, (spread * 180 / Math.PI).toFixed(0) + "\u00b0");
}

/* T5: head fills */
{
  for (const [fill, minClosed] of [["Outline", 1], ["Rings", 2], ["Spiral", 1]]) {
    const p = { ...defaults(), headFill: fill, pins: 5, headSize: 6, headVar: 0 };
    const r = N.compute([undefined], p, CTX, {});
    const closed = r.paths.filter((pa) => pa.closed).length;
    const open = r.paths.filter((pa) => !pa.closed).length;
    const expOpen = fill === "Spiral" ? 10 : 5; /* spiral adds one open stroke per pin */
    check("T5 " + fill + ": closed>=" + minClosed * 5 + " open=" + expOpen,
      closed >= minClosed * 5 && open === expOpen, closed + " closed, " + open + " open");
  }
  /* spiral continuity: single stroke, monotone radius */
  const p = { ...defaults(), headFill: "Spiral", pins: 1, headSize: 8, headVar: 0, chaos: 0 };
  const r = N.compute([undefined], p, CTX, {});
  const spiral = r.paths.filter((pa) => !pa.closed && pa.layer === Math.round(p.headPen))[0];
  const head = r.paths.filter((pa) => pa.closed)[0];
  let cx = 0, cy = 0;
  for (const q of head.pts) { cx += q[0]; cy += q[1]; }
  cx /= head.pts.length; cy /= head.pts.length;
  let mono = true, prev = Infinity;
  for (const q of spiral.pts) {
    const d = Math.hypot(q[0] - cx, q[1] - cy);
    if (d > prev + 1e-6) mono = false;
    prev = d;
  }
  check("T5 spiral radius monotone inward, ends at center", mono && prev < 0.1, "end r=" + prev.toFixed(3));
}

/* T6: head pen cycling stays in declared range */
{
  const p = { ...defaults(), headPens: 4, headPen: 3, pins: 80 };
  const r = N.compute([undefined], p, CTX, {});
  const headLayers = new Set(r.paths.filter((pa) => pa.closed).map((pa) => pa.layer));
  const okRange = [...headLayers].every((L) => L >= 3 && L <= 6);
  check("T6 head pens within [start, start+n)", okRange, [...headLayers].sort((a, b) => a - b).join(","));
  check("T6 multiple head pens actually used", headLayers.size >= 2, headLayers.size + " pens");
}

/* T7: determinism + seed */
{
  const p = defaults();
  const a = JSON.stringify(N.compute([undefined], p, CTX, {}));
  const b = JSON.stringify(N.compute([undefined], p, CTX, {}));
  check("T7 deterministic", a === b);
  const c = JSON.stringify(N.compute([undefined], { ...p, seed: 4096 }, CTX, {}));
  check("T7 seed changes output", a !== c);
}

/* T8: per-pin stability — pin i identical when count grows */
{
  const p = { ...defaults(), pins: 10, chaos: 1 }; /* chaos=1: pose independent of grid */
  const a = N.compute([undefined], p, CTX, {});
  const b = N.compute([undefined], { ...p, pins: 20 }, CTX, {});
  const sa = a.paths.filter((pa) => !pa.closed && pa.layer === p.shaftPen);
  const sb = b.paths.filter((pa) => !pa.closed && pa.layer === p.shaftPen);
  let same = true;
  for (let i = 0; i < 10; i++) if (JSON.stringify(sa[i]) !== JSON.stringify(sb[i])) same = false;
  check("T8 first 10 pins stable when count 10->20 (chaos=1)", same);
}

/* T9: extremes — huge pins on tiny sheet, tiny margin box, wired-out-of-range values */
{
  let ok = true, why = "";
  for (const over of [
    { pins: 200, length: 100, headSize: 10, margin: 0 },
    { pins: 200, length: 100, margin: 60 },
    { pins: 1, length: 5, headSize: 0.5, chaos: 0, bend: 1 },
    { pins: 300, chaos: 2, bend: 5, angle: 720 }, /* wire-pushed values */
  ]) {
    const p = { ...defaults(), ...over };
    const r = N.compute([undefined], p, CTX, {});
    const m = Math.max(0, p.margin);
    for (const pa of r.paths) for (const q of pa.pts) {
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { ok = false; why = "nonfinite " + JSON.stringify(over); }
      if (q[0] < m - 0.01 || q[0] > CTX.W - m + 0.01 || q[1] < m - 0.01 || q[1] > CTX.H - m + 0.01) {
        ok = false; why = "off-margin " + JSON.stringify(over);
      }
    }
    if (countPts(r) >= 120000) { ok = false; why = "budget " + JSON.stringify(over); }
  }
  check("T9 extreme sweep clean", ok, why || "clean");
}

/* T10: tiny sheet does not crash */
{
  const p = defaults();
  const r = N.compute([undefined], p, { W: 20, H: 20 }, {});
  check("T10 tiny sheet ok", Array.isArray(r.paths));
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
process.exit(fails ? 1 : 0);
