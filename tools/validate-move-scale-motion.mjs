import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseAst} from 'rolldown/parseAst';
import N from '../src/defs/nodes/move_scale.js';
import Disc from '../src/defs/nodes/moire_disc.js';
import Merge from '../src/defs/nodes/merge.js';
import Frame from '../src/defs/nodes/frame.js';
import {EXAMPLES} from '../src/examples.js';
import {Pin,EMPTY} from '../src/defs/helpers.js';
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def])),base=defaults(N),canvas={W:297,H:210};
const source={paths:[{pts:[[4,7],[14,7],[14,12]],closed:true,layer:3},{pts:[[3,20],[12,25]],closed:false,layer:7}]};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);
const nearPaths=(a,b)=>{assert.equal(a.paths.length,b.paths.length);a.paths.forEach((q,i)=>q.pts.forEach((v,j)=>v.forEach((n,k)=>near(n,b.paths[i].pts[j][k]))));};
let checks=0;
function run(patch={},clock={},src=source){
 const p={...base,...patch},ctx={...canvas,frameCount:48,frameIdx:0,...clock},before=JSON.stringify({src,p,ctx});
 const out=N.compute([src],p,ctx),guides=N.overlay(p,ctx,[src]);
 assert.equal(JSON.stringify({src,p,ctx}),before);assert.equal(hash(out),hash(N.compute([src],p,ctx)));
 assert.equal(out.paths.length,src.paths.length);assert.deepEqual(out.paths.map(q=>[q.pts.length,q.closed,q.layer]),src.paths.map(q=>[q.pts.length,q.closed,q.layer]));
 for(const q of out.paths)assert.ok(q.pts.flat().every(Number.isFinite));
 for(const q of guides)assert.ok((q.pts?.flat()||[q.x,q.y]).every(Number.isFinite));
 checks++;return out;
}
// Actual v2.128 results captured before editing, across every legacy origin
// and independent/uniform scale. New animation controls default to Off.
const legacy=[
 ['Content center',0,'bcb5f0bd2a715f84b5a649ecd8308577f7cdd26a28dd7f75ed7035ddc986a6ac'],
 ['Content center',175,'c4e3ee2d7283f241d8bf019b0d580f959df3e07f01fecdf503b2823e4a705b73'],
 ['Canvas center',0,'83743b5c7dc13af3aa3014da9acf98ebbf6c788b83b0bc4fc3a29c1de385e96d'],
 ['Canvas center',175,'2cc2b7163cc6a66571cb53a0039d71c5c2aba19f2faf3da32e46df089a26c567'],
 ['Custom point',0,'0fc4b49480abd6ca2c21c74921c5152a6d62de6e6f0e5b6dfcaa0ccc098f521b'],
 ['Custom point',175,'530ad758362534de02d446cb7af9660af16aed51f4a7957f1354dc49850b55c7'],
];
for(const [origin,scaleY,expected] of legacy){
 const p={...base,origin,scale:65,scaleY,dx:13,dy:-4,ox:11,oy:12};
 assert.equal(hash(run(p)),expected);for(const key of ['motion','clock','travelX','travelY','scaleSwing','cycles','phase'])delete p[key];
 assert.equal(hash(N.compute([source],p,canvas)),expected,'Old saved params stay identical');checks++;
}
const off=run();
for(const motion of ['Sway','Orbit','Breathe']){
 assert.equal(hash(run({motion,travelX:0,travelY:0,scaleSwing:0})),hash(off),'Zero amplitudes equal static transform');
 for(const frameIdx of [0,6,12,24,36,47,4,0]){
  const a=run({motion,cycles:2,phase:17},{frameIdx});
  const b=run({motion,clock:'Manual',phase:17+frameIdx/48*720},{frameIdx:0});nearPaths(a,b);
 }
 assert.equal(hash(run({motion,clock:'Manual',phase:90},{frameIdx:0})),hash(run({motion,clock:'Manual',phase:90},{frameIdx:31})));
 assert.equal(hash(run({motion,phase:0})),hash(run({motion,phase:360})),'Exact phase wrap');
 assert.equal(hash(run({motion,cycles:2},{frameIdx:0})),hash(run({motion,cycles:2},{frameIdx:24})),'Two loops repeat halfway');
 assert.notEqual(hash(run({motion},{frameIdx:0})),hash(run({motion},{frameIdx:12})),'Geometry actually moves');
 // Last-to-first is a regular sampling step, not a duplicated end frame.
 const last=run({motion},{frameIdx:47}),first=run({motion},{frameIdx:0}),next=run({motion},{frameIdx:1});
 const distance=(a,b)=>Math.hypot(...a.paths[0].pts[0].map((v,k)=>v-b.paths[0].pts[0][k]));
 assert.ok(distance(last,first)>0);assert.ok(distance(last,first)<distance(first,next)*1.3+1e-8);
 for(const patch of [{phase:NaN,travelX:Infinity,travelY:NaN,cycles:NaN,scaleSwing:NaN},{phase:-1e9,cycles:99,travelX:-20,scaleSwing:200}])run({motion,...patch},{frameCount:NaN,frameIdx:Infinity});
}
// Analytic translations at the four quarter phases; no fitting or clipping.
for(const motion of ['Sway','Orbit'])for(const [phase,sin,cos] of [[0,0,1],[90,1,0],[180,0,-1],[270,-1,0]]){
 const a=run({motion,clock:'Manual',phase,travelX:3,travelY:2,scaleSwing:0});
 a.paths.forEach((q,i)=>q.pts.forEach((pt,j)=>{near(pt[0]-source.paths[i].pts[j][0],3*(motion==='Orbit'?cos:sin));near(pt[1]-source.paths[i].pts[j][1],2*sin);}));
}
// Breathe scales around the chosen anchor, preserving nonuniform scale ratio.
const a=run({motion:'Breathe',clock:'Manual',phase:90,scale:80,scaleY:40,scaleSwing:25,origin:'Custom point',ox:0,oy:0});
a.paths.forEach((q,i)=>q.pts.forEach((v,j)=>{near(v[0],source.paths[i].pts[j][0]);near(v[1],source.paths[i].pts[j][1]*.5);}));
// Hidden controls must be inert, including their guides.
for(const p of [{...base},{...base,motion:'Breathe',phase:60},{...base,motion:'Orbit',clock:'Manual',phase:60}])for(const d of N.params.filter(d=>d.showIf&&!d.showIf(p))){
 const ctx={...canvas,frameCount:48,frameIdx:8},changed={...p,[d.key]:d.max??d.options?.at(-1)};
 assert.equal(hash(N.compute([source],p,ctx)),hash(N.compute([source],changed,ctx)),'Hidden '+d.key);
 assert.equal(hash(N.overlay(p,ctx,[source])),hash(N.overlay(changed,ctx,[source])),'Hidden guide '+d.key);checks++;
}
for(const key of ['travelX','travelY','scaleSwing','cycles','phase','clock']){
 const p={motion:'Orbit',phase:33},d=N.params.find(d=>d.key===key);
 assert.notEqual(hash(run(p,{frameIdx:7})),hash(run({...p,[key]:d.max??'Manual'},{frameIdx:7})),'Meaningful '+key);
}
const custom={paths:[{...source.paths[0],__stop:{mode:'Pause',msg:'refill'},custom:'kept'}]};assert.deepEqual(run({motion:'Orbit'}, {},custom).paths[0].__stop,custom.paths[0].__stop);
assert.deepEqual(N.compute([],base,canvas),EMPTY);assert.deepEqual(N.compute([{paths:[{pts:[]}]}],base,canvas),EMPTY);
// Actual app evaluator, including numeric Phase input and Merge output.
const defs={move_scale:N,moire_disc:Disc,merge:Merge,frame:Frame},app=fs.readFileSync('src/App.jsx','utf8'),ast=parseAst(app,{lang:'jsx'});
const functions=['defIns','defOuts','numericParams','defaultFor','evalLevel'].map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return app.slice(n.start,n.end);}).join('\n');
const evaluate=Function('DEFS','EMPTY','SOLID_STYLE','Pin',functions+'\nreturn evalLevel;')(defs,EMPTY,{kind:'style',mode:'Solid'},Pin);
for(const ex of EXAMPLES.filter(e=>e.name.startsWith('Move / Scale · Moire'))){
 const graph=ex.make(key=>defaults(defs[key])),last=graph.nodes.at(-1).id,initial=hash(evaluate(graph,{...ex.canvas,frameCount:48,frameIdx:0}).out[last][0]);
 for(const frameIdx of [0,5,12,24,36,47,0]){
  const out=evaluate(graph,{...ex.canvas,frameCount:48,frameIdx}).out[last][0];assert.ok(out.paths.length>0);
  for(const q of out.paths)for(const [x,y] of q.pts)assert.ok(x>12&&x<ex.canvas.W-12&&y>12&&y<ex.canvas.H-12,'Example keeps motion inside A4 margins');
  if(frameIdx===0)assert.equal(hash(out),initial);if(frameIdx===12)assert.notEqual(hash(out),initial);checks++;
 }
}
const graph={nodes:[{id:1,type:'frame',params:defaults(Frame)},{id:2,type:'moire_disc',params:defaults(Disc)},{id:3,type:'move_scale',params:{...base,motion:'Orbit',clock:'Manual'}}],edges:[{from:2,to:3,fromPort:0,toPort:0},{from:1,to:3,fromPort:4,toPort:'p:phase'}]};
for(const frameIdx of [0,6,12,23]){const ctx={...canvas,frameCount:24,frameIdx},r=evaluate(graph,ctx);near(r.pvals[3].phase,frameIdx/24*360);nearPaths(r.out[3][0],N.compute([r.out[2][0]],{...graph.nodes[2].params,phase:frameIdx/24*360},ctx));checks++;}
console.log(`PASS: ${checks} Move / Scale motion cases; legacy hashes, exact amplitudes/anchors, looping clocks, ratio-preserving scale, inactive controls, metadata, real moire graphs and Frame phase wiring.`);
