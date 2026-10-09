// A real Muusia graph: periodic downward Grid Hairs + a rotating Solids sphere.
// This fixture is separate from the six-example gallery's reviewed captures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EMPTY, PENS} from '../src/defs/helpers.js';

const root=new URL('../',import.meta.url),dest=new URL('docs/animation-composite/',root);
fs.mkdirSync(dest,{recursive:true});
const keys=['frame','matem','grid_hairs','crop','array','move_scale','container','solids','merge'];
const defs=Object.fromEntries(await Promise.all(keys.map(async k=>[k,(await import(`../src/defs/nodes/${k}.js`)).default])));
const hash=v=>createHash('sha256').update(v).digest('hex');
const app=fs.readFileSync(new URL('src/App.jsx',root),'utf8');
const engine=app.slice(app.indexOf('function defIns(node)'),app.indexOf('/* ============================================================\n   G-CODE'));
assert.ok(engine.includes('function evalLevel')&&engine.endsWith('\n\n'));
const solid=JSON.parse(app.match(/const SOLID_STYLE = (\{[^;]+\});/)[1].replace(/(\w+):/g,'"$1":'));
const evaluate=new Function('DEFS','EMPTY','SOLID_STYLE',engine+'\nreturn evalLevel;')(defs,EMPTY,solid);
const exporter=app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export'));
const toSVG=new Function('PENS',exporter+'\nreturn toSVG;')(PENS);
const nativeFrame=defs.frame;
defs.frame={...nativeFrame,compute(ins,p,ctx){
  // Only the virtual endpoint bypasses Frame's last-frame clamp.
  return ctx.virtualEnd?[1,ctx.frameCount,0,0,360]:nativeFrame.compute(ins,p,ctx);
}};

let id=100;
const nodes=[],edges=[];
const add=(type,params,x,y)=>{
  const n={id:++id,type,x,y,params:{...Object.fromEntries(defs[type].params.map(p=>[p.key,p.def])),...params}};
  nodes.push(n);return n;
};
const wire=(from,to,toPort,fromPort=0)=>edges.push({id:'e'+(++id),from:from.id,fromPort,to:to.id,toPort});
const clock=add('frame',{},20,20);
const down=add('matem',{op:'A ÷ B',b:15},270,20);
const offset=add('matem',{op:'A − B',b:24},520,20);
const turn=add('matem',{op:'A + B',b:17},1020,20);
wire(clock,down,0,4);wire(down,offset,0);wire(clock,turn,0,4);
const hairs=add('grid_hairs',{cellW:8,cellH:8,count:7,pattern:'Crosshatch',length:95,margin:6,gap:.6,seed:28},20,420);
const tile=add('crop',{x:6,y:6,w:128,h:24},270,420);
const repeat=add('array',{count:7,dx:0,dy:24},520,420);
const shift=add('move_scale',{dy:-24},770,420);
const page=add('crop',{x:10,y:10,w:120,h:120},1020,420);
const background=add('container',{shape:'Circle',cx:70,cy:70,cr:40,keep:'Outside',draw:false},1270,420);
const sphere=add('solids',{shape:'Sphere',size:76,rx:27,ry:17,rz:12,persp:0,lat:9,lon:12,px:70,py:70},1270,1180);
const merge=add('merge',{},1520,420);
wire(hairs,tile,0);wire(tile,repeat,0);wire(repeat,shift,0);wire(offset,shift,'p:dy');wire(shift,page,0);
wire(page,background,0);wire(turn,sphere,'p:ry');wire(background,merge,0);wire(sphere,merge,1);
const patch={app:'muusia',v:1,name:'Grid Hairs + rotating Solids',canvas:{W:140,H:140},root:{nodes,edges,outputId:merge.id}};
const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
for(const n of nodes)for(const [k,v] of Object.entries(n.params)){
  const d=defs[n.type].params.find(p=>p.key===k);assert.ok(d);
  if(d.options)assert.ok(d.options.includes(v));
  if(d.min!==undefined)assert.ok(v>=d.min&&v<=d.max,`${n.type}.${k}`);
}
for(const e of edges){
  const a=byId[e.from],b=byId[e.to];assert.ok(a&&b);
  const source=defs[a.type].outs[e.fromPort];
  const input=typeof e.toPort==='string'?{type:'value'}:(typeof defs[b.type].ins==='function'?defs[b.type].ins(b):defs[b.type].ins)[e.toPort];
  assert.equal(source.type,input.type);
  if(typeof e.toPort==='string')assert.ok(defs[b.type].params.some(p=>['slider','number','seed'].includes(p.type)&&e.toPort==='p:'+p.key));
}
fs.writeFileSync(new URL('grid-hairs-solids.muusia.json',dest),JSON.stringify(patch,null,2)+'\n');
function frame(i,N,virtualEnd=false){
  const out=evaluate(patch.root,{...patch.canvas,frameIdx:i,frameCount:N,virtualEnd}).out;
  const bg=out[background.id][0].paths,fg=out[sphere.id][0].paths,merged=out[merge.id][0].paths;
  assert.deepEqual(merged,[...bg,...fg],'Merge combines both evaluated branches in this frame');
  assert.ok(bg.length&&fg.length);
  for(const path of merged){
    assert.equal(path.layer,0);assert.ok(path.pts.length>=2);
    for(const [x,y] of path.pts)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=9.999&&x<=130.001&&y>=9.999&&y<=130.001,'page bounds');
  }
  for(const path of bg)for(const [x,y] of path.pts)assert.ok(Math.hypot(x-70,y-70 )>39.995,'background stays outside sphere');
  for(const path of fg)for(const [x,y] of path.pts)assert.ok(Math.hypot(x-70,y-70)<=38.000001,'sphere silhouette');
  return {bg,fg,merged};
}
function distance(a,b){
  assert.equal(a.length,b.length,'endpoint path count');let max=0;
  const pointSegment=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],l=x*x+y*y,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/l)):0;return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);};
  const directed=(a,b)=>Math.max(...a.pts.map(p=>Math.min(...b.pts.slice(1).map((q,j)=>pointSegment(p,b.pts[j],q)),...(b.closed?[pointSegment(p,b.pts.at(-1),b.pts[0])]:[]))));
  for(let i=0;i<a.length;i++){
    assert.equal(a[i].closed,b[i].closed);
    // Crop/Container resampling can add a redundant collinear vertex after
    // translation. Compare the actual strokes in both directions, not counts.
    max=Math.max(max,directed(a[i],b[i]),directed(b[i],a[i]));
  }
  return max;
}
const dstring=paths=>paths.map(p=>p.pts.map(([x,y],i)=>(i?'L':'M')+(+x.toFixed(3))+','+(+y.toFixed(3))).join('')+(p.closed?'Z':'')).join('');
function signature(paths){
  const ds=[...toSVG({paths},patch.canvas).matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
  let h=2166136261;for(const c of ds.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  return {paths:paths.length,points:paths.reduce((n,p)=>n+p.pts.length,0),fnv:h.toString(16).padStart(8,'0'),sha256:hash(ds.join('|'))};
}
function length(paths){let n=0;for(const p of paths)for(let i=1;i<p.pts.length+(p.closed?1:0);i++)n+=Math.hypot(p.pts[i-1][0]-p.pts[i%p.pts.length][0],p.pts[i-1][1]-p.pts[i%p.pts.length][1]);return n;}
const checks={schemaVersion:1,scope:'Actual App evaluator/exporter; stored frames use the built-in Frame node. Virtual phase 1 tests the loop endpoint. No hardware or batch-ZIP claim.',
  engineScopeSha256:hash(engine),exportScopeSha256:hash(exporter),patchSha256:hash(JSON.stringify(patch)),
  sourceHashes:Object.fromEntries([...keys.map(k=>'src/defs/nodes/'+k+'.js'),'src/defs/helpers.js'].map(p=>[p,hash(fs.readFileSync(new URL(p,root)))])),runs:[]};
const data={frames:{},runs:[]};
for(const N of [24,36,48]){
  const frames=Array.from({length:N},(_,i)=>frame(i,N));
  assert.deepEqual(frames[0],frame(0,N),'deterministic graph');
  const endpoint=distance(frames[0].merged,frame(N,N,true).merged);
  assert.ok(endpoint<.001,'virtual phase 1 equals phase 0 within clipping precision (0.001 mm)');
  assert.equal(new Set(frames.map(f=>hash(dstring(f.bg)))).size,N,'background moves each frame');
  assert.ok(new Set(frames.map(f=>hash(dstring(f.fg)))).size>=N/2,'sphere rotates');
  const run={frames:N,virtualEndpointMaxMm:endpoint,pathsMin:Math.min(...frames.map(f=>f.merged.length)),pathsMax:Math.max(...frames.map(f=>f.merged.length)),
    meanLengthMm:frames.reduce((s,f)=>s+length(f.merged),0)/N,firstSvg:signature(frames[0].merged),middleSvg:signature(frames[N/2].merged)};
  if(N===36) run.reportedFrameSvg={frame:7,...signature(frames[7].merged)};
  checks.runs.push(run);data.runs.push(run);
  data.frames[N]=frames.map(f=>({bg:dstring(f.bg),fg:dstring(f.fg)}));
  if(N===36){
    fs.writeFileSync(new URL('first-frame.svg',dest),toSVG({paths:frames[0].merged},patch.canvas));
    fs.writeFileSync(new URL('contact-sheet.svg',dest),`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="312" viewBox="0 0 560 156"><rect width="560" height="156" fill="#fff"/>${[0,4,9,14].map((f,i)=>`<g transform="translate(${i*140},0)"><path d="${dstring(frames[f].merged)}" fill="none" stroke="#172a2d" stroke-width=".24" stroke-linecap="round"/><text x="10" y="149" font-family="sans-serif" font-size="5">${String(f+1).padStart(2,'0')} / 36</text></g>`).join('')}</svg>`);
  }
  console.log(`${N} frames: ${run.pathsMin}–${run.pathsMax} paths; ${(run.meanLengthMm/1000).toFixed(2)} m/frame; endpoint ${endpoint.toExponential(1)} mm`);
}
fs.writeFileSync(new URL('data.json',dest),JSON.stringify(data)+'\n');
fs.writeFileSync(new URL('checks.json',dest),JSON.stringify(checks,null,2)+'\n');
const captureFile=new URL('browser-checks.json',dest);
if(fs.existsSync(captureFile)){
  const c=JSON.parse(fs.readFileSync(captureFile,'utf8'));
  for(const k of ['engineScopeSha256','exportScopeSha256','patchSha256','sourceHashes'])assert.deepEqual(c[k],checks[k],'browser provenance '+k);
  for(const entry of c.exports){
    const run=checks.runs.find(r=>r.frames===entry.frames);assert.ok(run);
    const expected=entry.frame===0?run.firstSvg:entry.frame===entry.frames/2?run.middleSvg:entry.frame===run.reportedFrameSvg?.frame?run.reportedFrameSvg:null;
    assert.ok(expected,'known browser capture frame');
    for(const key of ['fnv','paths','points'])assert.equal(entry[key],expected[key],'browser '+key);
    assert.deepEqual(entry.page,['140mm','140mm']);
  }
  console.log(`${c.exports.length} real browser SVG exports match.`);
}
const html=fs.readFileSync(new URL('index.html',dest),'utf8');
for(const [,href] of html.matchAll(/href="([^"#]+)"/g))if(!/^(https?:|mailto:)/.test(href))assert.ok(fs.existsSync(new URL(href,dest)),'local link '+href);
console.log('Composite graph, page bounds, masking, 24/36/48 loops and local links pass.');
