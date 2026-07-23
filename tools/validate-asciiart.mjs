import fs from "fs";
const code = fs.readFileSync("nodes-lab/asciiart.plotternode.js", "utf8");
const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
function realResample(pts, closed, step) {
  if (pts.length < 2) return pts.map((q) => q.slice());
  const P = closed ? pts.concat([pts[0]]) : pts;
  const out = [pts[0].slice()];
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    let ax = P[i - 1][0], ay = P[i - 1][1];
    const bx = P[i][0], by = P[i][1];
    let seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= step && seg > 1e-9) {
      const t = (step - acc) / seg;
      ax += (bx - ax) * t; ay += (by - ay) * t;
      out.push([ax, ay]);
      seg = Math.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += seg;
  }
  return out;
}
let CALLS = [];
const SFONT_STUB = {};
for (const ch of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") SFONT_STUB[ch] = true;
const H = {
  Pin: (t, l) => ({ type: t, label: l }), EMPTY: { paths: [] },
  PENS: Array.from({ length: 12 }, () => ({})),
  mulberry32: () => () => 0.5, hash2: () => 0.5, noise2: () => 0.5,
  resample: realResample, pathLength: () => 0, applyStyle: (ps) => ps, signedArea: () => 0,
  SFONT: SFONT_STUB,
  fontStrokes: (ch, size) => { CALLS.push(ch); return { strokes: [[[0, 0], [size * 0.5, size]]] }; },
};
const def = new Function(...Object.keys(H), '"use strict"; return (' + code.trim().replace(/^\(/, "").replace(/\)\s*;?\s*$/, "") + ");")(...Object.values(H));
const P = (o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const CTX = { W: 300, H: 200 };
const run = (ins, o, node) => { CALLS = []; return def.compute(ins, P(o), CTX, node || {}); };
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));

/* lines mode: diagonal line -> chars hug the diagonal; empty input -> empty */
{
  const line = { paths: [{ pts: [[20, 20], [280, 180]], closed: false, layer: 0 }] };
  const a = run([line, undefined], { cols: 40 });
  const b = run([line, undefined], { cols: 40 });
  if (JSON.stringify(a) !== JSON.stringify(b)) die("lines mode non-deterministic");
  if (!finiteAll(a) || !a.paths.length) die("lines mode invalid/empty");
  for (const pa of a.paths) {
    const [x, y] = pa.pts[0];
    const t = Math.abs((280 - 20) * (20 - y) - (20 - x) * (180 - 20)) / Math.hypot(260, 160);
    if (t > 18) die("char far from the diagonal (" + t.toFixed(1) + " mm)");
  }
  if (run([{ paths: [] }, undefined], {}).paths.length) die("empty input should draw nothing");
}
/* image mode: gradient -> monotonic ramp; invert, threshold, gamma, custom, sanitization */
{
  const w = 40, h = 20;
  const g = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x / (w - 1);
  const node = { data: { img: { w, h, g } } };
  const ramp = "123456789"; /* default ramp */
  const r = run([undefined, undefined], { source: "Image (file)", cols: 30, thresh: 0, gamma: 1 }, node);
  if (!finiteAll(r) || !r.paths.length) die("image mode invalid/empty");
  const items = r.paths.map((pa, i) => ({ x: pa.pts[0][0], y: pa.pts[0][1], ch: CALLS[i] }));
  const rowsMap = new Map();
  for (const it of items) {
    const k = Math.round(it.y / 5);
    if (!rowsMap.has(k)) rowsMap.set(k, []);
    rowsMap.get(k).push(it);
  }
  for (const arr of rowsMap.values()) {
    arr.sort((a2, b2) => a2.x - b2.x);
    let prev = -1;
    for (const it of arr) {
      const idx = ramp.indexOf(it.ch);
      if (idx < 0) die("char not from ramp: " + it.ch);
      if (idx < prev - 1) die("ramp not monotonic along gradient (" + prev + " -> " + idx + ")");
      prev = Math.max(prev, idx);
    }
  }
  const gA = (run([undefined, undefined], { source: "Image (file)", gamma: 0.5, thresh: 0 }, node), CALLS.join(""));
  const gB = (run([undefined, undefined], { source: "Image (file)", gamma: 2, thresh: 0 }, node), CALLS.join(""));
  if (gA === gB) die("gamma has no effect on char choice");
  const inv = run([undefined, undefined], { source: "Image (file)", cols: 30, thresh: 0, invert: true }, node);
  const invItems = inv.paths.map((pa, i) => ({ x: pa.pts[0][0], ch: CALLS[i] }));
  invItems.sort((a2, b2) => a2.x - b2.x);
  if (ramp.indexOf(invItems[0].ch) < ramp.indexOf(invItems[invItems.length - 1].ch)) die("invert has no effect");
  const t0 = run([undefined, undefined], { source: "Image (file)", cols: 30, thresh: 0 }, node).paths.length;
  const t3 = run([undefined, undefined], { source: "Image (file)", cols: 30, thresh: 0.3 }, node).paths.length;
  if (!(t3 < t0)) die("threshold has no effect");
  /* custom ramp with lowercase + unknown chars: sanitizes to uppercase, skips unknowns */
  run([undefined, undefined], { source: "Image (file)", ramp: "Custom", rampCustom: ".ab", thresh: 0 }, node);
  if (!CALLS.every((ch) => ch === "A" || ch === "B")) die("sanitization failed: " + [...new Set(CALLS)].join(""));
  /* Classic ramp with this font: only x->X survives; must still draw, not go empty */
  run([undefined, undefined], { source: "Image (file)", ramp: "Classic .:-=+*x#%@", thresh: 0 }, node);
  if (!CALLS.length || !CALLS.every((ch) => ch === "X")) die("classic ramp sanitization failed");
}
console.log("asciiart OK: lines rasterize, gradient monotonic, gamma/invert/threshold live, ramp sanitized against font");