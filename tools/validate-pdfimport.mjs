import assert from "node:assert/strict";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfVectors } from "../src/defs/pdf-import.js";
import node from "../src/defs/nodes/pdfimport.js";

function makePdf() {
  const streams = [
    "0 0 1 RG 10 10 m 190 190 l S\n20 20 50 30 re S\n",
    "0 0 0 RG 50 50 m 150 50 l S\n",
  ];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 5 0 R /Resources << >> >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 6 0 R /Resources << >> >>",
    ...streams.map(s => `<< /Length ${s.length} >>\nstream\n${s}endstream`),
  ];
  let out = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const pdf = await extractPdfVectors(pdfjs, makePdf());
assert.equal(pdf.pages.length, 2);
assert.equal(pdf.pages[0].paths.length, 2);
assert.equal(pdf.pages[1].paths.length, 1);
assert.equal(pdf.pages[0].paths[0].colorIdx, 9);
assert.ok(Math.abs(pdf.pages[0].width - 200 * 25.4 / 72) < 1e-8);
assert.ok(pdf.pages.flatMap(p => p.paths).every(p => p.pts.length >= 2 && p.pts.every(pt => pt.every(Number.isFinite))));
assert.equal(node.fileBinary, true);
assert.match(node.fileAccept, /pdf/);
assert.ok(node.params.some(p => p.type === "file"));
const params = Object.fromEntries(node.params.map(p => [p.key, p.def]));
const run = (delta = {}) => node.compute([undefined], { ...params, ...delta }, { W: 210, H: 297 }, { data: { svg: pdf } });
assert.equal(run().paths.length, 2);
assert.equal(run({ page: 2 }).paths.length, 1);
assert.equal(run({ page: 999 }).paths.length, 1);
const a = run(), b = run({ editScale: 180 }), c = run({ rotation: 45 }), d = run({ offx: 10, offy: -5 });
assert.notDeepEqual(a, b); assert.notDeepEqual(a, c); assert.notDeepEqual(a, d);
assert.deepEqual(a, run());
assert.ok([a, b, c, d].every(out => out.paths.every(p => p.pts.every(pt => pt.every(Number.isFinite)))));
assert.equal(run({ colmode: "Single pen", layer: 5 }).paths[0].layer, 5);
assert.equal(run({ colmode: "From PDF colors" }).paths[0].layer, 9);
assert.equal(node.compute([], params, { W: 210, H: 297 }, { data: {} }).paths.length, 0);
console.log("PDF import: two-page vector extraction, mm dimensions, color, page choice, positioning, finite deterministic output — OK");
