import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseAst} from 'rolldown/parseAst';
import * as H from '../src/defs/helpers.js';
import {DEFAULT_MACHINE,DEFAULT_MACHINE_B,needleExportError} from '../src/machine.js';
import {EXAMPLES} from '../src/examples.js';
import {N,source,defaults,canvas,run,presets,toSVG,generate} from './preview-text-roll.mjs';

let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},json=JSON.stringify,d=defaults();
const points=r=>r.paths.reduce((n,q)=>n+q.pts.length,0),ink=r=>r.paths.reduce((n,q)=>n+H.pathLength(q.pts,q.closed),0);
function valid(r,c=canvas,nonempty=true,margin=5){
 if(nonempty)ok(r.paths.length>0,'nonempty drawing');
 ok(points(r)<=120000,'complete output within point budget');
 ok(r.paths.every(q=>q.pts.length>=(q.closed?3:2)&&typeof q.closed==='boolean'&&Number.isInteger(q.layer)&&q.layer>=0&&q.layer<=11),'path and pen contract');
 ok(r.paths.every(q=>q.pts.every(v=>v.length===2&&v.every(Number.isFinite)&&v[0]>=margin+.149&&v[0]<=c.W-margin-.149&&v[1]>=margin+.149&&v[1]<=c.H-margin-.149)),'finite XY ink fits physical margins');
 ok(r.paths.every(q=>q.pts.every((v,i)=>!i||Math.hypot(v[0]-q.pts[i-1][0],v[1]-q.pts[i-1][1])>1e-10)),'no zero-length segments');
}
ok(N.key==='text_roll'&&N.ins.length===0&&N.outs[0].type==='paths','standalone typography generator');
const base=run();valid(base);ok(json(base)===json(run()),'deterministic reconstruction');
for(const surface of ['Drum','Ring'])for(const motion of ['Scroll','Rock','Tumble']){
 const p={surface,motion,time:'Timeline',cycles:3};
 for(const frame of [0,7,19,31])valid(run(p,frame,32));
 ok(json(run(p,0))===json(run(p,32)),'exact whole-loop endpoint '+surface+' '+motion);
 const seven=json(run(p,7));run(p,21);ok(seven===json(run(p,7))&&seven!==json(run(p,0)),'random access, active motion '+surface+' '+motion);
 ok(json(run({...p,time:'Manual'},1))===json(run({...p,time:'Manual'},27)),'Manual pose ignores frame');
 valid(run({...p,hidden:false}));valid(run({...p,depth:0}));
}
ok(json(run({time:'Timeline',cycles:0},0))===json(run({time:'Timeline',cycles:0},20)),'zero cycles freezes');
ok(json(run({phase:0}))===json(run({phase:360})),'Manual phase endpoint exact');
ok(json(run({wave:0,waves:1}))===json(run({wave:0,waves:6})),'inactive wave count ignored');
ok(json(run({depth:0,slices:2}))===json(run({depth:0,slices:48})),'no duplicated depth-zero slices');
for(const p of [{text:'ROLL'},{surface:'Ring'},{motion:'Rock'},{motion:'Tumble'},{phase:150},{direction:'Reverse'},{arc:150},{repeat:2},{font:'Block'},{weight:12},{tracking:1.8},{height:130},{radius:160},{depth:20},{slices:8},{wave:40},{waves:5},{twist:90},{yaw:70},{elevation:60},{roll:25},{perspective:1},{hidden:false},{size:65},{margin:10},{layer:7}]){
 const r=run(p);valid(r,canvas,true,p.margin??5);ok(json(r)!==json(base),'live control '+json(p));
}
for(const font of ['Round','Block'])for(const weight of [8,24,42])for(const ch of Object.keys(H.SFONT)){
 const g=N._glyph(ch,{font,weight},.42);ok(!!g&&(ch===' '||g.loops.length>0)&&g.loops.every(q=>q.length>=3&&q.every(v=>v.every(Number.isFinite))),'closed glyph contours including punctuation and accents '+ch);
}
ok(N._glyph('I',{...d,weight:8},1.28)===null,'undersampled thin glyph is refused, never silently dropped');
const o=N._glyph('O',d,.42);ok(o.loops.length===2,'O keeps its inner counter');
const contains=(tri,q)=>{const [a,b,c]=tri,cross=(u,v,w)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]),s=[cross(a,b,q),cross(b,c,q),cross(c,a,q)];return s.every(v=>v>=-1e-9)||s.every(v=>v<=1e-9);};
ok(!o.triangles.some(t=>contains(t,[4,5])),'glyph face mesh leaves the O counter physically empty');
valid(run({text:'ÄÖÅ Q,()'}));
ok(json(run({text:'💫'}))===json(run({text:'?'})),'unsupported characters are visible question marks');
ok(json(run({text:'MUUSIA 42'}))!==json(run({text:'MUUSIA 43'})),'last character participates');
for(const text of ['', '  ', 'X'.repeat(65),'X'.repeat(100000)])ok(!run({text}).paths.length,'empty or excessive text refused whole');
for(const p of [{layer:-100},{phase:NaN,radius:NaN,depth:NaN,weight:NaN},{surface:'Ring',text:'ÄÖÅQ',height:280,radius:60,depth:120,wave:45,twist:180,phase:200},{surface:'Ring',height:280,elevation:-80,perspective:1,phase:270}])valid(run(p));
for(const c of [{W:297,H:210},{W:20,H:30},{W:72,H:1000},{W:100000,H:100000}])valid(N.compute([],{...d,margin:3},c),c,true,3);
for(const c of [{W:0,H:100},{W:NaN,H:100},{W:9,H:9},{W:1,H:100000},{}])ok(!N.compute([],d,c).paths.length,'invalid or impossible canvas refused');
const denseStart=Date.now(),dense=run({text:'MOTION TYPE '.repeat(5),repeat:4,slices:48,weight:42,depth:120});valid(dense,canvas,false);ok(Date.now()-denseStart<8000,'dense complete request has bounded work');
for(const surface of ['Drum','Ring']){
 let framing;
 for(const phase of [0,40,130,240]){
  const p={...d,surface,text:'ÄÖÅQ',phase},s=N._scene(p,canvas),c=N._camera(p,canvas,s);ok(s.triangles.every(t=>t.every(v=>Math.hypot(...v)<=s.bound+1e-8)),'all solid geometry inside the invariant envelope');
  const f=json([c.extent,c.scale]);if(framing)ok(f===framing,'framing does not breathe over phase');framing=f;
 }
}
// Independent depth scenes: an occluder hides a rear contour, but a real hole
// leaves it visible. No invisible cylinder may cover otherwise empty space.
const square=(a,z)=>[[-a,-a,z],[a,-a,z],[a,a,z],[-a,a,z]],quad=q=>[[q[0],q[1],q[2]],[q[0],q[2],q[3]]];
const front=square(.6,.5),rear=square(.2,-.5),scene={bound:2,radial:1,vertical:1,paths:[front,rear],triangles:quad(front)},cam=N._camera({...d,yaw:0,elevation:0,roll:0,perspective:0},canvas,scene);
ok(N._render({...d,hidden:false},scene,cam).paths.length===2,'transparent scene retains both contours');
ok(N._render(d,scene,cam).paths.length===1,'two-sided solid face hides the rear contour');
const rim=[];for(let i=0;i<4;i++)rim.push(...quad([front[i],front[(i+1)%4],square(.35,.5)[(i+1)%4],square(.35,.5)[i]]));
ok(N._render(d,{...scene,triangles:rim},cam).paths.length===2,'rear contour remains visible through a real counter');
ok(ink(run({hidden:false}))>ink(base),'back contours add actual exportable ink');
ok(Array.isArray(N.overlay({},{}))&&N.overlay(d,canvas).some(q=>q.kind==='point'),'guarded placement guides');
const portable=new Function(...Object.keys(H),'return '+source())(...Object.values(H));
for(const p of [{},{surface:'Ring',phase:140},{hidden:false},{text:'ÄÖÅ'}])ok(json(portable.compute([],{...d,...p},canvas))===json(run(p)),'self-contained node parity');
const help=EXAMPLES.filter(e=>presets.some(p=>e.name==='Text Roll · '+p.name));ok(help.length===presets.length,'four original floating Help starters');
for(const [i,ex]of help.entries()){const graph=ex.make(()=>defaults());ok(ex.name==='Text Roll · '+presets[i].name&&json(N.compute([],graph.nodes[0].params,ex.canvas))===json(run({...presets[i].params,time:'Timeline'})),'Help and portable preset source parity');}
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toGcode');
const toGcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',app.slice(decl.start,decl.end)+';return toGcode;')(H.PENS,H.pathLength,needleExportError,'test');
for(const out of [base,run({surface:'Ring',text:'LOOP'}),run({depth:0})]){
 ok((toSVG(out,canvas).match(/<path /g)||[]).length===out.paths.length,'real SVG contains every visible ink run');
 for(const prof of [DEFAULT_MACHINE,DEFAULT_MACHINE_B]){const code=toGcode(out,canvas,{...prof,workW:1000,workH:1000}),lines=code.split('\n'),down=prof.zMode==='servo'?l=>l.includes(`ANGLE=${prof.servoDown} ; pen down`):l=>l===`G1 Z${prof.penDown} F${prof.zFeed}`;ok(lines.filter(down).length===out.paths.length,'one pen lower per real path');ok(lines.filter(l=>/^G1 X/.test(l)).length===out.paths.reduce((n,q)=>n+q.pts.length-(q.closed?0:1),0),'all visible drawing moves exported');ok(!code.includes('OUT OF BOUNDS'),'no machine bounds warning');}
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'text-roll-check-'));try{ok(generate(temp,false).length===presets.length,'all portable starter projects');const p=JSON.parse(fs.readFileSync(path.join(temp,'text-roll-1.muusia.json')));ok(p.customNodes[0].key==='text_roll'&&p.root.nodes[0].params.time==='Timeline','portable source and live time saved');}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(`Text Roll: ${checks} checks passed; solid glyph counters, 3D motion, occlusion, fixed framing, complete budgets, portable projects and actual SVG/G-code.`);
