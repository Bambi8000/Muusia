/* Validator for origami_glitch_fold — run from repo root:
   node tools/validate-origami_glitch_fold.mjs
   Auto-switches: nodes-lab/origami_glitch_fold.plotternode.js if present,
   otherwise the baked src/defs/nodes/origami_glitch_fold.js.
   Uses the REAL src/defs/helpers.js (no stubs). */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/origami_glitch_fold.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/origami_glitch_fold.js")).default;
  mode = "baked";
}
console.log("mode:", mode);

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  angle: 0, useCenter: true, px: 150, py: 100, offset: 0,
  distortion: 0, keep: false, ...over
});
const paths = (...ps) => ({ paths: ps.map((pts) => ({ pts, closed: false, layer: 0 })) });
const near = (a, b, tol) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism */
{
  const inp = paths([[10, 100], [290, 100]], [[60, 20], [60, 180]]);
  const a = JSON.stringify(def.compute([inp], P({ distortion: 0.15 }), ctx));
  const b = JSON.stringify(def.compute([inp], P({ distortion: 0.15 }), ctx));
  check("T1 determinism", a === b);
}

/* T2 mirror invariant: angle=0, center pivot -> fold at x=150; no output point right of the line */
{
  const out = def.compute([paths([[10, 100], [290, 100]])], P(), ctx);
  const maxX = Math.max(...out.paths.flatMap((q) => q.pts.map((pt) => pt[0])));
  check("T2 mirror invariant (all pts <= fold x)", maxX <= 150 + 1e-6, "maxX=" + maxX);
}

/* T3 reflection oracle: endpoint [290,100] reflects across x=150 to [10,100] */
{
  const out = def.compute([paths([[10, 100], [290, 100]])], P(), ctx);
  const pts = out.paths[0].pts;
  check("T3 reflection oracle (endpoint)", near(pts[pts.length - 1], [10, 100], 0.02),
    "got " + JSON.stringify(pts[pts.length - 1]));
}

/* T4 pivot: useCenter=false, pivot (50,50), angle=0 -> fold at x=50 */
{
  const out = def.compute([paths([[40, 50], [60, 50]])], P({ useCenter: false, px: 50, py: 50 }), ctx);
  const pts = out.paths[0].pts;
  const maxX = Math.max(...pts.map((pt) => pt[0]));
  check("T4 pivot fold position", maxX <= 50 + 1e-6 && near(pts[pts.length - 1], [40, 50], 0.02),
    "maxX=" + maxX + " last=" + JSON.stringify(pts[pts.length - 1]));
}

/* T5 legacy compat: useCenter=true + offset=20, angle=0 -> fold at x=170; [180,100] -> [160,100] */
{
  const out = def.compute([paths([[180, 100], [181, 100]])], P({ offset: 20 }), ctx);
  const pts = out.paths[0].pts;
  check("T5 legacy Axis Position", near(pts[0], [160, 100], 1e-6), "got " + JSON.stringify(pts[0]));
}

/* T6 keep doubles path count */
{
  const out = def.compute([paths([[10, 100], [290, 100]])], P({ keep: true }), ctx);
  check("T6 keep original", out.paths.length === 2, "n=" + out.paths.length);
}

/* T7 clamp: heavy warp stays on the sheet */
{
  const out = def.compute([paths([[295, 5], [295, 195]])], P({ angle: 30, distortion: 0.5, offset: -80 }), ctx);
  const bad = out.paths.flatMap((q) => q.pts).filter(
    ([x, y]) => x < 0.5 - 1e-9 || x > ctx.W - 0.5 + 1e-9 || y < 0.5 - 1e-9 || y > ctx.H - 0.5 + 1e-9
  );
  check("T7 sheet clamp", bad.length === 0, "off-sheet pts=" + bad.length);
}

/* T8 overlay: never throws; fold line guide matches pivot math and lies on the sheet */
{
  let ok = true, detail = "";
  try {
    const g = def.overlay(P({ useCenter: false, px: 120, py: 80, angle: 45, offset: 10 }), ctx);
    const line = g.find((q) => q.kind === "poly");
    const pt = g.find((q) => q.kind === "point");
    const arrow = g.find((q) => q.kind === "arrow");
    const rad = Math.PI / 4, nx = Math.cos(rad), ny = Math.sin(rad);
    const cx = 120 + nx * 10, cy = 80 + ny * 10;
    if (!pt || !near([pt.x, pt.y], [cx, cy], 1e-6)) { ok = false; detail = "pivot point wrong"; }
    if (!arrow) { ok = false; detail = "no arrow"; }
    if (!line) { ok = false; detail = "no fold line"; }
    else {
      for (const q of line.pts) {
        const d = (q[0] - cx) * nx + (q[1] - cy) * ny;
        if (Math.abs(d) > 1e-6) { ok = false; detail = "line pt off axis d=" + d; }
        if (q[0] < -1e-6 || q[0] > ctx.W + 1e-6 || q[1] < -1e-6 || q[1] > ctx.H + 1e-6) {
          ok = false; detail = "line pt off sheet";
        }
      }
    }
    /* off-sheet pivot with a line that misses the sheet must not throw */
    def.overlay(P({ useCenter: false, px: 400, py: 100, angle: 0 }), ctx);
  } catch (e) {
    ok = false; detail = "threw: " + e.message;
  }
  check("T8 overlay guides", ok, detail);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);
