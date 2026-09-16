import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { DEFAULTS } from '../src/layout.ts';
import { DEFAULT_ADJUSTMENTS } from '../src/adjustments.ts';
import { INITIAL_SEQUENCE, timelineFrames } from '../src/sequence.ts';
import { DEFAULT_EXPORT } from '../src/export-plan.ts';
import { planFrames } from '../src/frames.ts';
import { parseProject, projectFilename, MAX_PROJECT_BYTES, MAX_PHOTO_BYTES } from '../src/project.ts';
import { saveProject, readProject, openProject } from '../src/project-archive.ts';

const points = [{ x: 20, y: 20 }, { x: 400, y: 20 }, { x: 400, y: 277 }, { x: 20, y: 277 }];
const photo = (id, name = 'same.jpeg') => ({ id, name, file: new File([new Uint8Array([255, 216, 255, id.charCodeAt(0), 17])], name, { type: 'image/jpeg', lastModified: 12345 }), width: 420, height: 297, points: structuredClone(points), detection: { status: 'edited', settingsKey: '420/297/15/dark' } });
const state = (photos = []) => ({ name: 'Vihreä kukka', settings: { ...DEFAULTS, total: 13, paperTone: 'dark', pad: 2 }, adjustments: { ...DEFAULT_ADJUSTMENTS, autoAdjust: true, sharpenEnabled: true, sharpen: 63, gamma: 1.15 }, sequence: { ...INITIAL_SEQUENCE, fps: 9, loop: false, order: 'Manual', manual: photos.length ? [`${photos[1].id}:0`, `${photos[0].id}:2`] : [], excluded: photos.length ? [`${photos[0].id}:1`] : [] }, exportOptions: { ...DEFAULT_EXPORT, format: 'video', longSide: 720, videoFormat: 'webm', dither: true, loops: 6, quality: 'Standard' }, resolution: 1080, stabilize: true });
const noop = () => {};
async function archiveParts() {
  const photos = [photo('first'), photo('second')], config = state(photos);
  const blob = await saveProject(config, photos);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return { photos, config, blob, files, document: JSON.parse(strFromU8(files['project.json'])) };
}
const pack = files => new Blob([zipSync(files)]);
const rewrite = (files, document) => pack({ ...files, 'project.json': strToU8(JSON.stringify(document)) });

test('version 1 sheet projects migrate without changing crop geometry or marker interpretation', async () => {
  const {files,document}=await archiveParts();
  document.version=1;
  delete document.settings.captureMode; delete document.settings.clearance; delete document.settings.trim;
  document.photos.forEach(p=>delete p.registrationMode);
  const result=await readProject(rewrite(files,document));
  assert.equal(result.project.version,4); assert.equal(result.project.settings.captureMode,'sheet');
  assert.equal(result.project.settings.clearance,0); assert.equal(result.project.settings.trim,0);
  assert.ok(result.project.photos.every(p=>p.registrationMode==='sheet'));
});

test('close-up projects preserve frame identity, capture geometry and original photos', async()=>{
  const photos=[photo('one'),photo('two')].map((p,i)=>({...p,registrationMode:'frames',frameNumber:[5,2][i]}));
  const config=state(photos);
  config.settings={...config.settings,captureMode:'frames',total:2,clearance:3,trim:1,crop:'Full cell',pad:0};
  config.sequence={...config.sequence,manual:['two:0','one:0'],excluded:['one:0']};
  let id=0;
  const restored=await openProject(await saveProject(config,photos),noop,undefined,async file=>({...photo(`fresh${++id}`),file}),noop);
  assert.deepEqual(restored.project.settings,config.settings);
  assert.ok(restored.photos.every(p=>p.registrationMode==='frames'));
  assert.deepEqual(restored.photos.map(p=>p.frameNumber),[5,2]);
  const frames=planFrames(restored.project.settings,restored.photos,2160).flatMap(p=>p.frames);
  assert.equal(frames.length,2);
  assert.deepEqual(timelineFrames(frames,restored.project.sequence).map(f=>f.frame),[1]);
  const invalid=structuredClone(restored.project); invalid.sequence.manual=[`${restored.photos[0].id}:1`];
  assert.throws(()=>parseProject(invalid),/unknown photo or cell/);
});

test('a 24-frame series of 12 MP originals fits the project pixel budget',async()=>{
  const photos=Array.from({length:24},(_,i)=>({...photo(`frame${i}`),width:3024,height:4032,registrationMode:'frames'}));
  const config=state(); config.settings={...DEFAULTS,captureMode:'frames',total:24,clearance:3,trim:1,crop:'Full cell'};
  const restored=await readProject(await saveProject(config,photos));
  assert.equal(restored.project.photos.length,24);
});

test('project round trip preserves original photo bytes, duplicate names, markers and every control', async () => {
  const { photos, config, blob, document } = await archiveParts();
  const restored = await readProject(blob);
  for (const key of ['name', 'settings', 'adjustments', 'sequence', 'exportOptions', 'resolution', 'stabilize']) assert.deepEqual(restored.project[key], config[key], key);
  assert.deepEqual(restored.project.photos.map(p => p.points), photos.map(p => p.points));
  assert.deepEqual(restored.project.photos.map(p => p.settingsKey), photos.map(p => p.detection.settingsKey));
  assert.notEqual(document.photos[0].path, document.photos[1].path);
  for (let i = 0; i < photos.length; i++) {
    assert.deepEqual(new Uint8Array(await restored.files[i].arrayBuffer()), new Uint8Array(await photos[i].file.arrayBuffer()));
    assert.equal(restored.files[i].name, photos[i].name);
    assert.equal(restored.files[i].lastModified, 12345);
  }
  assert.equal(blob.type, 'application/zip');
});

test('reopening creates fresh photo identities and preserves the exact partial-sheet/manual timeline', async () => {
  const { photos, config, blob } = await archiveParts();
  let id = 0;
  const restored = await openProject(blob, noop, undefined, async file => ({ ...photo(`fresh${++id}`), file }), noop);
  assert.deepEqual(restored.photos.map(p => p.id), ['fresh1', 'fresh2']);
  assert.deepEqual(parseProject(restored.project), restored.project);
  const before = planFrames(config.settings, photos, 1080).flatMap(p => p.frames);
  const after = planFrames(restored.project.settings, restored.photos, 1080).flatMap(p => p.frames);
  const identity = frames => frames.map(f => [f.sheet, f.cell, f.frame, f.crop, f.paperTone]);
  assert.deepEqual(identity(timelineFrames(after, restored.project.sequence)), identity(timelineFrames(before, config.sequence)));
  assert.equal(restored.photos[0].detection.status, 'edited');
  assert.deepEqual(restored.photos[0].points, points);
  assert.deepEqual((await readProject(await saveProject(restored.project, restored.photos))).project.sequence, restored.project.sequence);
});

test('settings-only starts and partially placed or crossing markers are valid unfinished projects', async () => {
  const empty = state();
  assert.equal((await readProject(await saveProject(empty, []))).project.photos.length, 0);
  const photos = [photo('one'), photo('two')];
  photos[0].points = [points[0], null, null, null];
  photos[1].points = [points[0], points[2], points[1], points[3]];
  const restored = await readProject(await saveProject(state(photos), photos));
  assert.deepEqual(restored.project.photos.map(p => p.points), photos.map(p => p.points));
});

test('saving drops stale frame references but retains ordering choices for extra photos', async () => {
  const photos = [photo('one'), photo('two')], config = state(photos);
  config.settings.total = 1;
  config.sequence.manual = ['missing:0', 'one:2', 'one:2', 'one:99', 'two:4'];
  config.sequence.excluded = ['removed:3', 'two:8'];
  const restored = await readProject(await saveProject(config, photos));
  assert.deepEqual(restored.project.sequence.manual, ['one:2', 'two:4']);
  assert.deepEqual(restored.project.sequence.excluded, ['two:8']);
  assert.equal(config.sequence.manual.length, 5, 'saving must not modify session state');
});

test('invalid schemas, future versions, bad markers and foreign references fail before image decoding', async () => {
  const { files, document } = await archiveParts();
  const cases = [
    p => { p.version = 99; }, p => { p.format = 'other'; },
    p => { p.settings.cols = 0; }, p => { p.settings.paperTone = 'blue'; },
    p => { p.adjustments.flatten = 'false'; }, p => { p.adjustments.gamma = null; },
    p => { p.sequence.fps = 0; }, p => { p.sequence.excluded = ['other:0']; },
    p => { p.sequence.manual = ['first:0', 'first:0']; },
    p => { p.photos[1].id = p.photos[0].id; }, p => { p.photos[1].path = p.photos[0].path; },
    p => { p.photos[0].points[0].x = -2; }, p => { p.photos[0].points = []; },
    p => { p.photos[0].path = '../escape.jpg'; }, p => { p.photos[0].path = 'https://example.com/photo.jpg'; },
    p => { p.exportOptions.loops = 0; }, p => { p.exportOptions.dither = 1; }, p => { p.resolution = 100; },
  ];
  for (const change of cases) {
    const p = structuredClone(document); change(p); let decodes = 0;
    await assert.rejects(openProject(rewrite(files, p), noop, undefined, async () => { decodes++; }, noop));
    assert.equal(decodes, 0);
  }
});

test('truncated, unrelated, missing and damaged archive contents fail with useful errors', async () => {
  const { blob, files, document } = await archiveParts();
  await assert.rejects(readProject(blob.slice(0, 40)), /Could not read/);
  await assert.rejects(readProject(new Blob(['not a ZIP'])), /Could not read/);
  await assert.rejects(readProject(pack({ 'sequence.json': strToU8('{}') })), /Could not read/);
  const missing = { ...files }; delete missing[document.photos[0].path];
  await assert.rejects(readProject(pack(missing)), /photos do not match/);
  const damaged = { ...files, [document.photos[0].path]: files[document.photos[0].path].slice() };
  damaged[document.photos[0].path][3] ^= 1;
  await assert.rejects(readProject(pack(damaged)), /damaged: same.jpeg/);
  await assert.rejects(readProject(pack({ ...files, 'project.json': strToU8('{') })), /settings are damaged/);
  await assert.rejects(readProject(pack({ ...files, '../outside.txt': strToU8('x') })), /Unexpected/);
});

test('oversized archives and expanded entries are rejected before allocating their content', async () => {
  await assert.rejects(readProject({ size: MAX_PROJECT_BYTES + 1, arrayBuffer: () => assert.fail('must not read') }), /larger than/);
  const { files } = await archiveParts();
  const bytes = zipSync(files), view = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, MAX_PHOTO_BYTES + 1, true); break; }
  await assert.rejects(readProject(new Blob([bytes])), /size limit/);
});

test('load failure and cancellation release staged photos without handing over a partial project', async () => {
  const { blob } = await archiveParts();
  const disposed = []; let count = 0;
  await assert.rejects(openProject(blob, noop, undefined, async () => { if (++count === 2) throw new Error('decode failed'); return photo('staged'); }, p => disposed.push(p.id)), /decode failed/);
  assert.deepEqual(disposed, ['staged']);
  const controller = new AbortController();
  await assert.rejects(openProject(blob, noop, controller.signal, async () => { controller.abort(); return photo('cancelled'); }, p => disposed.push(p.id)), /abort/i);
  assert.deepEqual(disposed, ['staged', 'cancelled']);
  await assert.rejects(openProject(blob, noop, undefined, async () => ({ ...photo('wrong-size'), width: 421 }), p => disposed.push(p.id)), /dimensions/);
  assert.equal(disposed.at(-1), 'wrong-size');
  await assert.rejects(saveProject(state(), [], noop, controller.signal), /abort/i);
});

test('saving snapshots controls before reading files and uses a portable project filename', async () => {
  const photos = [photo('one'), photo('two')], config = state(photos);
  const pending = saveProject(config, photos);
  config.adjustments.gamma = 2; photos[0].points[0].x = 30;
  const { project } = await readProject(await pending);
  assert.equal(project.adjustments.gamma, 1.15); assert.equal(project.photos[0].points[0].x, 20);
  assert.equal(projectFilename(' Vihreä / kukka?! '), 'Vihreä  kukka.liike');
  assert.equal(projectFilename('...'), 'Liike.liike');
});


test('version 2 projects migrate without inventing printed frame numbers', async()=>{
  const {files,document}=await archiveParts();
  document.version=2; document.settings.captureMode='frames'; document.settings.total=2;
  document.photos.forEach(p=>{p.registrationMode='frames';delete p.frameNumber;});
  document.sequence.manual=[];document.sequence.excluded=[];
  const result=await readProject(rewrite(files,document));
  assert.equal(result.project.version,4);
  assert.deepEqual(result.project.settings,document.settings);
  assert.ok(result.project.photos.every(p=>p.frameNumber===undefined));
});

test('project frame numbers accept partial work but reject invalid values', async()=>{
  const {files,document}=await archiveParts();
  document.photos[0].frameNumber=5;
  const result=await readProject(rewrite(files,document));
  assert.equal(result.project.photos[0].frameNumber,5);
  assert.equal(result.project.photos[1].frameNumber,undefined);
  for(const value of [null,0,-1,1.5,1000000,'5']) {
    document.photos[0].frameNumber=value;
    await assert.rejects(()=>readProject(rewrite(files,document)),/frame number/);
  }
});

test('older close-up projects adopt numeric order; explicit manual and current photo order are preserved', async()=>{
  const {files,document}=await archiveParts();
  document.settings.captureMode='frames';document.settings.total=2;
  document.photos.forEach((p,i)=>{p.registrationMode='frames';p.frameNumber=[5,2][i];});
  document.sequence.manual=[];document.sequence.excluded=[];
  document.version=3;document.sequence.order='Original';
  assert.equal((await readProject(rewrite(files,document))).project.sequence.order,'Frame number');
  document.sequence.order='Manual';
  assert.equal((await readProject(rewrite(files,document))).project.sequence.order,'Manual');
  document.version=4;document.sequence.order='Original';
  assert.equal((await readProject(rewrite(files,document))).project.sequence.order,'Original');
  document.sequence.order='Frame number';
  assert.equal((await readProject(rewrite(files,document))).project.sequence.order,'Frame number');
});
