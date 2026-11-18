// Regression checks for clipping closed contours without joining hidden gaps.
// --before accepts a baked or portable previous node source and exits nonzero
// on the same independent fixtures; no Git history is needed to reproduce it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../src/defs/helpers.js';
import {N as current, canvas, presets} from './preview-text-roll.mjs';
import {ribbonPresets} from './preview-text-ribbon.mjs';

const beforeAt=process.argv.indexOf('--before');
if(beforeAt>=0&&!process.argv[beforeAt+1])throw new Error('--before requires a node source path');
function readNode(file){
  const raw=fs.readFileSync(file,'utf8').trim();
  const expression=raw.includes('export default ')?'('+raw.split('export default ')[1].replace(/;\s*$/,'')+')':raw;
  return new Function(...Object.keys(H),'return '+expression)(...Object.values(H));
}
const N=beforeAt>=0?readNode(process.argv[beforeAt+1]):current;
const defaults=Object.fromEntries(N.params.map(p=>[p.key,p.def]));
let checks=0,frames=0,longest=0;
const ok=(v,message)=>{assert.ok(v,message);checks++;};
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function segments(result){
  const out=[];
  for(const p of result.paths)for(let i=0;i<p.pts.length-(p.closed?0:1);i++)out.push([p.pts[i],p.pts[(i+1)%p.pts.length]]);
  return out;
}
function onSegment(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
  const t=length2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2)):0;
  return distance(p,[a[0]+dx*t,a[1]+dy*t])<1e-6;
}
function remainsOnSource(result,source,label){
  const edges=source.map((p,i)=>[p,source[(i+1)%source.length]]);
  ok(segments(result).every(([a,b])=>edges.some(([u,v])=>onSegment(a,u,v)&&onSegment(b,u,v))),label+': no segment cuts across a source contour');
}
const quad=(x0,y0,x1,y1,z)=>{
  const a=[x0,y0,z],b=[x1,y0,z],c=[x1,y1,z],d=[x0,y1,z];return [[a,b,c],[a,c,d]];
};

function synthetic(){
  // The final curve sample is hidden, although the first point is visible.
  // The old merge spuriously linked [55,80] to [20,19.99] (69.47 mm).
  const square=[[20,19.99,0],[80,19.99,0],[80,80,0],[20,80,0]];
  const camera={W:100,H:100,scale:1,extent:[50,50],perspective:0,focal:100,project:q=>q};
  const scene={bound:1,paths:[square],triangles:[...quad(0,20.05,55,95,1),...quad(79,45,81,55,1)]};
  const clipped=N._render({...defaults,hidden:true},scene,camera);
  ok(!!clipped&&clipped.paths.length===2,'hidden-tail square must retain two separate visible runs');
  remainsOnSource(clipped,square,'hidden-tail square');
  const max=Math.max(0,...segments(clipped).map(([a,b])=>distance(a,b)));
  ok(max<=100/420*.7+1e-7,`hidden-tail square: no long jump (observed ${max.toFixed(6)} mm)`);

  // Each projected polygon edge is < one visibility sample. Vertex depth alone
  // determines visibility through a full-screen front plane, making the kept
  // source edges independent of the implementation's run bookkeeping.
  const cam={W:420,H:420,scale:210,extent:[1,1],perspective:0,focal:100,project:q=>[210+210*q[0],210+210*q[1],q[2]]};
  const plane=[...quad(-1,-1,1,1,.5)];
  const fixtures=[
    {name:'true seam continuity',visible:[1,1,0,0,1,1,1,1],paths:1},
    {name:'terminal singleton touches seam',visible:[1,1,0,1,1,0,0,1],paths:2},
    {name:'initial singleton touches seam',visible:[1,0,0,1,1,0,1,1],paths:2},
    {name:'both seam fragments are singletons',visible:[1,0,1,1,0,0,0,1],paths:2},
    {name:'only the seam edge is visible',visible:[1,0,0,0,0,0,0,1],paths:1},
    {name:'seam stays hidden',visible:[0,1,1,0,0,1,1,0],paths:2},
    {name:'isolated interior samples are discarded',visible:[0,1,0,1,0,1,0,0],paths:0},
    {name:'fully visible contour remains closed',visible:[1,1,1,1,1,1,1,1],paths:1,closed:true},
    {name:'fully hidden contour stays empty',visible:[0,0,0,0,0,0,0,0],paths:0},
  ];
  for(const fixture of fixtures){
    const raw=fixture.visible.map((v,i)=>{const a=i/8*Math.PI*2;return [.8*Math.cos(a)/210,.8*Math.sin(a)/210,v?1:0];});
    const projected=raw.map(cam.project),out=N._render({...defaults,hidden:true},{bound:2,paths:[raw],triangles:plane},cam);
    ok(!!out&&out.paths.length===fixture.paths,fixture.name+': expected visible run count');
    ok(out.paths.every(p=>p.closed===!!fixture.closed),fixture.name+': correct open/closed result');
    remainsOnSource(out,projected,fixture.name);
    const expected=new Set();
    for(let i=0;i<8;i++)if(fixture.visible[i]&&fixture.visible[(i+1)%8])expected.add(i+','+(i+1)%8);
    const locate=p=>projected.findIndex(q=>distance(p,q)<1e-6);
    const actual=new Set(segments(out).map(([a,b])=>locate(a)+','+locate(b)));
    ok(actual.size===expected.size&&[...expected].every(e=>actual.has(e)),fixture.name+': retains exactly the visible source edges');
  }
}

function cameraFor(p,ctx){
  // Framing is invariant under sampling density. Find an available scene only
  // for its camera envelope; exported ink always comes from actual compute(),
  // including its retry/coarsening path when raw _render() would return null.
  for(let attempt=0;attempt<5;attempt++){
    const density=p.construction==='Raised ribbon'?N._n(p.ribbonLines,56,12,96):N._n(p.slices,20,2,48);
    const scene=N._scene(p,ctx,.42*1.32**attempt,Math.max(2,density/1.7**attempt));
    if(scene)return N._camera(p,ctx,scene);
  }
  throw new Error('Starter has no complete scene: '+p.text);
}
function starterFrames(){
  const records=[];
  for(const preset of [...presets,...ribbonPresets]){
    let localMax=0,localFrames=0;
    for(const frameCount of [24,32])for(let frameIdx=0;frameIdx<frameCount;frameIdx++){
      const p={...defaults,...preset.params,time:'Timeline',hidden:true},ctx={...canvas,frameIdx,frameCount};
      const result=N.compute([],p,ctx,{}),camera=cameraFor(p,ctx),limit=Math.max(...camera.extent)*camera.scale*2/420*.7;
      ok(!!result&&result.paths.length>0,preset.name+': complete nonempty frame '+frameIdx+'/'+frameCount);
      ok(result.paths.every(q=>q.pts.length>=(q.closed?3:2)&&q.pts.every(v=>v.length===2&&v.every(Number.isFinite))),preset.name+': finite XY paths');
      const edges=segments(result),max=edges.reduce((n,[a,b])=>Math.max(n,distance(a,b)),0);
      ok(max<=limit+1e-7,`${preset.name} frame ${frameIdx}/${frameCount}: illegal clipped jump ${max.toFixed(6)} mm > ${limit.toFixed(6)} mm`);
      ok(result.paths.reduce((n,q)=>n+q.pts.length,0)<=120000,preset.name+': output budget');
      localMax=Math.max(localMax,max);longest=Math.max(longest,max);localFrames++;frames++;
    }
    records.push({name:preset.name,frames:localFrames,maxEdgeMm:+localMax.toFixed(6)});
  }
  return records;
}

try{
  synthetic();
  const records=starterFrames();
  console.log(JSON.stringify({implementation:beforeAt>=0?'previous source':'current source',checks,frames,maxEdgeMm:+longest.toFixed(6),starters:records},null,2));
  console.log(`Text Roll clipping: ${checks} checks passed; independent seam/singleton fixtures and ${frames} actual compute frames, with no hidden-gap chords.`);
}catch(error){
  console.error(`Text Roll clipping [${beforeAt>=0?'previous source':'current source'}] FAILED: ${error.message}`);
  process.exitCode=1;
}
