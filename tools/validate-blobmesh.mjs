/* validate-blobmesh.mjs — Blob Mesh node validator.
   Uses the REAL src/defs/helpers.js. Auto-switches lab/baked.
   Also checks the mesh handshake with Mesh Slice when that node is baked. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as H from "../src/defs/helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const labPath = join(root, "nodes-lab", "blobmesh.plotternode.js");
const bakedPath = join(root, "src", "defs", "nodes", "blobmesh.js");
const slicePath = join(root, "src", "defs", "nodes", "meshslice.js");

const NAMES = ["noise2", "mulberry32", "hash2", "resample", "pathLength", "applyStyle", "isStyle", "signedArea", "EMPTY", "PENS", "Pin", "SFONT", "fontStrokes", "parseSVG"];
const VALS = NAMES.map((n) => H[n]);
const evalNode = (src, baked) => {
  let s = src;
  if (baked) s = s.replace(/^import[^\n]*\n/m, "").replace("export default", "return");
  return baked
    ? new Function(...NAMES, '"use strict";' + s)(...VALS)
    : new Function(...NAMES, '"use strict"; return (' + s + ");")(...VALS);
};

let def, tag;
if (existsSync(bakedPath)) { tag = "[baked]"; def = evalNode(readFileSync(bakedPath, "utf8"), true); }
else { tag = "[lab]"; def = evalNode(readFileSync(labPath, "utf8"), false); }
console.log(tag + " blobmesh");

let nOK = 0, nFail = 0;
const ok = (name, cond) => {
  if (cond) { nOK++; console.log("  OK  " + name); }
  else { nFail++; console.log("FAIL  " + name); }
};

const CTX = { W: 297, H: 210 };
const P0 = {};
for (const pr of def.params) P0[pr.key] = pr.def;
const run = (over, insArr, ctx) => def.compute(insArr || [undefined, undefined], { ...P0, ...over }, ctx === undefined ? CTX : ctx, {});
const J = (r) => JSON.stringify(r);
const pts = (r) => [...r[0].paths, ...r[1].paths].flatMap((q) => q.pts);
const finite = (r) => pts(r).every(([x, y]) => isFinite(x) && isFinite(y)) && r[2] !== null && r[2].v.every((n) => isFinite(n));
const bboxOf = (P) => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of P) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
};
const meshBBox = (m) => {
  const r = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.v.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (m.v[i + k] < r[k]) r[k] = m.v[i + k];
      if (m.v[i + k] > r[k + 3]) r[k + 3] = m.v[i + k];
    }
  }
  return r;
};

/* ---------- 1. output contract ---------- */
const base = run({});
ok("returns three outputs", Array.isArray(base) && base.length === 3);
ok("out 0 is paths (wireframe) so the node previews itself", base[0] && Array.isArray(base[0].paths) && base[0].paths.length > 0);
ok("out 1 is paths (silhouette)", base[1] && Array.isArray(base[1].paths));
ok("out 2 is a mesh payload", base[2] && base[2].kind === "mesh");
ok("pins: Wireframe/Silhouette are paths, Mesh is mesh", def.outs[0].type === "paths" && def.outs[1].type === "paths" && def.outs[2].type === "mesh");
ok("ins: Profile paths + Style", def.ins[0].type === "paths" && def.ins[1].type === "style");

/* ---------- 2. mesh format matches the STL intake contract ---------- */
const m0 = base[2];
ok("mesh.v length is tri * 9", m0.v.length === m0.tri * 9);
ok("triangle count follows S*(2R-2)", m0.tri === P0.segs * (2 * P0.rings - 2));
const bb = meshBBox(m0);
const dims = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]];
ok("longest dimension normalised to 1", Math.abs(Math.max(...dims) - 1) < 1e-3);
ok("centred on the origin", dims.every((d, i) => Math.abs((bb[i] + bb[i + 3]) / 2) < 1e-3));
ok("declared dims match the vertex data", m0.dims.every((d, i) => Math.abs(d - dims[i]) < 2e-3));
ok("coordinates rounded to 1e-4 like the STL intake", m0.v.every((n) => Math.abs(n * 10000 - Math.round(n * 10000)) < 1e-6));
ok("all vertices finite", finite(base));

/* ---------- 3. determinism, seed, non-mutation ---------- */
ok("deterministic", J(run({})) === J(run({})));
ok("seed changes the shape", J(run({ seed: 1, noiseAmp: 20 })) !== J(run({ seed: 2, noiseAmp: 20 })));
const profIn = { paths: [{ pts: [[0, 0], [20, 0], [14, 40], [4, 40]], closed: true }] };
const snap = J(profIn);
run({ profile: "Wired input" }, [profIn, undefined]);
ok("profile input not mutated", J(profIn) === snap);

/* ---------- 4. body: metaballs ---------- */
ok("ball count changes the body", J(run({ balls: 1 })) !== J(run({ balls: 4, spread: 40 })));
ok("spread changes the body", J(run({ balls: 3, spread: 5 })) !== J(run({ balls: 3, spread: 70 })));
ok("blend changes the body", J(run({ balls: 3, spread: 40, blend: 5 })) !== J(run({ balls: 3, spread: 40, blend: 95 })));
ok("size variation changes the body", J(run({ balls: 3, sizeVar: 0 })) !== J(run({ balls: 3, sizeVar: 70 })));
const oneBall = run({ balls: 1, noiseAmp: 0, lobeN: 0, waveN: 0, radX: 100, radY: 100, radZ: 100, profile: "None", twist: 0, taper: 0 });
const ob = meshBBox(oneBall[2]);
ok("a single ball with no distortion is a sphere (dims equal)", Math.abs(ob[3] - ob[0] - (ob[4] - ob[1])) < 0.02 && Math.abs(ob[3] - ob[0] - (ob[5] - ob[2])) < 0.02);

/* ---------- 5. ovality ---------- */
const flat = run({ balls: 1, radX: 200, radY: 60, radZ: 60, noiseAmp: 0 });
const fb = meshBBox(flat[2]);
ok("Radius X/Y/Z produce an oval (X widest, 1.0 after normalisation)", Math.abs(fb[3] - fb[0] - 1) < 1e-3 && fb[4] - fb[1] < 0.4);
ok("radius ratio Y:X tracks the parameters", Math.abs((fb[4] - fb[1]) / (fb[3] - fb[0]) - 0.3) < 0.05);
for (const k of ["radX", "radY", "radZ"]) ok("live: " + k, J(run({ [k]: 60 })) !== J(run({ [k]: 160 })));

/* ---------- 6. profile ---------- */
for (const o of def.params.find((q) => q.key === "profile").options) {
  let good = true;
  try {
    const r = o === "Wired input" ? run({ profile: o }, [profIn, undefined]) : run({ profile: o });
    good = finite(r) && r[2].tri > 0;
  } catch (e) { good = false; }
  ok("profile option " + o, good);
}
ok("profile changes the shape", J(run({ profile: "None" })) !== J(run({ profile: "Hourglass" })));
ok("profile amount is live", J(run({ profile: "Pear", profileAmt: 20 })) !== J(run({ profile: "Pear", profileAmt: 100 })));
ok("wired profile beats the unwired fallback", J(run({ profile: "Wired input" }, [profIn, undefined])) !== J(run({ profile: "Wired input" })));
ok("Wired input with nothing wired still produces a mesh", run({ profile: "Wired input" })[2].tri > 0);
ok("empty paths on the profile input are tolerated", run({ profile: "Wired input" }, [{ paths: [] }, undefined])[2].tri > 0);
const hourglass = run({ balls: 1, profile: "Hourglass", noiseAmp: 0, radZ: 100 });
ok("Hourglass pinches the waist", (() => {
  const m = hourglass[2];
  let wMid = 0, wEnd = 0;
  for (let i = 0; i < m.v.length; i += 3) {
    const r = Math.hypot(m.v[i], m.v[i + 1]);
    if (Math.abs(m.v[i + 2]) < 0.05) wMid = Math.max(wMid, r);
    if (Math.abs(Math.abs(m.v[i + 2]) - 0.25) < 0.05) wEnd = Math.max(wEnd, r);
  }
  return wMid > 0 && wEnd > wMid * 1.05;
})());

/* ---------- 6b. manual ball placement ---------- */
const MAN = { balls: 3, ballMode: "Manual", blend: 60, noiseAmp: 0, bX1: 0, bY1: 0, bZ1: 0, bR1: 100, bX2: 70, bY2: 0, bZ2: 0, bR2: 70, bX3: -50, bY3: 40, bZ3: -40, bR3: 70 };
ok("manual placement differs from seeded", J(run({ ...MAN })) !== J(run({ ...MAN, ballMode: "Seeded" })));
ok("manual placement ignores the seed", J(run({ ...MAN, seed: 2 })) === J(run({ ...MAN, seed: 88 })));
for (let i = 1; i <= 5; i++) {
  const b = { ...MAN, balls: 5, bX4: 0, bY4: -50, bZ4: 30, bR4: 60, bX5: 20, bY5: 20, bZ5: 50, bR5: 60 };
  ok("live: bX" + i, J(run({ ...b, ["bX" + i]: -80 })) !== J(run({ ...b, ["bX" + i]: 80 })));
  ok("live: bY" + i, J(run({ ...b, ["bY" + i]: -80 })) !== J(run({ ...b, ["bY" + i]: 80 })));
  ok("live: bZ" + i, J(run({ ...b, ["bZ" + i]: -80 })) !== J(run({ ...b, ["bZ" + i]: 80 })));
  ok("live: bR" + i, J(run({ ...b, ["bR" + i]: 20 })) !== J(run({ ...b, ["bR" + i]: 140 })));
}
const stretched = run({ ...MAN, balls: 2, bX2: 110, bR2: 60 });
const sb2 = meshBBox(stretched[2]);
ok("moving a ball out stretches the mesh along X", (sb2[3] - sb2[0]) / Math.max(1e-6, sb2[4] - sb2[1]) > 1.6);
ok("the far ball's lobe reaches past the centre ball", (() => {
  const m = stretched[2];
  let mx = -Infinity;
  for (let i = 0; i < m.v.length; i += 3) if (m.v[i] > mx) mx = m.v[i];
  return mx > 0.3;
})());
const apart = run({ balls: 2, ballMode: "Manual", blend: 5, bX1: -110, bR1: 45, bX2: 110, bR2: 45, noiseAmp: 0 });
ok("balls pulled fully apart still produce a finite mesh (origin outside the union)", finite(apart) && apart[2].tri > 0);
ok("ball mode is live", J(run({ balls: 3, ballMode: "Seeded" })) !== J(run({ balls: 3, ballMode: "Manual" })));

/* ---------- 6c. wired input read as cross-section ---------- */
const starPts = [];
for (let i = 0; i < 240; i++) {
  const a = (i / 240) * Math.PI * 2;
  const r = 40 * (1 + 0.45 * Math.cos(8 * a));
  starPts.push([148.5 + r * Math.cos(a), 105 + r * Math.sin(a)]);
}
const starIn = { paths: [{ pts: starPts, closed: true }] };
const XS = { profile: "Wired input", wiredAs: "Cross-section", profileAmt: 100, balls: 1, noiseAmp: 0, rings: 40, segs: 96 };
const xs = run(XS, [starIn, undefined]);
ok("cross-section mode produces a mesh", xs[2].tri > 0 && finite(xs));
ok("cross-section differs from vertical profile on the same input", J(xs) !== J(run({ ...XS, wiredAs: "Vertical profile" }, [starIn, undefined])));
ok("cross-section makes the equator lobed, not round", (() => {
  const m = xs[2];
  let mn = Infinity, mx = 0;
  for (let i = 0; i < m.v.length; i += 3) {
    if (Math.abs(m.v[i + 2]) > 0.03) continue;
    const r = Math.hypot(m.v[i], m.v[i + 1]);
    if (r < mn) mn = r; if (r > mx) mx = r;
  }
  return mx > mn * 1.5;
})());
ok("cross-section with nothing wired leaves the body round", J(run(XS)) === J(run({ ...XS, profile: "None" })));
ok("wiredAs is live", J(run({ ...XS, wiredAs: "Cross-section" }, [starIn, undefined])) !== J(run({ ...XS, wiredAs: "Vertical profile" }, [starIn, undefined])));
ok("Profile amount 0 is a true no-op (the silent-looking case)", J(run({ ...XS, profileAmt: 0 }, [starIn, undefined])) === J(run({ ...XS, profile: "None" }, [starIn, undefined])));

/* ---------- 6d. profile mapped against real height, not a guessed constant ---------- */
const bigBall = run({ balls: 1, ballSize: 120, profile: "Hourglass", noiseAmp: 0, rings: 48 });
ok("Hourglass still pinches at ball size 120% (height normalisation)", (() => {
  const m = bigBall[2];
  let wMid = 0, wEnd = 0;
  for (let i = 0; i < m.v.length; i += 3) {
    const r = Math.hypot(m.v[i], m.v[i + 1]);
    if (Math.abs(m.v[i + 2]) < 0.05) wMid = Math.max(wMid, r);
    if (Math.abs(Math.abs(m.v[i + 2]) - 0.25) < 0.05) wEnd = Math.max(wEnd, r);
  }
  return wMid > 0 && wEnd > wMid * 1.05;
})());
ok("profile reaches both ends at any ball size", (() => {
  const a = run({ balls: 1, ballSize: 30, profile: "Teardrop", noiseAmp: 0 })[2];
  const b = run({ balls: 1, ballSize: 120, profile: "Teardrop", noiseAmp: 0 })[2];
  const wa = meshBBox(a), wb2 = meshBBox(b);
  return Math.abs((wa[3] - wa[0]) - (wb2[3] - wb2[0])) < 0.06;
})());

/* ---------- 7. surface distortion ---------- */
ok("noise amount is live", J(run({ noiseAmp: 0 })) !== J(run({ noiseAmp: 30 })));
ok("noise scale is live", J(run({ noiseAmp: 25, noiseScale: 1 })) !== J(run({ noiseAmp: 25, noiseScale: 6 })));
ok("octaves are live", J(run({ noiseAmp: 25, noiseOct: 1 })) !== J(run({ noiseAmp: 25, noiseOct: 4 })));
ok("with one ball and no noise the seed has nothing to drive", J(run({ balls: 1, noiseAmp: 0, seed: 3 })) === J(run({ balls: 1, noiseAmp: 0, seed: 9 })));
ok("seed still moves the extra balls when noise is off", J(run({ balls: 4, spread: 45, noiseAmp: 0, seed: 3 })) !== J(run({ balls: 4, spread: 45, noiseAmp: 0, seed: 9 })));
ok("lobes are live", J(run({ lobeN: 0 })) !== J(run({ lobeN: 5, lobeAmp: 30 })));
ok("lobe depth is live", J(run({ lobeN: 5, lobeAmp: 5 })) !== J(run({ lobeN: 5, lobeAmp: 45 })));
ok("waves are live", J(run({ waveN: 0 })) !== J(run({ waveN: 6, waveAmp: 25 })));
ok("wave depth is live", J(run({ waveN: 6, waveAmp: 5 })) !== J(run({ waveN: 6, waveAmp: 45 })));
const lob = run({ balls: 1, lobeN: 4, lobeAmp: 35, noiseAmp: 0 });
ok("lobes make the equator non-circular", (() => {
  const m = lob[2];
  let mn = Infinity, mx = 0;
  for (let i = 0; i < m.v.length; i += 3) {
    if (Math.abs(m.v[i + 2]) > 0.03) continue;
    const r = Math.hypot(m.v[i], m.v[i + 1]);
    if (r < mn) mn = r; if (r > mx) mx = r;
  }
  return mx > mn * 1.25;
})());
ok("twist is live", J(run({ twist: 0 })) !== J(run({ twist: 180 })));
ok("taper is live", J(run({ taper: -60 })) !== J(run({ taper: 60 })));
const tap = run({ balls: 1, taper: 70, noiseAmp: 0, profile: "None" });
ok("taper widens one end", (() => {
  const m = tap[2];
  let top = 0, bot = 0;
  for (let i = 0; i < m.v.length; i += 3) {
    const r = Math.hypot(m.v[i], m.v[i + 1]);
    if (m.v[i + 2] > 0.3) top = Math.max(top, r);
    if (m.v[i + 2] < -0.3) bot = Math.max(bot, r);
  }
  return Math.abs(top - bot) > 0.02;
})());

/* ---------- 8. resolution ---------- */
const lo = run({ rings: 10, segs: 12 }), hi = run({ rings: 80, segs: 90 });
ok("rings/segments drive the triangle count", lo[2].tri === 12 * 18 && hi[2].tri === 90 * 158);
ok("higher resolution keeps the same overall form", (() => {
  const a = meshBBox(lo[2]), b = meshBBox(hi[2]);
  return Math.abs((a[3] - a[0]) - (b[3] - b[0])) < 0.12;
})());
const maxRes = run({ rings: 128, segs: 128, wireEvery: 1 });
ok("max resolution stays under the 120k triangle Mesh Slice cap", maxRes[2].tri <= 120000);
ok("max resolution respects the path budget", pts(maxRes).length <= 120000 && finite(maxRes));

/* ---------- 9. wireframe + silhouette ---------- */
const w1 = run({ rings: 40, segs: 40, wireEvery: 1 });
ok("wireEvery 1 draws every ring and meridian", w1[0].paths.length === 41 + 40);
const w4 = run({ rings: 40, segs: 40, wireEvery: 4 });
ok("wireEvery thins the cage", w4[0].paths.length < w1[0].paths.length);
ok("rings are closed, meridians are open", w1[0].paths.some((q) => q.closed) && w1[0].paths.some((q) => !q.closed));
const sil = base[1].paths;
ok("silhouette produced", sil.length >= 1);
ok("silhouette uses its own pen", sil.every((q) => q.layer === P0.silPen) && base[0].paths.every((q) => q.layer === P0.layer));
ok("silhouette pen is live", J(run({ silPen: 3 })[1]) !== J(run({ silPen: 5 })[1]));
const wb = bboxOf(base[0].paths.flatMap((q) => q.pts));
const sb = bboxOf(sil.flatMap((q) => q.pts));
ok("silhouette sits on the wireframe outline, not beyond it", sb[0] >= wb[0] - 0.6 && sb[2] <= wb[2] + 0.6 && sb[1] >= wb[1] - 0.6 && sb[3] <= wb[3] + 0.6);
ok("silhouette of a smooth blob spans most of the outline", (sb[2] - sb[0]) > (wb[2] - wb[0]) * 0.9);
ok("view angle is live", J(run({ viewAz: 0 })[0]) !== J(run({ viewAz: 75 })[0]));
ok("view elevation is live", J(run({ viewEl: 10 })[0]) !== J(run({ viewEl: 80 })[0]));
ok("view angle does NOT change the mesh (projection only)", J(run({ viewAz: 0 })[2]) === J(run({ viewAz: 75 })[2]));
ok("preview size is live and scales the drawing", (() => {
  const a = bboxOf(run({ size: 60 })[0].paths.flatMap((q) => q.pts));
  const b = bboxOf(run({ size: 180 })[0].paths.flatMap((q) => q.pts));
  return (b[2] - b[0]) > (a[2] - a[0]) * 2.4;
})());
ok("preview centred on the canvas", Math.abs((wb[0] + wb[2]) / 2 - 148.5) < 1 && Math.abs((wb[1] + wb[3]) / 2 - 105) < 1);
const port = run({}, undefined, { W: 210, H: 297 });
ok("centres on a portrait canvas too", (() => {
  const b = bboxOf(port[0].paths.flatMap((q) => q.pts));
  return Math.abs((b[0] + b[2]) / 2 - 105) < 1 && Math.abs((b[1] + b[3]) / 2 - 148.5) < 1;
})());
ok("null ctx tolerated", (() => { try { return finite(def.compute([undefined, undefined], P0, null, {})); } catch (e) { return false; } })());

/* ---------- 10. style passthrough ---------- */
const styled = run({}, [undefined, { dash: [2, 2] }]);
ok("style applies to both path outputs without throwing", Array.isArray(styled[0].paths) && Array.isArray(styled[1].paths));
ok("pen layers are valid integers", base[0].paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11));

/* ---------- 11. extremes + overlay ---------- */
const ext = [
  { balls: 0 }, { balls: 99 }, { spread: 100, ballSize: 20 }, { ballSize: 120, spread: 100 },
  { blend: 0 }, { blend: 100 }, { radX: 20, radY: 20, radZ: 200 }, { noiseAmp: 60, noiseScale: 8, noiseOct: 4 },
  { lobeN: 12, lobeAmp: 60 }, { waveN: 12, waveAmp: 60 }, { twist: 360, taper: 80 }, { taper: -80 },
  { rings: 8, segs: 8 }, { size: 20 }, { size: 400 }, { profileAmt: 0 }, { seed: 0 }, { seed: 999999 },
];
let eOK = true;
for (const o of ext) {
  try { const r = run(o); if (!finite(r) || r[2].tri <= 0) eOK = false; } catch (e) { eOK = false; }
}
ok("extreme values: no throw, no NaN, mesh always produced", eOK);
const KINDS = new Set(["rect", "circle", "point", "arrow", "poly"]);
let oOK = true;
try {
  const g = def.overlay(P0, CTX, [undefined, undefined], {});
  if (!Array.isArray(g) || !g.length || !g.every((q) => KINDS.has(q.kind))) oOK = false;
  if (!Array.isArray(def.overlay({}, null, [], undefined))) oOK = false;
} catch (e) { oOK = false; }
ok("overlay: valid guides, never throws", oOK);

/* ---------- 12. handshake with Mesh Slice ---------- */
if (existsSync(slicePath)) {
  const slice = evalNode(readFileSync(slicePath, "utf8"), true);
  const meshPin = slice.ins.findIndex((q) => q.type === "mesh");
  ok("Mesh Slice exposes a mesh input", meshPin >= 0);
  if (meshPin >= 0) {
    const SP = {};
    for (const pr of slice.params) SP[pr.key] = pr.def;
    const insArr = [];
    insArr[meshPin] = base[2];
    let good = true, sliced = null;
    try {
      sliced = slice.compute(insArr, { ...SP, mode: "Grid layout", slices: 12, size: 50, gridNum: false }, { W: 420, H: 297 }, { data: {} });
      good = sliced.paths.length > 0 && sliced.paths.every((q) => q.pts.every(([x, y]) => isFinite(x) && isFinite(y)));
    } catch (e) { good = false; }
    ok("Blob Mesh output slices in Mesh Slice", good);
    ok("every sheet produced (12 closed outlines)", sliced && sliced.paths.filter((q) => q.closed).length >= 12);
    let holed = null, hOK = true;
    try {
      const ia = [];
      ia[meshPin] = base[2];
      holed = slice.compute(ia, { ...SP, mode: "Single slice", slice: 6, slices: 12, size: 100, negN: 1, negS1: 45, rodHole: "M4", rodN: 4, rodR: 30 }, { W: 297, H: 210 }, { data: {} });
      hOK = holed.paths.length > 1;
    } catch (e) { hOK = false; }
    ok("negative primitives and rod holes work on a generated mesh", hOK);
  }
} else {
  console.log("  --  meshslice not baked, handshake checks skipped");
}

console.log(nFail === 0 ? "ALL OK (" + nOK + " checks)" : "FAILURES: " + nFail + " / " + (nOK + nFail));
process.exit(nFail === 0 ? 0 : 1);
