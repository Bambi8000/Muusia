// Offline design probes against real bundled nodes; does not change the app.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir = new URL('../docs/animation-audit/', import.meta.url);
const keys = ['frame', 'lfo', 'matem', 'grid', 'aaltoilu', 'lissajous', 'grid_hairs', 'iris', 'murmuration', 'plaid', 'ribbon', 'concrete'];
const defs = Object.fromEntries(await Promise.all(keys.map(async k => [k, (await import(`../src/defs/nodes/${k}.js`)).default])));
const defaults = k => Object.fromEntries(defs[k].params.map(p => [p.key, p.def]));
const ctx = {W:140, H:140};
const run = (k, p, ins = [], f = 0, n = 48) => defs[k].compute(ins, {...defaults(k), ...p}, {...ctx, frameIdx:f, frameCount:n});
const pulse = u => .5 - .5 * Math.cos(2*Math.PI*u);
const grid = run('grid', {vlines:0, hlines:12, margin:16, res:2});
const cases = [
  {key:'lissajous', title:'Lissajous · kiertävä vaihe', recipe:'Freq X 3, Freq Y 4, Turns 1, Damping 0; Phase = 2πu.', fn:u=>run('lissajous',{turns:1,damp:0,phase:2*Math.PI*u,margin:16,layer:0})},
  {key:'aaltoilu', title:'Grid → Wave · kulkeva aalto', recipe:'Grid: 12 vaakaviivaa. Wave: Amplitude 3 mm, Wavelength 36 mm; Phase = 2πu.', fn:u=>run('aaltoilu',{amp:3,wl:36,phase:2*Math.PI*u},[grid])},
  {key:'grid_hairs', title:'Grid Hairs · keinuvat solut', recipe:'Crosshatch, solut 20 × 20 mm, 5 viivaa/solu, Seed 28; Angle = 10 + 40w astetta.', fn:u=>run('grid_hairs',{cellW:20,cellH:20,count:5,angle:10+40*pulse(u),length:85,margin:10})},
  {key:'iris', title:'Iris · hengittävä pupilli', recipe:'Human, Diameter 112 mm, 240 Fibres, Pupil finish Open, Seed 17; Pupil size = 0.18 + 0.24w.', fn:u=>run('iris',{diameter:112,fibres:240,pupilFill:'Open',pupil:.18+.24*pulse(u),texture:.3})},
  {key:'murmuration', title:'Murmuration · palaava parvi', recipe:'60 lintua, Figure-8, Travel 0.3, Flock radius 25 mm, Scatter 3 mm, Size 1.4 mm, Seed 3; Time = u.', fn:u=>run('murmuration',{birds:60,path:'Figure-8',travel:.3,spread:25,scatter:3,size:1.4,time:u})},
  {key:'plaid', title:'Plaid · ruudukot syvyydessä', recipe:'3 Grids, Size 85, Cell min 14 / max 20, Bands 1, Bob 8°, Seed 7; Phase = u.', fn:u=>run('plaid',{grids:3,size:85,cellmin:14,cellmax:20,bands:1,bob:8,phase:u})},
  {key:'ribbon', title:'Ribbon · hengittävät laskokset', recipe:'Organic / Pleated, 14 Lines, Bends 3, Flares 3, Seed 27; Width = 35 + 20w mm; Fold turns = 0.7 + 0.5w.', fn:u=>run('ribbon',{shape:'Organic',organicForm:'Pleated',lines:14,width:35+20*pulse(u),twist:.7+.5*pulse(u),margin:12})},
  {key:'concrete', title:'Concrete Poetry · liikkuvat rivit', recipe:'Columns, teksti LOOP, Size 9, Motion Wave, Clock Phase input, Distance 6, Amount 0.65; Phase = u.', fn:(u,f,n)=>run('concrete',{mode:'Columns',text:'LOOP',size:9,motion:'Wave',clock:'Phase input',distance:6,amount:.65,phase:u},[],f,n)},
];
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function geometry(ps) {
  assert.ok(ps && Array.isArray(ps.paths) && ps.paths.length, 'nonempty path set');
  for(const p of ps.paths) {
    assert.ok(p.pts.length>=2 && Number.isInteger(p.layer), 'drawable paths and integer pens');
    for(const v of p.pts) assert.ok(v.every(Number.isFinite), 'finite coordinates');
  }
  return ps.paths.map(p=>({pts:p.pts,layer:p.layer,closed:!!p.closed}));
}
function distance(a,b) {
  if(a.length!==b.length) return null;
  let sum=0,n=0,max=0;
  for(let i=0;i<a.length;i++) {
    if(a[i].pts.length!==b[i].pts.length || a[i].closed!==b[i].closed || a[i].layer!==b[i].layer) return null;
    for(let j=0;j<a[i].pts.length;j++) {
      const d=Math.hypot(a[i].pts[j][0]-b[i].pts[j][0],a[i].pts[j][1]-b[i].pts[j][1]);
      sum+=d*d; n++; max=Math.max(max,d);
    }
  }
  return {rms:Math.sqrt(sum/n),max};
}
function length(paths) {
  let l=0;
  for(const p of paths) for(let i=1;i<p.pts.length+(p.closed?1:0);i++) {
    const a=p.pts[i-1],b=p.pts[i%p.pts.length];l+=Math.hypot(b[0]-a[0],b[1]-a[1]);
  }
  return l;
}
// Only the on-screen preview is simplified (0.1 mm on a 140 mm canvas).
// All reported measurements and continuity checks use the full geometry.
function previewPoints(points) {
  if(points.length<3) return points;
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const stack=[[0,points.length-1]];
  while(stack.length) {
    const [a,b]=stack.pop(),A=points[a],B=points[b],dx=B[0]-A[0],dy=B[1]-A[1],l=dx*dx+dy*dy;
    let far=-1,max=.01;
    for(let i=a+1;i<b;i++) {
      const p=points[i],t=l?Math.max(0,Math.min(1,((p[0]-A[0])*dx+(p[1]-A[1])*dy)/l)):0;
      const d=(p[0]-A[0]-t*dx)**2+(p[1]-A[1]-t*dy)**2;
      if(d>max){max=d;far=i;}
    }
    if(far>=0){keep[far]=1;stack.push([a,far],[far,b]);}
  }
  return points.filter((_,i)=>keep[i]);
}
const sourceFiles=[...keys.map(k=>'src/defs/nodes/'+k+'.js'),'src/defs/helpers.js'];
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url))).digest('hex')]));
const report={schemaVersion:1,canvas:ctx,sourceHashes,scope:'Offline node geometry only; no browser export, machine or physical plotting validation.',probes:[],clock:{}};
const previews=[];
for(const c of cases) {
  const item={key:c.key,title:c.title,recipe:c.recipe,runs:[]};
  for(const N of [24,48]) {
    const t=performance.now();
    const frames=Array.from({length:N},(_,i)=>geometry(c.fn(i/N,i,N)));
    assert.equal(digest(frames[0]),digest(geometry(c.fn(0,0,N))),`${c.key}: deterministic`);
    const endpoint=geometry(c.fn(1,N,N)), end=distance(frames[0],endpoint);
    assert.ok(end && end.max<1e-7,`${c.key}: virtual N must equal frame 0`);
    const adjacent=frames.map((f,i)=>distance(f,frames[(i+1)%N]));
    const comparable=adjacent.filter(Boolean),lens=frames.map(length),counts=frames.map(p=>p.length);
    item.runs.push({frames:N,virtualEndpointMaxMm:end.max,allAdjacentTopologyStable:comparable.length===N,nonComparableTransitions:N-comparable.length,seamRmsMm:adjacent.at(-1)?.rms??null,maxAdjacentRmsMm:comparable.length?Math.max(...comparable.map(d=>d.rms)):null,pathsMin:Math.min(...counts),pathsMax:Math.max(...counts),lengthTotalMm:lens.reduce((a,b)=>a+b,0),meanLengthMm:lens.reduce((a,b)=>a+b,0)/N,computeMs:Math.round(performance.now()-t),deterministic:true});
    if(N===48) previews.push({key:c.key,title:c.title,recipe:c.recipe,frames:frames.map(ps=>ps.map(p=>({d:previewPoints(p.pts).map((v,i)=>(i?'L':'M')+v.slice(0,2).map(x=>+x.toFixed(2)).join(',')).join('')+(p.closed?'Z':''),layer:p.layer})))});
  }
  report.probes.push(item);
}
for(const N of [24,48]) {
  const frames=Array.from({length:N},(_,i)=>run('frame',{},[],i,N));
  const normalized=frames.map(f=>run('matem',{op:'A ÷ B',b:10},[run('matem',{op:'A ÷ B',b:36},[f[4]])]));
  normalized.forEach((u,i)=>assert.ok(Math.abs(u-i/N)<1e-12));
  assert.equal(frames.at(-1)[0],1);
  assert.ok(normalized.at(-1)<1);
  report.clock[N]={inclusiveTEnd:frames.at(-1)[0],loopPhaseEnd:normalized.at(-1),waveAtStart:frames[0][2],waveAtVirtualEnd:0};
}
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(new URL('probes.json',dir),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(new URL('previews.json',dir),JSON.stringify(previews)+'\n');
console.log(JSON.stringify(report,null,2));
