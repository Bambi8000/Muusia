import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';

let server, PhotosStep, RegistrationStep, SequenceStep;
before(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: 'custom',
  });
  PhotosStep = (await server.ssrLoadModule('/src/PhotosStep.tsx')).default;
  RegistrationStep = (await server.ssrLoadModule('/src/RegistrationStep.tsx')).default;
  SequenceStep = (await server.ssrLoadModule('/src/SequenceStep.tsx')).default;
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

function sequencePage(numbers, excluded = []) {
  const frames = numbers.map((frameNumber, i) => ({ id: `photo${i}:0`, photoId: `photo${i}`, sheet:i, frame:i, captureMode:'frames', frameNumber, width:480, height:420, url:`crop${i}.png`, thumbnailUrl:`thumb${i}.png` }));
  return renderToStaticMarkup(createElement(SequenceStep, {
    closeup:true, photos:frames.map(f=>({id:f.photoId,frameNumber:f.frameNumber})), numberBusy:false,
    setFrameNumber:noop,onReadNumber:noop,onReadMissingNumbers:noop,
    extraction:{completed:true,frames,busy:false,error:'',extract:noop,cancel:noop},
    resolution:480,setResolution:noop,stabilize:false,setStabilize:noop,total:frames.length,readiness:'',
    sequence:{order:'Frame number',manual:[],excluded,fps:12,loop:true},setSequence:noop,onBack:noop,onExport:noop,
  }));
}
test('numeric sequence shows sorted cards and editable numbers with direct read and sort actions', () => {
  const html = sequencePage([5,1,3]);
  assert.deepEqual([...html.matchAll(/<img[^>]+src="thumb(\d+)\.png"/g)].map(m=>Number(m[1])),[1,2,0]);
  assert.equal((html.match(/Frame number on paper/g)||[]).length,3);
  for(const label of ['Order by frame number','Export animation →','Play'])assert.deepEqual(buttons(html,label),[{disabled:false}]);
  assert.deepEqual(buttons(html,'Read missing numbers'),[{disabled:true}]);
  assert.equal(buttons(html,'Read number').length,3);
});
test('unknown and duplicate printed numbers block playback and export until corrected or excluded', () => {
  for(const numbers of [[undefined,1],[1,1]]) {
    const html=sequencePage(numbers);
    assert.deepEqual(buttons(html,'Play'),[{disabled:true}]);
    assert.deepEqual(buttons(html,'Export animation →'),[{disabled:true}]);
    assert.match(html,/Check the frame numbers below/);
    assert.doesNotMatch(html,/All frames are excluded/);
    assert.deepEqual(buttons(sequencePage(numbers,['photo0:0']),'Export animation →'),[{disabled:false}]);
  }
  assert.deepEqual(buttons(sequencePage([undefined,1]),'Read missing numbers'),[{disabled:false}]);
});
