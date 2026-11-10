// First Muusia Print path: render the selected vector output as 1-bit TM-T88V data.
export const RECEIPT_WIDTH_DOTS = 512;
export const RECEIPT_MAX_HEIGHT_DOTS = 4096;

export const ANIMATION_RECEIPT = Object.freeze({ x: 48, y: 112, width: 416, arm: 32, stroke: 5, codeX: 184, codeY: 65, codeCell: 9, codeHeight: 18 });

const RECEIPT_GLYPHS = {
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  '/': ['00001','00001','00010','00100','01000','10000','10000'],
  0: ['01110','10001','10011','10101','11001','10001','01110'],
  1: ['00100','01100','00100','00100','00100','00100','01110'],
  2: ['01110','10001','00001','00010','00100','01000','11111'],
  3: ['11110','00001','00001','01110','00001','00001','11110'],
  4: ['00010','00110','01010','10010','11111','00010','00010'],
  5: ['11111','10000','10000','11110','00001','00001','11110'],
  6: ['01110','10000','10000','11110','10001','10001','01110'],
  7: ['11111','00001','00010','00100','01000','01000','01000'],
  8: ['01110','10001','10001','01110','10001','10001','01110'],
  9: ['01110','10001','10001','01111','00001','00001','01110'],
};

export function animationReceiptBits(frame) {
  if (!Number.isInteger(frame) || frame < 1 || frame > 999) throw new Error('Animation receipt frame number must be 1–999.');
  const data = Array.from({ length: 10 }, (_, i) => (frame >> (9 - i)) & 1);
  const check = (frame ^ (frame >> 4) ^ (frame >> 8) ^ 0b1010) & 15;
  return [1, ...data, ...Array.from({ length: 4 }, (_, i) => (check >> (3 - i)) & 1), 1];
}

/** One 512-dot ESC/POS raster with large outward L marks and a readable frame ID. */
export function renderAnimationReceipt(paths, widthMm, heightMm, frame, total, thermalText = []) {
  if (!Number.isInteger(total) || total < 1 || total > 999 || frame > total) throw new Error('Animation receipts support 1–999 frames.');
  const image = renderReceipt(paths, widthMm, heightMm);
  const innerHeight = Math.max(1, Math.round(image.height * ANIMATION_RECEIPT.width / RECEIPT_WIDTH_DOTS));
  const height = ANIMATION_RECEIPT.y + innerHeight + 48;
  if (height > RECEIPT_MAX_HEIGHT_DOTS) throw new Error('This animation receipt is too long. Use a shorter canvas.');
  const sourceBinary = atob(image.data), source = Uint8Array.from(sourceBinary, c => c.charCodeAt(0));
  const pixels = new Uint8Array(RECEIPT_WIDTH_DOTS * height / 8), stride = RECEIPT_WIDTH_DOTS / 8;
  const black = (x, y) => { if (x >= 0 && x < RECEIPT_WIDTH_DOTS && y >= 0 && y < height) pixels[y * stride + (x >> 3)] |= 0x80 >> (x & 7); };
  const block = (x, y, w, h) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) black(xx, yy); };
  for (let y = 0; y < innerHeight; y++) {
    const sy = Math.min(image.height - 1, Math.floor(y * image.height / innerHeight));
    for (let x = 0; x < ANIMATION_RECEIPT.width; x++) {
      const sx = Math.min(RECEIPT_WIDTH_DOTS - 1, Math.floor(x * RECEIPT_WIDTH_DOTS / ANIMATION_RECEIPT.width));
      if (source[sy * stride + (sx >> 3)] & (0x80 >> (sx & 7))) black(ANIMATION_RECEIPT.x + x, ANIMATION_RECEIPT.y + y);
    }
  }
  const { x: left, y: top, width, arm, stroke } = ANIMATION_RECEIPT;
  const right = left + width, bottom = top + innerHeight;
  const mark = (x, y, dx, dy) => {
    block(dx < 0 ? x - arm : x, y - Math.floor(stroke / 2), arm + 1, stroke);
    block(x - Math.floor(stroke / 2), dy < 0 ? y - arm : y, stroke, arm + 1);
  };
  mark(left, top, -1, -1); mark(right, top, 1, -1);
  mark(right, bottom, 1, 1); mark(left, bottom, -1, 1);
  const label = `F${String(frame).padStart(3, '0')}/${String(total).padStart(3, '0')}`;
  const scale = 4, advance = 24, labelX = Math.round((RECEIPT_WIDTH_DOTS - label.length * advance) / 2);
  for (let i = 0; i < label.length; i++) for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
    if (RECEIPT_GLYPHS[label[i]]?.[row]?.[col] === '1') block(labelX + i * advance + col * scale, 14 + row * scale, scale, scale);
  }
  const bits = animationReceiptBits(frame);
  for (let i = 0; i < bits.length; i++) if (bits[i]) block(ANIMATION_RECEIPT.codeX + i * ANIMATION_RECEIPT.codeCell, ANIMATION_RECEIPT.codeY, ANIMATION_RECEIPT.codeCell, ANIMATION_RECEIPT.codeHeight);
  let binary = '';
  for (let i = 0; i < pixels.length; i += 8192) binary += String.fromCharCode(...pixels.subarray(i, i + 8192));
  return { width: RECEIPT_WIDTH_DOTS, height, data: btoa(binary), ...(thermalText.length ? { thermalText } : {}) };
}


export function renderReceipt(paths, widthMm, heightMm, frame = null, thermalText = []) {
  if (frame !== null) return renderAnimationReceipt(paths, widthMm, heightMm, frame.number, frame.count, Array.isArray(thermalText) ? thermalText : []);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new Error("Canvas dimensions must be positive.");
  }
  const width = RECEIPT_WIDTH_DOTS;
  const nativeText = Array.isArray(thermalText) ? thermalText : [];
  // A text-only Thermal Text node needs one blank raster row, not a full blank canvas.
  const artHeight = !paths.length && nativeText.length ? 1 : Math.round(heightMm / widthMm * width);
  const numbered = frame !== null;
  if (numbered && (!Number.isInteger(frame.number) || !Number.isInteger(frame.count) || frame.number < 1 || frame.number > frame.count || frame.count > 999)) {
    throw new Error("Receipt frame number is invalid.");
  }
  const top = numbered ? 20 : 0;
  const height = artHeight + (numbered ? 30 : 0);
  if (artHeight < 1 || height > RECEIPT_MAX_HEIGHT_DOTS) {
    throw new Error("Receipt is too long. Use a shorter canvas or test crop (maximum about 58 cm).");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas rendering is unavailable.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(0, top);
  ctx.scale(width / widthMm, artHeight / heightMm);
  ctx.strokeStyle = "black";
  // Keep wide source canvases legible after they are reduced to receipt width.
  ctx.lineWidth = Math.max(0.3, widthMm / width * 1.25);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const path of paths) {
    if (!path.pts || path.pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(path.pts[0][0], path.pts[0][1]);
    for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i][0], path.pts[i][1]);
    if (path.closed) ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  if (numbered) {
    ctx.fillStyle = "black";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`F${String(frame.number).padStart(String(frame.count).length, "0")}/${frame.count}`, width / 2, 11);
    for (const y of [top - 1, top + artHeight]) {
      ctx.fillRect(0, y, 12, 1);
      ctx.fillRect(width - 12, y, 12, 1);
    }
    ctx.fillRect(1, top - 6, 1, 5);
    ctx.fillRect(width - 2, top - 6, 1, 5);
    ctx.fillRect(1, top + artHeight + 1, 1, 5);
    ctx.fillRect(width - 2, top + artHeight + 1, 1, 5);
  }
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const bytes = new Uint8Array(width * height / 8);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Antialiased edge pixels are converted to a single thermal dot.
      if (rgba[i] < 160) bytes[y * width / 8 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return { width, height, data: btoa(binary), ...(nativeText.length ? { thermalText: nativeText } : {}) };
}

function localPrintBase(serverUrl) {
  const base = serverUrl.trim().replace(/\/+$/, "");
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
    throw new Error("Use the local SSH tunnel URL, for example http://127.0.0.1:8633.");
  }
  return base;
}

async function awaitPrintJob(base, id) {
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const check = await fetch(`${base}/api/jobs/${id}`);
    const job = await check.json().catch(() => ({}));
    if (!check.ok) throw new Error(job.error || `Print status returned ${check.status}.`);
    if (job.status === "done") return job;
    if (job.status === "failed") throw new Error(job.error || "Printer failed.");
  }
  throw new Error(`Print job ${id} is still running. Check the server status.`);
}

export async function sendReceipt(serverUrl, receipt, cut = true) {
  const base = localPrintBase(serverUrl);
  const headers = { "Content-Type": "application/json" };
  const response = await fetch(`${base}/api/jobs`, {
    method: "POST", headers, body: JSON.stringify({ ...receipt, cut }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Print server returned ${response.status}.`);
  return awaitPrintJob(base, result.id);
}

export async function nativeFontTests(serverUrl) {
  const response = await fetch(`${localPrintBase(serverUrl)}/api/native-tests`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Print server returned ${response.status}.`);
  return result.tests;
}

export async function nativeFontTest(serverUrl, id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid font test.");
  const response = await fetch(`${localPrintBase(serverUrl)}/api/native-tests/${id}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Print server returned ${response.status}.`);
  return result;
}

export async function nativeFontBinary(serverUrl, id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid font test.");
  const response = await fetch(`${localPrintBase(serverUrl)}/api/native-tests/${id}/bin`);
  if (!response.ok) throw new Error(`Font test download failed (${response.status}).`);
  return response.blob();
}

export async function sendNativeFontTest(serverUrl, id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid font test.");
  const base = localPrintBase(serverUrl);
  const response = await fetch(`${base}/api/native-tests/${id}`, { method: "POST" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Print server returned ${response.status}.`);
  return awaitPrintJob(base, result.id);
}

export async function nativePageCatalog(serverUrl) {
  const response = await fetch(`${localPrintBase(serverUrl)}/api/native-pages`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Print server returned ${response.status}.`);
  return result;
}

export async function nativePageGlyphs(serverUrl, page) {
  if (!Number.isInteger(page) || page < 0 || page > 255) throw new Error("Invalid character page.");
  const response = await fetch(`${localPrintBase(serverUrl)}/api/native-pages/${page}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Print server returned ${response.status}.`);
  return result;
}

async function nativeCompositionRequest(serverUrl, path, settings) {
  const base = localPrintBase(serverUrl);
  const response = await fetch(`${base}/api/native-compose${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Print server returned ${response.status}.`);
  }
  return { response, base };
}

export async function previewNativeComposition(serverUrl, settings) {
  const { response } = await nativeCompositionRequest(serverUrl, "/preview", settings);
  return response.json();
}

export async function nativeCompositionBinary(serverUrl, settings) {
  const { response } = await nativeCompositionRequest(serverUrl, "/bin", settings);
  return response.blob();
}

export async function sendNativeComposition(serverUrl, settings) {
  const { response, base } = await nativeCompositionRequest(serverUrl, "", settings);
  const result = await response.json();
  return awaitPrintJob(base, result.id);
}
