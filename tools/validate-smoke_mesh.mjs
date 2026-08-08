/* Validator for smoke_mesh — run from repo root:
   node tools/validate-smoke_mesh.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/smoke_mesh.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/smoke_mesh.js")).default;
  mode = "baked";
}
console.log("mode:", mode);

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  sheets: 2, filaments: 140, detail: 160, sweep: 1, width: 0.65, twist: 1.2,
  folds: 0.55, ripple: 0.3, pens: 1, yaw: 20, pitch: 8, persp: 0.35,
  margin: 15, seed: 14, layer: 0, ...over
});
const run = (over) => def.compute([undefined], P(over), ctx);

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism + seed sensitivity */
{
  const a = JSON.stringify(run({}));
  const b = JSON.stringify(run({}));
  const c = JSON.stringify(run({ seed: 15 }));
  check("T1 determinism + seed", a === b && a !== c);
}

/* T2 structure: sheets x filaments open strokes, uniform sample count */
{
  const out = run({ sheets: 3, filaments: 40, detail: 100 }).paths;
  const nPts = out[0].pts.length;
  check("T2 filament structure",
    out.length === 120 && out.every((q) => !q.closed && q.pts.length === nPts) && nPts === 101,
    "n=" + out.length + " pts=" + nPts);
}

/* T3 margin-box fit, exact touch on the tight axis */
{
  const out = run({}).paths;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, bad = 0;
  for (const q of out) for (const [x, y] of q.pts) {
    if (x < 15 - 1e-6 || x > 285 + 1e-6 || y < 15 - 1e-6 || y > 185 + 1e-6) bad++;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const touches = Math.abs(x1 - x0 - 270) < 1e-3 || Math.abs(y1 - y0 - 170) < 1e-3;
  check("T3 margin fit + fill", bad === 0 && touches, "bad=" + bad);
}

/* T4 pens gradient: Pens 4 uses exactly pens layer..layer+3 across the sheet */
{
  const out = run({ pens: 4, layer: 2, sheets: 1 }).paths;
  const used = [...new Set(out.map((q) => q.layer))].sort((a, b) => a - b);
  const first = out[0].layer, last = out[out.length - 1].layer;
  check("T4 pen gradient across sheet",
    used.length === 4 && used.join(",") === "2,3,4,5" && first === 2 && last === 5,
    "used=" + used.join(","));
}

/* T5 budget guard: max settings shrink detail instead of overflowing */
{
  const out = run({ sheets: 4, filaments: 300, detail: 260 });
  const total = out.paths.reduce((s, q) => s + q.pts.length, 0);
  check("T5 budget", total <= 118000 && out.paths.length === 1200, "pts=" + total);
}

/* T6 param sensitivity: twist, folds, ripple, width each change the output */
{
  const a = JSON.stringify(run({}));
  check("T6 twist/folds/ripple/width live",
    a !== JSON.stringify(run({ twist: 2.5 })) &&
    a !== JSON.stringify(run({ folds: 0.1 })) &&
    a !== JSON.stringify(run({ ripple: 0.9 })) &&
    a !== JSON.stringify(run({ width: 1.2 })));
}

/* T7 view sweep never throws, output stays finite */
{
  let ok = true, detail = "";
  try {
    for (const yaw of [0, 87, 180, 271]) for (const pitch of [-60, 0, 60]) {
      const out = run({ yaw, pitch, persp: 0.95, filaments: 30, detail: 60 });
      for (const q of out.paths) for (const [x, y] of q.pts) {
        if (!isFinite(x) || !isFinite(y)) { ok = false; detail = "non-finite"; }
      }
    }
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T7 view sweep finite", ok, detail);
}

/* T8 degenerate margin -> EMPTY, tiny params never throw */
{
  let ok = true, detail = "";
  try {
    const e = def.compute([undefined], P({ margin: 60 }), { W: 130, H: 130 });
    ok = e.paths.length === 0;
    def.compute([undefined], P({ filaments: 20, detail: 60, width: 0.1, sweep: 0.2 }), ctx);
  } catch (e2) { ok = false; detail = "threw: " + e2.message; }
  check("T8 degenerate guards", ok, detail);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
