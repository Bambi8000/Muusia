/* Validator for the Perspective Hall node. Run from the repo root:
   node tools/validate-persp_hall.mjs
   First line tells you whether the lab file or the baked node was tested. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "persp_hall";

const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href)).default;
  mode = "[baked]";
} else {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx, node) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, node || {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const pts = (r) => r.paths.flatMap((q) => q.pts);

const p0 = defaults();

/* --- definition shape --- */
ok(def.cat === "gen" && def.group === "structural", "cat gen / group structural");
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");
ok(def.params.some((q) => q.type === "seed"), "has a seed param");
for (const pd of def.params.filter((q) => q.type === "select")) ok(Array.isArray(pd.options) && pd.options.includes(pd.def), "select '" + pd.key + "' default is one of its options");

/* --- universal invariants --- */
const t0 = Date.now();
const r1 = run(p0);
const ms = Date.now() - t0;
const r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(ms < 600, "defaults compute in " + ms + " ms");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(r1.paths.every((q) => q.closed === false), "all paths open (hatch strokes)");
ok(npts(r1) < 120000, "point budget at defaults");

const tol = 0.05;
const inb = (r, W, Hh, mg) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= mg - tol && x <= W - mg + tol && y >= mg - tol && y <= Hh - mg + tol));
ok(inb(r1, 297, 210, p0.margin), "in bounds (inside margin) on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "in bounds (inside margin) on A4 tall");
ok(inb(run({ ...p0, margin: 25, hand: 1 }, { W: 210, H: 297 }), 210, 297, 25), "margin 25 + hand 1 stays inside the frame");
ok(inb(run({ ...p0, margin: 0, hand: 1 }), 297, 210, 0), "margin 0 + hand 1 stays on sheet");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base, baseJ) => ok(JSON.stringify(run({ ...(base || p0), ...patch })) !== (baseJ || bJ), "param live: " + label);
diff({ seed: 99 }, "seed (hand > 0)");
diff({ mode: "Grid" }, "mode");
diff({ vpx: 30 }, "vpx");
diff({ vpy: 70 }, "vpy");
diff({ aspect: 2 }, "aspect");
diff({ margin: 20 }, "margin");
diff({ gap: 4 }, "gap");
diff({ minGap: 1.2 }, "minGap");
diff({ wallDir: "Along" }, "wallDir");
diff({ floorDir: "Along" }, "floorDir");
diff({ ceilDir: "Across" }, "ceilDir");
diff({ far: 25 }, "far");
diff({ ledges: 3 }, "ledges");
diff({ rhythm: 0.9 }, "rhythm");
diff({ ledgeH: 30 }, "ledgeH");
diff({ ledgeD: 30 }, "ledgeD");
diff({ ledgeFill: 0.8 }, "ledgeFill");
diff({ stagger: true }, "stagger");
diff({ doors: false }, "doors");
diff({ doorH: 80 }, "doorH");
diff({ hand: 0 }, "hand");
diff({ edges: true }, "edges");
diff({ layer: 5 }, "layer");
const eBase = { ...p0, edges: true };
diff({ edgePen: 8 }, "edgePen (with edges on)", eBase, JSON.stringify(run(eBase)));

/* --- pens --- */
const rE = run({ ...p0, edges: true, edgePen: 4, layer: 2 });
ok(rE.paths.some((q) => q.layer === 4) && rE.paths.some((q) => q.layer === 2), "edges land on edgePen, hatch on Pen");
ok(r1.paths.every((q) => q.layer === p0.layer), "edges off: only the hatch pen is used");

/* --- hand 0 is ruler work --- */
const rH0 = run({ ...p0, hand: 0 });
ok(JSON.stringify(rH0) === JSON.stringify(run({ ...p0, hand: 0, seed: 1234 })), "hand 0: seed has no effect");
ok(rH0.paths.every((q) => q.pts.length === 2), "hand 0: every stroke is a straight 2-point segment");
const rH1 = run({ ...p0, hand: 1, ledges: 0 });
ok(rH1.paths.some((q) => q.pts.length > 3), "hand 1: strokes are densified polylines");
const wobble = rH1.paths.filter((q) => q.pts.length > 6).map((q) => {
  const a = q.pts[0], b = q.pts[q.pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let m = 0; for (const pt of q.pts) m = Math.max(m, Math.abs(((b[0] - a[0]) * (a[1] - pt[1]) - (a[0] - pt[0]) * (b[1] - a[1])) / L)); return m;
});
ok(wobble.length > 0 && Math.max(...wobble) > 0.25 && Math.max(...wobble) < 4, "hand 1: wobble is visible but under 4 mm (max " + (wobble.length ? Math.max(...wobble).toFixed(2) : "-") + ")");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}
const rNone = run({ ...p0, wallDir: "None", floorDir: "None", ceilDir: "None", ledges: 0 });
ok(rNone.paths.length === 0, "all planes None + no ledges = empty (no stray geometry)");
const rGrid = run({ ...p0, mode: "Grid", wallDir: "None", floorDir: "None", ceilDir: "None" });
ok(rGrid.paths.length > 500, "Grid mode ignores the per-plane direction selects");

/* --- geometry: replicate the projection to test doors and occlusion --- */
const W = 297, Hh = 210;
const geo = (p) => {
  const mg = p.margin, x0 = mg, x1 = W - mg, y0 = mg, y1 = Hh - mg;
  const vpx = (W * p.vpx) / 100, vpy = (Hh * p.vpy) / 100, hw = p.aspect, hh = 1, K = 100;
  const px = (X, Y, Z) => [vpx + (X * K) / Z, vpy + (Y * K) / Z];
  const ZnF = (hh * K) / (y1 - vpy), ZnL = (hw * K) / (vpx - x0), ZnR = (hw * K) / (x1 - vpx);
  const r = 1 + p.rhythm, lh = (p.ledgeH / 100) * 2, ld = (p.ledgeD / 100) * 2 * hw;
  const Za = Math.max(Math.min(ZnL, ZnR) * 0.9, ZnF * 0.95), bay = Za * (r - 1), Zb = Za + bay * p.ledgeFill;
  const gZ0 = Zb, gZ1 = Za + bay, gL = gZ1 - gZ0, Zd0 = gZ0 + gL * 0.22, Zd1 = gZ1 - gL * 0.22;
  const doorTop = hh - (p.doorH / 100) * 2;
  return { px, hw, hh, lh, ld, Za, Zb, Zd0, Zd1, doorTop, vpx };
};
const inQuad = (q, pt) => { /* convex quad, any winding */
  let sgn = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const c = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    if (Math.abs(c) < 1e-9) return false;
    if (sgn === 0) sgn = Math.sign(c); else if (Math.sign(c) !== sgn) return false;
  }
  return true;
};
const sampled = (r, n) => r.paths.flatMap((q) => { const out = []; for (let i = 0; i + 1 < q.pts.length; i++) for (let k = 0; k <= n; k++) { const t = k / n; out.push([q.pts[i][0] + (q.pts[i + 1][0] - q.pts[i][0]) * t, q.pts[i][1] + (q.pts[i + 1][1] - q.pts[i][1]) * t]); } return out; });
const shrink = (q, d) => { const cx = q.reduce((a, v) => a + v[0], 0) / 4, cy = q.reduce((a, v) => a + v[1], 0) / 4; return q.map(([x, y]) => { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1; return [x - (dx / L) * d, y - (dy / L) * d]; }); };

const pD = { ...p0, hand: 0, ledges: 1, doors: true, floorDir: "None", ceilDir: "None" };
const G = geo(pD);
/* the door opening above ledge height: below it the nearer ledge legitimately overlaps the door in page space */
const doorQ = shrink([G.px(-G.hw, G.doorTop, G.Zd0), G.px(-G.hw, G.doorTop, G.Zd1), G.px(-G.hw, G.hh - G.lh - 0.08, G.Zd1), G.px(-G.hw, G.hh - G.lh - 0.08, G.Zd0)], 0.6);
const inDoor = (r) => sampled(r, 40).filter((pt) => inQuad(doorQ, pt)).length;
ok(inDoor(run(pD)) === 0, "doorway: no hatch inside the left door opening");
ok(inDoor(run({ ...pD, doors: false })) > 20, "doorway mutation: doors off puts hatch back into that region (" + inDoor(run({ ...pD, doors: false })) + " pts)");
const pierQ = shrink([G.px(-G.hw, G.doorTop + 0.02, G.Zb), G.px(-G.hw, G.doorTop + 0.02, G.Zd0), G.px(-G.hw, G.hh, G.Zd0), G.px(-G.hw, G.hh, G.Zb)], 0.3);
ok(sampled(run(pD), 40).filter((pt) => inQuad(pierQ, pt)).length > 0, "doorway: the wall pier beside the door is still hatched to the floor");

/* occlusion: wall verticals must not pass through the front face of the first ledge */
const pO = { ...p0, hand: 0, ledges: 1, doors: false, floorDir: "None", ceilDir: "None", wallDir: "Across" };
const GO = geo(pO);
const frontQ = shrink([GO.px(-GO.hw, GO.hh - GO.lh, GO.Za), GO.px(-GO.hw + GO.ld, GO.hh - GO.lh, GO.Za), GO.px(-GO.hw + GO.ld, GO.hh, GO.Za), GO.px(-GO.hw, GO.hh, GO.Za)], 0.4);
const rO = run(pO);
const vert = rO.paths.filter((q) => Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6);
const vInFront = sampled({ paths: vert }, 60).filter((pt) => inQuad(frontQ, pt)).length;
ok(vInFront === 0, "occlusion: no wall vertical passes through the first ledge's front face");
const aboveQ = shrink([GO.px(-GO.hw, -GO.hh + 0.3, GO.Za), GO.px(-GO.hw, -GO.hh + 0.3, GO.Zb), GO.px(-GO.hw, GO.hh - GO.lh - 0.05, GO.Zb), GO.px(-GO.hw, GO.hh - GO.lh - 0.05, GO.Za)], 0.3);
ok(sampled({ paths: vert }, 60).filter((pt) => inQuad(aboveQ, pt)).length > 0, "occlusion: the wall above the ledge is still hatched");
ok(vert.length > 0, "wall Across produces vertical strokes (" + vert.length + ")");
const horiz = rO.paths.filter((q) => Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-6);
ok(horiz.some((q) => inQuad(shrink(frontQ, -0.5), q.pts[0])), "ledge front face is hatched horizontally");

/* floor lines stop at the ledge: no floor transversal inside the ledge silhouette */
const pF = { ...p0, hand: 0, ledges: 1, doors: false, wallDir: "None", ceilDir: "None", floorDir: "Across", ledgeH: 20 };
const GF = geo(pF);
const rF = run(pF);
const topQ = shrink([GF.px(-GF.hw, GF.hh - GF.lh, GF.Za), GF.px(-GF.hw + GF.ld, GF.hh - GF.lh, GF.Za), GF.px(-GF.hw + GF.ld, GF.hh - GF.lh, GF.Zb), GF.px(-GF.hw, GF.hh - GF.lh, GF.Zb)], 0.3);
/* the top face is hatched too, so test the front face instead: only the ledge's own horizontals may sit there and they span exactly the face width */
const frontQF = shrink([GF.px(-GF.hw, GF.hh - GF.lh, GF.Za), GF.px(-GF.hw + GF.ld, GF.hh - GF.lh, GF.Za), GF.px(-GF.hw + GF.ld, GF.hh, GF.Za), GF.px(-GF.hw, GF.hh, GF.Za)], 0.4);
const faceW = GF.px(-GF.hw + GF.ld, 0, GF.Za)[0] - GF.px(-GF.hw, 0, GF.Za)[0];
const longInFront = rF.paths.filter((q) => inQuad(frontQF, q.pts[0]) || inQuad(frontQF, q.pts[1])).filter((q) => Math.abs(q.pts[1][0] - q.pts[0][0]) > faceW + 0.5).length;
ok(longInFront === 0, "occlusion: floor transversals are cut at the ledge (no long line through its front face)");
ok(topQ.length === 4, "top-face quad computed");

/* --- far wall --- */
const rFar = run({ ...p0, hand: 0, far: 30, ledges: 0, wallDir: "None", floorDir: "None", ceilDir: "None" });
ok(rFar.paths.length > 10 && rFar.paths.every((q) => Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-6), "far wall alone: horizontal hatch");
const farH = Math.max(...pts(rFar).map((q) => q[1])) - Math.min(...pts(rFar).map((q) => q[1]));
ok(Math.abs(farH - 210 * 0.3) < 4, "far wall 30 % spans ~30 % of the sheet height (" + farH.toFixed(1) + " mm)");

/* --- LOD: hatch reaches the vanishing point region --- */
const rVP = run({ ...p0, hand: 0, ledges: 0 });
const vp = [297 * p0.vpx / 100, 210 * p0.vpy / 100];
const near = pts(rVP).filter((q) => Math.hypot(q[0] - vp[0], q[1] - vp[1]) < 6).length;
ok(near > 0, "hatch continues into the vanishing-point region (" + near + " pts within 6 mm)");
const minSpacing = (() => {
  const ys = rVP.paths.filter((q) => Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-6 && q.pts[0][1] > vp[1] && Math.min(q.pts[0][0], q.pts[1][0]) < vp[0] && Math.max(q.pts[0][0], q.pts[1][0]) > vp[0]).map((q) => q.pts[0][1]).sort((a, b) => a - b);
  let m = Infinity; for (let i = 1; i < ys.length; i++) m = Math.min(m, ys[i] - ys[i - 1]); return m;
})();
ok(minSpacing >= p0.minGap * 0.85, "floor transversals never much closer than Min gap - LOD stride handovers allow ~15 % (min " + minSpacing.toFixed(3) + " mm)");

const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);

/* --- density bands line up across planes regardless of Aspect --- */
for (const asp of [0.7, 1.6]) {
  const pB = { ...p0, mode: "Grid", hand: 0, ledges: 0, aspect: asp, vpx: 50, vpy: 50, margin: 6 };
  const rB = run(pB);
  const vpB = [297 * 0.5, 210 * 0.5], K = 100;
  const zFloor = new Set(rB.paths.filter((q) => Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-6 && q.pts[0][1] > vpB[1] + 0.5).map((q) => (K / (q.pts[0][1] - vpB[1])).toFixed(4)));
  const zWall = new Set(rB.paths.filter((q) => Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6 && q.pts[0][0] < vpB[0] - 0.5).map((q) => ((asp * K) / (vpB[0] - q.pts[0][0])).toFixed(4)));
  const zMin = Math.max(K / (210 - 6 - vpB[1]), (asp * K) / (vpB[0] - 6)) * 1.001;
  const fl = [...zFloor].filter((z) => +z > zMin).sort(), wl = [...zWall].filter((z) => +z > zMin).sort();
  ok(fl.length > 50 && fl.join() === wl.join(), "Grid aspect " + asp + ": floor and wall transversals share one depth set (" + fl.length + " vs " + wl.length + ")");
}

/* --- Walls = Sheet edges: corner lines hit the frame corners, right wall exists at VP 88 % --- */
const pS = { ...p0, walls: "Sheet edges", mode: "Grid", hand: 0, ledges: 0, edges: true, vpx: 88, vpy: 40 };
const rS = run(pS);
const eS = rS.paths.filter((q) => q.layer === pS.edgePen);
const hits = [[6, 6], [291, 6], [291, 204], [6, 204]].filter(([cx, cy]) => eS.some((q) => q.pts.some(([x, y]) => Math.hypot(x - cx, y - cy) < 0.6)));
ok(hits.length === 4, "Sheet edges: all four corner lines reach the frame corners (" + hits.length + "/4)");
const rightWall = rS.paths.filter((q) => q.layer === pS.layer && Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6 && q.pts[0][0] > 297 * 0.88 + 2).length;
ok(rightWall > 10, "Sheet edges: the right wall is drawn at VP 88 % (" + rightWall + " verticals)");
ok(JSON.stringify(run({ ...p0, walls: "Sheet edges", aspect: 2.5 })) === JSON.stringify(run({ ...p0, walls: "Sheet edges", aspect: 0.5 })), "Sheet edges: Aspect is ignored");
ok(JSON.stringify(run({ ...p0, walls: "Sheet edges" })) !== bJ, "param live: walls");
ok(!vis({ ...p0, walls: "Sheet edges" }).includes("aspect") && vis(p0).includes("aspect"), "showIf: Aspect hidden in Sheet edges");
const gS = def.overlay(pS, { W: 297, H: 210 }, undefined, {});
ok(gS.filter((g) => g.kind === "poly").every((g) => [[6, 6], [291, 6], [291, 204], [6, 204]].some(([cx, cy]) => Math.hypot(g.pts[1][0] - cx, g.pts[1][1] - cy) < 1e-6)), "overlay: Sheet edges rays end in the frame corners");

/* --- degenerate and extreme values --- */
const degenerate = run({ ...p0, gap: 0.6, minGap: 0.2, aspect: 0.3, vpx: 5, vpy: 5, margin: 40, ledges: 24, rhythm: 0.15, ledgeH: 45, ledgeD: 40, ledgeFill: 0.9, doorH: 95, hand: 1, far: 60, edges: true, mode: "Grid" }, { W: 210, H: 297 });
ok(finiteAll(degenerate) && npts(degenerate) <= 120000, "degenerate params: finite + budget (" + npts(degenerate) + " pts)");
const ext = run({ ...p0, gap: 0.6, minGap: 0.2, ledges: 24, hand: 1, wallDir: "Both", floorDir: "Both", ceilDir: "Both", rhythm: 0.15, aspect: 3, vpx: 95, vpy: 95 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(finiteAll(run({ ...p0, gap: 10, minGap: 3, aspect: 3, margin: 0, vpx: 50, vpy: 50, far: 1 })), "coarse params produce no NaN");
ok(finiteAll(run({ ...p0, vpx: 0, vpy: 100, margin: 100 })), "out-of-range VP / margin clamp without NaN");
ok(finiteAll(run(p0, { W: 60, H: 40 })), "tiny sheet renders finite");

/* --- showIf --- */
const vis2 = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis2(p0).includes("wallDir") && !vis({ ...p0, mode: "Grid" }).includes("wallDir"), "showIf: plane selects hidden in Grid mode");
ok(!vis({ ...p0, ledges: 0 }).includes("rhythm") && vis(p0).includes("rhythm"), "showIf: ledge params follow Ledges > 0");
ok(!vis(p0).includes("edgePen") && vis({ ...p0, edges: true }).includes("edgePen"), "showIf: edge pen follows Edges");
ok(!vis({ ...p0, doors: false }).includes("doorH"), "showIf: door height follows Doorways");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
ok(Array.isArray(g1) && g1.length === 6, "overlay returns frame + VP + 4 corner rays (" + g1.length + ")");
const vpG = g1.find((g) => g.kind === "point");
ok(vpG && Math.abs(vpG.x - 297 * p0.vpx / 100) < 1e-9 && Math.abs(vpG.y - 210 * p0.vpy / 100) < 1e-9, "overlay VP matches compute VP");
let threw = false;
try { def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined); def.overlay({}, {}, undefined, undefined); } catch (e) { threw = true; }
ok(!threw, "overlay never throws on degenerate input");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
