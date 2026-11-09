// First Muusia Print path: render the selected vector output as 1-bit TM-T88V data.
export const RECEIPT_WIDTH_DOTS = 512;
export const RECEIPT_MAX_HEIGHT_DOTS = 4096;

export function renderReceipt(paths, widthMm, heightMm, frame = null) {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new Error("Canvas dimensions must be positive.");
  }
  const width = RECEIPT_WIDTH_DOTS;
  const artHeight = Math.round(heightMm / widthMm * width);
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
  return { width, height, data: btoa(binary) };
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
