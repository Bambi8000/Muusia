// Focused geometry checks, legacy parity and the real Muusia exporters.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseAst } from 'rolldown/parseAst';
import S from '../src/defs/nodes/scanner.js';
import V from '../src/defs/nodes/voronoi.js';
import F from '../src/defs/nodes/diffgrowth.js';
import { boundedVoronoi, voronoiRegion } from '../src/defs/voronoi-bounded.js';
import { PENS, pathLength, applyStyle } from '../src/defs/helpers.js';
import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, needleExportError } from '../src/machine.js';
import { EXAMPLES } from '../src/examples.js';
import { evaluate, defaults } from './scanner-voronoi-preview.mjs';
let checks=0;const ok=(x,m)=>{assert.ok(x,m);checks++;};const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ctx={W:210,H:210},sp=defaults('scanner'),vp={...defaults('voronoi'),mode:'Bounded'};
const scan=(src,over={},motion)=>S.compute([src,motion],{...sp,...over},ctx);
const vor=(over={},input)=>V.compute([null,input],{...vp,...over},ctx);
const line=(a,b,layer=0)=>({paths:[{pts:[a,b],closed:false,layer,strokeWidth:.4}]});
const circle=(x,y,r)=>Array.from({length:64},(_,i)=>[x+r*Math.cos(i*Math.PI/32),y+r*Math.sin(i*Math.PI/32)]);
const shape=(...pts)=>({paths:pts.map(pts=>({pts,closed:true,layer:0}))});
function inside(q,rings){let hit=false;for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function valid(result){
 ok(result.paths.length>0,'nonempty complete result');
 ok(result.paths.reduce((n,p)=>n+p.pts.length,0)<=120000,'point bound');
 ok(result.paths.every(p=>typeof p.closed==='boolean'&&p.pts.length>=(p.closed?3:2)&&Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12&&p.pts.every(q=>q.length>=2&&q.every(Number.isFinite))),'finite well formed geometry');
}
const src=line([50,35],[50,175],8),copy=hash(src),smooth=scan(src);valid(smooth);
ok(smooth.paths.length===1&&!smooth.paths[0].closed,'Smooth preserves open stroke count');
ok(smooth.paths[0].layer===8&&smooth.paths[0].strokeWidth===.4,'pen/width preserved');
ok(hash(src)===copy,'input immutable');ok(hash(scan(src))===hash(smooth),'deterministic scan');
const closed=shape(circle(105,105,40));ok(scan(closed).paths.length===1&&scan(closed).paths[0].closed,'closed continuity');
ok(hash(scan(src,{motionX:0,motionY:0,shake:0,zoom:0}))===hash(src),'zero is exact identity');
for(const over of [{motionX:30},{motionY:12},{speed:3},{shake:7},{zoom:20},{phase:35},{seed:91},{direction:'Bottom to top'},{direction:'Left to right'},{direction:'Right to left'}]){const r=scan(src,over);valid(r);ok(hash(r)!==hash(smooth),'live scanner '+JSON.stringify(over));}
const z=scan(line([50,35,0],[50,175,4]),{shake:0});ok(z.paths[0].pts.every(q=>Math.abs(q[2]-(q[1]-35)/140*4)<1e-8),'interpolated Z preserved');
const mixed=scan(line([50,35],[50,175,4]),{shake:0});ok(mixed.paths[0].pts.at(-1)[2]===4,'mixed XY/XYZ end preserved');
const duplicate={paths:[...src.paths,{...src.paths[0],layer:11}]};const shared=scan(duplicate);ok(hash(shared.paths[0].pts)===hash(shared.paths[1].pts),'common scan field');ok(shared.paths[1].layer===11,'later pen retained');
const densityA=scan(line([50,35],[50,175]),{shake:0}),densityB=scan({paths:[{...src.paths[0],pts:[[50,35],[50,105],[50,175]]}]},{shake:0});
const nearest=(r,y)=>r.paths[0].pts.reduce((a,b)=>Math.abs(a[1]-y)<Math.abs(b[1]-y)?a:b);
ok(Math.hypot(...nearest(densityA,105).map((v,i)=>v-nearest(densityB,105)[i]))<1e-8,'coarse/dense common midpoint');
const motion=line([20,20],[60,60]),gesture=scan(src,{motionY:10,shake:0},motion);valid(gesture);ok(hash(gesture)!==hash(scan(src,{motionY:10,shake:0})),'drawn motion controls output');
ok(hash(gesture)===hash(scan(src,{motionY:10,shake:0},motion)),'gesture repeatable');
const bands=scan(src,{mode:'Bands',shake:0,motionY:0,zoom:0,band:5});valid(bands);
ok(bands.paths.length===28,'all 28 source strips present');
ok(bands.paths.every(p=>!p.closed&&p.pts.every(q=>Math.abs(q[0]-p.pts[0][0])<1e-9)),'bands have no horizontal jump bridges');
ok(Math.abs(bands.paths.reduce((n,p)=>n+Math.abs(p.pts.at(-1)[1]-p.pts[0][1]),0)-140)<1e-8,'bands retain complete line');
const bandClosed=scan(closed,{mode:'Bands',shake:0});valid(bandClosed);ok(bandClosed.paths.every(p=>!p.closed),'split closed contour stays honest fragments');
const inStrip=shape([[90,101],[100,101],[100,103],[90,103]]);ok(scan(inStrip,{mode:'Bands',band:10}).paths[0].closed,'unsplit contour stays closed');
for(const bad of [null,{paths:[]},line([NaN,0],[10,20]),line([0,0],[Infinity,20]),line([0,0],[1e6,1e6]),{paths:[{pts:[[1,1]],layer:0}]}])ok(scan(bad).paths.length===0,'bad/excessive scan returns empty');
for(const bad of [line([Infinity,0],[0,0]),line([1e308,0],[0,0]),line([0,0],[0,0])])ok(scan(src,{},bad).paths.length===0,'invalid gesture refused');
// Classic parity against the pre-feature built-in definition, without changing source files.
const oldSource=execFileSync('git',['show','c7f35a38e38c1d4ded242c4e56eb89e414e75f5e:src/defs/nodes/voronoi.js'],{encoding:'utf8'}).replace('"../helpers.js"',JSON.stringify(new URL('../src/defs/helpers.js',import.meta.url).href));
const old=(await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'))).default;
const oldP=Object.fromEntries(old.params.map(p=>[p.key,p.def]));let legacy=0;
for(const c of [ctx,{W:297,H:210},{W:72,H:100}])for(const over of [{},{cells:3,relax:0},{cells:72,relax:3,sites:true,seed:18},{margin:50},{cells:12,layer:10},{seed:-3}]){
 const p={...oldP,...over};ok(hash(V.compute([],p,c))===hash(old.compute([],p,c)),'Classic exact parity');legacy++;
}
ok(V.outs({params:{}}).length===1&&V.outs({params:vp}).length===3,'compatible output ports');
const base=vor();base.forEach(valid);ok(base[1].paths.length===80&&base[2].paths.length===80,'one seed for each default cell');ok(hash(base)===hash(vor()),'deterministic cells');
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const crosses=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<-1e-14&&orient(c,d,a)*orient(c,d,b)<-1e-14;
function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
function geometry(out,over={},input){
 const p={...vp,...over},rings=voronoiRegion(p,ctx,input),cells=out[1].paths;
 out.forEach(valid);ok(cells.length===out[2].paths.length,'matching cells/seeds');
 const segments=[];
 for(const [i,path]of cells.entries()){
  assert(path.closed);for(let j=0;j<path.pts.length;j++){
   const a=path.pts[j],b=path.pts[(j+1)%path.pts.length];assert(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-8);
   for(const t of [0,.25,.5,.75])assert(inside([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],rings),'inside region, outside holes');
   segments.push({a,b,i,x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),y0:Math.min(a[1],b[1]),y1:Math.max(a[1],b[1])});
  }
  for(const q of out[2].paths[i].pts)assert(inside(q,[path.pts]),'seed inside its own piece');
 }
 segments.sort((a,b)=>a.x0-b.x0);let min=Infinity;
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length&&segments[j].x0<=segments[i].x1+p.web;j++){
  const a=segments[i],b=segments[j];if(a.i===b.i||a.y0>b.y1+p.web||b.y0>a.y1+p.web)continue;
  assert(!crosses(a.a,a.b,b.a,b.b),'cells cannot cross');min=Math.min(min,distance(a.a,b.a,b.b),distance(a.b,b.a,b.b),distance(b.a,a.a,a.b),distance(b.b,a.a,a.b));
 }
 ok(min>=p.web-.001,'physical web clearance '+min+' >= '+p.web);checks+=3;
}
geometry(base);
const holed=shape(circle(105,105,90),circle(105,105,30));
const wrappedHoles=shape([[12,12],[198,12],[198,198],[12,198]],circle(45,55,3),circle(55,55,3));
const concave=shape([[15,15],[195,15],[195,65],[75,65],[75,150],[195,150],[195,195],[15,195]]);
for(const [over,input]of [[{count:3,iterations:0,placement:'Hex',web:2},wrappedHoles],[{count:32,boundary:'Circle'},null],[{count:35},holed],[{count:25},concave],[{count:12,placement:'Hex',iterations:0},null],[{count:30,density:'Linear',densityStrength:95,densityAngle:50},null],[{count:30,density:'Radial',web:4,radius:8},null]])geometry(vor(over,input),over,input);
for(const over of [{count:50},{placement:'Random',iterations:0},{placement:'Hex'},{iterations:5},{density:'Linear'},{density:'Radial'},{web:5},{radius:0},{seed:91},{minHole:15}])ok(hash(vor(over))!==hash(base),'live Voronoi '+JSON.stringify(over));
const edged=vor({output:'Edges',outline:true},holed);edged.forEach(valid);const keys=new Set();
for(const p of edged[0].paths.filter(p=>!p.closed)){const key=p.pts.map(q=>q.map(v=>v.toFixed(5)).join(',')).sort().join('|');assert(!keys.has(key),'unique shared edge');keys.add(key);const a=p.pts[0],b=p.pts[1];assert(inside([(a[0]+b[0])/2,(a[1]+b[1])/2],holed.paths.map(p=>p.pts)));}
ok(keys.size>100,'unique clipped edges');ok(edged[0].paths.filter(p=>p.closed).length===2,'outline rings emitted once');
const linear=vor({density:'Linear',densityStrength:95,iterations:3,count:300})[2].paths;const meanX=linear.reduce((n,p)=>n+p.pts.reduce((s,q)=>s+q[0],0)/p.pts.length,0)/linear.length;ok(meanX>115,'density gradient survives relaxation: '+meanX);
const snap=hash(holed);vor({},holed);ok(hash(holed)===snap,'boundary immutable');
for(const [over,input]of [[{boundary:'Wired'},null],[{boundary:'Wired'},line([0,0],[5,5])],[{},shape([[0,0],[0,0],[0,0]])],[{},shape([[0,0],[NaN,1],[1,1]])],[{margin:105},null]])ok(vor(over,input).every(r=>r.paths.length===0),'invalid region returns all empty');
const style={kind:'style',mode:'Dashed',dash:4,gap:2,vary:0,seed:1};const styled=V.compute([style],vp,ctx);ok(hash(styled[0])===hash(applyStyle(base[0],style)),'Drawing style applied last');ok(hash(styled.slice(1))===hash(base.slice(1)),'auxiliary ports remain clean');
const many=vor({count:2000,iterations:0,radius:0,web:.2,minHole:.1});many.forEach(valid);ok(many[1].paths.length===2000,'2000 cells not truncated');
const examples=[];let growthResult;
for(const ex of EXAMPLES.filter(e=>/^(Scanner|Voronoi) ·/.test(e.name))){const {result}=evaluate(ex);valid(result);ok(result.paths.every(p=>p.pts.every(q=>q[0]>=0&&q[0]<=ex.canvas.W&&q[1]>=0&&q[1]<=ex.canvas.H)),'example stays on paper');examples.push({name:ex.name,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0)});if(ex.name.endsWith('Growing cells')){growthResult=result;
 const exGraph=ex.make(defaults),cellNode=exGraph.nodes[0],cellOut=V.compute([],cellNode.params,ex.canvas)[1];
 for(const [i,path]of result.paths.entries())for(let j=0;j<path.pts.length;j++){
  const a=path.pts[j],b=path.pts[(j+1)%path.pts.length];
  for(const t of [0,.25,.5,.75])assert(inside([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],[cellOut.paths[i].pts]),'growth segment stays in its own cell');
 }
 checks++;ok(result.paths.length===12&&result.paths.every(p=>p.closed),'all twelve growth starts survive');}}
// A single continuous Scanner stroke and twelve real Voronoi/Growth strokes through actual SVG and machine exporters.
const source=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(source,{lang:'jsx'});
const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);};
const toSVG=new Function('PENS',fn('toSVG')+';return toSVG;')(PENS);
const toGcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',fn('toGcode')+';return toGcode;')(PENS,pathLength,needleExportError,'test');
for(const [result,c]of [[smooth,ctx],[growthResult,{W:297,H:210}]]){
 const svg=toSVG(result,c);ok((svg.match(/<path /g)||[]).length===result.paths.length,'SVG exact final stroke count');
 for(const profile of [DEFAULT_MACHINE,DEFAULT_MACHINE_B]){
  const code=toGcode(result,c,{...profile,workW:400,workH:400}),lines=code.split('\n');
  const down=profile.zMode==='servo'?l=>l.includes(`ANGLE=${profile.servoDown} ; pen down`):l=>l===`G1 Z${profile.penDown} F${profile.zFeed}`;
  ok(lines.filter(down).length===result.paths.length,profile.zMode+' one lower per actual stroke');
  ok(lines.filter(l=>/^G1 X/.test(l)).length===result.paths.reduce((n,p)=>n+p.pts.length-(p.closed?0:1),0),'all segments before final lift');ok(!code.includes('OUT OF BOUNDS'),'machine bounds');
 }
}
ok(typeof boundedVoronoi==='function'&&typeof F.compute==='function','ESM helpers');
const record={checks,legacy,examples,densityMeanX:meanX,physicalPrintSent:false};
if(process.argv.includes('--record'))fs.writeFileSync(new URL('../docs/scanner-voronoi-checks.json',import.meta.url),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record,null,2));
