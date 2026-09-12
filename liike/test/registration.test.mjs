import test from 'node:test';
import assert from 'node:assert/strict';
import { solveHomography, project, registrationTransform } from '../src/homography.ts';
import { sampleRect } from '../src/sampling.ts';
import { photoFileError } from '../src/photos.ts';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';
import { buildLayout, framesOnSheet } from '../src/layout.ts';

const W = 297, H = 210;
const markers = buildLayout(REFERENCE_SETTINGS).markers;
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('normalized DLT recovers known perspective at corners and interior points', () => {
  const oracle = [3.8, .23, 120, -.11, 4.2, 230, .00031, -.00018, 1];
  const image = markers.map(p => project(oracle, p.x, p.y));
  const h = registrationTransform(W, H, image);
  for (const p of [...markers, { x: 0, y: 0 }, { x: W, y: H }, { x: 110, y: 125 }]) {
    const expected = project(oracle, p.x, p.y), actual = project(h, p.x, p.y);
    close(actual.x, expected.x); close(actual.y, expected.y);
  }
  const inverse = solveHomography(image, markers);
  const p = project(h, 45.5, 87.2), back = project(inverse, p.x, p.y);
  close(back.x, 45.5); close(back.y, 87.2);
});

test('all four photo rotations preserve physical sheet orientation', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const oracle = [c * 7, -s * 7, 2500, s * 7, c * 7, 2600, 0, 0, 1];
    const h = registrationTransform(W, H, markers.map(p => project(oracle, p.x, p.y)));
    const expected = project(oracle, W * .25, H * .75), actual = project(h, W * .25, H * .75);
    close(actual.x, expected.x); close(actual.y, expected.y);
  }
});

test('reject mirrored, crossing, coincident and non-finite assignments', () => {
  assert.throws(() => registrationTransform(W, H, [markers[0], markers[3], markers[2], markers[1]]), /mirrored/);
  assert.throws(() => registrationTransform(W, H, [markers[0], markers[2], markers[1], markers[3]]), /without crossing/);
  assert.throws(() => registrationTransform(W, H, [markers[0], markers[0], markers[2], markers[3]]), /distinct/);
  assert.throws(() => registrationTransform(W, H, [{ x: NaN, y: 20 }, ...markers.slice(1)]), /coordinates/);
  assert.throws(() => solveHomography(markers, markers.map(() => ({ x: 1, y: 1 }))), /distinct/);
  assert.throws(() => solveHomography(markers, markers.map((_, i) => ({ x: i, y: 1 }))), /aligned/);
});

test('pixel-center convention preserves identity and bilinear interpolation', () => {
  const source = { width: 2, height: 2, data: new Uint8ClampedArray([0, 0, 0, 255, 100, 0, 0, 255, 0, 100, 0, 255, 100, 100, 0, 255]) };
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  assert.deepEqual(sampleRect(source, source, identity, { x: 0, y: 0, w: 2, h: 2 }, 2, 2).data, source.data);
  assert.deepEqual([...sampleRect(source, source, identity, { x: 0, y: 0, w: 2, h: 2 }, 1, 1).data], [50, 50, 0, 255]);
  assert.deepEqual([...sampleRect(source, source, identity, { x: -10, y: -10, w: 2, h: 2 }, 1, 1).data], [255, 255, 255, 255]);
  const transparent = { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 0]) };
  assert.deepEqual([...sampleRect(transparent, transparent, identity, { x: 0, y: 0, w: 1, h: 1 }, 1, 1).data], [255, 255, 255, 255]);
});

test('working-copy scaling matches original photo coordinates', () => {
  const source = { width: 2, height: 2, data: new Uint8ClampedArray([20, 30, 40, 255, 60, 70, 80, 255, 90, 100, 110, 255, 150, 160, 170, 255]) };
  const h = [2, 0, 0, 0, 3, 0, 0, 0, 1];
  const result = sampleRect(source, { width: 4, height: 6 }, h, { x: 0, y: 0, w: 2, h: 2 }, 2, 2);
  assert.deepEqual(result.data, source.data);
});

test('synthetic rotated/perspective photo samples all 12 windows in the correct physical positions', () => {
  const known = [0, 1.3, 35, -1.3, 0, 440, .0003, .0002, 1];
  const quad = markers.map(p => project(known, p.x, p.y));
  const inverse = solveHomography(quad, markers);
  const source = { width: 350, height: 480, data: new Uint8ClampedArray(350 * 480 * 4) };
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const p = project(inverse, x + .5, y + .5), index = (y * source.width + x) * 4;
    source.data.set([p.x / W * 255, p.y / H * 255, 90, 255], index);
  }
  const recovered = registrationTransform(W, H, quad);
  for (const frame of framesOnSheet(REFERENCE_SETTINGS, 0)) {
    const result = sampleRect(source, source, recovered, frame.window, 5, 5);
    const middle = (2 * 5 + 2) * 4;
    close(result.data[middle], (frame.window.x + frame.window.w / 2) / W * 255, 1.2);
    close(result.data[middle + 1], (frame.window.y + frame.window.h / 2) / H * 255, 1.2);
    assert.equal(result.data[middle + 2], 90);
  }
});

test('unsupported photo formats have actionable errors', () => {
  assert.match(photoFileError({ name: 'IMG.HEIC', type: '' }), /Export.*JPEG/);
  assert.match(photoFileError({ name: 'image', type: 'image/heif' }), /HEIC/);
  assert.match(photoFileError({ name: 'image.svg', type: 'image/svg+xml' }), /JPEG, PNG or WebP/);
  assert.equal(photoFileError({ name: 'IMG.JPG', type: '' }), null);
  assert.equal(photoFileError({ name: 'photo', type: 'image/webp' }), null);
});
