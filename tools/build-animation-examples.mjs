// Real built-in graphs, not hand-drawn stand-ins. Run from any directory.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EMPTY, PENS} from '../src/defs/helpers.js';

const root = new URL('../', import.meta.url);
const dest = new URL('docs/animation-examples/', root);
fs.mkdirSync(new URL('patches/', dest), {recursive:true});
const keys = ['frame','matem','lfo','moire_disc','zigzag_path','grid','lens','merge','hersheytext','chop','explosion','concrete','blobmesh'];
const defs = Object.fromEntries(await Promise.all(keys.map(async k=>[k,(await import(`../src/defs/nodes/${k}.js`)).default])));
const defaults = k=>Object.fromEntries(defs[k].params.map(p=>[p.key,p.def]));
const hash = x=>createHash('sha256').update(x).digest('hex');
const app = fs.readFileSync(new URL('src/App.jsx',root),'utf8');
const SOLID_STYLE = JSON.parse(app.match(/const SOLID_STYLE = (\{[^;]+\});/)[1].replace(/(\w+):/g,'"$1":'));
const engine = app.slice(app.indexOf('function defIns(node)'),app.indexOf('/* ============================================================\n   G-CODE'));
assert.ok(engine.includes('function evalLevel') && engine.endsWith('\n\n'));
// Extract the actual graph evaluator and pin/parameter dispatch helpers.
const evaluate = new Function('DEFS','EMPTY','SOLID_STYLE',engine+'\nreturn evalLevel;')(defs,EMPTY,SOLID_STYLE);
const exporter = app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export'));
const toSVG = new Function('PENS',exporter+'\nreturn toSVG;')(PENS);
const nativeFrame = defs.frame;
defs.frame = {...nativeFrame, compute(ins,p,ctx) {
  if(ctx.virtualEnd) return [1,ctx.frameCount,0,0,360];
  return nativeFrame.compute(ins,p,ctx);
}};

function graph() {
  const nodes=[],edges=[];
  let id=100;
  const add=(type,params={},x=20,y=20)=>{
    const n={id:++id,type,x,y,params:{...defaults(type),...params}};
    nodes.push(n);return n;
  };
  const wire=(from,to,toPort,fromPort=0)=>edges.push({id:'e'+(++id),from:from.id,fromPort,to:to.id,toPort});
  const frame=add('frame',{},20,20);
  const div36=add('matem',{op:'A ÷ B',b:36},245,20);
  const phase=add('matem',{op:'A ÷ B',b:10},470,20);
  wire(frame,div36,0,4);wire(div36,phase,0);
  const osc=(min,max,offset,x=20,y=360)=>{
    const n=add('lfo',{min,max,phase:offset},x,y);wire(phase,n,0);return n;
  };
  const finish=(title,out)=>({app:'muusia',v:1,name:title,canvas:{W:140,H:140},root:{nodes:[...nodes.filter(n=>n!==out),out],edges,outputId:out.id}});
  return {add,wire,osc,phase,frame,finish};
}

const examples=[];
function make(meta,build) {
  const g=graph(),out=build(g);
  examples.push({...meta,patch:g.finish(meta.title,out),output:defs[out.type].name});
}
make({key:'travelling-wave',title:'Viiva kuljettaa aaltoa',kind:'Etenevä muutos',chain:'Moire Disc → Zigzag Path',recommended:48,
  description:'Spiraalin runko pysyy paikallaan. Pienet mutkat vaeltavat samaa yhtenäistä viivaa pitkin; tiheys saa pinnan näyttämään elävältä.',
  controls:'Spiral: Radius 48 mm, Pitch 6 mm. Zigzag Path: Sine, Wavelength 22 mm, Amplitude 2 mm. Phase kulkee 0–1.',
  change:'Kokeile Amplitude 1–3 mm. Lyhyempi Wavelength tekee levottomamman, pidempi rauhallisemman liikkeen.',
  plot:'Yksi jatkuva polku: hyvä ensimmäinen koepiirros. 48 ruutua tekee etenevästä aallosta tasaisemman.'},g=>{
  const source=g.add('moire_disc',{content:'Spiral',radius:48,pitch:6,rim:false},20,660);
  const result=g.add('zigzag_path',{mode:'Sine',wl:22,amp:2,varyamp:.15,varywl:0,fade:14},710,660);
  g.wire(source,result,0);g.wire(g.phase,result,'p:phase');return result;
});
make({key:'sliding-moire',title:'Renkaiden välinen syke',kind:'Interferenssi',chain:'2 × Moire Disc → Merge',recommended:36,
  description:'Kaksi rengaskenttää liukuu toistensa läpi. Väleihin syntyvät tummat ja vaaleat aallot liikkuvat eri tavalla kuin itse renkaat.',
  controls:'Rings: Radius 39 mm, Pitch 2 / 2.1 mm. Keskipisteiden X liikkuu vastakkaisesti 39–51 % ja 49–61 %.',
  change:'Pienennä Pitch-eroa hienompaan moiréhen. Pidä molempien kulma vakiona ja kokeile vain toisen kentän liikettä.',
  plot:'Yksi kynä korostaa optista liikettä. Tiheät renkaat ovat tämän sarjan työläimpiä piirtää.'},g=>{
  const a=g.add('moire_disc',{radius:39,pitch:2,y:48,rim:false},20,740);
  const b=g.add('moire_disc',{radius:39,pitch:2.1,y:52,rim:false},370,740);
  g.wire(g.osc(39,51,.75,20,350),a,'p:x');g.wire(g.osc(49,61,.25,370,350),b,'p:x');
  const out=g.add('merge',{},720,740);g.wire(a,out,0);g.wire(b,out,1);return out;
});
make({key:'travelling-pinch',title:'Pinta kuroutuu ja avautuu',kind:'Paikallinen muodonmuutos',chain:'Grid → Lens',recommended:36,
  description:'Ruudukon reunat pysyvät paikallaan. Keskellä kulkee pehmeä painauma, joka vaihtuu pullistumaksi: liike tuntuu tapahtuvan materiaalissa.',
  controls:'Grid: 29 × 29 lines, Resolution 1 mm. Lens: Radius 44 mm, Use canvas center pois. X = 45–95 mm; Strength = −0.9…0.9.',
  change:'Kasvata Radius-arvoa laajaksi hengittäväksi pinnaksi. Pienempi säde tekee selvästi liikkuvan painauman.',
  plot:'Ruudukon ulkoreuna antaa hyvän kiintopisteen ruutujen kohdistamiseen. Ei tarvita täyttöjä.'},g=>{
  const grid=g.add('grid',{vlines:29,hlines:29,res:1,margin:12},20,740);
  const out=g.add('lens',{useCenter:false,cx:70,cy:70,radius:44,strength:-.9},720,740);
  g.wire(grid,out,0);g.wire(g.osc(45,95,.75,20,350),out,'p:cx');g.wire(g.osc(-.9,.9,0,370,350),out,'p:strength');return out;
});
make({key:'reassembly',title:'Sana hajoaa ja kokoontuu',kind:'Hajoaminen / palautuminen',chain:'Text → Chop → Explosion',recommended:36,
  description:'Kirjainten viivat irtoavat pieniksi palasiksi ja leviävät ulospäin. Samat palaset palaavat täsmälleen paikoilleen ja sana on taas luettavissa.',
  controls:'Text: TOGE|THER, Size 17 mm. Chop: Piece length 4 mm, yksi kynä. Explosion: Strength 0–23 mm, Uniform, Seed 103.',
  change:'Vaihda oma lyhyt sana. Chopin Piece length määrää palasten koon; Explosionin Spread hajonnan suunnat.',
  plot:'Lyhyt piirrettävä matka, mutta paljon kynännostoja. Seed pysyy samana jokaisessa ruudussa.'},g=>{
  const text=g.add('hersheytext',{text:'TOGE|THER',size:17,lineh:140},20,740);
  const pieces=g.add('chop',{length:4,gap:.25,pens:1},370,740);
  const out=g.add('explosion',{cx:70,cy:70,zw:200,strength:0,falloff:'Uniform',jitter:.3,spread:55},720,740);
  g.wire(text,pieces,0);g.wire(pieces,out,0);g.wire(g.osc(0,23,.75,20,350),out,'p:strength');return out;
});
make({key:'letter-shift',title:'Kirjaimet vaihtavat paikkaa',kind:'Järjestyksen muutos',chain:'Concrete Poetry · Shift',recommended:24,
  description:'Kirjainkenttä pysyy täytenä. Kirjaimet vaihtavat paikkoja rivi kerrallaan, ja tekstin rytmi kulkee kentän halki ilman koko sommitelman liikettä.',
  controls:'Fill region, teksti CHANGE, Motion Shift, Shift pattern Rows, Size 9 mm, Row lag 0.08. Phase input = 0–1.',
  change:'Vaihda Shift pattern → Columns tai Shuffle. Lyhyet sanat, joissa on erilaisia kirjaimia, näyttävät muutoksen selvimmin.',
  plot:'Tarkoituksella porrastuva liike, ei pehmeä morph. 24 ruutua sopii kirjainten hyppyihin.'},g=>{
  const out=g.add('concrete',{text:'CHANGE',mode:'Fill region',motion:'Shift',clock:'Phase input',shiftPattern:'Rows',size:9,lineh:1.5,rowLag:.08,margin:14},720,650);
  g.wire(g.phase,out,'p:phase');return out;
});
make({key:'living-volume',title:'Muoto kurkottaa ja vetäytyy',kind:'Muuttuva tilavuus',chain:'Blob Mesh · Manual',recommended:48,
  description:'Yhtenäinen verkkopinta kasvattaa ulokkeen, puristuu epäsymmetriseksi ja palautuu. Kamera pysyy samassa kulmassa koko luupin ajan.',
  controls:'Manual, 2 Balls. Ball 2 X = 15–70 %, Ball 2 Z = −30…35 %. Blend 55 %, Noise 0, Size 108 mm; View angle 25°, elevation 20°.',
  change:'Muuta Ball 2 size tai Blend. Pidä Rings ja Segments samoina koko animaation ajan, jotta verkon rakenne säilyy.',
  plot:'Näkyvissä myös takapuolen viivat. Node sovittaa muodon esikatselukokoon, joten ulokkeen mukana myös rungon mittasuhteet elävät.'},g=>{
  const out=g.add('blobmesh',{balls:2,ballMode:'Manual',bX2:15,bY2:0,bZ2:-30,bR2:85,blend:55,noiseAmp:0,radZ:100,rings:28,segs:48,wireEvery:2,size:108,viewAz:25,viewEl:20},720,740);
  g.wire(g.osc(15,70,.75,20,350),out,'p:bX2');g.wire(g.osc(-30,35,0,370,350),out,'p:bZ2');return out;
});

function geometry(example,i,N,virtualEnd=false) {
  const ctx={...example.patch.canvas,frameIdx:i,frameCount:N,virtualEnd};
  const result=evaluate(example.patch.root,ctx).out[example.patch.root.outputId][0];
  assert.ok(result?.paths?.length,example.key+': empty graph result');
  for(const p of result.paths) {
    assert.ok(p.pts.length>=2 && Number.isInteger(p.layer) && p.layer===0,'one-pen paths');
    for(const [x,y] of p.pts) assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=140&&y>=0&&y<=140,example.key+': page bounds');
  }
  return result.paths;
}
function distance(a,b) {
  if(a.length!==b.length)return null;
  let max=0,total=0,count=0;
  for(let i=0;i<a.length;i++){
    if(a[i].pts.length!==b[i].pts.length||a[i].layer!==b[i].layer||!!a[i].closed!==!!b[i].closed)return null;
    for(let j=0;j<a[i].pts.length;j++){
      const d=Math.hypot(a[i].pts[j][0]-b[i].pts[j][0],a[i].pts[j][1]-b[i].pts[j][1]);
      max=Math.max(max,d);total+=d*d;count++;
    }
  }
  return {max,rms:Math.sqrt(total/count)};
}
function length(paths){
  let sum=0;
  for(const p of paths)for(let i=1;i<p.pts.length+(p.closed?1:0);i++){
    const a=p.pts[i-1],b=p.pts[i%p.pts.length];sum+=Math.hypot(a[0]-b[0],a[1]-b[1]);
  }
  return sum;
}
// RDP simplification for the gallery only, within 0.06 mm. Patches retain the full node output.
function simplify(points){
  if(points.length<3)return points;
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const stack=[[0,points.length-1]];
  while(stack.length){
    const [a,b]=stack.pop(),A=points[a],B=points[b],dx=B[0]-A[0],dy=B[1]-A[1],l=dx*dx+dy*dy;
    let far=-1,max=.06**2;
    for(let i=a+1;i<b;i++){
      const p=points[i],t=l?Math.max(0,Math.min(1,((p[0]-A[0])*dx+(p[1]-A[1])*dy)/l)):0;
      const d=(p[0]-A[0]-t*dx)**2+(p[1]-A[1]-t*dy)**2;
      if(d>max){max=d;far=i;}
    }
    if(far>=0){keep[far]=1;stack.push([a,far],[far,b]);}
  }
  return points.filter((_,i)=>keep[i]);
}
const dstring=paths=>paths.map(p=>simplify(p.pts).map(([x,y],i)=>(i?'L':'M')+(+x.toFixed(3))+','+(+y.toFixed(3))).join('')+(p.closed?'Z':'')).join('');
// Compare the actual SVG path data with the browser export panel (0.01 mm).
function svgSignature(paths){
  const strings=[...toSVG({paths},{W:140,H:140}).matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
  let fnv=2166136261;for(const c of strings.join('|')){fnv^=c.charCodeAt(0);fnv=Math.imul(fnv,16777619)>>>0;}
  return {paths:strings.length,points:paths.reduce((s,p)=>s+p.pts.length,0),fnv:fnv.toString(16).padStart(8,'0'),sha256:hash(strings.join('|'))};
}
const report={schemaVersion:1,canvasMm:140,frames:[24,36,48],scope:'Real App graph evaluator with current nodes; geometry and virtual endpoint checks. No physical plot or printer timing validation.',
  engineScopeSha256:hash(engine),exportScopeSha256:hash(exporter),sourceHashes:Object.fromEntries([...keys.map(k=>'src/defs/nodes/'+k+'.js'),'src/defs/helpers.js'].map(p=>[p,hash(fs.readFileSync(new URL(p,root)))])),examples:[]};
const gallery=[];
for(const example of examples){
  const {patch,...meta}=example;
  // Validate patch contracts, including value wires, against the actual descriptors.
  const byId=Object.fromEntries(patch.root.nodes.map(n=>[n.id,n]));
  for(const n of patch.root.nodes)for(const [key,value] of Object.entries(n.params)){
    const d=defs[n.type].params.find(p=>p.key===key);assert.ok(d,`${n.type}.${key}`);
    if(d.options)assert.ok(d.options.includes(value),`${n.type}.${key}: option`);
    if(d.min!==undefined)assert.ok(value>=d.min&&value<=d.max,`${n.type}.${key}: range`);
  }
  for(const e of patch.root.edges){
    const a=byId[e.from],b=byId[e.to];assert.ok(a&&b);
    const source=defs[a.type].outs[e.fromPort];
    const input=typeof e.toPort==='string'?{type:'value'}:(typeof defs[b.type].ins==='function'?defs[b.type].ins(b):defs[b.type].ins)[e.toPort];
    assert.equal(source.type,input.type,'matching pin types');
    if(typeof e.toPort==='string')assert.ok(defs[b.type].params.some(p=>['slider','number','seed'].includes(p.type)&&e.toPort==='p:'+p.key));
  }
  fs.writeFileSync(new URL(`patches/${meta.key}.muusia.json`,dest),JSON.stringify(patch,null,2)+'\n');
  const item={key:meta.key,patchSha256:hash(JSON.stringify(patch)),runs:[]},frames={};
  for(const N of [24,36,48]){
    const full=Array.from({length:N},(_,i)=>geometry(example,i,N));
    assert.equal(hash(JSON.stringify(full[0])),hash(JSON.stringify(geometry(example,0,N))),'determinism');
    const endpoint=distance(full[0],geometry(example,N,N,true));
    assert.ok(endpoint && endpoint.max<1e-7,example.key+': loop endpoint');
    assert.ok(new Set(full.map(f=>hash(JSON.stringify(f)))).size>=6,example.key+': visible motion');
    const transitions=full.map((f,i)=>distance(f,full[(i+1)%N]));
    const lengths=full.map(length),counts=full.map(f=>f.length);
    item.runs.push({frames:N,virtualEndpointMaxMm:endpoint.max,stableTopology:transitions.every(Boolean),seamRmsMm:transitions.at(-1)?.rms??null,
      maxAdjacentRmsMm:transitions.some(Boolean)?Math.max(...transitions.filter(Boolean).map(t=>t.rms)):null,pathsMin:Math.min(...counts),pathsMax:Math.max(...counts),
      meanLengthMm:lengths.reduce((a,b)=>a+b)/N,totalLengthMm:lengths.reduce((a,b)=>a+b),firstSvg:svgSignature(full[0]),middleSvg:svgSignature(full[N/2])});
    // 24 frames are exactly the even frames of 48; only store 36 and 48.
    if(N!==24)frames[N]=full.map(dstring);
  }
  const run24=item.runs[0];
  gallery.push({...meta,frames,runs:item.runs});report.examples.push(item);
  fs.writeFileSync(new URL(`${meta.key}.svg`,dest),`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="160" viewBox="0 0 560 160"><rect width="560" height="160" fill="#faf9f5"/>${[0,12,24,36].map((f,i)=>`<g transform="translate(${i*140},0)"><path d="${frames[48][f]}" fill="none" stroke="#233940" stroke-width=".24"/><text x="12" y="153" fill="#233940" font-size="6">${String(f+1).padStart(2,'0')} / 48</text></g>`).join('')}</svg>`);
  console.log(`${meta.key}: 24/36/48 pass; ${run24.pathsMin}–${run24.pathsMax} paths; ${(run24.meanLengthMm/1000).toFixed(1)} m/frame`);
}
fs.writeFileSync(new URL('data.json',dest),JSON.stringify(gallery)+'\n');
fs.writeFileSync(new URL('checks.json',dest),JSON.stringify(report,null,2)+'\n');
const captureFile=new URL('browser-checks.json',dest);
if(fs.existsSync(captureFile)){
  const captures=JSON.parse(fs.readFileSync(captureFile,'utf8'));
  assert.deepEqual(captures.sourceHashes,report.sourceHashes,'browser capture source snapshot');
  assert.equal(captures.engineScopeSha256,report.engineScopeSha256,'browser engine scope');
  assert.equal(captures.exportScopeSha256,report.exportScopeSha256,'browser export scope');
  for(const capture of captures.exports){
    const item=report.examples.find(e=>e.key===capture.key),run=item.runs.find(r=>r.frames===capture.frames);
    assert.equal(captures.patchHashes[capture.key],item.patchSha256,'captured patch matches');
    const expected=capture.frame===0?run.firstSvg:run.middleSvg;
    assert.ok(capture.frame===0||capture.frame===capture.frames/2);
    for(const key of ['fnv','paths','points'])assert.equal(capture[key],expected[key],capture.key+': browser '+key);
    assert.deepEqual(capture.page,['140mm','140mm']);
  }
  console.log(`${captures.exports.length} real browser SVG captures match current graphs.`);
}
const html=fs.readFileSync(new URL('index.html',dest),'utf8');
for(const [,href] of html.matchAll(/href="([^"#]+)"/g))if(!/^(https?:|mailto:)/.test(href))assert.ok(fs.existsSync(new URL(href,dest)),'local link '+href);
for(const item of gallery){
  assert.equal(item.frames[36].length,36);assert.equal(item.frames[48].length,48);
  assert.ok(fs.existsSync(new URL(`patches/${item.key}.muusia.json`,dest)));
  assert.ok(fs.existsSync(new URL(item.key+'.svg',dest)));
}
console.log('Gallery data, six project downloads and local links pass.');
