import { RECEIPT_WIDTH_DOTS, RECEIPT_MAX_HEIGHT_DOTS } from "./receipt-format.js";

// Concatenate complete packed rows. One raster job means no cut, reset or feed
// command can be inserted at a frame boundary by the print transport.
export function joinReceiptFrames(receipts) {
  if (!Array.isArray(receipts) || receipts.length < 1 || receipts.length > 999) throw new Error("Animation strips support 1–999 frames.");
  let height = 0;
  const frames = receipts.map((r, i) => {
    if (r.width !== RECEIPT_WIDTH_DOTS || !Number.isInteger(r.height) || r.height < 1 || typeof r.data !== "string" || r.thermalText?.length) throw new Error("Invalid animation strip frame.");
    const f = { frame: i + 1, y: height, height: r.height };
    height += r.height;
    if (height > RECEIPT_MAX_HEIGHT_DOTS) throw new Error("The animation strip exceeds 50 m. Reduce Frames or canvas height.");
    return f;
  });
  const stride = RECEIPT_WIDTH_DOTS / 8, pixels = new Uint8Array(height * stride);
  for (let i = 0; i < receipts.length; i++) {
    const binary = atob(receipts[i].data);
    if (binary.length !== frames[i].height * stride) throw new Error("Incomplete animation strip frame.");
    const offset = frames[i].y * stride;
    for (let k = 0; k < binary.length; k++) pixels[offset + k] = binary.charCodeAt(k);
  }
  let binary = "";
  for (let i = 0; i < pixels.length; i += 8192) binary += String.fromCharCode(...pixels.subarray(i, i + 8192));
  return { width: RECEIPT_WIDTH_DOTS, height, data: btoa(binary), frameLayout: "continuous", frameCount: receipts.length, frames };
}
