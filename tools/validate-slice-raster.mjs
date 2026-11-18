import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseAst} from 'rolldown/parseAst';
import N from '../src/defs/nodes/slice_raster.js';
import {Pin,EMPTY,mulberry32,applyStyle,PENS,pathLength} from '../src/defs/helpers.js';
import {DEFAULT_MACHINE,DEFAULT_MACHINE_B,needleExportError} from '../src/machine.js';
import {EXAMPLES} from '../src/examples.js';
import {defaults,toSVG,generate} from './preview-slice-raster.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},hash=JSON.stringify;
const ctx={W:150,H:110};
const image=(fn,w=48,h=32)=>({w,h,g:Array.from({length:w*h},(_,i)=>fn((i%w+.5)/w,(Math.floor(i/w)+.5)/h))});
const ramp=image((x,y)=>.15+.7*x+.1*Math.sin(y*7)),black=image(()=>1),white=image(()=>0);
const node=img=>({data:{img}});
const run=(over={},img=ramp,c=ctx)=>N.compute([],{...defaults,...over},c,img?node(img):undefined);
const layout=(over={},img=ramp,c=ctx)=>N._layout({...defaults,...over},c,img?node(img):undefined);
function inside(q,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<a[0]+(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1]))hit=!hit;}return hit;}
function distance(q,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);}
function covered(q,poly){return inside(q,poly)||poly.some((a,i)=>distance(q,a,poly[(i+1)%poly.length])<1e-5);}
function valid(r,over={},img=ramp,c=ctx,nonempty=true){
 const G=layout(over,img,c),ps=r.paths,pts=ps.flatMap(p=>p.pts);
 if(nonempty)ok(ps.length>0,'nonempty '+hash(over));
 ok(pts.length<=110000,'complete bounded output '+pts.length);
 ok(ps.every(p=>p.pts.length>=2&&p.closed===false&&Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'real pen path contract');
 ok(pts.every(q=>q.length===2&&q.every(Number.isFinite)&&q[0]>=G.box.x0-1e-5&&q[0]<=G.box.x1+1e-5&&q[1]>=G.box.y0-1e-5&&q[1]<=G.box.y1+1e-5),'finite image-fit bounds');
 ok(ps.every(p=>p.pts.every((q,i)=>!i||Math.hypot(q[0]-p.pts[i-1][0],q[1]-p.pts[i-1][1])>1e-8)),'no zero-length segments');
 ok(ps.every(p=>G.configs[p.slice-1].pen===p.layer),'per-slice pen');
 for(const p of ps){const regions=G.regions.filter(r=>r.id===p.slice);for(let i=1;i<p.pts.length;i++){const a=p.pts[i-1],b=p.pts[i];for(const t of [0,.5,1])assert(regions.some(r=>covered([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],r.poly)),'stroke clipped to its own convex region');}}
 checks++;
}
const base=run();valid(base);ok(hash(run())===hash(base),'deterministic repeated evaluation');
for(const layoutName of ['Strips','Grid','Collage'])for(const count of [1,2,4,6,8])for(const phase of [0,37,180,360]){
 const over={layout:layoutName,count,phase,gap:0,sliceAngle:31},G=layout(over),expected=(G.box.x1-G.box.x0)*(G.box.y1-G.box.y0);
 const area=G.regions.reduce((sum,r)=>sum+Math.abs(r.poly.reduce((a,q,i)=>{const b=r.poly[(i+1)%r.poly.length];return a+q[0]*b[1]-b[0]*q[1];},0))/2,0);
 ok(Math.abs(area-expected)<1e-6,'partition preserves total area');
 for(let y=0;y<13;y++)for(let x=0;x<17;x++){const q=[G.box.x0+G.w*(x+.173)/17,G.box.y0+G.h*(y+.317)/13];assert.equal(G.regions.filter(r=>inside(q,r.poly)).length,1,'one region covers each independent probe');}checks++;
}
const styles=['Lines','Dots','Crosshatch','Waves','Squares','Diamonds'];
const styleHashes=new Set();
for(const raster1 of styles){const over={count:1,raster1,pitch1:2.2,angle1:23};const r=run(over);valid(r,over);styleHashes.add(hash(r));
 const a=run(over,image(()=>.25)),b=run(over,image(()=>.8));
 const length=r=>r.paths.reduce((n,p)=>n+pathLength(p.pts,p.closed),0);
 ok(length(b)>length(a),'more darkness gives more real ink '+raster1);
 ok(!run(over,white).paths.length,'white image empty '+raster1);
 valid(run(over,black),over,black);
}
ok(styleHashes.size===6,'six distinct plotter rasters');
for(const layoutName of ['Strips','Grid','Collage'])for(const phase of [0,71,180]){const over={layout:layoutName,count:6,phase,pen1:0,pen2:1,pen3:2,pen4:3,pen5:4,pen6:5};valid(run(over),over);}
for(const over of [{count:6},{sliceAngle:62},{gap:3},{fit:'Cover'},{phase:47},{contrast:.7},{gamma:1.8},{cutoff:.3},{invert:true},{raster1:'Diamonds'},{share1:2},{angle1:60},{pitch1:2.5},{strength1:.4},{pen1:4},{fillPitch:.6},{waveHeight:0},{waveLength:9}]){const r=run(over);valid(r,over);ok(hash(r)!==hash(base),'live parameter '+hash(over));}
ok(hash(run({advanced:true}))===hash(base),'Advanced affects visibility only');
for(const count of [0,1.2,1.6,99]){const active=Math.max(1,Math.min(8,Math.round(count)));const visible=N.params.filter(d=>/^raster[1-8]$/.test(d.key)&&d.showIf({...defaults,count}));ok(visible.length===active,'slice control visibility follows actual clamped count '+count);}
ok(hash(run({seed:1,columns:8}))===hash(base),'inactive layout settings ignored');
ok(hash(run({layout:'Collage',seed:1}))!==hash(run({layout:'Collage',seed:2})),'collage seed changes partition');
ok(hash(run({layout:'Grid',columns:1}))!==hash(run({layout:'Grid',columns:3})),'grid columns live');
// On ordinary-sized drawings a raster/pen/pitch change stays within its own slice.
for(const over of [{raster2:'Squares'},{pitch2:4},{angle2:63},{strength2:.5},{pen2:7}])ok(hash(run(over).paths.filter(p=>p.slice!==2))===hash(base.paths.filter(p=>p.slice!==2)),'other slice screens unchanged '+hash(over));
const off=run({raster2:'Off'});ok(off.paths.every(p=>p.slice!==2),'off removes chosen slice');ok(hash(off.paths)===hash(base.paths.filter(p=>p.slice!==2)),'off preserves other ordinary screens');
ok(hash(run({phase:360}))===hash(base),'manual exact phase wrap');
for(const layoutName of ['Strips','Grid','Collage']){
 const p={...defaults,layout:layoutName,motion:'Timeline',cycles:2};
 const frame=i=>N.compute([],p,{...ctx,frameIdx:i,frameCount:24},node(ramp));
 ok(hash(frame(0))===hash(frame(24)),'timeline exact loop '+layoutName);
 ok(hash(frame(0))!==hash(frame(7)),'timeline moves masks '+layoutName);
 frame(19);ok(hash(frame(7))===hash(frame(7)),'scrubbing order independent '+layoutName);
 ok(hash(N.compute([],{...p,phase:123},{...ctx,frameIdx:7,frameCount:24},node(ramp)))===hash(frame(7)),'Timeline ignores manual phase');
}
ok(hash(run({count:1,phase:90}))===hash(run({count:1,phase:0})),'one slice has no artificial seam');
// Registration is independent from the layout or its moving masks.
const reference=layout({contrast:1,gamma:1,cutoff:0});
for(const over of [{count:8},{layout:'Grid'},{layout:'Collage',seed:3},{phase:177},{share1:3},{pitch2:7}]){
 const G=layout({...over,contrast:1,gamma:1,cutoff:0});
 assert.deepEqual(G.box,reference.box);for(const [u,v]of [[.2,.3],[.5,.5],[.8,.7]]){const x=G.box.x0+u*G.w,y=G.box.y0+v*G.h;assert.equal(G.rawSample(x,y),reference.rawSample(x,y));}checks++;
}
const snap=hash(ramp);run({},ramp);ok(hash(ramp)===snap,'loaded image immutable');
valid(run({},null),{},null);ok(!run({source:'Image file'},null).paths.length,'explicit image source requires image');
ok(hash(run({source:'Tone study'},black))===hash(run({source:'Tone study'},white)),'tone study ignores loaded file');
ok(hash(run({source:'Image file'}))===hash(base),'Auto uses loaded image');
for(const c of [{W:0,H:100},{W:NaN,H:100},{W:-1,H:100},{W:20,H:20}])ok(!run({},ramp,c).paths.length,'invalid page empty');
ok(!run({margin:1000}).paths.length,'impossible margin empty');
ok(!run({source:'Image file'},{w:2,h:2,g:[0]}).paths.length,'malformed image empty');
const allOff=Object.fromEntries(Array.from({length:8},(_,i)=>['raster'+(i+1),'Off']));ok(!run({...allOff,count:8}).paths.length,'all Off empty');
const dense={count:8,layout:'Grid',columns:4,...Object.fromEntries(Array.from({length:8},(_,i)=>['raster'+(i+1),'Dots'])),...Object.fromEntries(Array.from({length:8},(_,i)=>['pitch'+(i+1),.4]))};
const huge={W:841,H:594},large=run(dense,black,huge);valid(large,dense,black,huge);ok(new Set(large.paths.map(p=>p.slice)).size===8,'dense output retains every final slice');
const style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,seed:3};ok(hash(N.compute([style],defaults,ctx,node(ramp)))===hash(applyStyle(base,style)),'Style applied to complete result');
ok(N.overlay(defaults,ctx,[],node(ramp)).length===4,'all slice guides');ok(!N.overlay({...defaults,source:'Image file'},ctx,[],{}).length,'missing image guide safe');
// Actual built-in SVG and servo/bed-Z exporters.
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(app,{lang:'jsx'});const fn=name=>{const d=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return app.slice(d.start,d.end);};
const toGcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',fn('toGcode')+';return toGcode;')(PENS,pathLength,needleExportError,'test');
for(const r of [base,run({layout:'Collage',count:6})]){
 ok((toSVG(r,ctx).match(/<path /g)||[]).length===r.paths.length,'SVG preserves every stroke');
 for(const prof of [DEFAULT_MACHINE,DEFAULT_MACHINE_B]){const code=toGcode(r,ctx,{...prof,workW:1000,workH:1000}),lines=code.split('\n'),down=prof.zMode==='servo'?l=>l.includes(`ANGLE=${prof.servoDown} ; pen down`):l=>l===`G1 Z${prof.penDown} F${prof.zFeed}`;ok(lines.filter(down).length===r.paths.length,'one lower per real stroke');ok(lines.filter(l=>/^G1 X/.test(l)).length===r.paths.reduce((n,p)=>n+p.pts.length-1,0),'all draw moves exported');ok(!code.includes('OUT OF BOUNDS'),'no machine bounds warning');}
}
const esm=fs.readFileSync(new URL('../src/defs/nodes/slice_raster.js',import.meta.url),'utf8'),expression=esm.slice(esm.indexOf('export default ')+15).trim().replace(/;$/,'');
const imported=new Function('Pin','EMPTY','mulberry32','applyStyle','return ('+expression+');')(Pin,EMPTY,mulberry32,applyStyle);ok(hash(imported.compute([],defaults,ctx,node(ramp)))===hash(base),'portable node exact parity');
// The wired graph is exercised with its actual Lettering output by validate-slice-raster-input.mjs.
for(const ex of EXAMPLES.filter(e=>e.name.startsWith('Slice Raster · ')&&!e.make(()=>({...defaults})).edges.length)){const g=ex.make(()=>({...defaults})),p=g.nodes[0].params;valid(run(p,null,ex.canvas),p,null,ex.canvas);}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'slice-raster-check-'));try{const records=generate(temp);ok(records.length===5,'five portable starters');for(let i=1;i<=5;i++){const patch=JSON.parse(fs.readFileSync(path.join(temp,'slice-raster-'+i+'.muusia.json'),'utf8'));ok(patch.app==='muusia'&&patch.root.nodes.at(-1).type==='slice_raster'&&patch.customNodes[0].source.includes('_layout'),'portable project includes own node');}}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Slice Raster: '+checks+' checks passed; registered image, six rasters, partitions, independent settings, clipping, dense complete output, loops, portable projects and native SVG/G-code.');
