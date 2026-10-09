/** Geometry and compatibility checks for Image → Rams contour. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import image from '../src/defs/nodes/image.js';
import * as H from '../src/defs/helpers.js';
import stroke from '../src/defs/nodes/viiva.js';
const defaults=Object.fromEntries(image.params.map(p=>[p.key,p.def]));
const ctx={W:120,H:100}, w=96,h=80;
const fixture={w,h,g:Array.from({length:w*h},(_,i)=>{const x=(i%w)/w,y=Math.floor(i/w)/h;return .25+.7*Math.exp(-((x-.5)**2*35+(y-.5)**2*50));})};
const plain=d=>({w:20,h:20,g:Array(400).fill(d)});
const run=(p={},img=fixture,c=ctx,ins=[])=>image.compute(ins,{...defaults,mode:'Rams contour',...p},c,{data:{img}});
const geometry=r=>r.paths.map(({pts,closed})=>({pts,closed}));
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function valid(r,p={},img=fixture,c=ctx){
 const fit=image._artFit({...defaults,...p},c,img),points=r.paths.flatMap(p=>p.pts);
 ok(r.paths.length>0,'nonempty');ok(points.length<=104000,'whole-image point budget');
 ok(r.paths.every(p=>p.closed===false&&p.pts.length>=2),'open pen paths');
 ok(points.every(p=>p.length===2&&p.every(Number.isFinite)),'finite points');
 ok(r.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'valid pen indices');
 ok(points.every(([x,y])=>x>=fit.x-1e-7&&x<=fit.x+fit.w+1e-7&&y>=fit.y-1e-7&&y<=fit.y+fit.h+1e-7),'inside actual fitted image');
 ok(r.paths.every(p=>p.pts.slice(1).every((q,i)=>Math.hypot(q[0]-p.pts[i][0],q[1]-p.pts[i][1])>1e-8)),'no duplicate vertices');
}
const start=performance.now(),base=run();valid(base);eq(run(),base,'deterministic');eq(run({seed:999}),base,'no random field in photo contours');
const saved=JSON.stringify(fixture);run();eq(JSON.stringify(fixture),saved,'no source mutation');
ok(image.key==='image'&&image.fileImage,'existing file import node');eq(image.ins.map(p=>p.type),['style','paths'],'ports stay compatible');
ok(image.params.find(p=>p.key==='mode').options.includes('Rams contour'),'mode selectable');
ok(image.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'valid select defaults');
eq(new Set(image.params.map(p=>p.key)).size,image.params.length,'unique parameter names');
const visible=mode=>image.params.filter(p=>!p.showIf||p.showIf({...defaults,mode})).map(p=>p.key);
for(const key of ['ramsAngle','ramsDepth','ramsSmooth','ramsMin','ramsWhite']){
 ok(visible('Rams contour').includes(key),key+' visible');ok(!visible('Organic dots').includes(key),key+' hidden in existing mode');
}
ok(!visible('Rams contour').includes('seed')&&!visible('Rams contour').includes('dotfill'),'hide unrelated controls');
for(const p of [{cell:1},{ramsDepth:2},{ramsDepth:35},{strength:.2},{gamma:2},{ramsSmooth:4},{ramsAngle:30},{ramsAngle:90},{ramsAngle:-90},{margin:3},{invert:true},{cutoff:.4}]){const r=run(p);valid(r,p);ok(hash(r)!==hash(base),JSON.stringify(p)+' changes drawing');}
for(const img of [null,{w:0,h:4,g:[]},{w:4,h:4,g:[]},{w:NaN,h:1,g:[]},{w:2e6,h:2,g:[]}])eq(run({},img).paths,[],'bad image empty');
eq(run({},plain(0)).paths,[],'white empty');ok(run({ramsWhite:true},plain(0)).paths.length>0,'keep white background');
ok(run({invert:true},plain(0)).paths.length>0,'white inverted');eq(run({invert:true},plain(1)).paths,[],'black inverted');
eq(run({margin:60},fixture,{W:100,H:100}).paths,[],'empty margin');
eq(run({},fixture,{W:0,H:100}).paths,[],'zero canvas');
// A uniform field has an exact flat phase and physical line pitch. No random
// waviness or accidental use of raster row indices is allowed.
const flat=run({margin:0,cell:3,ramsAngle:0},plain(.5),{W:90,H:90});
ok(flat.paths.every(p=>p.pts.every(q=>Math.abs(q[1]-p.pts[0][1])<1e-7)),'uniform image makes straight lines');
ok(flat.paths.slice(1).every((p,i)=>Math.abs(p.pts[0][1]-flat.paths[i].pts[0][1]-3)<1e-7),'physical 3 mm pitch');
const zero=run({ramsDepth:0});ok(zero.paths.every(p=>p.pts.every(q=>Math.abs(q[1]-p.pts[0][1])<1e-7)),'zero depth removes relief');
for(const ramsAngle of [27,-32,90]){
 const a=ramsAngle*Math.PI/180,flat=run({ramsDepth:0,ramsAngle,margin:0},plain(.5),{W:100,H:100});
 ok(flat.paths.every(p=>p.pts.slice(1).every((q,i)=>Math.abs((q[0]-p.pts[i][0])*Math.sin(a)-(q[1]-p.pts[i][1])*Math.cos(a))<1e-7)),'rotation gives exact angle '+ramsAngle);
}
// Independent crossing oracle. With background retained each curve covers
// the centre. Interpolate its ordinate at shared X probes and assert ordering.
const stepImage={w:100,h:100,g:Array.from({length:10000},(_,i)=>((Math.floor(i/100)>35&&Math.floor(i/100)<65)||i%100>55)?1:.08)};
for(const ramsDepth of [14,40,100]){
 const r=run({ramsWhite:true,ramsDepth,strength:1,ramsSmooth:0,margin:0,cell:1},stepImage,{W:100,H:100});valid(r,{margin:0},stepImage,{W:100,H:100});
 for(const x of [10,30,49,56,70,90]){
  const ordinates=r.paths.map(p=>{for(let i=1;i<p.pts.length;i++){const a=p.pts[i-1],b=p.pts[i];if(a[0]<=x&&b[0]>=x)return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return null;}).filter(v=>v!==null);
  ok(ordinates.length>10,'crossing probe populated');ok(ordinates.slice(1).every((v,i)=>v>ordinates[i]+1e-7),'neighbours never cross at sharp step');
 }
}
const striped={w:100,h:100,g:Array.from({length:10000},(_,i)=>i%100>38&&i%100<62?0:.8)};
const split=run({ramsDepth:0,margin:0,cell:2},striped,{W:100,H:100});
ok(split.paths.every(p=>p.pts.every(q=>q[0]<40)||p.pts.every(q=>q[0]>60)),'white stripe splits strokes without bridges');
const shortened=run({ramsMin:12},striped,{W:100,H:100});ok(shortened.paths.every(p=>H.pathLength(p.pts,false)>=12),'minimum length measured in mm');
for(const p of [{cell:.01,ramsDepth:1e6,ramsSmooth:50,ramsWhite:true,margin:0,ramsAngle:45},{cell:99,ramsAngle:Infinity},{ramsDepth:-20,ramsSmooth:-1}])valid(run(p),p);
for(const c of [{W:10000,H:10000},{W:30,H:1000},{W:1000,H:30}]){
 const p={cell:.1,margin:0,ramsWhite:true,ramsAngle:30,ramsDepth:100};const r=run(p,plain(.5),c);valid(r,p,plain(.5),c);
 const xs=r.paths.flatMap(p=>p.pts.map(q=>q[0])),ys=r.paths.flatMap(p=>p.pts.map(q=>q[1])),f=image._artFit({...defaults,...p},c,plain(.5));
 ok(Math.max(...xs)-Math.min(...xs)>f.w*.9&&Math.max(...ys)-Math.min(...ys)>f.h*.9,'budget retains full extent');
}
const bad={};for(const p of image.params)if(['slider','seed','pen'].includes(p.type))bad[p.key]=NaN;valid(run(bad),bad);
eq(geometry(run({layer:7})),geometry(base),'changing pen preserves geometry');ok(run({layer:7}).paths.every(p=>p.layer===7),'selected pen');
const src={paths:[{pts:[[20,25],[100,25],[100,75],[20,75]],closed:true,layer:0}]};
const wired=run({drawingFill:true},null,ctx,[undefined,src]);ok(wired.paths.length>0,'blue drawing input');
eq(run({drawingFill:true},plain(1),ctx,[undefined,src]),wired,'wire overrides stored photo');
eq(run({},fixture,ctx,[undefined,{paths:[]}]).paths,[],'empty wire never revives photo');
const style=stroke.compute([],{...Object.fromEntries(stroke.params.map(p=>[p.key,p.def])),dash:1,gap:.5},ctx);
eq(run({},fixture,ctx,[style]),H.applyStyle(base,style),'actual Style helper applied');
const lab='nodes-lab/image.plotternode.js';
if(fs.existsSync(lab)){
 const def=new Function(...Object.keys(H),'return '+fs.readFileSync(lab,'utf8'))(...Object.values(H));
 eq(def.compute([],{...defaults,mode:'Rams contour'},ctx,{data:{img:fixture}}),base,'lab / baked parity');
}
console.log(`Image Rams contour: ${checks} checks passed in ${Math.round(performance.now()-start)} ms.`);
