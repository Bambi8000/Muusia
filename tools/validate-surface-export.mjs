import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { unzipSync, strFromU8 } from "fflate";
import { createSurfaceSession } from "../src/surface-session.js";
import { createStrip } from "../src/surface-composer.js";
import { createContentPlacement, createStripRasterizer } from "../src/surface-render.js";
import { DEFAULT_EXPORT_DPI, surfaceExportPlan, writeStripPng, exportSurfacePngs } from "../src/surface-export.js";

function fixture() {
  const s = createSurfaceSession(); s.widthMm = 4; s.heightMm = 4;
  s.strips = [createStrip({ id: "α/one", centerXmm: 2, centerYmm: 2, physicalWidthMm: 4, printableWidthMm: 2, printableOffsetMm: 1, lengthMm: 4 })];
  s.selectedId = s.strips[0].id;
  const image = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) image.data.set([x * 60, y * 60, 90, x === 2 ? 128 : 255], (y * 4 + x) * 4);
  const placement = createContentPlacement({ sourceWidth: 4, sourceHeight: 4, widthMm: 4, heightMm: 4 });
  return { s, source: { image, placement } };
}

// Independent PNG reader: check every CRC and inflate the complete IDAT stream.
function png(bytes) {
  const data = Buffer.from(bytes), chunks = [];
  assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  for (let p = 8; p < data.length;) {
    const n = data.readUInt32BE(p), type = data.subarray(p + 4, p + 8).toString(), body = data.subarray(p + 8, p + 8 + n);
    let crc = 0xffffffff;
    for (const b of data.subarray(p + 4, p + 8 + n)) { crc ^= b; for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
    assert.equal((crc ^ 0xffffffff) >>> 0, data.readUInt32BE(p + 8 + n), `CRC ${type}`);
    chunks.push({ type, body }); p += n + 12;
    if (type === "IEND") assert.equal(p, data.length);
  }
  const head = chunks.find(c => c.type === "IHDR").body;
  assert.equal(head[8], 8); assert.equal(head[9], 2);
  const width = head.readUInt32BE(0), height = head.readUInt32BE(4);
  const raw = inflateSync(Buffer.concat(chunks.filter(c => c.type === "IDAT").map(c => c.body)));
  assert.equal(raw.length, (width * 3 + 1) * height);
  for (let y = 0; y < height; y++) assert.equal(raw[y * (width * 3 + 1)], 0);
  const meta = chunks.find(c => c.type === "iTXt").body;
  assert.equal(meta.subarray(0, 11).toString(), "Muusia\0\0\0\0\0");
  return { width, height, raw, chunks, metadata: JSON.parse(meta.subarray(11).toString()), pixel: (x, y) => [...raw.subarray(y * (width * 3 + 1) + x * 3 + 1, y * (width * 3 + 1) + x * 3 + 4)] };
}

test("PNG round trip preserves RGB, alpha over white, blank paper edges and exact metadata", async () => {
  const { s, source } = fixture(); s.production.fromMm = 3.9;
  const result = await exportSurfacePngs(s, { selectedOnly: true, dpi: 25.4, projectName: "../Mä/../" }, { source });
  const out = png(new Uint8Array(await result.blob.arrayBuffer()));
  assert.equal(out.width, 4); assert.equal(out.height, 4, "Print cursor must not crop the PNG");
  assert.deepEqual(out.pixel(0, 1), [255, 255, 255]); assert.deepEqual(out.pixel(3, 1), [255, 255, 255]);
  assert.deepEqual(out.pixel(1, 1), [60, 60, 90]); assert.deepEqual(out.pixel(2, 1), [187, 157, 172]);
  const phys = out.chunks.find(c => c.type === "pHYs").body;
  assert.equal(phys.readUInt32BE(0), 1000); assert.equal(phys.readUInt32BE(4), 1000); assert.equal(phys[8], 1);
  assert.equal(out.metadata.strips[0].id, "α/one"); assert.equal(out.metadata.paper.stripCount, 1);
  assert.equal(out.metadata.strips[0].raster.widthMm, 4);
  assert.ok(!result.filename.includes("..") && !result.filename.includes("/"));
});

test("ZIP files and manifest match visible print order, stable IDs and independent overlap", async () => {
  const { s, source } = fixture();
  s.strips = [{ ...s.strips[0], printOrder: 3 }, { ...s.strips[0], id: "second", printOrder: 1, rotationDeg: 90 }, { ...s.strips[0], id: "hidden", visible: false }];
  const before = JSON.stringify(s);
  const result = await exportSurfacePngs(s, { dpi: 25.4, projectName: "test" }, { source });
  const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  assert.equal(Object.keys(files).length, 3); assert.deepEqual(manifest.strips.map(s => s.id), ["second", "α/one"]);
  assert.equal(manifest.paper.stripCount, 2); assert.equal(manifest.paper.totalLengthM, .008); assert.equal(manifest.paper.allowancesIncluded, false);
  for (const strip of manifest.strips) {
    const out = png(files[strip.filename]); assert.equal(out.width, strip.raster.width); assert.equal(out.height, strip.raster.height);
    assert.equal(out.metadata.strips[0].id, strip.id); assert.equal(out.metadata.paper.stripCount, 1);
    assert.ok(out.raw.some(v => v !== 255), "Overlapping strips retain their own content");
  }
  assert.equal(JSON.stringify(s), before, "Export does not mutate production records or geometry");
});

test("arbitrary-angle PNG pixels match shared rasterizer blocks and printable crop origin", async () => {
  for (const angle of [0, 45, 90, 137]) for (const area of ["paper", "printable"]) {
    const { s, source } = fixture(); s.strips[0].rotationDeg = angle;
    const result = await exportSurfacePngs(s, { dpi: 25.4, area, selectedOnly: true }, { source });
    const out = png(new Uint8Array(await result.blob.arrayBuffer()));
    const expected = createStripRasterizer(source.image, source.placement, s, s.strips[0], { dotsPerMmX: 1, area }).renderBlock(0, 4);
    assert.equal(out.width, area === "paper" ? 4 : 2);
    assert.equal(out.metadata.strips[0].raster.localXmm, area === "paper" ? 0 : 1);
    for (let y = 0; y < 4; y++) for (let x = 0; x < out.width; x++) assert.deepEqual(out.pixel(x, y), [...expected.data.subarray((y * out.width + x) * 4, (y * out.width + x) * 4 + 3)]);
  }
});

test("fractional pixels report rounded extent without changing physical width or density", () => {
  const { s } = fixture(); const { entries, manifest } = surfaceExportPlan(s);
  const plan = entries[0].plan; assert.equal(plan.width, 29); assert.equal(plan.height, 29);
  assert.equal(manifest.raster.dpi, DEFAULT_EXPORT_DPI); assert.equal(plan.widthMm, 4);
  assert.ok(plan.rasterWidthMm > 4 && plan.rasterWidthMm - 4 < 1 / plan.dotsPerMmX);
});

test("100000-row PNG streams without allocating a full-height canvas or RGBA image", async () => {
  let calls = 0, largest = 0;
  const chunks = [], plan = { width: 1, height: 100000, dotsPerMmX: 1, dotsPerMmY: 1, maxBlockRows: 1048576 };
  const renderer = { plan, renderBlock(row, count) { calls++; largest = Math.max(largest, count); return { width: 1, height: count, data: new Uint8ClampedArray(count * 4).fill(255) }; } };
  await writeStripPng(renderer, { long: true }, { onData: bytes => chunks.push(bytes) });
  const out = png(Buffer.concat(chunks)); assert.equal(out.height, 100000); assert.ok(calls > 1 && largest <= 256);
});

test("cancellation interrupts blocks and never returns a partial PNG or ZIP", async () => {
  for (const selectedOnly of [true, false]) {
    const { s, source } = fixture(); s.heightMm = 600; s.strips[0].lengthMm = 600;
    let stop = false, reports = 0;
    await assert.rejects(exportSurfacePngs(s, { dpi: 25.4, selectedOnly }, { source, cancelled: () => stop, onProgress: () => { reports++; stop = true; } }), /cancelled/);
    assert.equal(reports, 1);
  }
});

test("invalid density/visibility and excessive work fail before source preparation", async () => {
  const { s } = fixture();
  for (const dpi of [NaN, 0, 24, 601]) assert.throws(() => surfaceExportPlan(s, { dpi }), /resolution/);
  assert.throws(() => surfaceExportPlan(s, { area: "bad" }));
  s.strips[0].visible = false; assert.throws(() => surfaceExportPlan(s, { selectedOnly: true }), /visible/);
  s.strips[0].visible = true; s.strips[0].lengthMm = 100000000;
  await assert.rejects(exportSurfacePngs(s), /budget/);
});
