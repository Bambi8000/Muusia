import assert from "node:assert/strict";
import { cropTestPiece, testCropRect, TEST_PAPERS, DEFAULT_TEST_MARGIN } from "../src/preview-crop.js";

const rect = { x: 100, y: 100, w: 210, h: 297 };
const path = (pts, extra = {}) => ({ pts, closed: false, layer: 6, ...extra });
const clip = (paths, r = rect) => cropTestPiece({ paths }, r).paths;
assert.deepEqual(testCropRect({}, 420, 594), { ...TEST_PAPERS[0], x: 105, y: 148.5, margin: DEFAULT_TEST_MARGIN, maxMargin: 104.5, fits: true });
assert.equal(testCropRect({ paper: "a3-landscape", x: 999, y: -20 }, 420, 594).x, 0);
assert.equal(testCropRect({}, 200, 200).fits, false);
assert.equal(testCropRect({ margin: -20 }, 420, 594).margin, 0);
assert.equal(testCropRect({ margin: 999 }, 420, 594).margin, 104.5);
for (const paper of TEST_PAPERS) {
  const selected = testCropRect({ paper: paper.id }, 594, 420);
  assert.equal(selected.w, paper.w);
  assert.equal(selected.h, paper.h);
  assert.equal(selected.fits, true);
}

// Known metric segment: a 210 mm section stays exactly 210 mm after clipping.
const original = { paths: [path([[50, 150], [450, 150]])] };
const snapshot = JSON.stringify(original);
const line = cropTestPiece(original, rect).paths[0];
assert.deepEqual(line.pts, [[0, 50], [210, 50]]);
assert.equal(Math.hypot(line.pts[1][0] - line.pts[0][0], line.pts[1][1] - line.pts[0][1]), 210);
assert.equal(JSON.stringify(original), snapshot, "The full artwork is never mutated");
assert.equal(line.layer, 6);

// Margins remove edge strokes without fitting the source or shrinking the paper.
const inset = { ...rect, margin: 10 };
const insetLine = cropTestPiece(original, inset).paths[0];
assert.deepEqual(insetLine.pts, [[10, 50], [200, 50]]);
assert.equal(insetLine.pts[1][0] - insetLine.pts[0][0], 190);
const untouched = path([[125, 150], [275, 150]]);
assert.deepEqual(clip([untouched], inset)[0].pts, [[25, 50], [175, 50]]);
assert.equal(clip([path([[100, 100], [310, 100]])], inset).length, 0, "A line in the top paper margin is omitted");
assert.equal(clip([path([[105, 150], [105, 300]])], inset).length, 0, "A line in the left paper margin is omitted");
assert.equal(JSON.stringify(original), snapshot);
for (const paper of TEST_PAPERS) {
  const r = testCropRect({ paper: paper.id, x: 20, y: 30, margin: 12.5 }, 594, 594);
  assert.equal(r.w, paper.w);
  assert.equal(r.h, paper.h);
  const cuts = clip([path([[-100, r.y + 50], [1000, r.y + 50]]), path([[r.x + 50, -100], [r.x + 50, 1000]])], r);
  assert.equal(cuts.length, 2);
  assert.ok(Math.abs(cuts[0].pts[1][0] - cuts[0].pts[0][0] - (paper.w - 25)) < 1e-8);
  assert.ok(Math.abs(cuts[1].pts[1][1] - cuts[1].pts[0][1] - (paper.h - 25)) < 1e-8);
  for (const cut of cuts) for (const [x, y] of cut.pts) {
    assert.ok(x >= r.margin - 1e-8 && x <= r.w - r.margin + 1e-8);
    assert.ok(y >= r.margin - 1e-8 && y <= r.h - r.margin + 1e-8);
  }
}

// Both source vertices outside: exact intersections, without resampling.
assert.deepEqual(clip([path([[0, 0], [500, 500]])], { x: 100, y: 100, w: 100, h: 100 })[0].pts, [[0, 0], [100, 100]]);
const loop = path([[120, 120], [170, 120], [170, 170], [120, 170]], { closed: true });
assert.equal(clip([loop])[0].closed, true);
assert.equal(clip([loop])[0].pts.length, 4);
assert.deepEqual(clip([loop])[0].pts[0], [20, 20]);

// A cut loop's visible corner is a single stroke across its original seam.
const corner = clip([path([[150, 150], [250, 150], [250, 250], [150, 250]], { closed: true })], { x: 100, y: 100, w: 100, h: 100 });
assert.equal(corner.length, 1);
assert.equal(corner[0].closed, false);
assert.deepEqual(corner[0].pts, [[50, 100], [50, 50], [100, 50]]);

const split = clip([path([[50, 130], [350, 130], [350, 170], [50, 170]], { __stop: "refill" })]);
assert.equal(split.length, 2);
assert.equal(split[0].__stop, "refill");
assert.equal(split[1].__stop, undefined);
assert.equal(clip([path([[0, 0], [30, 30]])]).length, 0);
assert.equal(clip([path([[0, 200], [200, 0]])]).length, 0, "Point-only corner contact does not invent an ink stroke");

const depth = clip([path([[-100, 50, 1.2], [200, 50, 2.4]])], { x: 0, y: 0, w: 100, h: 100 })[0];
assert.ok(Math.abs(depth.pts[0][2] - 1.6) < 1e-10);
assert.ok(Math.abs(depth.pts[1][2] - 2.0) < 1e-10);
const border = clip([path([[100, 100], [310, 100]], { layer: 10 })])[0];
assert.deepEqual(border.pts, [[0, 0], [210, 0]]);
assert.equal(border.layer, 10);
assert.deepEqual(cropTestPiece({ paths: [] }, rect), { paths: [] });
assert.throws(() => cropTestPiece(original, { ...rect, w: 0 }));
assert.throws(() => cropTestPiece(original, { ...rect, margin: -1 }));
assert.throws(() => cropTestPiece(original, { ...rect, margin: 105 }));
assert.throws(() => cropTestPiece(original, { ...rect, margin: NaN }));
console.log("PASS: paper sizes, blank margins, 1:1 lengths, exact intersections, loop seams, pens, depth, maintenance markers and immutable source.");
