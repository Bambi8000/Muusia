import { RECEIPT_MAX_HEIGHT_DOTS } from "../../src/receipt-format.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { parseEscPos, parseReceiptAnimationZip, parseReceiptJson, receiptImageData } from "../src/receipt.js";

const row = Uint8Array.from([0x80, ...Array(63).fill(0)]);
const json = JSON.stringify({ format: "muusia-receipt", version: 1, width: 512, height: 1, data: Buffer.from(row).toString("base64"), cut: true });

test("Muusia receipt JSON shows the exact printed pixels", () => {
  const receipt = parseReceiptJson(json);
  assert.equal(receipt.height, 1);
  assert.equal(receipt.cut, true);
  const rgba = receiptImageData(receipt);
  assert.deepEqual([...rgba.slice(0, 8)], [0, 0, 0, 255, 255, 255, 255, 255]);
});

test("ESC/POS raster stream reconstructs rows and cut state", () => {
  const bytes = Uint8Array.from([0x1B, 0x40, 0x1D, 0x76, 0x30, 0, 64, 0, 1, 0, ...row, 0x1B, 0x4A, 112, 0x1D, 0x56, 0]);
  const receipt = parseEscPos(bytes);
  assert.equal(receipt.height, 1);
  assert.equal(receipt.pixels[0], 0x80);
  assert.equal(receipt.feedDots, 112);
  assert.equal(receipt.cut, true);
});

test("receipt reader rejects malformed dimensions and unknown commands", () => {
  assert.throws(() => parseReceiptJson(json.replace('"height":1', '"height":2')), /512 dots/);
  assert.throws(() => parseEscPos(Uint8Array.from([0x1B, 0x40, 0x1B, 0x70])), /Unsupported ESC\/POS/);
});

test("animation ZIP sorts numbered receipts and keeps each frame's pixels", () => {
  const frame = (number, pixel) => strToU8(JSON.stringify({ format: "muusia-receipt", version: 1, width: 512, height: 1,
    data: Buffer.from(Uint8Array.from([pixel, ...Array(63).fill(0)])).toString("base64"), frame: number, frameCount: 2, cut: false }));
  const zip = zipSync({ "patch-f002.muusia-receipt.json": frame(2, 0x40), "patch-f001.muusia-receipt.json": frame(1, 0x80) }, { level: 0 });
  const frames = parseReceiptAnimationZip(zip);
  assert.deepEqual(frames.map(item => item.receipt.frame), [1, 2]);
  assert.deepEqual(frames.map(item => item.receipt.pixels[0]), [0x80, 0x40]);
  assert.throws(() => parseReceiptAnimationZip(zipSync({ "patch-f002.muusia-receipt.json": frame(2, 0x40) }, { level: 0 })), /missing or out of sequence/);
});

test("multi-metre JSON preserves first, stripe boundary and last pixels with bounded preview tiles", () => {
  for (const height of [6400, 19200, 64000, RECEIPT_MAX_HEIGHT_DOTS]) {
    const pixels = Buffer.alloc(height * 64);
    pixels[0] = 0x80;
    pixels[1024 * 64] = 0x80;
    pixels[pixels.length - 1] = 0x01;
    const text = JSON.stringify({ format: "muusia-receipt", version: 1, width: 512, height, data: pixels.toString("base64"), cut: true });
    const receipt = parseReceiptJson(text);
    assert.deepEqual(receipt.pixels, new Uint8Array(pixels));
    assert.equal(receipt.cut, true);
    assert.deepEqual([...receiptImageData(receipt, 1024, 1).slice(0, 4)], [0, 0, 0, 255]);
    assert.deepEqual([...receiptImageData(receipt, height - 1, 1).slice(-4)], [0, 0, 0, 255]);
    assert.equal(receiptImageData(receipt, 0, 1024).length, 512 * 1024 * 4);
  }
});

test("long ESC/POS streams retain every stripe without intermediate cuts", () => {
  const height = RECEIPT_MAX_HEIGHT_DOTS, pixels = Buffer.alloc(height * 64);
  for (let i = 0; i < pixels.length; i++) pixels[i] = i % 251;
  const chunks = [Buffer.from([0x1b, 0x40])];
  for (let row = 0; row < height; row += 256) {
    const rows = Math.min(256, height - row);
    chunks.push(Buffer.from([0x1d, 0x76, 0x30, 0, 64, 0, rows & 255, rows >> 8]), pixels.subarray(row * 64, (row + rows) * 64));
  }
  chunks.push(Buffer.from([0x1b, 0x4a, 112, 0x1d, 0x56, 0]));
  const receipt = parseEscPos(Buffer.concat(chunks));
  assert.deepEqual(receipt.pixels, new Uint8Array(pixels));
  assert.equal(receipt.height, height);
  assert.equal(receipt.feedDots, 112);
  assert.equal(receipt.cut, true);
});

test("reader rejects oversized files, invalid Base64 and preview row ranges", () => {
  assert.throws(() => parseReceiptJson(json.replace('"height":1', `"height":${RECEIPT_MAX_HEIGHT_DOTS + 1}`)), /512 dots/);
  assert.throws(() => parseReceiptJson(json.replace('gA', '*!')), /receipt v1/);
  const receipt = parseReceiptJson(json);
  assert.throws(() => receiptImageData(receipt, 1, 1), /preview rows/);
});

test("animation ZIP accepts metre-long numbered frames above the former per-file limit", () => {
  const height = 6400, data = Buffer.alloc(height * 64).toString("base64");
  const frame = number => strToU8(JSON.stringify({format:"muusia-receipt",version:1,width:512,height,data,frame:number,frameCount:2,cut:true}));
  const frames = parseReceiptAnimationZip(zipSync({"f2.muusia-receipt.json":frame(2),"f1.muusia-receipt.json":frame(1)}));
  assert.deepEqual(frames.map(item => [item.receipt.frame,item.receipt.height]), [[1,height],[2,height]]);
});
