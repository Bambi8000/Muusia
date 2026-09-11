import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMarkers } from '../src/detection.ts';
import { registrationTransform } from '../src/homography.ts';
import { sampleRect } from '../src/sampling.ts';
import { framesOnSheet } from '../src/layout.ts';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';
import { MARKERS, syntheticPhoto } from './synthetic-photo.mjs';

for (const rotation of [0, 90, 180, 270, 35]) test(`real-SVG synthetic oracle: ${rotation}° rotation, perspective, noise, vignette and distractors`, () => {
  const scene = syntheticPhoto({ rotation });
  const result = detectMarkers(scene.raster, REFERENCE_SETTINGS);
  assert.equal(result.status, 'found', JSON.stringify(result));
  result.points.forEach((point, i) => {
    const recovered = scene.toSheet(point), expected = MARKERS[i];
    const error = Math.hypot(recovered.x - expected.x, recovered.y - expected.y);
    assert.ok(error < .5, `marker ${i}: ${error.toFixed(3)} mm error`);
  });
  const recovered = registrationTransform(297, 210, result.points);
  const windows = framesOnSheet(REFERENCE_SETTINGS, 0).map(f => f.window);
  const crops = windows.map(window => sampleRect(scene.raster, scene.raster, recovered, window, 120, 85));
  const expected = windows.map(window => sampleRect(scene.sheet, scene.sheet, [4, 0, 0, 0, 4, 0, 0, 0, 1], window, 120, 85));
  const ink = (raster) => {
    const gray = Array.from({ length: raster.width * raster.height }, (_, i) => raster.data[i * 4]);
    const paper = [...gray].sort((a, b) => a - b)[Math.floor(gray.length * .8)];
    return gray.map(v => Math.max(0, paper - v - 12));
  };
  const templates = expected.map(ink);
  const similarity = (a, b) => {
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return dot / Math.sqrt(aa * bb);
  };
  crops.forEach((crop, i) => {
    const vector = ink(crop), scores = templates.map(template => similarity(vector, template));
    assert.equal(scores.indexOf(Math.max(...scores)), i, `window ${i + 1} must match its own frame, scores: ${scores.map(v => v.toFixed(2))}`);
    assert.ok(scores[i] > .65, `window ${i + 1} ink similarity ${scores[i]}`);
  });
});

test('8 mm markers survive hatch blur and stronger uneven lighting', () => {
  const scene = syntheticPhoto({ markSize: 8, rotation: 270, vignette: .4, noise: 10 });
  const result = detectMarkers(scene.raster, { ...REFERENCE_SETTINGS, markSize: 8 });
  assert.equal(result.status, 'found', JSON.stringify(result));
  result.points.forEach((point, i) => {
    const recovered = scene.toSheet(point), expected = MARKERS[i];
    assert.ok(Math.hypot(recovered.x - expected.x, recovered.y - expected.y) < .5);
  });
});

test('a mirrored A4 photo is warned about instead of silently flipped', () => {
  const result = detectMarkers(syntheticPhoto({ mirror: true }).raster, REFERENCE_SETTINGS);
  assert.equal(result.status, 'mirrored', JSON.stringify(result)); assert.equal(result.points, null);
});

for (const holes of [0, 2]) test(`${holes} orientation holes require manual placement`, () => {
  const result = detectMarkers(syntheticPhoto({ holes }).raster, REFERENCE_SETTINGS);
  assert.equal(result.status, 'ambiguous', JSON.stringify(result)); assert.equal(result.points, null);
});

test('blank photo and wrong marker size fail gracefully', () => {
  const blank = { width: 400, height: 300, data: new Uint8ClampedArray(400 * 300 * 4).fill(255) };
  assert.equal(detectMarkers(blank, REFERENCE_SETTINGS).status, 'not-found');
  assert.equal(detectMarkers(syntheticPhoto().raster, { ...REFERENCE_SETTINGS, markSize: 8 }).points, null);
});
