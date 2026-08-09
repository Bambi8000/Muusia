/* tools/validate-image-merge.mjs — Image + Trace Image merge oracles
 *
 * Run from repo root AFTER tools/era/patch-image-merge.mjs:
 *   node tools/validate-image-merge.mjs
 *
 * Oracles:
 *   B1 BYTE-IDENTITY: image(mode="Contours (trace)") deep-equals
 *      traceimg(same params) across a parameter sweep on a synthetic
 *      image (gradient + disk) — the transcription proof
 *   B2 Contours ignores gamma/strength/cutoff/seed (traceimg never had them)
 *   B3 neighbour smoke: all four ORIGINAL image modes still run —
 *      no throw, deterministic, non-empty on the synthetic image
 *   B4 hidden alias: traceimg.hidden === true, image has no hidden flag,
 *      image mode options gained exactly one entry at the end
 *   B5 no image loaded: both return an empty path set
 */
import image from "../src/defs/nodes/image.js";
import traceimg from "../src/defs/nodes/traceimg.js";

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CTX = { W: 300, H: 200 };

/* synthetic grayscale: horizontal gradient + dark disk, deterministic */
const IW = 64, IH = 48;
const g = new Array(IW * IH);
for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
  let d = x / (IW - 1);
  const dd = Math.hypot(x - 40, y - 18);
  if (dd < 9) d = Math.max(d, 0.92);
  g[y * IW + x] = Math.round(d * 1000) / 1000;
}
const NODE = { data: { img: { w: IW, h: IH, g } } };

const defs = (def) => {
  const o = {};
  def.params.forEach((pd) => (o[pd.key] = pd.def));
  return o;
};

/* B1 byte-identity sweep */
{
  const sweep = [
    {},
    { levels: 1 },
    { levels: 6, cell: 1.0 },
    { invert: true },
    { low: 0.6, high: 0.3 }, /* swapped thresholds */
    { minlen: 0 },
    { minlen: 12, cell: 3 },
    { margin: 4 },
  ];
  sweep.forEach((over, i) => {
    const tp = { ...defs(traceimg), ...over };
    const ip = { ...defs(image), ...defs(traceimg), ...over, mode: "Contours (trace)" }; /* traceimg defaults win on shared keys — same effective params */
    const a = traceimg.compute([], tp, CTX, NODE);
    const b = image.compute([], ip, CTX, NODE);
    ok(deep(a, b), `B1 sweep[${i}] ${JSON.stringify(over)}: image Contours deep-equals traceimg (${a.paths.length} paths)`);
  });
  const tp = { ...defs(traceimg) };
  ok(traceimg.compute([], tp, CTX, NODE).paths.length > 0, "B1: sweep is non-trivial (default case produces contours)");
}

/* B2 dead params in Contours mode */
{
  const ip = { ...defs(image), mode: "Contours (trace)" };
  const a = image.compute([], ip, CTX, NODE);
  const b = image.compute([], { ...ip, gamma: 2.5, strength: 0.2, cutoff: 0.4, seed: 999 }, CTX, NODE);
  ok(deep(a, b), "B2: gamma/strength/cutoff/seed have no effect in Contours mode");
}

/* B3 original modes smoke */
for (const mode of ["Scanline wave", "Halftone dots", "Hatch levels", "Flow shade"]) {
  const ip = { ...defs(image), mode };
  let r1 = null, r2 = null, threw = false;
  try { r1 = image.compute([], ip, CTX, NODE); r2 = image.compute([], ip, CTX, NODE); } catch (e) { threw = true; }
  ok(!threw && r1.paths.length > 0 && deep(r1, r2), `B3: ${mode} runs, non-empty, deterministic (${r1 ? r1.paths.length : 0} paths)`);
}

/* B4 palette shape */
{
  ok(traceimg.hidden === true, "B4: traceimg is hidden");
  ok(!image.hidden, "B4: image is visible");
  const opts = image.params.find((pd) => pd.key === "mode").options;
  ok(deep(opts, ["Scanline wave", "Halftone dots", "Hatch levels", "Flow shade", "Contours (trace)"]), "B4: mode options = original four + Contours appended");
  for (const k of ["levels", "low", "high", "minlen"]) ok(image.params.some((pd) => pd.key === k), `B4: image param ${k} present`);
}

/* B5 no image */
{
  const a = image.compute([], { ...defs(image), mode: "Contours (trace)" }, CTX, { data: {} });
  const b = traceimg.compute([], defs(traceimg), CTX, { data: {} });
  ok(a.paths.length === 0 && b.paths.length === 0, "B5: no image -> empty from both");
}

console.log(`\n${fails === 0 ? "ALL ORACLES PASS" : fails + " FAILURE(S)"}`);
process.exit(fails === 0 ? 0 : 1);
