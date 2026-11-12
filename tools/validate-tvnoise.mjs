import assert from "node:assert/strict";
import noise from "../src/defs/nodes/tvnoise.js";

const defaults = Object.fromEntries(noise.params.map(({ key, def }) => [key, def]));
const draw = (params, frameIdx = 0, frameCount = 24, W = 297, H = 210) =>
  noise.compute([null], { ...defaults, ...params }, { W, H, frameIdx, frameCount }).paths;
const fingerprint = paths => JSON.stringify(paths);

const frame0 = draw({ mode: "Patent TV" }, 0);
const frame1 = draw({ mode: "Patent TV" }, 1);
const cabinet = draw({ mode: "Patent TV", density: 0 }, 0);
assert.ok(cabinet.length > 30, "patent mode includes cabinet and annotations");
assert.ok(frame0.length > cabinet.length, "snow appears inside the television");
assert.equal(fingerprint(frame0), fingerprint(draw({ mode: "Patent TV" }, 0)), "scrubbing is deterministic");
assert.notEqual(fingerprint(frame0), fingerprint(frame1), "timeline advances the snow");
assert.equal(fingerprint(frame0.slice(0, cabinet.length)), fingerprint(frame1.slice(0, cabinet.length)),
  "cabinet remains stationary across frames");
assert.equal(fingerprint(draw({ mode: "Patent TV", motion: "Still" }, 0)),
  fingerprint(draw({ mode: "Patent TV", motion: "Still" }, 17)), "Still freezes the drawing");
assert.equal(fingerprint(draw({ mode: "Patent TV", motion: "Manual", manualFrame: 5 }, 0)),
  fingerprint(draw({ mode: "Patent TV", motion: "Manual", manualFrame: 5 }, 17)), "manual frame ignores timeline");

for (const [W, H] of [[297, 210], [210, 297], [80, 80], [1200, 900]]) {
  const margin = 10;
  const s = Math.min((W - 2 * margin) / 240, (H - 2 * margin) / 180);
  const x = (W - 240 * s) / 2 + 40 * s, y = (H - 180 * s) / 2 + 50 * s;
  const sw = 117 * s, sh = 77 * s;
  const paths = draw({ mode: "Patent TV", cell: 0.8, density: 1, shape: "Dash (scanline)" }, 3, 24, W, H);
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
