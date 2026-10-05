import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import def from '../src/defs/nodes/arc_mounds.js';
import stroke from '../src/defs/nodes/viiva.js';
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const ctx={W:297,H:420};
const run=(p={},c=ctx,style)=>def.compute([style],{...defaults,...p},c);
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const geometry=r=>r.paths.map(({pts,closed})=>({pts,closed}));
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
function valid(r,p={},c=ctx){
 const region=def._region({...defaults,...p},c),pts=r.paths.flatMap(p=>p.pts);
 check(r.paths.length>0,'nonempty drawing');
 check(pts.length<=110000,'bounded point budget');
 check(pts.every(p=>p.length===2&&p.every(Number.isFinite)),'finite 2D points');
 check(pts.every(([x,y])=>x>=region.x0-1e-6&&x<=region.x1+1e-6&&y>=region.y0-1e-6&&y<=region.y1+1e-6),'all geometry respects margin');
 check(r.paths.every(p=>p.pts.length>=(p.closed?3:2)&&typeof p.closed==='boolean'),'valid paths and closure');
 check(r.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'valid pens');
 check(r.paths.every(p=>Object.keys(p).sort().join(',')==='closed,layer,pts'),'pen strokes only, no fills or hidden image payload');
 check(r.paths.every(p=>p.pts.every((q,i)=>!i||Math.hypot(q[0]-p.pts[i-1][0],q[1]-p.pts[i-1][1])>1e-8)),'no repeated consecutive points');
 check(r.paths.every(p=>!p.closed||Math.hypot(p.pts[0][0]-p.pts.at(-1)[0],p.pts[0][1]-p.pts.at(-1)[1])>1e-8),'no repeated closure');
}
check(def.ins[0].type==='style'&&def.outs[0].type==='paths','standard ports');
check(new Set(def.params.map(p=>p.key)).size===def.params.length,'unique params');
check(def.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'valid select options');
// Analytic clipping, independent of the generated artwork.
const disc={cx:0,cy:0,rx:2,ry:2,c:1,s:0,box:[-2,-2,2,2]},box={x0:-20,y0:-20,x1:20,y1:20};
eq(def._insideInterval([-4,0],[4,0],disc),[0.25,0.75],'disc intersection');
eq(def._insideInterval([-4,2],[4,2],disc),null,'tangent does not erase a stroke');
eq(def._clip([[-4,0],[4,0]],false,[disc],box),[{pts:[[-4,0],[-2,0]],closed:false},{pts:[[2,0],[4,0]],closed:false}],'exact foreground removal, no connecting chord');
eq(def._clip([[-1,0],[1,0]],false,[disc],box),[],'fully hidden path removed');
eq(def._clip([[-4,3],[4,3]],false,[],{x0:-2,y0:-5,x1:2,y1:5}),[{pts:[[-2,3],[2,3]],closed:false}],'exact page clipping');
const ellipse={...disc,rx:4,ry:2,c:0,s:1,box:[-2,-4,2,4]};
eq(def._insideInterval([0,-8],[0,8],ellipse),[0.25,0.75],'rotated ellipse interval');
const square=[[-5,-5],[5,-5],[5,5],[-5,5]];eq(def._clip(square,true,[],box),[{pts:square,closed:true}],'unclipped closed loop retained without duplicate seam');
const input=structuredClone(square);def._clip(square,true,[disc],box);eq(square,input,'clipping does not mutate inputs');
// Two independently specified overlapping mounds. Back pen must never enter
// the front ellipse, including between sampled points.
const back={cx:80,cy:80,rx:55,ry:42,c:1,s:0,flow:0.6,index:0,box:[25,38,135,122]};
const front={cx:108,cy:98,rx:46,ry:35,c:1,s:0,flow:0.8,index:1,box:[62,63,154,133]};
const region={W:200,H:200,m:0,x0:0,y0:0,x1:200,y1:200};
const scene=def._draw({...defaults,colours:2,layer:0,pen2:1},region,[back,front],2,0.8);
check(scene.paths.some(p=>p.layer===0)&&scene.paths.some(p=>p.layer===1),'both depth layers visible');
const inside=([x,y],b)=>((x-b.cx)/b.rx)**2+((y-b.cy)/b.ry)**2;
for(const pen of [0,1]){
 const paths=scene.paths.filter(p=>p.layer===pen),owner=pen?front:back;
 check(paths.every(p=>p.pts.every(q=>inside(q,owner)<=1+1e-8)),'arcs stay on their own mound');
 if(!pen)check(paths.every(p=>p.pts.every((q,i)=>{
  if(inside(q,front)<1-1e-7)return false;
  if(i){const prev=p.pts[i-1];for(const t of [0.25,0.5,0.75])if(inside([prev[0]+t*(q[0]-prev[0]),prev[1]+t*(q[1]-prev[1])],front)<1-1e-7)return false;}
  return true;
 })),'no back strokes cross foreground body');
}
const start=performance.now(),base=run();valid(base);const cold=performance.now()-start;
eq(hash(base),'8d77e5fe0701fc82719be849054cea95ad510034b580e07033dac239474eb4ee','original Soft bodies field is byte-identical');
eq(hash(run({layout:'Single'})),'eafa914ef4215b53366d0e8bc8e2e5e5f5291120129797e98c116531ee1ec0cc','original Single is byte-identical');
eq(hash(run()),hash(base),'seeded replay');
for(const p of [{seed:19},{layout:'Single'},{layout:'Single',size:1200,fullness:1.3,tilt:60},{bodyCurves:0},{bodyCurves:1,curveScale:60},{pitch:0.6,size:55,overlap:0.8},{sizeContrast:1,variation:1,seed:3},{sizeContrast:0,variation:0}])valid(run(p),p);
for(const c of [{W:210,H:297},{W:297,H:210},{W:70,H:50}])valid(run({margin:3},c),{margin:3},c);
for(const key of ['seed','size','fullness','overlap','variation','sizeContrast','bodyCurves','curveScale','flow','tilt','outline']){
 const value={seed:7,size:200,fullness:1.2,overlap:0.15,variation:0,sizeContrast:0,bodyCurves:0,curveScale:300,flow:75,tilt:0,outline:false}[key];
 check(hash(run({[key]:value}))!==hash(base),key+' affects output');
}
for(const colours of [1,3,6]){
 const r=run({colours});eq(geometry(r),geometry(base),'colour preserves geometry');eq(new Set(r.paths.map(p=>p.layer)).size,colours,'all requested field pens present');
}
check(run({colours:6,layer:11,pen2:11,pen3:11,pen4:11,pen5:11,pen6:11}).paths.every(p=>p.layer===11),'same selected pen collapses colours');
check(run({layout:'Single',pitch:1}).paths.length>run({layout:'Single',pitch:5}).paths.length,'pitch controls density');
const noVariation=def._bodies({...defaults,sizeContrast:0,variation:0},def._region(defaults,ctx));
check(new Set(noVariation.map(b=>b.rx)).size===1,'zero size contrast produces equal widths');
const varied=def._bodies({...defaults,sizeContrast:1},def._region(defaults,ctx)).map(b=>b.rx);
check(Math.max(...varied)/Math.min(...varied)>8,'high contrast mixes genuinely different sizes');
// Numeric Jacobian of the warp: positive determinant rules out fold-overs.
const warpParams={...defaults,bodyCurves:1,curveScale:60},r=def._region(defaults,ctx);
const warp=q=>def._warp([{pts:[q],closed:false,layer:0}],warpParams,r)[0].pts[0];
for(let y=11;y<410;y+=31)for(let x=11;x<287;x+=27){
 const e=0.0001,q=warp([x,y]),u=warp([x+e,y]),v=warp([x,y+e]);
 check(((u[0]-q[0])*(v[1]-q[1])-(u[1]-q[1])*(v[0]-q[0]))/(e*e)>0,'smooth body modulation stays invertible');
}
eq(def._warp([{pts:[[10,10],[287,410]],closed:false,layer:0}],warpParams,r)[0].pts,[[10,10],[287,410]],'warp pins margin corners');
const malformed={};for(const p of def.params)if(['slider','seed','pen'].includes(p.type))malformed[p.key]=NaN;valid(run(malformed),malformed);
eq(run({margin:100},{W:30,H:20}).paths,[],'empty paper returns empty');
valid(run({size:1e9,fullness:-900,overlap:999,pitch:-5,tilt:1e8,colours:999,layer:999,bodyCurves:999,curveScale:-3}));
const style=stroke.compute([],Object.fromEntries(stroke.params.map(p=>[p.key,p.key==='dash'?2:p.key==='gap'?1:p.def])),ctx);
check(hash(run({layout:'Single'},ctx,style))!==hash(run({layout:'Single'})),'real Style input applied');
// Rolls: analytic stadium clipping plus surface and depth checks.
const capsule={cx:0,cy:0,rx:5,ry:2,c:1,s:0,roll:true,cap:2,shaft:3,box:[-5,-2,5,2]};
eq(def._insideInterval([-10,0],[10,0],capsule),[0.25,0.75],'capsule through both end caps');
eq(def._insideInterval([0,-4],[0,4],capsule),[0.25,0.75],'capsule through cylindrical middle');
eq(def._insideInterval([-6,2],[6,2],capsule),null,'capsule tangent retained');
eq(def._insideInterval([0,-10],[0,10],{...capsule,c:0,s:1}),[0.25,0.75],'rotated capsule');
eq(def._clip([[-10,0],[10,0]],false,[capsule],box),[{pts:[[-10,0],[-5,0]],closed:false},{pts:[[5,0],[10,0]],closed:false}],'capsule removal leaves no connecting chord');
eq(def._insideInterval([-1,0],[1,0],capsule),[0,1],'inside cylindrical middle');
const onRoll=(q,b)=>{
 const x=(q[0]-b.cx)*b.c+(q[1]-b.cy)*b.s,y=-(q[0]-b.cx)*b.s+(q[1]-b.cy)*b.c;
 return (Math.max(0,Math.abs(x)-b.shaft)/b.cap)**2+(y/b.ry)**2;
};
for(const flow of [5,35,80])for(const tilt of [0,60]){
 const p={...defaults,form:'Rolls',layout:'Single',bodyCurves:0,size:1200,fullness:1.3,flow,tilt};
 const bodies=def._bodies(p,r),b=bodies[0],drawing=run(p);valid(drawing,p);
 check(b.rx/b.ry>2,'roll is elongated');
 check(drawing.paths.every(path=>path.pts.every(q=>onRoll(q,b)<=1+1e-7)),'all ribs lie on capsule surface');
 check(drawing.paths.every(path=>path.pts.every(([x,y])=>x>=b.box[0]-1e-8&&y>=b.box[1]-1e-8&&x<=b.box[2]+1e-8&&y<=b.box[3]+1e-8)),'rotated capsule bounds contain geometry');
}
const rollBack={...capsule,cx:80,cy:80,rx:55,ry:16,cap:15,shaft:40,flow:0.6,index:0,box:[25,64,135,96]};
const rollFront={...rollBack,cx:108,cy:90,flow:0.8,index:1,box:[53,74,163,106]};
const rollScene=def._draw({...defaults,colours:2,layer:0,pen2:1},region,[rollBack,rollFront],2,0.8);
check(rollScene.paths.some(p=>p.layer===0)&&rollScene.paths.some(p=>p.layer===1),'both roll layers visible');
check(rollScene.paths.filter(p=>p.layer===0).every(p=>p.pts.every((q,i)=>{
 const prev=p.pts[(i+p.pts.length-1)%p.pts.length];
 return (i||p.closed?[0,0.25,0.5,0.75,1]:[1]).every(t=>onRoll([prev[0]+t*(q[0]-prev[0]),prev[1]+t*(q[1]-prev[1])],rollFront)>=1-1e-7);
})),'back ribs never cross foreground roll');
const rolls=run({form:'Rolls'});valid(rolls,{form:'Rolls'});eq(hash(rolls),hash(run({form:'Rolls'})),'rolls replay');
check(hash(rolls)!==hash(base),'form changes geometry');
for(const p of [{pitch:0.6,size:30,overlap:0.8},{bodyCurves:1,curveScale:60,sizeContrast:1},{layout:'Single',bodyCurves:1},{flow:80,tilt:60,fullness:0.25}])valid(run({form:'Rolls',...p}),p);
const rollColours=run({form:'Rolls',colours:6});valid(rollColours);
eq(geometry(rollColours),geometry(rolls),'roll colours preserve geometry');
check(rollColours.paths.every(p=>[0,5,7,6,3,9].includes(p.layer)),'rolls use selected pens; occlusion can hide whole bodies');
const sixBodies=Array.from({length:6},(_,i)=>({...capsule,cx:50,cy:20+i*30,rx:20,ry:5,shaft:15,cap:5,flow:0.6,index:i,box:[30,15+i*30,70,25+i*30]}));
eq(new Set(def._draw({...defaults,colours:6},region,sixBodies,2,0.9).paths.map(p=>p.layer)).size,6,'six unobscured rolls use all six selected pens');
check(hash(run({form:'Rolls',layout:'Single'},ctx,style))!==hash(run({form:'Rolls',layout:'Single'})),'Rolls accepts actual Style');
console.log(`Arc Mounds: ${checks} checks passed; default ${base.paths.length} paths / ${base.paths.reduce((n,p)=>n+p.pts.length,0)} points; ${cold.toFixed(0)} ms cold.`);
