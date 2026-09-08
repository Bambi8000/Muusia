/* Generates the printable Photo Trace marker sheets:
     public/markers/muusia-markers-a4.png  (210 x 297 mm)
     public/markers/muusia-markers-a3.png  (297 x 420 mm)
   300 DPI, 8-bit grayscale, zero dependencies (node:zlib).
   Layout contract (photo_trace node depends on these numbers):
     four 15 mm square markers, centers 20 mm from the sheet corners,
     top-left marker has a 6 mm white center hole (orientation anchor).
   Run from the repo root: node tools/make-marker-sheets.mjs */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const DPI = 300, F = DPI / 25.4;

/* ---- minimal 5x7 font (only the glyphs the sheet text needs) ---- */
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0f, 0x10, 0x10, 0x10, 0x10, 0x10, 0x0f],
  E: [0x1f, 0x10, 0x1e, 0x10, 0x10, 0x10, 0x1f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "3": [0x1e, 0x01, 0x01, 0x0e, 0x01, 0x01, 0x1e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x06],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "=": [0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00, 0x00],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

/* ---- CRC32 + PNG writer (grayscale 8-bit) ---- */
const CRCT = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRCT[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
function writePNG(path, px, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    px.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  }
  /* pHYs: pixels per metre so the print dialog knows this is 300 DPI */
  const phys = Buffer.alloc(9);
  const ppm = Math.round(DPI / 0.0254);
  phys.writeUInt32BE(ppm, 0); phys.writeUInt32BE(ppm, 4); phys[8] = 1;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("pHYs", phys),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

/* ---- drawing in mm on a grayscale buffer ---- */
function makeSheet(name, Wmm, Hmm) {
  const W = Math.round(Wmm * F), Hh = Math.round(Hmm * F);
  const px = Buffer.alloc(W * Hh, 255);
  const rect = (x, y, w2, h2, v) => {
    const x0 = Math.max(0, Math.round(x * F)), y0 = Math.max(0, Math.round(y * F));
    const x1 = Math.min(W, Math.round((x + w2) * F)), y1 = Math.min(Hh, Math.round((y + h2) * F));
    for (let yy = y0; yy < y1; yy++) px.fill(v, yy * W + x0, yy * W + x1);
  };
  const M = 20, MS = 15;
  const corners = [[M, M], [Wmm - M, M], [Wmm - M, Hmm - M], [M, Hmm - M]];
  corners.forEach(([cx, cy], i) => {
    rect(cx - MS / 2, cy - MS / 2, MS, MS, 0);
    if (i === 0) rect(cx - 3, cy - 3, 6, 6, 255); /* anchor hole */
  });
  /* 100 mm scale bar with end ticks */
  const bx = Wmm / 2 - 50, by = Hmm - 8;
  rect(bx, by, 100, 1, 0);
  rect(bx, by - 2.5, 1, 6, 0);
  rect(bx + 99, by - 2.5, 1, 6, 0);
  /* text */
  const text = (str, cxMm, yMm, hMm) => {
    const s = hMm / 7;
    let wAll = str.length * 6 * s - s;
    let x = cxMm - wAll / 2;
    for (const ch of str) {
      const gl = FONT[ch] || FONT[" "];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (gl[r] & (1 << (4 - c))) rect(x + c * s, yMm + r * s, s, s, 0);
      }
      x += 6 * s;
    }
  };
  text("MUUSIA MARKER SHEET " + name + " V1 - PRINT AT 100% - BAR = 100.0 MM", Wmm / 2, by - 7, 3);
  return { px, W, Hh };
}

mkdirSync("public/markers", { recursive: true });
for (const [name, w2, h2] of [["A4", 210, 297], ["A3", 297, 420]]) {
  const { px, W, Hh } = makeSheet(name, w2, h2);
  const path = "public/markers/muusia-markers-" + name.toLowerCase() + ".png";
  writePNG(path, px, W, Hh);
  console.log("wrote " + path + " (" + W + "x" + Hh + " px, 300 DPI)");
}
console.log("DONE");
