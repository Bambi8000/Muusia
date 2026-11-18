import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseAst} from 'rolldown/parseAst';
import * as H from '../src/defs/helpers.js';
import {DEFAULT_MACHINE,DEFAULT_MACHINE_B,needleExportError} from '../src/machine.js';
import {EXAMPLES} from '../src/examples.js';
import {N,source,defaults,canvas,toSVG,run} from './preview-text-roll.mjs';
import {ribbonPresets,generateRibbon} from './preview-text-ribbon.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},json=JSON.stringify,d={...defaults(),construction:'Raised ribbon',wave:0,twist:0,roll:0};
const render=(p={},i=0,n=24)=>run({...d,...p},i,n),count=r=>r.paths.reduce((n,q)=>n+q.pts.length,0);
function valid(r,c=canvas,nonempty=true){if(nonempty)ok(r.paths.length>0,'nonempty ribbon');ok(count(r)<=120000,'complete point budget');ok(r.paths.every(q=>q.pts.length>=(q.closed?3:2)&&typeof q.closed==='boolean'&&Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12),'path/pen contract');ok(r.paths.every(q=>q.pts.every(v=>v.length===2&&v.every(Number.isFinite)&&v[0]>=5.149&&v[0]<=c.W-5.149&&v[1]>=5.149&&v[1]<=c.H-5.149)),'finite XY ink and physical margins');ok(r.paths.every(q=>q.pts.every((v,i)=>!i||Math.hypot(v[0]-q.pts[i-1][0],v[1]-q.pts[i-1][1])>1e-10)),'no zero-length segments');}
const base=render();valid(base);ok(json(base)===json(render()),'deterministic');
const scene=N._scene(d,canvas),{rows,columns:U,meshRows,baseRadius,depth}=scene.ribbon;
ok(scene.paths.length===d.ribbonLines&&rows===d.ribbonLines,'one complete horizontal path per requested row');
for(const row of scene.paths)ok(row.every(v=>Math.abs(v[1]-row[0][1])<1e-10),'rows remain horizontal across the whole Drum');
const middle=scene.paths[Math.floor(rows/2)],radii=middle.map(v=>Math.hypot(v[0],v[2]));
ok(Math.min(...radii)<baseRadius+1e-8&&Math.max(...radii)>baseRadius+depth*.95,'same row returns to base and rises into raised letters');
ok(scene.paths.every(q=>Math.hypot(...q[0].map((v,k)=>v-q.at(-1)[k]))<.2),'closed seam has no straight chord across the drum');
// A connected, periodic sheet with only the two ribbon boundaries. Letter
// counters and spaces change height, rather than cutting the sheet into glyphs.
const ids=new Map(),edgeUse=new Map(),neighbors=[];let next=0;
const id=q=>{const key=q.map(v=>Math.round(v*1e7)).join(',');if(!ids.has(key)){ids.set(key,next++);neighbors.push([]);}return ids.get(key);};
for(const tri of scene.triangles){const a=tri.map(id);for(let i=0;i<3;i++){const x=a[i],y=a[(i+1)%3],key=Math.min(x,y)+','+Math.max(x,y);edgeUse.set(key,(edgeUse.get(key)||0)+1);neighbors[x].push(y);neighbors[y].push(x);}}
const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const v of neighbors[queue[i]])if(!seen.has(v)){seen.add(v);queue.push(v);}
ok(seen.size===ids.size,'all letter reliefs and spaces belong to one connected sheet');
ok([...edgeUse.values()].every(n=>n===1||n===2)&&[...edgeUse.values()].filter(n=>n===1).length===2*U,'exactly two open band edges; no glyph holes or seam crack');
ok(scene.triangles.length===2*U*(meshRows-1),'complete periodic band mesh');
const o=N._scene({...d,text:'O',weight:18,shoulder:3},canvas),midRow=Math.round((o.ribbon.meshRows-1)/2),r=.9,shoulder=.3,pad=r+shoulder+1.25,length=9+2*pad,col=Math.round((4+pad)/length*o.ribbon.columns)%o.ribbon.columns;
ok(o.ribbon.relief[midRow*o.ribbon.columns+col]<1e-6,'O counter returns to the base ribbon');
ok(Math.max(...o.ribbon.relief)>d.depth/100*.95,'O stroke rises above that same base');
const flat=N._scene({...d,depth:0},canvas);ok(flat.paths.every(q=>q.every(v=>Math.abs(Math.hypot(v[0],v[2])-flat.ribbon.baseRadius)<1e-9)),'zero depth becomes a plain continuous drum');
valid(render({text:''}));valid(render({text:'ÄÖÅ Q,()'}));ok(json(render({text:'💫'}))===json(render({text:'?'})),'unsupported glyph remains visible fallback');
for(const surface of ['Drum','Ring'])for(const motion of ['Scroll','Rock','Tumble']){
 const p={surface,motion,time:'Timeline',cycles:3};for(const i of [0,5,17,23])valid(render(p,i));ok(json(render(p,0))===json(render(p,24)),'exact loop '+surface+' '+motion);
 const five=json(render(p,5));render(p,19);ok(five===json(render(p,5))&&five!==json(render(p,0)),'random access motion');valid(render({...p,hidden:false}));
}
ok(json(render({phase:0}))===json(render({phase:360})),'Manual endpoint');ok(json(render({},2))===json(render({},18)),'Manual ignores frame');ok(json(render({time:'Timeline',cycles:0},1))===json(render({time:'Timeline',cycles:0},20)),'zero loops freezes');
for(const p of [{text:'TYPE'},{font:'Block'},{weight:12},{tracking:1.6},{height:160},{radius:150},{depth:100},{ribbonLines:24},{shoulder:15},{padding:25},{repeat:2},{wave:35},{twist:70},{yaw:65},{elevation:55},{perspective:1},{hidden:false}]){const r=render(p);valid(r);ok(json(r)!==json(base),'live ribbon '+json(p));}
ok(json(render({arc:90,slices:2}))===json(render({arc:360,slices:48})),'floating Arc and Contour slices do not affect closed ribbon');
ok(render({hidden:false}).paths.every(q=>q.closed)&&render({hidden:false}).paths.length===d.ribbonLines,'transparent output retains entire closed horizontal rows');
for(const p of [{surface:'Ring',text:'ÄÖÅ',height:280,radius:60,depth:120,wave:45,twist:180},{font:'Block',shoulder:2,ribbonLines:96},{ribbonLines:NaN,depth:NaN,shoulder:NaN,padding:NaN}])valid(render(p));
for(const p of [{text:'X'.repeat(65)},{text:'X'.repeat(100000)}])ok(!render(p).paths.length,'excessive text refused whole');
for(const c of [{W:297,H:210},{W:20,H:30},{W:72,H:1000},{W:100000,H:100000}])valid(N.compute([],d,c),c);
const start=Date.now();valid(render({text:'MOTION TYPE '.repeat(5),repeat:4,ribbonLines:96,shoulder:2}),canvas,false);ok(Date.now()-start<8000,'bounded dense work');
for(const surface of ['Drum','Ring']){let frame;for(const phase of [0,80,190,310]){const p={...d,surface,phase,text:'ÄÖÅ'},s=N._scene(p,canvas),c=N._camera(p,canvas,s);ok(s.triangles.every(t=>t.every(q=>Math.hypot(...q)<=s.bound+1e-8)),'relief inside invariant envelope');const v=json([c.extent,c.scale]);if(frame)ok(v===frame,'no framing change over motion');frame=v;}}
const visible=p=>N.params.filter(q=>!q.showIf||q.showIf(p)).map(q=>q.key);
ok(['ribbonLines','shoulder','padding'].every(k=>visible(d).includes(k))&&!visible(d).includes('slices')&&!visible(d).includes('arc'),'ribbon controls scoped');
ok(['ribbonLines','shoulder','padding'].every(k=>!visible({...d,construction:'Floating letters'}).includes(k)),'new controls hidden in preserved Floating mode');
const portable=new Function(...Object.keys(H),'return '+source())(...Object.values(H));for(const p of ribbonPresets)ok(json(portable.compute([],{...defaults(),...p.params},canvas))===json(run(p.params)),'portable ribbon exact parity');
const help=EXAMPLES.filter(e=>ribbonPresets.some(p=>e.name==='Text Roll · '+p.name));ok(help.length===3,'three new ribbon Help starters');for(const p of ribbonPresets){const ex=help.find(e=>e.name==='Text Roll · '+p.name),g=ex.make(()=>defaults());ok(json(N.compute([],g.nodes[0].params,canvas))===json(run({...p.params,time:'Timeline'})),'actual Help/source parity');}
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toGcode'),toGcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',app.slice(decl.start,decl.end)+';return toGcode;')(H.PENS,H.pathLength,needleExportError,'test');
for(const r of [base,render({surface:'Ring',text:'LOOP'}),render({hidden:false})]){ok((toSVG(r,canvas).match(/<path /g)||[]).length===r.paths.length,'actual SVG retains all row fragments');for(const prof of [DEFAULT_MACHINE,DEFAULT_MACHINE_B]){const code=toGcode(r,canvas,{...prof,workW:1000,workH:1000}),lines=code.split('\n'),down=prof.zMode==='servo'?l=>l.includes(`ANGLE=${prof.servoDown} ; pen down`):l=>l===`G1 Z${prof.penDown} F${prof.zFeed}`;ok(lines.filter(down).length===r.paths.length,'every ribbon path lowered');ok(lines.filter(l=>/^G1 X/.test(l)).length===r.paths.reduce((n,p)=>n+p.pts.length-(p.closed?0:1),0),'every horizontal ink move exported');ok(!code.includes('OUT OF BOUNDS'),'export bounds');}}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'text-ribbon-check-'));try{ok(generateRibbon(tmp,false).length===3,'portable ribbon projects generated');}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(`Text Ribbon: ${checks} checks passed; connected band, horizontal rows, letter relief, counters, motion, framing, budgets and actual exports.`);
