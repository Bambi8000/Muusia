/* Validator for the Shade node. Auto-switches to the baked version when it
   exists (src/defs/nodes/shade.js); otherwise evaluates the lab file with
   injected helpers. Run from repo root: node tools/validate-shade.mjs */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as H from "../src/defs/helpers.js";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BAKED = path.join(ROOT, "src/defs/nodes/shade.js");
const LAB = path.join(ROOT, "nodes-lab/shade.plotternode.js");

let def;
if (fs.existsSync(BAKED)) {
  def = (await import(url.pathToFileURL(BAKED).href)).default;
  console.log("using BAKED src/defs/nodes/shade.js");
} else {
  const code = fs.readFileSync(LAB, "utf8");
  const names = Object.keys(H);
  const fn = new Function(...names, `"use strict"; return (${code});`);
  def = fn(...names.map((n) => H[n]));
  console.log("using LAB nodes-lab/shade.plotternode.js");
}

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; process.exitCode = 1; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
};

const CTX = { W: 210, H: 148 };
const P = {};
for (const pd of def.params) P[pd.key] = pd.def;
const run = (paths, over) => def.compute([{ paths }], { ...P, ...over }, CTX, {});

const ring = (pts) => ({ pts, closed: true, layer: 0 });
/* L-muoto: kovera nurkka pisteessa (110,80) */
const LPOLY = [[40, 30], [180, 30], [180, 80], [110, 80], [110, 120], [40, 120]];
const SQUARE = [[50, 40], [160, 40], [160, 110], [50, 110]];

const inkNear = (res, x, y, R, skipClosed) => {
  let len = 0;
  for (const pa of res.paths) {
    if (skipClosed && pa.closed) continue;
    for (let i = 1; i < pa.pts.length; i++) {
      const a = pa.pts[i - 1], b = pa.pts[i];
      const mx2 = (a[0] + b[0]) / 2, my2 = (a[1] + b[1]) / 2;
      if (Math.hypot(mx2 - x, my2 - y) < R) len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }
  return len;
};
const pip = (ringPts, x, y) => {
  let ins = false;
  for (let i = 0, j = ringPts.length - 1; i < ringPts.length; j = i++) {
    const [xi, yi] = ringPts[i], [xj, yj] = ringPts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};

/* 1) determinismi + perusgeometria */
const A = run([ring(LPOLY)], {});
const B = run([ring(LPOLY)], {});
check("deterministic (double run equal)", JSON.stringify(A) === JSON.stringify(B));
check("produces shading", A.paths.filter((pa) => !pa.closed).length > 30);
let finite = true;
for (const pa of A.paths) for (const q of pa.pts)
  if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
check("all coords finite", finite);

/* 2) varjostus vain muodon sisalla (toleranssi 1 mm wobblelle) */
let inShape = true;
for (const pa of A.paths) {
  if (pa.closed) continue;
  for (const q of pa.pts) {
    if (!pip(LPOLY, q[0], q[1])) {
      let d = 1e9;
      for (let i = 0, j = LPOLY.length - 1; i < LPOLY.length; j = i++) {
        const [xi, yi] = LPOLY[i], [xj, yj] = LPOLY[j];
        const dx = xj - xi, dy = yj - yi, L2 = dx * dx + dy * dy;
        let t = L2 ? ((q[0] - xi) * dx + (q[1] - yi) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        d = Math.min(d, Math.hypot(q[0] - (xi + dx * t), q[1] - (yi + dy * t)));
      }
      if (d > 1.2) inShape = false;
    }
  }
}
check("shading stays inside shape", inShape);

/* 3) nurkkakertyma: kovera nurkka (110,80) saa enemman mustetta kuin haaran keskusta */
const C = run([ring(LPOLY)], { lightAmt: 0, bodyGrad: 0, hand: 0, concave: 0.5 });
const atCorner = inkNear(C, 110, 80, 9, true);
const atLimb = inkNear(C, 75, 100, 9, true);
check("ink pools into concave corner", atCorner > atLimb * 1.5,
  "corner=" + atCorner.toFixed(0) + " limb=" + atLimb.toFixed(0));

/* 4) Concave bias 1 vaimentaa kuperat nurkat suhteessa koveraan */
const C0 = run([ring(LPOLY)], { lightAmt: 0, bodyGrad: 0, hand: 0, concave: 0, edgeAmt: 0 });
const C1 = run([ring(LPOLY)], { lightAmt: 0, bodyGrad: 0, hand: 0, concave: 1, edgeAmt: 0 });
const cvx0 = inkNear(C0, 180, 30, 9, true), cvx1 = inkNear(C1, 180, 30, 9, true);
const ccv1 = inkNear(C1, 110, 80, 9, true);
check("concave bias suppresses convex corners", cvx1 < cvx0 * 0.6 && ccv1 > cvx1,
  "cvx0=" + cvx0.toFixed(0) + " cvx1=" + cvx1.toFixed(0) + " ccv1=" + ccv1.toFixed(0));

/* 5) valon suunta: valo vasemmalla -> oikea reuna tummempi; valo oikealla -> peilautuu */
const S1 = run([ring(SQUARE)], { lx: -40, ly: 50, lightAmt: 1, cornerAmt: 0, bodyGrad: 0, hand: 0 });
const S2 = run([ring(SQUARE)], { lx: 140, ly: 50, lightAmt: 1, cornerAmt: 0, bodyGrad: 0, hand: 0 });
const rEdge1 = inkNear(S1, 156, 75, 8, true), lEdge1 = inkNear(S1, 54, 75, 8, true);
const rEdge2 = inkNear(S2, 156, 75, 8, true), lEdge2 = inkNear(S2, 54, 75, 8, true);
check("light from left darkens right edge", rEdge1 > lEdge1 * 1.5,
  "R=" + rEdge1.toFixed(0) + " L=" + lEdge1.toFixed(0));
check("moving the light flips the shading", lEdge2 > rEdge2 * 1.5,
  "R=" + rEdge2.toFixed(0) + " L=" + lEdge2.toFixed(0));

/* 6) reika: sisarengas jattaa aukon */
const HOLE = [[80, 55], [130, 55], [130, 95], [80, 95]];
const D = run([ring(SQUARE), ring(HOLE)], { hand: 0 });
check("hole stays empty", inkNear(D, 105, 75, 10, true) === 0);

/* 7) avoimet polut lapi koskematta, outlines-kytkin toimii */
const openPath = { pts: [[10, 10], [200, 10]], closed: false, layer: 3 };
const E = run([ring(SQUARE), openPath], {});
check("open paths pass through", E.paths.some((pa) => !pa.closed && pa.layer === 3 && pa.pts.length === 2));
const F = run([ring(SQUARE)], { outlines: false });
check("outlines toggle works", !F.paths.some((pa) => pa.closed) && E.paths.some((pa) => pa.closed));

/* 8) shade pen */
const G2 = run([ring(SQUARE)], { layer: 5, outlines: false });
check("shade pen applied", G2.paths.every((pa) => pa.layer === 5));

/* 9) parametrien liveness */
const base = JSON.stringify(run([ring(LPOLY)], {}));
for (const [k, v] of [
  ["lx", 120], ["ly", 120], ["lightAmt", 0.1], ["band", 25], ["edgeAmt", 0.2],
  ["cornerAmt", 0.1], ["cornerRad", 20], ["concave", 1], ["bodyGrad", 1],
  ["ambient", 0.4], ["gamma", 2.5], ["levels", 2], ["pitch", 3], ["angle", 120],
  ["crossAng", 10], ["hand", 0.9], ["seed", 999], ["layer", 7],
]) {
  check("param live: " + k, JSON.stringify(run([ring(LPOLY)], { [k]: v })) !== base);
}

/* 10) tyhja syote */
const Z = def.compute([null], P, CTX, {});
check("empty input -> empty", Z.paths.length === 0);

console.log(fail === 0 ? "\nALL " + pass + " CHECKS PASSED" : "\n" + fail + " FAILURES / " + (pass + fail));
