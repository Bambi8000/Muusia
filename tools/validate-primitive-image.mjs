/** Primitive Image: independent error/replay, geometry, palette and export-path invariants. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import node from '../src/defs/nodes/primitive_image.js';
import * as H from '../src/defs/helpers.js';
const defaults=Object.fromEntries(node.params.map(p=>[p.key,p.def]));
const w=48,h=40,ctx={W:150,H:120};
const fixture={w,h,g:[],rgb:[]};
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const t=Math.exp(-((x/w-.55)**2*14+(y/h-.45)**2*22));
 const rgb=[.95-.6*t,.92-.8*t,.96-.4*t].map(v=>Math.round(v*255));
 fixture.rgb.push(...rgb);fixture.g.push(1-(.299*rgb[0]+.587*rgb[1]+.114*rgb[2])/255);
}
const plain=d=>({w:20,h:20,g:Array(400).fill(d)});
const run=(p={},img=fixture,c=ctx,ins=[])=>node.compute(ins,{...defaults,...p},c,{data:{img}});
const solve=(p={},img=fixture)=>node._solve({...defaults,...p},img);
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function valid(r,p={},img=fixture,c=ctx){
 const fit=node._fit({...defaults,...p},c,img),points=r.paths.flatMap(p=>p.pts);
 ok(points.length>0,'nonempty output');ok(points.length<=100000,'base points bounded');
 ok(points.every(p=>p.length===2&&p.every(Number.isFinite)),'finite xy');
 ok(points.every(([x,y])=>x>=fit.x-1e-7&&x<=fit.x+fit.w+1e-7&&y>=fit.y-1e-7&&y<=fit.y+fit.h+1e-7),'inside fitted image');
 ok(r.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'physical pen indices');
 ok(r.paths.every(p=>p.closed?(p.pts.length>=3):p.pts.length===2),'closed polygons or real open hatch strokes');
 ok(r.paths.every(p=>p.pts.slice(1).every((q,i)=>Math.hypot(q[0]-p.pts[i][0],q[1]-p.pts[i][1])>1e-8)),'no duplicate consecutive points');
}
function verifyFit(p={},img=fixture){
 const m=solve(p,img),weights=[.299,.587,.114];
 let error=0;for(let i=0;i<m.current.length;i++)error+=weights[i%3]*(m.current[i]-m.target[i])**2;
 ok(Math.abs(error-m.finalError)<Math.max(1e-7,error*1e-8),'independent full SSE equals incremental score');
 ok(m.finalError<m.initialError*.99,'actually reduces image error');
 ok(m.shapes.every(s=>s.gain>0&&s.alpha>0&&s.alpha<=({...defaults,...p}).coverage+1e-9),'positive gain and bounded coverage');
 ok(m.scores.slice(1).every((s,i)=>s<m.scores[i]),'every accepted shape reduces error');
 // Independent convex point-in-polygon oracle, not the node scanline routine.
 const contains=(poly,x,y)=>{let pos=false,neg=false;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],v=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);pos||=v>1e-8;neg||=v< -1e-8;}return !(pos&&neg);};
 const replay=new Float64Array(m.w*m.h*3).fill(1);
 for(const s of m.shapes){const ink=[1,3,5].map(k=>parseInt(H.PENS[s.layer].c.slice(k,k+2),16)/255);
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++)if(contains(s.polygon,x+.5,y+.5))for(let c=0;c<3;c++)replay[(y*m.w+x)*3+c]*=1-s.alpha*(1-ink[c]);
 }
 ok(replay.every((v,i)=>Math.abs(v-m.current[i])<1e-8),'all fitted pixel updates replay from polygon geometry');
 return m;
}
const t=performance.now(),base=run();valid(base);eq(run(),base,'repeat deterministic');
const saved=JSON.stringify(fixture);run({colours:6});eq(JSON.stringify(fixture),saved,'no input mutation');
ok(node.fileImage&&node.ins[0].type==='style'&&node.outs[0].type==='paths','existing image intake and path contract');
eq(new Set(node.params.map(p=>p.key)).size,node.params.length,'unique controls');
for(const p of node.params.filter(p=>p.type==='select'))ok(p.options.includes(p.def),p.key+' valid default');
for(const shape of ['Triangles','Rectangles','Ellipses','Circles','Mixed']){
 for(const render of ['Tone hatch','Cross hatch','Outlines'])valid(run({shape,render}),{shape,render});
 const m=verifyFit({shape,count:40,colours:6});ok(m.shapes.length<=40,'count cap');
 const type={Triangles:0,Rectangles:1,Ellipses:2,Circles:3}[shape];if(type!==undefined)ok(m.shapes.every(s=>s.type===type),'chosen primitive type');
}
for(const quality of ['Draft','Fine']){valid(run({quality,count:50}));verifyFit({quality,count:30});}
for(const p of [{seed:88},{gamma:1.7},{coverage:.7},{scale:20},{colours:6},{angle:-30},{penWidth:.5},{angleVar:0},{margin:2}])ok(hash(run(p))!==hash(base),JSON.stringify(p)+' meaningful');
for(const img of [null,{w:0,h:4,g:[]},{w:4,h:4,g:[]},{w:NaN,h:1,g:[]},{w:2e6,h:2,g:[]}])eq(run({},img).paths,[],'invalid image empty');
eq(run({},plain(0)).paths,[],'white paper needs no strokes');valid(run({count:30},plain(1)),{},plain(1));
eq(run({margin:60},fixture,{W:100,H:100}).paths,[],'empty fitted area');
eq(run({},fixture,{W:0,H:100}).paths,[],'zero canvas');
eq(run({reveal:0}).paths,[],'zero reveal');
const first=run({reveal:35});eq(base.paths.slice(0,first.paths.length),first.paths,'reveal is exact output prefix');
const few=solve({count:30}),more=solve({count:60});eq(more.shapes.slice(0,few.shapes.length),few.shapes,'adding shapes preserves accepted sequence');
const fit=solve();eq(solve({penWidth:.8,angle:0,render:'Outlines',reveal:5}),fit,'render controls leave optimisation unchanged');
const before=hash(fit),colourBefore=H.PENS[0].c;
try{H.PENS[0].c='#a03060';ok(hash(solve())!==before,'palette edits invalidate fit');}finally{H.PENS[0].c=colourBefore;}
eq(hash(solve()),before,'restoring palette restores fit');
const dup=run({colours:6,pen2:0,pen3:0,pen4:0,pen5:0,pen6:0});eq(dup,base,'duplicate pen choices do not duplicate ink layers');
const mono={w,h,g:fixture.g};valid(run({colours:6,count:20},mono),{},mono);
// A colour sample exactly matching a real ink must choose that ink over an
// unrelated one. All channels participate; this is not luminance-only colouring.
const red=H.PENS[2].c,rgb=[1,3,5].map(k=>parseInt(red.slice(k,k+2),16));
const swatch={w:20,h:20,g:Array(400).fill(.6),rgb:Array.from({length:400},()=>rgb).flat()};
const paletteFit=solve({count:1,colours:2,layer:2,pen2:1,coverage:.95,shape:'Rectangles'},swatch);
eq(paletteFit.shapes[0].layer,2,'select ink using source RGB');
// Hatch lines stay in a known convex polygon and obey their physical pitch.
const square=[[0,0],[20,0],[20,20],[0,20]],hatch=node._hatch(square,0,2,.25);
eq(hatch.length,10,'physical hatch line count');ok(hatch.every((p,i)=>Math.abs(p[0][1]-(.5+i*2))<1e-9&&p[0][0]===0&&p[1][0]===20),'physical 2 mm pitch');
const diamond=[[0,10],[10,0],[20,10],[10,20]],diagonal=node._hatch(diamond,.71,1.3,.41);
ok(diagonal.every(p=>p.every(([x,y])=>Math.abs(x-10)+Math.abs(y-10)<=10+1e-8)),'rotated hatching clipped to convex shape');
const circle=node._polygon({type:3,x:30,y:30,rx:8,ry:8,a:.7},60,60);
ok(circle.every(([x,y])=>Math.abs(Math.hypot(x-30,y-30)-8)<1e-8),'circle has a single radius');
const style={kind:'style',mode:'Dashed',dash:2,gap:2,vary:0,phase:0,seed:4};ok(hash(run({},fixture,ctx,[style]))!==hash(base),'Style changes actual strokes');eq(run({},fixture,ctx,[style]),H.applyStyle(base,style),'actual Style helper applied');
// Oversized sheet and hairline pen stress the shared budget; Reveal cannot
// respace already visible strokes when the full drawing is over budget.
const stressParams={shape:'Ellipses',count:300,quality:'Fine',penWidth:.08,render:'Cross hatch',coverage:.8,margin:0};
const stressCtx={W:4000,H:3000},stress=run(stressParams,fixture,stressCtx);valid(stress,stressParams,fixture,stressCtx);
const stressHalf=run({...stressParams,reveal:50},fixture,stressCtx);eq(stress.paths.slice(0,stressHalf.paths.length),stressHalf.paths,'budget coarsening stable under reveal');
valid(run({count:NaN,scale:Infinity,angle:NaN,seed:Infinity,colours:Infinity}));
const lab='nodes-lab/primitive_image.plotternode.js';if(fs.existsSync(lab)){
 const prototype=new Function(...Object.keys(H),'return '+fs.readFileSync(lab,'utf8'))(...Object.values(H));
 eq(prototype.compute([],{...defaults,colours:6},ctx,{data:{img:fixture}}),run({colours:6}),'lab and baked output identical');
}
console.log(`Primitive Image: ${checks} checks passed (${Math.round(performance.now()-t)} ms; stress ${stress.paths.length} strokes).`);
