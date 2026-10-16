import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAst} from 'rolldown/parseAst';
import * as H from '../src/defs/helpers.js';
import {EXAMPLES} from '../src/examples.js';
import Frame from '../src/defs/nodes/frame.js';
const lab=process.argv.includes('--lab');
const N=lab?Function(...Object.keys(H),'return '+fs.readFileSync('nodes-lab/moving_lines.plotternode.js','utf8'))(...Object.values(H)):(await import('../src/defs/nodes/moving_lines.js')).default;
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def])),base=defaults(N),canvas={W:297,H:210};
const hash=x=>JSON.stringify(x,(_,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
let checks=0;
function run(patch={},clock={}){
 const p={...base,...patch},ctx={...canvas,frameCount:48,frameIdx:0,...clock},before=JSON.stringify({p,ctx}),out=N.compute([],p,ctx);
 assert.equal(JSON.stringify({p,ctx}),before);assert.deepEqual(out,N.compute([],p,ctx));
 const m=Math.max(0,Math.min(Number.isFinite(p.margin)?p.margin:15,Math.min(ctx.W,ctx.H)/2));
 assert.ok(out.paths.reduce((n,q)=>n+q.pts.length,0)<=90000,'Bounded complete line field');
 for(const q of out.paths){assert.equal(q.closed,false,'Only open lines; no eye or ring geometry');assert.ok(q.pts.length>=2);assert.ok(q.layer>=0&&q.layer<12&&Number.isInteger(q.layer));for(const [x,y] of q.pts)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=m-1e-8&&x<=ctx.W-m+1e-8&&y>=m-1e-8&&y<=ctx.H-m+1e-8);}
 checks++;return out;
}
assert.equal(N.key,'moving_lines');assert.deepEqual(N.ins,[]);assert.equal(N.outs[0].type,'paths');
for(const d of N.params.filter(d=>d.type==='select'))assert.ok(d.options.includes(d.def));
for(const lineStyle of ['Streaks','Continuous'])for(const amplitude of [0,4,30])for(const angle of [0,37,90,180]){
 const p={lineStyle,amplitude,angle};run(p);
 for(const frameIdx of [0,1,13,24,47,0]){
  const a=run(p,{frameIdx}),b=run({...p,clock:'Manual',phase:frameIdx/48*360});assert.equal(hash(a),hash(b),'Timeline equals manual Phase');
 }
 assert.equal(hash(run({...p,phase:0})),hash(run({...p,phase:360})),'Exact full-loop wrap');
 assert.equal(hash(run({...p,clock:'Manual',phase:73},{frameIdx:0})),hash(run({...p,clock:'Manual',phase:73},{frameIdx:17})),'Manual ignores ANIMATE');
 assert.equal(hash(run({...p,cycles:2},{frameIdx:0})),hash(run({...p,cycles:2},{frameIdx:24})),'Integer cycles repeat halfway');
}
// Independent analytic straight-track oracle: row positions and physical
// segment lengths/shift, not a copy of the sampling implementation.
const straight={lineStyle:'Continuous',amplitude:0,angle:0,rows:20};
const lines=run(straight);assert.equal(lines.paths.length,20);
lines.paths.forEach((q,i)=>{assert.equal(q.pts.length,2);near(q.pts[0][0],15);near(q.pts[1][0],282);near(q.pts[0][1],15+(i+.5)*9);near(q.pts[1][1],q.pts[0][1]);});
const analytic={rows:4,length:30,gap:10,variation:0,stagger:0,amplitude:0,clock:'Manual'},start=run(analytic),shifted=run({...analytic,phase:90});
near(start.paths[0].pts[0][0],15);near(start.paths[0].pts[1][0],45);near(shifted.paths[0].pts[0][0],25);near(shifted.paths[0].pts[1][0],55);
const reverse=run({...analytic,phase:90,direction:'Reverse'});near(reverse.paths[1].pts[0][0],45);near(reverse.paths[1].pts[1][0],75);
const waves=run({lineStyle:'Continuous',rows:4,amplitude:5,wavelength:90,rowPhase:0,clock:'Manual',phase:0});
for(const q of waves.paths)for(const [x,y] of q.pts){const row=Math.round((q.pts[0][1]-15)/45-.5);if(row>=0&&row<4)near(y-(15+(row+.5)*45),5*Math.sin((x-148.5)/90*2*Math.PI));}
assert.notEqual(hash(run()),hash(run({}, {frameIdx:12})),'Streaks actually travel');
assert.notEqual(hash(run({lineStyle:'Continuous',amplitude:4})),hash(run({lineStyle:'Continuous',amplitude:4},{frameIdx:12})),'Continuous waves move');
assert.equal(hash(run(straight)),hash(run(straight,{frameIdx:12})),'Continuous straight lines are deliberately static');
for(const p of [{...base},{...base,lineStyle:'Continuous',amplitude:0},{...base,lineStyle:'Continuous',amplitude:4},{...base,clock:'Manual'},{...base,stagger:0,variation:0}])for(const d of N.params.filter(d=>d.showIf&&!d.showIf(p))){
 assert.equal(hash(run(p)),hash(run({...p,[d.key]:d.max??d.options?.at(-1)??429})),`Hidden control ${d.key}`);checks++;
}
for(const [key,value] of Object.entries({rows:45,angle:33,length:22,gap:6,variation:0,stagger:0,amplitude:4,direction:'Reverse',cycles:2,phase:75,margin:30,seed:62,layer:7}))assert.notEqual(hash(run({}, {frameIdx:7})),hash(run({[key]:value},{frameIdx:7})),`Meaningful ${key}`);
for(const [key,value] of [['wavelength',45],['rowPhase',25]])assert.notEqual(hash(run({amplitude:4})),hash(run({amplitude:4,[key]:value})),`Meaningful ${key}`);
for(const size of [{W:210,H:297},{W:594,H:420},{W:32,H:25},{W:10000,H:10000}])for(const angle of [0,37,90])run({rows:240,length:2,gap:1,amplitude:30,wavelength:10,margin:1,angle},size);
for(const p of [{phase:NaN,cycles:NaN,amplitude:Infinity,angle:NaN,rows:Infinity,seed:NaN},{cycles:-10,amplitude:-20,rows:900,layer:100},{phase:-1e9,angle:1e9,margin:-5}])run(p,{frameIdx:NaN,frameCount:Infinity});
for(const ctx of [{W:0,H:0},{W:NaN,H:210},{W:10,H:10}])assert.deepEqual(N.compute([],base,ctx),H.EMPTY);
const guide=N.overlay(base,canvas)[0];assert.deepEqual(guide,{kind:'rect',x:15,y:15,w:267,h:180});
assert.deepEqual(N.overlay(base,{W:0,H:0}),[]);
// Use the same real evaluator as ANIMATE, including an actual Frame Phase wire.
const defs={moving_lines:N,frame:Frame},app=fs.readFileSync('src/App.jsx','utf8'),ast=parseAst(app,{lang:'jsx'});
const functions=['defIns','defOuts','numericParams','defaultFor','evalLevel'].map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return app.slice(n.start,n.end);}).join('\n');
const evaluate=Function('DEFS','EMPTY','SOLID_STYLE','Pin',functions+'\nreturn evalLevel;')(defs,H.EMPTY,{kind:'style',mode:'Solid'},H.Pin);
const examples=EXAMPLES.filter(e=>e.name.startsWith('Moving Lines ·'));assert.equal(examples.length,2);
for(const ex of examples){const graph=ex.make(key=>defaults(defs[key]));for(const frameIdx of [0,6,12,23]){const out=evaluate(graph,{...ex.canvas,frameCount:24,frameIdx}).out[graph.nodes.at(-1).id][0];assert.ok(out.paths.length>0);checks++;}}
const graph={nodes:[{id:1,type:'frame',params:defaults(Frame)},{id:2,type:'moving_lines',params:{...base,clock:'Manual'}}],edges:[{from:1,fromPort:4,to:2,toPort:'p:phase'}]};
for(const frameIdx of [0,7,23]){const ctx={...canvas,frameCount:24,frameIdx},r=evaluate(graph,ctx);assert.equal(hash(r.out[2][0]),hash(N.compute([],{...base,clock:'Timeline'},ctx)));checks++;}
console.log(`PASS [${lab?'lab':'baked'}]: ${checks} Moving Lines cases; open-only geometry, analytic straight/wave tracks, physical lengths and travel, looping clocks, hidden controls, complete field budgets, actual Help/evaluator and Frame wiring.`);
