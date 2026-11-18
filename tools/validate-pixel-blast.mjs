import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseAst} from 'rolldown/parseAst';
import * as H from '../src/defs/helpers.js';
import {DEFAULT_MACHINE,DEFAULT_MACHINE_B,needleExportError} from '../src/machine.js';
import {N,defaults,toSVG,examples,evaluate,portableSource,generate} from './preview-pixel-blast.mjs';

let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},hash=JSON.stringify,d=defaults(),ctx={W:72,H:100};
const run=(over={},c=ctx)=>N.compute([],{...d,...over},c,{}),count=r=>r.paths.reduce((n,p)=>n+p.pts.length,0);
function valid(r,c=ctx,margin=3,nonempty=true){
 if(nonempty)ok(r.paths.length>0,'nonempty '+hash(c));
 ok(count(r)<=110000,'complete bounded point budget');
 ok(r.paths.every(p=>typeof p.closed==='boolean'&&p.pts.length>=(p.closed?3:2)&&Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'path/pen contract');
 ok(r.paths.every(p=>p.pts.every(q=>q.length===2&&q.every(Number.isFinite)&&q[0]>=margin-1e-7&&q[0]<=c.W-margin+1e-7&&q[1]>=margin-1e-7&&q[1]<=c.H-margin+1e-7)),'finite XY and margin bounds');
 ok(r.paths.every(p=>p.pts.every((q,i)=>!i||Math.hypot(q[0]-p.pts[i-1][0],q[1]-p.pts[i-1][1])>1e-10)),'no zero-length stroke segments');
}
const base=run();valid(base);ok(hash(run())===hash(base),'seeded deterministic');
const hashes=new Set();
for(const effect of N.params[0].options){
 const p={effect,cy:['Mushroom cloud','Ground blast','Fountain'].includes(effect)?82:50};
 const r=run(p);valid(r);hashes.add(hash(r));ok(hash(r)!==hash(run({...p,seed:18})),'seed changes '+effect);
 ok(hash(run({...p,phase:0}))===hash(run({...p,phase:100}))&&!run({...p,phase:0}).paths.length,'empty loop boundary '+effect);
 for(const phase of [8,24,60,82,94])valid(run({...p,phase}),ctx,3,false);
 for(const draw of ['Filled pixels','Pixel outlines'])for(const pixel of [.5,1.25,4])valid(run({...p,draw,pixel,phase:50}));
 const animation={...p,motion:'Timeline',cycles:3,phase:47},frame=i=>run(animation,{...ctx,frameIdx:i,frameCount:32});
 ok(hash(frame(0))===hash(frame(32)),'exact timeline endpoint '+effect);const seven=hash(frame(7));frame(25);ok(seven===hash(frame(7))&&seven!==hash(frame(0)),'random access motion '+effect);
 ok(hash(run({...p,motion:'Manual'},{...ctx,frameIdx:5,frameCount:20}))===hash(run({...p,motion:'Manual'},{...ctx,frameIdx:17,frameCount:20})),'Manual pose frozen');
}
ok(hashes.size===8,'eight distinct effects');
for(const patch of [{phase:63},{pixel:1.2},{fill:100},{draw:'Pixel outlines'},{amount:160},{size:65},{trails:0},{gravity:100},{wind:100},{grain:100},{cx:35},{cy:70},{margin:10},{seed:23},{layer:4}]){valid(run(patch),ctx,patch.margin??3);ok(hash(run(patch))!==hash(base),'live '+hash(patch));}
ok(run({layer:7}).paths.every(p=>p.layer===7),'pen applied');
ok(hash(run({cycles:5}))===hash(base),'inactive Manual cycles ignored');
ok(hash(run({effect:'unknown'}))===hash(base),'unknown effect falls back');
for(const patch of [{effect:'Mushroom cloud',smoke:0},{effect:'Mushroom cloud',smoke:100},{effect:'Ground blast',smoke:0},{effect:'Shockwave',rings:1},{effect:'Shockwave',rings:6}])valid(run({...patch,cy:patch.effect==='Shockwave'?50:82}));
ok(hash(run({effect:'Mushroom cloud',smoke:0}))!==hash(run({effect:'Mushroom cloud',smoke:100})),'smoke density live');
ok(hash(run({effect:'Shockwave',rings:1}))!==hash(run({effect:'Shockwave',rings:6})),'shock ring count live');

// Check actual pen segments against an independently indexed logical pixel map.
for(const patch of [{},{fill:100},{draw:'Pixel outlines'},{effect:'Mushroom cloud',cy:82}]){
 const p={...d,...patch},L=N._layout(p,ctx),{bits}=N._pixels(p,ctx,L),r=run(patch);
 for(const q of r.paths)for(let i=0;i<q.pts.length-(q.closed?0:1);i++)for(const t of [0,.5,1]){const a=q.pts[i],b=q.pts[(i+1)%q.pts.length],x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,c=Math.floor((x-L.x)/L.pitch),row=Math.floor((y-L.y)/L.pitch);assert.equal(bits[row*L.cols+c],1,'ink remains inside occupied pixel cells');}checks++;
 ok(r.paths.every(q=>q.pts.every(([x,y])=>x>=L.x+.149-1e-6&&y>=L.y+.149-1e-6&&x<=L.x+L.cols*L.pitch-.149+1e-6&&y<=L.y+L.rows*L.pitch-.149+1e-6)),'stroke centrelines leave physical 0.3 mm ink in bounds');
}
const stats=(over={})=>{const p={...d,...over},L=N._layout(p,ctx),{bits}=N._pixels(p,ctx,L);let n=0,x=0,y=0,x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++)if(bits[r*L.cols+c]){const X=L.x+(c+.5)*L.pitch,Y=L.y+(r+.5)*L.pitch;n++;x+=X;y+=Y;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y);}return {n,x:x/n,y:y/n,x0,x1,y0,y1,L,bits};};
ok(stats({effect:'Mushroom cloud',cy:84,phase:65}).y0<stats({effect:'Mushroom cloud',cy:84,phase:25}).y0-10,'cloud rises and develops a stem');
const mushroom={effect:'Mushroom cloud',cy:84,size:80,phase:60};
const capWidth=s=>{let lo=Infinity,hi=-Infinity;for(let r=0;r<s.L.rows;r++)for(let c=0;c<s.L.cols;c++)if(s.bits[r*s.L.cols+c]&&s.L.y+(r+.5)*s.L.pitch<s.L.cy-10){const x=s.L.x+(c+.5)*s.L.pitch;lo=Math.min(lo,x);hi=Math.max(hi,x);}return hi-lo;};
ok(capWidth(stats({...mushroom,spread:130}))>capWidth(stats({...mushroom,spread:50}))*1.6,'cap width control changes the elevated cap, independently of ground dust');
ok(stats({...mushroom,rise:120}).y0<stats({...mushroom,rise:50}).y0-10,'cloud rise control changes physical height');
ok(capWidth(stats({...mushroom,phase:65}))>capWidth(stats({...mushroom,phase:32}))*1.5,'cap blooms after the initial column');
ok(stats({...mushroom,phase:90}).n<stats({...mushroom,phase:65}).n*.45,'late smoke breaks up before the loop resets');
for(const patch of [{rise:50},{rise:150},{spread:50},{spread:160},{curl:0},{curl:100},{smoke:0},{smoke:100}]){
 valid(run({...mushroom,...patch}));ok(hash(run({...mushroom,...patch}))!==hash(run(mushroom)),'live mushroom '+hash(patch));
}
const cloudMid=stats({...mushroom,phase:55}),cloudNext=stats({...mushroom,phase:56}),cloudLater=stats({...mushroom,phase:75});
const overlap=(a,b)=>{let both=0,either=0;for(let i=0;i<a.bits.length;i++){if(a.bits[i]&&b.bits[i])both++;if(a.bits[i]||b.bits[i])either++;}return both/either;};
ok(overlap(cloudMid,cloudNext)>.6&&overlap(cloudMid,cloudNext)>overlap(cloudMid,cloudLater),'nearby poses move coherently rather than replacing all smoke');
for(const phase of [20,45,70]){
 const s=stats({...mushroom,phase});let rooted=0;for(let r=0;r<s.L.rows;r++)for(let c=0;c<s.L.cols;c++)if(s.bits[r*s.L.cols+c]){const x=s.L.x+(c+.5)*s.L.pitch,y=s.L.y+(r+.5)*s.L.pitch;if(y>s.L.cy-6&&y<s.L.cy&&Math.abs(x-s.L.cx)<s.L.scale*.12)rooted++;}
 ok(rooted>3,'stem feeds cloud from a stable origin');
}
for(const phase of [12,38,63,87]){const p={...d,...mushroom,phase},portableCloud=new Function(...Object.keys(H),'return '+portableSource())(...Object.values(H));ok(hash(portableCloud.compute([],p,ctx))===hash(N.compute([],p,ctx)),'new mushroom is self-contained at every stage');}
for(const patch of [{rise:NaN,spread:Infinity,curl:-100},{rise:150,spread:160,curl:100,smoke:100,pixel:.5}])valid(run({...mushroom,...patch}));
const cloud=stats({effect:'Mushroom cloud',cy:84,phase:58});let upper=0,lower=0;for(let r=0;r<cloud.L.rows;r++)for(let c=0;c<cloud.L.cols;c++)if(cloud.bits[r*cloud.L.cols+c]){const Y=cloud.L.y+(r+.5)*cloud.L.pitch,X=cloud.L.x+(c+.5)*cloud.L.pitch;if(Y<cloud.y)upper=Math.max(upper,Math.abs(X-cloud.L.cx));else if(Y>cloud.y+8&&Y<cloud.L.cy-6)lower=Math.max(lower,Math.abs(X-cloud.L.cx));}ok(upper>lower*1.5,'mushroom cap wider than stem');
ok(stats({wind:100,phase:65}).x>stats({wind:-100,phase:65}).x+2,'wind transports ink horizontally');
ok(stats({gravity:100}).y>stats({gravity:0}).y+1,'gravity curves spark paths down');
ok(stats({effect:'Willow',gravity:85,phase:68}).y>stats({effect:'Firework',gravity:85,phase:68}).y+4,'Willow falls farther than radial firework');
const early=stats({effect:'Collision',phase:16}),late=stats({effect:'Collision',phase:55});ok(early.x1-early.x0>2*(early.y1-early.y0)&&late.y1-late.y0>late.x1-late.x0,'collision changes opposing beams into outward debris');
for(const phase of [12,40,72]){const L=N._layout({...d,phase},ctx);ok(L.pitch===N._layout(d,ctx).pitch&&L.x===N._layout(d,ctx).x&&L.y===N._layout(d,ctx).y,'pixel grid stays fixed over phase');}

for(const c of [{W:297,H:210},{W:30,H:20},{W:72,H:1000},{W:72,H:10000},{W:100000,H:100000}])for(const effect of ['Firework','Mushroom cloud']){const start=Date.now(),r=run({effect,pixel:.5,fill:100,amount:1600,size:120,grain:0},c);valid(r,c,3,c.W<100000);ok(Date.now()-start<5000,'bounded work on extreme canvas');}
for(const c of [{W:0,H:100},{W:NaN,H:100},{W:6,H:6},{W:1,H:100000},{}])ok(!run({},c).paths.length,'invalid or impossible canvas empty');
valid(run({pixel:NaN,amount:Infinity,phase:47,gravity:-100,wind:10000,size:10000,fill:-100,layer:100,seed:NaN}));
for(const p of [{}, {...d,effect:'Mushroom cloud'},{...d,effect:'Shockwave'}]){
 const visible=N.params.filter(q=>!q.showIf||q.showIf(p)).map(q=>q.key);if(p.effect==='Mushroom cloud')ok(['smoke','rise','spread','curl'].every(k=>visible.includes(k))&&!visible.includes('gravity')&&!visible.includes('trails'),'cloud controls scoped');if(p.effect==='Shockwave')ok(visible.includes('rings')&&!visible.includes('wind'),'shock controls scoped');
}
for(const effect of N.params[0].options.filter(e=>e!=='Mushroom cloud'))ok(N.params.filter(q=>['rise','spread','curl'].includes(q.key)).every(q=>!q.showIf({...d,effect})),'cloud controls hidden in '+effect);
ok(Array.isArray(N.overlay({},{}))&&N.overlay(d,ctx).some(q=>q.kind==='point'),'guarded spatial overlay');

const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toGcode');
const toGcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',app.slice(decl.start,decl.end)+';return toGcode;')(H.PENS,H.pathLength,needleExportError,'test');
for(const r of [base,run({effect:'Mushroom cloud',cy:82}),run({effect:'Shockwave',draw:'Pixel outlines'})]){
 ok((toSVG(r,ctx).match(/<path /g)||[]).length===r.paths.length,'actual SVG keeps every pixel path');
 for(const prof of [DEFAULT_MACHINE,DEFAULT_MACHINE_B]){const code=toGcode(r,ctx,{...prof,workW:1000,workH:1000}),lines=code.split('\n'),down=prof.zMode==='servo'?l=>l.includes(`ANGLE=${prof.servoDown} ; pen down`):l=>l===`G1 Z${prof.penDown} F${prof.zFeed}`;ok(lines.filter(down).length===r.paths.length,'one lower per actual path');ok(lines.filter(l=>/^G1 X/.test(l)).length===r.paths.reduce((n,p)=>n+p.pts.length-(p.closed?0:1),0),'all hatch/outline moves exported');ok(!code.includes('OUT OF BOUNDS'),'no bounds warning');}
}
const portable=new Function(...Object.keys(H),'return '+portableSource())(...Object.values(H));ok(hash(portable.compute([],d,ctx))===hash(base),'portable source exact parity');
if(examples.length){for(const ex of examples){const r=evaluate(ex).result;valid(r,ex.canvas,3);}
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pixel-blast-check-'));try{ok(generate(tmp,false).length===9,'eight effect starters and one receipt strip');const p=JSON.parse(fs.readFileSync(path.join(tmp,'pixel-blast-1.muusia.json')));ok(p.customNodes[0].key==='pixel_blast','portable project includes its own source');}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
console.log(`Pixel Blast [${fs.existsSync(new URL('../src/defs/nodes/pixel_blast.js',import.meta.url))?'baked':'lab'}]: ${checks} checks passed; eight models, pixel geometry, motion, receipt bounds, budgets and actual SVG/G-code.`);
