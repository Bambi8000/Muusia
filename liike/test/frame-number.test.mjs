import test from 'node:test';
import assert from 'node:assert/strict';
import { photoLabel, frameLabel, frameNumberIssue, sortByFrameNumber } from '../src/frame-number.ts';
import { DEFAULTS } from '../src/layout.ts';
import { planFrames } from '../src/frames.ts';
import { buildExportPlan, exportManifest, DEFAULT_EXPORT } from '../src/export-plan.ts';
import { INITIAL_SEQUENCE } from '../src/sequence.ts';

const photo = (id, frameNumber) => ({ id, frameNumber, width: 840, height: 740, registrationMode: 'frames', points: [{x:0,y:0},{x:840,y:0},{x:840,y:737},{x:0,y:737}] });
const settings = {...DEFAULTS,captureMode:'frames',total:2,crop:'Full cell',trim:1,clearance:3};

test('an unnumbered first photo is never presented as a recognized frame 1', () => {
  const unknown=photo('unknown');
  assert.equal(photoLabel(unknown,0,'frames'),'Photo 1 · number not set');
  const frame=planFrames({...settings,total:1},[unknown],2160)[0].frames[0];
  assert.equal(frameLabel(frame),'Photo 1');
  const manifest=exportManifest(buildExportPlan([frame],INITIAL_SEQUENCE,DEFAULT_EXPORT));
  assert.equal(manifest.frames[0].sourceFrame,null);
  assert.equal(manifest.frames[0].sourcePhoto,1);
});

test('printed frame 5 keeps its identity through photo sorting, manual playback and export', () => {
  const photos=[photo('five',5),photo('two',2)];
  const before=planFrames(settings,photos,2160).flatMap(p=>p.frames);
  assert.equal(frameLabel(before[0]),'Frame 5');
  assert.equal(photoLabel(photos[0],0,'frames'),'Frame 5 · Photo 1');
  const sorted=sortByFrameNumber(photos);
  assert.deepEqual(sorted.map(p=>p.id),['two','five']);
  assert.deepEqual(photos.map(p=>p.id),['five','two']);
  assert.equal(sorted[1],photos[0]);
  const after=planFrames(settings,sorted,2160).flatMap(p=>p.frames);
  assert.deepEqual(after.map(f=>[f.id,f.frameNumber]),[['two:0',2],['five:0',5]]);
  assert.deepEqual(after[1].crop,before[0].crop);
  const sequence={...INITIAL_SEQUENCE,order:'Manual',manual:['five:0','two:0'],excluded:['two:0']};
  const manifest=exportManifest(buildExportPlan(after,sequence,DEFAULT_EXPORT));
  assert.deepEqual(manifest.frames.map(f=>[f.sourceFrame,f.sourcePhoto]),[[5,2]]);
});

test('number sorting rejects missing, invalid and duplicate numbers without changing photos', () => {
  for(const values of [[undefined,2],[0,2],[1.5,2],[1000000,2],[5,5]]) {
    const photos=values.map((n,i)=>photo(String(i),n)), original=structuredClone(photos);
    assert.ok(frameNumberIssue(photos));
    assert.throws(()=>sortByFrameNumber(photos),/number/);
    assert.deepEqual(photos,original);
  }
  assert.equal(frameNumberIssue([photo('a',5),photo('b',12)]),'');
  assert.equal(photoLabel(photo('a',5),0,'sheet'),'Sheet 1');
  assert.equal(frameLabel({frame:4,sheet:0,captureMode:'sheet',frameNumber:9}),'Source frame 5');
});

test('number-order exports cannot silently use missing or duplicate labels; exclusions and manual order remain usable', async()=>{
  const { sequenceOrderIssue }=await import('../src/sequence.ts');
  const sources=[photo('five',5),photo('unknown')];
  const frames=planFrames(settings,sources,2160).flatMap(p=>p.frames);
  const sequence={...INITIAL_SEQUENCE,order:'Frame number'};
  assert.match(sequenceOrderIssue(frames,sequence),/Set the number/);
  assert.throws(()=>buildExportPlan(frames,sequence,DEFAULT_EXPORT),/Set the number/);
  const included={...sequence,excluded:['unknown:0']};
  assert.equal(buildExportPlan(frames,included,DEFAULT_EXPORT).frames.length,1);
  const duplicate=[frames[0],{...frames[1],frameNumber:5}];
  assert.throws(()=>buildExportPlan(duplicate,sequence,DEFAULT_EXPORT),/more than once/);
  assert.equal(buildExportPlan(frames,{...sequence,order:'Original'},DEFAULT_EXPORT).frames.length,2);
  assert.equal(buildExportPlan(frames,{...sequence,order:'Manual'},DEFAULT_EXPORT).frames.length,2);
});
