/* validate-sliderule.js — math invariants: tick positions ARE the scale math */
const fs = require("fs");
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x,y,s){return 0.5;}
function noise2(x,y,s){return 0.5;}
function resample(pts){return pts;}
const pathLength=(pts)=>{let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return l;};
const applyStyle=(ps)=>ps, signedArea=()=>0;
const SFONT={" ":{w:6,s:[]}};
const fontStrokes=(str,size,track)=>{const sc=size/10,out=[];let x=0;for(const ch of String(str)){if(ch!==" ")out.push([[x,0],[x+6*sc,10*sc]]);x+=8*sc*(track||1);}return{strokes:out,width:x};};
const H_ = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea, SFONT, fontStrokes };
const N = new Function(...Object.keys(H_), '"use strict"; return (' + fs.readFileSync(__dirname + "/sliderule.plotternode.js","utf8") + ");")(...Object.values(H_));

const CTX = { W: 297, H: 210 }; /* landscape, natural for a rule */
function defaults() { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; }
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};
const lg = (v) => Math.log(v) / Math.LN10;

/* isolate one straight scale: run with only that scale, no numerals/frame/cursor */
const oneScale = (key) => {
  const p = { ...defaults(), numbers: false, frame: false, cursor: false,
    scA: false, scB: false, scCI: false, scC: false, scD: false, scK: false, scL: false, scS: false, scT: false };
  p[key] = true;
  return { r: N.compute([undefined], p, CTX, {}), p };
};
/* extract ticks of a straight single-scale run: vertical segments off the baseline */
const straightTicks = (r) => {
  const base = r.paths.find((pa) => Math.abs(pa.pts[0][1] - pa.pts[1][1]) < 1e-9 && pathLength(pa.pts) > 50);
  const [bx0, bx1] = [Math.min(base.pts[0][0], base.pts[1][0]), Math.max(base.pts[0][0], base.pts[1][0])];
  const ticks = r.paths
    .filter((pa) => pa !== base && Math.abs(pa.pts[0][0] - pa.pts[1][0]) < 1e-9)
    .map((pa) => ({ pos: (pa.pts[0][0] - bx0) / (bx1 - bx0), h: pathLength(pa.pts) }));
  return { ticks, len: bx1 - bx0 };
};
const majorsOf = (ticks) => {
  const hMax = Math.max(...ticks.map((t) => t.h));
  return ticks.filter((t) => t.h > hMax * 0.9).map((t) => t.pos).sort((a, b) => a - b);
};

/* T1: C/D majors at log10(1..10) */
{
  for (const key of ["scC", "scD"]) {
    const { r } = oneScale(key);
    const majors = majorsOf(straightTicks(r).ticks);
    const want = [1,2,3,4,5,6,7,8,9,10].map(lg);
    let worst = 0;
    const ok = majors.length === 10 && majors.every((mp, i) => { worst = Math.max(worst, Math.abs(mp - want[i])); return Math.abs(mp - want[i]) < 1e-6; });
    check("T1 " + key + " majors = log10(1..10)", ok, majors.length + " majors, worst err " + worst.toExponential(1));
  }
}

/* T2: A scale majors at log10(v)/2 across two decades (19 majors) */
{
  const { r } = oneScale("scA");
  const majors = majorsOf(straightTicks(r).ticks);
  const want = [];
  for (let v = 1; v <= 9; v++) want.push(lg(v) / 2);
  for (let v = 1; v <= 10; v++) want.push((1 + lg(v)) / 2);
  want.sort((a, b) => a - b);
  const ok = majors.length === want.length && majors.every((mp, i) => Math.abs(mp - want[i]) < 1e-6);
  check("T2 A majors = log10(v)/2 over two decades", ok, majors.length + "/" + want.length);
}

/* T3: K three decades (28 majors) */
{
  const { r } = oneScale("scK");
  const majors = majorsOf(straightTicks(r).ticks);
  check("T3 K has 28 majors (3 decades)", majors.length === 28, majors.length);
  const err = Math.abs(majors[10] - (1 + lg(2)) / 3); /* value 2 of decade 2 */
  check("T3 K decade-2 '2' at (1+log2)/3", err < 1e-6, err.toExponential(1));
}

/* T4: CI = mirror of C (position sets equal under pos -> 1-pos) */
{
  const mC = majorsOf(straightTicks(oneScale("scC").r).ticks);
  const mCI = majorsOf(straightTicks(oneScale("scCI").r).ticks).map((v) => 1 - v).sort((a, b) => a - b);
  const ok = mC.length === mCI.length && mC.every((v, i) => Math.abs(v - mCI[i]) < 1e-6);
  check("T4 CI is the exact mirror of C", ok);
}

/* T5: L linear — equal major spacing */
{
  const majors = majorsOf(straightTicks(oneScale("scL").r).ticks);
  let ok = majors.length === 11, spread = 0;
  for (let i = 1; i < majors.length; i++) spread = Math.max(spread, Math.abs((majors[i] - majors[i - 1]) - 0.1));
  check("T5 L: 11 majors, spacing exactly 0.1", ok && spread < 1e-9, majors.length + " majors, spread " + spread.toExponential(1));
}

/* T6: S majors at 1+log10(sin) for the standard angle set; ends at 0 and 1 */
{
  const majors = majorsOf(straightTicks(oneScale("scS").r).ticks);
  const angles = [6,7,8,9,10,12,14,16,18,20,25,30,40,50,60,70,80,90];
  const want = angles.map((a) => 1 + lg(Math.sin(a * Math.PI / 180))).sort((x, y) => x - y);
  const ok = majors.length === want.length && majors.every((mp, i) => Math.abs(mp - want[i]) < 1e-6);
  check("T6 S majors = 1+log10(sin th)", ok, majors.length + "/" + want.length);
  check("T6 S ends: sin90 at pos 1", Math.abs(majors[majors.length - 1] - 1) < 1e-9);
}

/* T7: tick gap floor respected on the densest scale (C) */
{
  const { ticks, len } = straightTicks(oneScale("scC").r);
  const xs = ticks.map((t) => t.pos * len).sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < xs.length; i++) minGap = Math.min(minGap, xs[i] - xs[i - 1]);
  const p = defaults();
  check("T7 min tick gap >= Min tick gap", minGap >= p.tickMin - 1e-6, minGap.toFixed(3) + " mm vs " + p.tickMin);
  check("T7 C is dense (>80 ticks)", ticks.length > 80, ticks.length + " ticks");
}

/* T8: circular — C majors at angles 2pi*log10(v) on the outer ring */
{
  const p = { ...defaults(), style: "Circular", numbers: false, frame: false, cursor: false,
    scA: false, scB: false, scCI: false, scC: true, scD: false, scK: false, scL: false, scS: false, scT: false };
  const r = N.compute([undefined], p, CTX, {});
  const circle = r.paths.find((pa) => pa.closed);
  let cx = 0, cy = 0;
  for (const q of circle.pts) { cx += q[0]; cy += q[1]; }
  cx /= circle.pts.length; cy /= circle.pts.length;
  const ticks = r.paths.filter((pa) => !pa.closed && pa.pts.length === 2);
  const hMax = Math.max(...ticks.map((pa) => pathLength(pa.pts)));
  const majors = ticks.filter((pa) => pathLength(pa.pts) > hMax * 0.9)
    .map((pa) => {
      const a = Math.atan2(pa.pts[0][1] - cy, pa.pts[0][0] - cx);
      let f = (a + Math.PI / 2) / (Math.PI * 2);
      f = ((f % 1) + 1) % 1;
      return f;
    }).sort((a, b) => a - b);
  const want = [1,2,3,4,5,6,7,8,9].map(lg).sort((a, b) => a - b); /* 1 and 10 coincide at angle 0 */
  let ok = true, worst = 0;
  for (const w of want) {
    const best = Math.min(...majors.map((mp) => Math.min(Math.abs(mp - w), 1 - Math.abs(mp - w))));
    worst = Math.max(worst, best);
    if (best > 1e-4) ok = false;
  }
  check("T8 circular C majors at 2pi*log10(v)", ok, "worst " + worst.toExponential(1) + ", " + majors.length + " majors");
}

/* T9: cursor spans all rows and moves with cursorPos; numerals add strokes */
{
  const p = { ...defaults() };
  const a = N.compute([undefined], p, CTX, {});
  const b = N.compute([undefined], { ...p, cursorPos: 80 }, CTX, {});
  const curA = a.paths.filter((pa) => pa.layer === Math.round(p.curPen));
  const curB = b.paths.filter((pa) => pa.layer === Math.round(p.curPen));
  check("T9 cursor present", curA.length === 1);
  check("T9 cursor moves with position", JSON.stringify(curA) !== JSON.stringify(curB));
  const noNum = N.compute([undefined], { ...p, numbers: false }, CTX, {});
  check("T9 numerals add strokes", a.paths.length > noNum.paths.length + 20, a.paths.length + " vs " + noNum.paths.length);
}

/* T10: in-margin, finite, budget, determinism (both styles, all scales on) */
{
  let ok = true, why = "";
  for (const style of ["Straight", "Circular"]) {
    const p = { ...defaults(), style, scA: true, scB: true, scCI: true, scC: true, scD: true, scK: true, scL: true, scS: true, scT: true };
    const r = N.compute([undefined], p, CTX, {});
    let total = 0;
    for (const pa of r.paths) {
      total += pa.pts.length;
      for (const q of pa.pts) {
        if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { ok = false; why = style + " nonfinite"; }
        if (q[0] < p.margin - 0.01 || q[0] > CTX.W - p.margin + 0.01 || q[1] < p.margin - 0.01 || q[1] > CTX.H - p.margin + 0.01) {
          ok = false; why = style + " off-margin (" + q[0].toFixed(1) + "," + q[1].toFixed(1) + ")";
        }
      }
    }
    if (total > 120000) { ok = false; why = style + " budget " + total; }
    const r2 = N.compute([undefined], p, CTX, {});
    if (JSON.stringify(r) !== JSON.stringify(r2)) { ok = false; why = style + " nondeterministic"; }
  }
  check("T10 all-scales both styles: finite, in-margin, budget, deterministic", ok, why || "clean");
}

/* T11: no scales enabled -> empty; tiny canvas no crash */
{
  const p = { ...defaults(), scA: false, scB: false, scCI: false, scC: false, scD: false, scK: false, scL: false, scS: false, scT: false };
  const r = N.compute([undefined], p, CTX, {});
  check("T11 no scales -> empty", r.paths.length === 0);
  const r2 = N.compute([undefined], defaults(), { W: 25, H: 25 }, {});
  check("T11 tiny canvas no crash", Array.isArray(r2.paths));
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
if (fails) process.exitCode = 1;
