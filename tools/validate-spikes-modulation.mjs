import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseAst} from 'rolldown/parseAst';
import * as helpers from '../src/defs/helpers.js';
import N from '../src/defs/nodes/spikes3d.js';
import Frame from '../src/defs/nodes/frame.js';
import Blob from '../src/defs/nodes/blobmesh.js';
import {EXAMPLES} from '../src/examples.js';
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def])),base=defaults(N),ctx={W:420,H:594};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Published v2.125 defaults and output fingerprints, captured from its real
// implementation/helpers. No Git history is needed when running the validator.
const publishedParams={"body":"Capsule","file":"","width":34,"tube":35,"size":145,"count":1400,"mode":"Lines","length":34,"variation":0.75,"spread":16,"diameter":1.2,"normals":"Outward (closed mesh)","smooth":true,"viewAz":25,"viewEl":12,"occlusion":true,"detail":384,"host":"None","hostPen":1,"margin":12,"seed":41,"layer":0};
const publishedHashes={
  "Capsule/Lines": "be5777594f2183fdd72205fdd7015774f90e5128685e612e6c889cd3528f0c80",
  "Capsule/Spikes": "29fe02b2c84de5ce1fc91e9fb8c82d5c6671a1ed57624b3d8a58fec2b69490da",
  "Capsule/Straws": "adabfc6eb84d1c5d0676f917d8c97700d3b4407689e14eaf5cffa89eafca300e",
  "Sphere/Lines": "9604a522d5629aef62834eefb52aaa980e6c763e87ee33c8e2a814eb6816b1d1",
  "Sphere/Spikes": "95de25da5192df4b467519798db5697ef428489fd8c219b3868d28321b33fa44",
  "Sphere/Straws": "6d34b8855364f1cf0dcaffbbfe46179e28aedf6d0d1e58a556472863c76ee25e",
  "Torus/Lines": "d0b2fdd98219d4a35cbfaa0ce64e3550cec42613bda2e31859564d4b364a68ef",
  "Torus/Spikes": "6031e0d310dd0aa97b0d91447b235b725b2db57aad12979a225742a0df41da39",
  "Torus/Straws": "7ebbbb1de86dda9bec9ed49fbb55c0ab7496f474cc6068924ba03bbfb26271fd",
  "Cube/Lines": "d50c977d8e85a0185b0818dfefa45ab92889035668925762e3e4ca82b3887ec1",
  "Cube/Spikes": "b1e357c411e63fdba14e356b0352c4b44d23394861b02b3d3bf756fe126fde49",
  "Cube/Straws": "0442f6d38889ed441ec77e8b26dc8e58449b7159a7fb15fb7f3a2e1c9e6831e8"
};
let checks=0;
function run(patch={},clock={},ins=[],node={}){
 const p={...base,count:120,detail:128,...patch},c={...ctx,frameCount:24,frameIdx:0,...clock},before=JSON.stringify({p,c,ins,node}),out=N.compute(ins,p,c,node);
 assert.equal(JSON.stringify({p,c,ins,node}),before,'Immutable inputs/clock');assert.equal(hash(out),hash(N.compute(ins,p,c,node)),'Repeatable scrubbing');
 assert.ok(out.paths.reduce((n,p)=>n+p.pts.length,0)<=115000);const m=Math.min(p.margin,Math.min(c.W,c.H)/2-.001);
 for(const p of out.paths){assert.ok(p.pts.length>=2);assert.ok(Number.isInteger(p.layer)&&p.layer>=0&&p.layer<=11);for(const q of p.pts){assert.equal(q.length,2);assert.ok(q.every(Number.isFinite));assert.ok(q[0]>=m-1e-6&&q[0]<=c.W-m+1e-6&&q[1]>=m-1e-6&&q[1]<=c.H-m+1e-6);}}
 checks++;return out;
}
for(const body of ['Capsule','Sphere','Torus','Cube'])for(const mode of ['Lines','Spikes','Straws']){
 const p={...publishedParams,body,mode,count:90,detail:128},legacyHash=publishedHashes[body+'/'+mode];
 assert.equal(hash(N.compute([],p,ctx)),legacyHash,'Missing new saved params preserve original '+body+'/'+mode);
 assert.equal(hash(N.compute([],{...p,...Object.fromEntries(N.params.filter(d=>d.key.startsWith('mod')&&d.key!=='mode'||d.key==='pulseWidth').map(d=>[d.key,d.def]))},ctx)),legacyHash,'New Off defaults preserve old coat');checks++;
 for(const modulation of ['Wave','Noise','Pulse']){
  const q={body,mode,modulation,modDepth:85,modMotion:'Manual'};
  assert.notEqual(hash(run(q)),hash(run({...q,modPhase:110})),'Phase changes spatial lengths');
  assert.equal(hash(run(q)),hash(run({...q,modPhase:360})),'Exact phase wrap');
  assert.equal(hash(run({...q,modDepth:0,modPhase:85,modMotion:'Timeline',modCycles:8,pulseWidth:5,modSize:5,modAxis:'X'})),hash(run({...q,modulation:'Off'})),'Depth zero equals Off, including framing');
 }
}
for(const modulation of ['Wave','Noise','Pulse']){
 const p={modulation,modDepth:90,modMotion:'Timeline',count:75},first=run(p,{frameIdx:0});
 for(const frameIdx of [8,1,19,4,0]){const timeline=run(p,{frameIdx}),manual=run({...p,modMotion:'Manual',modPhase:frameIdx/24*360},{frameIdx:0});assert.equal(hash(timeline),hash(manual),'Timeline matches manual phase');}
 assert.equal(hash(first),hash(run(p,{frameIdx:0})),'Scrubbing returns exactly');
 assert.equal(hash(run({...p,modCycles:2},{frameIdx:3})),hash(run({...p,modCycles:1},{frameIdx:6})),'Two complete cycles');
 assert.equal(hash(run({...p,modCycles:2},{frameIdx:0})),hash(run({...p,modCycles:2},{frameIdx:12})),'Integer loop repeats halfway');
 assert.equal(hash(run({...p,modMotion:'Manual'},{frameIdx:0})),hash(run({...p,modMotion:'Manual'},{frameIdx:8})),'Manual ignores timeline');
}
// No occlusion/fit shrink: every stroke keeps the same root at every phase,
// its vector keeps the same direction, and length never exceeds static length.
for(const mode of ['Lines','Spikes','Straws']){
 const p={body:'Sphere',size:95,length:35,variation:.3,spread:8,mode,count:60,occlusion:false,modulation:'Wave',modDepth:90},off=run({...p,modulation:'Off'});
 for(const modulation of ['Wave','Noise','Pulse'])for(const phase of [0,70,180]){
  const out=run({...p,modulation,modPhase:phase});assert.equal(out.paths.length,off.paths.length,'Stable primitive population with nonzero floor');
  for(let i=0;i<out.paths.length;i++){
   // Lines: roots; cones: all ring starts; straws: base starts/axis endpoints.
   if(mode!=='Straws'||i%3!==2)assert.deepEqual(out.paths[i].pts[0],off.paths[i].pts[0],'Stable roots/base and framing');
   if(mode==='Lines'){const a=out.paths[i].pts,b=off.paths[i].pts,u=a[1].map((x,k)=>x-a[0][k]),v=b[1].map((x,k)=>x-b[0][k]);assert.ok(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-7,'Direction unchanged');assert.ok(Math.hypot(...u)<=Math.hypot(...v)+1e-7);}
  }
 }
}
// A spatial field must produce several simultaneous length factors, rather
// than merely scaling every spike by one animated global value.
const spatialBase={body:'Sphere',size:100,count:90,length:30,variation:0,spread:0,occlusion:false,modAxis:'X',modDepth:80};
const spatialOff=run({...spatialBase,modulation:'Off'});
for(const modulation of ['Wave','Noise','Pulse']){
 const q=run({...spatialBase,modulation});const factors=q.paths.map((p,i)=>Math.hypot(p.pts[1][0]-p.pts[0][0],p.pts[1][1]-p.pts[0][1])/Math.hypot(spatialOff.paths[i].pts[1][0]-spatialOff.paths[i].pts[0][0],spatialOff.paths[i].pts[1][1]-spatialOff.paths[i].pts[0][1]));
 assert.ok(new Set(factors.map(f=>Math.round(f*1000))).size>5,'Per-root spatial modulation '+modulation);
}
const beforeWrap=run({...spatialBase,modulation:'Noise',modPhase:359.99}),afterWrap=run({...spatialBase,modulation:'Noise',modPhase:0});
for(let i=0;i<beforeWrap.paths.length;i++)for(let k=0;k<2;k++)assert.ok(Math.abs(beforeWrap.paths[i].pts[1][k]-afterWrap.paths[i].pts[1][k])<.1,'Noise is continuous across loop boundary');
// Tight paper must use one full-coat fit through the complete loop, including
// pulse troughs. Compare static visible host paths exactly, on their own pen.
for(const mode of ['Lines','Spikes','Straws']){
 const p={mode,size:300,length:130,count:100,host:'Wireframe',hostPen:4,layer:0,occlusion:false,modulation:'Pulse',modDepth:100,pulseWidth:5};
 const host=run({...p,modPhase:0},{W:140,H:100}).paths.filter(p=>p.layer===4);
 for(const modPhase of [45,90,180,270])assert.equal(hash(run({...p,modPhase},{W:140,H:100}).paths.filter(p=>p.layer===4)),hash(host),'Host stays fixed with zero-length spikes');
}
const mesh=Blob.compute([],{...defaults(Blob),balls:2,rings:12,segs:16,radZ:100},ctx)[2];
for(const modulation of ['Wave','Noise','Pulse'])for(const body of ['Wired mesh','Imported STL'])run({modulation,body,modMotion:'Timeline'}, {frameIdx:7},body==='Wired mesh'?[mesh]:[],body==='Imported STL'?{data:{svg:mesh}}:{});
for(const patch of [{modDepth:NaN,modSize:NaN,modPhase:NaN,modCycles:NaN,pulseWidth:NaN},{modDepth:-30,modSize:-20,modPhase:-1e9},{modDepth:200,modSize:.001,modPhase:Infinity,modCycles:100,pulseWidth:0}])run({modulation:'Pulse',...patch},{frameIdx:NaN,frameCount:Infinity});
for(const modulation of ['Wave','Noise','Pulse']){
 const q={modulation};for(const patch of [{modDepth:30},{modSize:20},{modAxis:'X'}])assert.notEqual(hash(run(q)),hash(run({...q,...patch})),'Meaningful sculpt controls');
}
assert.notEqual(hash(run({modulation:'Pulse',pulseWidth:10})),hash(run({modulation:'Pulse',pulseWidth:80})),'Pulse width');
for(const patch of [{count:0},{length:0},{modulation:'Off'},{modDepth:0}]){
 const p={...base,...patch};for(const d of N.params.filter(d=>d.showIf&&!d.showIf(p)&&d.key.startsWith('mod')&&d.key!=='mode')){const v=d.options?.at(-1)??d.max;assert.equal(hash(N.compute([],{...p,[d.key]:v},ctx)),hash(N.compute([],p,ctx)),'Hidden control '+d.key);checks++;}
}
// Actual app evaluator: Frame rot output -> phase, plus automatic Timeline.
const defs={spikes3d:N,frame:Frame},source=await fs.readFile('src/App.jsx','utf8'),ast=parseAst(source,{lang:'jsx'});
const funcs=['defIns','defOuts','numericParams','defaultFor','evalLevel'].map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);}).join('\n');
const evaluate=Function('DEFS','EMPTY','SOLID_STYLE','Pin',funcs+'\nreturn evalLevel;')(defs,helpers.EMPTY,{kind:'style',mode:'Solid'},helpers.Pin);
const ex=EXAMPLES.find(e=>e.name==='3D Spikes · Travelling lengths');assert.ok(ex);const graph=ex.make(k=>defaults(defs[k]));
for(const frameIdx of [0,6,12,18,23,0]){const c={...ex.canvas,frameIdx,frameCount:24},r=evaluate(graph,c);assert.equal(r.pvals[9002].modPhase,frameIdx/24*360);assert.ok(r.out[9002][0].paths.length);const p={...graph.nodes[1].params,modMotion:'Timeline',modPhase:0};assert.equal(hash(r.out[9002][0]),hash(N.compute([],p,c)),'Wired phase and automatic timeline agree');checks++;}
for(const mode of ['Lines','Spikes','Straws'])run({mode,modulation:'Noise',modDepth:100,count:5000,length:1000,diameter:100,occlusion:false},{W:420,H:594});
run({mode:'Straws',modulation:'Wave',count:500},ctx,[null,{kind:'style',mode:'Dashed',dash:.5,gap:.5,seed:3}]);
console.log(`PASS: ${checks} modulation cases; published default compatibility, spatial modes, exact loops, Frame/Timeline equivalence, fixed roots/framing, zero troughs, mesh/STL, finite bounds and work budgets.`);
