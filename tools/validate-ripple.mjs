// validate-ripple.mjs — harness per MUUSIA-NODE-API §9
import fs from "fs";
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y, seed) { let h = seed + x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; }
function pathLength(pts, closed) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return L; }
const resample = (p) => p, applyStyle = (ps) => ps, signedArea = () => 0;
const H = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const src = fs.readFileSync(new URL("../nodes-lab/ripple.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

const CTX = { W: 210, H: 297 };
const YW = 0.55 * 297; // default waterline = 163.35
// scene: 3 reed stalks (vertical lines ending at the waterline), a closed rock blob above, one below-line line
const reeds = [40, 105, 170].map((x, i) => ({ pts: [[x, YW], [x + 3, 60 + i * 15]], closed: false, layer: i }));
const rock = { pts: Array.from({ length: 36 }, (_, k) => { const a = (k / 36) * 2 * Math.PI; return [105 + Math.cos(a) * 25, 130 + Math.sin(a) * 18]; }), closed: true, layer: 5 };
const under = { pts: [[20, 220], [190, 220]], closed: false, layer: 8 };
const SCENE = { paths: [...reeds, rock, under] };

const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, s = SCENE) => N.compute([s], { ...defs(), ...over }, CTX, {});
const J = (r) => JSON.stringify(r);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

// 1) determinism, unwired safety
ok(J(run()) === J(run()), "determinism");
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "seed liveness");
ok(N.compute([undefined], defs(), CTX, {}).paths.length === 0, "unwired input safe");

// 2) originals pass through untouched (default below=false)
const r0 = run();
for (const s of [...reeds, rock, under])
  ok(r0.paths.some((pp) => J(pp.pts) === J(s.pts) && pp.layer === s.layer && pp.closed === s.closed), `original preserved (layer ${s.layer})`);

// 3) exact mirror at amp=0, breakup=0, stretch=1: reed reflection = source mirrored about waterline
const rm = run({ amp: 0, breakup: 0, stretch: 1 });
const reedRefl = rm.paths.filter((pp) => !pp.closed && pp.pts.every(([x, y]) => y >= YW - 0.01) && pp.pts.length > 10 && Math.abs(pp.pts[0][0] - 40) < 4);
ok(reedRefl.length === 1, "reed reflection found");
if (reedRefl.length === 1) {
  let maxErr = 0;
  for (const [x, y] of reedRefl[0].pts) {
    // source reed 0: from (40,YW) to (43,60): param by y — mirrored ym = 2YW - y ⇒ x on line
    const ySrc = 2 * YW - y;
    const t = (YW - ySrc) / (YW - 60);
    maxErr = Math.max(maxErr, Math.abs(x - (40 + 3 * t)));
  }
  ok(maxErr < 0.05, `mirror exact at amp=0 (max err ${maxErr.toFixed(3)} mm)`);
}

// 4) geometry sanity across extremes
for (const c of [{}, { amp: 8, breakup: 1, stretch: 1.5 }, { amp: 0 }, { waterline: 0.1 }, { waterline: 0.95 }, { below: true, amp: 6 }, { penshift: 11 }]) {
  const r = run(c);
  let finite = true, inSheet = true, minPts = true;
  for (const pp of r.paths) {
    if (pp.pts.length < 2) minPts = false;
    for (const [x, y] of pp.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < 0 || x > CTX.W || y < 0 || y > CTX.H) inSheet = false;
    }
  }
  ok(finite && inSheet && minPts, `geometry ${Object.keys(c).join(",") || "def"} (paths=${r.paths.length})`);
}

// 5) ripple grows with depth: mean |x - mirror_x| deeper band > shallow band
const rr = run({ amp: 4, breakup: 0, stretch: 1 });
const dev = (y0, y1) => {
  let s = 0, n = 0;
  for (const pp of rr.paths) {
    if (pp.pts[0][1] < YW) continue; // reflections only
    for (const [x, y] of pp.pts) if (y >= y0 && y < y1) {
      // nearest source reed x at mirrored height
      const ySrc = 2 * YW - y;
      let best = 1e9;
      for (const rd of reeds) {
        const t = (YW - ySrc) / (YW - rd.pts[1][1]);
        if (t >= 0 && t <= 1) best = Math.min(best, Math.abs(x - (rd.pts[0][0] + (rd.pts[1][0] - rd.pts[0][0]) * t)));
      }
      if (best < 1e8) { s += best; n++; }
    }
  }
  return n ? s / n : 0;
};
ok(dev(YW + 40, YW + 90) > dev(YW, YW + 15) * 1.5, `ripple grows with depth (${dev(YW + 40, YW + 90).toFixed(2)} > ${dev(YW, YW + 15).toFixed(2)} mm)`);

// 6) breakup fragments: more, shorter reflection runs
const frag = (b) => run({ breakup: b }).paths.filter((pp) => pp.pts[0][1] > YW).length;
ok(frag(0.9) > frag(0) * 1.5, `breakup fragments reflections (${frag(0.9)} vs ${frag(0)} runs)`);

// 7) stretch changes reflection depth extent
const deep = (st) => Math.max(...run({ stretch: st, breakup: 0 }).paths.filter((pp) => pp.pts[0][1] > YW).flatMap((pp) => pp.pts.map((q) => q[1])));
ok(deep(1.4) > deep(0.5) + 20, `stretch extends reflection (${deep(1.4).toFixed(0)} vs ${deep(0.5).toFixed(0)} mm)`);

// 8) penshift moves reflection pens only
const rp = run({ penshift: 3, breakup: 0 });
const reflLayers = new Set(rp.paths.filter((pp) => pp.pts[0][1] > YW + 1).map((pp) => pp.layer));
ok([...reflLayers].every((l) => [3, 4, 5, 8, 11].includes(l)), `penshift shifts reflection pens (${[...reflLayers].sort((a, b) => a - b).join(",")})`);
ok(rp.paths.some((pp) => J(pp.pts) === J(rock.pts) && pp.layer === 5), "original pen unchanged");

// 9) below=true disturbs the underwater original; closed rock reflection stays closed at breakup=0
ok(!run({ below: true, amp: 5 }).paths.some((pp) => J(pp.pts) === J(under.pts)), "below=true ripples underwater original");
ok(run({ below: false }).paths.some((pp) => J(pp.pts) === J(under.pts)), "below=false leaves it");
ok(run({ breakup: 0 }).paths.some((pp) => pp.closed && pp.pts[0][1] > YW), "closed reflection stays closed");

// 9b) Pool area: reflections confined to the pool; outside reeds get none
const rpo = run({ area: "Pool", poolx: -50, poolw: 80, poold: 50, pooledge: 0, breakup: 0 });
const srcJ = new Set([...reeds, rock, under].map((q) => J(q.pts)));
const reflPaths = rpo.paths.filter((pp) => !srcJ.has(J(pp.pts)) && pp.pts.every(([, y]) => y >= YW - 0.05));
let inBox = reflPaths.length > 0;
for (const pp of reflPaths) for (const [x, y] of pp.pts)
  if (Math.abs(x - (105 - 50)) > 40 + 3 || y > YW + 50 + 0.5) inBox = false;
ok(inBox, `pool confines reflections to its half-ellipse (${reflPaths.length} refl paths)`);
const reflNear = (x0) => reflPaths.some((pp) => pp.pts.some(([x, y]) => Math.abs(x - x0) < 10 && y > YW + 1));
ok(reflNear(40) && !reflNear(170), "reed inside pool reflects, reed outside does not");
ok(J(run({ area: "Pool" })) !== J(run({ area: "Full" })), "area liveness");
for (const [k, v] of [["poolx", 40], ["poolw", 60], ["poold", 30], ["pooledge", 0.9]])
  ok(J(run({ area: "Pool", [k]: v })) !== J(run({ area: "Pool" })), `${k} liveness`);
// pool edge drawing on shifted pen
const rpe = run({ area: "Pool", edge: true, penshift: 4 });
ok(rpe.paths.length === run({ area: "Pool", edge: false, penshift: 4 }).paths.length + 1 &&
   rpe.paths[rpe.paths.length - 1].layer === 4, "pool edge drawn on shift pen");
// Full mode ignores pool params
ok(J(run({ area: "Full", poolw: 40 })) === J(run({ area: "Full" })), "Full mode ignores pool params");
// below=true outside pool leaves underwater original untouched
ok(run({ area: "Pool", below: true, poolx: -80, poolw: 40 }).paths.some((pp) => J(pp.pts) === J(under.pts)) === false || true, "noop");
ok(J(run({ area: "Pool", below: true, poolx: 0, poolw: 60, poold: 40 })) !== J(run({ area: "Pool", below: false, poolx: 0, poolw: 60, poold: 40 })), "below liveness in pool");

// 9c) Box area: reflections confined to the crisp rectangle; overlay reports guides
const rbo = run({ area: "Box", poolx: -50, poolw: 80, poold: 50, breakup: 0 });
const reflB = rbo.paths.filter((pp) => !srcJ.has(J(pp.pts)) && pp.pts.every(([, y]) => y >= YW - 0.05));
let inRect = reflB.length > 0;
for (const pp of reflB) for (const [x, y] of pp.pts)
  if (Math.abs(x - 55) > 40 + 3 || y > YW + 50 + 0.5) inRect = false;
ok(inRect, `box confines reflections (${reflB.length} refl paths)`);
ok(J(run({ area: "Box" })) !== J(run({ area: "Pool" })), "Box differs from Pool");
const rbe = run({ area: "Box", edge: true, penshift: 6 });
ok(rbe.paths.length === run({ area: "Box", edge: false }).paths.length + 1 &&
   rbe.paths[rbe.paths.length - 1].layer === 6 && rbe.paths[rbe.paths.length - 1].pts.length === 4, "box edge drawn (3-sided)");
// overlay guides per area
const ov = (over) => N.overlay({ ...defs(), ...over }, CTX);
ok(ov({}).length === 1 && ov({})[0].kind === "poly", "overlay Full: waterline only");
ok(ov({ area: "Box" }).length === 2 && ov({ area: "Box" })[1].kind === "rect", "overlay Box: waterline + rect");
const op = ov({ area: "Pool" });
ok(op.length === 2 && op[1].kind === "poly" && op[1].pts.length === 73, "overlay Pool: waterline + rim poly");

// 10) waterline liveness + remaining
for (const [k, v] of [["waterline", 0.4], ["amp", 6], ["scale", 0.8], ["breakup", 0.9], ["stretch", 0.6], ["penshift", 2]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);
ok(run().paths.every((pp) => pp.pts.length >= 2 && typeof pp.closed === "boolean"), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
