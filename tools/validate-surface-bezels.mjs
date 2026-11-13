import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSurfaceSession,readSurfaceSession} from '../src/surface-session.js';
import {createStrip,stripTransform,clipPathsToStrip,paperBezelMatrix} from '../src/surface-composer.js';
import {createStripRasterizer,createContentPlacement} from '../src/surface-render.js';
import {resolveSurfaceContent,paperLocalPaths} from '../src/surface-content.js';
import {stripPrintRange} from '../src/surface-production.js';
import {surfaceVectorTiles} from '../src/surface-vector-export.js';
import {generateComposition} from '../src/surface-layouts.js';
const paper=a=>createStrip({id:'p',physicalWidthMm:80,printableWidthMm:60,printableOffsetMm:10,lengthMm:100,centerXmm:130,centerYmm:150,rotationDeg:a});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} vs ${b}`);
test('default and old sessions account for bezels; saved Off and each family survive roundtrip',()=>{
 const s=createSurfaceSession();assert.equal(s.accountForBezels,true);delete s.accountForBezels;assert.equal(readSurfaceSession(s).accountForBezels,true);
 for(const family of ['Sheets','Roll']){const c=generateComposition(createSurfaceSession(),family);c.accountForBezels=false;assert.equal(readSurfaceSession(JSON.parse(JSON.stringify(c))).accountForBezels,false);}
 for(const value of [0,'off',{}])assert.throws(()=>readSurfaceSession({...s,accountForBezels:value}));
});
test('On preserves analytic physical coordinates; Off maps whole width into asymmetric ink margins at any angle, keeping depth and metadata',()=>{
 for(const angle of [0,45,90,137]){
  const p=createStrip({...paper(angle),printableOffsetMm:7}),t=stripTransform(p),source={paths:[{pts:[[0,5,2],[80,95,4]].map(t.toGlobal),closed:false,layer:3,tag:'kept'}]};
  assert.deepEqual(clipPathsToStrip(source,p),clipPathsToStrip(source,p,{accountForBezels:true}));
  const out=clipPathsToStrip(source,p,{accountForBezels:false}).paths[0];near(out.pts[0][0],7);near(out.pts[0][1],5);near(out.pts[1][0],67);near(out.pts[1][1],95);assert.equal(out.layer,3);assert.equal(out.tag,'kept');near(out.pts[0][2],2);near(out.pts[1][2],4);
  const m=paperBezelMatrix(p,false);for(const u of [0,10,40,80]){const g=t.toGlobal([u,42]),want=t.toGlobal([7+.75*u,42]);near(m[0]*g[0]+m[2]*g[1]+m[4],want[0]);near(m[1]*g[0]+m[3]*g[1]+m[5],want[1]);}
 }
});
test('Off raster sampling and vector fitting agree; white margins stay white and block seams stay exact',()=>{
 const p=createStrip({...paper(0),centerXmm:40,centerYmm:50});const image={width:80,height:100,data:new Uint8ClampedArray(80*100*4)};
 for(let y=0;y<100;y++)for(let x=0;x<80;x++){const i=(y*80+x)*4;image.data[i]=x;image.data[i+1]=y;image.data[i+2]=0;image.data[i+3]=255;}
 const placement=createContentPlacement({sourceWidth:80,sourceHeight:100,widthMm:80,heightMm:100});
 const run=on=>createStripRasterizer(image,placement,{widthMm:80,heightMm:100,accountForBezels:on},p,{dotsPerMmX:1,area:'paper',interpolation:'nearest'});
 const on=run(true).renderBlock(0,1),off=run(false).renderBlock(0,1);assert.equal(on.data[10*4],10);assert.equal(off.data[10*4],0);assert.equal(off.data[69*4],79);
 for(const x of [0,9,70,79])assert.deepEqual([...off.data.slice(x*4,x*4+4)],[255,255,255,255]);
 const whole=run(false).renderBlock(0,100).data,a=run(false).renderBlock(0,37).data,b=run(false).renderBlock(37,63).data;assert.deepEqual(new Uint8ClampedArray([...a,...b]),whole);
 // Thermal device area differs from paper ink area; fit to ORIGINAL ink edges.
 const head={...p,printableOffsetMm:4.38775,printableWidthMm:72.448};const r=createStripRasterizer(image,placement,{widthMm:80,heightMm:100,accountForBezels:false},head,{dotsPerMmX:1,area:'paper',interpolation:'nearest',bezelPaper:p}).renderBlock(0,1);assert.equal(r.data[10*4],0);
});
test('independent and mapped resumed ranges retain original length/position; fitting never restarts at resume point',()=>{
 for(const mode of ['image-mapping','independent']){
  const p=createStrip({...paper(45),contentMode:mode}),s={...createSurfaceSession(),accountForBezels:false,strips:[p],selectedId:'p'};
  const localSource={paths:[{pts:[[0,0],[80,100]],layer:0,closed:false}]};const source=mode==='independent'?{forPaper:()=>({paths:localSource})}:{paths:{paths:localSource.paths.map(q=>({...q,pts:q.pts.map(stripTransform(p).toGlobal)}))}};
  const full=paperLocalPaths(source,s,p).paths[0],part=paperLocalPaths(source,s,p,25,75).paths[0];
  near(full.pts[0][0],10);near(full.pts[1][0],70);near(part.pts[0][0],25);near(part.pts[0][1],0);near(part.pts[1][0],55);near(part.pts[1][1],50);
  assert.equal(resolveSurfaceContent(source,s,p,25,75).frame.accountForBezels,false);
  assert.equal(stripPrintRange(p,25,75).lengthMm,50);
 }
});
test('freeform vector output uses the same bezel rule as PNG/thermal and leaves paper size fixed',()=>{
 const s=generateComposition(createSurfaceSession(),'Sheets',{sheetWidthMm:80,sheetHeightMm:100,columns:1,rows:1});s.mode='freeform';s.strips=[createStrip({...paper(0),centerXmm:40,centerYmm:50})];s.selectedId='p';
 const ps={paths:[{pts:[[0,10],[80,90]],closed:false,layer:0}]};const services={sliceMega:()=>[{paths:[]}],sliceRoll:()=>[{paths:[]}],fontStrokes:()=>({strokes:[]})};
 s.composition.settings.labels=false;s.composition.settings.marks=false;
 const tiles=surfaceVectorTiles({...s,accountForBezels:false},ps,services);assert.equal(tiles[0].W,80);assert.equal(tiles[0].H,100);near(tiles[0].paths[0].pts[0][0],10);near(tiles[0].paths[0].pts[1][0],70);
});
