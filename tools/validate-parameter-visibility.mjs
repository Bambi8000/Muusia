import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {describeNode} from '../src/muusia-guide.js';
import {applyStyle} from '../src/defs/helpers.js';
import {VISIBILITY_RULES,withParameterVisibility,isParameterActive,parameterPresentation} from '../src/defs/parameter-visibility.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const ctx={W:200,H:160,frameIdx:3,frameCount:12,t:.25};
const input={paths:[{pts:[[25,25],[95,25],[95,75],[25,75]],closed:true,layer:0},{pts:[[115,70],[175,75],[165,130],[120,125]],closed:true,layer:1},{pts:[[15,140],[75,95],[185,145]],closed:false,layer:2}]};
const mesh={vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],faces:[[0,1,2],[0,1,3],[0,2,3],[1,2,3]]};
const g=Array.from({length:32*24},(_,i)=>.15+.8*((i*31%71)/71));
const node={id:1,data:{img:{w:32,h:24,g,rgb:g.flatMap((v,i)=>[v,((i*7)%23)/23,1-v])}}};
function inputs(N,p){const pins=typeof N.ins==='function'?N.ins({params:p}):N.ins;return(pins||[]).map(pin=>pin.type==='paths'?input:pin.type==='value'?.25:pin.type==='mesh'?mesh:undefined);}
function values(pd){if(pd.type==='multi')return[[],pd.options.slice(0,1),pd.options];if(pd.options)return pd.options;if(pd.type==='check')return[false,true];if(pd.type==='seed')return[1,11];if(pd.type==='pen')return[0,5];if(pd.type==='text')return[pd.def,'AB|12'];if(['slider','number'].includes(pd.type)){const lo=pd.min??0,hi=pd.max??100;return[lo,lo+(hi-lo)*.31,lo+(hi-lo)*.73];}return[pd.def];}
function statesFor(N){const base=Object.fromEntries(N.params.map(p=>[p.key,p.def])),rules=VISIBILITY_RULES.filter(r=>r.node===N.key),states=new Map();const push=p=>states.set(JSON.stringify(p),p);push(base);for(const pd of N.params)if(pd.type==='select')for(const v of values(pd))push({...base,[pd.key]:v});
  const selectors=N.params.filter(d=>d.type==='select');for(let i=0;i<selectors.length;i++)for(let j=i+1;j<selectors.length;j++)for(const a of values(selectors[i]))for(const b of values(selectors[j]))push({...base,[selectors[i].key]:a,[selectors[j].key]:b});
  for(const pd of N.params.filter(d=>d.type==='check'))for(const s of selectors)for(const v of values(s))for(const enabled of [false,true])push({...base,[s.key]:v,[pd.key]:enabled});
  for(const r of rules){const deps=new Set();const read=p=>{try{r.test(new Proxy(p,{get:(o,k)=>{deps.add(k);return o[k];}}));}catch{}};read(base);for(const pd of N.params)if(pd.options||pd.type==='check')for(const v of values(pd))read({...base,[pd.key]:v});
    const defs=N.params.filter(p=>deps.has(p.key));let combos=[base];for(const pd of defs){const vals=values(pd);combos=combos.flatMap(p=>vals.map(v=>({...p,[pd.key]:v})));}for(const p of combos)push(p);
  }return [...states.values()];}
async function probe(file){const raw=(await import('../src/defs/nodes/'+file)).default,N=withParameterVisibility(raw),states=statesFor(raw);let comparisons=0,empty=0;const errors=[];
  assert.equal(N.compute,raw.compute);assert.equal(N.overlay,raw.overlay);assert.deepEqual(N.params.map(({showIf:_showIf,...p})=>p),raw.params.map(({showIf:_showIf,...p})=>p));
  for(const p of states){const hidden=N.params.filter(pd=>!isParameterActive(pd,p)&&isParameterActive(raw.params.find(q=>q.key===pd.key),p));if(!hidden.length)continue;
    const ins=inputs(N,p);const fixture={...node,data:{...node.data}};
    if(N.key==='svgimport')fixture.data.svg={...input,bbox:{x:15,y:25,w:170,h:120},colors:['#23242A','#2675cb','#ef435a']};
    if(N.key==='pointcloud')fixture.data.svg={pts3:Array.from({length:40},(_,i)=>[Math.sin(i)*20,Math.cos(i)*20,i-20])};
    if(N.key==='soundline')fixture.data.svg={kind:'audio',sr:100,dur:2.56,smp:Array.from({length:256},(_,i)=>Math.sin(i*.21)),hi:Array.from({length:256},(_,i)=>.2+.6*Math.abs(Math.sin(i*.07))),lo:Array.from({length:256},(_,i)=>-.2-.6*Math.abs(Math.cos(i*.1)))};
    if(N.key==='map_import')fixture.data.svg=N.onFile(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{highway:'primary'},geometry:{type:'LineString',coordinates:[[24,60],[24.01,60.01],[24.02,60]]}},{type:'Feature',properties:{highway:'footway'},geometry:{type:'LineString',coordinates:[[24,60.01],[24.02,60.01]]}},{type:'Feature',properties:{railway:'rail'},geometry:{type:'LineString',coordinates:[[24,60.005],[24.02,60.005]]}},{type:'Feature',properties:{natural:'water'},geometry:{type:'Polygon',coordinates:[[[24.005,60.002],[24.01,60.002],[24.01,60.004],[24.005,60.002]]]}},{type:'Feature',properties:{building:'yes'},geometry:{type:'Polygon',coordinates:[[[24.014,60.005],[24.017,60.005],[24.017,60.008],[24.014,60.005]]]}}]}));
    let out;try{out=N.compute(ins,p,ctx,fixture);}catch(e){errors.push({state:p,error:e.message});continue;}if(out?.paths&&!out.paths.length){empty++;continue;}const interpreted=x=>x?.kind==='style'?applyStyle(input,x):x;const digest=hash(interpreted(out));
    for(const pd of hidden)for(const v of values(pd)){if(v===p[pd.key])continue;try{const changed=N.compute(ins,{...p,[pd.key]:v},ctx,fixture);comparisons++;if(hash(interpreted(changed))!==digest)errors.push({key:pd.key,state:Object.fromEntries(N.params.filter(q=>q.options||q.type==='check'||q.key===pd.key).map(q=>[q.key,p[q.key]])),changed:v});}catch(e){errors.push({key:pd.key,error:e.message});}}
  }return {key:raw.key,states:states.length,comparisons,empty,errors};}
if(!isMainThread){try{parentPort.postMessage(await probe(workerData.file));}catch(e){parentPort.postMessage({file:workerData.file,error:e.stack});}}
else{
  const files=(await fs.readdir('src/defs/nodes')).filter(f=>f.endsWith('.js')).sort(),known=new Map();let predicates=0;
  for(const file of files){const raw=(await import('../src/defs/nodes/'+file)).default;known.set(raw.key,file);const N=withParameterVisibility(raw);for(const p of statesFor(N))for(const pd of N.params){assert.equal(typeof isParameterActive(pd,p),'boolean');predicates++;}assert.equal(N.compute,raw.compute);assert.equal(N.overlay,raw.overlay);}
  for(const r of VISIBILITY_RULES){assert.ok(known.has(r.node),r.node);const N=(await import('../src/defs/nodes/'+known.get(r.node))).default;for(const key of r.keys)assert.ok(N.params.some(p=>p.key===key),r.node+'.'+key);}
  const custom={key:'my_custom',params:[{key:'size',def:1}],compute(){}};assert.equal(withParameterVisibility(custom),custom);assert.equal(isParameterActive({showIf(){throw Error();}},{}),true);
  // User-facing visibility and live numeric wiring share one contract.
  const retro=withParameterVisibility((await import('../src/defs/nodes/retromesh.js')).default);
  const rp=Object.fromEntries(retro.params.map(p=>[p.key,p.def])),floor={...rp,mode:'Laser floor'};
  const param=key=>retro.params.find(p=>p.key===key);
  for(const key of ['flare','throat','height','persp']){assert.equal(isParameterActive(param(key),rp),true);assert.equal(parameterPresentation(param(key),floor),'hidden');}
  assert.equal(parameterPresentation(param('terrain'),rp,true),'connection');assert.equal(parameterPresentation(param('terrain'),floor,true),'control');
  assert.equal(isParameterActive(param('seed'),{...floor,terrain:0}),false);assert.equal(isParameterActive(param('seed'),{...floor,terrain:1}),true);
  const rn={id:11,type:'retromesh',params:floor},level={nodes:[rn],edges:[]};const before=JSON.stringify(level);
  const described=describeNode(rn,level,{retromesh:retro},{},{},{11:{...floor,terrain:0}});
  assert.equal(described.parameters.find(p=>p.key==='seed').active,false);assert.equal(JSON.stringify(level),before);
  const coral=withParameterVisibility((await import('../src/defs/nodes/coral.js')).default);assert.equal(isParameterActive(coral.params.find(p=>p.key==='pen3'),{colours:2.6}),true);
  assert.ok(retro.params.every(p=>isParameterActive(p,{...rp,mode:'Unknown legacy mode'})));
  const targets=[...new Set(VISIBILITY_RULES.map(r=>r.node))].filter(k=>!process.argv.includes('--node')||k===process.argv[process.argv.indexOf('--node')+1]);const results=[];let next=0;
  async function pool(){while(next<targets.length){const key=targets[next++];const result=await new Promise(resolve=>{const w=new Worker(new URL(import.meta.url),{workerData:{file:known.get(key)}});const timer=setTimeout(()=>{w.terminate();resolve({key,timeout:true});},45000);w.once('message',r=>{clearTimeout(timer);w.terminate();resolve(r);});w.once('error',e=>{clearTimeout(timer);resolve({key,error:e.message});});});results.push(result);if(result.errors?.length||result.error)console.log('FAIL',JSON.stringify(result));else if(result.timeout)console.log('TIMEOUT',key);}}
  await Promise.all([pool(),pool()]);const report={modules:files.length,predicates,rules:VISIBILITY_RULES.length,affectedNodes:targets.length,comparisons:results.reduce((s,r)=>s+(r.comparisons||0),0),results};await fs.writeFile('/tmp/muusia-visibility-validation.json',JSON.stringify(report,null,2));
  console.log(`Visibility: ${files.length} modules, ${predicates} predicate cases, ${targets.length} corrected nodes, ${report.comparisons} hidden-value comparisons.`);
  if(results.some(r=>r.errors?.length||r.error||r.timeout))process.exitCode=1;
}
