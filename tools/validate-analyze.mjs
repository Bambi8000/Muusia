/* validate-analyze.mjs - Portrait phase 2A geometry + schema validation.
   No ML, no network, no DOM: imports the pure functions straight from
   src/analyze.js (the module deliberately has no react import so this works -
   the harness tests the exact code the app runs, v2.45 lesson).
   Run from repo root: node tools/validate-analyze.mjs */

import {
  traceMask, regionFromMask, simplifyDP, smoothChain, orderConnections,
  structureTensorField, validateAnalysis, polyArea, pointInPoly, analyzeFace, intakeImage,
  detectBeard, CELEB,
} from "../src/analyze.js";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ok  " + msg); } else { fail++; console.log("  FAIL " + msg); } };

/* ---------- traceMask + regionFromMask: disc with a hole ---------- */
console.log("traceMask / regionFromMask");
{
  const W = 100, H = 100;
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 50, y - 50);
    m[y * W + x] = d < 30 && d > 12 ? 1 : 0; /* annulus = disc + hole */
  }
  const reg = regionFromMask(m, W, H);
  ok(!!reg, "annulus produces a region");
  ok(reg.holes.length === 1, "exactly one hole (got " + reg.holes.length + ")");
  const expArea = Math.PI * (30 * 30 - 12 * 12);
  ok(Math.abs(reg.area - expArea) / expArea < 0.06, "area ~ pi(R^2-r^2) (" + reg.area.toFixed(0) + " vs " + expArea.toFixed(0) + ")");
  ok(polyArea(reg.outline) > 0 && polyArea(reg.holes[0]) < 0, "winding normalized: outline positive, hole negative");
  const cx = reg.outline.reduce((s, p) => s + p[0], 0) / reg.outline.length;
  const cy = reg.outline.reduce((s, p) => s + p[1], 0) / reg.outline.length;
  ok(Math.abs(cx - 50) < 1 && Math.abs(cy - 50) < 1, "outline centroid at disc center (" + cx.toFixed(1) + "," + cy.toFixed(1) + ")");
  ok(pointInPoly(50, 50, reg.holes[0]), "disc center lies inside the hole loop");
  const twice = JSON.stringify(regionFromMask(m, W, H));
  ok(twice === JSON.stringify(reg), "deterministic (double run identical)");
}

/* ---------- border contact + fragmentation confidence ---------- */
console.log("border / fragmentation");
{
  const W = 60, H = 60;
  const m = new Uint8Array(W * H);
  for (let y = 0; y < 20; y++) for (let x = 0; x < W; x++) m[y * W + x] = 1; /* band touching 3 borders */
  const reg = regionFromMask(m, W, H);
  ok(!!reg && reg.holes.length === 0, "border-touching band closes into one loop");
  ok(Math.abs(reg.area - 20 * W) / (20 * W) < 0.08, "band area right (" + reg.area.toFixed(0) + " vs " + 20 * W + ")");

  const m2 = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - 20, y - 30) < 12) m2[y * W + x] = 1;      /* big */
    if (Math.hypot(x - 48, y - 30) < 5) m2[y * W + x] = 1;       /* small satellite */
  }
  const reg2 = regionFromMask(m2, W, H);
  const expConf = (12 * 12) / (12 * 12 + 5 * 5);
  ok(Math.abs(reg2.confidence - expConf) < 0.06, "fragmentation confidence ~ big/(big+small) (" + reg2.confidence + " vs " + expConf.toFixed(3) + ")");
}

/* ---------- simplifyDP ---------- */
console.log("simplifyDP");
{
  const circ = [];
  for (let k = 0; k < 720; k++) {
    const a = (k / 720) * Math.PI * 2;
    circ.push([50 + 30 * Math.cos(a), 50 + 30 * Math.sin(a)]);
  }
  const s15 = simplifyDP(circ, 1.5, true);
  const s40 = simplifyDP(circ, 4.0, true);
  ok(s15.length < circ.length / 5 && s15.length >= 8, "tol 1.5 shrinks 720 -> " + s15.length + " pts");
  ok(s40.length < s15.length, "higher tol -> fewer points (" + s15.length + " -> " + s40.length + ")");
  const maxDev = Math.max(...s15.map(([x, y]) => Math.abs(Math.hypot(x - 50, y - 50) - 30)));
  ok(maxDev < 1.6, "simplified points stay on the circle (max radial dev " + maxDev.toFixed(2) + ")");
  const open = [[0, 0], [10, 0.2], [20, -0.1], [30, 8], [40, 0]];
  const so = simplifyDP(open, 1, false);
  ok(so[0][0] === 0 && so[so.length - 1][0] === 40, "open chain keeps its endpoints");
  ok(so.some(([x]) => x === 30), "open chain keeps the 8-unit spike");
}

/* ---------- smoothChain ---------- */
console.log("smoothChain");
{
  const zig = [];
  for (let i = 0; i <= 20; i++) zig.push([i * 5, (i % 2) * 4]);
  const sm = smoothChain(zig, false, 2);
  ok(sm[0][1] === zig[0][1] && sm[sm.length - 1][1] === zig[zig.length - 1][1], "open endpoints pinned");
  const amp = (pts) => Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
  ok(amp(sm) < amp(zig) * 0.7, "zigzag amplitude reduced (" + amp(zig).toFixed(1) + " -> " + amp(sm).toFixed(1) + ")");
}

/* ---------- orderConnections ---------- */
console.log("orderConnections");
{
  const loop = orderConnections([{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 0 }]);
  ok(loop.length === 1 && loop[0].closed && loop[0].idx.length === 3, "3-cycle -> one closed chain of 3");
  const open = orderConnections([{ start: 5, end: 6 }, { start: 6, end: 7 }]);
  ok(open.length === 1 && !open[0].closed && open[0].idx.join(",") === "5,6,7", "open pair chain walks 5-6-7");
  const lips = orderConnections([
    { start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 0 }, /* outer */
    { start: 10, end: 11 }, { start: 11, end: 12 }, { start: 12, end: 10 },                  /* inner */
  ]);
  ok(lips.length === 2 && lips.every((c) => c.closed), "two disjoint loops (lips outer+inner) both found");
}

/* ---------- structureTensorField: known stripe angle ---------- */
console.log("structureTensorField");
{
  const W = 256, H = 256;
  const strand = (30 * Math.PI) / 180; /* strands run along 30 deg */
  const nx = Math.cos(strand + Math.PI / 2), ny = Math.sin(strand + Math.PI / 2);
  const g = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    g[y * W + x] = 0.5 + 0.5 * Math.sin((x * nx + y * ny) * 0.5);
  const f = structureTensorField({ w: W, h: H, g }, () => true, 16);
  ok(f.ang.length === f.w * f.h && f.coh.length === f.w * f.h, "field lengths = w*h");
  const strong = f.ang.filter((_, i) => f.coh[i] > 0.8);
  const devs = strong.map((a) => {
    let d = Math.abs(a - strand) % Math.PI;
    return Math.min(d, Math.PI - d);
  }).sort((a, b) => a - b);
  const med = devs[Math.floor(devs.length / 2)] * 180 / Math.PI;
  ok(strong.length > f.ang.length * 0.7, "stripes give high coherence in most cells (" + strong.length + "/" + f.ang.length + ")");
  ok(med < 3, "median flow angle within 3 deg of the strand direction (dev " + med.toFixed(2) + " deg)");
  /* incoherent noise -> low coherence */
  const rnd = new Array(W * H);
  let s = 12345;
  for (let i = 0; i < W * H; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; rnd[i] = (s / 0x7fffffff); }
  const fr = structureTensorField({ w: W, h: H, g: rnd }, () => true, 16);
  const cs = [...fr.coh].sort((a, b) => a - b);
  ok(cs[Math.floor(cs.length / 2)] < 0.4, "noise field is incoherent (median coh " + cs[Math.floor(cs.length / 2)].toFixed(3) + ")");
}

/* ---------- validateAnalysis: good fixture + garbage ---------- */
console.log("validateAnalysis");
{
  const chain = (n) => ({ pts: Array.from({ length: n }, (_, i) => [i * 2, i]), closed: false, confidence: 1 });
  const good = {
    v: 1,
    engine: { landmarker: "x", parsing: "y", modelHash: "z" },
    img: { w: 960, h: 1280 },
    face: {
      found: true, confidence: 0.9, pose: { yaw: 3.2, pitch: -1, roll: 0.4 },
      chains: { faceOval: chain(30), eyeL: chain(8), eyeR: chain(8), lipsOuter: chain(12), lipsInner: chain(9), noseBridge: chain(6), nostrils: chain(5), browL: chain(6), browR: chain(6), irisL: chain(4), irisR: chain(4) },
    },
    regions: {
      hair: { outline: [[0, 0], [100, 0], [100, 100], [0, 100]], holes: [[[40, 40], [60, 40], [50, 60]]], area: 9800, confidence: 0.95 },
      glasses: null, earL: null, earR: null, skin: { outline: [[10, 10], [90, 10], [50, 90]], holes: [], area: 3200, confidence: 1 }, neck: null,
    },
    hairFlow: { cell: 16, w: 4, h: 3, ang: new Array(12).fill(0.5), coh: new Array(12).fill(0.9) },
    warnings: ["glasses low confidence - expect cleanup or switch the layer off"],
  };
  ok(validateAnalysis(good, 960, 1280).ok, "good fixture passes");
  ok(validateAnalysis(good).ok, "img-size check optional");
  const noFace = { ...good, face: { found: false } };
  ok(validateAnalysis(noFace, 960, 1280).ok, "found:false is a VALID analysis (degrades to tonal)");
  const bads = [
    [null, "null"],
    ["garbage", "a string"],
    [{ ...good, v: 99 }, "unknown version"],
    [{ ...good, img: { w: NaN, h: 1280 } }, "NaN img size"],
    [{ ...good, face: { found: true, chains: { eyeL: { pts: [[1, NaN]], closed: true } } } }, "NaN in a chain"],
    [{ ...good, hairFlow: { cell: 16, w: 4, h: 3, ang: [1, 2], coh: [1, 2] } }, "hairFlow length mismatch"],
    [{ ...good, regions: { hair: { outline: [[0, 0]], holes: [], area: 1 } } }, "degenerate outline"],
    [{ ...good, warnings: [42] }, "non-string warning"],
  ];
  for (const [bad, label] of bads) {
    const r = validateAnalysis(bad, 960, 1280);
    ok(!r.ok && r.errors.length > 0, "rejects " + label + " without crashing (" + (r.errors[0] || "") + ")");
  }
  ok(!validateAnalysis(good, 640, 480).ok, "img size mismatch against node.data.img caught");
}

/* ---------- error paths that precede any DOM/network ---------- */
console.log("early error paths");
{
  let msg = "";
  await analyzeFace(null).catch((e) => { msg = e.message; });
  ok(/no photo/i.test(msg), "analyzeFace without data throws the friendly message");
  msg = "";
  await intakeImage("data:image/heic;base64,AAA", "kuva.heic").catch((e) => { msg = e.message; });
  ok(/HEIC/.test(msg), "HEIC rejected with a message naming the reason");
  msg = "";
  await intakeImage("data:image/webp;base64,AAA", "kuva.webp").catch((e) => { msg = e.message; });
  ok(/JPEG and PNG/.test(msg), "non-JPEG/PNG rejected");
}

/* ---------- detectBeard: texture heuristic, synthetic fixture ---------- */
console.log("detectBeard");
{
  const W = 400, H = 400;
  const g = new Array(W * H);
  let s = 777;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0.35 + 0.1 * (y / H); /* smooth skin */
    if (y > 250 && y < 360 && x > 140 && x < 260) v = 0.3 + 0.5 * rnd(); /* whisker texture below the mouth */
    g[y * W + x] = v;
  }
  const oval = []; /* face oval ~ circle centered (200,190) r 120 */
  for (let k = 0; k < 24; k++) oval.push([200 + Math.cos(k / 24 * 2 * Math.PI) * 110, 190 + Math.sin(k / 24 * 2 * Math.PI) * 120]);
  const lips = [[170, 250], [190, 254], [210, 254], [230, 250]];
  const faces = [{ found: true, chains: { faceOval: { pts: oval }, lipsOuter: { pts: lips } } }];
  const bd = detectBeard({ img: { w: W, h: H, g }, faces, clsAt: () => CELEB.skin, C: CELEB });
  ok(!!bd && bd.cells > 20, "textured zone below the mouth detected (" + (bd ? bd.cells : 0) + " cells)");
  ok(bd.maskAtImg(200, 300) && !bd.maskAtImg(200, 150), "mask covers the whiskers, not the smooth forehead");
  let strays = 0;
  for (let cy = 0; cy < bd.gh; cy++) for (let cx = 0; cx < bd.gw; cx++) {
    if (!bd.mask[cy * bd.gw + cx]) continue;
    const X = cx * bd.cell + 4, Y = cy * bd.cell + 4;
    if (!(Y > 235 && Y < 375 && X > 125 && X < 275)) strays++;
  }
  ok(strays === 0, "no beard cells outside the textured zone");
  const smoothG = g.map((v, i) => 0.35 + 0.1 * (Math.floor(i / W) / H));
  ok(detectBeard({ img: { w: W, h: H, g: smoothG }, faces, clsAt: () => CELEB.skin, C: CELEB }) === null, "clean-shaven face -> null");
  ok(detectBeard({ img: { w: W, h: H, g }, faces: [], clsAt: () => CELEB.skin, C: CELEB }) === null, "no faces -> null");
  ok(JSON.stringify(detectBeard({ img: { w: W, h: H, g }, faces, clsAt: () => CELEB.skin, C: CELEB }).mask) === JSON.stringify(bd.mask), "deterministic");
}

/* ---------- schema: additive multi-face + beard fields ---------- */
console.log("schema additions");
{
  const chain = (n) => ({ pts: Array.from({ length: n }, (_, i) => [i * 2, i]), closed: false, confidence: 1 });
  const face = { found: true, confidence: 0.9, pose: { yaw: 0, pitch: 0, roll: 0 }, chains: { eyeL: chain(8), faceOval: chain(20), lipsOuter: chain(10) } };
  const a = {
    v: 1, engine: { landmarker: "x", parsing: "y", modelHash: "z" }, img: { w: 960, h: 1280 },
    face, faces: [face, face],
    regions: { beard: { outline: [[0, 0], [50, 0], [25, 40]], holes: [], area: 900, confidence: 0.8,
      parts: [{ outline: [[0, 0], [50, 0], [25, 40]], holes: [], area: 900 }] } },
    hairFlow: null, beardFlow: { cell: 16, w: 3, h: 2, ang: new Array(6).fill(1), coh: new Array(6).fill(0.9) },
    warnings: [],
  };
  ok(validateAnalysis(a, 960, 1280).ok, "faces[] + beard region + parts + beardFlow accepted");
  ok(!validateAnalysis({ ...a, faces: "x" }, 960, 1280).ok, "malformed faces rejected");
  ok(!validateAnalysis({ ...a, beardFlow: { cell: 16, w: 3, h: 2, ang: [1], coh: [1] } }, 960, 1280).ok, "malformed beardFlow rejected");
  ok(!validateAnalysis({ ...a, regions: { beard: { ...a.regions.beard, parts: [{ outline: [[0, 0]] }] } } }, 960, 1280).ok, "malformed parts rejected");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail > 0) process.exitCode = 1;
