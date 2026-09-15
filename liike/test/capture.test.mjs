import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, buildLayout, validateSettings } from '../src/layout.ts';
import { photoGeometry, photoTransform, photoForMode, framesForPhoto, requiredPhotos } from '../src/capture.ts';
import { planFrames } from '../src/frames.ts';
import { sampleRect } from '../src/sampling.ts';
import { buildExportPlan, exportManifest, DEFAULT_EXPORT } from '../src/export-plan.ts';
import { INITIAL_SEQUENCE } from '../src/sequence.ts';
import { estimatePaper } from '../src/adjustments.ts';

const settings = { ...DEFAULTS, captureMode: 'frames', clearance: 3, trim: 1, crop: 'Full cell', total: 2 };
function photo(id, scale, dx = 0, dy = 0) {
  return { id, width: 1000, height: 900, registrationMode: 'frames', points: [{x:0,y:0},{x:84,y:0},{x:84,y:73+2/3},{x:0,y:73+2/3}].map(p => ({x:p.x*scale+dx,y:p.y*scale+dy})) };
}

test('close-up layout separates plot clearance, cell border trim and frame-window aspect', () => {
  const { W, H, cells: [cell] } = photoGeometry(settings);
  assert.equal(W, 84); assert.ok(Math.abs(H - 73 - 2 / 3) < 1e-10);
  assert.deepEqual(cell.cell, {x:0,y:0,w:W,h:H});
  assert.equal(cell.crop.x, 1); assert.equal(cell.crop.y, 1); assert.equal(cell.crop.w, 82); assert.equal(cell.crop.h, H - 2);
  assert.ok(Math.abs(cell.window.w - 78) < 1e-10);
  assert.ok(Math.abs(cell.window.h - 78 * 297 / 420) < 1e-10);
  const frameWindow = photoGeometry({...settings, crop:'Frame window'}).cells[0];
  assert.deepEqual(frameWindow.crop, frameWindow.window);
  assert.equal(requiredPhotos(settings), 2); assert.equal(buildLayout(settings).sheets, 1);
  for (const values of [{clearance:NaN},{trim:-1},{clearance:11},{cols:6,rows:6,margin:70,clearance:10},{captureMode:'unknown'}]) assert.ok(validateSettings({...settings,...values}).length);
});

test('one photo yields one identically scaled frame; photo order overrides sheet traversal', () => {
  const photos = [photo('first', 7, 55, 40), photo('second', 9, 120, 70), {...photo('extra',1),points:[null,null,null,null]}];
  const plan = planFrames({...settings,order:'Boustrophedon'}, photos, 2160);
  assert.deepEqual(plan.map(p=>p.frames.map(f=>[f.id,f.frame,f.cell,f.width,f.height])), [[['first:0',0,0,2160,1888]],[['second:0',1,0,2160,1888]]]);
  assert.deepEqual(plan[0].frames[0].crop, plan[1].frames[0].crop);
  const manifest = exportManifest(buildExportPlan(plan.flatMap(p=>p.frames), {...INITIAL_SEQUENCE,order:'Reverse'}, DEFAULT_EXPORT));
  assert.deepEqual(manifest.frames.map(f=>[f.captureMode,f.sourcePhoto,f.sourceFrame]),[['frames',2,null],['frames',1,null]]);
  assert.ok(manifest.frames.every(f=>!('sheet' in f)));
  const reverse = planFrames(settings,[photos[1],photos[0]],2160);
  assert.deepEqual(reverse.map(p=>p.frames[0].id),['second:0','first:0']);
  assert.deepEqual(framesForPhoto(settings,2),[]);
  assert.throws(()=>planFrames({...settings,total:3},photos,2160), /Photo 3.*place all four/);
  assert.throws(()=>planFrames(settings,photos.slice(0,1),2160), /Add 1 more frame/);
});

test('capture-mode changes cannot reinterpret old marker positions', () => {
  const one = {...photo('one',1),registrationMode:'sheet'}, original = structuredClone(one.points);
  assert.throws(()=>planFrames({...settings,total:1},[one],1080), /capture mode/);
  const view = photoForMode(one,settings);
  assert.deepEqual(view.points,[null,null,null,null]); assert.deepEqual(one.points,original);
  assert.equal(photoForMode(one,DEFAULTS),one);
  const crossing = {...photo('one',1), points:[original[0],original[2],original[1],original[3]]};
  assert.throws(()=>photoTransform(settings,crossing.points),/corners/);
});

test('different close-up distances sample the same physical crop without content-based recentering', () => {
  const raster = scale => {
    const width = 84 * scale, height = Math.round((73+2/3)*scale), data = new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([(x+.5)/scale*2,(y+.5)/scale*2,80,255],(y*width+x)*4);
    return {width,height,data};
  };
  const small = raster(6), large = raster(9), crop = photoGeometry(settings).cells[0].crop;
  const a = sampleRect(small,small,photoTransform(settings,photo('a',6).points),crop,164,143);
  const b = sampleRect(large,large,photoTransform(settings,photo('b',9).points),crop,164,143);
  for(let i=0;i<a.data.length;i++)assert.ok(Math.abs(a.data[i]-b.data[i])<=1);
});

for(const dark of [false,true]) test(`close-up paper references exclude artwork and keep shared contrast (${dark?'dark':'light'})`,()=>{
  const config={...settings,paperTone:dark?'dark':'light'};
  const width=504,height=442;
  const scene = dense => {
    const data=new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const drawing=x>35&&x<width-35&&y>35&&y<height-35&&(dense || x%25<4);
      const level=dark?25+x/width*15:210+x/width*25;
      data.set(drawing?(dark?[160,220,90,255]:[35,40,40,255]):[level,level,level,255],(y*width+x)*4);
    }
    return {width,height,data};
  };
  const h=photoTransform(config,photo('a',6).points),a=scene(false),b=scene(true);
  const modelA=estimatePaper(a,a,h,config),modelB=estimatePaper(b,b,h,config);
  assert.equal(modelA.supported,true); assert.equal(modelB.supported,true);
  assert.deepEqual(modelA.paper,modelB.paper); assert.deepEqual(modelA.coefficients,modelB.coefficients);
  assert.deepEqual(modelA.autoLevels,modelB.autoLevels);
  assert.deepEqual(modelA.autoLevels,dark?{black:10,white:255}:{black:0,white:245});
  assert.equal(estimatePaper(a,a,h,{...config,clearance:0}).supported,false);
});
