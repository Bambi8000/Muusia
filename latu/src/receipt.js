import { strFromU8, unzipSync } from "fflate";

import { RECEIPT_WIDTH_DOTS as WIDTH, RECEIPT_MAX_HEIGHT_DOTS as MAX_HEIGHT, RECEIPT_MAX_JSON_BYTES, RECEIPT_MAX_ESCPOS_BYTES } from "../../src/receipt-format.js";

function validateReceipt(height, pixels) {
  if (!Number.isInteger(height) || height < 1 || height > MAX_HEIGHT || pixels.length !== WIDTH * height / 8) {
    throw new Error(`Receipt must be 512 dots wide and 1–${MAX_HEIGHT} rows high.`);
  }
  return { width: WIDTH, height, pixels };
}

export function parseReceiptJson(text) {
  if (text.length > RECEIPT_MAX_JSON_BYTES) throw new Error("Receipt file is too large.");
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error("Receipt JSON is not valid."); }
  if (!value || value.format !== "muusia-receipt" || value.version !== 1 || value.width !== WIDTH || typeof value.data !== "string" || (value.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data))) {
    throw new Error("This is not a Muusia receipt v1 file.");
  }
  if (!Number.isInteger(value.height) || value.height < 1 || value.height > MAX_HEIGHT) throw new Error(`Receipt must be 512 dots wide and 1–${MAX_HEIGHT} rows high.`);
  let decoded;
  try { decoded = atob(value.data); }
  catch { throw new Error("Receipt bitmap is not valid Base64."); }
  const numbered = value.frame !== undefined || value.frameCount !== undefined;
  if (numbered && (!Number.isInteger(value.frame) || !Number.isInteger(value.frameCount) || value.frame < 1 || value.frame > value.frameCount || value.frameCount > 999)) {
    throw new Error("Receipt frame number is invalid.");
  }
  const pixels = Uint8Array.from(decoded, char => char.charCodeAt(0));
  return { ...validateReceipt(value.height, pixels), cut: value.cut === true, feedDots: value.cut === true ? 112 : 0, format: "Muusia receipt JSON", frame: numbered ? value.frame : null, frameCount: numbered ? value.frameCount : null };
}

export function parseReceiptAnimationZip(buffer) {
  const archive = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (archive.length > 200_000_000) throw new Error("Receipt animation ZIP is too large.");
  let count = 0, total = 0;
  let entries;
  try {
    entries = unzipSync(archive, { filter: ({ name, originalSize }) => {
      if (!/\.muusia-receipt\.json$/i.test(name)) return false;
      count++;
      total += originalSize;
      if (count > 999 || originalSize > RECEIPT_MAX_JSON_BYTES || total > 200_000_000) throw new Error("Receipt animation ZIP is too large.");
      return true;
    } });
  } catch (error) { throw new Error(error.message || "Receipt animation ZIP is invalid."); }
  const frames = Object.entries(entries).map(([name, bytes]) => ({ name, receipt: parseReceiptJson(strFromU8(bytes)) }));
  if (!frames.length) throw new Error("ZIP has no Muusia receipt frames.");
  frames.sort((a, b) => (a.receipt.frame ?? 0) - (b.receipt.frame ?? 0));
  if (frames.length !== frames[0].receipt.frameCount || frames.some((item, index) => item.receipt.frame !== index + 1 || item.receipt.frameCount !== frames.length)) {
    throw new Error("Receipt animation frames are missing or out of sequence.");
  }
  return frames;
}

export function parseEscPos(buffer) {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (data.length > RECEIPT_MAX_ESCPOS_BYTES) throw new Error("ESC/POS file is too large.");
  const rows = [];
  let offset = 0, cut = false, feedDots = 0;
  if (data[0] === 0x1B && data[1] === 0x40) offset = 2;
  while (offset < data.length) {
    if (data[offset] === 0x1D && data[offset + 1] === 0x76 && data[offset + 2] === 0x30) {
      if (offset + 8 > data.length || data[offset + 3] !== 0) throw new Error("Unsupported ESC/POS raster command.");
      const stride = data[offset + 4] + 256 * data[offset + 5];
      const height = data[offset + 6] + 256 * data[offset + 7];
      if (stride !== WIDTH / 8 || height < 1 || height > 256 || offset + 8 + stride * height > data.length) {
        throw new Error("Invalid 512-dot ESC/POS raster block.");
      }
      rows.push(data.subarray(offset + 8, offset + 8 + stride * height));
      offset += 8 + stride * height;
    } else if (data[offset] === 0x1B && data[offset + 1] === 0x4A && offset + 2 < data.length) {
      feedDots += data[offset + 2];
      offset += 3;
    } else if (data[offset] === 0x1D && data[offset + 1] === 0x56 && data[offset + 2] === 0) {
      cut = true;
      offset += 3;
    } else {
      throw new Error(`Unsupported ESC/POS command at byte ${offset}.`);
    }
  }
  const pixels = new Uint8Array(rows.reduce((sum, row) => sum + row.length, 0));
  let position = 0;
  for (const row of rows) { pixels.set(row, position); position += row.length; }
  const height = pixels.length / (WIDTH / 8);
  return { ...validateReceipt(height, pixels), cut, feedDots, format: "ESC/POS raster" };
}

export function receiptImageData(receipt, startRow = 0, rowCount = receipt.height - startRow) {
  if (!Number.isInteger(startRow) || !Number.isInteger(rowCount) || startRow < 0 || rowCount < 1 || startRow + rowCount > receipt.height) throw new Error("Invalid receipt preview rows.");
  const rgba = new Uint8ClampedArray(receipt.width * rowCount * 4);
  for (let y = 0; y < rowCount; y++) {
    for (let x = 0; x < receipt.width; x++) {
      const black = !!(receipt.pixels[(startRow + y) * receipt.width / 8 + (x >> 3)] & (0x80 >> (x & 7)));
      const at = (y * receipt.width + x) * 4;
      rgba[at] = rgba[at + 1] = rgba[at + 2] = black ? 0 : 255;
      rgba[at + 3] = 255;
    }
  }
  return rgba;
}
