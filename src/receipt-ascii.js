import { RECEIPT_MAX_HEIGHT_DOTS } from "./receipt-format.js";

export const RECEIPT_FONTS = Object.freeze({ A: { width: 12, height: 24, columns: 42 }, B: { width: 9, height: 17, columns: 56 } });
export const ASCII_PAGE_ROWS = 1024;
export const asciiLayers = value => value?.layers || (value ? [value] : []);
export const asciiHeight = value => Math.max(0, ...asciiLayers(value).map(layer => layer.lines.length * layer.lineSpacing));

// Validate printable text rather than accepting arbitrary printer commands.
export function asciiReceipt(value) {
  if (value?.layers !== undefined) {
    if (!Array.isArray(value.layers) || value.layers.length < 1 || value.layers.length > 32 || value.layers.some(layer => !layer || layer.layers !== undefined)) {
      throw new Error("ASCII Merge supports at most 32 flat text layers.");
    }
    const layers = value.layers.map(asciiReceipt);
    return { kind: "text", layers, height: asciiHeight({ layers }) };
  }
  const font = RECEIPT_FONTS[value?.font];
  const size = value?.size === undefined ? 1 : value.size;
  if (!font || !Number.isInteger(size) || size < 1 || size > 8
      || !Number.isInteger(value.lineSpacing) || value.lineSpacing < font.height * size || value.lineSpacing > 255
      || !Number.isInteger(value.left) || value.left < 0 || value.left > 511
      || !Array.isArray(value.lines) || !value.lines.length
      || value.lines.length * value.lineSpacing > RECEIPT_MAX_HEIGHT_DOTS
      || !value.lines.every(line => typeof line === "string" && /^[\x20-\x7e]*$/.test(line) && line.length * font.width * size + value.left <= 512)) {
    throw new Error("Invalid ASCII receipt: use printable ASCII within the receipt width and length.");
  }
  return { kind: "text", font: value.font, size, lineSpacing: value.lineSpacing, left: value.left, lines: [...value.lines] };
}

export function encodeAsciiReceipt(value, cut = true) {
  const receipt = asciiReceipt(value);
  if (receipt.layers) return encodeAsciiOverlay(receipt, cut);
  // Standard mode, ANK text, GS ! size, USA/PC437, zero extra spacing,
  // left alignment, 512-dot print area, 180 units/inch (TM-T88V).
  const out = [27, 64, 28, 46, 27, 77, receipt.font === "B" ? 1 : 0,
    29, 33, (receipt.size - 1) * 17, 27, 82, 0, 27, 116, 0, 27, 32, 0, 27, 97, 0,
    29, 76, 0, 0, 29, 87, 0, 2, 29, 80, 180, 180, 27, 51, receipt.lineSpacing];
  for (const line of receipt.lines) {
    out.push(27, 36, receipt.left & 255, receipt.left >> 8);
    for (let i = 0; i < line.length; i++) out.push(line.charCodeAt(i));
    out.push(10);
  }
  if (cut) out.push(29, 86, 65, 32);
  out.push(27, 64);
  return new Uint8Array(out);
}

// Split only where no nonblank glyph crosses the page edge. An unsupported
// combination fails before sending any bytes rather than clipping characters.
export function asciiPages(value) {
  const layers = asciiLayers(value), height = asciiHeight(value);
  const blocked = new Uint8Array(height + 1);
  for (const layer of layers) {
    const glyphHeight = RECEIPT_FONTS[layer.font].height * layer.size;
    layer.lines.forEach((line, row) => {
      if (line.trim()) blocked.fill(1, row * layer.lineSpacing + 1, row * layer.lineSpacing + glyphHeight);
    });
  }
  const pages = [];
  for (let start = 0; start < height;) {
    let end = Math.min(height, start + ASCII_PAGE_ROWS);
    while (end > start && blocked[end]) end--;
    if (end === start) throw new Error("Native ASCII overlap needs a shared row gap within 1024 dots. Increase Row gap or use a shorter canvas.");
    pages.push([start, end]); start = end;
  }
  return pages;
}

function encodeAsciiOverlay(receipt, cut) {
  // Retain the existing fixed 37-byte header; Page mode owns layered layout.
  const out = [...encodeAsciiReceipt(receipt.layers[0], false).subarray(0, 37)];
  const area = (x, y, w, h) => out.push(27, 87, x & 255, x >> 8, y & 255, y >> 8, w & 255, w >> 8, h & 255, h >> 8);
  for (const [start, end] of asciiPages(receipt)) {
    out.push(27, 76, 27, 84, 0);
    area(0, 0, 512, end - start);
    for (const layer of receipt.layers) {
      const glyphHeight = RECEIPT_FONTS[layer.font].height * layer.size;
      out.push(27, 77, layer.font === "B" ? 1 : 0, 29, 33, (layer.size - 1) * 17);
      for (let row = Math.ceil(start / layer.lineSpacing); row < layer.lines.length && row * layer.lineSpacing < end; row++) {
        const line = layer.lines[row];
        if (!line.trim()) continue;
        area(layer.left, row * layer.lineSpacing - start, 512 - layer.left, glyphHeight);
        for (let i = 0; i < line.length; i++) out.push(line.charCodeAt(i));
      }
    }
    area(0, 0, 512, end - start);
    out.push(12); // FF prints the combined page and returns to Standard mode.
  }
  if (cut) out.push(29, 86, 65, 32);
  out.push(27, 64);
  return new Uint8Array(out);
}
