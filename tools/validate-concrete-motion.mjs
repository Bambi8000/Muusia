import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import concrete from '../src/defs/nodes/concrete.js';
import {SFONT} from '../src/defs/helpers.js';
import stroke from '../src/defs/nodes/viiva.js';
const defaults=Object.fromEntries(concrete.params.map(p=>[p.key,p.def]));
const ctx={W:210,H:148,frameCount:24,frameIdx:0};
const run=(p={},c=ctx,ins=[])=>concrete.compute(ins,{...defaults,...p},c);
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const pts=r=>r.paths.flatMap(p=>p.pts);
let checks=0;
const check=(v,s)=>{assert.ok(v,s);checks++;};
const eq=(a,b,s)=>{assert.deepEqual(a,b,s);checks++;};
const frozen={
 'Fill region':'84276e9ad36a1819e59f0ff1ce5308bd6eb54c1b38cd3806db09138f392e0379',
 Spiral:'62b39892b8e7b7a7a2b26470cc2e1553af50203551ee0b82201d7fd772faeadb',
 Wave:'d663ebd9bf73b53b2ee177a6e571cf4b8635e47c54b49282b6b284ecb8d1b811',
 'Scatter words':'e170479b9828b2a1a1fbbc31d18dae8afb1a7d7761c9b3d9e452ce8c75f4c0fb',
};
check(concrete.ins[0].type==='paths'&&concrete.ins[1].type==='style','legacy ports unchanged');
check(concrete.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'select descriptors');
check(new Set(concrete.params.map(p=>p.key)).size===concrete.params.length,'unique parameter keys');
for(const [mode,expected] of Object.entries(frozen)){
 eq(hash(run({mode})),expected,mode+' frozen pre-motion output');
 eq(hash(run({mode,motion:undefined}, {...ctx,frameIdx:12})),expected,mode+' old patches ignore timeline');
 eq(hash(run({mode,motion:'Swarm',amount:0})),expected,mode+' Amount 0 restores original');
}
const modes=concrete.params.find(p=>p.key==='motion').options.slice(1);
check(modes.length===14,'fourteen motion modes');
const hashes=new Set();
for(const mode of concrete.params.find(p=>p.key==='mode').options){
 for(const motion of modes){
  const p={mode,motion},a=run(p),b=run(p,{...ctx,frameIdx:7}),label=mode+'/'+motion;
  const points=pts(b);
  check(points.length>0,label+' nonempty');
  check(points.length<=112000,label+' bounded work');
  check(points.every(p=>p.length===2&&p.every(Number.isFinite)),label+' finite');
  check(points.every(([x,y])=>x>=12-1e-7&&x<=198+1e-7&&y>=12-1e-7&&y<=136+1e-7),label+' clipped bounds');
  check(b.paths.every(p=>p.pts.length>=2&&p.closed===false&&Number.isInteger(p.layer)),label+' real open strokes');
  check(hash(a)!==hash(b),label+' changes across frames');
  eq(hash(b),hash(run(p,{...ctx,frameIdx:7})),label+' repeatable');
  eq(hash(a),hash(run(p,{...ctx,frameIdx:24})),label+' seamless full period');
  eq(hash(a),hash(run(p,{...ctx,frameIdx:-24})),label+' negative period');
  eq(hash(a),hash(run({...p,cycles:3},{...ctx,frameIdx:8})),label+' integer cycles');
  eq(hash(run({...p,clock:'Phase input',phase:0.25})),hash(run({...p,clock:'Phase input',phase:0.25},{...ctx,frameIdx:9})),label+' independent phase clock');
  eq(hash(run({...p,clock:'Phase input',phase:0.25})),hash(run(p,{...ctx,frameIdx:6})),label+' phase matches timeline');
  eq(hash(run({...p,phase:1})),hash(a),label+' phase seam');
  if(mode==='Columns')hashes.add(hash(b));
 }
}
check(hashes.size===14,'motions produce distinct geometry');
check(hash(run({motion:'Swarm',seed:20},{...ctx,frameIdx:7}))!==hash(run({motion:'Swarm',seed:21},{...ctx,frameIdx:7})),'Swarm seed changes dispersion');
eq(run({text:'',motion:'Wave'}).paths,[],'empty text');
eq(run({text:'   ',mode:'Scatter words',motion:'Orbit'}).paths,[],'empty words');
eq(run({margin:60,motion:'Swarm'},{W:30,H:40}).paths,[],'empty page footprint');
check(pts(run({motion:'Wave',text:'?! • Ö € 😀'})).every(p=>p.every(Number.isFinite)),'unsupported characters safe');
for(const motion of modes){
 const p={mode:'Columns',text:'WORD IS IMAGE',motion,size:2,track:0.6,lineh:0.9,columns:4,amount:1,distance:50,rowLag:0.5,letterLag:0.3};
 const r=run(p,{W:420,H:297,frameIdx:7,frameCount:24});
 check(pts(r).length<=112000,'A3 dense '+motion+' budget');
}
const huge=run({mode:'Fill region',motion:'Wave',size:0.001,lineh:0,track:0},{W:10000,H:10000});
check(pts(huge).length<=112000,'extreme wired density bounded');
const long=run({mode:'Columns',columns:4,text:'WORDS '.repeat(334),motion:'Swarm',size:2,lineh:0.9},{W:420,H:297,frameIdx:3,frameCount:24});
check(pts(long).length<=112000,'long phrases also bound collection work');
const bad={motion:'Wave'};for(const p of concrete.params)if(['slider','seed','pen'].includes(p.type))bad[p.key]=NaN;
check(pts(run(bad)).every(p=>p.every(Number.isFinite)),'numeric fallback');
check(run({motion:'Wave',layer:99}).paths.every(p=>p.layer===11),'pen clamped');
const style=stroke.compute([],Object.fromEntries(stroke.params.map(p=>[p.key,p.key==='dash'?2:p.key==='gap'?1:p.def])),ctx);
check(hash(run({motion:'Wave'},ctx,[undefined,style]))!==hash(run({motion:'Wave'})),'real Style input used');
// A fully collapsed Columns phrase must be exactly the short text, apart from
// floating point accumulation: verifies letter removal AND correct reflow.
const full={mode:'Columns',columns:1,text:'THURSDAY 1 OCTOBER 2026',shortText:'THU 1 OCT 26',size:4,amount:1,rowLag:0,letterLag:0,align:'Left',clip:false};
const collapsed=run({...full,motion:'Word collapse',clock:'Phase input',phase:0.5});
const short=run({...full,motion:'Off',text:full.shortText});
eq(collapsed.paths.length,short.paths.length,'collapse emits just the short phrase strokes');
const a=pts(collapsed),b=pts(short);
eq(a.length,b.length,'short phrase point count');
check(a.every(([x,y],i)=>Math.hypot(x-b[i][0],y-b[i][1])<1e-7),'short phrase spacing reconstructed');
for(const align of ['Outer edges','Centre']){
 const c=run({...full,align,columns:2,motion:'Word collapse',clock:'Phase input',phase:0.5});
 check(pts(c).every(([x,y])=>x>=12-1e-7&&x<=198+1e-7),'aligned collapse remains in columns '+align);
}
check(pts(run({...full,motion:'Word collapse',shortText:'IMPOSSIBLE',phase:0.5})).length>0,'non-subsequence fallback');
// Analytic clip cases: crossings, outside gaps, boundary segments, no bridge.
eq(concrete._clip([[-2,5],[12,5]],0,10,0,10),[[[0,5],[10,5]]],'segment intersection');
eq(concrete._clip([[2,5],[12,5],[12,8],[2,8]],0,10,0,10),[[[2,5],[10,5]],[[10,8],[2,8]]],'outside excursion splits pen strokes');
eq(concrete._clip([[0,0],[0,10]],0,10,0,10),[[[0,0],[0,10]]],'boundary retained');
eq(concrete._clip([[-2,-2],[-1,-1]],0,10,0,10),[],'outside segment discarded');
const region={paths:[{pts:[[40,30],[160,30],[160,110],[40,110]],closed:true,layer:0}]};
const located=concrete._layout([region],defaults,ctx,true);
check(located.length>0&&located.every(g=>g.x>=40&&g.x<=160),'region locates text');
eq(concrete.overlay(defaults,ctx,[region]).map(g=>g.kind),['rect','poly'],'placement guides use real overlay contract');
// Analytic 3 × 4 letter grid: check permutations independently of the renderer.
const grid=[...'ABCDEFGHIJKL'].map((ch,i)=>({ch,x:20+(i%4)*15,y:20+Math.floor(i/4)*15,size:7,adv:9,ang:0,index:i,row:Math.floor(i/4),col:0,slot:i%4,baseSx:1}));
const gridCopy=structuredClone(grid),shift=(pattern,t,g=grid,seed=151)=>concrete._shiftGlyphs(g,{...defaults,rowLag:0,shiftPattern:pattern,seed},t);
const letters=gs=>gs.map(g=>g.ch).join('');
eq(letters(shift('Rows',0.25)),'BCDAFGHEJKLI','row shift wraps right edge to left');
eq(letters(shift('Columns',1/3)),'EFGHIJKLABCD','column shift wraps bottom to top');
for(const pattern of ['Rows','Columns','Shuffle']){
 eq(letters(shift(pattern,0)),letters(grid),pattern+' starts with original letters');
 eq(letters(shift(pattern,1)),letters(grid),pattern+' completes exact cycle');
 for(let f=0;f<24;f++){
  const moved=shift(pattern,f/24);
  eq([...letters(moved)].sort(),[...letters(grid)].sort(),pattern+' keeps every letter exactly once');
  eq(moved.map(({x,y,adv,size,ang})=>({x,y,adv,size,ang})),grid.map(({x,y,adv,size,ang})=>({x,y,adv,size,ang})),pattern+' fills the same cells');
  check(moved.every(g=>g.ch.trim()),pattern+' creates no empty cells');
 }
 const a=run({motion:'Shift',shiftPattern:pattern},{...ctx,frameIdx:4});
 check(pts(a).length>0&&pts(a).every(p=>p.every(Number.isFinite)),pattern+' real strokes');
 eq(hash(a),hash(run({motion:'Shift',shiftPattern:pattern},{...ctx,frameIdx:28})),pattern+' rendered loop');
}
eq(grid,gridCopy,'Shift does not mutate supplied glyphs');
eq(letters(shift('Shuffle',0.75,shift('Shuffle',0.25))),letters(grid),'shuffle inverse restores complete inventory');
check(letters(shift('Shuffle',0.25,grid,1))!==letters(shift('Shuffle',0.25,grid,2)),'shuffle Seed selects a different permutation');
eq(run({motion:'Shift',text:' | 😀 '}).paths,[],'Shift ignores non-drawing characters');
eq(hash(run({motion:'Shift',text:'AB CD|EF'})),hash(run({motion:'Shift',text:'ABCDEF'})),'Shift removes spaces and separators to fill field');
const field=concrete._layout([],{...defaults,text:'IWAB',motion:'Shift'},ctx,true);
check(field.every(g=>g.adv===field[0].adv),'Shift uses uniform cells despite narrow and wide glyphs');
const row0=field.filter(g=>g.row===0);
check(row0.length>10&&row0.at(-1).x>ctx.W-defaults.margin-2*row0[0].adv,'field reaches across available width');
const slots=field.map(({x,y})=>[x,y]);
for(const t of [0,0.1,0.5,0.9])eq(shift('Rows',t,field).map(({x,y})=>[x,y]),slots,'full field footprint stays fixed');
const denseShift=run({motion:'Shift',shiftPattern:'Shuffle',text:'IWAB0123',size:2,track:0.6,lineh:0.9},{W:420,H:297,frameIdx:7,frameCount:24});
check(pts(denseShift).length<=112000,'dense Shift preserves the point budget');
// Zoom must increase the number of small glyphs, never their physical size.
const zoomBase={...defaults,motion:'Zoom',text:'N',size:5,zoomRows:32,clip:false};
const zoomContext={W:210,H:297};
const stamps=(t,overrides={})=>concrete._zoomGlyphs([],{...zoomBase,...overrides},zoomContext,t);
eq(stamps(0).length,1,'Zoom starts with a single N');
check(stamps(0.25).length>stamps(0).length,'Zoom creates more N copies');
check(stamps(0.5).length>stamps(0.25).length,'maximum Zoom has more copies again');
for(const t of [0,0.1,0.25,0.5,0.75,0.9,1]){
 const gs=stamps(t),r=run({...zoomBase,clock:'Phase input',phase:t},zoomContext);
 check(gs.every(g=>g.ch==='N'&&g.size===5),'small N size and identity remain fixed '+t);
 eq(r.paths.length,gs.length,'each N is one real pen stroke '+t);
 for(const path of r.paths){
  const rel=path.pts.map(([x,y])=>[x-path.pts[0][0],y-path.pts[0][1]]);
  check(rel.every(([x,y],i)=>Math.abs(x-(SFONT.N.s[0][i][0]-SFONT.N.s[0][0][0])*0.5)<1e-8&&Math.abs(y-(SFONT.N.s[0][i][1]-SFONT.N.s[0][0][1])*0.5)<1e-8),'every rendered N has identical geometry');
 }
 const cells=gs.map(g=>g.col+':'+g.row);
 eq(new Set(cells).size,cells.length,'stroke joints are never stamped twice '+t);
}
eq(stamps(0),stamps(1),'Zoom cycle returns to one N');
eq(stamps(0.25),stamps(0.75),'In & out retraces the same letter grid');
const bigN=stamps(0.5),cols=Math.max(...bigN.map(g=>g.col));
check(bigN.some(g=>g.col===0&&g.row===0)&&bigN.some(g=>g.col===cols&&g.row===31),'large N has opposite corner endpoints');
for(let row=0;row<32;row++){
 check(bigN.some(g=>g.row===row&&g.col===0),'N left rail complete '+row);
 check(bigN.some(g=>g.row===row&&g.col===cols),'N right rail complete '+row);
 check(bigN.some(g=>g.row===row&&Math.abs(g.col-row/31*cols)<=1),'N diagonal follows its original stroke '+row);
}
const largeO=stamps(0.5,{text:'O'});
check(!largeO.some(g=>Math.abs(g.row-15.5)<5&&Math.abs(g.col-12.5)<5),'O retains its open counter');
const word=stamps(0.25,{text:'NO'});
check(word.some(g=>g.ch==='N')&&word.some(g=>g.ch==='O'),'each word letter uses its own repeated glyph');
for(const t of [0,0.2,0.5,0.8]){
 const multiline=stamps(t,{text:'N|O'});
 check(Math.max(...multiline.filter(g=>g.ch==='N').map(g=>g.y))<Math.min(...multiline.filter(g=>g.ch==='O').map(g=>g.y)),'line breaks remain ordered '+t);
}
check(stamps(0.1,{zoomCycle:'Zoom in'}).length<stamps(0.8,{zoomCycle:'Zoom in'}).length,'Zoom in grows');
check(stamps(0.1,{zoomCycle:'Zoom out'}).length>stamps(0.8,{zoomCycle:'Zoom out'}).length,'Zoom out shrinks');
check(stamps(0.5,{zoomSpacing:2})[0].size===5,'spacing does not scale little letters');
const narrow=stamps(0.5,{zoomSpacing:1.05}),wide=stamps(0.5,{zoomSpacing:2});
check(Math.max(...wide.map(g=>g.x))-Math.min(...wide.map(g=>g.x))>Math.max(...narrow.map(g=>g.x))-Math.min(...narrow.map(g=>g.x)),'spacing changes macro footprint');
eq(run({motion:'Zoom',text:'😀   |'}).paths,[],'unsupported-only Zoom is empty');
check(hash(run({...zoomBase,clock:'Phase input',phase:0.25},zoomContext,[undefined,style]))!==hash(run({...zoomBase,clock:'Phase input',phase:0.25},zoomContext)),'Zoom uses real Style input');
const regionCopy=structuredClone(region);
const regionZoom=concrete._zoomGlyphs([region],{...zoomBase,zoomRows:16},ctx,0.5);
check(regionZoom.length>0&&regionZoom.every(g=>g.x>=40&&g.x<=160&&g.y>=30&&g.y<=110),'Zoom honours Region stamp centres');
eq(region,regionCopy,'Zoom does not mutate Region');
const overload=run({...zoomBase,text:('MW@%'.repeat(500)),zoomRows:120,size:2},{W:10000,H:10000,frameIdx:12,frameCount:24});
check(pts(overload).length<=112000,'huge unclipped Zoom respects point/work budget');
const paramsCopy=structuredClone(zoomBase);run(zoomBase,zoomContext);eq(zoomBase,paramsCopy,'Zoom does not mutate params');
console.log(`[baked] Concrete Poetry — ${checks} checks passed, 5 layouts × 14 motions, fixed-size Zoom glyphs, Shift occupancy/permutations, frozen legacy hashes and real Style.`);
