import assert from "node:assert/strict";
import { test } from "node:test";
import { createSurfaceSession, readSurfaceSession, readSurfaceLayouts } from "../src/surface-session.js";
import { createStrip, stripTransform, stripsInPrintOrder, surfaceSummary, clipPathsToStrip } from "../src/surface-composer.js";
import { generateComposition } from "../src/surface-layouts.js";
import { arrangeSurface, defaultArrangement, readArrangement, updateArrangement } from "../src/surface-arrangements.js";

function fixture(count = 6) {
  const s = createSurfaceSession(); s.widthMm = 400; s.heightMm = 300;
  s.strips = Array.from({ length: count }, (_, i) => createStrip({ id: `paper-${i}`, centerXmm: 200, centerYmm: 150, physicalWidthMm: 40, printableWidthMm: 32, printableOffsetMm: 3, lengthMm: 180 + i * 5, zIndex: count - i, printOrder: i + 1 }));
  s.selectedId = s.strips[0]?.id ?? null; return s;
}
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("Fan keeps every paper's top-centre at the shared pivot, including mixed lengths", () => {
  const s = fixture(5), p = { ...defaultArrangement(s), pivotXmm: 140, pivotYmm: 260, angleDeg: 180, fanSpreadDeg: 80 };
  const before = JSON.stringify(s), out = arrangeSurface(s, p);
  assert.deepEqual(out.strips.map(s => s.rotationDeg), [140, 160, 180, 200, 220]);
  for (let i = 0; i < out.strips.length; i++) {
    const paper = out.strips[i], top = stripTransform(paper).toGlobal([paper.physicalWidthMm / 2, 0]);
    close(top[0], 140); close(top[1], 260); assert.equal(paper.lengthMm, s.strips[i].lengthMm);
    assert.equal(paper.printableOffsetMm, 3); assert.equal(paper.printableWidthMm, 32);
  }
  assert.equal(JSON.stringify(s), before); assert.equal(out.mode, "freeform");
});

test("Radial full circle has no duplicate endpoint; partial sweep and one-paper cases are defined", () => {
  const s = fixture(8), p = { ...defaultArrangement(s, "radial"), radiusMm: 30, angleDeg: 15 };
  const out = arrangeSurface(s, p); assert.equal(new Set(out.strips.map(s => s.rotationDeg)).size, 8);
  out.strips.forEach((paper, i) => {
    close(paper.rotationDeg, 15 + i * 45);
    const top = stripTransform(paper).toGlobal([20, 0]), a = paper.rotationDeg * Math.PI / 180;
    close(top[0], p.pivotXmm - Math.sin(a) * 30); close(top[1], p.pivotYmm + Math.cos(a) * 30);
  });
  const partial = arrangeSurface(fixture(3), { ...p, radialSweepDeg: 90 });
  assert.deepEqual(partial.strips.map(s => s.rotationDeg), [15, 60, 105]);
  for (const pattern of ["fan", "radial"]) assert.equal(arrangeSurface(fixture(1), { ...p, pattern }).strips[0].rotationDeg, 15);
  assert.equal(new Set(arrangeSurface(s, { ...p, pattern: "fan", fanSpreadDeg: 360 }).strips.map(s => s.rotationDeg)).size, 8);
});

test("Progressive rotation spaces centres symmetrically and increments angles in print order", () => {
  const s = fixture(3); s.strips.reverse();
  const out = arrangeSurface(s, { ...defaultArrangement(s, "progressive"), pivotXmm: 200, pivotYmm: 150, spacingMm: 50, angleDeg: 350, stepDeg: 15 });
  const ordered = stripsInPrintOrder(out.strips);
  assert.deepEqual(ordered.map(s => [s.centerXmm, s.centerYmm, s.rotationDeg]), [[150, 150, 350], [200, 150, 5], [250, 150, 20]]);
  assert.deepEqual(out.strips.map(s => s.id), s.strips.map(s => s.id));
});

test("Random is repeatable per stable ID, bounded by centre/angle/length settings, without cumulative length drift", () => {
  const s = fixture(), p = { ...defaultArrangement(s, "random"), seed: 123456, spreadWidthMm: 250, spreadHeightMm: 160, rotationRangeDeg: 80, angleDeg: 100, varyLength: true, minLengthMm: 90, maxLengthMm: 240 };
  const a = arrangeSurface(s, p), b = arrangeSurface(a, p);
  assert.deepEqual(a, b);
  for (const paper of a.strips) {
    assert.ok(paper.centerXmm >= 75 && paper.centerXmm <= 325);
    assert.ok(paper.centerYmm >= 70 && paper.centerYmm <= 230);
    assert.ok(paper.rotationDeg >= 60 && paper.rotationDeg <= 140);
    assert.ok(paper.lengthMm >= 90 && paper.lengthMm <= 240);
  }
  assert.notDeepEqual(arrangeSurface(s, { ...p, seed: p.seed + 1 }).strips, a.strips);
  const hidden = { ...s, strips: s.strips.map((paper, i) => i === 1 ? { ...paper, visible: false } : paper) };
  const c = arrangeSurface(hidden, p);
  c.strips.forEach((paper, i) => { if (i !== 1) assert.deepEqual(paper, a.strips[i]); });
  const lengthsOnly = arrangeSurface(s, { ...p, varyLength: false });
  lengthsOnly.strips.forEach((paper, i) => { assert.equal(paper.lengthMm, s.strips[i].lengthMm); close(paper.centerXmm, a.strips[i].centerXmm); close(paper.rotationDeg, a.strips[i].rotationDeg); });
});

test("hidden papers, source, physical widths, ordering and pending print record survive arranging", () => {
  const s = fixture(); s.strips[0].visible = false; s.selectedId = s.strips[0].id;
  s.production.fromMm = 80; s.production.toMm = 100; s.production.lastJob = { id: "a".repeat(32), stripId: s.strips[1].id, fromMm: 0, toMm: 100, status: "unknown" };
  const out = arrangeSurface(s);
  assert.deepEqual(out.strips[0], s.strips[0]); assert.equal(out.selectedId, s.strips[1].id);
  assert.deepEqual(out.source, s.source); assert.deepEqual(out.production.lastJob, s.production.lastJob);
  assert.equal(out.production.fromMm, 0); assert.equal(out.production.toMm, null);
  out.strips.forEach((paper, i) => { for (const key of ["id", "physicalWidthMm", "printableWidthMm", "printableOffsetMm", "printOrder", "zIndex"]) assert.equal(paper[key], s.strips[i][key]); });
  close(surfaceSummary(out.strips).totalLengthM, surfaceSummary(s.strips).totalLengthM);
});

test("arrangements persist in all three families; changing draft settings does not move papers", () => {
  const strips = fixture(), sheets = generateComposition(createSurfaceSession(), "Sheets"), roll = generateComposition(createSurfaceSession(), "Roll");
  const draft = updateArrangement(strips, { pattern: "random", seed: 11 });
  assert.deepEqual(draft.strips, strips.strips);
  for (const s of [strips, sheets, roll]) for (const pattern of ["fan", "radial", "progressive", "random"]) {
    const arranged = arrangeSurface(s, defaultArrangement(s, pattern));
    assert.deepEqual(readSurfaceSession(JSON.parse(JSON.stringify(arranged))), arranged);
  }
  const families = { version: 1, Sheets: arrangeSurface(sheets), Roll: arrangeSurface(roll, defaultArrangement(roll, "random")) };
  assert.deepEqual(readSurfaceLayouts(JSON.parse(JSON.stringify(families))), families);
});

test("all preset geometries still sample the same fixed global artwork", () => {
  for (const pattern of ["fan", "radial", "progressive", "random"]) {
    const s = fixture(), out = arrangeSurface(s, defaultArrangement(s, pattern));
    let count = 0;
    for (const paper of out.strips) {
      const transform = stripTransform(paper);
      const clipped = clipPathsToStrip({ paths: [{ pts: [[0, 150, -1], [400, 150, -2]], layer: 4 }] }, paper);
      for (const path of clipped.paths) for (const point of path.pts) { const g = transform.toGlobal(point); close(g[1], 150); assert.equal(g.length, 3); count++; }
    }
    assert.ok(count > 0, pattern);
  }
});

test("maximum paper count remains bounded and invalid settings fail without mutating the session", () => {
  const s = fixture(4096), out = arrangeSurface(s, defaultArrangement(s, "random"));
  assert.equal(out.strips.length, 4096); assert.ok(out.strips.every(p => [p.centerXmm, p.centerYmm, p.rotationDeg].every(Number.isFinite)));
  const p = defaultArrangement(s);
  for (const patch of [{ pattern: "bad" }, { seed: -1 }, { seed: 1.5 }, { seed: 4294967296 }, { fanSpreadDeg: 361 }, { spreadWidthMm: -1 }, { radiusMm: -1 }, { stepDeg: 361 }, { minLengthMm: 0 }, { minLengthMm: 500, maxLengthMm: 400 }, { pivotXmm: NaN }]) assert.throws(() => readArrangement({ ...p, ...patch }));
  assert.equal(readArrangement({ ...p, seed: 0 }).seed, 0); assert.equal(readArrangement({ ...p, seed: 0xffffffff }).seed, 0xffffffff);
  const hidden = { ...s, strips: s.strips.map(p => ({ ...p, visible: false })) };
  assert.throws(() => arrangeSurface(hidden), /Show at least/);
});
