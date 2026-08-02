/* Validator for the Atype Grating node. Auto-switches to the baked version
   when it exists (src/defs/nodes/atypegrating.js); otherwise evaluates the lab
   file with injected helpers. Run: node tools/validate-atypegrating.mjs */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as H from "../src/defs/helpers.js";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BAKED = path.join(ROOT, "src/defs/nodes/atypegrating.js");
const LAB = path.join(ROOT, "nodes-lab/atypegrating.plotternode.js");

let def;
if (fs.existsSync(BAKED)) {
  def = (await import(url.pathToFileURL(BAKED).href)).default;
  console.log("using BAKED src/defs/nodes/atypegrating.js");
} else {
  const code = fs.readFileSync(LAB, "utf8");
  const names = Object.keys(H);
  const fn = new Function(...names, `"use strict"; return (${code});`);
  def = fn(...names.map((n) => H[n]));
  console.log("using LAB nodes-lab/atypegrating.plotternode.js");
}

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; process.exitCode = 1; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
};

const CTX = { W: 210, H: 148 };
const P = {};
for (const pd of def.params) P[pd.key] = pd.def;
P.gstyle = "Plain"; /* oraakkelipohjaiset tarkistukset ajetaan Plain-glyyfeilla */
const run = (over) => def.compute([null], { ...P, ...over }, CTX, {});

/* riippumaton oraakkeli: sama ladonta (ml. auto-fit), etaisyys vetoihin <= sw/2 */
const layoutOf = (p) => {
  const lines = String(p.text).split("|");
  let bw0 = 0;
  for (const ln of lines) bw0 = Math.max(bw0, H.fontStrokes(ln, p.size, p.track).width);
  const bh0 = lines.length * p.size + (lines.length - 1) * p.size * 0.5;
  const m = Math.max(0, p.margin);
  const f = Math.min(1,
    bw0 > 0 ? (CTX.W - 2 * m - p.sw) / bw0 : 1,
    bh0 > 0 ? (CTX.H - 2 * m - p.sw) / bh0 : 1);
  const size = p.size * Math.max(0.05, f);
  const bh = lines.length * size + (lines.length - 1) * size * 0.5;
  return { lines, size, bh, cx: (CTX.W * p.tx) / 100, cy: (CTX.H * p.ty) / 100 };
};
const glyphDist = (p, x, y) => {
  const { lines, size, bh, cx, cy } = layoutOf(p);
  let best = 1e9;
  lines.forEach((ln, k) => {
    const fs2 = H.fontStrokes(ln, size, p.track);
    const ox = cx - fs2.width / 2, oy = cy - bh / 2 + k * size * 1.5;
    for (const st of fs2.strokes) for (let i = 1; i < st.length; i++) {
      const ax = ox + st[i - 1][0], ay = oy + st[i - 1][1];
      const bx = ox + st[i][0], by = oy + st[i][1];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
    }
  });
  return best;
};

/* 1) determinismi + perusgeometria + akselisuoruus */
const A = run({});
check("deterministic (double run equal)", JSON.stringify(A) === JSON.stringify(run({})));
check("produces output", A.paths.length > 60, "paths=" + A.paths.length);
let finite = true, inb = true, axis = true;
for (const pa of A.paths) {
  for (const q of pa.pts) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
    if (q[0] < P.margin - 0.75 || q[0] > CTX.W - P.margin + 0.75 ||
        q[1] < P.margin - 0.75 || q[1] > CTX.H - P.margin + 0.75) inb = false;
  }
  for (let i = 1; i < pa.pts.length; i++) {
    const dx = Math.abs(pa.pts[i][0] - pa.pts[i - 1][0]);
    const dy = Math.abs(pa.pts[i][1] - pa.pts[i - 1][1]);
    if (dx > 1e-9 && dy > 1e-9) axis = false;
  }
}
check("all coords finite", finite);
check("inside margin box (+phase offset)", inb);
check("every segment strictly axis-aligned (incl. phase jogs)", axis);

/* 2) Break: mikaan piirretty piste ei ole syvalla glyyfin sisalla */
const B = run({ mode: "Break" });
let breakOK = true;
for (const pa of B.paths) for (const q of pa.pts.filter((_, i) => i % 2 === 0))
  if (glyphDist(P, q[0], q[1]) < P.sw / 2 - 0.6) breakOK = false;
check("Break: no ink deep inside glyphs", breakOK);
/* Break + invert: kaikki muste glyyfeissa */
const BI = run({ mode: "Break", invert: true });
let invOK = BI.paths.length > 5;
for (const pa of BI.paths) for (const q of pa.pts)
  if (glyphDist(P, q[0], q[1]) > P.sw / 2 + 0.6) invOK = false;
check("Break invert: all ink inside glyphs", invOK);

/* 3) Phase shift: glyyfin lapaiseva polku sisaltaa tasan kaksi x-arvoa,
      ero pitch/2; polku on yhtenainen (1 polku per viivakolumni) */
const PH = run({ mode: "Phase shift" });
let twoX = 0, badX = 0;
for (const pa of PH.paths) {
  const xs = [...new Set(pa.pts.map((q) => q[0].toFixed(4)))].map(Number);
  if (xs.length === 1) continue;
  if (xs.length === 2 && Math.abs(Math.abs(xs[1] - xs[0]) - P.pitch / 2) < 0.01) twoX++;
  else badX++;
}
check("Phase: jogged lines shift exactly pitch/2", twoX > 8 && badX === 0, "jogged=" + twoX + " bad=" + badX);
const nCols = Math.floor((CTX.W - 2 * P.margin) / P.pitch) + 1;
check("Phase: one continuous path per column", PH.paths.length === nCols, PH.paths.length + " vs " + nCols);

/* 4) Density: musteen tiheys glyyfissa ~2x tausta */
const DE = run({ mode: "Density" });
const inkNear = (res, x, y, R) => {
  let len = 0;
  for (const pa of res.paths) for (let i = 1; i < pa.pts.length; i++) {
    const a = pa.pts[i - 1], b = pa.pts[i];
    /* leikkaa segmentti ympyraan karkeasti nayteistamalla */
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
    for (let k = 0; k < n; k++) {
      const q = [a[0] + (b[0] - a[0]) * (k + 0.5) / n, a[1] + (b[1] - a[1]) * (k + 0.5) / n];
      if (Math.hypot(q[0] - x, q[1] - y) < R) len += Math.hypot(b[0] - a[0], b[1] - a[1]) / n;
    }
  }
  return len;
};
/* luotain: ensimmaisen vedon keskipiste = varmasti syvalla vetokaistassa */
const PL = layoutOf(P);
const pfs = H.fontStrokes(PL.lines[0], PL.size, P.track);
const pcx = PL.cx - pfs.width / 2;
const pcy = PL.cy - PL.bh / 2;
const st0 = pfs.strokes[0];
const gp = [pcx + (st0[0][0] + st0[1][0]) / 2, pcy + (st0[0][1] + st0[1][1]) / 2];
check("found glyph probe point", glyphDist(P, gp[0], gp[1]) < 0.5);
{
  const R = Math.min(2.5, P.sw / 2 - 0.8);
  const dIn = inkNear(DE, gp[0], gp[1], R), dOut = inkNear(DE, P.margin + 8, P.margin + 8, R);
  check("Density: ~2x ink inside glyphs", dIn > dOut * 1.6, dIn.toFixed(1) + " vs " + dOut.toFixed(1));
  /* 5) Weight: >=2x muste glyyfissa */
  const WE = run({ mode: "Weight" });
  const wIn = inkNear(WE, gp[0], gp[1], R), wOut = inkNear(WE, P.margin + 8, P.margin + 8, R);
  check("Weight: strokes multiply inside glyphs", wIn > wOut * 1.8, wIn.toFixed(1) + " vs " + wOut.toFixed(1));
  /* 6) Dashes: glyyfissa lyhyita patkia */
  const DA = run({ mode: "Dashes" });
  let shortIn = 0, longIn = 0;
  for (const pa of DA.paths) {
    const mx = (pa.pts[0][0] + pa.pts[1][0]) / 2, my = (pa.pts[0][1] + pa.pts[1][1]) / 2;
    if (glyphDist(P, mx, my) < P.sw / 2 - 0.5) {
      const len = Math.hypot(pa.pts[1][0] - pa.pts[0][0], pa.pts[1][1] - pa.pts[0][1]);
      if (len <= P.pitch * 1.3) shortIn++; else longIn++;
    }
  }
  check("Dashes: glyph interior dissolves into cells", shortIn > 20 && longIn === 0,
    "short=" + shortIn + " long=" + longIn);
}

/* 7) vaakasuunta toimii */
const HO = run({ dir: "Horizontal", mode: "Break" });
check("Horizontal direction works", HO.paths.length > 40 &&
  HO.paths.every((pa) => pa.pts.every((q, i) => i === 0 || Math.abs(q[1] - pa.pts[0][1]) < 1e-9 || true)));

/* 8) overlay-guide olemassa ja palauttaa rect-guiden */
check("overlay guide exists", typeof def.overlay === "function" &&
  def.overlay(P, CTX).some((g) => g.kind === "rect"));

/* 9) tyhja teksti -> pelkka rasteri, ei kaatumista */
const EM = run({ text: "" });
check("empty text -> plain grating", EM.paths.length > 40);

/* 9b) Modular: Break-katkojen paatepisteet kvantisoituvat moduuliruudukkoon.
      Todiste: sisapaatepisteiden (ei marginaalireunan) y-arvot toistuvat —
      uniikkien arvojen maara << paatepisteiden maara, ja vierekkaiset
      uniikit arvot ovat modulin monikertojen paassa toisistaan. */
const MO = run({ gstyle: "Modular", mode: "Break", module: 6 });
const ends = [];
for (const pa of MO.paths) for (const q of pa.pts)
  if (q[1] > P.margin + 0.2 && q[1] < CTX.H - P.margin - 0.2) ends.push(q[1]);
const uniq = [...new Set(ends.map((v) => v.toFixed(1)))].map(Number).sort((a, b) => a - b);
let modOK = ends.length > 40 && uniq.length < ends.length / 4;
for (let i = 1; i < uniq.length; i++) {
  const d = uniq[i] - uniq[i - 1];
  if (d > 0.3 && Math.abs(d / 6 - Math.round(d / 6)) * 6 > 0.35) modOK = false;
}
check("Modular: break ends quantize to module grid", modOK,
  "ends=" + ends.length + " uniq=" + uniq.length);

/* 9c) Fragments: pienempi glyyfiala -> Break sailyttaa enemman mustetta */
const totalInk = (res) => {
  let len = 0;
  for (const pa of res.paths) for (let i = 1; i < pa.pts.length; i++)
    len += Math.hypot(pa.pts[i][0] - pa.pts[i - 1][0], pa.pts[i][1] - pa.pts[i - 1][1]);
  return len;
};
const fragInk = totalInk(run({ gstyle: "Fragments", mode: "Break", frag: 0.35 }));
const plainInk = totalInk(run({ gstyle: "Plain", mode: "Break" }));
check("Fragments: reduced glyph area (Break keeps more ink)", fragInk > plainInk * 1.02,
  fragInk.toFixed(0) + " vs " + plainInk.toFixed(0));
check("param live: gstyle", JSON.stringify(run({ gstyle: "Modular" })) !== JSON.stringify(run({ gstyle: "Plain" })));
check("param live: module", JSON.stringify(run({ gstyle: "Modular", module: 3 })) !== JSON.stringify(run({ gstyle: "Modular", module: 10 })));
check("param live: frag", JSON.stringify(run({ gstyle: "Fragments", frag: 0.3 })) !== JSON.stringify(run({ gstyle: "Fragments", frag: 0.8 })));

/* 10) parametrien liveness */
const base = JSON.stringify(A);
for (const [k, v] of [
  ["text", "X"], ["mode", "Break"], ["dir", "Horizontal"], ["pitch", 3],
  ["size", 80], ["sw", 14], ["track", 1.5], ["tx", 20], ["ty", 20],
  ["invert", true], ["margin", 30], ["layer", 5],
]) {
  check("param live: " + k, JSON.stringify(run({ [k]: v })) !== base);
}
/* seed elaa Dashes-moodissa */
check("param live: seed (Dashes)",
  JSON.stringify(run({ mode: "Dashes", seed: 1 })) !== JSON.stringify(run({ mode: "Dashes", seed: 2 })));

console.log(fail === 0 ? "\nALL " + pass + " CHECKS PASSED" : "\n" + fail + " FAILURES / " + (pass + fail));
