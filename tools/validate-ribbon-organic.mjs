/** Real-helper tests for Ribbon Organic and frozen pre-extension geometry. */
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import n from '../src/defs/nodes/ribbon.js';import {applyStyle,pathLength} from '../src/defs/helpers.js';
const d=Object.fromEntries(n.params.map(p=>[p.key,p.def])),ctx={W:297,H:420};
const run=(p={},c=ctx,ins=[])=>n.compute(ins,{...d,shape:'Organic',...p},c);
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
let checks=0;const ok=(b,m)=>{assert.ok(b,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function valid(r,p={},c=ctx){const m=Math.min(p.margin??12,Math.min(c.W,c.H)/2),pts=r.paths.flatMap(p=>p.pts);ok(r.paths.length>0,'nonempty');ok(pts.length<=110000,'point budget');ok(pts.every(q=>q.length===2&&q.every(Number.isFinite)),'finite xy');ok(pts.every(([x,y])=>x>=m-1e-7&&y>=m-1e-7&&x<=c.W-m+1e-7&&y<=c.H-m+1e-7),'on sheet');ok(r.paths.every(p=>p.pts.length>=(p.closed?3:2)&&typeof p.closed==='boolean'&&Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'valid paths');ok(r.paths.every(p=>pathLength(p.pts,p.closed)>1e-8),'no zero length strokes');}
const start=performance.now();
// Captured from the unchanged pre-extension ribbon, base fec272d.
for(const [p,expected]of [
 [{shape:'Line',seed:999},'ae0fe0a4af361a6eb4e080943dac58e47ea1870ea4fd8702c9b8f3485e68e009'],
 [{shape:'Ring',colours:6},'3bde8be2b6b26dfb2dc7f701746cda3ff8f3c64352ee300e3f7e2fcb8cfcc44d'],
 [{shape:'Angular',angularLayout:'Free folds'},'23f19d2ed93f4b5f56eb2c31587472eaca7c154d4c7c4d79500a77d921c07e68'],
 [{shape:'Angular',angularLayout:'No crossings'},'203e4577438be43d33ca8e7870638f2404de627eb7b1488f4b7dfaae9226af55'],
 [{shape:'Angular',angularLayout:'Zigzag',colours:6},'f14483074e13db7f1fcfcaf9124790e934624942c7817120e3795793aebdd213'],
 [{shape:'Angular',angularLayout:'Star',colours:6},'82b8037b46522fb64641ab54706b4f4e24b066902430f26bd62ccbcdf5486577'],
])eq(hash(run(p,{W:210,H:297})),expected,'legacy '+JSON.stringify(p));
ok(new Set(n.params.map(p=>p.key)).size===n.params.length,'unique descriptors');ok(n.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'valid select defaults');
for(const organicForm of ['Pleated','Channels'])for(const pocketFill of ['Open','Outline','Hatch'])for(const seed of [0,18,27,42]){
 const p={organicForm,pocketFill,seed,width:90,lines:32,colours:6,rotate:37},r=run(p);valid(r,p);eq(hash(r),hash(run(p)),'determinism');eq(new Set(r.paths.map(p=>p.layer)).size,6,'six pens used');
}
const base=run();valid(base);eq(base.paths.length,d.lines,'one continuous stroke per filament');
for(const p of [{seed:7},{bends:1},{flares:1},{twist:0},{taper:0},{ripple:0},{wander:0},{width:60},{widthVar:0},{rotate:45}])ok(hash(run(p))!==hash(base),'meaningful '+JSON.stringify(p));
const channels=run({organicForm:'Channels'});ok(hash(channels)!==hash(base),'different forms');
for(const p of [{pockets:0},{pockets:6},{pocketSize:.3},{pocketFill:'Outline'},{pocketFill:'Hatch'}])ok(hash(run({organicForm:'Channels',...p}))!==hash(channels),'meaningful pocket control');
const geom=r=>r.paths.map(({pts,closed})=>({pts,closed}));
for(const organicForm of ['Pleated','Channels'])for(const pocketFill of ['Open','Hatch'])eq(geom(run({organicForm,pocketFill,colours:6})),geom(run({organicForm,pocketFill,colours:1})),'palette preserves geometry');
ok(run({colours:1,layer:5}).paths.every(p=>p.layer===5),'selected single pen');
for(const lines of [1,2,200]){const r=run({lines});valid(r);eq(r.paths.length,lines,'requested full filaments');}
for(const c of [{W:210,H:297},{W:420,H:297},{W:100,H:100},{W:30,H:25},{W:1500,H:8000}])valid(run({},c),{},c);
for(const organicForm of ['Pleated','Channels']){const p={organicForm,width:400,lines:200,wander:300,bends:8,flares:8,twist:6,ripple:8,pockets:8,pocketFill:'Hatch',pocketPitch:.001,rotate:147,margin:0};valid(run(p,{W:800,H:1000}),p,{W:800,H:1000});}
eq(run({margin:60},{W:100,H:100}).paths,[],'empty margin');eq(run({}, {W:0,H:100}).paths,[],'empty page');
const malformed=Object.fromEntries(n.params.filter(p=>['slider','pen','seed'].includes(p.type)).map(p=>[p.key,NaN]));valid(run(malformed));
const straight={width:60,wander:0,widthVar:0,taper:0,ripple:0,twist:0,lines:2};
const r=run(straight),xs=r.paths.flatMap(p=>p.pts.map(q=>q[0]));ok(Math.abs(Math.max(...xs)-Math.min(...xs)-60)<1e-8,'physical width unchanged when fitting unnecessary');
ok(Math.abs(pathLength(r.paths[0].pts,false)-(ctx.H-24)*.94)<1e-8,'straight filament exact physical length');
eq(run({organicForm:'Pleated',pockets:7,pocketFill:'Hatch'}),base,'channel-only controls do not alter pleats');
const style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,phase:0,seed:2};eq(run({},ctx,[style]),applyStyle(base,style),'actual Style helper');
const old=structuredClone(base);run({colours:6});eq(base,old,'subsequent compute does not mutate results');
eq(n.overlay({...d,shape:'Organic'},ctx),[{kind:'rect',x:12,y:12,w:273,h:396}],'margin overlay');
// Pocket cross-sections independently retain the rails and skip the open interval.
const p={...d,shape:'Organic',organicForm:'Channels',width:90,pockets:4,pocketSize:.8},surface=n._organicSurface(p,ctx);
for(const q of surface.pockets)for(const offset of [-.7,0,.7]){
 const t=q.t+q.span*offset,r=q.r*(1-offset*offset)**2,values=[];
 for(let i=0;i<=100;i++){const v=surface.deflect(t,2*i/100-1);values.push(v);ok(v<=q.v-r+1e-8||v>=q.v+r-1e-8,'filaments never occupy pocket cross-section');}
 ok(values.every((v,i)=>!i||v>=values[i-1]),'channel filaments retain order');eq([values[0],values.at(-1)],[-1,1],'outer rails preserved');
}
// Hatch endpoint/midpoint containment is checked against emitted polygon boundaries.
const fill=run({organicForm:'Channels',pocketFill:'Hatch',width:90,lines:30,pockets:4}),polys=fill.paths.filter(p=>p.closed);
const inside=(q,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const hatches=fill.paths.slice(30+polys.length);ok(hatches.length>0,'actual pocket hatching');ok(hatches.every(p=>p.pts.length===2&&polys.some(poly=>inside([(p.pts[0][0]+p.pts[1][0])/2,p.pts[0][1]],poly.pts))),'every hatch midpoint inside a pocket');
eq(fill.paths.slice(0,30),run({organicForm:'Channels',pocketFill:'Open',width:90,lines:30,pockets:4}).paths,'fill leaves every filament unchanged');
const sparse=run({organicForm:'Channels',pocketFill:'Hatch',width:90,pocketPitch:1});ok(sparse.paths.length<run({organicForm:'Channels',pocketFill:'Hatch',width:90,pocketPitch:.2}).paths.length,'physical hatch pitch controls density');
console.log(`Ribbon Organic: ${checks} checks passed (${Math.round(performance.now()-start)} ms).`);
