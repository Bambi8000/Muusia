import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import def from '../src/defs/nodes/murmuration.js';
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const canvas={W:297,H:210};
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const legacy=[
 [{},'b5d6bc09e67a6c67d18183ad937ef8be41d51ac5f68217bd03befb9cc21c03ac'],
 [{time:.37,shape:'Dash',trail:10},'669e51ee96e36ad01f8f60ec2f0e576e60c6e9092d5ff28f278f3855abf77a23'],
 [{time:.71,shape:'Dot',path:'Figure-8'},'b634b011bae761c80c76ba3724724805c6b960ffa422749aca86ed34fcfab6db'],
 [{time:.15,path:'Oval'},'38f63d795a62bd6c3592ac1eafe74dcf94120664a725157b277ef363ade14237'],
 [{time:.21,path:'Trefoil'},'bb312cf003a33dc6c4363f0fe61e5c527bfc91bc06c3187efbcf6a315fd05307'],
 [{time:.48,path:'Lissajous 2:3'},'df5a515e58bd81e084dde93cd014d6bc0a1af922eba3ff6d31ea26294d59bd74'],
];
for(const [p,sha] of legacy) {
 const params={...defaults,...p};assert.equal(hash(def.compute([],params,canvas)),sha);
 delete params.behaviour;delete params.clock;assert.equal(hash(def.compute([],params,canvas)),sha,'old saved patches');
}
const base={...defaults,behaviour:'Reindeer herd',clock:'Manual',birds:180,spread:35,travel:.8};
const output=(overrides={},ctx=canvas)=>def.compute([],{...base,...overrides},ctx);
const centers=o=>o.paths.map(p=>p.pts.reduce((s,q)=>[s[0]+q[0]/p.pts.length,s[1]+q[1]/p.pts.length],[0,0]));
let framesChecked=0;
const start=performance.now();
for(const herdMotion of ['Migration','Milling','Gather & roam']) for(const herdMark of ['Point','Circle','Dash']) for(const N of [24,36,48]) {
 const hashes=new Set();
 for(let f=0;f<N;f++) {
  const params={herdMotion,herdMark,clock:'Timeline'},ctx={...canvas,frameIdx:f,frameCount:N};
  const o=output(params,ctx);hashes.add(hash(o));
  assert.equal(o.paths.length,base.birds,'animal count persists');
  for(const p of o.paths) {
   assert.equal(p.closed,herdMark==='Circle');assert.equal(p.pts.length,herdMark==='Circle'?12:2);assert.equal(p.layer,0);
   for(const [x,y] of p.pts) assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=10&&x<=287&&y>=10&&y<=200,'page bounds');
  }
  if(f===7) assert.deepEqual(o,output({herdMotion,herdMark,time:f/N}),'timeline = manual phase');
  framesChecked++;
 }
 assert.equal(hashes.size,N,'every stored frame is different; no duplicated endpoint');
 assert.deepEqual(output({herdMotion,herdMark,time:0}),output({herdMotion,herdMark,time:1}),'exact loop endpoint');
 const a=centers(output({herdMotion,herdMark,time:0})),minus=centers(output({herdMotion,herdMark,time:-1e-6})),plus=centers(output({herdMotion,herdMark,time:1e-6}));
 // A jump or a direction reversal at the join would dwarf this second difference.
 assert.ok(Math.max(...a.map((q,i)=>Math.hypot(plus[i][0]+minus[i][0]-2*q[0],plus[i][1]+minus[i][1]-2*q[1])))<.0001,'smooth seam');
}
const first=output({time:.217});output({time:.7,seed:12,birds:400});assert.deepEqual(output({time:.217}),first,'evaluation order independence');
assert.notEqual(hash(output({seed:17})),hash(output()),'seed changes herd');
for(const [k,v] of Object.entries({spacing:6,separation:0,following:0,pulse:1,scatter:0,stretch:0,travel:0,spread:20}))
 assert.notEqual(hash(output({[k]:v,time:.31})),hash(output({time:.31})),`${k} changes output`);
const before=centers(output({time:0})),after=centers(output({time:.31}));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
assert.ok(before.some((q,i)=>i&&Math.abs(distance(q,before[0])-distance(after[i],after[0]))>2),'shape deforms, not rigid rotation/translation');
const energy=(ps,spacing)=>{let e=0;for(let i=0;i<ps.length;i++)for(let j=0;j<i;j++)e+=Math.max(0,spacing-distance(ps[i],ps[j]))**2;return e;};
const crowd={birds:160,spread:12,spacing:3,time:.31,herdMark:'Circle',size:.5,scatter:0};
const e0=energy(centers(output({...crowd,separation:0})),3),e1=energy(centers(output({...crowd,separation:1})),3);
assert.ok(e1<e0*.6,`neighbours reduce crowd overlap: ${e0} → ${e1}`);
for(const params of [{birds:800,spacing:20,spread:1,size:12},{birds:Infinity,time:NaN,seed:NaN,layer:42},{birds:-20,time:-123,travel:100,scatter:Infinity}]){
 const o=output(params);assert.ok(o.paths.length>0&&o.paths.length<=800);
 for(const p of o.paths){assert.ok(p.layer>=0&&p.layer<=11);assert.ok(p.pts.flat().every(Number.isFinite));}
}
assert.equal(output({margin:200}).paths.length,0,'impossible region is empty');
const point=output({herdMark:'Point'}).paths[0];assert.ok(distance(...point.pts)>0&&distance(...point.pts)<=.32,'point is a physical stroke');
assert.deepEqual(base,{...defaults,behaviour:'Reindeer herd',clock:'Manual',birds:180,spread:35,travel:.8},'parameters not mutated');
assert.ok(def.overlay(base,canvas).length===1);
for(const p of def.params) if(p.type==='select') assert.ok(Array.isArray(p.options)&&p.options.includes(p.def));
console.log(`Murmuration: ${framesChecked} herd frames, smooth loop joins, identity/bounds/determinism, six legacy baselines pass. Crowding energy ${e0.toFixed(1)} → ${e1.toFixed(1)}; ${Math.round(performance.now()-start)} ms.`);

// Optional evidence from real app exports, captured through Load/select/export.
if(process.argv.includes('--browser-captures')) {
 const fs=await import('node:fs');
 const records=[];
 for(const id of ['migration','milling','gather']) {
  const patch=JSON.parse(fs.readFileSync(`docs/murmuration-herd/${id}.muusia.json`));
  const expected=def.compute([],patch.root.nodes[0].params,{...patch.canvas,frameIdx:7,frameCount:36}).paths;
  const svg=fs.readFileSync(`/tmp/reindeer-${id}-browser.svg`,'utf8');
  const ds=[...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
  const wanted=expected.map(p=>p.pts.map(([x,y],i)=>(i?'L':'M')+(+x.toFixed(2))+','+(+y.toFixed(2))).join('')+(p.closed?'Z':''));
  assert.deepEqual(ds,wanted,`${id}: browser SVG = actual node, including closure and ordering`);
  assert.ok(svg.includes('width="297mm" height="210mm"'));
  const gc=fs.readFileSync(`/tmp/reindeer-${id}-browser.gcode`,'utf8');
  let down=false,current=null,position=null;const strokes=[];
  for(const line of gc.split('\n')) {
   if(line.startsWith('SET_SERVO')) {
    const angle=+line.match(/ANGLE=([\d.]+)/)[1];
    if(angle===35){down=true;current=[position];}
    else if(angle===90){if(down)strokes.push(current);down=false;current=null;}
   }
   const move=line.match(/^G([01]) X(-?[\d.]+) Y(-?[\d.]+)/);
   if(move){assert.ok(move[1]!=='0'||!down,`${id}: no rapid movement with pen down`);position=[+move[2],+move[3]];if(down)current.push(position);}
  }
  assert.ok(!down,'ends pen up');
  const wantedStrokes=expected.map(p=>(p.closed?[...p.pts,p.pts[0]]:p.pts).map(pt=>pt.map(n=>+n.toFixed(2))));
  assert.deepEqual(strokes,wantedStrokes,`${id}: browser G-code actual pen-down strokes`);
  const sha=s=>createHash('sha256').update(s).digest('hex');
  records.push({id,frame:7,frameCount:36,paths:expected.length,svgSha256:sha(svg),orderedPathsSha256:sha(ds.join('|')),gcodeSha256:sha(gc),penDownStrokes:strokes.length,patchSha256:sha(JSON.stringify(patch))});
 }
 const app=fs.readFileSync('src/App.jsx','utf8');
 const sha=s=>createHash('sha256').update(s).digest('hex');
 fs.writeFileSync('docs/murmuration-herd/browser-checks.json',JSON.stringify({capturedAt:'2026-10-09',method:'Fresh headless Chrome, actual Muusia Load/select node, Frames 36, frame index 7; route optimisation off; default Servo A profile with zero origin and flip Y off. SVG ordered paths and G-code pen-down movements match node geometry at 0.01 mm. No hardware or frame-batch claim.',nodeSha256:sha(fs.readFileSync('src/defs/nodes/murmuration.js')),svgScopeSha256:sha(app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export'))),exports:records},null,2)+'\n');
 console.log('Three actual browser SVG and G-code exports match node geometry, closure, page and pen-up travel.');
}
