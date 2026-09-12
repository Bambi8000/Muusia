import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { buildExportPlan, DEFAULT_EXPORT, frameTiming, gifDelay, chooseVideo } from '../src/export-plan.ts';
import { INITIAL_SEQUENCE } from '../src/sequence.ts';
import { encodeGif } from '../src/export-gif.ts';
import { paletteMapper } from '../src/gif-palette.ts';
import { pngArchive } from '../src/export-archive.ts';
import { setWebmDuration } from '../src/webm-duration.ts';

const frames = Array.from({ length: 4 }, (_, i) => ({ id: `f${i}`, frame: i, sheet: i < 3 ? 0 : 1, width: 1080, height: 763, url: `blob:frame${i}` }));
const plan = (sequence = {}, options = {}, source = frames) => buildExportPlan(source, { ...INITIAL_SEQUENCE, ...sequence }, { ...DEFAULT_EXPORT, ...options });
const noop = () => {};

test('exports follow the exact included timeline, including return journey and manual order', () => {
  assert.deepEqual(plan({ order: 'Reverse', excluded: ['f1'] }).frames.map(f => f.id), ['f3', 'f2', 'f0']);
  assert.deepEqual(plan({ order: 'Ping-pong', excluded: ['f1'] }).frames.map(f => f.id), ['f0', 'f2', 'f3', 'f2']);
  assert.deepEqual(plan({ order: 'Manual', manual: ['f3', 'f1', 'f0', 'f2'], excluded: ['f0'] }).frames.map(f => f.id), ['f3', 'f1', 'f2']);
  assert.equal(plan({ order: 'Ping-pong', excluded: ['f0', 'f1', 'f2'] }).frames.length, 1);
  assert.throws(() => plan({ excluded: frames.map(f => f.id) }), /Include at least one/);
});

test('exports downscale proportionally, pad odd video edges and repeat only videos', () => {
  const gif = plan({}, { longSide: 720, loops: 5 });
  assert.deepEqual([gif.width, gif.height, gif.frameCount], [720, 509, 4]);
  const video = plan({}, { format: 'video', longSide: 720, loops: 5 });
  assert.deepEqual([video.width, video.height, video.contentWidth, video.contentHeight, video.frameCount], [720, 510, 720, 509, 20]);
  assert.equal(video.duration, 20 / 12);
  assert.equal(plan({}, { longSide: 2160 }).width, 1080);
  assert.equal(plan({}, { format: 'png', loops: 5 }).frameCount, 4);
  for (const fps of [0, 31, NaN, 2.5]) assert.throws(() => plan({ fps }), /speed/);
  assert.throws(() => plan({}, { format: 'video', loops: 0 }), /repeats/);
  assert.equal(plan({}, { format: 'gif', loops: 0 }).frameCount, 4);
  assert.throws(() => plan({}, { longSide: 2 }), /size/);
  assert.throws(() => plan({}, {}, [frames[0], { ...frames[1], width: 480 }]), /same resolution/);
});

test('video and GIF timings keep cumulative error bounded at every supported speed', () => {
  for (let fps = 1; fps <= 30; fps++) {
    let elapsed = 0, gifMs = 0;
    for (let i = 0; i < 300; i++) {
      const timing = frameTiming(i, fps);
      assert.equal(timing.timestamp, elapsed);
      elapsed += timing.duration;
      gifMs += gifDelay(i, fps);
      assert.ok(Math.abs(elapsed - (i + 1) * 1e6 / fps) <= .501);
      assert.ok(Math.abs(gifMs - (i + 1) * 1000 / fps) <= 5.001);
      assert.ok(gifDelay(i, fps) >= 30);
    }
  }
});

test('video support prefers H.264, falls back after unsupported or throwing checks, and honors WebM', async () => {
  const p = plan({}, { format: 'video' }), tested = [];
  const preferred = await chooseVideo(p, async c => { tested.push(c); return true; });
  assert.equal(preferred.format, 'mp4'); assert.equal(tested.length, 1);
  assert.equal(preferred.config.avc.format, 'avc'); assert.equal(preferred.config.height % 2, 0);
  const fallback = await chooseVideo(p, async c => !c.codec.startsWith('avc'));
  assert.equal(fallback.format, 'webm');
  assert.equal((await chooseVideo(p, async c => { if (c.codec.startsWith('avc')) throw new Error('unsupported'); return true; })).format, 'webm');
  assert.equal(await chooseVideo(p, async () => false), null);
  const explicit = await chooseVideo(plan({}, { format: 'video', videoFormat: 'webm' }), async c => { assert.ok(c.codec.startsWith('vp09')); return true; });
  assert.equal(explicit.format, 'webm');
});

function inspectGif(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true), height = view.getUint16(8, true), packed = bytes[10];
  let at = 13 + (packed & 128 ? 3 * 2 ** ((packed & 7) + 1) : 0);
  const delays = [], localPalettes = [], images = [], applications = [];
  const blocks = () => { const result = []; while (bytes[at]) { const size = bytes[at++]; result.push(...bytes.subarray(at, at + size)); at += size; } at++; return new Uint8Array(result); };
  while (at < bytes.length) {
    const marker = bytes[at++];
    if (marker === 0x3b) { assert.equal(at, bytes.length); return { width, height, delays, images, localPalettes, applications, globalPalette: !!(packed & 128) }; }
    if (marker === 0x21) {
      const label = bytes[at++];
      if (label === 0xf9) { assert.equal(bytes[at++], 4); delays.push(view.getUint16(at + 1, true)); at += 4; assert.equal(bytes[at++], 0); }
      else { const data = blocks(); if (label === 0xff) applications.push(data); }
    } else if (marker === 0x2c) {
      images.push([view.getUint16(at + 4, true), view.getUint16(at + 6, true)]);
      const imageFlags = bytes[at + 8]; at += 9;
      localPalettes.push(!!(imageFlags & 128));
      if (imageFlags & 128) at += 3 * 2 ** ((imageFlags & 7) + 1);
      at++; blocks();
    } else assert.fail(`Unexpected GIF block ${marker} at ${at - 1}`);
  }
  assert.fail('Missing GIF trailer');
}
const raster = (color, width = 16, height = 12) => ({ width, height, data: Uint8ClampedArray.from(Array.from({ length: width * height }, () => [...color, 255]).flat()) });

test('real GIF has one global palette, every frame, bounded delays and optional infinite loop', async () => {
  const source = Array.from({ length: 12 }, (_, i) => ({ ...frames[0], id: `f${i}`, frame: i, width: 16, height: 12 }));
  const read = async i => raster(i % 2 ? [210, 20, 35] : [245, 240, 235]);
  const blob = await encodeGif(plan({}, {}, source), read, noop);
  assert.equal(blob.type, 'image/gif');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 6)), 'GIF89a');
  const parsed = inspectGif(bytes);
  assert.equal(parsed.images.length, 12); assert.ok(parsed.globalPalette);
  assert.ok(parsed.localPalettes.every(value => !value));
  assert.ok(parsed.images.every(size => size[0] === 16 && size[1] === 12));
  assert.equal(parsed.delays.reduce((sum, n) => sum + n, 0), 100);
  assert.equal(new TextDecoder().decode(parsed.applications[0].subarray(0, 11)), 'NETSCAPE2.0');
  assert.deepEqual([...parsed.applications[0].subarray(11)], [1, 0, 0]);
  const once = inspectGif(new Uint8Array(await (await encodeGif(plan({ loop: false }, {}, source.slice(0, 1)), async () => raster([255, 255, 255]), noop)).arrayBuffer()));
  assert.equal(once.images.length, 1); assert.equal(once.applications.length, 0);
});

test('optional dithering distributes two palette colors without changing source pixels', () => {
  const input = raster([128, 128, 128], 40, 30), original = input.data.slice(), palette = [[0, 0, 0], [255, 255, 255]];
  const plain = paletteMapper(palette, false)(input), map = paletteMapper(palette, true), dotted = map(input);
  assert.equal(new Set(plain).size, 1);
  assert.equal(new Set(dotted).size, 2);
  const white = dotted.reduce((sum, value) => sum + value, 0) / dotted.length;
  assert.ok(white > .47 && white < .53, `white coverage ${white}`);
  assert.deepEqual(map(input), dotted); assert.deepEqual(input.data, original);
});

test('PNG ZIP preserves source bytes with sequential names and timeline metadata', async () => {
  const p = plan({ order: 'Ping-pong', excluded: ['f1'], fps: 7 }, { format: 'png' });
  const source = new Map(p.frames.map(f => [f.id, new Uint8Array([137, 80, 78, 71, Number(f.id.slice(1))])]));
  const progress = [];
  const blob = await pngArchive(p, async i => source.get(p.frames[i].id), n => progress.push(n));
  assert.equal(blob.type, 'application/zip');
  const contents = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(contents), ['frames/frame-000001.png', 'frames/frame-000002.png', 'frames/frame-000003.png', 'frames/frame-000004.png', 'sequence.json']);
  const manifest = JSON.parse(strFromU8(contents['sequence.json']));
  assert.deepEqual(manifest.frames.map(f => f.sourceFrame), [1, 3, 4, 3]);
  assert.deepEqual(manifest.frames.map(f => f.sheet), [1, 1, 2, 1]);
  assert.equal(manifest.fps, 7); assert.equal(manifest.durationSeconds, 4 / 7);
  for (let i = 0; i < p.frames.length; i++) {
    assert.deepEqual(contents[manifest.frames[i].file], source.get(p.frames[i].id));
    assert.equal(manifest.frames[i].timestamp, Math.round(i * 1e6 / 7));
  }
  assert.deepEqual(progress, [1, 2, 3, 4]);
  await assert.rejects(pngArchive(p, async () => { throw new Error('missing frame'); }, noop), /missing frame/);
});

test('WebM duration includes the final frame interval without changing blocks', () => {
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'V_VP9', width: 16, height: 12, frameRate: 12 } });
  for (let i = 0; i < 12; i++) muxer.addVideoChunkRaw(new Uint8Array([0x82, 0x49, 0x83, 0x42, i]), i === 0 ? 'key' : 'delta', Math.round(i * 1e6 / 12));
  muxer.finalize();
  const before = Buffer.from(new Uint8Array(target.buffer));
  const offset = before.indexOf(Buffer.from([0x44, 0x89, 0x88]));
  assert.ok(offset > 0);
  assert.equal(before.readDoubleBE(offset + 3), 916);
  setWebmDuration(target.buffer, 1);
  const after = Buffer.from(target.buffer);
  assert.equal(after.readDoubleBE(offset + 3), 1000);
  assert.deepEqual(after.subarray(0, offset + 3), before.subarray(0, offset + 3));
  assert.deepEqual(after.subarray(offset + 11), before.subarray(offset + 11));
  assert.throws(() => setWebmDuration(new ArrayBuffer(1), 1), /Invalid/);
  assert.throws(() => setWebmDuration(target.buffer, NaN), /duration/);
});
