import { RECEIPT_WIDTH_DOTS, RECEIPT_MAX_HEIGHT_DOTS, RECEIPT_RENDER_ROWS, RECEIPT_MAX_LENGTH_MM } from "./receipt-format.js";

export function renderReceiptRaster(paths, widthMm, heightMm) {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new Error("Canvas dimensions must be positive.");
  }
  const width = RECEIPT_WIDTH_DOTS;
  const height = Math.round(heightMm / widthMm * width);
  if (height < 1 || height > RECEIPT_MAX_HEIGHT_DOTS) {
    throw new Error(`Receipt is too long. Use a shorter canvas or test crop (maximum ${RECEIPT_MAX_LENGTH_MM / 1000} m of raster image).`);
  }
  const canvas = document.createElement("canvas");
  // Keep existing short-receipt pixels identical. Browsers can quantize
  // antialiased edges slightly differently when clipping a path into strips.
  const renderRows = height <= 4096 ? height : RECEIPT_RENDER_ROWS;
  canvas.width = width;
  canvas.height = renderRows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas rendering is unavailable.");
  const bytes = new Uint8Array(width * height / 8);
  const scaleY = height / heightMm;
  const drawable = paths.filter(path => path.pts?.length > 1).map(path => {
    let lo = Infinity, hi = -Infinity;
    for (const [, y] of path.pts) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    return { path, lo: lo * scaleY, hi: hi * scaleY };
  });
  for (let row = 0; row < height; row += renderRows) {
    const rows = Math.min(renderRows, height - row);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.setTransform(width / widthMm, 0, 0, scaleY, 0, -row);
    ctx.strokeStyle = "black";
    // Keep wide source canvases legible after reduction to receipt width.
    ctx.lineWidth = Math.max(0.3, widthMm / width * 1.25);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const pad = ctx.lineWidth * scaleY / 2 + 1;
    for (const { path, lo, hi } of drawable) {
      if (hi + pad < row || lo - pad > row + rows) continue;
      // Draw whole paths in a translated strip: no artificial pen caps or
      // missing antialiased pixels where consecutive raster stripes meet.
      ctx.beginPath();
      ctx.moveTo(path.pts[0][0], path.pts[0][1]);
      for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i][0], path.pts[i][1]);
      if (path.closed) ctx.closePath();
      ctx.stroke();
    }
    const rgba = ctx.getImageData(0, 0, width, rows).data;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (rgba[i] < 160) bytes[(row + y) * width / 8 + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return { width, height, data: btoa(binary) };
}
