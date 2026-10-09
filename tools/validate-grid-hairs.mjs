import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as H from '../src/defs/helpers.js';
const lab='nodes-lab/grid_hairs.plotternode.js',baked='src/defs/nodes/grid_hairs.js';
const prototype=()=>new Function(...Object.keys(H),'return '+fs.readFileSync(lab,'utf8'))(...Object.values(H));
const def=fs.existsSync(baked)?(await import('../'+baked)).default:prototype();
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def])),ctx={W:420,H:297};
const run=(p={},c=ctx,style)=>def.compute([style],{...defaults,...p},c);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const geometry=v=>v.paths.map(({pts,closed})=>({pts,closed}));
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
function valid(result,p={},c=ctx,styled=false){
 const g=def._grid({...defaults,...p},c),pts=result.paths.flatMap(p=>p.pts);
 check(result.paths.length>0,'nonempty');check(pts.length<=110000,'bounded base points');
 check(pts.every(q=>q.length===2&&q.every(Number.isFinite)),'finite coordinates');
 check(result.paths.every(p=>p.closed===false&&p.pts.length>=2),'open drawable paths');
 check(result.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'valid pens');
 // The shared dash helper can emit a sub-epsilon tail at an exact dash boundary.
 // Test its contract separately below; the generator itself has no such tails.
 if(!styled)check(result.paths.every(p=>p.pts.every((q,i)=>!i||Math.hypot(q[0]-p.pts[i-1][0],q[1]-p.pts[i-1][1])>1e-8)),'no repeated vertices');
 const hairPaths=p.drawGrid?result.paths.slice(0,-(g.cols+g.rows+2)):result.paths;
 const occupied=new Set();
 check(hairPaths.every(path=>{
   const mean=path.pts.reduce((a,q)=>[a[0]+q[0]/path.pts.length,a[1]+q[1]/path.pts.length],[0,0]);
   const col=Math.min(g.cols-1,Math.floor((mean[0]-g.x)/g.cw)),row=Math.min(g.rows-1,Math.floor((mean[1]-g.y)/g.ch));
   const x=g.x+col*g.cw+g.gap/2,y=g.y+row*g.ch+g.gap/2;
   occupied.add(`${col},${row}`);
   return path.pts.every(q=>q[0]>=x-1e-6&&q[0]<=x+g.cw-g.gap+1e-6&&q[1]>=y-1e-6&&q[1]<=y+g.ch-g.gap+1e-6);
 }),'every complete stroke stays within one inset cell');
 eq(occupied.size,g.cols*g.rows,'all cells populated');
 check(g.cols*g.rows<=4096&&g.cols<=256&&g.rows<=256,'bounded grid');
}
const start=performance.now(),base=run(),before=JSON.stringify(defaults);valid(base);
eq(hash(run()),hash(base),'same seed');eq(JSON.stringify(defaults),before,'params unmodified');
check(def.ins[0].type==='style'&&def.outs[0].type==='paths','standard ports');
eq(new Set(def.params.map(p=>p.key)).size,def.params.length,'unique params');
check(def.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'valid default choices');
for(const pattern of ['Tufts','Crosshatch','Scatter','Flow'])for(const bend of [0,0.8]){
 const p={pattern,bend};valid(run(p),p);eq(hash(run(p)),hash(run(p)),pattern+' repeatable');
}
const simple={cellW:10,cellH:20,margin:5,gap:2,count:4,densityVar:0,length:180,bend:1};
const small=run(simple,{W:40,H:50});valid(small,simple,{W:40,H:50});
eq(small.paths.length,24,'three columns, two rows, four hairs');
// Independent exact cell bounds, including 1 mm inset, not taken from _grid.
check(small.paths.every((p,i)=>{
 const cell=Math.floor(i/4),x0=6+(cell%3)*10,y0=6+Math.floor(cell/3)*20;
 return p.pts.every(([x,y])=>x>=x0-1e-8&&x<=x0+8+1e-8&&y>=y0-1e-8&&y<=y0+18+1e-8);
}),'known physical cell geometry');
const one={cellW:20,cellH:20,margin:0,count:8,scatter:0,densityVar:0,bend:0};
for(const pattern of ['Tufts','Crosshatch']){
 const r=run({...one,pattern},{W:20,H:20}),d=r.paths.map(p=>[p.pts[1][0]-p.pts[0][0],p.pts[1][1]-p.pts[0][1]]);
 check(d.every((v,i)=>Math.abs((pattern==='Crosshatch'&&i%2?v[0]*d[0][0]+v[1]*d[0][1]:v[0]*d[0][1]-v[1]*d[0][0]))<1e-7),'parallel or perpendicular zero-scatter groups');
}
for(const p of [{cellW:3,cellH:12},{cellW:60,cellH:4},{count:40,bend:1},{densityVar:1,lengthVar:1},{length:180,gap:9,bend:1}])valid(run(p),p);
for(const c of [{W:297,H:420},{W:100,H:70},{W:15,H:15}])valid(run({margin:1,cellW:3,cellH:3},c),{margin:1,cellW:3,cellH:3},c);
for(const c of [{W:10000,H:10000},{W:10000,H:2},{W:2,H:10000}]){
 const p={cellW:0.5,cellH:0.5,margin:0,gap:0,count:1e9,bend:1,drawGrid:true};valid(run(p,c),p,c);
 check(def.overlay({...defaults,...p},c).length<=65,'bounded preview guides');
}
for(const [key,value] of Object.entries({cellW:15,cellH:18,pattern:'Scatter',count:3,densityVar:0,length:50,lengthVar:0,angle:90,scatter:0,bend:1,gap:2,margin:25,seed:99}))check(hash(run({[key]:value}))!==hash(base),key+' changes geometry');
check(hash(run({pattern:'Flow',flowScale:2}))!==hash(run({pattern:'Flow',flowScale:9})),'flow size changes direction field');
for(const colours of [1,2,3,4,5,6]){
 const r=run({colours});eq(geometry(r),geometry(base),'colour changes preserve geometry');eq(new Set(r.paths.map(p=>p.layer)).size,colours,'all chosen pens used');
}
eq(geometry(run({colours:6,layer:11,pen2:0})),geometry(base),'pen selectors preserve geometry');
check(run({colours:6,layer:2,pen2:2,pen3:2,pen4:2,pen5:2,pen6:2}).paths.every(p=>p.layer===2),'duplicate pens merge');
const grid=run({...simple,drawGrid:true,gridPen:7},{W:40,H:50});
eq(grid.paths.slice(0,24),small.paths,'drawing grid preserves hairs');
eq(grid.paths.slice(24).map(p=>p.pts),[
 [[5,5],[5,45]],[[15,5],[15,45]],[[25,5],[25,45]],[[35,5],[35,45]],
 [[5,5],[35,5]],[[5,25],[35,25]],[[5,45],[35,45]],
],'unique full grid lines');check(grid.paths.slice(24).every(p=>p.layer===7),'grid uses selected pen');
eq(def.overlay({...defaults,...simple},{W:40,H:50})[0],{kind:'rect',x:5,y:5,w:30,h:40},'exact overlay bounds');
const four=run({...simple,count:4}),five=run({...simple,count:5});
check(four.paths.every((p,i)=>hash(p)===hash(five.paths[Math.floor(i/4)*5+i%4])),'adding hairs preserves existing strokes');
const malformed={};for(const p of def.params)if(['slider','seed','pen'].includes(p.type))malformed[p.key]=NaN;valid(run(malformed),malformed);
eq(run({margin:1000},{W:10,H:20}).paths,[],'consumed margin empty');eq(run({}, {W:0,H:0}).paths,[],'zero sheet empty');
eq(run({gap:10,cellW:10,cellH:10}).paths,[],'closed cell gap empty');
eq(hash(run({},ctx,{kind:'style',mode:'Solid'})),hash(base),'solid style preserved');
const dashed=run({count:3},ctx,{kind:'style',mode:'Dashed',dash:1,gap:1,vary:0,phase:0,seed:1});
valid(dashed,{count:3},ctx,true);check(dashed.paths.length>run({count:3}).paths.length,'actual dashed style helper applied');
eq(dashed,H.applyStyle(run({count:3}),{kind:'style',mode:'Dashed',dash:1,gap:1,vary:0,phase:0,seed:1}),'wired style matches shared helper');
check(dashed.paths.reduce((n,p)=>n+H.pathLength(p.pts,false),0)<run({count:3}).paths.reduce((n,p)=>n+H.pathLength(p.pts,false),0),'dashes leave actual gaps');
if(fs.existsSync(lab)&&fs.existsSync(baked))eq(hash(prototype().compute([],defaults,ctx)),hash(base),'lab / baked parity');
console.log(`Grid Hairs: ${checks} checks passed; default ${base.paths.length} strokes / ${base.paths.reduce((n,p)=>n+p.pts.length,0)} points; suite ${(performance.now()-start).toFixed(0)} ms.`);
