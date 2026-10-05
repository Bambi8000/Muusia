/* Continuous Portrait regression checks; no photo decoder, ML or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import N from '../src/defs/nodes/portrait.js';
import * as H from '../src/defs/helpers.js';
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const defaults=Object.fromEntries(N.params.map(p=>[p.key,p.def]));
const ctx={W:210,H:297};
const image=(fn,w=96,h=128)=>({w,h,g:Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w),w,h))});
const img=image((x,y,w,h)=>{
  const ex=(x-w/2)/(w*.35),ey=(y-h/2)/(h*.43);
  if(ex*ex+ey*ey>1)return 0;
  if(y<30||Math.abs(ex)>.75)return .9;
  if(y>47&&y<55&&Math.abs(ex)>.13&&Math.abs(ex)<.65)return .95;
  if(y>80&&y<86&&Math.abs(ex)<.45)return .85;
  return .22+.18*(x/w);
});
const run=(over={},im=img,context=ctx,style,analysis)=>N.compute([style],{...defaults,mode:'Scribble',...over},context,{data:{img:im,analysis}});
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const length=r=>r.paths.reduce((n,p)=>n+p.pts.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-p.pts[i][0],q[1]-p.pts[i][1]),0),0);
function valid(r,c=ctx,m=12){
 ok(r.paths.length===1,'nonblank image emits exactly ONE path');
 const p=r.paths[0];ok(p.closed===false,'open stroke');ok(Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12,'valid pen');
 ok(p.pts.length>2&&p.pts.length<=118000,'point budget');
 ok(p.pts.every(q=>q.length===2&&q.every(Number.isFinite)),'finite 2D points');
 ok(p.pts.every(([x,y])=>x>=m-1e-8&&y>=m-1e-8&&x<=c.W-m+1e-8&&y<=c.H-m+1e-8),'within margins');
 ok(p.pts.every((q,i)=>!i||Math.hypot(q[0]-p.pts[i-1][0],q[1]-p.pts[i-1][1])>0),'no zero-length segments');
}
const base=run();valid(base);
ok(hash(base)===hash(run()),'deterministic');
ok(hash(base)!==hash(run({seed:78})),'seed changes handwriting');
ok(hash(base)===hash(run({},img,ctx,undefined,{v:999,faces:'bad'})),'no analysis dependency');
ok(run({},image(()=>0)).paths.length===0,'white image empty');
ok(run({},null).paths.length===0,'missing image empty');
ok(run({margin:60},img,{W:80,H:100}).paths.length===0,'empty fit box');
ok(run({cutoff:.8},image(()=>.6)).paths.length===0,'cutoff removes tone');
for(const over of [
 {scribbleDensity:.2},{scribbleDensity:3},{scribbleSize:.6},{scribbleSize:18},
 {scribbleWander:0},{scribbleWander:1},{scribbleFeatures:0},{scribbleFeatures:1},
 {penW:2},{penW:.2,ink:.2,detail:1,quality:8},{gamma:3},{gamma:.3},
 {focusBoost:3,focusRX:8,focusRY:8},{cutoff:.8},{layer:11},{seed:-987},
]){const r=run(over);valid(r);ok(hash(r)!==hash(base),'control changes geometry/pen: '+JSON.stringify(over));}
for(const c of [{W:297,H:420},{W:841,H:594},{W:45,H:60}]) valid(run({},img,c),c);
for(const im of [image(()=>.9,2,2),image(()=>1,180,20),image(()=>.5,20,180)]) valid(run({},im));
const sparse=run({scribbleDensity:.35}),dense=run({scribbleDensity:1.8});
ok(length(dense)>length(sparse)*1.5,'density meaningfully increases drawn length');
const toneBands=image((x,y,w,h)=>y<8||y>h-9?0:x<w/2?.9:.2);
const bands=run({scribbleFeatures:0,penW:.5},toneBands);
let dark=0,light=0;
for(const p of bands.paths)for(let i=1;i<p.pts.length;i++){
 const a=p.pts[i-1],b=p.pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if((a[0]+b[0])/2<ctx.W/2)dark+=l;else light+=l;
}
ok(dark>light*2,'shadow receives substantially more line than light tone');
const islands=image((x,y)=>Math.hypot(x-20,y-25)<12||Math.hypot(x-76,y-101)<12?.9:0);
const connected=run({scribbleSize:2},islands);valid(connected);
ok(connected.paths[0].pts.some(p=>p[1]<90)&&connected.paths[0].pts.some(p=>p[1]>200),'one continuous stroke reaches disconnected dark areas');
const Stroke=(await import('../src/defs/nodes/viiva.js')).default;
const strokeParams=Object.fromEntries(Stroke.params.map(p=>[p.key,p.def]));
const solid=Stroke.compute([],{...strokeParams,mode:'Solid'});
const dashed=Stroke.compute([],strokeParams);
ok(hash(run({},img,ctx,solid))===hash(base),'solid Style preserves one path');
const dashResult=run({},img,ctx,dashed);
ok(dashResult.paths.length>1,'dashed Style deliberately splits the line');
ok(hash(dashResult)===hash(H.applyStyle(base,dashed)),'real Stroke Style contract');
ok(N.params.find(p=>p.key==='mode').def==='Tonal','legacy default preserved');
for(const key of ['scribbleDensity','scribbleSize','scribbleWander','scribbleFeatures']){
 const p=N.params.find(p=>p.key===key);ok(p.showIf({mode:'Scribble'})&&!p.showIf({mode:'Tonal'}),'conditional '+key);
}
for(const key of ['rounds','hatch','penAssign','economy','nerve','glassesOn'])ok(!N.params.find(p=>p.key===key).showIf({mode:'Scribble'}),'hide unused '+key);
const lab='nodes-lab/portrait.plotternode.js';
if(fs.existsSync(lab)){
 const keys=Object.keys(H),L=new Function(...keys,'return '+fs.readFileSync(lab,'utf8'))(...keys.map(k=>H[k]));
 ok(hash(L.compute([],{...defaults,mode:'Scribble'},ctx,{data:{img}}))===hash(base),'lab/baked output equality');
}
console.log(`${checks} Portrait Scribble checks passed; base ${base.paths[0].pts.length} points, ${(length(base)/1000).toFixed(1)} m; shadow/light ${(dark/light).toFixed(1)}×`);
