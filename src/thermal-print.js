// First Muusia Print path: render the selected vector output as 1-bit TM-T88V data.
export const RECEIPT_WIDTH_DOTS = 512;
export const RECEIPT_MAX_HEIGHT_DOTS = 4096;

export function renderReceipt(paths, widthMm, heightMm) {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new Error("Canvas dimensions must be positive.");
  }
  const width = RECEIPT_WIDTH_DOTS;
  const height = Math.round(heightMm / widthMm * width);
  if (height < 1 || height > RECEIPT_MAX_HEIGHT_DOTS) {
    throw new Error("Receipt is too long. Use a shorter canvas or test crop (maximum about 58 cm).");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas rendering is unavailable.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);
  ctx.scale(width / widthMm, height / heightMm);
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

export async function sendReceipt(serverUrl, token, receipt, cut = true) {
  const base = serverUrl.trim().replace(/\/+$/, "");
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
    throw new Error("Use the local SSH tunnel URL, for example http://127.0.0.1:8631.");
  }
  if (!token) throw new Error("Enter the print server token.");
  const headers = { "Content-Type": "application/json", "X-Muusia-Token": token };
  const response = await fetch(`${base}/api/jobs`, {
    method: "POST", headers, body: JSON.stringify({ ...receipt, cut }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Print server returned ${response.status}.`);
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const check = await fetch(`${base}/api/jobs/${result.id}`, { headers: { "X-Muusia-Token": token } });
    const job = await check.json().catch(() => ({}));
    if (!check.ok) throw new Error(job.error || `Print status returned ${check.status}.`);
    if (job.status === "done") return job;
    if (job.status === "failed") throw new Error(job.error || "Printer failed.");
  }
  throw new Error(`Print job ${result.id} is still running. Check the server status.`);
}
