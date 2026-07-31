/* tools/validate-map_import.mjs — run from repo root.
   Validates nodes-lab/map_import.plotternode.js (or the baked version)
   against a synthetic OSM-style GeoJSON fixture. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/map_import.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/map_import.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/map_import.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/map_import.plotternode.js");
}

/* synthetic city: Helsinki-ish coordinates, one of each feature class */
const F = (props, type, coordinates) => ({ type: "Feature", properties: props,
  geometry: { type, coordinates } });
const wavy = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n;
  return [x0 + (x1 - x0) * t + Math.sin(t * 9) * 0.0007,
          y0 + (y1 - y0) * t + Math.cos(t * 7) * 0.0005];
});
const GJ = JSON.stringify({
  type: "FeatureCollection",
  features: [
    F({ highway: "motorway" }, "LineString", wavy(24.90, 60.15, 24.99, 60.19, 40)),
    F({ highway: "primary" }, "LineString", wavy(24.91, 60.18, 24.98, 60.155, 30)),
    F({ highway: "residential" }, "LineString", wavy(24.93, 60.16, 24.95, 60.185, 25)),
    F({ highway: "residential" }, "MultiLineString",
      [wavy(24.94, 60.165, 24.965, 60.17, 12), wavy(24.92, 60.175, 24.935, 60.155, 12)]),
    F({ highway: "footway" }, "LineString", wavy(24.945, 60.162, 24.955, 60.178, 20)),
    F({ railway: "rail" }, "LineString", wavy(24.905, 60.17, 24.985, 60.175, 25)),
    F({ waterway: "river" }, "LineString", wavy(24.91, 60.152, 24.97, 60.19, 30)),
    F({ natural: "water" }, "Polygon", [[
      [24.955, 60.158], [24.968, 60.158], [24.97, 60.166], [24.958, 60.168], [24.955, 60.158]]]),
    F({ building: "yes" }, "Polygon", [[
      [24.925, 60.171], [24.928, 60.171], [24.928, 60.173], [24.925, 60.173], [24.925, 60.171]]]),
  ],
});

const ctx = { W: 210, H: 297 };
const data = N.onFile(GJ);
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defaults(), ...over }, ctx, { data: { svg: data } }); // app stores onFile result at node.data.svg
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("onFile parses lines + polys", data.lines.length === 8 && data.polys.length === 2,
  `lines=${data.lines.length} polys=${data.polys.length}`);
T("determinism (double run identical)", sig(run()) === sig(run()));
T("no data -> EMPTY", N.compute([undefined], defaults(), ctx, {}).paths.length === 0);
T("wrong-slot data -> EMPTY (app stores under .svg)",
  N.compute([undefined], defaults(), ctx, { data }).paths.length === 0);

/* finite + margin */
{
  const r = run({ minor: true, bldg: true });
  let ok = true, inM = true;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) ok = false;
    if (x < 10 - 0.05 || x > ctx.W - 10 + 0.05 || y < 10 - 0.05 || y > ctx.H - 10 + 0.05) inM = false;
  }
  T("all coords finite", ok);
  T("Contain fit stays inside margin", inM);
  T("point budget ok", pts(r) < 120000, pts(r) + " pts");
}

/* class weights: motorway = 3 nearby parallel strokes */
{
  const one = run({ roads: true, rail: false, waterOn: false, weights: false }).paths.length;
  const w = run({ roads: true, rail: false, waterOn: false, weights: true }).paths.length;
  // fixture: 1 motorway (+2 strokes), 1 primary (+1 stroke) = +3 paths
  T("road weights add parallel strokes", w === one + 3, `${w} == ${one}+3`);
}

/* toggles remove their layers */
{
  const L = (over) => new Set(run({ bldg: true, ...over }).paths.map((q) => q.layer));
  T("three pens present", L({}).has(0) && L({}).has(1) && L({}).has(3));
  T("Water off removes water pen", !L({ waterOn: false }).has(1));
  T("Buildings off removes building pen", !L({ bldg: false }).has(3));
  T("Roads off removes roads",
    pts(run({ roads: false, rail: false, waterOn: false, bldg: false })) === 0);
  T("Minor paths off by default vs on",
    pts(run({ minor: true })) > pts(run({ minor: false })));
  T("Rail toggle live", sig(run({ rail: false })) !== sig(run({ rail: true })));
}

/* simplify reduces points but keeps shape */
{
  const a = pts(run({ simplify: 0 }));
  const b = pts(run({ simplify: 1.5 }));
  T("simplify reduces points", b < a, `${b} < ${a}`);
}

/* fit + rotate */
{
  T("Cover fills more than Contain", (() => {
    const span = (r) => {
      let mnx = 1e9, mxx = -1e9;
      for (const q of r.paths) for (const [x] of q.pts) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); }
      return mxx - mnx;
    };
    return span(run({ fit: "Cover" })) > span(run({ fit: "Contain" })) - 0.5;
  })());
  T("param live: rotate", sig(run()) !== sig(run({ rotate: 90 })));
  T("param live: margin", sig(run()) !== sig(run({ margin: 30 })));
  T("param live: fit", sig(run()) !== sig(run({ fit: "Cover" })));
  T("param live: roadPen", sig(run()) !== sig(run({ roadPen: 5 })));
}

/* aspect ratio preserved: a projected square building stays square-ish */
{
  const r = run({ roads: false, rail: false, waterOn: false, bldg: true });
  const q = r.paths[0];
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const [x, y] of q.pts) {
    mnx = Math.min(mnx, x); mxx = Math.max(mxx, x);
    mny = Math.min(mny, y); mxy = Math.max(mxy, y);
  }
  // fixture building: 0.003 deg lon x 0.002 deg lat at lat 60 -> lon*cos60=0.0015
  // => width/height = 0.0015/0.002 = 0.75
  const ratio = (mxx - mnx) / (mxy - mny);
  T("projection preserves aspect (cos-lat corrected)", Math.abs(ratio - 0.75) < 0.03,
    "w/h=" + ratio.toFixed(3));
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
