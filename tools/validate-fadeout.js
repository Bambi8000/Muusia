/* validate-fadeout.js — pen-lift tail invariants */
const fs = require("fs");
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = [];
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const hash2=()=>0.5,noise2=()=>0.5,resample=(pts)=>pts;
const pathLength=(pts)=>{let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return l;};
const applyStyle=(ps)=>ps, signedArea=()=>0;
const SFONT={}, fontStrokes=()=>({strokes:[],width:0});
const H_ = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea, SFONT, fontStrokes };
const N = new Function(...Object.keys(H_), '"use strict"; return (' + fs.readFileSync(__dirname + "/fadeout.plotternode.js","utf8") + ");")(...Object.values(H_));

const CTX = { W: 210, H: 297 };
function defaults() { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; }
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};
/* test input: one long horizontal stroke, one short, one closed square, one with Brush-Z z */
const straight = { pts: Array.from({ length: 21 }, (_, i) => [20 + i * 4, 100]), closed: false, layer: 1 };
const short = { pts: [[10, 10], [12, 10]], closed: false, layer: 0 };
const square = { pts: [[50, 50], [90, 50], [90, 90], [50, 90]], closed: true, layer: 2 };
const withZ = { pts: Array.from({ length: 21 }, (_, i) => [20 + i * 4, 200, 0.5]), closed: false, layer: 3 };
const INPUT = { paths: [straight, short, square, withZ] };
const run = (over) => N.compute([JSON.parse(JSON.stringify(INPUT))], { ...defaults(), vary: 0, ...over }, CTX, {});

/* T1: closed + short pass through byte-identical */
{
  const r = run({});
  check("T1 closed square untouched", JSON.stringify(r.paths[2]) === JSON.stringify(square));
  check("T1 short stroke untouched", JSON.stringify(r.paths[1]) === JSON.stringify(short));
  check("T1 layers preserved", r.paths[0].layer === 1 && r.paths[3].layer === 3);
}

/* T2: End default — prefix XY unchanged, tip z = -lift, extension length/straightness */
{
  const p = defaults();
  const r = run({});
  const out = r.paths[0].pts;
  /* original stroke: 80mm long, fade 10 -> untouched until x=90mm arc = x coord 20+70=90 */
  const pre = out.filter((q) => q[0] <= 90 + 1e-6);
  check("T2 prefix stays on the line y=100", pre.every((q) => Math.abs(q[1] - 100) < 1e-9));
  check("T2 prefix carries no z", pre.every((q) => q.length === 2 || q[2] === undefined));
  const tip = out[out.length - 1];
  check("T2 tail tip z = -lift exactly", Math.abs(tip[2] + p.lift) < 1e-9, tip[2]);
  /* extension: beyond original end x=100, straight along +x at y=100 */
  const extPts = out.filter((q) => q[0] > 100 + 1e-6);
  check("T2 extension present and straight", extPts.length >= 5 && extPts.every((q) => Math.abs(q[1] - 100) < 1e-9), extPts.length + " pts");
  check("T2 extension length = ext", Math.abs(tip[0] - 100 - p.ext) < 1e-6, (tip[0] - 100).toFixed(3));
}

/* T3: z monotonic non-increasing along the tail (Linear) */
{
  const r = run({ shape: "Linear" });
  const out = r.paths[0].pts;
  let ok = true, last = 0;
  for (const q of out) {
    const z = q[2] === undefined ? 0 : q[2];
    if (z > last + 1e-9) ok = false;
    last = z;
  }
  check("T3 z monotonic non-increasing (End, Linear)", ok);
}

/* T4: ramp ordering at mid-tail: |Long| < |Linear| < |Quick| */
{
  const zAtMid = (shape) => {
    const out = run({ shape, ext: 10, fade: 10 }).paths[0].pts;
    /* mid of combined domain = arc total-10+10 = original end x=100 (u=0.5) */
    const q = out.find((qq) => Math.abs(qq[0] - 100) < 0.5 && qq[2] !== undefined);
    return Math.abs(q[2]);
  };
  const lo = zAtMid("Long"), li = zAtMid("Linear"), qu = zAtMid("Quick");
  check("T4 ramp ordering |Long| < |Linear| < |Quick| at u=0.5", lo < li && li < qu,
    lo.toFixed(2) + " < " + li.toFixed(2) + " < " + qu.toFixed(2));
}

/* T5: Start mode — leading extension tip has max lift, z rises to 0; end untouched */
{
  const p = defaults();
  const r = run({ where: "Start" });
  const out = r.paths[0].pts;
  check("T5 start tip z = -lift", Math.abs(out[0][2] + p.lift) < 1e-9, out[0][2]);
  check("T5 start tip extends before stroke", out[0][0] < 20 - p.ext + 1e-6, out[0][0]);
  let ok = true, last = -1e9;
  for (const q of out) { const z = q[2] === undefined ? 0 : q[2]; if (z < last - 1e-9) ok = false; last = z; }
  check("T5 z monotonic rising to contact", ok);
  check("T5 original end preserved", out[out.length - 1][0] === 100 && out[out.length - 1].length === 2);
}

/* T6: Both — lifted at both tips, contact in the middle */
{
  const r = run({ where: "Both" });
  const out = r.paths[0].pts;
  const mid = out.filter((q) => q[0] > 55 && q[0] < 65);
  check("T6 both tips lifted", out[0][2] < -0.1 && out[out.length - 1][2] < -0.1);
  check("T6 middle at contact (no z)", mid.every((q) => q[2] === undefined || q[2] === 0), mid.length + " mid pts");
}

/* T7: fade=0 & ext=0 -> pass-through; ext-only appends without touching stroke */
{
  const r0 = run({ fade: 0, ext: 0 });
  check("T7 zero lengths = identity", JSON.stringify(r0.paths[0].pts) === JSON.stringify(straight.pts));
  const rE = run({ fade: 0, ext: 12 });
  const inside = rE.paths[0].pts.filter((q) => q[0] <= 100 + 1e-6 && q.length === 2);
  check("T7 ext-only keeps stroke XY untouched", inside.length >= straight.pts.length - 1);
  const tip = rE.paths[0].pts[rE.paths[0].pts.length - 1];
  check("T7 ext-only tail reaches full lift", Math.abs(tip[2] + defaults().lift) < 1e-9);
}

/* T8: variation seeded + deterministic; vary=0 exact */
{
  const a = JSON.stringify(N.compute([JSON.parse(JSON.stringify(INPUT))], { ...defaults(), vary: 0.5, seed: 3 }, CTX, {}));
  const b = JSON.stringify(N.compute([JSON.parse(JSON.stringify(INPUT))], { ...defaults(), vary: 0.5, seed: 4 }, CTX, {}));
  const c = JSON.stringify(N.compute([JSON.parse(JSON.stringify(INPUT))], { ...defaults(), vary: 0.5, seed: 3 }, CTX, {}));
  check("T8 seeds differ", a !== b);
  check("T8 deterministic", a === c);
}

/* T9: Brush-Z pressure survives outside the tail zone */
{
  const r = run({});
  const zp = r.paths[3].pts;
  const middle = zp.filter((q) => q[0] > 30 && q[0] < 85);
  check("T9 Brush-Z z=0.5 preserved mid-stroke", middle.length > 3 && middle.every((q) => Math.abs((q[2] || 0) - 0.5) < 1e-9), middle.length + " pts");
  const tip = zp[zp.length - 1];
  check("T9 lift overrides pressure in the tail", tip[2] < -1);
}

/* T10: finite + budget on a big field of strokes */
{
  const many = { paths: Array.from({ length: 400 }, (_, i) => ({
    pts: [[10 + (i % 20) * 9, 20 + Math.floor(i / 20) * 12], [10 + (i % 20) * 9, 45 + Math.floor(i / 20) * 12]],
    closed: false, layer: 0 })) };
  const r = N.compute([many], { ...defaults(), minLen: 5 }, CTX, {});
  let total = 0, ok = true;
  for (const pa of r.paths) { total += pa.pts.length; for (const q of pa.pts) if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) ok = false; }
  check("T10 400-stroke field finite, under budget", ok && total < 120000, total + " pts");
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
if (fails) process.exitCode = 1;
