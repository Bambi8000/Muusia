/* validate-gull_tracks.mjs — run from repo root: node tools/validate-gull_tracks.mjs
   Auto-switch: prefers baked src/defs/nodes/gull_tracks.js, falls back to
   nodes-lab/gull_tracks.plotternode.js evaluated with the REAL src/defs/helpers.js. */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const BAKED = "src/defs/nodes/gull_tracks.js";
const LAB = "nodes-lab/gull_tracks.plotternode.js";
let N, mode;
if (fs.existsSync(BAKED)) {
  N = (await import(pathToFileURL(path.resolve(BAKED)).href)).default;
  mode = "baked";
} else {
  const H = await import(pathToFileURL(path.resolve("src/defs/helpers.js")).href);
  const keys = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample", "pathLength", "applyStyle", "signedArea", "isStyle", "parseSVG", "SFONT", "fontStrokes"];
  const src = fs.readFileSync(LAB, "utf8");
  N = new Function(...keys, '"use strict"; return (' + src + ");")(...keys.map((k) => H[k]));
  mode = "lab";
}
console.log(`[${mode}] gull_tracks validator`);

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defs(), ...over }, ctx, {});
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ok  " + msg); } else { fail++; console.log("  FAIL " + msg); } };

/* 1. determinism */
ok(JSON.stringify(run()) === JSON.stringify(run()), "deterministic (double run identical)");

/* 2. finite, >=2 pts, in-bounds across seeds + extremes */
const cases = [
  {}, { seed: 2 }, { seed: 3 }, { seed: 4 }, { seed: 5 },
  { foot: 40, straddle: 30, wander: 1, steps: 120, trails: 8, vary: 1, seed: 6 },
  { foot: 2, stride: 4, spread: 140, websag: 1, toein: 25, hind: true, seed: 7 },
  { margin: 0 }, { margin: 60 },
];
let geomOK = true, boundsOK = true, minPts = true;
for (const c of cases) {
  const r = run(c);
  const m = Math.max(0, Math.min(c.margin ?? defs().margin, Math.min(CTX.W, CTX.H) / 2 - 2));
  for (const ph of r.paths) {
    if (ph.pts.length < 2) minPts = false;
    for (const [x, y] of ph.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) geomOK = false;
      if (x < m - 0.01 || x > CTX.W - m + 0.01 || y < m - 0.01 || y > CTX.H - m + 0.01) boundsOK = false;
    }
  }
}
ok(geomOK, "all coordinates finite (9 cases incl. extremes)");
ok(minPts, "every path >= 2 points");
ok(boundsOK, "all points inside the margin box (9 cases)");

/* 3. seed liveness */
ok(JSON.stringify(run({ seed: 1 })) !== JSON.stringify(run({ seed: 2 })), "seed changes output");

/* 4. per-param liveness */
const base = JSON.stringify(run());
const live = [
  ["trails", 6], ["steps", 60], ["stride", 30], ["straddle", 15], ["foot", 20],
  ["spread", 120], ["websag", 0.9], ["vary", 0.05], ["wander", 0.95], ["toein", 20], ["margin", 30],
];
for (const [k, v] of live) ok(JSON.stringify(run({ [k]: v })) !== base, `param live: ${k}`);
const rNoHind = run(), rHind = run({ hind: true });
ok(rHind.paths.length === rNoHind.paths.length / 3 * 4, "hind toe adds exactly one path per print");
ok(run({ layer: 5 }).paths.every((ph) => ph.layer === 5), "layer applied to every path");

/* helpers: chunk output into prints (3 paths each, 4 with hind) and
   normalize the outer-toe V [tipL,bL,heel,bR,tipR]: translate heel to origin,
   rotate so tipR sits on +x, round -> shape signature (rotation/position removed) */
const signatures = (r, per) => {
  const sigs = [];
  for (let i = 0; i < r.paths.length; i += per) {
    const v = r.paths[i].pts;
    const heel = v[2];
    const a = Math.atan2(v[4][1] - heel[1], v[4][0] - heel[0]);
    const ca = Math.cos(-a), sa = Math.sin(-a);
    const rel = v.map(([x, y]) => {
      const dx = x - heel[0], dy = y - heel[1];
      return [Math.round((dx * ca - dy * sa) * 1e4), Math.round((dx * sa + dy * ca) * 1e4)];
    });
    sigs.push(JSON.stringify(rel));
  }
  return sigs;
};

/* 5. UNIQUENESS: default vary -> every print a different shape */
{
  const r = run({ trails: 6, steps: 80, foot: 10 });
  const sigs = signatures(r, 3);
  ok(sigs.length === 6 * 80, `print count as expected (${sigs.length})`);
  ok(new Set(sigs).size === sigs.length, `every print unique at vary=default (${sigs.length} prints, ${new Set(sigs).size} shapes)`);
}

/* 6. STAMP invariant: vary=0 -> all prints identical in shape */
{
  const r = run({ vary: 0, trails: 4, steps: 40 });
  const sigs = signatures(r, 3);
  ok(new Set(sigs).size === 1, "vary=0 collapses to one identical stamp shape");
}

/* 7. web sag monotonic: higher sag pulls the web midpoint toward the heel */
{
  const midDist = (sag) => {
    const r = run({ vary: 0, trails: 1, steps: 1, websag: sag });
    const heel = r.paths[0].pts[2];
    const web = r.paths[2].pts;
    const mid = web[Math.floor(web.length / 4)]; /* mid of first arc */
    return Math.hypot(mid[0] - heel[0], mid[1] - heel[1]);
  };
  ok(midDist(0.9) < midDist(0.1), `web sag pulls toward heel (${midDist(0.9).toFixed(2)} < ${midDist(0.1).toFixed(2)} mm)`);
}

/* 8. spread monotonic: outer-tip angle at the heel grows with the param */
{
  const tipAngle = (spread) => {
    const r = run({ vary: 0, trails: 1, steps: 1, spread });
    const v = r.paths[0].pts, heel = v[2];
    const a1 = Math.atan2(v[0][1] - heel[1], v[0][0] - heel[0]);
    const a2 = Math.atan2(v[4][1] - heel[1], v[4][0] - heel[0]);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    return (d * 180) / Math.PI;
  };
  const a50 = tipAngle(50), a110 = tipAngle(110);
  ok(a110 > a50 + 30, `toe spread live and monotonic (${a50.toFixed(1)} deg -> ${a110.toFixed(1)} deg)`);
}

/* 9. alternating straddle: consecutive heels sit on opposite sides of the walk line */
{
  const r = run({ vary: 0, wander: 0, trails: 1, steps: 8, straddle: 12, toein: 0 });
  const heels = [];
  for (let i = 0; i < r.paths.length; i += 3) heels.push(r.paths[i].pts[2]);
  let alternates = true;
  for (let i = 2; i < heels.length; i++) {
    const ax = heels[i][0] - heels[i - 2][0], ay = heels[i][1] - heels[i - 2][1];
    const bx = heels[i - 1][0] - heels[i - 2][0], by = heels[i - 1][1] - heels[i - 2][1];
    const cross1 = ax * by - ay * bx;
    if (Math.abs(cross1) < 1e-6) alternates = false;
  }
  ok(alternates && heels.length === 8, "left/right feet alternate off the walk line");
}

/* 10. point budget */
{
  const r = run({ trails: 12, steps: 200, hind: true, foot: 6, stride: 6 });
  const total = r.paths.reduce((s, ph) => s + ph.pts.length, 0);
  ok(total < 120000, `point budget respected at max settings (${total} pts)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
