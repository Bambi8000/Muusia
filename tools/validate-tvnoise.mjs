import assert from "node:assert/strict";
import noise from "../src/defs/nodes/tvnoise.js";

const defaults = Object.fromEntries(noise.params.map(({ key, def }) => [key, def]));
const draw = (params, frameIdx = 0, frameCount = 24, W = 297, H = 210, program = null) =>
  noise.compute([null, program], { ...defaults, ...params }, { W, H, frameIdx, frameCount }).paths;
const fingerprint = paths => JSON.stringify(paths);

const tv = { mode: "Patent TV", blackoutChance: 0 };
const frame0 = draw(tv, 0);
const frame1 = draw(tv, 1);
const cabinet = draw({ ...tv, density: 0 }, 0);
assert.ok(cabinet.length > 30, "patent mode includes cabinet and annotations");
assert.ok(frame0.length > cabinet.length, "snow appears inside the television");
assert.equal(fingerprint(frame0), fingerprint(draw(tv, 0)), "scrubbing is deterministic");
assert.notEqual(fingerprint(frame0), fingerprint(frame1), "timeline advances the snow");
assert.equal(fingerprint(frame0.slice(0, cabinet.length)), fingerprint(frame1.slice(0, cabinet.length)),
  "cabinet remains stationary across frames");
assert.equal(fingerprint(draw({ ...tv, motion: "Still" }, 0)),
  fingerprint(draw({ ...tv, motion: "Still" }, 17)), "Still freezes the drawing");
assert.equal(fingerprint(draw({ ...tv, motion: "Manual", manualFrame: 5 }, 0)),
  fingerprint(draw({ ...tv, motion: "Manual", manualFrame: 5 }, 17)), "manual frame ignores timeline");

const s0 = Math.min((297 - 20) / 240, (210 - 20) / 180);
const ox = (297 - 240 * s0) / 2, oy = (210 - 180 * s0) / 2;
for (const [x, y] of [[45, 3], [157, 3]]) {
  assert.ok(!cabinet.some(p => p.pts.some(([px, py]) => Math.hypot(px - (ox + x * s0), py - (oy + y * s0)) < 1e-7)),
    "rabbit-ear antenna tips are absent");
}

const program = { paths: [
  { pts: [[-200, 105], [500, 105]], closed: false, layer: 4 },
  { pts: [[100, 80], [150, 80], [150, 110], [100, 110]], closed: true, layer: 5 },
] };
const broadcast = draw({ ...tv, signal: "Program" }, 0, 24, 297, 210, program);
assert.equal(broadcast.length, cabinet.length + 2, "program replaces snow and clips a crossing stroke");
assert.equal(broadcast[cabinet.length].layer, 4, "the program keeps its source pen");
assert.equal(broadcast[cabinet.length + 1].layer, 5, "other program pens survive");
assert.equal(broadcast[cabinet.length + 1].closed, true, "a contained program loop stays closed");
assert.equal(fingerprint(broadcast), fingerprint(draw(tv, 0, 24, 297, 210, program)),
  "Auto displays a wired program");
assert.equal(fingerprint(draw({ ...tv, signal: "Snow" }, 0, 24, 297, 210, program)),
  fingerprint(frame0), "Snow ignores the program");
assert.ok(draw({ ...tv, signal: "Program + snow" }, 0, 24, 297, 210, program).length > broadcast.length,
  "Program + snow overlays the two signals");
const screen = { x: ox + 40 * s0, y: oy + 50 * s0, w: 117 * s0, h: 77 * s0, r: 7 * s0 };
for (const p of broadcast.slice(cabinet.length)) for (const [x, y] of p.pts) {
  const cx = Math.max(screen.x + screen.r, Math.min(screen.x + screen.w - screen.r, x));
  const cy = Math.max(screen.y + screen.r, Math.min(screen.y + screen.h - screen.r, y));
  assert.ok((x - cx) ** 2 + (y - cy) ** 2 <= screen.r ** 2 + 1e-7,
    "program strokes stay inside the rounded screen");
}

const black = draw({ ...tv, blackoutChance: 100 }, 2);
assert.ok(black.length > cabinet.length + 100, "black frames use dense real pen strokes");
assert.equal(fingerprint(black), fingerprint(draw({ ...tv, blackoutChance: 100, signal: "Program" }, 2, 24, 297, 210, program)),
  "blackout covers the program as well as snow");
assert.equal(fingerprint(black), fingerprint(draw({ ...tv, blackoutChance: 18 }, 2)),
  "the default chance selects a repeatable blackout frame");
assert.equal(fingerprint(frame0), fingerprint(draw({ ...tv, blackoutChance: 18 }, 0)),
  "the first frame stays visible");

for (const [W, H] of [[297, 210], [210, 297], [80, 80], [1200, 900]]) {
  const margin = 10;
  const s = Math.min((W - 2 * margin) / 240, (H - 2 * margin) / 180);
  const x = (W - 240 * s) / 2 + 40 * s, y = (H - 180 * s) / 2 + 50 * s;
  const sw = 117 * s, sh = 77 * s;
  const paths = draw({ ...tv, cell: 0.8, density: 1, shape: "Dash (scanline)" }, 3, 24, W, H);
  for (const [i, p] of paths.entries()) {
    for (const [px, py] of p.pts) {
      assert.ok(Number.isFinite(px) && Number.isFinite(py), "all coordinates are finite");
      assert.ok(px >= margin - 1e-7 && px <= W - margin + 1e-7
        && py >= margin - 1e-7 && py <= H - margin + 1e-7, "patent drawing stays within margins");
      if (i >= cabinet.length) {
        assert.ok(px >= x - 1e-7 && px <= x + sw + 1e-7
          && py >= y - 1e-7 && py <= y + sh + 1e-7, "snow stays within the screen");
      }
    }
  }
}

assert.ok(draw({ mode: "Full sheet" }).length > draw({ mode: "Patent TV" }).length,
  "full sheet retains the broad field");
console.log("OK  TV noise animation, patent cabinet, and screen bounds");
