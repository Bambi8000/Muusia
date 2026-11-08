import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEscPos, parseReceiptJson, receiptImageData } from "../src/receipt.js";

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
