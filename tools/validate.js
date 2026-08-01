/* Wind Tunnel validation harness (per MUUSIA-NODE-API.md section 9) */
const fs = require("fs");
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x,y,s){let h=Math.imul(Math.floor(x)^0x9e3779b9,2654435761);h^=Math.imul(Math.floor(y)^0x85ebca6b,2246822519);h^=Math.imul((s|0)^0xc2b2ae35,3266489917);h=(h^(h>>>15))>>>0;return h/4294967296;}
function noise2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
function resample(pts,closed,step){if(pts.length<2)return pts.map(p=>p.slice());const src=closed?[...pts,pts[0]]:pts;const out=[src[0].slice()];let acc=0;for(let i=1;i<src.length;i++){let[x0,y0]=src[i-1],[x1,y1]=src[i];let seg=Math.hypot(x1-x0,y1-y0);while(acc+seg>=step){const t=(step-acc)/seg;const nx=x0+(x1-x0)*t,ny=y0+(y1-y0)*t;out.push([nx,ny]);x0=nx;y0=ny;seg=Math.hypot(x1-x0,y1-y0);acc=0;}acc+=seg;}if(!closed)out.push(src[src.length-1].slice());return out;}
const pathLength=(pts)=>{let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return l;};
const applyStyle=(ps)=>ps, signedArea=(pts)=>{let a=0;for(let i=0,j=pts.length-1;i<pts.length;j=i++)a+=(pts[j][0]*pts[i][1]-pts[i][0]*pts[j][1]);return a/2;};
const H_ = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const N = new Function(...Object.keys(H_), '"use strict"; return (' + fs.readFileSync(__dirname + "/windtunnel.plotternode.js","utf8") + ");")(...Object.values(H_));

const CTX = { W: 210, H: 297 };

/* synthetic potato: seeded blobby closed polygon */
function blob(cx, cy, r, seed) {
  const rng = mulberry32(seed);
  const k = [];
  for (let i = 0; i < 8; i++) k.push(0.7 + rng() * 0.6);
  const pts = [];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    /* smooth radial modulation from 8 control radii */
    const f = a / (Math.PI * 2) * 8;
    const i0 = Math.floor(f) % 8, i1 = (i0 + 1) % 8, t = f - Math.floor(f);
    const rr = r * (k[i0] * (1 - t) + k[i1] * t);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
const OB1 = { paths: [{ pts: blob(105, 150, 30, 5), closed: true, layer: 2 }] };
const OB2 = { paths: [
  { pts: blob(70, 110, 22, 5), closed: true, layer: 2 },
  { pts: blob(140, 190, 26, 9), closed: true, layer: 3 },
] };

function defaults() {
  const p = {};
  for (const pr of N.params) p[pr.key] = pr.def;
  return p;
}
function countPts(r) { let n = 0; for (const pa of r.paths) n += pa.pts.length; return n; }
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
    const px = ax + dx * t, py = ay + dy * t;
    bd = Math.min(bd, Math.hypot(x - px, y - py));
  }
  return bd;
}

let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};

/* T1: basic run, finite, on-sheet within margin, budget */
{
  const p = defaults();
  const r = N.compute([OB1, undefined], p, CTX, {});
  let finite = true, onSheet = true;
  const m = p.margin;
  for (const pa of r.paths) {
    /* the kept obstacle is exempt from the margin test (it is the input) */
    const isObstacle = pa.closed;
    for (const q of pa.pts) {
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
      if (!isObstacle && (q[0] < m - 1e-6 || q[0] > CTX.W - m + 1e-6 || q[1] < m - 1e-6 || q[1] > CTX.H - m + 1e-6)) onSheet = false;
    }
  }
  check("T1 finite coords", finite);
  check("T1 flow within margin rect", onSheet);
  check("T1 point budget < 120k", countPts(r) < 120000, countPts(r) + " pts");
  check("T1 produced flow paths", r.paths.filter((pa) => !pa.closed).length >= p.lines * 0.5, r.paths.length + " paths");
  check("T1 keep shape passes obstacle through", r.paths.some((pa) => pa.closed && pa.layer === 2));
}

/* T2: no flow point inside the obstacle, clearance respected */
{
  const p = defaults();
  for (const clr of [0, 0.5, 1, 3]) {
    p.clearance = clr;
    const r = N.compute([OB1, undefined], p, CTX, {});
    let minD = Infinity, insideCount = 0;
    for (const pa of r.paths) {
      if (pa.closed) continue;
      for (const q of pa.pts) {
        if (insidePoly(OB1.paths[0].pts, q[0], q[1])) insideCount++;
        minD = Math.min(minD, distToPoly(OB1.paths[0].pts, q[0], q[1]));
      }
    }
    check("T2 clr=" + clr + " no flow points inside obstacle", insideCount === 0, insideCount + " inside, minD=" + minD.toFixed(2));
    if (clr >= 1) check("T2 clr=" + clr + " min distance >= 40% of clearance", minD >= clr * 0.4, minD.toFixed(2) + " mm");
  }
}

/* T3: determinism */
{
  const p = defaults();
  const a = JSON.stringify(N.compute([OB1, undefined], p, CTX, {}));
  const b = JSON.stringify(N.compute([OB1, undefined], p, CTX, {}));
  check("T3 deterministic", a === b);
}

/* T4: seed changes output (with waviness+wake active) */
{
  const p = defaults();
  p.waviness = 0.3; p.wake = 0.6;
  const a = JSON.stringify(N.compute([OB1, undefined], p, CTX, {}));
  p.seed = 999;
  const b = JSON.stringify(N.compute([OB1, undefined], p, CTX, {}));
  check("T4 seed changes output", a !== b);
}

/* T5: unwired obstacle -> plain flow lines, no crash */
{
  const p = defaults();
  const r = N.compute([undefined, undefined], p, CTX, {});
  check("T5 unwired input works", r.paths.length >= p.lines * 0.5, r.paths.length + " paths");
}

/* T6: multiple obstacles, several seeds and angles, extreme params */
{
  let allOk = true, worst = "";
  for (const seed of [1, 19, 73, 4096]) {
    for (const angle of [0, 45, 90, 180, 270, 333]) {
      const p = defaults();
      p.seed = seed; p.angle = angle; p.wake = 1; p.waviness = 1; p.lines = 60;
      const r = N.compute([OB2, undefined], p, CTX, {});
      let inn = 0;
      for (const pa of r.paths) {
        if (pa.closed) continue;
        for (const q of pa.pts) {
          if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { inn = -1; break; }
          for (const ob of OB2.paths) if (insidePoly(ob.pts, q[0], q[1])) inn++;
        }
      }
      if (inn !== 0) { allOk = false; worst = "seed=" + seed + " angle=" + angle + " -> " + inn; }
      if (countPts(r) >= 120000) { allOk = false; worst = "budget seed=" + seed; }
    }
  }
  check("T6 multi-obstacle sweep (24 combos): finite, outside, budget", allOk, worst || "clean");
}

/* T7: extreme values wires could push (step tiny, lines huge) stay under budget */
{
  const p = defaults();
  p.lines = 300; p.step = 0.1;
  const r = N.compute([OB1, undefined], p, CTX, {});
  check("T7 budget guard at lines=300 step=0.1", countPts(r) < 120000, countPts(r) + " pts");
}

/* T8: input not mutated */
{
  const p = defaults();
  const snapshot = JSON.stringify(OB1);
  N.compute([OB1, undefined], p, CTX, {});
  check("T8 input untouched", JSON.stringify(OB1) === snapshot);
}

/* T9: timing at defaults */
{
  const p = defaults();
  const t0 = process.hrtime.bigint();
  N.compute([OB1, undefined], p, CTX, {});
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check("T9 compute time < 150 ms (defaults)", ms < 150, ms.toFixed(1) + " ms");
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
process.exit(fails ? 1 : 0);
