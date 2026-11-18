import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAst} from 'rolldown/parseAst';
import {EXAMPLES} from '../src/examples.js';
import * as H from '../src/defs/helpers.js';
import {DEFAULT_MACHINE,DEFAULT_MACHINE_B,needleExportError} from '../src/machine.js';
import {N,defaults,source,canvas,presets,evaluate,toSVG,nodeDefaults} from './preview-eyelashes.mjs';
let checks=0,frames=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},hash=JSON.stringify;
const run=(over={},art,ctx=canvas)=>N.compute([undefined,art],{...defaults(),time:'Manual',...over},ctx,{});
const flat=r=>r.paths.flatMap(q=>q.pts);
function valid(r,ctx=canvas,nonempty=true){
 if(nonempty)ok(r.paths.length>0,'nonempty completed drawing');
 ok(flat(r).length<=120000,'bounded complete points');
 ok(r.paths.every(q=>q.pts.length>=(q.closed?3:2)&&Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12),'valid stroke and pen contract');
 ok(flat(r).every(q=>q.length===2&&q.every(Number.isFinite)&&q[0]>=-1e-6&&q[1]>=-1e-6&&q[0]<=ctx.W+1e-6&&q[1]<=ctx.H+1e-6),'finite on-page XY only');
 ok(r.paths.every(q=>q.pts.every((p,i)=>!i||Math.hypot(p[0]-q.pts[i-1][0],p[1]-q.pts[i-1][1])>1e-10)),'no zero-length consecutive moves');
}
function near(a,b,tol=1e-6){return Math.hypot(a[0]-b[0],a[1]-b[1])<=tol;}
function inside(q,polygon){
 let winding=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  if(Math.hypot(q[0]-a[0]-dx*t,q[1]-a[1]-dy*t)<1e-5)return true;
  if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])winding=!winding;
 }return winding;
}
function eyeContained(r,p,ctx=canvas){
 const F=N._frame(p,ctx),P=N._pose(p,F,N._opening(p,ctx)),poly=P.mask.map(F.map),eye=r.paths.filter(q=>q.role==='eye');
 if(!poly.length){ok(eye.length===0,'closed lid hides all iris/artwork');return;}
 for(const q of eye)for(let i=0;i<q.pts.length-(q.closed?0:1);i++){
  const a=q.pts[i],b=q.pts[(i+1)%q.pts.length];for(const t of [0,.25,.5,.75,1])assert(inside([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],poly),'eye ink never bridges through a masked region');
 }checks++;
}
const baseline=run();valid(baseline);eq(run(),baseline,'repeatability');
eq(N.ins.map(q=>q.type),['style','paths'],'Style and blue artwork input');
for(const shape of ['Almond','Oval','Swept'])for(const iris of ['Round','Radiant','Slit','Spiral'])for(const open of [0,8,50,100]){
 const p={...defaults(),time:'Manual',shape,iris,open},r=N.compute([],p,canvas,{});valid(r);eyeContained(r,p);
}
for(const seed of [0,1,72,999,-5])for(const angle of [-170,-35,0,68,180]){const r=run({seed,angle});valid(r);ok(flat(r).every(q=>q[0]>=12-1e-6&&q[1]>=12-1e-6&&q[0]<=canvas.W-12+1e-6&&q[1]<=canvas.H-12+1e-6),'fitted bounds across rotation and seed');}
ok(hash(run({seed:73}))!==hash(baseline),'seed changes actual geometry');
const upper=run({lower:false});ok(upper.paths.every(q=>q.lid!=='lower'),'lower lid off removes lower outline, roots and lashes');ok(upper.paths.some(q=>q.lid==='upper'&&q.role==='lash'),'upper lashes retained');
ok(run({drawLid:false}).paths.every(q=>q.role!=='lid'),'lid line optional');
ok(run({count:0}).paths.every(q=>q.role!=='lash'&&q.role!=='root'),'zero lashes removes all lash ink');
ok(run({lowerCount:0}).paths.every(q=>q.lid!=='lower'||q.role==='lid'),'lower density zero preserves its outline only');
for(const over of [{count:150},{length:12},{variation:0},{clumping:0},{clumps:20},{curl:-60},{lean:-40},{disorder:0},{ink:0},{rootWidth:2},{pitch:.8},{lowerCount:90},{lowerLength:90},{shape:'Oval'},{width:220},{height:44},{angle:17},{iris:'Round'},{irisSize:60},{pupil:60},{lookX:40},{lookY:45}]){const r=run(over);valid(r);ok(hash(r)!==hash(baseline),'live control '+hash(over));}
eq(run({ink:0,rootWidth:.1,pitch:.15}),run({ink:0,rootWidth:3,pitch:1}),'hidden root fill controls do not affect ink-zero result');
eq(run({lower:false,lowerCount:10,lowerLength:10}),run({lower:false,lowerCount:100,lowerLength:100}),'hidden lower settings ignored');
for(const loops of [0,1,2,5]){
 const p={...defaults(),time:'Timeline',loops};
 const frame=i=>N.compute([],p,{...canvas,frameIdx:i,frameCount:24},{});
 eq(frame(0),frame(24),'exact loop endpoint '+loops);frame(20);eq(frame(7),frame(7),'random access deterministic');
 if(loops===0)eq(frame(0),frame(17),'zero loops freezes phase');else ok(hash(frame(0))!==hash(frame(18/loops)),'cycle actually closes');
}
const f=N._frame(defaults(),canvas);eq(hash(N._frame({...defaults(),open:0,time:'Manual'},canvas)),hash(f),'pose-independent frame');
ok(N._opening({...defaults(),time:'Timeline'},{frameIdx:18,frameCount:24})===0,'default 24-frame cycle fully closes at frame 18');
ok(N._opening({...defaults(),time:'Timeline'},{frameIdx:0,frameCount:24})===1,'cycle starts fully open');
const closed=run({open:0});ok(closed.paths.filter(q=>q.role==='lid').length===1,'closed coincident lids drawn once');
// Thick roots are real closed/fill geometry, all meeting at one sharp tip.
const spikeParams={...defaults(),time:'Manual',form:'Tapered spikes',spikeWidth:3,count:80,lower:false},spikes=N.compute([],spikeParams,canvas,{}),spikeFrame=N._frame(spikeParams,canvas);
valid(spikes);
const outlines=spikes.paths.filter(q=>q.spike&&q.outline);
ok(outlines.length===80,'one complete tapered outline for every requested lash');
for(const q of outlines){
 const steps=(q.pts.length-1)/2;ok(q.closed&&Number.isInteger(steps),'each spike is a closed pointed silhouette');
 const widths=Array.from({length:steps+1},(_,j)=>Math.hypot(q.pts[j][0]-q.pts[2*steps-j][0],q.pts[j][1]-q.pts[2*steps-j][1]));
 ok(widths[0]>=3*.6*spikeFrame.scale-1e-7&&widths[0]<=3*spikeFrame.scale+1e-7,'base width is physical filled geometry');
 ok(widths.at(-1)===0&&widths.every((w,j)=>!j||w<widths[j-1]+1e-8),'flanks taper monotonically to one sharp tip');
 const fills=spikes.paths.filter(f=>f.spike&&!f.outline&&f.hair===q.hair&&f.lid===q.lid);
 ok(fills.length>0,'spike interior contains real fill strokes');
 for(const fill of fills)for(let j=0;j<=steps;j++){
  const a=q.pts[j],b=q.pts[2*steps-j],v=fill.pts[j],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;
  assert(!l||((v[0]-a[0])*dx+(v[1]-a[1])*dy)/l>=-1e-6&&((v[0]-a[0])*dx+(v[1]-a[1])*dy)/l<=1+1e-6,'fill stays between both flanks');
 }
}
eq(run({form:'Hairs',spikeWidth:.3}),run({form:'Hairs',spikeWidth:6}),'hidden spike width does not affect Hairs');
ok(hash(run({form:'Tapered spikes',spikeWidth:1}))!==hash(run({form:'Tapered spikes',spikeWidth:4})),'spike base width changes plotted silhouettes');
// Independent segment fixtures: a concave mask must split a crossing into two.
const U=[[0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10]],cross={pts:[[-5,6],[15,6]],closed:false,layer:4};
const cut=N._clip([cross],U);ok(cut.paths.length===2,'concave mask keeps separated intervals');
eq(cut.paths.map(q=>q.pts),[[[0,6],[3,6]],[[7,6],[10,6]]],'exact independent clipping intersections');
const box=[[0,0],[10,0],[10,10],[0,10]],square={pts:[[2,2],[8,2],[8,8],[2,8]],closed:true,layer:7};
const kept=N._clip([square],box);ok(kept.paths.length===1&&kept.paths[0].closed,'fully visible closed source stays closed');
eq(kept.paths[0].pts,square.pts,'closed source has no duplicate closing point');
const chopped=N._clip([{pts:[[2,2],[12,2],[12,8],[2,8]],closed:true,layer:7}],box);ok(chopped.paths.every(q=>!q.closed),'clipped contours remain open');
for(const q of chopped.paths)for(let i=1;i<q.pts.length;i++)ok(Math.abs(q.pts[i][0]-q.pts[i-1][0])<1e-8||Math.abs(q.pts[i][1]-q.pts[i-1][1])<1e-8,'no false diagonal seam');
// A large stationary drawing is clipped by each closing lid, retaining input pens.
const art={paths:Array.from({length:23},(_,i)=>({pts:[[-30,canvas.H*i/22],[canvas.W+30,canvas.H*i/22]],closed:false,layer:i%3+4}))};
const snap=hash(art),empty={paths:[]};
for(const fit of ['Cover','Contain','Canvas'])for(const shape of ['Almond','Oval','Swept'])for(const open of [0,2,20,65,100]){
 const p={...defaults(),time:'Manual',content:'Artwork',artFit:fit,shape,open},r=N.compute([undefined,art],p,canvas,{});valid(r);eyeContained(r,p);ok(r.paths.filter(q=>q.role==='eye').every(q=>q.layer>=4&&q.layer<=6),'artwork pens retained');
}
eq(hash(art),snap,'artwork immutable');
ok(run({},empty).paths.every(q=>q.role!=='eye'),'Auto connected EMPTY hides iris fallback');
ok(run({content:'Artwork'},undefined).paths.every(q=>q.role!=='eye'),'explicit artwork without wire has no fallback');
ok(run({content:'None'},art).paths.every(q=>q.role!=='eye'),'None ignores artwork and iris');
eq(run({content:'Iris'},art),run({content:'Iris'},undefined),'explicit Iris ignores wire');
ok(run({content:'Artwork + iris'},empty).paths.some(q=>q.role==='eye'),'combined mode retains iris with empty artwork');
const F=N._frame(defaults(),canvas),mapped=N._artwork(art,defaults(),F);eq(N._artwork(art,{...defaults(),open:0},F),mapped,'artwork does not squash or move as eyelids close');
const rotated=N._frame({...defaults(),angle:33},canvas),canvasArt=N._artwork(art,{...defaults(),artFit:'Canvas'},rotated);
ok(canvasArt.every((q,i)=>q.pts.every((v,j)=>near(rotated.map(v),art.paths[i].pts[j]))),'Canvas artwork stays at original paper coordinates through eye fitting and rotation');
for(const bad of [{},{paths:[{}]},{paths:[{pts:[[0,0],[NaN,2]]}]},{paths:[{pts:[[0,0],[3,Infinity]]}]},{paths:[{pts:[[0,0],[3]]}]}])eq(run({content:'Artwork'},bad),H.EMPTY,'malformed visible artwork refuses whole');
const tooBig={paths:[{pts:Array.from({length:120001},(_,i)=>[i%100,50]),closed:false,layer:0}]};eq(run({content:'Artwork'},tooBig),H.EMPTY,'over-budget source never keeps a prefix');
const withZ={paths:[{pts:[[0,100,4],[297,100,-2]],closed:false,layer:4}]};valid(run({content:'Artwork'},withZ));ok(flat(run({content:'Artwork'},withZ)).every(q=>q.length===2),'artwork depth is stripped to XY');
for(const ctx of [{W:0,H:100},{W:NaN,H:100},{W:100,H:Infinity},{W:10,H:10}])eq(run({},undefined,ctx),H.EMPTY,'invalid canvas refused');
for(const over of [{margin:1000},{width:1e6,height:1e6,length:1e6},{count:1e6,rootWidth:6,pitch:.01,ink:100,lowerCount:100}])valid(run(over),canvas,false);
const style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,seed:3};eq(N.compute([style],{...defaults(),time:'Manual'},canvas,{}),H.applyStyle(baseline,style),'Style applied to actual complete geometry');
const portable=new Function(...Object.keys(H),'return '+source())(...Object.values(H));eq(portable.compute([undefined,art],{...defaults(),content:'Artwork',time:'Manual'},canvas,{}),run({content:'Artwork'},art),'portable exact geometry and dependencies');
for(const preset of presets){for(let i=0;i<24;i++){const {result,ctx,node}=evaluate(preset,i,24);valid(result,ctx);eyeContained(result,node.params,ctx);frames++;}}
const help=EXAMPLES.filter(e=>e.name.startsWith('Eyelashes · '));ok(help.length===6,'six built-in live starters');
for(const preset of presets){const ex=help.find(e=>e.name==='Eyelashes · '+preset.name);eq(ex.make(nodeDefaults),evaluate(preset).graph,'Help and portable graph parity '+preset.name);}
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(q=>q.type==='FunctionDeclaration'&&q.id.name==='toGcode');
const toGcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',app.slice(decl.start,decl.end)+';return toGcode;')(H.PENS,H.pathLength,needleExportError,'test');
for(const preset of [presets[0],presets[1],presets[3],presets[4],presets[5]]){
 const {result,ctx}=evaluate(preset);ok((toSVG(result,ctx).match(/<path /g)||[]).length===result.paths.length,'SVG contains every real stroke');
 for(const prof of [DEFAULT_MACHINE,DEFAULT_MACHINE_B]){
  const code=toGcode(result,ctx,{...prof,workW:1000,workH:1000}),lines=code.split('\n'),down=prof.zMode==='servo'?q=>q.includes('ANGLE='+prof.servoDown+' ; pen down'):q=>q==='G1 Z'+prof.penDown+' F'+prof.zFeed;
  ok(lines.filter(down).length===result.paths.length,'one lower per stroke');ok(lines.filter(q=>/^G1 X/.test(q)).length===result.paths.reduce((n,q)=>n+q.pts.length-(q.closed?0:1),0),'all drawing moves exported');ok(!code.includes('OUT OF BOUNDS'),'no export bounds warning');
 }
}
console.log('Eyelashes: '+checks+' checks passed; '+frames+' actual animation frames, lashes/lower lid, four irises, stable blink, masked stationary artwork, no hidden-gap chords, XY budgets, portable source and native SVG/G-code.');
