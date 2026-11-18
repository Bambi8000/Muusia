// Blue Drawing input regression checks. Optional --baseline FILE also compares
// the existing image/tone modes directly with a portable or ESM previous node.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as H from '../src/defs/helpers.js';
import N from '../src/defs/nodes/slice_raster.js';
import Lettering from '../src/defs/nodes/lettering.js';
import {EXAMPLES} from '../src/examples.js';

const defaults=Object.fromEntries(N.params.map(p=>[p.key,p.def]));
const ctx={W:100,H:80};
const base={...defaults,margin:8,count:4,gap:.5,drawingWidth:3,contrast:1,gamma:1,cutoff:0};
const rasters=['Lines','Dots','Crosshatch','Waves','Squares','Diamonds'];
const layouts=['Strips','Grid','Collage'];
let checks=0,frames=0,legacyCases=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const node=img=>({data:{img}});
const image=(fn,w=24,h=16)=>({w,h,g:Array.from({length:w*h},(_,i)=>fn((i%w+.5)/w,(Math.floor(i/w)+.5)/h))});
const ramp=image((x,y)=>.1+.75*x+.1*Math.sin(y*7)),black=image(()=>1);
const rect=(x0,y0,x1,y1,layer=0,closed=true)=>({pts:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],closed,layer});
const source={paths:[rect(14,14,86,66,7),rect(35,27,65,53,7)]};
const run=(over={},src=source,loaded,context=ctx,style)=>N.compute([style,src],{...base,...over},context,loaded?node(loaded):{});
const layout=(over={},src=source,loaded,context=ctx)=>N._layout({...base,...over},context,loaded?node(loaded):{},[undefined,src]);
const sample=(src,x,y,over={})=>layout(over,src)?.rawSample(x,y)??0;
const empty=(result,label)=>ok(result?.paths?.length===0,label);
function readNode(file){
  const raw=fs.readFileSync(file,'utf8').trim();
  const expression=raw.includes('export default ')?'('+raw.split('export default ')[1].replace(/;\s*$/,'')+')':raw;
  return new Function(...Object.keys(H),'return '+expression)(...Object.values(H));
}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
function inside(q,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<a[0]+(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1]))hit=!hit;}return hit;}
function onEdge(q,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy)<1e-5;}
const covered=(q,poly)=>inside(q,poly)||poly.some((a,i)=>onEdge(q,a,poly[(i+1)%poly.length]));
function valid(result,p,src=source,context=ctx,nonempty=true){
  const G=N._layout(p,context,{},[undefined,src]);
  if(nonempty)ok(result.paths.length>0,'wired drawing produces real strokes');
  ok(result.paths.reduce((n,path)=>n+path.pts.length,0)<=110000,'whole output remains inside point budget');
  ok(result.paths.every(path=>path.closed===false&&path.pts.length>=2&&path.pts.every(q=>q.length===2&&q.every(Number.isFinite)&&q[0]>=p.margin-1e-5&&q[0]<=context.W-p.margin+1e-5&&q[1]>=p.margin-1e-5&&q[1]<=context.H-p.margin+1e-5)),'finite open paths clipped to physical canvas margin');
  ok(result.paths.every(path=>Number.isInteger(path.slice)&&G.configs[path.slice-1]?.pen===path.layer),'output pen comes from its slice, independently of source pen');
  for(const path of result.paths){const regions=G.regions.filter(r=>r.id===path.slice);for(let i=1;i<path.pts.length;i++){const a=path.pts[i-1],b=path.pts[i];assert(Math.hypot(b[0]-a[0],b[1]-a[1])>1e-8,'no zero-length output segments');for(const t of [0,.5,1])assert(regions.some(r=>covered([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],r.poly)),'stroke remains in its own moving region');}}
  checks++;
}

function definitionAndPrecedence(){
  equal(N.ins.map(p=>[p.type,p.label]),[['style','Style'],['paths','Drawing']],'Style keeps index 0; blue Drawing is index 1');
  equal(N.params.find(p=>p.key==='source').options,['Auto','Image file','Tone study','Drawing (wired)'],'saved source names remain intact');
  equal(defaults.drawingWidth,1.8,'physical drawing stroke defaults to 1.8 mm');
  equal(defaults.drawingFill,false,'closed shape fill is optional');
  const wired=run({source:'Drawing (wired)'});
  ok(wired.paths.length>0,'explicit connected drawing is nonempty');
  equal(run({source:'Auto'},source,black),wired,'Auto gives blue drawing priority over loaded image');
  equal(run({source:'Drawing (wired)',file:'stale.png'},source,black),wired,'explicit drawing ignores stale loaded file');
  empty(run({source:'Auto'},H.EMPTY,black),'connected EMPTY suppresses an old loaded image');
  empty(run({source:'Auto'},H.EMPTY),'connected EMPTY suppresses tone fallback');
  empty(N.compute([undefined,undefined],{...base,source:'Drawing (wired)'},ctx,node(black)),'Drawing (wired) without a wire stays empty');
  empty(N.compute([source],{...base,source:'Drawing (wired)'},ctx,node(black)),'a value on Style input is never mistaken for Drawing');
  for(const mode of ['Image file','Tone study']){
    const p={...base,source:mode};
    equal(N.compute([undefined,source],p,ctx,node(ramp)),N.compute([],p,ctx,node(ramp)),mode+' ignores a nonempty blue wire');
    equal(N.compute([undefined,H.EMPTY],p,ctx,node(ramp)),N.compute([],p,ctx,node(ramp)),mode+' ignores an empty blue wire');
  }
  empty(run({source:'Image file'},source),'explicit image still requires a loaded file despite a blue wire');
  const style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,seed:3};
  equal(run({},source,undefined,ctx,style),H.applyStyle(run(),style),'Style index 0 is applied after complete drawing rasterisation');
  const invalidFile={w:2,h:2,g:[0]};
  equal(run({},source,invalidFile),run(),'malformed stale image does not override a valid connected drawing');
  ok(N.overlay(base,ctx,[undefined,source],node(black)).length===4,'slice guides use the connected drawing frame');
  ok(N.overlay(base,ctx,[undefined,H.EMPTY],node(black)).length===0,'connected EMPTY clears guides as well as ink');
}

function registrationAndFill(){
  const line={paths:[{pts:[[23,20],[23,60]],closed:false,layer:11}]};
  ok(sample(line,23,35)>.9,'source line retains its canvas position');
  ok(sample(line,50,35)<.01&&sample(line,77,35)<.01,'source is not fitted or centred by its own bounds');
  const reference=layout({},line);
  equal(reference.box,{x0:8,y0:8,x1:92,y1:72},'drawing frame is the full page margin rectangle');
  const probes=[[23,35],[23,58],[50,35],[77,35],[10,10]];
  for(const over of [{fit:'Cover'},{count:8},{layout:'Grid'},{layout:'Collage',seed:8},{sliceAngle:73,phase:137},{share1:3,pitch1:7}]){
    const G=layout(over,line);
    equal(G.box,reference.box,'drawing keeps one physical frame '+JSON.stringify(over));
    equal(probes.map(q=>G.rawSample(...q)),probes.map(q=>reference.rawSample(...q)),'moving regions and raster controls never refit drawing '+JSON.stringify(over));
  }
  equal(run({fit:'Contain'},line),run({fit:'Cover'},line),'Image fit has no effect on connected drawing output');
  const thin=sample(line,24.5,35,{drawingWidth:.5}),thick=sample(line,24.5,35,{drawingWidth:5});
  ok(thick>thin+.5,'drawing stroke width changes physical ink coverage');
  const square={paths:[rect(22,18,48,54,4)]};
  ok(sample(square,35,35)<.01&&sample(square,22,35)>.9,'default closed drawing contributes borders without filling its interior');
  ok(sample(square,35,35,{drawingFill:true})>.9,'optional closed shape fill contributes its interior');
  const open={paths:[rect(22,18,48,54,4,false)]};
  ok(sample(open,35,35,{drawingFill:true})<.01,'open paths are never filled');
  ok(sample(open,22,35,{drawingFill:true})<.01,'open paths do not acquire an implicit closing edge');
  const hole={paths:[rect(18,16,82,64,3),rect(38,28,62,52,3)]};
  ok(sample(hole,26,40,{drawingFill:true})>.9&&sample(hole,50,40,{drawingFill:true})<.01,'same source pen uses even-odd holes');
  ok(sample(hole,38,40,{drawingFill:true})>.9,'fill preserves the stroked border of a hole');
  const reverse={paths:hole.paths.map(path=>({...path,pts:[...path.pts].reverse()}))};
  ok([[26,40],[50,40],[38,40],[90,40]].every(q=>Math.abs(sample(reverse,...q,{drawingFill:true})-sample(hole,...q,{drawingFill:true}))<1e-6),'hole parity is independent of winding direction');
  const union={paths:[hole.paths[0],{...hole.paths[1],layer:5}]};
  ok(sample(union,50,40,{drawingFill:true})>.9,'different source pens are unioned as black ink');
  const clamped={paths:[{...hole.paths[0],layer:100},{...hole.paths[1],layer:101}]};
  ok(sample(clamped,50,40,{drawingFill:true})<.01,'imported pen indices clamp to the twelve real pens, bounding fill groups and preserving same-pen holes');
  const recolour={paths:line.paths.map(path=>({...path,layer:2}))};
  equal(run({},line),run({},recolour),'source pen colour does not tint the sampled image or output pens');
  const clipped={paths:[{pts:[[-100,40],[200,40]],closed:false,layer:0}]};
  ok(sample(clipped,10,40)>.9&&sample(clipped,90,40)>.9&&sample(clipped,5,40)===0,'cross-page source is clipped at margin without resizing');
  const wide=layout({},line,undefined,{W:101,H:79});
  ok(wide.rawSample(23,35)>.9&&wide.rawSample(50,35)<.01,'non-square pixel rounding preserves exact canvas coordinates');
  const converted=N._drawingImage(base,ctx,line);
  ok(converted&&converted.w>=2&&converted.h>=2&&Math.max(converted.w,converted.h)<=640&&converted.g.length===converted.w*converted.h,'drawing conversion uses a bounded complete image');
}

function rasterFrames(){
  const drawing={paths:[rect(10,10,90,70,8)]};
  const unique=new Set();
  for(const raster of rasters)for(const arrangement of layouts){
    const p={...base,source:'Drawing (wired)',drawingFill:true,layout:arrangement,count:6,columns:3,sliceAngle:31,motion:'Timeline',cycles:2,...Object.fromEntries(Array.from({length:6},(_,i)=>['raster'+(i+1),raster])),...Object.fromEntries(Array.from({length:6},(_,i)=>['pen'+(i+1),i])),...Object.fromEntries(Array.from({length:6},(_,i)=>['pitch'+(i+1),2.2]))};
    const evaluate=i=>{const context={...ctx,frameIdx:i,frameCount:24},result=N.compute([undefined,drawing],p,context,{});valid(result,p,drawing,context);frames++;return result;};
    const first=evaluate(0),middle=evaluate(5),later=evaluate(13),wrapped=evaluate(24);
    equal(first,wrapped,raster+' / '+arrangement+' loops exactly');
    ok(hash(first)!==hash(middle),raster+' / '+arrangement+' moves masks across stationary source');
    equal(evaluate(5),middle,raster+' / '+arrangement+' scrubbing is order independent');
    ok(later.paths.length>0,raster+' / '+arrangement+' later slices survive');
    ok(new Set(first.paths.map(path=>path.slice)).size===6,raster+' / '+arrangement+' retains all six output slices');
    if(arrangement==='Strips')unique.add(hash(first));
  }
  ok(unique.size===6,'six distinct real plotter raster interpretations of one connected drawing');
  const frozen=freeze(structuredClone(source)),p=freeze({...base,drawingFill:true}),before=hash(frozen),imageBefore=hash(ramp);
  const result=N.compute([undefined,frozen],p,ctx,node(ramp));
  equal(hash(frozen),before,'source vertices, closed flags and source pens are never mutated');
  equal(hash(ramp),imageBefore,'loaded image is never mutated while drawing is active');
  equal(N.compute([undefined,frozen],p,ctx,node(ramp)),result,'frozen drawing evaluates deterministically');
}

function malformedAndBudgets(){
  for(const bad of [null,{},[],{paths:null},{paths:[{}]},{paths:[{pts:[[20,20],[NaN,30]]}]},{paths:[{pts:[[20,20],[Infinity,30]]}]},{paths:[{pts:[[20,20],[30]]}]}])empty(run({source:'Drawing (wired)'},bad),'invalid connected source safely produces no ink');
  const prefix=rect(20,20,40,60);
  for(const vertex of [[NaN,30],[Infinity,30],[30]])empty(run({drawingFill:true},{paths:[prefix,{pts:[[60,20],vertex,[60,60]],closed:false}]}),'malformed late vertex refuses the whole drawing without keeping a prefix');
  empty(run({drawingFill:true},{paths:[prefix,{pts:[[60,20],[1e15,30]],closed:false}]}),'unreasonably huge late coordinates refuse the whole drawing without keeping a prefix');
  empty(run({source:'Auto'},{paths:[prefix,{pts:[[60,20],[NaN,30]]}]},black),'malformed connected drawing never reveals a stale loaded file');
  const offpage={paths:[rect(500,500,600,600)]};
  empty(run({drawingFill:true},offpage),'wholly off-page drawing stays empty rather than being autofitted');
  const huge={paths:[{pts:[[-1e12,40],[1e12,40]],closed:false,layer:3}]};
  const hugeResult=run({},huge);valid(hugeResult,{...base},huge);
  ok(sample(huge,20,40)>.9&&sample(huge,80,40)>.9,'huge crossing segments are clipped before raster work');
  const tooManyPoints={paths:[prefix,{pts:Array.from({length:120001},(_,i)=>[65+i%2,40]),closed:false}]};
  empty(run({drawingFill:true},tooManyPoints),'source over point budget is refused whole, including valid prefix');
  const tooManyPaths={paths:[prefix,...Array.from({length:30001},()=>({pts:[[70,30],[70,50]],closed:false}))]};
  empty(run({drawingFill:true},tooManyPaths),'source over path budget is refused whole, including valid prefix');
  const densePaths=Array.from({length:12000},(_,i)=>({pts:[[18+(i%40)*.5,18+(Math.floor(i/40)%80)*.5],[19+(i%40)*.5,18+(Math.floor(i/40)%80)*.5]],closed:false,layer:i%12}));
  const late={pts:[[82,22],[82,58]],closed:false,layer:0},dense={paths:[...densePaths,late]},reordered={paths:[late,...densePaths]};
  const a=N._drawingImage({...base,drawingWidth:3},ctx,dense),b=N._drawingImage({...base,drawingWidth:3},ctx,reordered);
  ok(a&&b,'dense valid drawing is rasterised as one complete source');
  ok(Math.max(a.w,a.h)<640,'dense fixture exercises whole-source resolution adaptation');
  equal(a,b,'dense drawing conversion is independent of source order, never a prefix');
  ok(sample(dense,25,30)>.5&&sample(dense,82,40)>.9,'dense earlier marks and final isolated mark both survive');
  const denseResult=run({},dense);valid(denseResult,{...base},dense);
  ok(denseResult.paths.some(path=>path.pts.some(q=>q[0]>80&&q[0]<85)),'final isolated source mark reaches actual exported raster strokes');
  for(const context of [{W:0,H:80},{W:NaN,H:80},{W:100,H:Infinity},{W:10,H:10}])empty(run({},source,undefined,context),'invalid or impossible page safely yields empty');
  empty(run({margin:1000}),'impossible drawing margin safely yields empty');
}

function legacyParity(){
  const at=process.argv.indexOf('--baseline');
  if(at>=0&&!process.argv[at+1])throw new Error('--baseline requires a previous node source file');
  const previous=at>=0?readNode(process.argv[at+1]):null,digest=createHash('sha256');
  for(const raster of rasters)for(const arrangement of layouts)for(const fit of ['Contain','Cover'])for(const [mode,loaded]of [['Auto',ramp],['Auto',null],['Image file',ramp],['Tone study',black]]){
    const p={...base,drawingWidth:1.8,layout:arrangement,fit,source:mode,phase:37,sliceAngle:29,...Object.fromEntries(Array.from({length:4},(_,i)=>['raster'+(i+1),raster]))};
    const context={W:96,H:72},n=loaded?node(loaded):{},result=N.compute([],p,context,n),label=[raster,arrangement,fit,mode,!!loaded];
    if(previous)equal(result,previous.compute([],p,context,n),'legacy exact parity '+label.join(' / '));
    digest.update(JSON.stringify([label,result]));legacyCases++;
  }
  const actual=digest.digest('hex');
  // Golden comes from the unmodified node with precisely these 144 no-wire cases.
  const expected='378b387e399e1a82baf42c0a749484e53b53729603f7d3d21f8cc02304dabc80';
  equal(actual,expected,'all 144 legacy image/tone renderings remain byte-identical');
}

function wiredStarter(){
  const letterDefaults=Object.fromEntries(Lettering.params.map(p=>[p.key,p.def]));
  const o=Lettering.compute([],{...letterDefaults,text:'O',font:'Block',size:40,fill:'Outline',depth:0},ctx,{});
  ok(o.paths.length>=2&&o.paths.every(path=>path.closed),'real Lettering O supplies closed outer/inner outlines');
  const oParams={...base,drawingFill:true,drawingWidth:.8},oResult=N.compute([undefined,o],oParams,ctx,{});
  valid(oResult,oParams,o);
  ok(N._layout(oParams,ctx,{},[undefined,o]).rawSample(ctx.W/2,ctx.H/2)<.01,'real Lettering O retains its transparent central counter');
  const definitions={slice_raster:defaults,lettering:letterDefaults};
  const examples=EXAMPLES.filter(ex=>ex.name.startsWith('Slice Raster · '));
  const starters=examples.map(ex=>({ex,graph:ex.make(type=>({...definitions[type]}))})).filter(({graph})=>graph.edges.some(edge=>edge.toPort===1&&graph.nodes.find(n=>n.id===edge.from)?.type==='lettering'&&graph.nodes.find(n=>n.id===edge.to)?.type==='slice_raster'));
  ok(starters.length>0,'Help includes a real Lettering → Drawing starter');
  for(const {ex,graph}of starters){
    const context=ex.canvas??ctx,edge=graph.edges.find(e=>e.toPort===1&&graph.nodes.find(n=>n.id===e.from)?.type==='lettering'),input=graph.nodes.find(n=>n.id===edge.from),output=graph.nodes.find(n=>n.id===edge.to);
    ok(input.params.text.trim().length>0,'wired Help starter uses actual text');
    const drawing=Lettering.compute([],input.params,context,input),result=N.compute([undefined,drawing],output.params,context,output);
    ok(drawing.paths.length>=2&&drawing.paths.every(path=>path.closed),'actual Lettering starter supplies closed outlines');
    valid(result,output.params,drawing,context);
    const portable=readNode(new URL('../src/defs/nodes/slice_raster.js',import.meta.url));
    equal(portable.compute([undefined,drawing],output.params,context,output),result,'portable node includes the complete wired conversion without external node dependencies');
    equal(N.compute([undefined,H.EMPTY],output.params,context,output),H.EMPTY,'clearing the wired starter never falls back to the tone study');
  }
}

try{
  legacyParity();
  definitionAndPrecedence();
  registrationAndFill();
  rasterFrames();
  malformedAndBudgets();
  wiredStarter();
  console.log(`Slice Raster Drawing input: ${checks} checks passed; ${legacyCases} exact legacy cases, ${frames} actual wired animation frames, six rasters, three layouts, source registration, holes, precedence, Style, malformed input and whole-source budgets.`);
}catch(error){console.error('Slice Raster Drawing input FAILED: '+error.message);process.exitCode=1;}
