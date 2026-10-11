import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as H from '../src/defs/helpers.js';
const lab='nodes-lab/microbes.plotternode.js',baked='src/defs/nodes/microbes.js';
const prototype=()=>new Function(...Object.keys(H),'return '+fs.readFileSync(lab,'utf8'))(...Object.values(H));
const D=fs.existsSync(baked)?(await import('../'+baked)).default:prototype();
const defaults=Object.fromEntries(D.params.map(p=>[p.key,p.def])), ctx={W:297,H:210};
const run=(p={},c=ctx,s)=>D.compute([s],{...defaults,...p},c);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const geom=v=>v.paths.map(({pts,closed})=>({pts,closed}));
const topology=v=>v.paths.map(({pts,closed,layer})=>[pts.length,closed,layer]);
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
function valid(result,p={},c=ctx){
 const params={...defaults,...p}, g=D._region(params,c), pts=result.paths.flatMap(p=>p.pts);
 check(pts.length>0&&pts.length<=110000,'nonempty bounded output');
 check(pts.every(q=>q.length===2&&q.every(Number.isFinite)),'finite 2D points');
 check(pts.every(([x,y])=>x>=g.x-1e-8&&x<=g.x+g.w+1e-8&&y>=g.y-1e-8&&y<=g.y+g.h+1e-8),'inside margin');
 check(result.paths.every(p=>typeof p.closed==='boolean'&&p.pts.length>=(p.closed?3:2)&&Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'valid paths/pens');
 check(result.paths.every(p=>p.pts.every((q,i)=>!i||Math.hypot(q[0]-p.pts[i-1][0],q[1]-p.pts[i-1][1])>1e-9)),'no repeated consecutive vertices');
 check(result.paths.every(p=>!p.closed||Math.hypot(p.pts[0][0]-p.pts.at(-1)[0],p.pts[0][1]-p.pts.at(-1)[1])>1e-9),'closed paths have no duplicate closing vertex');
 // Independently assign every stroke to its reserved disk. These disks are
 // disjoint, so this checks appendages as well as membranes across the loop.
 const centres=D._centres(params,c,Math.round(D._num(params.count,18,1,120)),Math.round(D._num(params.seed,42,-2147483648,2147483647)));
 check(result.paths.every(path=>centres.some(q=>path.pts.every(pt=>Math.hypot(pt[0]-q.x,pt[1]-q.y)<=q.room+1e-8))),'each complete path stays inside one reserved disk');
 for(let i=0;i<centres.length;i++)for(let j=0;j<i;j++)check(centres[i].room+centres[j].room<=Math.hypot(centres[i].x-centres[j].x,centres[i].y-centres[j].y)+1e-7,'specimen disks never overlap');
}
const start=performance.now(),base=run();valid(base);eq(hash(run()),hash(base),'deterministic');
const pristine=JSON.stringify(defaults);run();eq(JSON.stringify(defaults),pristine,'does not mutate params');
eq(D.ins.map(p=>p.type),['style'],'style input');eq(D.outs.map(p=>p.type),['paths'],'paths output');
const organisms=D.params.find(p=>p.key==='organism').options;
for(const organism of organisms)for(const layout of ['Grid','Scattered']){
 const p={organism,layout,count:6,interior:1,filaments:1,amount:1};
 for(const N of [24,48]){
  const zero=run(p,{...ctx,frameIdx:0,frameCount:N});
  for(let frameIdx=0;frameIdx<N;frameIdx++){
   const result=run(p,{...ctx,frameIdx,frameCount:N});valid(result,p);
   eq(topology(result),topology(zero),'stable frame topology');
  }
  eq(run(p,{...ctx,frameIdx:N,frameCount:N}),zero,'exact loop endpoint');
  eq(run({...p,clock:'Manual',time:0.5}),run(p,{...ctx,frameIdx:N/2,frameCount:N}),'manual/timeline parity');
 }
}
for(const motion of ['Still','Drift','Breathe','Swimming']){
 const p={motion,clock:'Manual'},a=run({...p,time:0}),b=run({...p,time:0.23});
 if(motion==='Still')eq(a,b,'Still ignores time');else check(hash(a)!==hash(b),motion+' moves');
 eq(run({...p,amount:0,time:0}),run({...p,amount:0,time:0.5}),'zero amount freezes');
}
// Checking only t=0 and t=1 would miss a sawtooth jump hidden by modulo.
// Compare both one-sided velocities across the seam at a fractional amount.
for(const organism of organisms)for(const amount of [0.35,0.65,1]){
 const p={organism,count:1,size:200,amount,clock:'Manual',filaments:1};
 const eps=0.00001,a=run({...p,time:0}).paths.flatMap(p=>p.pts),left=run({...p,time:1-eps}).paths.flatMap(p=>p.pts),right=run({...p,time:eps}).paths.flatMap(p=>p.pts);
 check(a.every((q,i)=>q.every((v,k)=>Math.abs(2*v-left[i][k]-right[i][k])<0.00001)),'smooth periodic seam at fractional motion');
}
for(const organism of organisms){
 const p={organism,count:1,size:200,interior:1,filaments:1,amount:1};valid(run(p),p);
 const outline=run({organism,count:1,membrane:'Single',interior:0,filaments:0});
 eq(outline.paths.length,1,'single bare specimen');check(outline.paths[0].closed,'closed membrane');
 const dense={...p,count:120,size:2000,margin:0};valid(run(dense,{W:10000,H:10000}),dense,{W:10000,H:10000});
}
for(const c of [{W:10,H:10},{W:1000,H:10},{W:10,H:1000}]){const p={margin:0,count:120,size:200};valid(run(p,c),p,c);}
for(let colours=1;colours<=6;colours++){
 const r=run({colours});eq(geom(r),geom(base),'pens do not move geometry');eq(new Set(r.paths.map(p=>p.layer)).size,colours,'all requested pens present');
}
check(run({colours:6,layer:2,pen2:2,pen3:2,pen4:2,pen5:2,pen6:2}).paths.every(p=>p.layer===2),'duplicate pens merge');
for(const [k,v] of Object.entries({seed:9,count:7,size:15,variation:0,layout:'Grid',membrane:'Single',interior:0,filaments:0,amount:1,margin:30,organism:'Cell'}))check(hash(run({[k]:v}))!==hash(base),k+' changes drawing');
eq(run({}, {W:0,H:0}).paths,[],'empty page');eq(run({margin:100},{W:10,H:20}).paths,[],'exhausted margin');
const malformed=Object.fromEntries(D.params.filter(p=>['slider','seed','pen'].includes(p.type)).map(p=>[p.key,NaN]));valid(run(malformed),malformed);
const wired={count:1e9,size:Infinity,variation:-500,interior:1e9,filaments:1e9,colours:99,layer:-9,pen2:99,margin:-2};valid(run(wired),wired);
const style={kind:'style',mode:'Dashed',dash:1,gap:1,vary:0,phase:0,seed:1};
eq(run({count:1},ctx,style),H.applyStyle(run({count:1}),style),'actual wired style helper');
eq(run({},ctx,{kind:'style',mode:'Solid'}),base,'solid style unchanged');
if(fs.existsSync(lab)&&fs.existsSync(baked))eq(prototype().compute([],defaults,ctx),base,'prototype/baked parity');
const before=performance.now();for(let i=0;i<100;i++)run();
console.log(`Microbes: ${checks} checks passed; ${base.paths.length} paths / ${base.paths.reduce((n,p)=>n+p.pts.length,0)} points; mean ${((performance.now()-before)/100).toFixed(1)} ms, suite ${(performance.now()-start).toFixed(0)} ms.`);

// Optional real UI captures: Help → Living microscope, select Microbes,
// 24 frames, frame index 18, route optimisation off. Read the actual export
// textareas after EXPORT SVG / GENERATE G-CODE, not a re-created serializer.
if(process.argv.includes('--browser-captures')){
 const svg=fs.readFileSync('/tmp/microbes-browser.svg','utf8'),gc=fs.readFileSync('/tmp/microbes-browser.gcode','utf8');
 const patch=JSON.parse(fs.readFileSync('docs/microbes/living-microscope.muusia.json','utf8'));
 const expected=D.compute([],patch.root.nodes[0].params,{...patch.canvas,frameIdx:18,frameCount:24}).paths;
 const pens=[...new Set(expected.map(p=>p.layer))].sort((a,b)=>a-b),ordered=pens.flatMap(L=>expected.filter(p=>p.layer===L));
 const f2=v=>Math.round(v*100)/100;
 const wanted=ordered.map(p=>'M'+p.pts.map(q=>q.map(f2).join(',')).join('L')+(p.closed?'Z':''));
 eq([...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]),wanted,'browser SVG geometry, ordering and closures');
 check(svg.includes('width="297mm" height="210mm"'),'browser SVG A4 page');
 eq([...svg.matchAll(/<g id="pen-(\d+)-/g)].map(m=>+m[1]),pens,'SVG has six pen groups');
 let down=false,current=null,position=null;const strokes=[];
 for(const line of gc.split('\n')){
  const servo=line.match(/^SET_SERVO SERVO=pen ANGLE=([\d.]+)/);
  if(servo){
   if(+servo[1]===35){check(!down,'fresh pen down');down=true;current=[position];}
   else if(+servo[1]===90){if(down)strokes.push(current);down=false;current=null;}
  }
  const move=line.match(/^G([01]) X(-?[\d.]+) Y(-?[\d.]+)/);
  if(move){check(move[1]!=='0'||!down,'no pen-down rapid travel');position=[+move[2],+move[3]];if(down)current.push(position);}
 }
 check(!down,'ends pen up');
 eq(strokes,ordered.map(p=>(p.closed?[...p.pts,p.pts[0]]:p.pts).map(q=>q.map(f2))),'actual G-code pen-down strokes match node geometry');
 check(!gc.includes('OUT OF BOUNDS'),'no out-of-bounds motion');
 const sha=v=>createHash('sha256').update(v).digest('hex');
 fs.writeFileSync('docs/microbes/browser-checks.json',JSON.stringify({
  capturedAt:new Date().toISOString(),baseCommit:'9fd9c4eedfef3c0796823d5763ea63d5c9e0eb77',appVersion:'2.116',workingTree:true,
  method:'Fresh app load after bake; Help Living microscope; selected Microbes; 24 frames, frame index 18; route optimisation off. Actual browser export textareas saved after EXPORT SVG / GENERATE G-CODE. Servo A defaults, zero origin, flip Y off. SVG and G-code match all rounded points and closures. No hardware or successful batch-download claim.',
  frameIndex:18,frames:24,paths:expected.length,pens,svgSha256:sha(svg),gcodeSha256:sha(gc),
  sourceHashes:Object.fromEntries(['src/defs/nodes/microbes.js','src/defs/helpers.js','src/examples.js'].map(file=>[file,sha(fs.readFileSync(file))]))
 },null,2)+'\n');
 console.log('Actual browser SVG and G-code: 297 paths, six pens and A4 dimensions verified.');
}
