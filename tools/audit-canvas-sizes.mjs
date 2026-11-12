import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sizes = [[72, 100], [72, 250], [297, 210], [420, 594], [594, 420]];
const files = fs.readdirSync(path.join(ROOT, "src/defs/nodes")).filter(f => f.endsWith(".js"));
const needsExternalSource = new Set([
  "asciiart", "engrave_image", "gcode_in", "image", "image_compare", "image_rasterise",
  "image_underlay", "map_import", "meshslice", "pdfimport", "photo_trace", "portrait",
  "primitive_image", "region_hatch", "soundline", "spiral_image", "stipple",
  "svg_batch", "svgimport", "traceimg",
]);

function fixture(W, H, alternate = false) {
  return alternate ? { paths: [
    { pts: [[W * 0.1, H * 0.15], [W * 0.9, H * 0.15]], closed: false, layer: 1 },
    { pts: [[W * 0.1, H * 0.85], [W * 0.9, H * 0.85]], closed: false, layer: 1 },
  ] } : { paths: [
    { pts: Array.from({ length: 40 }, (_, i) => {
      const a = i * Math.PI * 2 / 40;
      return [W * (0.5 + 0.28 * Math.cos(a)), H * (0.5 + 0.28 * Math.sin(a))];
    }), closed: true, layer: 0 },
    { pts: [[W * 0.15, H * 0.25], [W * 0.85, H * 0.75]], closed: false, layer: 1 },
  ] };
}

function summarize(result, W, H) {
  const out = Array.isArray(result) ? result : [result];
  const ps = out.find(v => v?.paths);
  if (!ps) return { state: "other" };
  const paths = ps.paths || [];
  if (!paths.length) return { state: "empty" };
  let count = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) for (const pt of p.pts || []) {
    const [x, y] = pt;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { state: "nonfinite" };
    count++;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!count) return { state: "empty" };
  const intersects = maxX >= 0 && minX <= W && maxY >= 0 && minY <= H;
  const inPoints = paths.reduce((n, p) => n + (p.pts || []).filter(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H).length, 0);
  return { state: intersects ? (inPoints ? "visible" : "crossing") : "outside", paths: paths.length,
    points: count, inFraction: +(inPoints / count).toFixed(3), box: [minX, minY, maxX, maxY].map(v => +v.toFixed(2)),
    widthFraction: +((maxX - minX) / W).toFixed(3), heightFraction: +((maxY - minY) / H).toFixed(3) };
}

const report = [];
for (const file of files) {
  const def = (await import(pathToFileURL(path.join(ROOT, "src/defs/nodes", file)).href)).default;
  const row = { key: def.key, name: def.name, cat: def.cat, file, results: {} };
  for (const [W, H] of sizes) {
    const params = Object.fromEntries((def.params || []).map(p => [p.key, p.def]));
    const pins = typeof def.ins === "function" ? def.ins(params) : (def.ins || []);
    let pathInput = 0;
    const ins = pins.map(pin => pin?.type === "paths" && def.cat !== "gen" ? fixture(W, H, pathInput++ > 0)
      : pin?.type === "value" && def.cat !== "gen" ? 0.5 : undefined);
    try {
      row.results[`${W}x${H}`] = summarize(def.compute(ins, params,
        { W, H, frameIdx: 0, frameCount: 24, machine: { originX: 0, originY: 0, flipY: false, workW: W, workH: H } },
        { id: -1, data: {} }), W, H);
    } catch (e) {
      row.results[`${W}x${H}`] = { state: "error", error: String(e).slice(0, 200) };
    }
  }
  report.push(row);
}
const summary = {};
for (const size of sizes.map(([W, H]) => `${W}x${H}`)) {
  summary[size] = {};
  for (const row of report) {
    const state = row.results[size].state;
    summary[size][state] = (summary[size][state] || 0) + 1;
  }
}
const destination = process.argv[2];
if (destination) fs.writeFileSync(destination, JSON.stringify({ sizes, summary, report }, null, 2));
console.log(JSON.stringify(summary));
let failures = 0;
for (const row of report) {
  for (const [W, H] of sizes) {
    const result = row.results[`${W}x${H}`];
    const exactMarker = row.key === "singlemarker" && W === 72;
    const calibrationSheet = row.key === "needletest" && W === 72;
    const acceptableEmpty = result.state === "empty" && (needsExternalSource.has(row.key) || calibrationSheet
      || row.key === "cardsheet" && W === 72);
    const acceptableOutside = result.state === "outside" && exactMarker;
    const acceptableOther = result.state === "other";
    const cropped = row.cat === "gen" && result.state === "visible" && result.inFraction < 0.5;
    if (!(result.state === "visible" || acceptableEmpty || acceptableOutside || acceptableOther || result.state === "crossing") || cropped) {
      console.error(`FAIL ${row.key} ${W}x${H}: ${result.state}${cropped ? `, ${result.inFraction} points on paper` : ""}`);
      failures++;
    }
  }
}
if (failures) process.exitCode = 1;
else console.log(`OK ${report.length} node definitions across ${sizes.length} canvas sizes; exact-mm and external-input exceptions verified`);
