/* validate-moire_disc.mjs — run from repo root: node tools/validate-moire_disc.mjs
   Auto-switch: prefers baked src/defs/nodes/moire_disc.js, falls back to
   nodes-lab/moire_disc.plotternode.js evaluated with the REAL src/defs/helpers.js. */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const BAKED = "src/defs/nodes/moire_disc.js";
const LAB = "nodes-lab/moire_disc.plotternode.js";
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
console.log(`[${mode}] moire_disc validator`);

const CTX = { W: 210, H: 297 };
const MODES = ["Rings", "Spiral", "Spokes", "Hatch", "Mesh", "Hex circles", "Grid circles", "Random circles", "Phyllotaxis"];
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute.call(N, [undefined], { ...defs(), ...over }, ctx, {});
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ok  " + msg); } else { fail++; console.log("  FAIL " + msg); } };

/* 1. determinism */
ok(JSON.stringify(run()) === JSON.stringify(run()), "deterministic (double run identical)");

/* 2. every mode: nonempty, finite, >=2 pts, at disorder 0 AND 1 */
{
  let fin = true, minP = true, nonEmpty = true;
  for (const m of MODES) for (const d of [0, 1]) {
    const r = run({ content: m, disorder: d, seed: 3 });
    if (r.paths.length < 2) nonEmpty = false;
    for (const ph of r.paths) {
      if (ph.pts.length < 2) minP = false;
      for (const [x, y] of ph.pts) if (!Number.isFinite(x) || !Number.isFinite(y)) fin = false;
    }
  }
  ok(nonEmpty, "all 9 modes produce content (disorder 0 and 1)");
  ok(fin, "all coordinates finite (18 runs)");
  ok(minP, "every path >= 2 points");
}

/* 3. NOTHING LEAKS: content stays inside the disc in every mode at every disorder */
{
  let leak = null;
  for (const m of MODES) for (const d of [0, 0.5, 1]) {
    const r = run({ content: m, disorder: d, x: 40, y: 35, radius: 55, seed: 5 });
    const cx = CTX.W * 0.4, cy = CTX.H * 0.35;
    for (const ph of r.paths) for (const [x, y] of ph.pts) {
      if (Math.hypot(x - cx, y - cy) > 55 + 0.05) leak = `${m} @ disorder ${d}`;
    }
  }
  ok(!leak, leak ? `LEAK in ${leak}` : "content never leaks outside the disc (9 modes x 3 disorder levels)");
}

/* 4. X/Y place the disc: point centroid tracks the center */
{
  const r = run({ x: 25, y: 70, radius: 40 });
  let sx = 0, sy = 0, n = 0;
  for (const ph of r.paths) for (const [x, y] of ph.pts) { sx += x; sy += y; n++; }
  const ex = CTX.W * 0.25, ey = CTX.H * 0.7;
  ok(Math.abs(sx / n - ex) < 3 && Math.abs(sy / n - ey) < 3, `X/Y place the disc (centroid ${(sx / n).toFixed(1)},${(sy / n).toFixed(1)} ~ ${ex.toFixed(1)},${ey.toFixed(1)})`);
}

/* 5. rim toggle: exactly one path sits at the rim radius */
{
  const on = run({ content: "Rings" }).paths.length;
  const off = run({ content: "Rings", rim: false }).paths.length;
  ok(on === off + 1, `rim toggle adds exactly one circle (${on} vs ${off})`);
}

/* 6. pitch monotonic: bigger pitch -> fewer paths (Rings, Hatch) and fewer circles (Hex) */
{
  for (const m of ["Rings", "Hatch", "Hex circles"]) {
    const fine = run({ content: m, pitch: 1.5 }).paths.length;
    const coarse = run({ content: m, pitch: 8 }).paths.length;
    ok(coarse < fine * 0.6, `pitch thins ${m} (${coarse} < ${fine})`);
  }
}

/* 7. hatch angle: at angle 0 / disorder 0 every segment is horizontal; at 45 it is not */
{
  const flat = run({ content: "Hatch", angle: 0, disorder: 0, rim: false });
  let horiz = true;
  for (const ph of flat.paths) for (let i = 1; i < ph.pts.length; i++)
    if (Math.abs(ph.pts[i][1] - ph.pts[i - 1][1]) > 1e-6) horiz = false;
  ok(horiz, "hatch at angle 0 is exactly horizontal (disorder 0)");
  ok(JSON.stringify(run({ content: "Hatch", angle: 45 })) !== JSON.stringify(run({ content: "Hatch", angle: 0 })), "angle rotates the pattern");
}

/* 8. hex lattice regularity: disorder 0 -> nearest-neighbor spacing == pitch; disorder 1 spreads it */
{
  const centersOf = (d) => {
    const r = run({ content: "Hex circles", disorder: d, crings: 1, rim: false, pitch: 5, csize: 1.5 });
    return r.paths.map((ph) => ph.pts.reduce((a, q) => [a[0] + q[0] / ph.pts.length, a[1] + q[1] / ph.pts.length], [0, 0]));
  };
  const nnStd = (cs) => {
    const ds = cs.map((c) => {
      let best = Infinity;
      for (const o of cs) { const dd = Math.hypot(c[0] - o[0], c[1] - o[1]); if (dd > 1e-6 && dd < best) best = dd; }
      return best;
    });
    const m = ds.reduce((a, b) => a + b, 0) / ds.length;
    return [m, Math.sqrt(ds.reduce((a, b) => a + (b - m) * (b - m), 0) / ds.length)];
  };
  const [m0, s0] = nnStd(centersOf(0));
  const [, s1] = nnStd(centersOf(1));
  ok(Math.abs(m0 - 5) < 0.15 && s0 < 0.05, `hex lattice regular at disorder 0 (nn ${m0.toFixed(2)} mm, std ${s0.toFixed(3)})`);
  ok(s1 > s0 * 5, `disorder breaks the lattice (std ${s1.toFixed(2)} > ${s0.toFixed(3)})`);
}

/* 9. Spiral is one continuous line */
{
  const r = run({ content: "Spiral", rim: false });
  ok(r.paths.length === 1 && r.paths[0].pts.length > 100, `spiral is a single continuous stroke (${r.paths[0].pts.length} pts)`);
}

/* 10. crings multiplies packed-circle paths */
{
  const one = run({ content: "Grid circles", crings: 1, rim: false }).paths.length;
  const four = run({ content: "Grid circles", crings: 4, rim: false }).paths.length;
  ok(four > one * 3, `circle rings multiply (${four} ~ 4 x ${one})`);
}

/* 11. seed + remaining param liveness */
ok(JSON.stringify(run({ content: "Random circles", seed: 1 })) !== JSON.stringify(run({ content: "Random circles", seed: 2 })), "seed changes output (Random circles)");
{
  const base = JSON.stringify(run({ content: "Hex circles" }));
  for (const [k, v] of [["radius", 40], ["csize", 4], ["disorder", 0.4]])
    ok(JSON.stringify(run({ content: "Hex circles", [k]: v })) !== base, `param live: ${k}`);
  ok(run({ layer: 6 }).paths.every((ph) => ph.layer === 6), "layer applied to every path");
}

/* 12. point budget at hostile settings */
{
  let worst = 0;
  for (const m of MODES) {
    const r = run({ content: m, radius: 140, pitch: 0.8, csize: 2, crings: 8 }, { W: 300, H: 300 });
    worst = Math.max(worst, r.paths.reduce((s, ph) => s + ph.pts.length, 0));
  }
  ok(worst <= 110000 + 600, `point budget respected across modes (worst ${worst} pts)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
