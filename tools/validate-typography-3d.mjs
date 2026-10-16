import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseAst} from 'rolldown/parseAst';
import T from '../src/defs/nodes/type_studio.js';
import N from '../src/defs/nodes/inflate3d.js';
import {TYPE_STUDIO_STYLES} from '../src/defs/type-studio.js';
import {surfaceSource,surfaceTrack,surfaceSamples,surfaceCenters} from '../src/defs/2d3d-source.js';
import {EXAMPLES} from '../src/examples.js';
import {Pin,EMPTY} from '../src/defs/helpers.js';
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def])),base=defaults(N),ctx={W:594,H:420};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
let checks=0;
const records=[];
function geometry(input,patch={}){
  const p={...base,...patch},before=hash({input,p}),out=N.compute([input],p,ctx);
  assert.equal(hash({input,p}),before,'Immutable source paths and parameters');
  assert.ok(out[2]?.tri>0,'Valid mesh for '+JSON.stringify(patch));assert.ok(out[0].paths.length>0,'Visible drawing for '+JSON.stringify(patch));
  assert.ok(out[2].tri<=120000);assert.equal(out[2].v.length,out[2].tri*9);assert.equal(Math.max(...out[2].dims),1);
  assert.ok(out[2].v.every(x=>Number.isFinite(x)&&Math.abs(x)<=.5001));
  for(const ps of out.slice(0,2)){
    assert.ok(ps.paths.reduce((n,q)=>n+q.pts.length,0)<=90000);
    for(const q of ps.paths){assert.ok(q.pts.length>=2);for(const [x,y] of q.pts)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=p.margin-1e-6&&x<=ctx.W-p.margin+1e-6&&y>=p.margin-1e-6&&y<=ctx.H-p.margin+1e-6);}
  }
  checks++;return out;
}
for(const treatment of TYPE_STUDIO_STYLES){
  const input=T.compute([],{...defaults(T),mode:treatment,text:'No Signal',tracking:1.55},ctx);
  assert.ok(input.paths.length>0);
  const record={treatment,sourcePaths:input.paths.length,sourcePoints:input.paths.reduce((n,q)=>n+q.pts.length,0),results:{}};
  for(const mode of ['Tubes','Inflate','Extrude','Ink height']){
    const out=geometry(input,{mode,viewAz:2,viewEl:90});record.results[mode]={tri:out[2].tri,paths:out[0].paths.length};
  }
  const fine=geometry(input,{mode:'Tubes',diameter:.5,tubeStep:3,viewEl:65});
  assert.ok(fine[2].tri>=input.paths.length*12,'Small glyph strokes are not truncated to the first 256 paths');
  records.push(record);
}
// Exactly the reported screenshot, and frame-independent repeatability.
const reported=T.compute([],{...defaults(T),mode:'12 / Text made of text',text:'No Signal',tracking:1.55},ctx);
assert.ok(reported.paths.length>256);assert.equal(geometry(reported,{mode:'Tubes',diameter:6,viewAz:2,viewEl:90})[2].kind,'mesh');
const exact=geometry(reported,{mode:'Tubes',diameter:.5});assert.equal(hash(exact),hash(geometry(reported,{mode:'Tubes',diameter:.5})));
// A large sample step must not turn zigzag letters into straight chords.
const glyph={paths:[{pts:[[0,0],[1,0],[1,1],[2,1],[2,0]],closed:false,layer:0}]};
const source=surfaceSource(glyph),track=surfaceTrack(source.paths[0]),counts=surfaceSamples([track],20,8,true),points=surfaceCenters(track,counts[0]);
for(const q of source.paths[0].pts)assert.ok(points.some(p=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-10),'Every visible letter corner is retained');
const flatLine={paths:[{pts:[[0,0],[100,0]],closed:false,layer:0}]};
function solid(mesh,label){
  const edges=new Map();let volume=0;
  for(let i=0;i<mesh.v.length;i+=9){
    const [a,b,c]=[0,3,6].map(k=>mesh.v.slice(i+k,i+k+3));
    volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const A=p.join(','),B=q.join(','),k=A<B?A+'|'+B:B+'|'+A,e=edges.get(k)||[0,0];e[0]++;e[1]+=A<B?1:-1;edges.set(k,e);}
  }
  assert.ok(volume>0,label+' outward volume');assert.equal([...edges.values()].filter(([n,s])=>n!==2||s!==0).length,0,label+' closed opposite edge pairing');
}
for(const mode of ['Inflate','Extrude'])for(const back of ['Inflated','Flat']){
  const out=geometry(flatLine,{mode,inputShape:'Stroked paths',strokeWidth:6,depth:20,back});solid(out[2],mode+' '+back);
  assert.deepEqual(out[2].dims,[1,.06,.2],'Physical stroke width and depth relative to source span');
  const sheet=geometry(flatLine,{mode,inputShape:'Stroked paths',depth:0});assert.equal(sheet[2].dims[2],0,'Zero-depth strips are flat');
  assert.equal(N.compute([flatLine],{...base,mode,inputShape:'Closed outlines'},ctx)[2],null,'Closed outline mode deliberately ignores open strokes');
  const changed=geometry(flatLine,{mode,inputShape:'Stroked paths',strokeWidth:12,depth:20,back});assert.notEqual(hash(changed[2]),hash(out[2]),'Stroke width affects geometry');
}
for(const mode of ['Inflate','Extrude']){
  const a=geometry(glyph,{mode,inputShape:'Stroked paths',strokeWidth:.4,depth:8});
  assert.equal(hash(a[2]),hash(geometry(glyph,{mode,inputShape:'Auto',strokeWidth:.4,depth:8})[2]),'Auto recognizes open stroke lettering');
}
const a=geometry(flatLine,{mode:'Inflate',inputShape:'Stroked paths',roundness:.2}),b=geometry(flatLine,{mode:'Inflate',inputShape:'Stroked paths',roundness:2});assert.notEqual(hash(a[2]),hash(b[2]),'Roundness affects rounded strips');
// Collinear source re-tessellation does not add corners or alter tubes.
const subdivided={paths:[{...flatLine.paths[0],pts:Array.from({length:101},(_,i)=>[i,0])}]};
assert.equal(hash(geometry(flatLine,{mode:'Tubes'})[2]),hash(geometry(subdivided,{mode:'Tubes'})[2]));
// Both actual Help graphs run through the real evaluator, not only direct computes.
const defs={type_studio:T,inflate3d:N},app=fs.readFileSync('src/App.jsx','utf8'),ast=parseAst(app,{lang:'jsx'});
const names=['defIns','defOuts','numericParams','defaultFor','evalLevel'],functions=names.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return app.slice(n.start,n.end);}).join('\n');
const evaluate=Function('DEFS','EMPTY','SOLID_STYLE','Pin',functions+'\nreturn evalLevel;')(defs,EMPTY,{kind:'style',mode:'Solid'},Pin);
for(const example of EXAMPLES.filter(e=>['3D Typography · Text tubes','3D Typography · Extruded pen strokes'].includes(e.name))){const graph=example.make(key=>defaults(defs[key])),out=evaluate(graph,example.canvas).out;assert.ok(out[9002][2]?.tri>0&&out[9002][0].paths.length);checks++;}
console.log(JSON.stringify({checks,records},null,2));
console.log(`PASS: ${checks} typography → 3D cases; all ten Type Studio treatments, reported dense text, exact corners, complete sources, closed strip meshes, physical widths/depth, auto/closed interpretation, zero depth and real Help graphs.`);
