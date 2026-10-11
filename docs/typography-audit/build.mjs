// Reproducible local research specimens. Does not change app nodes or exporters.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {CATALOG} from '../../src/defs/catalog.js';
import {PENS,SFONT} from '../../src/defs/helpers.js';
import {assessment,groups,validateAssessment} from './assessment.mjs';
const root=new URL('../../',import.meta.url),dest=new URL('./',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const save=(p,s)=>fs.writeFileSync(new URL(p,dest),s);
const json=(p,v)=>save(p,JSON.stringify(v,null,2)+'\n');
for(const d of ['assets','patches'])fs.mkdirSync(new URL(d+'/',dest),{recursive:true});
const defs={};
for(const f of fs.readdirSync(new URL('src/defs/nodes/',root)).filter(f=>f.endsWith('.js')).sort()){
 const d=(await import(new URL('src/defs/nodes/'+f,root))).default;assert.equal(d.key+'.js',f);defs[d.key]=d;
}
const inline={group:{key:'group',name:'Group',cat:'duo',hidden:true,ins:'dynamic',outs:'dynamic',params:[]},reititys:{key:'reititys',name:'Route',cat:'route',hidden:true,ins:[{type:'paths',name:'Paths'}],outs:[{type:'paths',name:'Paths'}],params:[]}};
const all={...defs,...inline};assert.equal(Object.keys(all).length,311);assert.deepEqual(Object.keys(all).sort(),Object.keys(CATALOG).sort());validateAssessment(Object.keys(all));
const defaults=k=>Object.fromEntries(defs[k].params.map(p=>[p.key,p.def]));
const pins=(d,n,side)=>typeof d[side]==='function'?d[side](n):d[side];
const ctx={W:200,H:140,frameIdx:0,frameCount:48};
function run(k,p={},ins=[],extra={}){return defs[k].compute(ins,{...defaults(k),...p},{...ctx,...extra},{id:1,type:k,data:{}});}
const used=new Set();
function graph(title){let next=100;const nodes=[],edges=[];return{
 add(type,params={}){used.add(type);const n={id:++next,type,x:30+nodes.length*270,y:40,params:{...defaults(type),...params}};nodes.push(n);return n;},
 wire(a,b,toPort=0,fromPort=0){edges.push({id:'e'+(++next),from:a.id,fromPort,to:b.id,toPort});},
 finish(out){return {app:'muusia',v:1,name:title,canvas:{W:ctx.W,H:ctx.H},root:{nodes,edges,outputId:out.id}};}
};}
function evaluate(patch){const cache=new Map();const byId=Object.fromEntries(patch.root.nodes.map(n=>[n.id,n]));
 function ev(id){if(cache.has(id))return cache.get(id);const n=byId[id],d=defs[n.type],ins=[];
  for(const e of patch.root.edges.filter(e=>e.to===id)){const r=ev(e.from),out=Array.isArray(r)?r[e.fromPort]:r;ins[e.toPort]=out;}
  const r=d.compute(ins,n.params,ctx,n);cache.set(id,r);return r;}
 return ev(patch.root.outputId);
}
function validatePatch(patch){const byId=Object.fromEntries(patch.root.nodes.map(n=>[n.id,n]));for(const n of patch.root.nodes){
 for(const [k,v] of Object.entries(n.params)){const p=defs[n.type].params.find(p=>p.key===k);assert.ok(p,n.type+'.'+k);if(p.options)assert.ok(p.options.includes(v),n.type+'.'+k+' option');if(p.min!==undefined)assert.ok(v>=p.min&&v<=p.max,n.type+'.'+k+' range');}}
 for(const e of patch.root.edges){const a=byId[e.from],b=byId[e.to];assert.equal(pins(defs[a.type],a,'outs')[e.fromPort].type,pins(defs[b.type],b,'ins')[e.toPort].type,'pin contract');}
}
function geometry(r){assert.ok(r?.paths?.length,'nonempty');let length=0,points=0;const pens=new Set();for(const p of r.paths){assert.ok(p.pts.length>=2,'drawable');assert.ok(Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12,'pen');pens.add(p.layer);points+=p.pts.length;
 for(const pt of p.pts)assert.ok(pt.length>=2&&pt.every(Number.isFinite),'finite');for(let j=1;j<p.pts.length+(p.closed?1:0);j++){const a=p.pts[j-1],b=p.pts[j%p.pts.length];length+=Math.hypot(a[0]-b[0],a[1]-b[1]);}}
 return {paths:r.paths.length,points,inkMetres:+(length/1000).toFixed(2),pens:pens.size,sha256:sha(JSON.stringify(r))};}
function svg(r){return `<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="140mm" viewBox="0 0 200 140"><g fill="none" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${r.paths.map(p=>`<path stroke="${PENS[p.layer].c}" d="${p.pts.map((q,i)=>(i?'L':'M')+q.slice(0,2).map(x=>+x.toFixed(3)).join(' ')).join('')}${p.closed?'Z':''}"/>`).join('')}</g></svg>`;}
const specimens=[];
function example(id,title,idea,recipe,limitation,build){const g=graph(title),out=build(g),patch=g.finish(out);validatePatch(patch);const r=evaluate(patch),stats=geometry(r);assert.equal(sha(JSON.stringify(evaluate(patch))),stats.sha256,'deterministic '+id);json('patches/'+id+'.muusia.json',patch);save('assets/'+id+'.svg',svg(r));specimens.push({id,title,idea,recipe,limitation,stats,nodes:patch.root.nodes.map(n=>n.type)});console.log(id,stats.paths+' paths',stats.inkMetres+'m');}
const text=(g,s,params={})=>g.add('hersheytext',{text:s,size:34,...params});
const face=(g,s,params={})=>g.add('lettering',{text:s,size:44,depth:0,fill:'Outline',weight:24,...params});
example('contour','01 / Contour type','The same skeleton becomes a landscape of merging outlines.','Text → SDF Contours','At large offsets, nearby letters merge. This is a field effect, not an independent outline per glyph.',g=>{const a=text(g,'TYPE');const b=g.add('sdfcontours',{start:1.5,step:1.5,count:6,cell:1,keep:false});g.wire(a,b);return b;});
example('roots','02 / Living strokes','Thicker junctions and wandering strands make the word feel grown.','Text → Mycelium Fill','Individual pen paths are the unit. Dense intersections and pen-lift count need a physical specimen.',g=>{const a=text(g,'ROOT',{size:39});const b=g.add('myceliumfill',{strands:4,width:5,boost:.8,wav:.6,taper:5,keep:true});g.wire(a,b);return b;});
example('texture','03 / Patterned face','A closed letter silhouette gives texture a precise place to live.','Lettering → Pattern Fill','Use Outline and Depth 0 on Lettering. Pattern Fill preserves nested holes.',g=>{const a=face(g,'FORM',{size:46,weight:32});const b=g.add('patternfill',{pattern:'Chevron',spacing:1.3,inset:.4,hand:.08,vary:0});g.wire(a,b);return b;});
example('squares','04 / Modular squares','Letter ink becomes a field of small drawn squares.','Lettering → Image · Drawing → Square weave','Image interprets the drawing as a raster internally, then emits pen paths. The square size limits fine details.',g=>{const a=face(g,'TYPE',{weight:32});const b=g.add('image',{source:'Drawing (wired)',drawingFill:true,drawingWidth:.2,mode:'Square weave',cell:1.8,jitter:0,squarefill:'Outline',strength:1,margin:8});g.wire(a,b,1);return b;});
example('coil','05 / Serpentine type','Each stroke is replaced by a dense, rounded zigzag.','Text → Zigzag Path · Coil','Amplitude can close small counters. Fine waves cost more plot length than the original skeleton.',g=>{const a=text(g,'LOOP',{size:42});const b=g.add('zigzag_path',{mode:'Coil',amp:2,wl:2.5,varyamp:.1,varywl:.1,fade:3});g.wire(a,b);return b;});
example('orbit','06 / Along a path','An existing drawing becomes a baseline for repeated words.','Tracks → Text on Path','Letters sit on local tangents. They are not warped continuously through the bend.',g=>{const a=g.add('radat',{rings:1,wob:0,drift:0});const b=g.add('textpath',{text:'WORDS IN ORBIT ',size:6,repeat:true,align:'Start',gap:4});g.wire(a,b);return b;});
example('stitches','07 / Modular marks','The existing stitch engine already separates core, edge and halo.','Stitch Type','This uses the built-in bitmap alphabet. Different mark types can share the same letter layout.',g=>g.add('stitchtype',{text:'TYPE',font:'Sampler 5x7',cell:2.8,px:2,preset:'Sampler'}));
example('ribbon','08 / Hairline lettering','A complete text engine for letters made of parallel ribbons.','Ribbon Type','Current alphabet is lowercase a–z; capitals fold to lowercase and digits / punctuation are skipped.',g=>g.add('ribbontype',{text:'flow',xh:38,width:.28,gap:.65,slant:8,baseline:.72,layer:6}));
example('air','09 / Flow around a word','A word becomes an obstacle and organises its surrounding space.','Lettering → Wind Tunnel','Closed obstacles use polygon union. This is an exterior-flow study; enclosed letter counters are blocked.',g=>{const a=face(g,'AIR',{size:38,weight:27,layer:0});const b=g.add('windtunnel',{lines:40,influence:9,clearance:1,waviness:.05,wake:.15,keep:true,layer:6});g.wire(a,b);return b;});
example('words','10 / Words inside a word','A large letterform holds a field of smaller text.','Lettering → Concrete Poetry · Fill region','Region tests glyph centres, not complete stroke containment. Small letters can cross the large outline at the edges.',g=>{const a=face(g,'TYPE',{size:50,weight:40});const b=g.add('concrete',{text:'TYPE',size:2.5,lineh:1.25,track:.8,mode:'Fill region',motion:'Off'});g.wire(a,b);return b;});
example('fall','11 / Falling characters','A single letter can already be used as a stamp in a collapsing grid.','Text “A” → Gravity · Stamp','This repeats the input as one motif. Dissolving an arbitrary sentence letter by letter needs a different, glyph-aware mode.',g=>{const a=text(g,'A',{size:12});const b=g.add('gravity',{cols:18,rows:10,stampSize:.65,release:.55,progress:.5,spin:40,palette:1,penA:0,seed:7});g.wire(a,b);return b;});
example('ascii','12 / Text made of text','Small plotted characters become the tone of a larger word.','Lettering · Hatch → ASCII Art','Hatching supplies line density. A bare thin outline gives a different, much lighter ASCII interpretation.',g=>{const a=face(g,'INK',{size:52,weight:35,fill:'Hatch',hatch:.4});const b=g.add('asciiart',{cols:70,aspect:1.3,ramp:'Custom',rampCustom:'.:TYPE',thresh:.03,charSize:85});g.wire(a,b);return b;});
// Controlled nested-ring experiment: no artistic judgement hidden in this check.
const ring=(x0,y0,x1,y1)=>({pts:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],closed:true,layer:0});
const region={paths:[ring(20,20,180,120),ring(70,50,130,90)]};
const lines={paths:Array.from({length:51},(_,i)=>({pts:[[0,20+2*i],[200,20+2*i]],closed:false,layer:1}))};
// Detect a segment passing through the smaller box well inside the intended counter.
function crossesCounter(r,box=[80,60,120,80]){return r.paths.some(p=>p.pts.slice(1).some((b,i)=>{const a=p.pts[i];for(let t=0;t<=1;t+=.02){const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;if(x>box[0]&&x<box[2]&&y>box[1]&&y<box[3])return true;}return false;}));}
const ctr=run('container',{gap:0},[lines,region]),hat=run('hatch',{angle:0,spacing:2,outlines:false},[region]);
const pat=run('patternfill',{pattern:'Hatch',angle:0,spacing:2,inset:0,hand:0,vary:0,outlines:false},[region]);
assert.ok(crossesCounter(ctr));assert.ok(!crossesCounter(hat));assert.ok(!crossesCounter(pat));
for(const [id,r] of [['union-counter',ctr],['parity-counter',hat]])save('assets/'+id+'.svg',svg({paths:[...region.paths,...r.paths]}));
const imageD=defs.image._drawingImage({...defaults('image'),drawingFill:true,drawingWidth:.2},ctx,region);
const pixel=imageD.g[Math.floor(imageD.h/2)*imageD.w+Math.floor(imageD.w/2)];assert.ok(pixel<.01,'image centre remains white');
// Repeat the counter test with an actual Lettering O.
const O=run('lettering',{text:'O',size:70,depth:0,fill:'Outline',weight:24});
const oCtr=run('container',{gap:0},[lines,O]),oHat=run('hatch',{angle:0,spacing:2,outlines:false},[O]);
assert.ok(crossesCounter(oCtr,[95,65,105,75]));assert.ok(!crossesCounter(oHat,[95,65,105,75]));
const a=run('hersheytext',{text:'A',size:40}),b=run('hersheytext',{text:'B',size:40});
const morph=Array.from({length:48},(_,frameIdx)=>run('morphlayers',{layers:12,output:'Sheets'},[a,b],{frameIdx}));
assert.equal(sha(JSON.stringify(morph[11])),sha(JSON.stringify(morph[47])));assert.ok(new Set(morph.map(x=>sha(JSON.stringify(x)))).size<=12);
const checked=new Set([...used,'container','hatch','morphlayers']);
const inventory=Object.values(all).map(d=>({key:d.key,name:d.name,cat:d.cat,hidden:!!d.hidden,description:d.desc||CATALOG[d.key]?.t||'',inputs:typeof d.ins==='function'||d.ins==='dynamic'?'dynamic':d.ins,source:d.key in inline?'src/App.jsx':'src/defs/nodes/'+d.key+'.js',...assessment(d),evidence:checked.has(d.key)?'Geometry probe':'Definition / catalogue review'})).sort((a,b)=>a.name.localeCompare(b.name));
const hashes=Object.fromEntries([...Object.keys(defs).map(k=>'src/defs/nodes/'+k+'.js'),'src/defs/helpers.js','src/defs/catalog.js'].map(p=>[p,sha(read(p))]));
const app=read('src/App.jsx');
const checks={baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),appVersion:app.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1],scope:'Catalogue / descriptor screening of all 311 built-ins, focused source review, and direct real-node compute probes. Gallery SVGs are research renders, not captured UI screenshots or app-export validation. No physical plotting test.',inventoryCount:inventory.length,moduleCount:Object.keys(defs).length,geometryProbedNodes:[...checked].sort(),fontCharacters:Object.keys(SFONT).join(''),counterTests:{nestedRings:{containerFillsCounter:true,hatchPreservesCounter:true,patternFillPreservesCounter:true,imageCentreDarkness:pixel},letteringO:{containerFillsCounter:true,hatchPreservesCounter:true}},morphTest:{frames:48,layers:12,distinctOutputs:new Set(morph.map(x=>sha(JSON.stringify(x)))).size,frame12EqualsFrame48:true},specimens:specimens.map(s=>({id:s.id,...s.stats})),sourceHashes:hashes};
json('checks.json',checks);json('inventory.json',inventory);json('specimens.json',specimens);
const data={groups,inventory,specimens,checks:{...checks,sourceHashes:undefined}};
const template=new URL('template.html',dest);if(fs.existsSync(template))save('index.html',fs.readFileSync(template,'utf8').replace('/* AUDIT_DATA */',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log(JSON.stringify({inventory:inventory.length,geometryProbedNodes:checked.size,specimens:specimens.length,counters:checks.counterTests,morph:checks.morphTest}));
