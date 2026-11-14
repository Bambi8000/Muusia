import { RECEIPT_MAX_HEIGHT_DOTS } from "./receipt-format.js";

export const RECEIPT_FONTS = Object.freeze({ A: { width: 12, height: 24, columns: 42 }, B: { width: 9, height: 17, columns: 56 } });

// Validate printable text rather than accepting arbitrary printer commands.
export function asciiReceipt(value) {
  const font = RECEIPT_FONTS[value?.font];
  if (!font || !Number.isInteger(value.lineSpacing) || value.lineSpacing < font.height || value.lineSpacing > 255
      || !Number.isInteger(value.left) || value.left < 0 || value.left > 511
      || !Array.isArray(value.lines) || !value.lines.length
      || value.lines.length * value.lineSpacing > RECEIPT_MAX_HEIGHT_DOTS
      || !value.lines.every(line => typeof line === "string" && /^[\x20-\x7e]*$/.test(line) && line.length * font.width + value.left <= 512)) {
    throw new Error("Invalid ASCII receipt: use printable ASCII within the receipt width and length.");
  }
  return { kind: "text", font: value.font, lineSpacing: value.lineSpacing, left: value.left, lines: [...value.lines] };
}

export function encodeAsciiReceipt(value, cut = true) {
  const receipt = asciiReceipt(value);
  // Standard mode, ANK text, normal size, USA/PC437, zero extra spacing,
  // left alignment, 512-dot print area, 180 units/inch (TM-T88V).
  const out = [27, 64, 28, 46, 27, 77, receipt.font === "B" ? 1 : 0,
    29, 33, 0, 27, 82, 0, 27, 116, 0, 27, 32, 0, 27, 97, 0,
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
