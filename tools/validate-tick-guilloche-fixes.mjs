/* Regression checks for the Tick Grid / Guilloché review findings. */
import assert from "node:assert/strict";
import tick from "../src/defs/nodes/tick_grid.js";
import guilloche from "../src/defs/nodes/guilloche.js";
import bg from "../src/defs/nodes/bg_fill.js";
import { clipPolylineToRect } from "../src/defs/clip-rectangle.js";
import { mulberry32 } from "../src/defs/helpers.js";

const defaults = (def) => Object.fromEntries(def.params.map((p) => [p.key, p.def]));
const sheet = { W: 297, H: 210 };
const run = (def, params, ctx = sheet) => def.compute([undefined], { ...defaults(def), ...params }, ctx);
const geometry = (out) => out.paths.map(({ pts, closed }) => ({ pts, closed }));
let checks = 0, failures = 0;
function check(name, test) {
  checks++;
  try { test(); console.log("OK   " + name); }
  catch (e) { failures++; console.error("FAIL " + name + ": " + e.message.split("\n")[0]); }
}

check("Rectangle clipping retains crossing segments and drops wholly off-page curves", () => {
  assert.deepEqual(clipPolylineToRect([[-5, 5], [15, 5]], false, 0, 0, 10, 10), [
    { pts: [[0, 5], [10, 5]], closed: false },
  ]);
  assert.deepEqual(clipPolylineToRect([[-5, -5], [15, -5]], false, 0, 0, 10, 10), []);
  assert.deepEqual(clipPolylineToRect([[-5, -5], [15, -5], [15, 15], [-5, 15]], true, 0, 0, 10, 10), []);
});

check("Rectangle clipping preserves the seam arc without closing across an outside gap", () => {
  const pts = [[5, 5], [15, 5], [15, 8], [5, 8]];
  assert.deepEqual(clipPolylineToRect(pts, true, 0, 0, 10, 10), [
    { pts: [[10, 8], [5, 8], [5, 5], [10, 5]], closed: false },
  ]);
  assert.deepEqual(clipPolylineToRect([[2, 2], [8, 2], [5, 8]], true, 0, 0, 10, 10), [
    { pts: [[2, 2], [8, 2], [5, 8]], closed: true },
  ]);
});

check("Tick Grid accent changes only pen assignment, including bent edge ticks", () => {
  for (const params of [{}, { bend: 1, jitter: 1, length: 250, margin: 0 }]) {
    const plain = run(tick, { ...params, accent: 0 });
    for (const accent of [1, 50, 100]) {
      assert.deepEqual(geometry(run(tick, { ...params, accent })), geometry(plain));
    }
  }
});

for (const mode of ["Rosette", "Rings", "Fan", "Weave", "Spiral"]) {
  check(mode + " uses the requested accent pen without changing geometry", () => {
    const main = run(guilloche, { mode, accent: 0, layer: 0, pen2: 5 });
    const accent = run(guilloche, { mode, accent: 100, layer: 0, pen2: 5 });
    assert.ok(accent.paths.length > 0);
    assert.ok(accent.paths.every((p) => p.layer === 5));
    assert.deepEqual(geometry(accent), geometry(main));
  });
  check("BG Fill " + mode + " uses the requested accent pen", () => {
    const out = run(bg, { mode: "Guilloché", gStyle: mode, gAccent: 100, layer: 0, pen2: 5 });
    assert.ok(out.paths.length > 0);
    assert.ok(out.paths.every((p) => p.layer === 5));
  });
}

check("Clipping oversized rings never manufactures paper-border segments or closed cut arcs", () => {
  const out = run(guilloche, { mode: "Rings", radius: 800, waves: 40, copies: 96, growth: .06, jitter: 0 });
  assert.ok(out.paths.length > 0);
  let clippedArcs = 0;
  const edge = ([x, y]) => Math.abs(x) < 1e-8 || Math.abs(x - sheet.W) < 1e-8 || Math.abs(y) < 1e-8 || Math.abs(y - sheet.H) < 1e-8;
  for (const path of out.paths) {
    if (path.pts.some(edge)) { clippedArcs++; assert.equal(path.closed, false); }
    for (let i = 1; i < path.pts.length; i++) {
      const [a, b] = [path.pts[i - 1], path.pts[i]];
      const sameEdge = [0, sheet.W].some((x) => Math.abs(a[0] - x) < 1e-8 && Math.abs(b[0] - x) < 1e-8)
        || [0, sheet.H].some((y) => Math.abs(a[1] - y) < 1e-8 && Math.abs(b[1] - y) < 1e-8);
      assert.ok(!sameEdge, "ring was flattened onto a paper edge");
    }
  }
  assert.ok(clippedArcs > 0);
});

for (const [name, params] of [
  ["95% overlap", { gOver: .95 }],
  ["large growing family", { gCopies: 120, gGrowth: 1 }],
  ["overlapping growing family", { gCopies: 96, gGrowth: .06, gOver: .8 }],
]) {
  for (const ctx of [sheet, { W: 210, H: 297 }]) {
    check("BG Fill " + name + " covers every quadrant on " + ctx.W + "x" + ctx.H, () => {
      const p = { mode: "Guilloché", ...params };
      const out = run(bg, p, ctx), quadrants = new Set();
      let count = 0;
      for (const path of out.paths) for (const [x, y] of path.pts) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 10 && x <= ctx.W - 10 && y >= 10 && y <= ctx.H - 10);
        quadrants.add((x > ctx.W / 2 ? 1 : 0) + (y > ctx.H / 2 ? 2 : 0)); count++;
      }
      assert.equal(quadrants.size, 4, "missing part of the sheet");
      assert.ok(count <= 115000);
      assert.deepEqual(run(bg, p, ctx), out, "same seed must repeat exactly");
    });
  }
}

for (const mode of ["Fan", "Spiral"]) {
  check(mode + " hides inactive Growth controls", () => {
    assert.equal(guilloche.params.find((p) => p.key === "growth").showIf?.({ mode }), false);
    assert.equal(bg.params.find((p) => p.key === "gGrowth").showIf({ mode: "Guilloché", gStyle: mode }), false);
  });
  check("BG Fill " + mode + " ignores stored inactive Growth values", () => {
    assert.deepEqual(run(bg, { mode: "Guilloché", gStyle: mode, gGrowth: 1 }),
      run(bg, { mode: "Guilloché", gStyle: mode, gGrowth: 0 }));
  });
}

check("Large rotated families retain segments crossing the sheet with no interior vertices", () => {
  for (const params of [
    { seed: 80, gStyle: "Rosette", gCopies: 63, gGrowth: .932, gAmp: 1.19, gJit: 1.61, gAngle: -201, gSize: 565, gOver: .02, gWaves: 273 },
    { seed: 88, gStyle: "Weave", gCopies: 98, gGrowth: .584, gAmp: 1.09, gJit: .67, gAngle: 3, gSize: 455, gOver: .31, gWaves: 39 },
  ]) {
    assert.ok(run(bg, { mode: "Guilloché", ...params }).paths.length > 0);
  }
});

check("Long clipped background chords leave a wired void blank between vertices", () => {
  const params = { ...defaults(bg), mode: "Guilloché", gCopies: 120, gGrowth: 1 };
  const voidInput = { paths: [{ pts: [[90, 70], [200, 70], [200, 140], [90, 140]], closed: true, layer: 0 }] };
  const out = bg.compute([undefined, voidInput], params, sheet);
  assert.ok(out.paths.length > 0);
  for (const path of out.paths) {
    const pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .25));
      for (let j = 0; j <= steps; j++) {
        const x = a[0] + (b[0] - a[0]) * j / steps, y = a[1] + (b[1] - a[1]) * j / steps;
        assert.ok(!(x > 90 && x < 200 && y > 70 && y < 140), "chord crossed the void interior");
      }
    }
  }
});

check("Dense rotated background fills reach all 24 page regions", () => {
  for (const gAngle of [0, 45, 90]) {
    const out = run(bg, { mode: "Guilloché", gOver: .95, gAngle }), regions = new Set();
    for (const path of out.paths) for (const [x, y] of path.pts) {
      regions.add(Math.min(5, Math.floor((x - 10) / 277 * 6)) + "," + Math.min(3, Math.floor((y - 10) / 190 * 4)));
    }
    assert.equal(regions.size, 24, "blank region at angle " + gAngle);
  }
});

check("100 seeded background configurations stay nonempty, on-page and within budget", () => {
  const rng = mulberry32(123456), modes = ["Rosette", "Rings", "Fan", "Weave", "Spiral"];
  for (let i = 0; i < 100; i++) {
    const p = { mode: "Guilloché", seed: i, gStyle: modes[i % 5], gCopies: 1 + Math.floor(rng() * 200),
      gGrowth: rng(), gAmp: rng() * 2, gJit: rng() * 5, gAngle: -360 + rng() * 720,
      gSize: 20 + rng() * 580, gOver: rng() * .95, gWaves: 4 + Math.floor(rng() * 357), gAccent: rng() * 100 };
    const ctx = i % 2 ? { W: 210, H: 297 } : sheet, out = run(bg, p, ctx);
    assert.ok(out.paths.length > 0, "empty configuration " + i);
    assert.ok(out.paths.reduce((n, path) => n + path.pts.length, 0) <= 115000);
    for (const path of out.paths) {
      assert.ok(path.pts.length >= 2);
      assert.ok(path.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 10 && x <= ctx.W - 10 && y >= 10 && y <= ctx.H - 10));
    }
  }
});

console.log(`${checks - failures}/${checks} regression checks passed`);
process.exitCode = failures ? 1 : 0;
