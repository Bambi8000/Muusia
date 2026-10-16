import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAst} from 'rolldown/parseAst';
import {Pin, EMPTY, PENS} from '../src/defs/helpers.js';
const patch=JSON.parse(fs.readFileSync('tools/fixtures/merge-complete.muusia.json','utf8'));
const defs={};for(const n of patch.root.nodes)defs[n.type]=(await import('../src/defs/nodes/'+n.type+'.js')).default;
const app=fs.readFileSync('src/App.jsx','utf8'),ast=parseAst(app,{lang:'jsx'});
const source=names=>names.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return app.slice(n.start,n.end);}).join('\n');
const evaluate=Function('DEFS','EMPTY','SOLID_STYLE','Pin',source(['defIns','defOuts','numericParams','defaultFor','evalLevel'])+'\nreturn evalLevel;')(defs,EMPTY,{kind:'style',mode:'Solid'},Pin);
const svg=Function('PENS',source(['toSVG'])+'\nreturn toSVG;')(PENS),before=JSON.stringify(patch);
const run=evaluate(patch.root,patch.canvas),foreground=run.out[109][0],background=run.out[111][0],merged=run.out[114][0];
const points=ps=>ps.paths.reduce((s,p)=>s+p.pts.length,0);
assert.equal(foreground.paths.length,8788);assert.equal(background.paths.length,685);
assert.deepEqual(merged.paths,[...foreground.paths,...background.paths]);
assert.equal(merged.paths.length,9473);assert.equal(points(merged),148512);
assert.equal(merged.paths.filter(p=>p.closed).length,8729,'All closed dot loops survive');
assert.equal(JSON.stringify(patch),before,'Evaluation does not mutate saved patch');
for(const reverse of [false,true])for(const penPer of [false,true]){
 const graph=structuredClone(patch.root),node=graph.nodes.find(n=>n.id===114);node.params.penPer=penPer;
 if(reverse)for(const e of graph.edges.filter(e=>e.to===114))e.toPort=1-e.toPort;
 const out=evaluate(graph,patch.canvas).out[114][0],inputs=reverse?[background,foreground]:[foreground,background];
 assert.equal(points(out),148512);assert.deepEqual(out.paths,inputs.flatMap((ps,i)=>ps.paths.map(p=>penPer?{...p,layer:i}:p)),'Both input orders and pen separation preserve every path');
}
// One very long path, later pen, and non-path payload fields must survive too.
const long={paths:[{pts:Array.from({length:120001},(_,i)=>[i/1000,10]),closed:false,layer:0},{pts:[[0,20],[1,20]],closed:false,layer:11}],sourceTag:'retained'};
defs.probe={ins:[],outs:[Pin('paths')],params:[],compute:()=>long};
const probe=evaluate({nodes:[{id:1,type:'probe',params:{}}],edges:[]},patch.canvas).out[1][0];assert.strictEqual(probe,long);assert.equal(points(probe),120003);
const text=svg(merged,patch.canvas),reference=svg({paths:[...foreground.paths,...background.paths]},patch.canvas);assert.equal(text,reference);assert.equal((text.match(/<path /g)||[]).length,9473);
if(process.argv[2]){const actual=fs.readFileSync(process.argv[2],'utf8');assert.equal(actual,text,'Actual browser SVG retains every ordered path and point');}
if(process.argv[3]){
 const code=fs.readFileSync(process.argv[3],'utf8'),moves=code.split('\n').filter(l=>/^G[01] X/.test(l)).map(l=>{const m=l.match(/^G[01] X([\d.-]+) Y([\d.-]+)/);return m.slice(1).map(Number)});
 const expected=merged.paths.filter(p=>p.pts.length>=2).flatMap(p=>[...p.pts,...(p.closed?[p.pts[0]]:[])]).map(([x,y])=>[x,patch.canvas.H-y]);
 // The saved machine's Flip Y is on, origin is zero; route optimization off.
 assert.deepEqual(moves.pop(),[0,0],'Saved profile ends with a pen-up return to origin');
 assert.equal(moves.length,expected.length,'Every G-code drawing path and closure retained');
 for(let i=0;i<moves.length;i++)for(let j=0;j<2;j++)assert.ok(Math.abs(moves[i][j]-expected[i][j])<=.005001,'G-code coordinate '+i);
}
console.log('PASS: reported Organic Rings → Torn + BG Fill → Negative Space → Merge: 9473 paths / 148512 points, all 8729 closed loops; both orders, pen separation, single long path and metadata retained; SVG complete.');
