import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ribbon from '../src/defs/nodes/ribbon.js';
import stroke from '../src/defs/nodes/viiva.js';
const defaults=Object.fromEntries(ribbon.params.map(p=>[p.key,p.def]));
const ctx={W:210,H:297};
const run=(p={},c=ctx,ins=[])=>ribbon.compute(ins,{...defaults,shape:'Angular',...p},c);
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const points=r=>r.paths.flatMap(p=>p.pts);
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
check(ribbon.key==='ribbon'&&ribbon.ins.length===1&&ribbon.ins[0].type==='style','same built-in key and ports');
check(new Set(ribbon.params.map(p=>p.key)).size===ribbon.params.length,'unique params');
check(ribbon.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'valid select descriptors');
for(const [shape,expected] of [['Line','d2ed28c16be35540fed713e8d5b0207f0641783f18c3ee415bbf057f1fe0484f'],['Ring','31e877731dd9e4a5f25057bbe3c1c87a0d96fcc2c275c0a00f77b68daabf12a6']]){
 eq(hash(run({shape})),expected,shape+' frozen pre-extension geometry');
 eq(hash(run({shape,colours:undefined})),expected,shape+' old patches retain one pen');
 const a=run({shape,colours:1}),b=run({shape,colours:6});
 eq(a.paths.map(p=>p.pts),b.paths.map(p=>p.pts),shape+' colours only change pens');
 eq(new Set(b.paths.map(p=>p.layer)).size,6,shape+' six bands');
}
// Independent geometry oracle: east then south, left offsets meet at (8,2).
const elbow=[[0,0],[10,0],[10,10]];
eq(ribbon._offset(elbow,2,false,'Sharp',4),[[0,2],[8,2],[8,10]],'exact inside mitre');
eq(ribbon._offset(elbow,-2,false,'Sharp',4),[[0,-2],[12,-2],[12,10]],'exact outside mitre');
eq(ribbon._offset(elbow,2,false,'Bevel',4),[[0,2],[10,2],[8,0],[8,10]],'bevel keeps shifted segment endpoints');
eq(ribbon._offset(elbow,2,false,'Sharp',1),ribbon._offset(elbow,2,false,'Bevel',4),'corner limit safely bevels sharp turns');
const straight=[[0,0],[10,0],[30,0]];
eq(ribbon._offset(straight,3,false,'Sharp',4),[[0,3],[10,3],[30,3]],'collinear spans stay parallel');
const reversal=ribbon._offset([[0,0],[10,0],[0,0]],2,false,'Sharp',8);
check(reversal.every(p=>p.every(Number.isFinite)),'180 degree reversal has no unbounded mitre');
const loop=ribbon._offset([[0,0],[10,0],[10,10],[0,10]],1,true,'Sharp',4);
eq(loop,[[1,1],[9,1],[9,9],[1,9]],'closed rectangle offset including seam');
const original=structuredClone(elbow);ribbon._offset(elbow,2,false,'Sharp',4);eq(elbow,original,'no mutation of spine');
for(const angularLayout of ['Free folds','No crossings','Zigzag','Star'])for(const angularFill of ['Lines','Stripes'])for(const join of ['Sharp','Bevel'])for(const colours of [1,3,6]){
 const p={angularLayout,angularFill,join,colours},a=run(p),pts=points(a),label=JSON.stringify(p);
 check(a.paths.length>0,label+' nonempty');
 check(pts.every(p=>p.length===2&&p.every(Number.isFinite)),label+' finite 2D points');
 check(pts.length<=112000,label+' bounded work');
 check(pts.every(([x,y])=>x>=12-1e-8&&x<=198+1e-8&&y>=12-1e-8&&y<=285+1e-8),label+' full band inside margin');
 check(a.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12&&p.pts.length>=2),label+' valid pen paths');
 check(a.paths.every(p=>p.closed===(angularLayout==='Star')),label+' correct pen closure');
 eq(new Set(a.paths.map(p=>p.layer)).size,colours,label+' all requested colours');
 eq(hash(a),hash(run(p)),label+' repeatable');
}
for(const seed of [0,1,7,27,151,999])for(const rotate of [0,37,90,179]){
 const r=run({seed,rotate,colours:6}),pts=points(r);
 check(pts.every(([x,y])=>x>=12-1e-8&&x<=198+1e-8&&y>=12-1e-8&&y<=285+1e-8),'rotated envelope fits '+seed+'/'+rotate);
}
check(hash(run({seed:1}))!==hash(run({seed:2})),'Free folds seed changes the route');
check(hash(run({rotate:0}))!==hash(run({rotate:37})),'rotation changes composition');
check(hash(run({turns:4}))!==hash(run({turns:12})),'turn count changes route');
check(hash(run({angularLayout:'Star',starPoints:5}))!==hash(run({angularLayout:'Star',starPoints:9})),'star points change route');
check(run({pitch:0.2}).paths.length>run({pitch:0.8}).paths.length,'pitch controls ink density');
check(run({angularFill:'Lines',lines:1}).paths.length===1,'single guide spine');
const res=run({colours:6}),recolour=run({colours:6,pen2:8});
eq(res.paths.map(p=>p.pts),recolour.paths.map(p=>p.pts),'pen pick preserves every coordinate');
check(recolour.paths.some(p=>p.layer===8)&&!res.paths.some(p=>p.layer===8),'chosen pen reaches output');
for(const colours of [1,6]){
 const r=run({colours,stripeGap:0});
 const unique=new Set(r.paths.map(p=>JSON.stringify(p.pts)));
 eq(unique.size,r.paths.length,'zero-gap shared band edges not plotted twice');
}
for(const angularLayout of ['Free folds','No crossings','Zigzag','Star']){
 const r=run({angularLayout,width:400,turns:80,starPoints:41,pitch:0.001,colours:6,miterLimit:8,margin:0},{W:420,H:297});
 check(points(r).length<=112000,'extreme '+angularLayout+' budget');
 check(points(r).every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x>=-1e-8&&x<=420+1e-8&&y>=-1e-8&&y<=297+1e-8),'extreme '+angularLayout+' fitted bounds');
}
eq(run({margin:100},{W:30,H:20}).paths,[],'no usable page');
const malformed={};for(const p of ribbon.params)if(['slider','pen','seed'].includes(p.type))malformed[p.key]=NaN;
check(points(run(malformed)).every(p=>p.every(Number.isFinite)),'NaN parameters safe');
check(run({layer:99,pen2:-4,colours:2}).paths.every(p=>p.layer>=0&&p.layer<=11),'pens clamped');
const st=stroke.compute([],Object.fromEntries(stroke.params.map(p=>[p.key,p.key==='dash'?2:p.key==='gap'?1:p.def])),ctx);
check(hash(run({},ctx,[st]))!==hash(run()),'real Style input applied');
eq(ribbon.overlay({...defaults,shape:'Angular'},ctx),[{kind:'rect',x:12,y:12,w:186,h:273}],'angular margin guide matches output');
// Independent oracle on emitted strokes, including inner/outer corner joins.
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const touches=(a,b,c,d)=>{
 if(Math.max(a[0],b[0])<Math.min(c[0],d[0])-1e-8||Math.max(c[0],d[0])<Math.min(a[0],b[0])-1e-8||Math.max(a[1],b[1])<Math.min(c[1],d[1])-1e-8||Math.max(c[1],d[1])<Math.min(a[1],b[1])-1e-8)return false;
 const side=v=>Math.abs(v)<1e-8?0:Math.sign(v);
 return side(cross(a,b,c))*side(cross(a,b,d))<=0&&side(cross(c,d,a))*side(cross(c,d,b))<=0;
};
const hasCollision=r=>{
 const segs=[];
 r.paths.forEach((p,path)=>{for(let i=1;i<p.pts.length;i++)segs.push({a:p.pts[i-1],b:p.pts[i],path,i});});
 for(let i=0;i<segs.length;i++)for(let j=0;j<i;j++){
  const a=segs[i],b=segs[j];if(a.path===b.path&&Math.abs(a.i-b.i)<=1)continue;
  if(touches(a.a,a.b,b.a,b.b))return true;
 }
 return false;
};
check(hasCollision(run({angularLayout:'Free folds',angularFill:'Lines',lines:6})),'collision oracle detects original crossings');
for(const seed of [0,1,7,27,151,999])for(const join of ['Sharp','Bevel'])for(const width of [8,28,80]){
 const p={angularLayout:'No crossings',seed,join,width,colours:6,turns:30,miterLimit:1,rotate:37};
 check(!hasCollision(run(p)),'entire strip has no self/other collisions '+JSON.stringify(p));
}
for(const width of [0.1,400])for(const angularFill of ['Lines','Stripes']){
 const r=run({angularLayout:'No crossings',width,clearance:200,turns:80,angularFill,lines:40,colours:6});
 check(r.paths.length>0&&!hasCollision(r),'extreme noncrossing output '+width+'/'+angularFill);
}
const safeParams={angularLayout:'No crossings',angularFill:'Lines',lines:3};
check(hash(run({...safeParams,seed:1}))!==hash(run({...safeParams,seed:2})),'noncrossing seed changes route');
check(hash(run({...safeParams,clearance:0}))!==hash(run({...safeParams,clearance:40})),'clearance changes available route');
eq(hash(run(safeParams)),hash(run(safeParams)),'noncrossing route deterministic');
const dense=run({...safeParams,width:400,turns:80});
check(dense.paths[0].pts.length<82,'crowded page returns fewer turns without forcing collision');
// A large page avoids fit scaling: compare separate spans of both boundary rails.
const clear=run({...safeParams,width:20,clearance:12,turns:6},{W:1200,H:1200});
const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
let separation=Infinity;
for(const a of [clear.paths[0],clear.paths[2]])for(const b of [clear.paths[0],clear.paths[2]])for(let i=1;i<a.pts.length;i++)for(let j=1;j<b.pts.length;j++){
 if(Math.abs(i-j)<=1)continue;
 separation=Math.min(separation,pointSegment(a.pts[i-1],b.pts[j-1],b.pts[j]),pointSegment(a.pts[i],b.pts[j-1],b.pts[j]),pointSegment(b.pts[j-1],a.pts[i-1],a.pts[i]),pointSegment(b.pts[j],a.pts[i-1],a.pts[i]));
}
check(Number.isFinite(separation)&&separation>=12-1e-7,'separate spans respect requested full-band clearance');
// Open routing must mix bend directions instead of accumulating a full coil.
for(const canvas of [{W:210,H:297},{W:297,H:420}])for(const seed of [0,1,2,7,11,27,63,151,999]){
 const r=run({angularLayout:'No crossings',angularFill:'Lines',lines:1,seed,turns:12},canvas);
 const pts=r.paths[0].pts;let heading=0,last=0,streak=0;const signs=new Set();
 for(let i=1;i<pts.length-1;i++){
  const a=pts[i-1],b=pts[i],c=pts[i+1],ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-b[0],vy=c[1]-b[1];
  const angle=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy),sign=Math.sign(angle);
  heading+=angle;streak=sign===last?streak+1:1;last=sign;signs.add(sign);
  check(streak<=2,'mixed route does not repeat more than two same-side bends');
  check(Math.abs(heading)<=Math.PI*0.85+1e-8,'heading stays within an open fan');
 }
 if(pts.length>=5)eq(signs.size,2,'long open routes bend both left and right');
}
const hero=run({...safeParams,lines:1},{W:297,H:420});
check(hero.paths[0].pts.length>=7,'A3 example keeps a substantial open route');
check(!ribbon._clearStrip([[0,0],[10,0],[10,10],[20,10]],6),'tight opposite corners reserve full tangent reach');
console.log(`[baked] Ribbon Angular — ${checks} checks passed: offset geometry, sharp/bevel joins, 1–6 pens, fitted bounds, legacy Line/Ring hashes and real Style.`);
