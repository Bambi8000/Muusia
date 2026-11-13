import { assemblySettings, extendedPaper, endLabelPaths, labelExtraMm } from "./surface-assembly.js";
import { resolveSurfaceContent } from "./surface-content.js";
import { Zlib, Zip, ZipPassThrough, strToU8 } from "fflate";
import { clipPathsToStrip, stripCorners, stripsInPrintOrder, surfaceSummary } from "./surface-composer.js";
import { createStripRasterPlan, createStripRasterizer } from "./surface-render.js";
import { readSurfaceSession } from "./surface-session.js";
import { prepareSurfaceSource } from "./surface-source.js";

export const DEFAULT_EXPORT_DPI = (400 / 56.6) * 25.4;
export const MAX_EXPORT_PIXELS = 250000000;
export const MAX_STRIP_EXPORT_PIXELS = 100000000;
export const MAX_EXPORT_BYTES = 128 * 1024 * 1024;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const safeName = value => String(value || "surface").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "surface";

/** Export whole visible strips with optional end labels, independently of the physical print cursor. */
export function surfaceExportPlan(input, { selectedOnly = false, dpi = DEFAULT_EXPORT_DPI, area = "paper", projectName = "surface" } = {}) {
  const session = readSurfaceSession(input);
  if (!Number.isFinite(dpi) || dpi < 25 || dpi > 600) throw new Error("Choose a resolution between 25 and 600 dpi.");
  const ordered = stripsInPrintOrder(session.strips);
  const chosen = selectedOnly ? ordered.filter(s => s.id === session.selectedId) : ordered;
  if (!chosen.length) throw new Error(selectedOnly ? "Select a visible strip to export." : "Show at least one strip to export.");
  const prefix = safeName(projectName);
  let pixels = 0;
  const entries = chosen.map(strip => {
    const plan = createStripRasterPlan(extendedPaper(strip, session.assembly), { dotsPerMmX: dpi / 25.4, area });
    if (plan.width * plan.height > MAX_STRIP_EXPORT_PIXELS || plan.height > 0x7fffffff) throw new Error("This strip exceeds the export budget. Choose a lower resolution.");
    pixels += plan.width * plan.height;
    if (pixels > MAX_EXPORT_PIXELS) throw new Error("This export exceeds the pixel budget. Choose a lower resolution or export strips individually.");
    return { plan, filename: `${prefix}-${session.composition?.family === "Sheets" ? "sheet" : "strip"}-${String(ordered.indexOf(strip) + 1).padStart(4, "0")}-${safeName(strip.id)}.png` };
  });
  const manifest = {
    format: "muusia-surface-strips", version: 1, units: "mm", layoutFamily: session.composition?.family ?? "Strips",
    surface: { widthMm: session.widthMm, heightMm: session.heightMm, origin: "top-left", x: "right", y: "down", positiveRotation: "clockwise" },
    source: { kind: session.source.kind, fit: session.source.kind === "image" ? session.source.fit : null, image: session.source.kind === "image" && session.source.image ? { name: session.source.image.name, width: session.source.image.width, height: session.source.image.height } : null },
    raster: { dpi, dotsPerMmX: dpi / 25.4, dotsPerMmY: dpi / 25.4, area, colour: "RGB", background: "white", graphLineWidthMm: .3 },
    paper: { stripCount: chosen.length, totalLengthM: surfaceSummary(chosen).totalLengthM + chosen.length * labelExtraMm(session.assembly) / 1000, allowancesIncluded: false },
    printInstructions: "Use actual size / 100%. Disable fit to page. Physical target sizes and rounded raster extents are listed separately. Files contain complete strips, with optional end labels; without mechanical feed/cut allowance or production cursor cropping.",
    strips: entries.map(({ plan, filename }) => ({
      ...session.strips.find(p => p.id === plan.strip.id), outputLengthMm: plan.strip.lengthMm, filename, number: session.strips.findIndex(s => s.id === plan.strip.id) + 1,
      bodyLengthMm: session.strips.find(p => p.id === plan.strip.id).lengthMm, endLabel: assemblySettings(session.assembly),
      paperCornersMm: stripCorners(session.strips.find(p => p.id === plan.strip.id)), printableCornersMm: stripCorners(plan.strip, "printable"),
      raster: { width: plan.width, height: plan.height, localXmm: plan.localXmm, widthMm: plan.widthMm, heightMm: plan.heightMm, rasterWidthMm: plan.rasterWidthMm, rasterHeightMm: plan.rasterHeightMm },
    })),
  };
  return { session, entries, manifest, pixels, filename: selectedOnly ? entries[0].filename : `${prefix}-surface-${session.composition?.family.toLowerCase() ?? "strips"}.zip` };
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function pngChunk(kind, data) {
  const out = new Uint8Array(data.length + 12), view = new DataView(out.buffer);
  view.setUint32(0, data.length); out.set(strToU8(kind), 4); out.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < out.length - 4; i++) crc = crcTable[(crc ^ out[i]) & 255] ^ (crc >>> 8);
  view.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
  return out;
}

/** PNG rows stream through zlib, never through a full-height browser canvas.
 *  pHYs and UTF-8 iTXt preserve density and exact geometry in a standalone PNG. */
export async function writeStripPng(renderer, metadata, { onData, cancelled = () => false, onProgress = () => {} } = {}) {
  const plan = renderer.plan;
  const check = () => { if (cancelled()) throw new Error("Export cancelled."); };
  check();
  onData(new Uint8Array([137,80,78,71,13,10,26,10]));
  const ihdr = new Uint8Array(13), head = new DataView(ihdr.buffer);
  head.setUint32(0, plan.width); head.setUint32(4, plan.height); ihdr[8] = 8; ihdr[9] = 2;
  onData(pngChunk("IHDR", ihdr));
  const phys = new Uint8Array(9), physical = new DataView(phys.buffer);
  physical.setUint32(0, Math.round(plan.dotsPerMmX * 1000)); physical.setUint32(4, Math.round(plan.dotsPerMmY * 1000)); phys[8] = 1;
  onData(pngChunk("pHYs", phys));
  onData(pngChunk("iTXt", strToU8(`Muusia\0\0\0\0\0${JSON.stringify(metadata)}`)));
  const compressor = new Zlib({ level: 6 }, data => { if (data.length) onData(pngChunk("IDAT", data)); });
  const blockRows = Math.min(256, plan.maxBlockRows);
  for (let row = 0; row < plan.height; row += blockRows) {
    check();
    const count = Math.min(blockRows, plan.height - row), block = renderer.renderBlock(row, count);
    if (block.width !== plan.width || block.height !== count || block.data.length !== plan.width * count * 4) throw new Error("Invalid raster block.");
    const stride = plan.width * 3 + 1, scanlines = new Uint8Array(stride * count);
    for (let y = 0; y < count; y++) for (let x = 0; x < plan.width; x++) {
      const input = (y * plan.width + x) * 4, output = y * stride + 1 + x * 3, alpha = block.data[input + 3] / 255;
      for (let c = 0; c < 3; c++) scanlines[output + c] = Math.round(255 + (block.data[input + c] - 255) * alpha);
    }
    compressor.push(scanlines, row + count === plan.height);
    onProgress((row + count) / plan.height);
    await tick();
  }
  check(); onData(pngChunk("IEND", new Uint8Array()));
}

export function createExportRenderer(source, session, plan, pens = []) {
  const original = session.strips.find(p => p.id === plan.strip.id) ?? plan.strip;
  const label = endLabelPaths(session, original);
  const resolved = resolveSurfaceContent(source, session, original);
  source = resolved.source;
  session = resolved.frame;
  const samplingStrip = resolved.strip;
  const rasterizer = source.image ? createStripRasterizer(source.image, source.placement, session, samplingStrip, { dotsPerMmX: plan.dotsPerMmX, dotsPerMmY: plan.dotsPerMmY, area: plan.area }) : null;
  if (rasterizer && !label.lengthMm) return rasterizer;
  const paths = [...(source.paths ? clipPathsToStrip(source.paths, samplingStrip).paths : []), ...label.paths];
  const canvas = document.createElement("canvas"); canvas.width = plan.width;
  return {
    plan,
    renderBlock(rowStart, rowCount) {
      canvas.height = rowCount;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Line rendering is unavailable.");
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, plan.width, rowCount);
      if (rasterizer && rowStart < rasterizer.plan.height) {
        const block = rasterizer.renderBlock(rowStart, Math.min(rowCount, rasterizer.plan.height - rowStart));
        ctx.putImageData(new ImageData(block.data, block.width, block.height), 0, 0);
      }
      ctx.scale(plan.dotsPerMmX, plan.dotsPerMmY); ctx.translate(-plan.localXmm, -rowStart / plan.dotsPerMmY);
      ctx.beginPath(); ctx.rect(plan.strip.printableOffsetMm, 0, plan.strip.printableWidthMm, plan.strip.lengthMm); ctx.clip();
      ctx.lineWidth = .3; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const path of paths) {
        ctx.strokeStyle = pens[path.layer % pens.length]?.c || "#222";
        ctx.beginPath(); path.pts.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        if (path.closed) ctx.closePath(); ctx.stroke();
      }
      return { width: plan.width, height: rowCount, rowStart, data: ctx.getImageData(0, 0, plan.width, rowCount).data };
    },
  };
}

/** One image at a time; ZIP receives PNG chunks as they are produced. The byte
 *  guard bounds retained output, and failures never download a partial archive. */
export async function exportSurfacePngs(input, options = {}, { evaluateGraph, source, pens = [], cancelled = () => false, onProgress = () => {} } = {}) {
  const job = surfaceExportPlan(input, options), parts = [];
  let size = 0, zip;
  const collect = data => { size += data.length; if (size > MAX_EXPORT_BYTES) throw new Error("Export exceeds the 128 MiB file budget. Choose a lower resolution or export strips individually."); parts.push(data); };
  try {
    if (cancelled()) throw new Error("Export cancelled.");
    const content = source ?? await prepareSurfaceSource(job.session, evaluateGraph);
    if (!options.selectedOnly) zip = new Zip((error, data) => { if (error) throw error; collect(data); });
    for (let i = 0; i < job.entries.length; i++) {
      if (cancelled()) throw new Error("Export cancelled.");
      const entry = job.entries[i], renderer = createExportRenderer(content, job.session, entry.plan, pens);
      const file = zip ? new ZipPassThrough(entry.filename) : null;
      if (file) { file.mtime = new Date(2020, 0, 1); zip.add(file); }
      await writeStripPng(renderer, { ...job.manifest, paper: { stripCount: 1, totalLengthM: entry.plan.strip.lengthMm / 1000, allowancesIncluded: false }, strips: [job.manifest.strips[i]] }, {
        cancelled, onData: file ? data => file.push(data) : collect,
        onProgress: progress => onProgress({ index: i + 1, total: job.entries.length, stripId: entry.plan.strip.id, progress }),
      });
      file?.push(new Uint8Array(), true);
    }
    if (cancelled()) throw new Error("Export cancelled.");
    if (zip) {
      const file = new ZipPassThrough("manifest.json"); file.mtime = new Date(2020, 0, 1); zip.add(file);
      file.push(strToU8(JSON.stringify(job.manifest, null, 2) + "\n"), true); zip.end();
    }
    return { blob: new Blob(parts, { type: zip ? "application/zip" : "image/png" }), filename: job.filename, manifest: job.manifest };
  } catch (error) { zip?.terminate(); throw error; }
}
