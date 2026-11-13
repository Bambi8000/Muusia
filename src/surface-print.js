import { thermalTrimLayout, addThermalTrimMarks } from "./surface-trim.js";
import { endLabelPaths, labelExtraMm } from "./surface-assembly.js";
import { resolveSurfaceContent } from "./surface-content.js";
import { clipPathsToStrip } from "./surface-composer.js";
import { createStripRasterizer } from "./surface-render.js";

// Measured 12 Nov 2026: 400 dots = 56.6 mm in X and Y; columns 1..499
// physically verified with 4.6 mm side margins. No width-fitting is performed.
export const EPSON_SURFACE = Object.freeze({ width: 512, dotsPerMm: 400 / 56.6, headOffsetMm: 4.38775, firstColumn: 1, lastColumn: 499, maxHeight: 65535 });
const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const pause = () => new Promise(resolve => setTimeout(resolve, 0));

export { prepareSurfaceSource as preparePrintSource } from "./surface-source.js";

export function packSurfaceRows(rgba, target, rowStart, range, { dither = true, phaseOffsetRows = 0, phaseChangeRow = Infinity, phaseAfterRows = phaseOffsetRows } = {}) {
  const d = EPSON_SURFACE.dotsPerMm, originalRow = Math.round(range.fromMm * d);
  const left = range.strip.printableOffsetMm, right = left + range.strip.printableWidthMm;
  for (let row = 0; row < rgba.height; row++) for (let x = EPSON_SURFACE.firstColumn; x <= EPSON_SURFACE.lastColumn; x++) {
    const u = EPSON_SURFACE.headOffsetMm + (x + .5) / d;
    if (u < left || u >= right) continue;
    const i = (row * 512 + x) * 4, alpha = rgba.data[i + 3] / 255;
    const gray = (rgba.data[i] * .299 + rgba.data[i + 1] * .587 + rgba.data[i + 2] * .114) * alpha + 255 * (1 - alpha);
    const threshold = dither ? (BAYER[(((rowStart + row + originalRow + (rowStart + row >= phaseChangeRow ? phaseAfterRows : phaseOffsetRows)) % 4 + 4) % 4) * 4 + x % 4] + .5) * 16 : 160;
    if (gray < threshold) target[(rowStart + row) * 64 + (x >> 3)] |= 0x80 >> (x & 7);
  }
}

export async function renderSurfaceReceipt(session, range, source, { cancelled = () => false, onProgress = () => {}, dither = true } = {}) {
  const profile = EPSON_SURFACE, strip = range.strip, d = profile.dotsPerMm;
  if (strip.physicalWidthMm < 78 || strip.physicalWidthMm > 82) throw new Error("This print profile requires nominal 80 mm paper.");
  const trim = thermalTrimLayout(range.lengthMm, session.production.trimMarks);
  const labelHeight = Math.ceil(labelExtraMm(session.assembly) * d - 1e-9);
  const height = trim.rows + labelHeight;
  if (height > profile.maxHeight) throw new Error(`Print a shorter range (maximum ${(profile.maxHeight / d / 1000).toFixed(2)} m per job).`);
  const bytes = new Uint8Array(64 * height);
  const original = session.strips.find(p => p.id === range.originalId);
  const resolved = resolveSurfaceContent(source, session, original, range.fromMm, range.toMm);
  source = resolved.source;
  const samplingStrip = resolved.strip;
  const renderStrip = { ...samplingStrip, printableOffsetMm: profile.headOffsetMm, printableWidthMm: 512 / d };
  const rasterizer = source.image ? createStripRasterizer(source.image, source.placement, resolved.frame, renderStrip, { dotsPerMmX: d }) : null;
  const label = endLabelPaths(session, original, range);
  // Dot-aligned label origin follows the rounded body, preserving art pitch.
  const labelPaths = label.paths.map(p => ({ ...p, pts: p.pts.map(([x,y]) => [x, y + trim.rows / d - range.lengthMm]) }));
  const bodyPaths = source.paths ? clipPathsToStrip(source.paths, samplingStrip).paths.map(p => ({...p, pts:p.pts.map(([x,y,...rest])=>[x,y+trim.bodyStartRow/d,...rest])})) : [];
  const groups = [{paths:bodyPaths,from:trim.bodyStartRow/d,to:trim.bodyEndRow/d},{paths:labelPaths,from:trim.rows/d,to:height/d}];
  const canvas = document.createElement("canvas");
  if (canvas) canvas.width = 512;
  for (let rowStart = 0; rowStart < height; rowStart += 256) {
    if (cancelled()) throw new Error("Print preparation stopped.");
    const rows = Math.min(256, height - rowStart);
    let rgba;
    canvas.height = rows;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Line rendering is unavailable.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, 512, rows);
    const from = Math.max(rowStart, trim.bodyStartRow), to = Math.min(rowStart + rows, trim.bodyEndRow);
    if (rasterizer && from < to) {
      const block = rasterizer.renderBlock(from-trim.bodyStartRow, to-from);
      ctx.putImageData(new ImageData(block.data, block.width, block.height), 0, from-rowStart);
    }
    ctx.scale(d, d); ctx.translate(-profile.headOffsetMm, -rowStart / d);
    ctx.beginPath(); ctx.rect(strip.printableOffsetMm, 0, strip.printableWidthMm, height / d); ctx.clip();
    ctx.strokeStyle = "black"; ctx.lineWidth = .3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const group of groups) {
      ctx.save(); ctx.beginPath(); ctx.rect(strip.printableOffsetMm,group.from,strip.printableWidthMm,group.to-group.from); ctx.clip();
      for (const path of group.paths) {
        ctx.beginPath(); path.pts.forEach(([x,y],i)=>{if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
        if(path.closed)ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }
    rgba = ctx.getImageData(0, 0, 512, rows);
    packSurfaceRows(rgba, bytes, rowStart, range, { dither, phaseOffsetRows: -trim.bodyStartRow, phaseChangeRow: trim.rows, phaseAfterRows: -trim.leadingRows-trim.trailingRows });
    onProgress((rowStart + rows) / height); await pause();
  }
  addThermalTrimMarks(bytes, trim, strip, profile);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { ...(session.assembly?.labelMode === "tear" ? { tearAtRow: trim.rows } : {}), width: 512, height, data: btoa(binary), cut: session.production.cut, name: `${range.originalId} · ${range.fromMm.toFixed(1)}–${range.toMm.toFixed(1)} mm` };
}

function baseUrl(url) {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url)) throw new Error("Use the local Print tunnel address.");
  return url.replace(/\/$/, "");
}
async function jsonResponse(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(value.error || `Print service returned ${response.status}.`), { status: response.status });
  return value;
}
export async function checkSurfacePrinter(url) {
  const base = baseUrl(url), response = await fetch(`${base}/api/strip-capabilities`);
  if (response.status === 404) throw new Error("Update the Print service for long single-strip jobs.");
  const caps = await jsonResponse(response);
  if (caps.width !== 512 || !caps.singleStripJob) throw new Error("Print service does not support this strip format.");
  const health = await jsonResponse(await fetch(`${base}/health`));
  if (!health.ready) throw new Error("The printer is offline.");
  const jobs = await jsonResponse(await fetch(`${base}/api/jobs`));
  if (jobs.jobs.some(job => ["queued", "printing"].includes(job.status))) throw new Error("Printer is busy. Wait for the current job.");
  const clock = await jsonResponse(await fetch(`${base}/api/clock`));
  if (clock.running) throw new Error("Stop Clock before printing a strip.");
  return { ...health, capabilities: caps };
}
export async function submitSurfaceReceipt(url, receipt) {
  return jsonResponse(await fetch(`${baseUrl(url)}/api/strip-jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receipt) }));
}
export async function surfacePrintStatus(url, id) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid print job ID.");
  return jsonResponse(await fetch(`${baseUrl(url)}/api/jobs/${id}`));
}
