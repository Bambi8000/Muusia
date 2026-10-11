import assert from 'node:assert/strict';
import { splitFramePens, penFrameName, finishPenPasses } from '../src/frame-export.js';
import { PENS } from '../src/defs/helpers.js';
import def from '../src/defs/nodes/murmuration.js';
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const ctx={W:297,H:210,frameCount:48};
const files=[];
for(let frame=47;frame>=0;frame--) {
 const ps=def.compute([],{...defaults,behaviour:'Reindeer herd',highlight:'On',animal:17,camera:'Follow group',ground:'Sparse dots',birds:80}, {...ctx,frameIdx:frame});
 const before=JSON.stringify(ps),parts=splitFramePens(ps,PENS);
 assert.equal(parts.length,2);
 assert.equal(parts[1].ps.paths.length,1,'second pass is only selected animal');
 assert.equal(parts.reduce((n,p)=>n+p.ps.paths.length,0),ps.paths.length,'no duplication');
 for(const {pen,ps:part} of parts) {
  assert.ok(part.paths.every(p=>p.layer===pen));
  for(const path of part.paths) assert.ok(ps.paths.some(p=>JSON.stringify(p)===JSON.stringify(path)),'geometry exactly unchanged');
  files.push({name:penFrameName('test',pen,frame,'svg'),text:JSON.stringify(part),pen,frame,pathCount:part.paths.length});
 }
 assert.equal(JSON.stringify(ps),before,'input not mutated');
}
const archive=finishPenPasses(files,{...ctx,pens:PENS,kind:'svg'});
assert.equal(archive.length,98);
assert.match(archive[0].name,/pen-00\/test-frame-001.svg/);
assert.match(archive[47].name,/pen-00\/test-frame-048.svg/);
assert.match(archive[48].name,/pen-02\/test-frame-001.svg/);
const manifest=JSON.parse(archive.at(-1).text);
assert.deepEqual(manifest.canvasMm,{W:297,H:210});
assert.equal(manifest.passes[1].frames.length,48);
assert.ok(manifest.passes[1].frames.every(f=>f.paths===1));
const sparse=finishPenPasses([files[48]],{...ctx,pens:PENS,kind:'svg'});
assert.equal(JSON.parse(sparse.at(-1).text).passes[0].frames.filter(f=>f.file===null).length,47);
assert.equal(finishPenPasses([],{...ctx,pens:PENS,kind:'gcode'}).length,2,'empty sequence is documented without motion files');
assert.ok(!penFrameName('../../bad/name',0,0,'gcode').includes('..'),'safe archive paths');
const metadata={paths:[{pts:[[3,4,1],[5,6,2]],layer:14,closed:false,__stop:{msg:'Keep me'}}]};
const split=splitFramePens(metadata,PENS)[0];assert.equal(split.pen,2);assert.deepEqual(split.ps.paths[0].pts,metadata.paths[0].pts);assert.deepEqual(split.ps.paths[0].__stop,metadata.paths[0].__stop);
console.log('Frame export: 48 × 2 passes, stable coordinates, pen ordering, missing frames, safe names and path metadata pass.');

// Optional real UI downloads, never a replacement for browser export.
if(process.argv.includes('--browser-captures')) {
 const fs=await import('node:fs/promises');
 const {unzipSync,strFromU8}=await import('fflate');
 const {createHash}=await import('node:crypto');
 const {parseAst}=await import('rolldown/parseAst');
 const helpers=await import('../src/defs/helpers.js');
 const grid=(await import('../src/defs/nodes/frame_grid.js')).default;
 const scene=(await import('../src/examples.js')).EXAMPLES[0];
 const defs={murmuration:def,frame_grid:grid};
 const root=scene.make(k=>Object.fromEntries(defs[k].params.map(p=>[p.key,p.def])));
 const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
 const ast=parseAst(app,{lang:'jsx'});
 const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(n);return app.slice(n.start,n.end);};
 const route=new Function(fn('routeOptimize')+';return routeOptimize')();
 const engine=app.slice(app.indexOf('function defIns(node)'),app.indexOf('/* ============================================================\n   G-CODE'));
 const evaluate=new Function('DEFS','EMPTY','SOLID_STYLE',engine+';return evalLevel;')(defs,helpers.EMPTY,{kind:'style',mode:'Solid'});
 const svg=new Function('PENS',fn('toSVG')+';return toSVG;')(PENS);
 const dir=process.argv[process.argv.indexOf('--browser-captures')+1];assert.ok(dir);
 const evidence={date:new Date().toISOString().slice(0,10),frames:24,canvasMm:{W:297,H:210},routeOptimize:true,preserveDirection:true,profile:'A — Servo Z (multi-tip brush)',scope:'Real app Help example → Frame Grid → All frames by pen; 24 sheets, SVG/G-code/DXF ZIP downloads. No hardware execution.',archives:{}};
 const archives={};
 for(const kind of ['svg','gcode','dxf']) {
  const bytes=await fs.readFile(`${dir}/tracking-test-pen-passes-${kind}.zip`);
  archives[kind]=unzipSync(bytes);
  assert.equal(Object.keys(archives[kind]).length,50);
  evidence.archives[kind]={sha256:createHash('sha256').update(bytes).digest('hex'),files:48};
 }
 for(let f=0;f<24;f++) {
  const context={W:297,H:210,frameIdx:f,frameCount:24};
  const output=evaluate(root,context,null).out[9002][0];
  for(const {pen,ps} of splitFramePens(output,PENS)) {
   const name=kind=>penFrameName('tracking-test',pen,f,kind);
   const actual=strFromU8(archives.svg[name('svg')]);
   assert.equal(actual,svg(route(ps,true),context),`browser SVG agrees with actual graph at ${f}, pen ${pen}`);
   if(pen===2)assert.equal(ps.paths.length,1,'highlight has no registration marks or background');
   const code=strFromU8(archives.gcode[name('gcode')]);
   assert.ok(!code.includes('CHANGE PEN'),'no in-job colour change');
   assert.match(code,new RegExp(`; Pen ${pen}:`));
   assert.match(code,/G28 ; home/,'profile start command kept');
   const drawn=[];let down=false,current=[0,0],path=[];
   for(const line of code.split('\n')) {
    if(line.startsWith('SET_SERVO')) {
     if(/ANGLE=35(?:\s|$)/.test(line)){down=true;path=[current];}
     else if(/ANGLE=90(?:\s|$)/.test(line)){if(down)drawn.push(path);down=false;}
    }
    if(/^G[01] X/.test(line)) {
     const m=/X(-?[\d.]+) Y(-?[\d.]+)/.exec(line);assert.ok(m);
     current=[+m[1],+m[2]];
     if(/^G0 /.test(line))assert.equal(down,false,'rapid moves pen up');
     else if(down)path.push(current);
    }
   }
   assert.equal(down,false,'ends pen up');
   const expected=route(ps,true).paths.map(p=>p.closed?[...p.pts,p.pts[0]]:p.pts);
   assert.equal(drawn.length,expected.length);
   for(let i=0;i<drawn.length;i++) {
    assert.equal(drawn[i].length,expected[i].length);
    for(let j=0;j<drawn[i].length;j++)assert.ok(Math.hypot(drawn[i][j][0]-expected[i][j][0],drawn[i][j][1]-expected[i][j][1])<.008,'G-code at unchanged coordinates');
   }
   const dxf=strFromU8(archives.dxf[name('dxf')]);
   assert.equal((dxf.match(/\nPOLYLINE\n/g)||[]).length,ps.paths.length);
  }
 }
 await fs.mkdir(new URL('../docs/murmuration-tracking/',import.meta.url),{recursive:true});
 evidence.sourceSha256=Object.fromEntries(await Promise.all(['src/App.jsx','src/frame-export.js','src/murmuration-scene.js','src/defs/nodes/murmuration.js','src/defs/nodes/frame_grid.js','src/examples.js'].map(async p=>[p,createHash('sha256').update(await fs.readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
 await fs.writeFile(new URL('../docs/murmuration-tracking/browser-checks.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
 console.log('Actual UI captures: 24 × 2 × 3 files match; SVG exact, G-code within 0.008 mm with no colour changes, DXF path counts, registration on base only.');
}
