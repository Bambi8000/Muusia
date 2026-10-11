import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import def from '../src/defs/nodes/type_studio.js';
import stitch from '../src/defs/nodes/stitchtype.js';
import gravity from '../src/defs/nodes/gravity.js';
import text from '../src/defs/nodes/hersheytext.js';
import stroke from '../src/defs/nodes/viiva.js';
import {TYPE_STUDIO_STYLES,studioParameters,studioFrame,studioBudget,fitStudioPaths,studioRecipe} from '../src/defs/type-studio.js';
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def]));
const p=defaults(def),ctx={W:200,H:140};
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const run=(over={},inputs=[],area=ctx)=>def.compute(inputs,{...p,...over},area,{});
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
function geometry(r,area=ctx,margin=12){let points=0;for(const q of r.paths){ok(q.pts.length>=(q.closed?3:2),'path structure');ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<=11,'valid pen');for(const pt of q.pts){ok(pt.every(Number.isFinite),'finite');ok(pt[0]>=margin-1e-6&&pt[0]<=area.W-margin+1e-6&&pt[1]>=margin-1e-6&&pt[1]<=area.H-margin+1e-6,'inside margins');}points+=q.pts.length;}ok(points<=112000,'point budget');}
assert.deepEqual(TYPE_STUDIO_STYLES.map(s=>s.slice(0,2)),['01','02','03','04','05','07','08','10','11','12']);
assert.deepEqual(def.ins.map(p=>p.type),['style','paths']);
const changes=[{contourCount:3},{rootWidth:9},{pattern:'Circles'},{squareLayout:'Grid'},{coilMode:'Sine'},{stitchPreset:'Circuit'},{ribbonSlant:-15},{smallText:'INK'},{fallRelease:.9},{asciiRamp:'01'}];
const hashes=[];
for(const [i,mode] of TYPE_STUDIO_STYLES.entries()){
 const start=performance.now(),r=run({mode});ok(r.paths.length>0,mode+' nonempty');geometry(r);const h=hash(r);hashes.push(h);
 assert.equal(h,hash(run({mode})),mode+' deterministic');
 assert.notEqual(h,hash(run({mode,...changes[i]})),mode+' relevant control');
 assert.notEqual(h,hash(run({mode,text:'INK'})),mode+' text changes');
 const smaller=run({mode,scale:50});assert.equal(smaller.paths.length,r.paths.length,mode+' scale preserves paths');
 for(let j=0;j<r.paths.length;j++)for(let k=0;k<r.paths[j].pts.length;k++)for(let axis=0;axis<2;axis++)ok(Math.abs(smaller.paths[j].pts[k][axis]-([ctx.W,ctx.H][axis]/2+(r.paths[j].pts[k][axis]-[ctx.W,ctx.H][axis]/2)/2))<1e-7,'composition scales around centre');
 const one=run({mode,layer:9,stitchColours:'One pen'});ok(one.paths.every(q=>q.layer===9),mode+' one-pen control');
 assert.equal(run({mode,text:' | \n '}).paths.length,0,mode+' empty text');
 assert.equal(run({mode,text:'💠'}).paths.length,0,mode+' unsupported glyph');
 for(const area of [{W:210,H:297},{W:420,H:297},{W:594,H:841},{W:20,H:20}])geometry(run({mode},[],area),area,Math.min(12,Math.min(area.W,area.H)*.45));
 const invalid=run({mode,size:Infinity,margin:NaN,scale:-Infinity,seed:Infinity,layer:Infinity});geometry(invalid);
 console.log(mode,r.paths.length+' paths',Math.round(performance.now()-start)+' ms incl. checks');
}
ok(new Set(hashes).size===10,'ten distinct treatments');
// Modular marks calls the actual Stitch Type, preserving the reviewed geometry.
const modular=studioParameters({mode:TYPE_STUDIO_STYLES[5],text:'TYPE'});
const direct=stitch.compute([],{...defaults(stitch),text:'TYPE',font:'Sampler 5x7',cell:40/14,px:2,gap:3,preset:'Sampler',seed:7,margin:12},ctx);
assert.deepEqual(studioRecipe(modular,ctx),direct,'existing Stitch Type geometry reused');
const motif={paths:[{pts:[[0,0],[10,0],[3,8]],closed:true,layer:8}]},frozen=JSON.stringify(motif);
const marks=run({mode:TYPE_STUDIO_STYLES[5],stitchColours:'Source pens'},[undefined,motif]);
ok(marks.paths.some(q=>q.layer===8),'source motif pen');assert.equal(JSON.stringify(motif),frozen,'input immutable');
for(const mode of TYPE_STUDIO_STYLES.filter(s=>!s.startsWith('07')))assert.equal(hash(run({mode})),hash(run({mode},[undefined,motif])),'motif only affects 07');
// Whole-text Gravity is byte-identical before the shared final fit.
const gp={...defaults(gravity),cols:18,rows:10,stampSize:.65,release:.55,progress:.5,spin:40,palette:1,penA:0,seed:7};
const stamp=text.compute([],{...defaults(text),text:'TYPE',size:12},ctx);
assert.deepEqual(studioRecipe(studioParameters({mode:TYPE_STUDIO_STYLES[8],fallUnit:'Whole text'}),ctx),gravity.compute([stamp],gp,ctx));
const fall=run({mode:TYPE_STUDIO_STYLES[8],fallRelease:0,text:'TYPE'});ok(fall.paths.length===360,'complete character strokes per cell');
assert.notEqual(hash(fall),hash(run({mode:TYPE_STUDIO_STYLES[8],fallRelease:0,text:'TYPE',fallUnit:'Whole text'})),'characters are not entire-word stamps');
const style=stroke.compute([],{...defaults(stroke),mode:'Dashed',dash:1,gap:.5},ctx);
assert.notEqual(hash(run()),hash(run({},[style])),'Style input works');
const dense={paths:Array.from({length:1000},(_,j)=>({pts:Array.from({length:200},(_,i)=>[j+i/200,i%2]),closed:false,layer:0}))};
const limited=studioBudget(dense);ok(limited.paths.length===1000,'budget does not drop final letters');ok(limited.paths.reduce((n,q)=>n+q.pts.length,0)<=112000,'dense budget');
for(const mode of TYPE_STUDIO_STYLES){const long=run({mode,text:'TYPE '.repeat(12),scale:60});geometry(long);}
for(const area of [{W:0,H:0},{W:NaN,H:100},{W:-1,H:10}]){assert.equal(run({},[],area).paths.length,0);assert.deepEqual(def.overlay(p,area),[]);}
assert.deepEqual(def.overlay(p,ctx),[{kind:'rect',x:12,y:12,w:176,h:116}]);
assert.equal(studioParameters({text:'A'.repeat(300)}).text.length,128,'text work bound');
console.log('Type Studio passed:',checks,'checks; ten modes, geometry, pens, fit, legacy reuse, custom motif, Style, budgets and invalid inputs.');

const {validateStudioCapture}=await import('../docs/type-studio/validate-capture.mjs');
validateStudioCapture();
