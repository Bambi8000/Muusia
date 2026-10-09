import test from 'node:test';
import assert from 'node:assert/strict';
import frameGrid from '../../src/defs/nodes/frame_grid.js';
import { detectMarkers } from '../src/detection.ts';
import { MARKERS, syntheticPhoto, renderSheet } from './synthetic-photo.mjs';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';
const settings = { ...REFERENCE_SETTINGS, markerStyle: 'outline' };
for (const markSize of [8, 15]) for (const rotation of [0, 90, 180, 270, 35]) {
  test(`actual outline paths: ${markSize} mm / ${rotation}° with perspective, noise and shading`, () => {
    const scene = syntheticPhoto({ markerStyle: 'outline', markSize, rotation });
    const result = detectMarkers(scene.raster, { ...settings, markSize });
    assert.equal(result.status, 'found', JSON.stringify(result));
    result.points.forEach((p, i) => {
      const actual = scene.toSheet(p), expected = MARKERS[i];
      assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < .5, `marker ${i}: ${JSON.stringify(actual)}`);
    });
  });
}
for (const holes of [0, 2]) test(`${holes} X anchors cannot silently assign orientation`, () => {
  const result = detectMarkers(syntheticPhoto({ markerStyle: 'outline', holes }).raster, settings);
  assert.equal(result.points, null, JSON.stringify(result));
});
test('mirrored outlines are rejected', () => {
  assert.equal(detectMarkers(syntheticPhoto({ markerStyle: 'outline', mirror: true }).raster, settings).status, 'mirrored');
});
test('marker-only output is six strokes; missing style preserves legacy geometry', () => {
  const params = Object.fromEntries(frameGrid.params.map(p => [p.key, p.def]));
  const p = {...params,total:1};
  const ctx = { W: 297, H: 210 };
  const legacy = frameGrid.compute([], p, ctx);
  const noStyle = {...p}; delete noStyle.markerStyle;
  assert.deepEqual(frameGrid.compute([],noStyle,ctx),legacy);
  const light = frameGrid.compute([], {...p,markerStyle:'Light outlines'},ctx);
  assert.equal(light.paths.length,6);
  assert.equal(light.paths.filter(p=>p.closed).length,4);
  const length = ps => ps.paths.reduce((sum,p)=>sum+p.pts.reduce((s,a,i)=>{const b=p.pts[(i+1)%p.pts.length];return s+(i<p.pts.length-1||p.closed?Math.hypot(a[0]-b[0],a[1]-b[1]):0)},0),0);
  assert.ok(length(light)<length(legacy)*.2);
  console.log(`Markers: ${legacy.paths.length} → ${light.paths.length} strokes; ${length(legacy).toFixed(1)} → ${length(light).toFixed(1)} mm.`);
});

for (const penWidth of [.3,.5]) for (const paperTone of ['light','dark']) test(`outlines: ${penWidth} mm pen on ${paperTone} paper under stronger lighting variation`, () => {
  const scene=syntheticPhoto({markerStyle:'outline',markSize:8,rotation:35,penWidth,vignette:.4,noise:10,perspective:[.3,-.16]});
  if(paperTone==='dark') for(let i=0;i<scene.raster.data.length;i+=4){const ink=255-scene.raster.data[i];scene.raster.data.set([10+ink*.9,12+ink*.95,18+ink*.25,255],i);}
  const result=detectMarkers(scene.raster,{...settings,markSize:8,paperTone});
  assert.equal(result.status,'found',JSON.stringify(result));
  result.points.forEach((p,i)=>{const actual=scene.toSheet(p);assert.ok(Math.hypot(actual.x-MARKERS[i].x,actual.y-MARKERS[i].y)<.5,JSON.stringify(actual));});
});
test('wrong style or marker size cannot produce automatic placement',()=>{
  const scene=syntheticPhoto({markerStyle:'outline'});
  assert.equal(detectMarkers(scene.raster,{...settings,markerStyle:'hatched'}).points,null);
  assert.equal(detectMarkers(scene.raster,{...settings,markSize:8}).points,null);
  assert.equal(detectMarkers(syntheticPhoto().raster,settings).points,null);
});

for (const paperTone of ['light','dark']) test(`subpixel faint 0.2 mm outline on ${paperTone} paper asks for manual placement`,()=>{
  const scene=syntheticPhoto({markerStyle:'outline',markSize:8,rotation:35,penWidth:.2,vignette:.4,noise:10,perspective:[.3,-.16]});
  if(paperTone==='dark') for(let i=0;i<scene.raster.data.length;i+=4){const ink=255-scene.raster.data[i];scene.raster.data.set([10+ink*.9,12+ink*.95,18+ink*.25,255],i);}
  const result=detectMarkers(scene.raster,{...settings,markSize:8,paperTone});
  assert.equal(result.points,null);assert.notEqual(result.status,'found');
});

for (const missing of ['edge','marker']) test(`missing ${missing} asks for manual placement`,()=>{
 const sheet=renderSheet({markerStyle:'outline'});
 const yEnd=missing==='edge'?14:29;
 for(let y=Math.floor(11*sheet.scale);y<yEnd*sheet.scale;y++)for(let x=Math.floor(268*sheet.scale);x<286*sheet.scale;x++)sheet.data.set([255,255,255,255],(y*sheet.width+x)*4);
 const result=detectMarkers(syntheticPhoto({sheetRaster:sheet}).raster,settings);
 assert.equal(result.points,null,JSON.stringify(result));
});
