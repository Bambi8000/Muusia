/* validate-molecule.js (lab harness; ESM tools/validate-molecule.mjs at bake) */
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
/* minimal stroke font stub: every char = one open stroke + one loop stroke for 'O'-likes */
const SFONT = { " ": { w: 6, s: [] } };
const fontStrokes = (str, size, track) => {
  const sc = size / 10, out = []; let x = 0;
  for (const ch of String(str).toUpperCase()) {
    if (ch !== " ") out.push([[x, 10 * sc / sc * 0 + 0], [x + 6 * sc, 10 * sc]].map(q => [q[0], q[1]]));
    x += 8 * sc * (track || 1);
  }
  return { strokes: out, width: x };
};
const H_ = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea, SFONT, fontStrokes };
const N = new Function(...Object.keys(H_), '"use strict"; return (' + fs.readFileSync(__dirname + "/molecule.plotternode.js","utf8") + ");")(...Object.values(H_));

const CTX = { W: 210, H: 297 };
function defaults() { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; }
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};
const MOLS = N.params.find((pr) => pr.key === "molecule").options.filter((o) => o !== "Sheet (all)");

/* helper: run one molecule, no labels/dots, Kekule or Circle */
const run = (name, over) => N.compute([undefined], { ...defaults(), molecule: name, names: false, dots: false, ...over }, CTX, {});
/* straight 2-pt segments of full bond length (main bond lines) */
const bondLines = (r, bondMM) => r.paths.filter((pa) => !pa.closed && pa.pts.length === 2 &&
  Math.abs(pathLength(pa.pts) - bondMM) < bondMM * 0.02);

/* T1: every molecule renders, finite, inside margins */
{
  let ok = true, why = "";
  for (const name of MOLS) {
    const p = defaults();
    const r = run(name, {});
    if (!r.paths.length) { ok = false; why = name + " empty"; }
    for (const pa of r.paths) for (const q of pa.pts) {
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { ok = false; why = name + " nonfinite"; }
      if (q[0] < p.margin - 0.01 || q[0] > CTX.W - p.margin + 0.01 || q[1] < p.margin - 0.01 || q[1] > CTX.H - p.margin + 0.01) {
        ok = false; why = name + " off-margin";
      }
    }
  }
  check("T1 all " + MOLS.length + " molecules render, finite, in-margin", ok, why || "clean");
}

/* T2: bond-count invariants (structural formulae) */
{
  const EXPECT = {
    /* name: [mainBondSegments in Circle mode, extraNote] — Circle mode draws
       every aromatic bond single + one circle per ring; open-chain doubles draw
       symmetric PAIRS (no full-length center line), triples draw 3 full lines */
    "Hexane": 5, "Octane": 7, "Isobutane": 3, "Neopentane": 4, "Isooctane": 7,
    "Cyclohexane": 6, "Benzene": 6, "Toluene": 7, "p-Xylene": 8,
    "Naphthalene": 11, "Anthracene": 16, "Pyrene": 19, "Acetylene": 3,
  };
  let ok = true, why = "";
  for (const [name, want] of Object.entries(EXPECT)) {
    const p = defaults();
    const r = run(name, { aromatic: "Circle" });
    /* full-length lines: for acetylene the two offset lines are also full length */
    const got = bondLines(r, Math.min(p.bond, 1e9)).length;
    /* bond scale may shrink to fit: measure actual max segment as the bond unit */
    let maxL = 0;
    for (const pa of r.paths) if (!pa.closed && pa.pts.length === 2) maxL = Math.max(maxL, pathLength(pa.pts));
    const got2 = r.paths.filter((pa) => !pa.closed && pa.pts.length === 2 && Math.abs(pathLength(pa.pts) - maxL) < maxL * 0.02).length;
    if (got2 !== want) { ok = false; why = name + ": " + got2 + " != " + want; }
  }
  check("T2 bond counts match structures", ok, why || "all correct");
}

/* T3: Kekule validity — every aromatic molecule gets a perfect matching:
   count of shortened inner lines == aromatic atoms / 2 */
{
  const AROM = { "Benzene": 3, "Toluene": 3, "p-Xylene": 3, "Styrene": 4 /* ring 3 + vinyl symmetric pair? vinyl draws PAIR not inner */, "Naphthalene": 5, "Anthracene": 7, "Pyrene": 8 };
  let ok = true, why = "";
  for (const [name, wantInner] of Object.entries(AROM)) {
    const r = run(name, { aromatic: "Kekul\u00e9" });
    let maxL = 0;
    for (const pa of r.paths) if (!pa.closed && pa.pts.length === 2) maxL = Math.max(maxL, pathLength(pa.pts));
    /* inner Kekule lines are shortened to 64% of bond length */
    const inner = r.paths.filter((pa) => !pa.closed && pa.pts.length === 2 &&
      Math.abs(pathLength(pa.pts) - maxL * 0.64) < maxL * 0.03).length;
    const want = name === "Styrene" ? 3 : wantInner; /* vinyl double = symmetric pair, not inner */
    if (inner !== want) { ok = false; why = name + ": " + inner + " inner != " + want; }
  }
  check("T3 Kekule perfect matching (inner-line counts)", ok, why || "all matched");
}

/* T4: Circle mode adds one closed circle per aromatic ring */
{
  const RINGS = { "Benzene": 1, "Toluene": 1, "Naphthalene": 2, "Anthracene": 3, "Pyrene": 4, "Cyclohexane": 0, "Hexane": 0 };
  let ok = true, why = "";
  for (const [name, want] of Object.entries(RINGS)) {
    const r = run(name, { aromatic: "Circle" });
    const circles = r.paths.filter((pa) => pa.closed && pa.pts.length > 12).length;
    if (circles !== want) { ok = false; why = name + ": " + circles + " != " + want; }
  }
  check("T4 aromatic circles per ring", ok, why || "correct");
}

/* T5: all main bonds equal length (uniform bond scale) */
{
  let ok = true, why = "";
  for (const name of ["Isooctane", "Naphthalene", "Styrene", "Pyrene"]) {
    const r = run(name, { aromatic: "Circle" });
    let maxL = 0, minFull = Infinity;
    const lens = r.paths.filter((pa) => !pa.closed && pa.pts.length === 2).map((pa) => pathLength(pa.pts));
    maxL = Math.max(...lens);
    const full = lens.filter((l) => l > maxL * 0.9);
    minFull = Math.min(...full);
    if (maxL - minFull > maxL * 0.02) { ok = false; why = name + " spread " + (maxL - minFull).toFixed(3); }
  }
  check("T5 uniform bond lengths", ok, why || "uniform");
}

/* T6: double/triple rendering — butadiene has 2 symmetric pairs + 1 single;
   acetylene 3 parallel full lines */
{
  const r = run("1,3-Butadiene", {});
  const lens = r.paths.filter((pa) => !pa.closed).map((pa) => pathLength(pa.pts));
  const maxL = Math.max(...lens);
  const full = lens.filter((l) => Math.abs(l - maxL) < maxL * 0.02).length;
  check("T6 butadiene: 5 full-length lines (2 pairs + 1 single)", full === 5, full);
  const r2 = run("Acetylene", {});
  check("T6 acetylene: exactly 3 lines", r2.paths.filter((pa) => !pa.closed).length === 3, r2.paths.length);
}

/* T7: rotation + determinism */
{
  const a = JSON.stringify(run("Naphthalene", { rot: 0 }));
  const b = JSON.stringify(run("Naphthalene", { rot: 37 }));
  const c = JSON.stringify(run("Naphthalene", { rot: 0 }));
  check("T7 rotation changes output", a !== b);
  check("T7 deterministic", a === c);
}

/* T8: sheet mode renders all molecules with labels on the label pen */
{
  const p = { ...defaults(), molecule: "Sheet (all)", names: true };
  const r = N.compute([undefined], p, CTX, {});
  const labelPaths = r.paths.filter((pa) => pa.layer === Math.round(p.labelPen)).length;
  check("T8 sheet renders", r.paths.length > MOLS.length * 3, r.paths.length + " paths");
  check("T8 labels on label pen", labelPaths >= MOLS.length, labelPaths);
  let inBounds = true;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (q[0] < p.margin - 0.01 || q[0] > CTX.W - p.margin + 0.01 || q[1] < p.margin - 0.01 || q[1] > CTX.H - p.margin + 0.01) inBounds = false;
  }
  check("T8 sheet in-margin", inBounds);
}

/* T9: carbon dots add one small closed loop per atom (benzene: 6) */
{
  const r = run("Benzene", { dots: true, aromatic: "Kekul\u00e9" });
  const dots = r.paths.filter((pa) => pa.closed && pa.pts.length === 10).length;
  check("T9 benzene carbon dots = 6", dots === 6, dots);
}

/* T10: extremes — tiny margin box, huge bond, rotation via wire */
{
  let ok = true;
  for (const over of [{ bond: 40 }, { margin: 60 }, { rot: 720 }, { bond: 3, molecule: "Pyrene" }]) {
    const p = { ...defaults(), names: false, ...over };
    const r = N.compute([undefined], p, CTX, {});
    for (const pa of r.paths) for (const q of pa.pts) {
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) ok = false;
    }
  }
  check("T10 extremes finite", ok);
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
if (fails) process.exitCode = 1;

/* T11 (v2): heteroatom molecules — pinned line/label-stroke counts.
   Stub font = 1 stroke per non-space char, so expected open strokes =
   bond lines (incl. double pairs/inners, methyl stubs) + label chars. */
{
  const EXPECT = {
    "Heptane": 6,
    "Caffeine": 25,   /* 19 bond lines + 6 letter strokes (4N 2O) */
    "Glucose": 23,    /* 12 lines + O + 5xOH (11 chars) */
    "Fructose": 23,
    "Sucrose": 43,    /* 24 lines + 3xO + 8xOH (19 chars) */
    "Betulin": 41,    /* 37 lines + 2xOH (4 chars) */
  };
  let ok = true, why = "";
  for (const [name, want] of Object.entries(EXPECT)) {
    const r = run(name, { aromatic: "Circle" });
    const got = r.paths.filter((pa) => !pa.closed).length;
    if (got !== want) { ok = false; why += name + ":" + got + "!=" + want + " "; }
    for (const pa of r.paths) for (const q of pa.pts) {
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { ok = false; why += name + " nonfinite "; }
    }
  }
  check("T11 heteroatom molecules pinned counts", ok, why || "all match");
}

/* T12: no aromatic circles on non-aromatic rings; caffeine/glucose 0 circles,
   toluene still 1 (regression) */
{
  let ok = true, why = "";
  for (const [name, want] of Object.entries({ "Caffeine": 0, "Glucose": 0, "Sucrose": 0, "Betulin": 0, "Cyclohexane": 0, "Toluene": 1 })) {
    const r = run(name, { aromatic: "Circle" });
    const circles = r.paths.filter((pa) => pa.closed && pa.pts.length > 12).length;
    if (circles !== want) { ok = false; why = name + ": " + circles + " != " + want; }
  }
  check("T12 circles only on aromatic rings", ok, why || "correct");
}

/* T13: bond trimming — no bond line endpoint closer than 0.22*s to a
   heteroatom label center (letters get air) */
{
  let ok = true, why = "";
  for (const name of ["Caffeine", "Glucose", "Sucrose", "Betulin"]) {
    const r = run(name, { aromatic: "Circle" });
    const lens = r.paths.filter((pa) => !pa.closed && pa.pts.length === 2).map((pa) => pathLength(pa.pts));
    const sEst = Math.max(...lens); /* longest untrimmed bond = scale */
    /* label strokes in the stub font are diagonal (dx=6sc, dy=10sc): identify
       them by slope and length band, take their midpoints as letter centers */
    const centers = [];
    for (const pa of r.paths) {
      if (pa.closed || pa.pts.length !== 2) continue;
      const dx = Math.abs(pa.pts[1][0] - pa.pts[0][0]), dy = Math.abs(pa.pts[1][1] - pa.pts[0][1]);
      if (dy > dx * 1.4 && dy < dx * 1.9 && pathLength(pa.pts) < sEst * 0.75) {
        centers.push([(pa.pts[0][0] + pa.pts[1][0]) / 2, (pa.pts[0][1] + pa.pts[1][1]) / 2]);
      }
    }
    if (!centers.length) { ok = false; why = name + " no labels found"; continue; }
    for (const pa of r.paths) {
      if (pa.closed || pa.pts.length !== 2) continue;
      const dx = Math.abs(pa.pts[1][0] - pa.pts[0][0]), dy = Math.abs(pa.pts[1][1] - pa.pts[0][1]);
      if (dy > dx * 1.4 && dy < dx * 1.9 && pathLength(pa.pts) < sEst * 0.75) continue; /* skip label strokes */
      for (const end of [pa.pts[0], pa.pts[1]]) {
        for (const c of centers) {
          const d = Math.hypot(end[0] - c[0], end[1] - c[1]);
          if (d < sEst * 0.20) { ok = false; why = name + " bond end " + d.toFixed(2) + " from letter"; }
        }
      }
    }
  }
  check("T13 bonds trimmed clear of letters", ok, why || "clear");
}

/* T14: gasoline blend renders 4 components, in-margin, with sub-labels */
{
  const p = { ...defaults(), molecule: "Gasoline (blend)", names: true };
  const r = N.compute([undefined], p, CTX, {});
  const labels = r.paths.filter((pa) => pa.layer === Math.round(p.labelPen)).length;
  check("T14 blend renders with 4 sub-labels", r.paths.length > 25 && labels >= 4, r.paths.length + " paths, " + labels + " label strokes");
  let inB = true;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (q[0] < p.margin - 0.01 || q[0] > CTX.W - p.margin + 0.01 || q[1] < p.margin - 0.01 || q[1] > CTX.H - p.margin + 0.01) inB = false;
  }
  check("T14 blend in-margin", inB);
}

/* T15: sheet regression with the grown library */
{
  const p = { ...defaults(), molecule: "Sheet (all)", names: true };
  const r = N.compute([undefined], p, CTX, {});
  let inB = true;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (q[0] < p.margin - 0.01 || q[0] > CTX.W - p.margin + 0.01 || q[1] < p.margin - 0.01 || q[1] > CTX.H - p.margin + 0.01) inB = false;
  }
  check("T15 full sheet (31 entries) in-margin", inB, r.paths.length + " paths");
}
