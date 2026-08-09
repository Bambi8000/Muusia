/* tools/validate-singlemarker.mjs — Single Marker DRO-mode oracles
 *
 * Run from repo root AFTER tools/era/patch-marker-dro.mjs:
 *   node tools/validate-singlemarker.mjs
 *
 * Oracles:
 *   V1 byte-identity: coord ABSENT (old patch) deep-equals coord="Canvas mm",
 *      and Canvas-mode Dot spiral ends exactly at (p.x, p.y) — old behavior
 *   V2 DRO round-trip: marker center pushed through export fx/fy minus
 *      laserOff == the entered DRO reading (both flipY variants)
 *   V3 DRO mode without ctx.machine does not throw, output finite
 *   V4 overlay guide == compute center in DRO mode (inlined copies agree)
 *   V5 determinism (double run deep-equal, all styles)
 */
import def from "../src/defs/nodes/singlemarker.js";

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const close = (a, b, t) => Math.abs(a - b) <= t;
const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CTX = { W: 300, H: 200 };
const base = () => {
  const o = {};
  def.params.forEach((pd) => (o[pd.key] = pd.def));
  return o;
};

/* V1 byte-identity for old patches */
{
  const pNew = { ...base(), x: 77.5, y: 42, style: "Dot", size: 4 };
  const pOld = { ...pNew };
  delete pOld.coord; /* an old patch has no coord key */
  const a = def.compute([], pOld, CTX);
  const b = def.compute([], pNew, CTX);
  ok(deep(a, b), "V1: coord absent deep-equals coord=Canvas mm");
  const last = a.paths[0].pts[a.paths[0].pts.length - 1];
  ok(close(last[0], 77.5, 1e-9) && close(last[1], 42, 1e-9), "V1: Canvas-mode Dot spiral ends at (x, y) — old behavior");
  for (const S of ["Circle", "Cross +", "Cross \u00d7", "Circle + cross", "Circle + dot"]) {
    const r1 = def.compute([], { ...pOld, style: S }, CTX);
    const r2 = def.compute([], { ...pNew, style: S }, CTX);
    ok(deep(r1, r2), `V1: style ${S} identical with/without coord key`);
  }
}

/* V2 DRO round-trip, V4 overlay agreement */
const canvas2dro = (x, y, M, H) => {
  const mx = x + M.originX;
  const my = (M.flipY ? H - y : y) + M.originY;
  return [mx - M.laserOffX, my - M.laserOffY];
};
for (const [name, M] of [
  ["flipY+negOff", { originX: 12, originY: 7, flipY: true, laserOffX: -3.2, laserOffY: 4.7 }],
  ["noFlip+posOff", { originX: 0, originY: 0, flipY: false, laserOffX: 5.5, laserOffY: 2.25 }],
]) {
  const target = [123.4, 87.6]; /* desired canvas position */
  const [dx, dy] = canvas2dro(target[0], target[1], M, CTX.H);
  const p = { ...base(), coord: "DRO (laser)", x: dx, y: dy, style: "Dot", size: 4 };
  const ctx = { ...CTX, machine: M };
  const r = def.compute([], p, ctx);
  const c = r.paths[0].pts[r.paths[0].pts.length - 1]; /* spiral ends at center */
  ok(close(c[0], target[0], 1e-9) && close(c[1], target[1], 1e-9), `V2 ${name}: DRO reading lands marker at target canvas position`);
  const back = canvas2dro(c[0], c[1], M, CTX.H);
  ok(close(back[0], dx, 1e-9) && close(back[1], dy, 1e-9), `V2 ${name}: round-trip back to entered DRO reading`);
  const g = def.overlay(p, ctx);
  const pt = g.find((x) => x.kind === "point");
  ok(close(pt.x, c[0], 1e-9) && close(pt.y, c[1], 1e-9), `V4 ${name}: overlay guide == compute center`);
}

/* V3 missing ctx.machine */
{
  const p = { ...base(), coord: "DRO (laser)", x: 50, y: 60 };
  let threw = false, r = null;
  try { r = def.compute([], p, CTX); } catch (e) { threw = true; }
  ok(!threw && r && isFinite(r.paths[0].pts[0][0]), "V3: DRO mode without ctx.machine — no throw, finite output");
}

/* V5 determinism */
{
  for (const S of ["Dot", "Circle", "Circle + cross"]) {
    const p = { ...base(), style: S, coord: "DRO (laser)", x: 100, y: 100 };
    const ctx = { ...CTX, machine: { originX: 5, originY: 5, flipY: true, laserOffX: 1, laserOffY: -1 } };
    ok(deep(def.compute([], p, ctx), def.compute([], p, ctx)), `V5: determinism (${S}, DRO)`);
  }
}

console.log(`\n${fails === 0 ? "ALL ORACLES PASS" : fails + " FAILURE(S)"}`);
process.exit(fails === 0 ? 0 : 1);
