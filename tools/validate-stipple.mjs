/* Validator for the Stipple node. Auto-switches to the baked version when it
   exists (src/defs/nodes/stipple.js); otherwise evaluates the lab file
   nodes-lab/stipple.plotternode.js with injected helpers. Run from repo root:
   node tools/validate-stipple.mjs */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as H from "../src/defs/helpers.js";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BAKED = path.join(ROOT, "src/defs/nodes/stipple.js");
const LAB = path.join(ROOT, "nodes-lab/stipple.plotternode.js");

let def;
if (fs.existsSync(BAKED)) {
  def = (await import(url.pathToFileURL(BAKED).href)).default;
  console.log("using BAKED src/defs/nodes/stipple.js");
} else {
  const code = fs.readFileSync(LAB, "utf8");
  const names = Object.keys(H).filter((k) => typeof H[k] !== "undefined");
  const fn = new Function(...names, `"use strict"; return (${code});`);
  def = fn(...names.map((n) => H[n]));
  console.log("using LAB nodes-lab/stipple.plotternode.js");
}

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; process.exitCode = 1; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
};

/* --- synteettinen kuva: vasen->oikea tummuusgradientti + tumma kiekko --- */
const IW = 64, IH = 64;
const g = new Array(IW * IH);
for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
  let d = x / (IW - 1); /* 0 vasen (valkoinen) .. 1 oikea (musta) */
  const dx = x - 16, dy = y - 32;
  if (dx * dx + dy * dy < 100) d = 1; /* tumma kiekko vaalealla puolella */
  g[y * IW + x] = d;
}
const IMG = { w: IW, h: IH, g };
const CTX = { W: 210, H: 148 };
const NODE = { data: { img: IMG } };

const P = {};
for (const pd of def.params) P[pd.key] = pd.def;
const run = (over) => def.compute([null], { ...P, ...over }, CTX, NODE);

/* fit-geometria kuten nodessa, tummuusnaytteistys tarkistuksiin */
const m = P.margin;
const sc = Math.min((CTX.W - 2 * m) / IW, (CTX.H - 2 * m) / IH);
const iw = IW * sc, ih = IH * sc;
const x0 = (CTX.W - iw) / 2, y0 = (CTX.H - ih) / 2;
const rawDark = (x, y) => {
  const u = Math.min(IW - 1, Math.max(0, Math.round((x - x0) / sc)));
  const v = Math.min(IH - 1, Math.max(0, Math.round((y - y0) / sc)));
  return g[v * IW + u];
};

/* 1) determinismi */
const A = run({}), B = run({});
check("deterministic (double run equal)", JSON.stringify(A) === JSON.stringify(B));
check("produces output", A.paths.length > 20, "paths=" + A.paths.length);

/* 2) geometria: aarelliset, >=3 pt, suljetut, kankaalla */
let finite = true, minPts = Infinity, allClosed = true, inb = true;
for (const pa of A.paths) {
  if (!pa.closed) allClosed = false;
  minPts = Math.min(minPts, pa.pts.length);
  for (const q of pa.pts) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
    if (q[0] < -1e-6 || q[0] > CTX.W + 1e-6 || q[1] < -1e-6 || q[1] > CTX.H + 1e-6) inb = false;
  }
}
check("all coords finite", finite);
check("all paths closed rings", allClosed);
check("rings have >=10 pts", minPts >= 10, "min=" + minPts);
check("in canvas bounds", inb);

/* 3) pakkausinvariantti: wobble=0, pitch iso -> 1 rengas per pyoryla.
      Keskipisteiden etaisyys >= r_i + r_j + gap (spread=0). */
const C = run({ wobble: 0, pitch: 2, dotMin: 0.8, spread: 0, gap: 0.4 });
const centers = C.paths.filter((pa) => {
  /* ulkorengas = suurin rengas per keskipiste; pitch=2 & dotMax 2.8 voi antaa 2 rengasta,
     joten poimitaan vain renkaat joilla ei ole isompaa rengasta samalla keskipisteella */
  return true;
}).map((pa) => {
  let cx = 0, cy = 0;
  for (const q of pa.pts) { cx += q[0]; cy += q[1]; }
  cx /= pa.pts.length; cy /= pa.pts.length;
  let r = 0;
  for (const q of pa.pts) r += Math.hypot(q[0] - cx, q[1] - cy);
  return { cx, cy, r: r / pa.pts.length };
});
/* ryhmittele samat keskipisteet (sisarenkaat) ja pida suurin sade */
const uniq = [];
for (const c of centers) {
  const hit = uniq.find((u) => Math.hypot(u.cx - c.cx, u.cy - c.cy) < 0.05);
  if (hit) hit.r = Math.max(hit.r, c.r);
  else uniq.push({ ...c });
}
let overlapViol = 0, worst = Infinity;
for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
  const need = uniq[i].r + uniq[j].r + 0.4;
  const dd = Math.hypot(uniq[i].cx - uniq[j].cx, uniq[i].cy - uniq[j].cy);
  worst = Math.min(worst, dd - need);
  if (dd < need - 1e-6) overlapViol++;
}
check("no-overlap gap respected (" + uniq.length + " dots)", overlapViol === 0,
  "violations=" + overlapViol + " worst=" + worst.toFixed(4));

/* 4) tummuus -> sade monotonia: kiekon pyorylat suurempia kuin vaalean kaistan */
const darkR = [], lightR = [];
for (const u of uniq) {
  const d = rawDark(u.cx, u.cy);
  if (d > 0.9) darkR.push(u.r);
  else if (d > 0.15 && d < 0.35) lightR.push(u.r);
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
check("darker => bigger dots", darkR.length > 5 && lightR.length > 5 && mean(darkR) > mean(lightR) * 1.5,
  "dark=" + (darkR.length && mean(darkR).toFixed(2)) + " light=" + (lightR.length && mean(lightR).toFixed(2)));

/* 5) cutoff: korkealla cutoffilla keskipisteet vain hyvin tummilla alueilla */
const D = run({ cutoff: 0.85, wobble: 0, pitch: 2 });
let cutOk = true;
for (const pa of D.paths) {
  let cx = 0, cy = 0;
  for (const q of pa.pts) { cx += q[0]; cy += q[1]; }
  cx /= pa.pts.length; cy /= pa.pts.length;
  if (rawDark(cx, cy) < 0.8) cutOk = false;
}
check("cutoff kills light areas", D.paths.length > 0 && cutOk);

/* 6) taytto: iso pyoryla saa useita sisakkaisia renkaita oletus-pitchilla */
const grp = new Map();
for (const pa of A.paths) {
  let cx = 0, cy = 0;
  for (const q of pa.pts) { cx += q[0]; cy += q[1]; }
  const k = (cx / pa.pts.length).toFixed(1) + "," + (cy / pa.pts.length).toFixed(1);
  grp.set(k, (grp.get(k) || 0) + 1);
}
check("big dots get concentric fill (some center has 3+ rings)", Math.max(...grp.values()) >= 3,
  "max rings=" + Math.max(...grp.values()));

/* 7) parametrien liveness */
const base = JSON.stringify(A);
for (const [k, v] of [
  ["seed", 999], ["dotMin", 1.2], ["dotMax", 5], ["gap", 1.5], ["spread", 8],
  ["wobble", 0.9], ["gamma", 2.2], ["cutoff", 0.4], ["invert", true],
  ["pitch", 1.4], ["quality", 1], ["margin", 30], ["layer", 3],
]) {
  check("param live: " + k, JSON.stringify(run({ [k]: v })) !== base);
}

/* 8) tyhja kuva -> EMPTY, ei kaatumista */
const E = def.compute([null], P, CTX, { data: {} });
check("no image -> empty", E.paths.length === 0);

console.log(fail === 0 ? "\nALL " + pass + " CHECKS PASSED" : "\n" + fail + " FAILURES / " + (pass + fail));
