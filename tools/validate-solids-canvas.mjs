import assert from "node:assert/strict";
import solids from "../src/defs/nodes/solids.js";

const base = Object.fromEntries(solids.params.map(p => [p.key, p.def]));
function bounds(paths) {
  const pts = paths.flatMap(path => path.pts);
  return [Math.min(...pts.map(pt => pt[0])), Math.min(...pts.map(pt => pt[1])),
    Math.max(...pts.map(pt => pt[0])), Math.max(...pts.map(pt => pt[1]))];
}
for (const [W, H] of [[72, 100], [420, 594]]) {
  for (const shape of ["Sphere", "Cube", "Tetrahedron", "Octahedron", "Icosahedron", "Dodecahedron"]) {
    const p = { ...base, shape, size: 19, px: 150, py: 100 };
    delete p.fitCanvas; // A saved v2.175 patch has no new parameter.
    const output = solids.compute([null], p, { W, H }).paths;
    assert.ok(output.length, `${shape} produces paths on ${W}x${H}`);
    const [x0, y0, x1, y1] = bounds(output);
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= W && y1 <= H, `${shape} fits on ${W}x${H}`);
    assert.ok(Math.abs((x0 + x1) / 2 - W / 2) < 1e-6, `${shape} is horizontally centered`);
    assert.ok(Math.abs((y0 + y1) / 2 - H / 2) < 1e-6, `${shape} is vertically centered`);
    assert.deepEqual(output, solids.compute([null], p, { W, H }).paths, `${shape} is deterministic`);
  }
}
const exact = solids.compute([null], { ...base, size: 19, px: 150, py: 100, fitCanvas: false }, { W: 72, H: 100 }).paths;
assert.ok(bounds(exact)[0] > 72, "Fit canvas off preserves exact millimeter placement");
console.log("OK Solids fits receipt and A2 in six shapes; exact-mm opt-out preserved");
