import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {parseAst} from 'rolldown/parseAst';
import O from '../src/defs/nodes/organicrings.js';
import T from '../src/defs/nodes/torn.js';
import N from '../src/defs/nodes/inflate3d.js';
import {surfaceSource,surfaceTrack,strokeSurface} from '../src/defs/2d3d-source.js';
import {Pin,EMPTY} from '../src/defs/helpers.js';
import {EXAMPLES} from '../src/examples.js';
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def])),base=defaults(N);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const op={...defaults(O),hole:.03,wav:.11,bundling:.45,dotshare:.44,dotsize:.2,bulges:8,bulgesize:.4,halo:1,pens:1};
const tp={...defaults(T),angle:-21,offset:-3,width:12,gape:4,chaos:39,flingPct:22};
let checks=0;const records=[];
function check(input,params,ctx){
 const p={...base,...params},before=hash({input,p,ctx}),out=N.compute([input],p,ctx),mesh=out[2];
 assert.equal(hash({input,p,ctx}),before,'Source and controls stay immutable');assert.ok(mesh?.tri>0,'No blank for '+JSON.stringify(params));assert.ok(out[0].paths.length>0);
 assert.ok(mesh.tri<=120000);assert.equal(mesh.v.length,mesh.tri*9);assert.equal(Math.max(...mesh.dims),1);assert.ok(mesh.v.every(v=>Number.isFinite(v)&&Math.abs(v)<=.5001));
 for(const ps of out.slice(0,2)){assert.ok(ps.paths.reduce((n,q)=>n+q.pts.length,0)<=90000);for(const q of ps.paths)for(const [x,y] of q.pts)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=p.margin-1e-6&&x<=ctx.W-p.margin+1e-6&&y>=p.margin-1e-6&&y<=ctx.H-p.margin+1e-6);}
 checks++;return out;
}
function topology(mesh,label){
 const edges=new Map();let volume=0;
 for(let i=0;i<mesh.v.length;i+=9){const [a,b,c]=[0,3,6].map(k=>mesh.v.slice(i+k,i+k+3));
  volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  for(const [p,q] of [[a,b],[b,c],[c,a]]){const A=p.join(','),B=q.join(','),key=A<B?A+'|'+B:B+'|'+A,v=edges.get(key)||[0,0];v[0]++;v[1]+=A<B?1:-1;edges.set(key,v);}
 }
 assert.ok(volume>0,label+' outward volume');assert.equal([...edges.values()].filter(([n,s])=>n!==2||s!==0).length,0,label+' closed opposite edge pairs');
}
for(const ctx of [{W:297,H:210},{W:594,H:420}]){
 const input=T.compute([O.compute([],op,ctx)],tp,ctx),src=surfaceSource(input);
 assert.ok(input.paths.length>6000);assert.ok(input.paths.reduce((n,q)=>n+q.pts.length,0)>45000);
 let expectedMarks=0;const regular=[];
 for(const q of src.paths){const xs=q.pts.map(p=>p[0]),ys=q.pts.map(p=>p[1]);if(q.closed&&Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))<=1/src.span)expectedMarks++;else regular.push(q);}
 const nondegenerate=input.paths.filter(q=>new Set(q.pts.map(p=>p.slice(0,2).join(','))).size>=2).length;
 assert.equal(expectedMarks+regular.length,nondegenerate,'Only zero-length torn fragments are discarded during intake');
 for(const mode of ['Inflate','Extrude']){
  const raw=strokeSurface(src,mode,1,.42,'Inflated'),groups=new Set(raw.gridEdges.map(q=>q[2].split(':').slice(0,2).join(':')));
  assert.equal([...groups].filter(q=>q.startsWith('mark:')).length,expectedMarks,'Every tiny dot receives geometry');
  assert.equal([...groups].filter(q=>q.startsWith('stroke:')).length,regular.length,'Every remaining torn curve receives geometry');
  assert.ok(raw.faces.length<=118000);const out=check(input,{mode},ctx);records.push({canvas:ctx,mode,sourcePaths:input.paths.length,sourcePoints:input.paths.reduce((n,q)=>n+q.pts.length,0),marks:expectedMarks,curves:regular.length,triangles:out[2].tri,drawingPaths:out[0].paths.length});
 }
 check(input,{mode:'Tubes'},ctx);check(input,{mode:'Ink height'},ctx);
 // Explicit RDP error oracle, in physical millimetres, for dense curves.
 const tolerance=1/src.span/8;
 for(const q of regular.slice().sort((a,b)=>b.pts.length-a.pts.length).slice(0,3)){
  const track=surfaceTrack(q,tolerance),points=track.knots.map(d=>track.at(d));
  for(const p of q.pts){let nearest=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));nearest=Math.min(nearest,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t));}assert.ok(nearest*src.span<=.125+1e-8,'Adaptive deviation stays within one eighth of 1 mm stroke width');}
 }
}
// Independent isolated point marks: proper closed stamps, flat backs and sheets.
const marks={paths:Array.from({length:12},(_,i)=>({closed:true,layer:0,pts:Array.from({length:7},(_,k)=>[20+(i%4)*20+Math.cos(k/7*Math.PI*2)*.1,20+Math.floor(i/4)*20+Math.sin(k/7*Math.PI*2)*.1])}))},ctx={W:297,H:210};
for(const mode of ['Inflate','Extrude'])for(const back of ['Inflated','Flat']){
 const out=check(marks,{mode,inputShape:'Stroked paths',back},ctx);topology(out[2],mode+' '+back);
 assert.equal(hash(out[2]),hash(check(marks,{mode,inputShape:'Stroked paths',back},ctx)[2]),'Repeatable stamp meshes');
 const sheet=check(marks,{mode,inputShape:'Stroked paths',depth:0},ctx);assert.equal(sheet[2].dims[2],0);
}
const input=T.compute([O.compute([],op,ctx)],tp,ctx);
const original=check(input,{mode:'Tubes'},ctx),moreSides=check(input,{mode:'Tubes',sides:16},ctx),uncapped=check(input,{mode:'Tubes',caps:false},ctx);
assert.notEqual(hash(original[2]),hash(moreSides[2]));assert.notEqual(hash(original[2]),hash(uncapped[2]),'Caps retain their meaning in adaptive tubes');
for(const mode of ['Inflate','Extrude'])for(const depth of [0,8])check(input,{mode,depth,back:'Flat'},ctx);
// Reproduce the three-node Help graph through the actual engine evaluator.
const defs={organicrings:O,torn:T,inflate3d:N},app=fs.readFileSync('src/App.jsx','utf8'),ast=parseAst(app,{lang:'jsx'});
const functions=['defIns','defOuts','numericParams','defaultFor','evalLevel'].map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return app.slice(n.start,n.end);}).join('\n');
const evaluate=Function('DEFS','EMPTY','SOLID_STYLE','Pin',functions+'\nreturn evalLevel;')(defs,EMPTY,{kind:'style',mode:'Solid'},Pin);
const ex=EXAMPLES.find(e=>e.name==='Surface study · Torn organic rings');assert.ok(ex);const graph=ex.make(key=>defaults(defs[key]));assert.ok(evaluate(graph,ex.canvas).out[9003][2]?.tri>0);checks++;
console.log(JSON.stringify({checks,records},null,2));console.log(`PASS: ${checks} dense stroke cases; exact reported chain on A4/A2, every mark/curve allocated, bounded physical approximation, closed outward stamps, flat backs/sheets, adaptive tube controls and actual graph evaluator.`);
