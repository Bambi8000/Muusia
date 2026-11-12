// Run: node tools/validate-surface-composer.mjs (Node 20+, no browser required).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createStrip, stripTransform, stripCorners, clipPathsToStrip,
  generateStripTiling, surfaceBounds, stripsInPrintOrder, hitTestStrip,
  surfaceSummary, DEFAULT_STRIP_MATERIAL, MAX_GENERATED_STRIPS,
} from "../src/surface-composer.js";

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const pointsClose = (a, b) => {
  assert.equal(a.length, b.length);
  a.forEach((p, i) => { assert.equal(p.length, b[i].length); p.forEach((n, j) => close(n, b[i][j])); });
};
const path = (pts, extra = {}) => ({ pts, layer: 6, closed: false, ...extra });
const strip = extra => createStrip({ id: "one", centerXmm: 40, centerYmm: 100, lengthMm: 200, ...extra });
const canvas = { widthMm: 2000, heightMm: 2000 };

test("serializable strip defaults distinguish physical paper and printable ink", () => {
  const s = strip();
  assert.deepEqual(DEFAULT_STRIP_MATERIAL, { physicalWidthMm: 80, printableWidthMm: 72 });
  assert.equal(s.physicalWidthMm, 80);
  assert.equal(s.printableWidthMm, 72);
  assert.equal(s.printableOffsetMm, 4);
  assert.equal(s.printOrder, 1);
  assert.equal(s.visible, true);
  assert.equal(s.contentMode, "image-mapping");
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.equal(strip({ physicalWidthMm: 100 }).printableOffsetMm, 14);
});

test("cardinal corners and an off-centre printable area have analytic positions", () => {
  const s = strip({ printableWidthMm: 60, printableOffsetMm: 5 });
  assert.deepEqual(stripCorners(s), [[0, 0], [80, 0], [80, 200], [0, 200]]);
  assert.deepEqual(stripCorners(s, "printable"), [[5, 0], [65, 0], [65, 200], [5, 200]]);
  assert.deepEqual(stripCorners(strip({ rotationDeg: 90 })), [[140, 60], [140, 140], [-60, 140], [-60, 60]]);
  assert.deepEqual(stripCorners(strip({ rotationDeg: 180 })), [[80, 200], [0, 200], [0, 0], [80, 0]]);
  assert.deepEqual(stripCorners(strip({ rotationDeg: 270 })), [[-60, 140], [-60, 60], [140, 60], [140, 140]]);
  assert.throws(() => stripCorners(s, "unknown"));
});

test("rotations normalize without changing position, dimensions, or paper centre", () => {
  assert.equal(strip({ rotationDeg: -45 }).rotationDeg, 315);
  assert.equal(strip({ rotationDeg: 765 }).rotationDeg, 45);
  assert.equal(strip({ rotationDeg: 360 }).rotationDeg, 0);
  assert.equal(Object.is(strip({ rotationDeg: -360 }).rotationDeg, -0), false);
  for (const rotationDeg of [0, 45, 90, 137, 360, -45]) {
    const t = stripTransform(strip({ rotationDeg }));
    pointsClose([t.toGlobal([40, 100, -3])], [[40, 100, -3]]);
    pointsClose([t.toLocal([40, 100, -3])], [[40, 100, -3]]);
    const corners = stripCorners(t.strip);
    close(Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]), 80);
    close(Math.hypot(corners[2][0] - corners[1][0], corners[2][1] - corners[1][1]), 200);
  }
});

test("forward/inverse transforms preserve distance, depth and inputs at varied angles", () => {
  let seed = 20261112;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 200; i++) {
    const s = strip({ centerXmm: random() * 4000 - 2000, centerYmm: random() * 4000 - 2000, rotationDeg: random() * 1440 - 720, lengthMm: 2000 });
    const a = [random() * 1000 - 500, random() * 4000 - 1000, -3];
    const b = [random() * 1000 - 500, random() * 4000 - 1000, -5];
    const saved = JSON.stringify([s, a, b]);
    const t = stripTransform(s), ga = t.toGlobal(a), gb = t.toGlobal(b);
    pointsClose([t.toLocal(ga), t.toLocal(gb)], [a, b]);
    close(Math.hypot(ga[0] - gb[0], ga[1] - gb[1]), Math.hypot(a[0] - b[0], a[1] - b[1]));
    assert.equal(ga[2], -3);
    assert.equal(gb[2], -5);
    assert.equal(JSON.stringify([s, a, b]), saved);
  }
});

test("vertical Image Mapping clips at the printable edges without fitting or losing depth", () => {
  const ps = { paths: [path([[-50, 50, 0], [150, 50, 20]], { __stop: "refill", speed: 1200 })], thermalText: [{ text: "not paths" }] };
  const before = JSON.stringify(ps);
  const out = clipPathsToStrip(ps, strip({ printableOffsetMm: 5, printableWidthMm: 60 }));
  pointsClose(out.paths[0].pts, [[5, 50, 5.5], [65, 50, 11.5]]);
  assert.equal(out.paths[0].layer, 6);
  assert.equal(out.paths[0].speed, 1200);
  assert.equal(out.paths[0].__stop, "refill");
  assert.equal(out.paths[0].closed, false);
  assert.equal(out.thermalText, undefined);
  assert.equal(JSON.stringify(ps), before);
});

test("45-degree clipping has analytically known intersections in global artwork", () => {
  const s = strip({ centerXmm: 100, centerYmm: 100, rotationDeg: 45, printableOffsetMm: 10, printableWidthMm: 60 });
  const result = clipPathsToStrip({ paths: [path([[-100, 100], [300, 100]])] }, s);
  pointsClose(result.paths[0].pts, [[10, 130], [70, 70]]);
  const global = result.paths[0].pts.map(stripTransform(s).toGlobal);
  pointsClose(global, [[100 - 30 * Math.SQRT2, 100], [100 + 30 * Math.SQRT2, 100]]);
  close(Math.hypot(global[1][0] - global[0][0], global[1][1] - global[0][1]), 60 * Math.SQRT2);
});

test("contained closed paths stay closed; cropped loops join their original seam", () => {
  const s = strip({ printableWidthMm: 80, printableOffsetMm: 0 });
  const contained = path([[10, 10], [20, 10], [20, 20], [10, 20]], { closed: true, custom: "kept" });
  const out = clipPathsToStrip({ paths: [contained] }, s);
  assert.deepEqual(out.paths, [contained]);
  const cut = clipPathsToStrip({ paths: [path([[40, 50], [120, 50], [120, 250], [40, 250]], { closed: true })] }, s);
  assert.equal(cut.paths.length, 1);
  assert.equal(cut.paths[0].closed, false);
  pointsClose(cut.paths[0].pts, [[40, 200], [40, 50], [80, 50]]);
});

test("split paths emit maintenance once, paper margins contain no ink, corner contacts add no stroke", () => {
  const s = strip();
  const out = clipPathsToStrip({ paths: [path([[-20, 20], [100, 20], [100, 40], [-20, 40]], { __stop: "wash" })] }, s);
  assert.equal(out.paths.length, 2);
  assert.equal(out.paths[0].__stop, "wash");
  assert.equal(out.paths[1].__stop, undefined);
  assert.deepEqual(clipPathsToStrip({ paths: [path([[2, 0], [2, 200]])] }, s), { paths: [] });
  assert.deepEqual(clipPathsToStrip({ paths: [path([[0, 4], [8, -4]])] }, s), { paths: [] });
  assert.deepEqual(clipPathsToStrip({ paths: [] }, s), { paths: [] });
});

test("a circle maps back to its original centre/radius across arbitrary strip rotations", () => {
  const pts = Array.from({ length: 721 }, (_, i) => [100 + Math.cos(i * Math.PI / 360) * 100, 100 + Math.sin(i * Math.PI / 360) * 100]);
  for (const rotationDeg of [0, 45, 90, 137]) {
    const s = strip({ centerXmm: 100, rotationDeg, lengthMm: 300 });
    const out = clipPathsToStrip({ paths: [path(pts, { closed: true })] }, s);
    assert.ok(out.paths.length > 0);
    for (const part of out.paths) for (const local of part.pts) {
      assert.ok(local[0] >= 4 - 1e-8 && local[0] <= 76 + 1e-8);
      assert.ok(local[1] >= -1e-8 && local[1] <= 300 + 1e-8);
      const global = stripTransform(s).toGlobal(local);
      close(Math.hypot(global[0] - 100, global[1] - 100), 100, 0.002);
    }
  }
});

test("2000 mm default strips use physical 8 mm gaps and a 2016 mm paper envelope", () => {
  const settings = { ...canvas };
  const strips = generateStripTiling(settings), before = JSON.stringify(settings);
  assert.equal(strips.length, 23);
  assert.equal(strips[0].id, "strip-001");
  assert.equal(strips.at(-1).id, "strip-023");
  assert.equal(strips[0].centerXmm, 32);
  assert.equal(strips.at(-1).printOrder, 23);
  assert.ok(strips.every(s => s.lengthMm === 2000));
  for (let i = 1; i < strips.length; i++) {
    close(strips[i].centerXmm - strips[i - 1].centerXmm, 88);
    close(stripCorners(strips[i])[0][0] - stripCorners(strips[i - 1])[1][0], 8);
    close(stripCorners(strips[i], "printable")[0][0] - stripCorners(strips[i - 1], "printable")[1][0], 16);
  }
  assert.deepEqual(surfaceSummary(strips), {
    stripCount: 23, totalLengthMm: 46000, totalLengthM: 46,
    bounds: { minXmm: -8, minYmm: 0, maxXmm: 2008, maxYmm: 2000, widthMm: 2016, heightMm: 2000 },
    strips: strips.map(s => ({ id: s.id, lengthMm: 2000, printOrder: s.printOrder })),
  });
  assert.deepEqual(generateStripTiling(settings), strips);
  assert.equal(JSON.stringify(settings), before);
});

test("horizontal and diagonal tilings project the fixed canvas without stretching", () => {
  const horizontal = generateStripTiling({ widthMm: 400, heightMm: 256, rotationDeg: 90 });
  assert.equal(horizontal.length, 3);
  assert.ok(horizontal.every(s => s.lengthMm === 400));
  assert.deepEqual(surfaceBounds(horizontal), { minXmm: 0, minYmm: 0, maxXmm: 400, maxYmm: 256, widthMm: 400, heightMm: 256 });
  const diagonal = generateStripTiling({ ...canvas, rotationDeg: 45 });
  assert.equal(diagonal.length, 33);
  close(diagonal[0].lengthMm, 2000 * Math.SQRT2);
  for (let i = 1; i < diagonal.length; i++) close(Math.hypot(diagonal[i].centerXmm - diagonal[i - 1].centerXmm, diagonal[i].centerYmm - diagonal[i - 1].centerYmm), 88);
  const centre = stripTransform(diagonal[16]);
  for (const q of [[0, 0], [2000, 0], [2000, 2000], [0, 2000]]) {
    const [, along] = centre.toLocal(q);
    assert.ok(along >= -1e-8 && along <= diagonal[16].lengthMm + 1e-8);
  }
});

test("explicit counts and lengths are honoured without changing the fixed canvas", () => {
  const inputs = { ...canvas, gapMm: 12, count: 4, lengthMm: 5000, idPrefix: "manual-start" };
  const before = JSON.stringify(inputs), strips = generateStripTiling(inputs);
  assert.equal(strips.length, 4);
  assert.equal(strips[0].id, "manual-start-001");
  assert.equal(surfaceSummary(strips).totalLengthM, 20);
  close(surfaceBounds(strips).heightMm, 5000);
  close(surfaceBounds(strips).widthMm, 356);
  assert.equal(JSON.stringify(inputs), before);
  strips[0].rotationDeg = 137;
  strips[0].lengthMm = 3100;
  strips[0].centerXmm -= 50;
  assert.deepEqual(JSON.parse(JSON.stringify(strips)), strips, "Manual edits remain ordinary serializable objects");
});

test("exact-fit cardinal layouts do not acquire an extra strip and small canvases use one", () => {
  for (const rotationDeg of [0, 90, 180, 270, 360]) {
    assert.equal(generateStripTiling({ widthMm: 256, heightMm: 256, rotationDeg }).length, 3);
  }
  assert.equal(generateStripTiling({ widthMm: 160, heightMm: 200, gapMm: 0 }).length, 2);
  assert.equal(generateStripTiling({ widthMm: 12, heightMm: 10 }).length, 1);
});

test("overlapping strips each retain the artwork, independently of Z-order", () => {
  const ps = { paths: [path([[0, 100], [200, 100]])] };
  const a = strip(), b = strip({ id: "two", centerXmm: 60, zIndex: 10 });
  const pa = clipPathsToStrip(ps, a).paths[0].pts.map(stripTransform(a).toGlobal);
  const pb = clipPathsToStrip(ps, b).paths[0].pts.map(stripTransform(b).toGlobal);
  pointsClose(pa, [[4, 100], [76, 100]]);
  pointsClose(pb, [[24, 100], [96, 100]]);
  assert.equal(hitTestStrip([a, b], [50, 100]), "two");
  assert.equal(hitTestStrip([a, { ...b, zIndex: -1 }], [50, 100]), "one");
});

test("hit-testing includes blank paper margins, respects rotated paper and hides invisible strips", () => {
  const a = strip(), b = strip({ id: "two" });
  assert.equal(hitTestStrip([a], [2, 50]), "one");
  assert.equal(hitTestStrip([a], [-1, 50]), null);
  assert.equal(hitTestStrip([a, b], [40, 50]), "two");
  assert.equal(hitTestStrip([a, { ...b, visible: false }], [40, 50]), "one");
  assert.equal(hitTestStrip([strip({ rotationDeg: 90 })], [130, 70]), "one");
  assert.equal(hitTestStrip([strip({ rotationDeg: 45 })], [0, 0]), null);
});

test("print order is separate from stacking; hidden paper is optional in all summaries", () => {
  const a = strip({ id: "a", zIndex: 99, printOrder: 3 });
  const b = strip({ id: "b", centerXmm: 10000, visible: false, printOrder: 1 });
  const c = strip({ id: "c", printOrder: 2, lengthMm: 3000 });
  const inputs = [a, b, c], saved = JSON.stringify(inputs);
  assert.deepEqual(stripsInPrintOrder(inputs).map(s => s.id), ["c", "a"]);
  assert.deepEqual(stripsInPrintOrder(inputs, { includeHidden: true }).map(s => s.id), ["b", "c", "a"]);
  assert.equal(surfaceSummary(inputs).totalLengthM, 3.2);
  assert.equal(surfaceSummary(inputs, { includeHidden: true }).totalLengthM, 3.4);
  assert.equal(surfaceBounds(inputs).maxXmm, 80);
  assert.equal(surfaceBounds(inputs, { includeHidden: true }).maxXmm, 10040);
  assert.equal(JSON.stringify(inputs), saved);
  assert.deepEqual(surfaceSummary([]), { stripCount: 0, totalLengthMm: 0, totalLengthM: 0, bounds: null, strips: [] });
  assert.equal(surfaceBounds([b]), null);
});

test("invalid physical settings, coordinates, ordering and IDs fail explicitly", () => {
  for (const extra of [
    { id: "" }, { centerXmm: NaN }, { centerYmm: Infinity }, { rotationDeg: "45" },
    { physicalWidthMm: 0 }, { physicalWidthMm: -1 }, { printableWidthMm: 81 },
    { printableOffsetMm: -1 }, { printableOffsetMm: 9 }, { printableWidthMm: 0 },
    { lengthMm: 0 }, { lengthMm: -1 }, { lengthMm: Infinity }, { visible: 1 },
    { printOrder: 0 }, { printOrder: 1.5 }, { zIndex: Infinity }, { contentMode: "unknown" },
  ]) assert.throws(() => strip(extra), JSON.stringify(extra));
  assert.throws(() => stripTransform(strip()).toLocal([NaN, 0]));
  assert.throws(() => stripTransform(strip()).toGlobal([0, 0, Infinity]));
  assert.throws(() => clipPathsToStrip({ paths: [path([[NaN, 0]])] }, strip()));
  assert.throws(() => clipPathsToStrip({ paths: [{ pts: null }] }, strip()));
  assert.throws(() => clipPathsToStrip({}, strip()));
  assert.throws(() => surfaceSummary([strip(), strip()]), /Duplicate strip ID/);
  assert.throws(() => surfaceBounds([strip(), strip({ visible: false })]), /Duplicate strip ID/);
});

test("invalid layouts and allocation overflow fail without imposing an A4/A3 length limit", () => {
  for (const extra of [
    { widthMm: 0 }, { heightMm: Infinity }, { gapMm: -1 }, { gapMm: NaN },
    { count: 0 }, { count: 2.5 }, { count: MAX_GENERATED_STRIPS + 1 },
    { physicalWidthMm: Number.MIN_VALUE, printableWidthMm: Number.MIN_VALUE, gapMm: 0 },
    { widthMm: Number.MAX_VALUE, heightMm: Number.MAX_VALUE, rotationDeg: 45 },
    { idPrefix: "" },
  ]) assert.throws(() => generateStripTiling({ ...canvas, ...extra }), JSON.stringify(extra));
  const long = generateStripTiling({ widthMm: 80, heightMm: 100000, lengthMm: 100000 });
  assert.equal(long.length, 1);
  assert.equal(long[0].lengthMm, 100000);
  assert.equal(surfaceSummary(long).totalLengthM, 100);
});
