/* Validator for the Line Zones node. Auto-switches to the baked version when
   it exists (src/defs/nodes/linezones.js); otherwise evaluates the lab file
   with injected helpers. Run from repo root: node tools/validate-linezones.mjs */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as H from "../src/defs/helpers.js";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BAKED = path.join(ROOT, "src/defs/nodes/linezones.js");
const LAB = path.join(ROOT, "nodes-lab/linezones.plotternode.js");

let def;
if (fs.existsSync(BAKED)) {
  def = (await import(url.pathToFileURL(BAKED).href)).default;
  console.log("using BAKED src/defs/nodes/linezones.js");
} else {
  const code = fs.readFileSync(LAB, "utf8");
  const names = Object.keys(H);
  const fn = new Function(...names, `"use strict"; return (${code});`);
  def = fn(...names.map((n) => H[n]));
  console.log("using LAB nodes-lab/linezones.plotternode.js");
}

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; process.exitCode = 1; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
};

const CTX = { W: 210, H: 297 };
const P = {};
for (const pd of def.params) P[pd.key] = pd.def;
const run = (over) => def.compute([null], { ...P, ...over }, CTX, {});
const totalLen = (res) => {
  let len = 0;
  for (const pa of res.paths) {
    const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
};

/* 1) determinismi + perusgeometria */
const A = run({});
check("deterministic (double run equal)", JSON.stringify(A) === JSON.stringify(run({})));
check("produces output", A.paths.length > 100, "paths=" + A.paths.length);
let finite = true, inb = true;
for (const pa of A.paths) for (const q of pa.pts) {
  if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
  if (q[0] < P.margin - 1e-6 || q[0] > CTX.W - P.margin + 1e-6 ||
      q[1] < P.margin - 1e-6 || q[1] > CTX.H - P.margin + 1e-6) inb = false;
}
check("all coords finite", finite);
check("inside margin box", inb);

/* 2) AKSELISUORUUS: jokainen avoin segmentti tarkasti pysty tai vaaka */
let axis = true;
for (const pa of A.paths) {
  if (pa.closed) continue; /* kehyssuorakaiteet erikseen */
  for (let i = 1; i < pa.pts.length; i++) {
    const dx = Math.abs(pa.pts[i][0] - pa.pts[i - 1][0]);
    const dy = Math.abs(pa.pts[i][1] - pa.pts[i - 1][1]);
    if (dx > 1e-9 && dy > 1e-9) axis = false;
  }
}
check("every line strictly axis-aligned", axis);

/* 3) viistoleikkaus: diag=1 -> viivanpaat muodostavat 45-asteen portaan.
      Todiste: on olemassa pystyviivaryhmia joissa perakkaisten viivojen
      paatepisteet siirtyvat pitchin verran seka x- etta y-suunnassa. */
const D = run({ diag: 1, ditherP: 0, solidP: 0, phase: 0, gap: 0 });
const verts = D.paths.filter((pa) => !pa.closed && Math.abs(pa.pts[0][0] - pa.pts[1][0]) < 1e-9)
  .map((pa) => ({ x: pa.pts[0][0], y0: Math.min(pa.pts[0][1], pa.pts[1][1]), y1: Math.max(pa.pts[0][1], pa.pts[1][1]) }))
  .sort((a, b) => a.x - b.x);
let stair = 0;
for (let i = 1; i < verts.length; i++) {
  const dx = verts[i].x - verts[i - 1].x;
  if (dx < 0.01 || dx > P.pitch * 1.5) continue;
  const d0 = Math.abs(verts[i].y0 - verts[i - 1].y0), d1 = Math.abs(verts[i].y1 - verts[i - 1].y1);
  if (Math.abs(d0 - dx) < 0.02 || Math.abs(d1 - dx) < 0.02) stair++;
}
check("diagonal cuts form 45° staircases", stair > 8, "stair steps=" + stair);

/* 4) dither: ditherP=1 -> mediaani polunpituus <= 1.5 x cell */
const T = run({ ditherP: 1, solidP: 0, frame: 0 });
const lens = T.paths.filter((pa) => !pa.closed)
  .map((pa) => Math.hypot(pa.pts[1][0] - pa.pts[0][0], pa.pts[1][1] - pa.pts[0][1]))
  .sort((a, b) => a - b);
check("dither breaks lines into cells", lens.length > 50 && lens[Math.floor(lens.length / 2)] <= P.cell * 1.5,
  "median=" + (lens.length ? lens[Math.floor(lens.length / 2)].toFixed(2) : "-"));

/* 5) solid lisaa mustetta */
check("solid zones add ink", totalLen(run({ solidP: 1 })) > totalLen(run({ solidP: 0 })) * 1.5);

/* 6) kehys: frame=10 tuottaa suljettuja suorakaiteita kehysnauhaan, frame=0 ei */
const F = run({ frame: 10 });
const frameRects = F.paths.filter((pa) => pa.closed);
let frameBand = frameRects.length > 5;
for (const pa of frameRects) for (const q of pa.pts) {
  const dEdge = Math.min(q[0] - P.margin, CTX.W - P.margin - q[0], q[1] - P.margin, CTX.H - P.margin - q[1]);
  if (dEdge > 10.01) frameBand = false;
}
check("frame band drawn as nested rects", frameBand, "rects=" + frameRects.length);
check("frame 0 -> no closed paths", run({ frame: 0 }).paths.every((pa) => !pa.closed));

/* 7) vyohykerako: gap=3, phase=0 -> pinottujen vyohykkeiden samaan x-kolumniin
      osuvien viivojen y-janteiden vali >= gap */
const G = run({ gap: 3, ditherP: 0, solidP: 0, diag: 0, frame: 0, balance: 1, phase: 0 });
const cols = new Map();
for (const pa of G.paths) {
  if (pa.closed || Math.abs(pa.pts[0][0] - pa.pts[1][0]) > 1e-9) continue;
  const k = pa.pts[0][0].toFixed(3);
  if (!cols.has(k)) cols.set(k, []);
  cols.get(k).push([Math.min(pa.pts[0][1], pa.pts[1][1]), Math.max(pa.pts[0][1], pa.pts[1][1])]);
}
let minSep = 1e9, stacked = 0;
for (const spans of cols.values()) {
  if (spans.length < 2) continue;
  stacked++;
  spans.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) minSep = Math.min(minSep, spans[i][0] - spans[i - 1][1]);
}
check("zone gap separates stacked zones", stacked > 5 && minSep >= 2.9,
  "stacked cols=" + stacked + " minSep=" + (minSep === 1e9 ? "-" : minSep.toFixed(2)));

/* 8) parametrien liveness */
const base = JSON.stringify(A);
for (const [k, v] of [
  ["zones", 3], ["pitch", 3], ["balance", 0], ["solidP", 0.9], ["ditherP", 0.9],
  ["cell", 3], ["diag", 0], ["gap", 3], ["phase", 0], ["frame", 0],
  ["margin", 30], ["seed", 999], ["layer", 4],
]) {
  check("param live: " + k, JSON.stringify(run({ [k]: v })) !== base);
}

console.log(fail === 0 ? "\nALL " + pass + " CHECKS PASSED" : "\n" + fail + " FAILURES / " + (pass + fail));
