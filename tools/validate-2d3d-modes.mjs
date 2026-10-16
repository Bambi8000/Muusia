import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseAst} from 'rolldown/parseAst';
import N from '../src/defs/nodes/inflate3d.js';
import Spikes from '../src/defs/nodes/spikes3d.js';
import Slice from '../src/defs/nodes/meshslice.js';
import Container from '../src/defs/nodes/container.js';
import Superformula from '../src/defs/nodes/superformula.js';
import Merge from '../src/defs/nodes/merge.js';
import Zigzag from '../src/defs/nodes/zigzag.js';
import {Pin,EMPTY} from '../src/defs/helpers.js';
import {EXAMPLES} from '../src/examples.js';
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def])),base=defaults(N),ctx={W:297,H:210};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const path=(pts,closed=false)=>({pts,closed,layer:0}),ps=(...paths)=>({paths});
const circle=(r=50,n=48)=>path(Array.from({length:n},(_,i)=>[r*Math.cos(i/n*Math.PI*2),r*Math.sin(i/n*Math.PI*2)]),true);
const ring=ps(circle(),circle(22)),rect=ps(path([[0,0],[100,0],[100,65],[0,65]],true));
const line=ps(path([[0,0],[100,0]])),cross=ps(path([[-50,0],[50,0]]),path([[0,-50],[0,50]]));
const image={data:{img:{w:3,h:2,g:[1,.5,0,1,.5,0]}}};
let checks=0;
function run(mode,input=rect,patch={},node={}) {
  const p={...base,mode,detail:28,...patch},before=JSON.stringify({p,input,node}),out=N.compute([input],p,ctx,node);
  assert.equal(JSON.stringify({p,input,node}),before,'No source/params/image mutation');
  assert.equal(out.length,3);const mesh=out[2];assert.ok(mesh?.tri>0,mode+' produces a mesh');
  assert.equal(mesh.v.length,mesh.tri*9);assert.ok(mesh.tri<=120000);assert.equal(Math.max(...mesh.dims),1);
  for(const v of mesh.v){assert.ok(Number.isFinite(v)&&Math.abs(v)<=.5001);assert.ok(Math.abs(v*10000-Math.round(v*10000))<1e-8);}
  for(const q of out.slice(0,2)){assert.ok(q.paths.reduce((n,p)=>n+p.pts.length,0)<=90000);for(const path of q.paths){assert.ok(path.pts.length>=2);assert.ok(Number.isInteger(path.layer)&&path.layer>=0&&path.layer<=11);for(const [x,y] of path.pts)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=p.margin-1e-6&&x<=ctx.W-p.margin+1e-6&&y>=p.margin-1e-6&&y<=ctx.H-p.margin+1e-6);}}
  checks++;return out;
}
function topology(mesh,closed=true,label=''){
  const edges=new Map();let volume=0;
  for(let i=0;i<mesh.v.length;i+=9){const [a,b,c]=[0,3,6].map(k=>mesh.v.slice(i+k,i+k+3)),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
    assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-12,'Nondegenerate face '+label);
    volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const A=p.join(','),B=q.join(','),key=A<B?A+'|'+B:B+'|'+A,e=edges.get(key)||[0,0];e[0]++;e[1]+=A<B?1:-1;edges.set(key,e);}
  }
  if(closed){assert.equal([...edges.values()].filter(([n,s])=>n!==2||s!==0).length,0,'Closed, oppositely wound mesh '+label);assert.ok(volume>1e-8,'Outward positive volume '+label);}
  else assert.ok([...edges.values()].some(([n])=>n===1),'Intentional open boundary '+label);
  checks++;
}
for(const mode of ['Extrude','Tubes','Ink height','Depth map']){
 const node=mode==='Depth map'?image:{},input=mode==='Tubes'?ps(circle()):rect,original=run(mode,input,{},node);
 assert.equal(hash(original),hash(run(mode,input,{},node)),'Determinism');topology(original[2],true,mode);assert.ok(original[0].paths.length);
 for(const patch of [{viewAz:-70},{viewEl:-30},{margin:35},{size:90},{layer:6},{drawing:'Mesh edges'},{drawing:'Silhouette'},{every:4},{hidden:false},{outline:false}])assert.equal(hash(run(mode,input,patch,node)[2]),hash(original[2]),'Camera/preview cannot deform '+mode);
 const style=N.compute([input,{kind:'style',mode:'Dashed',dash:3,gap:1,vary:.2,seed:7}],{...base,mode,detail:28},ctx,node);
 assert.equal(hash(style[2]),hash(original[2]));assert.ok(style[0].paths.length);
 for(const patch of mode==='Tubes'?[{depth:0,detail:72,back:'Flat',roundness:2,inkWidth:20,smooth:12,base:25,curve:4}]:mode==='Extrude'?[{back:'Flat',roundness:2,diameter:20,inkWidth:20,curve:4,smooth:12,base:25}]:[{diameter:20,back:'Flat',roundness:2,caps:false,tubeStep:9}])assert.equal(hash(run(mode,input,patch,node)[2]),hash(original[2]),'Inactive sculpt params ignored '+mode);
 const spikes=Spikes.compute([original[2]],{...defaults(Spikes),body:'Wired mesh',count:50,size:90,length:10},ctx);assert.ok(spikes.paths.length,'Actual Spikes consumes '+mode);
 const slice=Slice.compute([undefined,original[2]],{...defaults(Slice),size:90,slices:5,step:2},ctx,{});assert.ok(slice.paths.length,'Actual Mesh Slice consumes '+mode);
}
for(const input of [ring,rect,ps(path([[0,0],[100,0],[100,25],[35,25],[35,75],[100,75],[100,100],[0,100]],true)),ps(circle(20),path([[80,0],[100,0],[100,20],[80,20]],true))]){
 const m=run('Extrude',input)[2];topology(m,true,'Extrude shape');
 const zs=new Set(m.v.filter((_,i)=>i%3===2));assert.equal(zs.size,2,'Flat top/back, straight walls');
}
const donut=run('Extrude',ring)[2];for(let i=0;i<donut.v.length;i+=9)assert.ok(Math.hypot((donut.v[i]+donut.v[i+3]+donut.v[i+6])/3,(donut.v[i+1]+donut.v[i+4]+donut.v[i+7])/3)>.20,'Extruded hole remains open');
const flat=run('Extrude',ring,{depth:0})[2];assert.equal(flat.dims[2],0);topology(flat,false,'Flat sheet');
for(const depth of [.04,.1,150])topology(run('Extrude',ring,{depth})[2],true,'Thin/deep extrusion');
const cyl=run('Tubes',line,{diameter:10,tubeStep:5})[2];topology(cyl);assert.deepEqual(cyl.dims,[1,.1,.1],'Tube diameter uses source mm');
const uncapped=run('Tubes',line,{caps:false})[2];topology(uncapped,false,'Uncapped cylinder');
for(const input of [ps(circle()),ps(path([[0,0],[30,0],[55,25],[80,30],[100,15]])),ps(path([[0,0],[0,100]]))])topology(run('Tubes',input,{diameter:5})[2],true,'Tube loop/bend/vertical');
const denseLine=ps(path(Array.from({length:101},(_,i)=>[i,0])));assert.equal(hash(run('Tubes',denseLine)[2]),hash(run('Tubes',line)[2]),'Tube re-tessellation invariant');
const ink=run('Ink height',cross,{detail:44,smooth:0,inkWidth:8})[2];topology(ink);
const highest=(mesh,x,y)=>{let best=Infinity,z=-Infinity;for(let i=0;i<mesh.v.length;i+=3){const d=Math.hypot(mesh.v[i]-x,mesh.v[i+1]-y);if(d<best-1e-8){best=d;z=mesh.v[i+2];}else if(d<=best+1e-8)z=Math.max(z,mesh.v[i+2]);}return z;};
assert.ok(highest(ink,0,0)>highest(ink,.25,0)+.04,'Ink crossing higher than a single stroke');
const one=run('Ink height',line,{detail:44,smooth:0})[2],two=run('Ink height',ps(line.paths[0],line.paths[0]),{detail:44,smooth:0})[2];assert.ok(two.dims[2]>one.dims[2]+.04,'Overlaid strokes accumulate');
assert.equal(hash(run('Ink height',denseLine)[2]),hash(run('Ink height',line)[2]),'Ink re-tessellation invariant');
for(const [mode,patch,node] of [['Ink height',{inkWidth:10},{}],['Ink height',{inkGain:3},{}],['Ink height',{curve:2},{}],['Ink height',{smooth:8},{}],['Ink height',{base:12},{}],['Tubes',{diameter:14},{}],['Tubes',{tubeStep:8},{}],['Tubes',{sides:12},{}],['Depth map',{darkHigh:true},image],['Depth map',{curve:2},image],['Depth map',{smooth:8},image],['Depth map',{base:10},image]])assert.notEqual(hash(run(mode,rect,patch,node)[2]),hash(run(mode,rect,{},node)[2]),'Meaningful '+mode+' '+Object.keys(patch));
const ramp=run('Depth map',undefined,{smooth:0,depth:50,base:5},image)[2];assert.deepEqual(ramp.dims,[1,.6667,.55]);
assert.ok(Math.abs(highest(ramp,.5,0)-highest(ramp,-.5,0)-.5)<.0002,'White is high, black low');
const inv=run('Depth map',undefined,{smooth:0,darkHigh:true,depth:50,base:5},image)[2];assert.ok(highest(inv,-.5,0)>highest(inv,.5,0)+.49,'Invert flips depth');
for(const g of [[0],[1],[.5]]){const m=run('Depth map',undefined,{smooth:0},{data:{img:{w:1,h:1,g}}})[2];topology(m,true,'Uniform image');}
topology(run('Depth map',undefined,{mapSource:'Wave study'})[2]);
for(const mode of ['Ink height','Depth map']){const node=mode==='Depth map'?image:{},m=run(mode,line,{depth:0},node)[2];topology(m);assert.equal(new Set(m.v.filter((_,i)=>i%3===2)).size,2,'Depth zero relief keeps flat base');assert.equal(hash(m),hash(run(mode,line,{depth:0,curve:4,smooth:12,inkGain:4,darkHigh:true},node)[2]));}
for(const mode of ['Extrude','Tubes','Ink height'])for(const input of [ps(),ps(path([[0,0],[NaN,2]])),ps(path([[0,0],[0,0]])),ps(...Array.from({length:30001},()=>path([[0,0],[1,0],[0,1]],true))),ps(circle(50,120001))]){assert.equal(N.compute([input],{...base,mode},ctx)[2],null,'Invalid/excess source '+mode);checks++;}
for(const img of [undefined,{}, {w:2,h:2,g:[0]}, {w:0,h:2,g:[]}, {w:2.5,h:2,g:[]},{w:2,h:1,g:[NaN,0]},{w:2,h:1,g:['0',0]}]){assert.equal(N.compute([],{...base,mode:'Depth map'},ctx,{data:{img}})[2],null);checks++;}
// Actual evaluator and built-in Help examples, including the unchanged saved key.
const defs=Object.fromEntries([N,Spikes,Slice,Container,Superformula,Merge,Zigzag].map(d=>[d.key,d]));
const source=await fs.readFile('src/App.jsx','utf8'),ast=parseAst(source,{lang:'jsx'}),names=['defIns','defOuts','numericParams','defaultFor','evalLevel'];
const funcs=names.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);}).join('\n');
const evaluate=Function('DEFS','EMPTY','SOLID_STYLE','Pin',funcs+'\nreturn evalLevel;')(defs,EMPTY,{kind:'style',mode:'Solid'},Pin);
const exampleResults=[];
for(const ex of EXAMPLES.filter(e=>e.name.startsWith('2D to 3D ·'))){const graph=ex.make(key=>defaults(defs[key])),out=evaluate(graph,ex.canvas).out,last=graph.nodes.at(-1),m=out[last.id][2];assert.ok(m?.tri>0&&out[last.id][0].paths.length,ex.name);topology(m,true,ex.name);exampleResults.push({name:ex.name,tri:m.tri,strokes:out[last.id][0].paths.length,sha256:hash(out)});}
// Fingerprints captured before adding the four modes, with the real app
// evaluator. Check the complete drawings + Mesh + downstream Spikes output.
const legacyHashes={"Inflate \u00b7 Rounded pillow": "3b60375226f15fa0144f41fe136b9c8e5ce8fe99b1694a4ec88f6274f7c16956", "Inflate \u00b7 Keep the hole": "30c4c86caa88eb3100b21ebc95e1a17b605dde22735c8f861d43209a7caf6dd8", "Inflate \u00b7 Grow 3D spikes": "d8e700c61c935c95c271a9742ed894952c9a6c524776a08b37f5cf6a6d316f37"};
for(const ex of EXAMPLES.filter(e=>Object.hasOwn(legacyHashes,e.name))){const graph=ex.make(k=>defaults(defs[k]));for(const n of graph.nodes)if(n.type==='inflate3d')delete n.params.mode;assert.equal(hash(evaluate(graph,ex.canvas).out),legacyHashes[ex.name],'Legacy Inflate output '+ex.name);checks++;}
if(process.argv.includes('--baseline')){
 const file=process.argv[process.argv.indexOf('--baseline')+1],fixtures=JSON.parse(await fs.readFile(file,'utf8'));
 for(const {name,graph,canvas,outputSha256} of fixtures){assert.equal(hash(evaluate(graph,canvas).out),outputSha256,'Exact pre-change Inflate output '+name);checks++;}
}
// Each hidden local control must be irrelevant in every mode, using real data.
for(const mode of base.mode?N.params.find(p=>p.key==='mode').options:[]){const p={...base,mode,detail:24},node=image,out=N.compute([rect],p,ctx,node);for(const pd of N.params.filter(d=>d.showIf&&!d.showIf(p)&&d.type!=='file')){const v=pd.options?.at(-1)??(pd.type==='check'?!p[pd.key]:pd.max??1);assert.equal(hash(N.compute([rect],{...p,[pd.key]:v},ctx,node)),hash(out),'Hidden '+mode+'.'+pd.key);checks++;}}
// Stress the geometry caps with maximum detail and a long dense tube stroke.
run('Ink height',cross,{detail:72,inkWidth:.5,smooth:12});run('Depth map',undefined,{detail:72,mapSource:'Wave study',depth:150});
const stress=ps(path(Array.from({length:1000},(_,i)=>[i%2?100:0,i/10])));run('Tubes',stress,{sides:16,tubeStep:.5,diameter:4,hidden:false,drawing:'Mesh edges'});
console.log(JSON.stringify({checks,examples:exampleResults},null,2));
console.log(`PASS: ${checks} 2D to 3D cases; closed surfaces/winding, holes, tube caps, density invariance/buildup, real image tones/aspect/inversion, frozen inputs, inactive controls, budgets, actual consumers and evaluator.`);
