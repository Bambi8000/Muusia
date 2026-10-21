import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HERE,ROOT,defs,studies,patch,evaluate,toSVG,engineSource,exporterSource,gcodeSource} from './fixtures.mjs';
import {EXAMPLES} from '../../src/examples.js';
const sha=v=>createHash('sha256').update(v).digest('hex'), read=f=>fs.readFileSync(path.join(HERE,f));
const dependencies=[...Object.keys(defs).map(k=>'src/defs/nodes/'+k+'.js'),'src/defs/helpers.js','src/defs/parameter-visibility.js','src/machine.js'];
function validateGraph(p){
 const by=new Map(p.root.nodes.map(n=>[n.id,n]));assert.equal(by.size,p.root.nodes.length);assert.ok(by.has(p.root.outputId));assert.deepEqual(p.canvas,{W:297,H:420});
 for(const n of p.root.nodes){const d=defs[n.type];assert.ok(d);for(const q of d.params){assert.ok(q.key in n.params,n.type+'.'+q.key);const v=n.params[q.key];if(q.options)assert.ok(q.options.includes(v));if(q.type==='slider')assert.ok(Number.isFinite(v)&&v>=q.min&&v<=q.max);}}
 for(const e of p.root.edges){const a=by.get(e.from),b=by.get(e.to);assert.ok(a&&b);const d=defs[b.type],inputs=typeof d.ins==='function'?d.ins(b):d.ins;assert.equal(defs[a.type].outs[e.fromPort].type,inputs[e.toPort].type);}
 const v=evaluate(p);assert.deepEqual(v,evaluate(p),'seeded output');
 for(const q of v.paths){assert.ok(!q.closed);assert.ok(q.pts.length>=2);assert.ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12);for(const [x,y] of q.pts){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=10&&y>=10&&x<=287&&y<=410,'final artwork leaves at least 10 mm');}}
 return v;
}
function gcodeCheck(text,out){
 assert.ok(text.includes('Muusia v2.135'));assert.ok(text.includes('Learn — A3 software check'));
 assert.ok(!text.includes('OUT OF BOUNDS')&&!text.includes('WARNING: canvas'));
 const expected=[];for(const pen of [...new Set(out.paths.map(q=>q.layer))].sort((a,b)=>a-b))for(const q of out.paths.filter(q=>q.layer===pen))expected.push(...q.pts);
 const moves=text.split('\n').filter(s=>/^G[01] X/.test(s)).map(s=>s.match(/^G[01] X([\d.-]+) Y([\d.-]+)/).slice(1).map(Number));assert.deepEqual(moves.pop(),[0,0]);assert.equal(moves.length,expected.length);
 for(let i=0;i<moves.length;i++)for(let k=0;k<2;k++)assert.ok(Math.abs(moves[i][k]-expected[i][k])<=.005001,'complete G-code coordinate');
 let angle;for(const s of text.split('\n')){const a=s.match(/^SET_SERVO SERVO=pen ANGLE=([\d.-]+)/);if(a)angle=+a[1];if(/^G0 X/.test(s))assert.equal(angle,90,'pen-up travel');if(/^G1 X/.test(s))assert.equal(angle,35,'pen-down draw');}assert.equal(angle,90);
}
export function verifyGrid(){
 for(const s of studies){const p=patch(s.id),out=validateGraph(p),expectedCount=s.id.includes('drift')?1200:s.id.includes('4-pen')?820:615;
  assert.equal(out.paths.length,expectedCount);assert.equal(new Set(out.paths.map(q=>q.layer)).size,s.id.includes('4-pen')?4:3);
  const ex=EXAMPLES.find(e=>e.name===s.help);assert.ok(ex);assert.deepEqual(ex.canvas,p.canvas);const data=ex.make(k=>Object.fromEntries(defs[k].params.map(q=>[q.key,structuredClone(q.def)])));assert.deepEqual(evaluate({...p,root:{...data,outputId:p.root.outputId}}),out,'Help and tutorial geometry agree');
  assert.equal(read('assets/'+s.id+'.svg').toString(),toSVG(out,p.canvas),'actual browser SVG equals complete evaluated output');gcodeCheck(read('verification/'+s.id+'.gcode').toString(),out);
 }
}
export async function validateGrid(site){
 verifyGrid();const m=JSON.parse(read('capture-manifest.json'));assert.equal(m.appVersion,'2.135');assert.equal(m.engineSha256,sha(engineSource));assert.equal(m.exporterSha256,sha(exporterSource));assert.equal(m.gcodeSha256,sha(gcodeSource));
 for(const f of dependencies)assert.equal(m.sources[f],sha(fs.readFileSync(path.join(ROOT,f))),'changed multicolour source '+f);
 for(const f of m.files)assert.equal(f.sha256,sha(read(f.file)),'capture artifact '+f.file);
 for(const f of ['colour-drift-graph.png','colour-drift-focus.png','shared-four-focus.png']){const b=read('assets/'+f);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(b.readUInt32BE(16)>=800&&b.readUInt32BE(20)>=600);}
 if(site){const html=fs.readFileSync(path.join(site,'multicolour-grid/index.html'),'utf8');for(const term of ['Make a multicolour folded grid','Pen change per input off','0.25 mm','0.5%','1,200 paths','Test crop','2.135'])assert.ok(html.includes(term));for(const s of studies)for(const f of ['assets/'+s.id+'.svg','patches/'+s.id+'.muusia.json'])assert.deepEqual(fs.readFileSync(path.join(site,'multicolour-grid',f)),read(f));assert.ok(!fs.existsSync(path.join(site,'multicolour-grid/verification')),'machine-specific G-code evidence stays source-only');}
 console.log('Multicolour Grid: 3 complete A3/Help graphs, deterministic bounded pen layers, actual SVG/G-code equivalence and real PNG/source provenance verified.');
}
if(process.argv.includes('--record')){
 verifyGrid();const files=[];for(const folder of ['assets','patches','verification'])for(const file of fs.readdirSync(path.join(HERE,folder)))files.push({file:folder+'/'+file,sha256:sha(read(folder+'/'+file))});
 fs.writeFileSync(path.join(HERE,'capture-manifest.json'),JSON.stringify({schemaVersion:1,appVersion:'2.135',date:'2026-10-21',baseCommit:'67c78d3a6beed699cd909961c7ed16956998d5b4',scope:'Actual built-in local app: three SVG and G-code downloads, two Focus images and one real seven-node graph capture. G-code: illustrative Learn — A3 software check, 330×450 mm, Servo pen 90°/35°, Flip Y off, origin 0/0, route optimization off, direction preserved, no hardware run.',engineSha256:sha(engineSource),exporterSha256:sha(exporterSource),gcodeSha256:sha(gcodeSource),sources:Object.fromEntries(dependencies.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))])),files},null,2)+'\n');
}
if(process.argv.includes('--source'))await validateGrid();
