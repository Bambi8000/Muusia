/* Validator for the Blob Rings node. Auto-switches to the baked version when
   it exists (src/defs/nodes/blobrings.js); otherwise evaluates the lab file
   with injected helpers. Run from repo root: node tools/validate-blobrings.mjs */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as H from "../src/defs/helpers.js";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BAKED = path.join(ROOT, "src/defs/nodes/blobrings.js");
const LAB = path.join(ROOT, "nodes-lab/blobrings.plotternode.js");

let def;
if (fs.existsSync(BAKED)) {
  def = (await import(url.pathToFileURL(BAKED).href)).default;
  console.log("using BAKED src/defs/nodes/blobrings.js");
} else {
  const code = fs.readFileSync(LAB, "utf8");
  const names = Object.keys(H);
  const fn = new Function(...names, `"use strict"; return (${code});`);
  def = fn(...names.map((n) => H[n]));
  console.log("using LAB nodes-lab/blobrings.plotternode.js");
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

const pip = (ring, x, y) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};
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
const B = run({});
check("deterministic (double run equal)", JSON.stringify(A) === JSON.stringify(B));
check("produces output", A.paths.length > 40, "paths=" + A.paths.length);
let finite = true, inb = true;
for (const pa of A.paths) for (const q of pa.pts) {
  if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
  if (q[0] < -1e-6 || q[0] > CTX.W + 1e-6 || q[1] < -1e-6 || q[1] > CTX.H + 1e-6) inb = false;
}
check("all coords finite", finite);
check("in canvas bounds", inb);

/* 2) marginaali kunnioitetaan (wobble-toleranssi 0.5 mm) */
const M = run({ margin: 30 });
let mOK = true;
for (const pa of M.paths) for (const q of pa.pts)
  if (q[0] < 29.5 || q[0] > CTX.W - 29.5 || q[1] < 29.5 || q[1] > CTX.H - 29.5) mOK = false;
check("margin respected", mOK);

/* 3) nestaus-invariantti: wobble 0 -> jokaisen blobin sisemmat renkaat
      aidosti uloimman sisalla. Ryhmittely: rengas kuuluu blobiin jonka
      uloin rengas sen sisaltaa. */
const C = run({ wobble: 0, connectors: 0, satellites: 0, weight: 0, spacing: 6, count: 8 });
const rings = C.paths.filter((pa) => pa.closed);
check("all blob paths closed (no connectors/sats)", C.paths.length === rings.length);
/* uloimmat = renkaat joita mikaan muu ei sisalla */
const contains = (a, b) => pip(a.pts, b.pts[0][0], b.pts[0][1]);
const outer = rings.filter((r1) => !rings.some((r2) => r2 !== r1 && contains(r2, r1)));
let nestOK = true, nested = 0;
for (const r1 of rings) {
  if (outer.includes(r1)) continue;
  const own = outer.find((o) => contains(o, r1));
  if (!own) { nestOK = false; continue; }
  /* kaikki sisarenkaan pisteet uloimman sisalla */
  for (let i = 0; i < r1.pts.length; i += 4)
    if (!pip(own.pts, r1.pts[i][0], r1.pts[i][1])) nestOK = false;
  nested++;
}
check("rings nest strictly inside their blob", nestOK && nested > 10, "nested=" + nested + " outer=" + outer.length);

/* 4) pitch: isompi vali -> vahemman renkaita */
const few = run({ pitch: 4, connectors: 0, satellites: 0 }).paths.length;
const many = run({ pitch: 0.8, connectors: 0, satellites: 0 }).paths.length;
check("bigger pitch -> fewer rings", few < many, few + " vs " + many);

/* 5) solid cores lisaa mustetta */
const s0 = totalLen(run({ solid: 0, connectors: 0, satellites: 0 }));
const s1 = totalLen(run({ solid: 1, connectors: 0, satellites: 0 }));
check("solid cores add ink", s1 > s0 * 1.2, s0.toFixed(0) + " -> " + s1.toFixed(0));

/* 6) connectors: 0 -> ei avoimia polkuja, 1 -> avoimia on */
const c0 = run({ connectors: 0, satellites: 0 });
const c1 = run({ connectors: 1, satellites: 0 });
check("connectors 0 -> all closed", c0.paths.every((pa) => pa.closed));
check("connectors 1 -> open curves appear", c1.paths.some((pa) => !pa.closed));

/* 7) satelliitit lisaavat polkuja */
check("satellites add paths", run({ satellites: 1 }).paths.length > run({ satellites: 0 }).paths.length);

/* 8) count skaalaa */
check("count scales output", run({ count: 40 }).paths.length > run({ count: 5 }).paths.length);

/* 9) parametrien liveness */
const base = JSON.stringify(A);
for (const [k, v] of [
  ["count", 7], ["size", 25], ["variety", 0.1], ["elong", 0.05], ["angle", 90],
  ["spread", 60], ["cluster", 0], ["spacing", 5], ["pitch", 3], ["weight", 0],
  ["solid", 1], ["wobble", 0.05], ["connectors", 0], ["satellites", 0],
  ["margin", 40], ["seed", 999], ["layer", 6],
]) {
  check("param live: " + k, JSON.stringify(run({ [k]: v })) !== base);
}

console.log(fail === 0 ? "\nALL " + pass + " CHECKS PASSED" : "\n" + fail + " FAILURES / " + (pass + fail));
