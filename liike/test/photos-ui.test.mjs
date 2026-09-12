import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';

let server, PhotosStep, RegistrationStep;
before(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: 'custom',
  });
  PhotosStep = (await server.ssrLoadModule('/src/PhotosStep.tsx')).default;
  RegistrationStep = (await server.ssrLoadModule('/src/RegistrationStep.tsx')).default;
});
after(async () => { await server?.close(); });

const noop = () => {};
const unregisteredPhoto = id => ({
  id, name: `${id}.jpeg`, width: 4032, height: 3024, url: `${id}.jpeg`,
  points: [null, null, null, null],
  detection: { status: 'ambiguous', message: 'Place markers manually.', settingsKey: '' },
});
function photoPage(photos, sheets, busy = false) {
  return renderToStaticMarkup(createElement(PhotosStep, {
    library: { photos, busy, errors: [], add: noop, remove: noop, move: noop },
    sheets, settings: REFERENCE_SETTINGS, onBack: noop, onRegister: noop,
  }));
}
function buttons(html, label) {
  return [...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)]
    .filter(match => match[2] === label).map(match => ({ disabled: /\bdisabled(?:=|\s|$)/.test(match[1]) }));
}

test('failed detection and extra photos never block entry to manual registration', () => {
  const html = photoPage([unregisteredPhoto('first'), unregisteredPhoto('extra')], 1);
  assert.deepEqual(buttons(html, 'Review markers →'), [{ disabled: false }]);
  assert.deepEqual(buttons(html, 'Place markers manually'), [{ disabled: false }, { disabled: false }]);
  assert.match(html, /Only the first photo is used in the sequence/);
});

test('available photos can be registered before every required sheet has a photo', () => {
  const html = photoPage([unregisteredPhoto('first')], 2);
  assert.deepEqual(buttons(html, 'Review markers →'), [{ disabled: false }]);
  assert.deepEqual(buttons(html, 'Place markers manually'), [{ disabled: false }]);
  assert.match(html, /Add 1 more photo/);
});

test('registration entry stays disabled with no photo or while photos are loading', () => {
  assert.deepEqual(buttons(photoPage([], 1), 'Review markers →'), [{ disabled: true }]);
  const loading = photoPage([unregisteredPhoto('first')], 1, true);
  assert.deepEqual(buttons(loading, 'Review markers →'), [{ disabled: true }]);
  assert.deepEqual(buttons(loading, 'Place markers manually'), [{ disabled: true }]);
});

test('manual registration renders an extra photo without requesting out-of-range frame windows', () => {
  const html = renderToStaticMarkup(createElement(RegistrationStep, {
    photo: unregisteredPhoto('extra'), settings: REFERENCE_SETTINGS, sheet: 1,
    setPoints: noop, detect: noop, undoDetection: noop,
  }));
  assert.match(html, /Place markers on photo/);
  assert.match(html, /0 of 4 markers placed/);
  assert.match(html, /This extra photo has no frame windows yet/);
});
