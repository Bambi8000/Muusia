import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import def from "../src/defs/nodes/receiptascii.js";
import { asciiReceipt, encodeAsciiReceipt, RECEIPT_FONTS } from "../src/receipt-ascii.js";
import { RECEIPT_MAX_HEIGHT_DOTS } from "../src/receipt-format.js";
import { sendReceipt } from "../src/thermal-print.js";

const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const run = (params = {}, W = 80, H = 300) => def.compute([], { ...defaults, ...params }, { W, H });
const base = run();
assert.deepEqual(base, run(), "same seed must reproduce every character");
assert.notDeepEqual(base, run({ seed: 7 }));
assert.equal(base.paths.length, 0, "receipt characters must not become plotter geometry");
assert.equal(createHash("sha256").update(encodeAsciiReceipt(base.receiptText)).digest("hex"), "1605980dfe61ac0e6bbfb9c13c3e8c5e30eb36b225031b92b6e913d285e48c5b", "1× preserves the published 2.191 program exactly");
const legacy = { ...base.receiptText }; delete legacy.size;
assert.deepEqual(encodeAsciiReceipt(legacy), encodeAsciiReceipt(base.receiptText));
const legacyParams = { ...defaults }; delete legacyParams.size;
assert.deepEqual(def.compute([], legacyParams, { W: 80, H: 300 }), base);
for (const font of ["A", "B"]) for (let size = 1; size <= 8; size++) {
  const receipt = asciiReceipt(run({ font, size, cols: 56 }, 80, 1000).receiptText), metrics = RECEIPT_FONTS[font];
  const maxCols = Math.floor(512 / (metrics.width * size));
  assert.equal(receipt.size, size);
  assert.equal(receipt.lines[0].length, maxCols);
  assert.equal(receipt.lineSpacing, metrics.height * size + 1);
  assert.equal(receipt.lines.length, Math.floor(6400 / receipt.lineSpacing));
  assert.equal(receipt.left, Math.floor((512 - maxCols * metrics.width * size) / 2));
  const js = Buffer.from(encodeAsciiReceipt(receipt));
  assert.equal(js[9], (size - 1) * 17, "native GS ! scales width and height");
  const python = execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,'print-server');import ascii_receipt;sys.stdout.buffer.write(ascii_receipt.escpos_text(json.load(sys.stdin)))"], { input: JSON.stringify(receipt) });
  assert.deepEqual(js, python, `${font} ${size}× native parity`);
}
for (const pattern of ["Error weave", "Waves", "Stream", "Noise"]) {
  for (const font of ["A", "B"]) {
    const { receiptText } = run({ pattern, font, cols: 1e9 }, 80, 1000);
    const receipt = asciiReceipt(receiptText), metrics = RECEIPT_FONTS[font];
    assert.equal(receipt.lines.length, Math.floor(6400 / receipt.lineSpacing));
    assert(receipt.lines.every(line => line.length === metrics.columns));
    assert(receipt.lines.every(line => line.length * metrics.width + receipt.left < 512));
    const js = Buffer.from(encodeAsciiReceipt(receipt));
    const python = execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,'print-server');import server;sys.stdout.buffer.write(server.escpos_text(json.load(sys.stdin)))"], { input: JSON.stringify(receipt) });
    assert.deepEqual(js, python, "download and server must send identical ESC/POS bytes");
    assert.equal(js.subarray(35, -6).filter(byte => byte === 10).length, receipt.lines.length);
    assert.equal(js.indexOf(Buffer.from([29, 118, 48])), -1, "no raster command");
    assert(js.subarray(-6).equals(Buffer.from([29, 86, 65, 32, 27, 64])));
  }
}
const blank = run({ density: 0 }).receiptText;
assert(blank.lines.every(line => /^ +$/.test(line)));
assert(run({ density: 1 }).receiptText.lines.every(line => !line.includes(" ")));
const clean = run({ characters: "a\x1b@\n\u00e4\u{1f600}" }).receiptText;
assert(clean.lines.every(line => /^[a@ ]*$/.test(line)));
assert(run({ characters: "\x00\n" }).receiptText.lines.some(line => /\S/.test(line)), "empty sanitized alphabet has a usable fallback");
const long = run({}, 80, 1e9).receiptText;
assert.equal(long.lines.length, Math.floor(RECEIPT_MAX_HEIGHT_DOTS / long.lineSpacing));
asciiReceipt(long);
for (const bad of [
  { font: "C" }, { lines: ["\x1b@"] }, { lines: ["\n"] }, { lines: ["ä"] },
  { lines: ["a".repeat(57)] }, { lineSpacing: 16 }, { lineSpacing: 256 },
  { left: -1 }, { left: 1.5 }, { lines: [] }, { lines: Array(Math.floor(RECEIPT_MAX_HEIGHT_DOTS / 18) + 1).fill("0") },
  ...[0, 9, -1, 1.5, true, "2", null].map(size => ({ size })),
  { size: 2, lineSpacing: 33 }, { size: 8, lineSpacing: 137, lines: ["0".repeat(8)] },
]) assert.throws(() => asciiReceipt({ ...base.receiptText, ...bad }));
assert.deepEqual(encodeAsciiReceipt(base.receiptText, false).slice(-2), new Uint8Array([27, 64]));

const originalFetch = globalThis.fetch;
try {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => url.endsWith("/health") ? { formats: ["image", "text"], asciiSizeVersion: 1 }
      : options?.method === "POST" ? { id: "test-job" } : { id: "test-job", status: "done" } };
  };
  assert.equal((await sendReceipt("http://127.0.0.1:8631", asciiReceipt(base.receiptText), false)).status, "done");
  const sent = JSON.parse(requests[1].options.body);
  assert.equal(sent.kind, "text");
  assert.equal(sent.cut, false);
  assert.deepEqual(sent.lines, base.receiptText.lines);
  await sendReceipt("http://127.0.0.1:8631", asciiReceipt(run({ size: 4 }).receiptText));
  assert.equal(JSON.parse(requests[4].options.body).size, 4);
  let resizedPost = false;
  globalThis.fetch = async (_url, options) => { resizedPost ||= options?.method === "POST"; return { ok: true, json: async () => ({ formats: ["image", "text"] }) }; };
  await assert.rejects(sendReceipt("http://localhost:8631", asciiReceipt(run({ size: 2 }).receiptText)), /Update.*character sizes/);
  assert.equal(resizedPost, false, "old server must not silently print resized art at 1×");
  let posted = false;
  globalThis.fetch = async (_url, options) => { posted ||= options?.method === "POST"; return { ok: true, json: async () => ({ ready: true }) }; };
  await assert.rejects(sendReceipt("http://localhost:8631", asciiReceipt(base.receiptText)), /Update the Muusia print server/);
  assert.equal(posted, false, "old server gets no unsupported print job");
} finally { globalThis.fetch = originalFetch; }

if (process.argv.includes("--export")) {
  const patch = { app: "muusia", v: 1, name: "Receipt ASCII — Beautiful error", canvas: { W: 80, H: 300 },
    root: { nodes: [{ id: 9001, type: def.key, x: 30, y: 20, params: defaults }], edges: [], outputId: 9001 } };
  writeFileSync("output/receipt-ascii.muusia.json", JSON.stringify(patch, null, 2));
  writeFileSync("output/receipt-ascii.escpos", encodeAsciiReceipt(base.receiptText));
}
console.log("Receipt ASCII: patterns, bounds, ASCII validation, native byte parity and send flow OK");
