import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as H from '../src/defs/helpers.js';
const keys=['marbling','shape_packing','path_bend','seamless_tile','reaction_patterns','crystal_growth','mesh_render','array','lens','view3d','drape','gravity'];
const lab=process.argv.includes('--lab'),defs={};for(const key of keys){const file=`nodes-lab/${key}.plotternode.js`;defs[key]=lab&&fs.existsSync(file)?Function(...Object.keys(H),'return '+fs.readFileSync(file,'utf8'))(...Object.values(H)):(await import('../src/defs/nodes/'+key+'.js')).default;}
const defaults=k=>Object.fromEntries(defs[k].params.map(p=>[p.key,p.def])),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),ctx={W:297,H:210};let cases=0;
const rect=(x,y,w,h,layer=0)=>({pts:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],closed:true,layer}),shape={paths:[rect(75,50,140,100),rect(110,80,60,40)]},motif={paths:[rect(-5,-4,10,8,2)]},spine={paths:[{pts:[[30,150],[80,60],[140,130],[220,70],[270,100]],closed:false,layer:0}]};
function check(v,bounded=false,context=ctx){
 if(Array.isArray(v)){for(const q of v)if(q)check(q,bounded,context);return;}
 if(v.kind==='mesh'){assert.equal(v.v.length,v.tri*9);assert.ok(v.tri>0&&v.tri<=120000);assert.ok(v.v.every(Number.isFinite));assert.ok(v.dims.every(x=>Number.isFinite(x)&&x>=0&&x<=1.0001));assert.ok(Math.abs(Math.max(...v.dims)-1)<.001);return;}
 assert.ok(Array.isArray(v.paths));assert.ok(v.paths.reduce((n,q)=>n+q.pts.length,0)<=120000,'point budget');
 for(const q of v.paths){assert.ok(q.pts.length>=(q.closed?3:2));assert.ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12);for(const [x,y]of q.pts){assert.ok(Number.isFinite(x)&&Number.isFinite(y),'finite points');if(bounded)assert.ok(x>=-1e-6&&x<=context.W+1e-6&&y>=-1e-6&&y<=context.H+1e-6,'canvas bounds');}}
}
function run(key,ins=[],over={},context=ctx,node){const p={...defaults(key),...over},before=hash({ins,p,context,node}),v=defs[key].compute(ins,p,context,node);assert.equal(hash({ins,p,context,node}),before,'pure compute '+key);check(v,['shape_packing','reaction_patterns','crystal_growth','mesh_render'].includes(key),context);cases++;return v;}
for(const f of JSON.parse(fs.readFileSync(new URL('./fixtures/craft-legacy.json',import.meta.url))))assert.equal(hash(run(f.key,f.ins,f.p,f.ctx)),f.sha256,'legacy '+f.key);
for(const key of keys){const params=defs[key].params;assert.equal(new Set(params.map(p=>p.key)).size,params.length,'unique params '+key);for(const p of params)if(p.type==='select')assert.ok(p.options.includes(p.def));}
// Radius is invariant under twisting; exterior points remain on the source.
for(const mode of ['Drop','Rake','Comb','Swirl']){const a=run('marbling',[shape],{mode});assert.ok(a.paths.length);assert.equal(hash(a),hash(run('marbling',[shape],{mode})));assert.equal(hash(run('marbling',[shape],{mode,strength:0})),hash(shape));assert.notEqual(hash(a),hash(run('marbling',[shape],{mode,phase:90})));}
const swirl=run('marbling',[shape],{mode:'Swirl'});for(let k=0;k<shape.paths.length;k++){const src=H.resample(shape.paths[k].pts,true,1);assert.equal(swirl.paths[k].pts.length,src.length);for(let i=0;i<src.length;i++)assert.ok(Math.abs(Math.hypot(src[i][0]-ctx.W/2,src[i][1]-ctx.H/2)-Math.hypot(swirl.paths[k].pts[i][0]-ctx.W/2,swirl.paths[k].pts[i][1]-ctx.H/2))<1e-7);}
// A straight spine has an independently known affine mapping.
const straight={paths:[{pts:[[30,100],[230,100]],closed:false,layer:0}]},bent=run('path_bend',[{paths:[rect(0,0,100,20)]},straight]);
for(const [x,y]of bent.paths[0].pts)assert.ok(x>=30-1e-7&&x<=230+1e-7&&y>=90-1e-7&&y<=110+1e-7);
assert.deepEqual(bent.paths[0].pts[0],[30,90]);
for(const axis of ['Horizontal','Vertical'])for(const mode of ['Fit to spine','Actual length']){const v=run('path_bend',[shape,spine],{axis,mode,start:15});assert.ok(v.paths.length);assert.equal(hash(v),hash(run('path_bend',[shape,spine],{axis,mode,start:15})));}
assert.deepEqual(run('path_bend',[shape]),H.EMPTY);
// Independent axis-aligned envelope distance oracle for unrotated rectangle packing.
const packed=run('shape_packing',[motif,shape],{count:45,size:18,rotate:0,gap:2});assert.ok(packed.paths.length>=10);
const boxes=packed.paths.map(q=>{const xs=q.pts.map(p=>p[0]),ys=q.pts.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];});
for(let i=0;i<boxes.length;i++){const b=boxes[i];assert.ok(b[0]>=77-1e-7&&b[2]<=213+1e-7&&b[1]>=52-1e-7&&b[3]<=148+1e-7);assert.ok(b[2]<=108||b[0]>=172||b[3]<=78||b[1]>=122,'hole clearance');for(let j=0;j<i;j++){const a=boxes[j],dx=Math.max(0,a[0]-b[2],b[0]-a[2]),dy=Math.max(0,a[1]-b[3],b[1]-a[3]);assert.ok(Math.hypot(dx,dy)>=2-1e-7,'independent copy clearance');}}
assert.equal(hash(packed),hash(run('shape_packing',[motif,shape],{count:45,size:18,rotate:0,gap:2})));assert.notEqual(hash(packed),hash(run('shape_packing',[motif,shape],{count:45,size:18,rotate:0,gap:2,seed:38})));
// Export units really join along both opposite sides, including half-drop/mirror units.
for(const repeat of ['Straight','Half drop','Mirror']){
 const p={repeat,view:'Single unit',shiftX:32,shiftY:19},d=defs.seamless_tile,f=d._layout({...defaults('seamless_tile'),...p},ctx),v=run('seamless_tile',[{paths:[rect(0,0,60,40)]}],p),ends=v.paths.flatMap(q=>q.closed?[]:[q.pts[0],q.pts.at(-1)]),side=(axis,value)=>ends.filter(q=>Math.abs(q[axis]-value)<1e-6).map(q=>+(q[1-axis]).toFixed(5)).sort((a,b)=>a-b);
 assert.deepEqual(side(0,f.x),side(0,f.x+f.uw));assert.deepEqual(side(1,f.y),side(1,f.y+f.uh));assert.ok(v.paths.length);
}
for(const pattern of ['Coral','Maze','Spots']){const v=run('reaction_patterns',[],{pattern});assert.ok(v.paths.length>0);assert.equal(hash(v),hash(run('reaction_patterns',[],{pattern})));assert.notEqual(hash(v),hash(run('reaction_patterns',[],{pattern,seed:38})));}
const rd0=run('reaction_patterns',[],{steps:650,growth:0}),rd1=run('reaction_patterns',[],{steps:650,growth:60});assert.notEqual(hash(rd0),hash(rd1));assert.equal(hash(rd1),hash(run('reaction_patterns',[],{steps:650,motion:'Timeline'},{...ctx,frameIdx:6,frameCount:11})));
run('reaction_patterns',[undefined,shape,shape],{detail:128},{W:210,H:210});
const mature=run('crystal_growth');assert.ok(mature[0].paths.length&&mature[1].tri);assert.deepEqual(run('crystal_growth',[],{growth:0}),[H.EMPTY,null]);
for(const growth of [15,50,90,100]){const v=run('crystal_growth',[],{growth});assert.equal(hash(v),hash(run('crystal_growth',[],{growth})));}
assert.notEqual(hash(mature),hash(run('crystal_growth',[],{seed:38})));assert.notEqual(hash(mature),hash(run('crystal_growth',[],{branch:100})));assert.notEqual(hash(mature),hash(run('crystal_growth',[],{compete:false})));
for(const drawing of ['Illustration','Contours','Hatch','Edges']){const v=run('mesh_render',[mature[1]],{drawing});assert.ok(v[0].paths.length);assert.equal(hash(v),hash(run('mesh_render',[mature[1]],{drawing})));}
const render=run('mesh_render');for(const key of ['lightAz','lightEl','shadow','yaw','axis','pitch','contours']){const changes={lightAz:100,lightEl:20,shadow:false,yaw:-70,axis:'X',pitch:4,contours:12};assert.notEqual(hash(render[0]),hash(run('mesh_render',[],{[key]:changes[key]})[0]),key+' affects render');}
for(const layout of ['Grid','Radial','Spiral','Helix 3D','Sphere 3D']){const v=run('array',[motif],{layout,count:20});assert.equal(v.paths.length,20);assert.equal(hash(v),hash(run('array',[motif],{layout,count:20})));}
for(const mode of ['Twist','Vortex']){assert.equal(hash(run('lens',[shape],{mode,twist:0})),hash(shape));const v=run('lens',[shape],{mode});assert.notEqual(hash(v),hash(run('lens',[shape],{mode,twist:-180})));}
for(const deform of ['Bend','Twist','Cylinder'])for(const bendAxis of ['Horizontal','Vertical']){const v=run('view3d',[shape],{deform,bendAxis});check(v,true);assert.ok(v.paths.length);}
for(const physicsMode of ['Hanging','Flag']){
 const v=run('drape',[],{physicsMode});check(v,true);assert.ok(v.paths.length);assert.equal(hash(v),hash(run('drape',[],{physicsMode})));assert.notEqual(hash(v),hash(run('drape',[],{physicsMode,phase:90})));const art=run('drape',[undefined,undefined,undefined,shape],{physicsMode,clothContent:'Artwork'});assert.ok(art.paths.length);assert.notEqual(hash(art),hash(v));assert.notEqual(hash(v),hash(run('drape',[],{physicsMode,pull:true})));
}
const rigid0=run('gravity',[shape],{physicsMode:'Rigid bodies',time:0}),rigid=run('gravity',[shape],{physicsMode:'Rigid bodies',time:3});assert.notEqual(hash(rigid0),hash(rigid));check(rigid,true);assert.equal(hash(rigid),hash(run('gravity',[shape],{physicsMode:'Rigid bodies',time:3})));assert.equal(hash(rigid),hash(run('gravity',[shape],{physicsMode:'Rigid bodies',bodyMotion:'Timeline',duration:6},{...ctx,frameIdx:5,frameCount:11})));
const pile=run('gravity',[motif],{physicsMode:'Rigid bodies',bodySource:'Motif copies',bodyCount:20});check(pile,true);assert.equal(pile.paths.length,20,'all bodies remain complete');
// Parameter extremes, empty inputs and real Style helpers.
for(const key of ['marbling','shape_packing','path_bend','seamless_tile'])assert.deepEqual(run(key),H.EMPTY);
for(const key of ['marbling','lens'])for(const mode of key==='marbling'?['Drop','Rake','Comb','Swirl']:['Twist','Vortex'])for(const context of [{W:420,H:297},{W:594,H:420}])run(key,[shape],{mode},context);
for(const view of ['Single unit','3×3 preview'])for(const repeat of ['Straight','Half drop','Mirror'])run('seamless_tile',[shape],{view,repeat,shiftX:-99,shiftY:97});
for(const pattern of ['Coral','Maze','Spots','Custom'])run('reaction_patterns',[],{pattern,detail:128,scale:.5,steps:100},{W:210,H:210});
for(const over of [{count:70,branch:100},{mode:'Needles',lean:75},{growth:0},{growth:1},{width:.3,compete:false}])run('crystal_growth',[],over);
for(const over of [{source:'Cube',creases:true},{drawing:'Edges',shadow:false,silhouette:false},{elevation:90,lightEl:10,persp:.8},{detail:40},{drawing:'Contours',axis:'Y'}])run('mesh_render',[],over);
// Both STL intake formats normalize the same tetrahedron; a wire takes precedence.
const tetra=[0,0,0, 1,0,0, 0,1,0, 0,0,0, 0,0,1, 1,0,0, 0,0,0, 0,1,0, 0,0,1, 1,0,0, 0,0,1, 0,1,0],ascii='solid tetra\n'+Array.from({length:4},(_,i)=>'facet normal 0 0 1\nouter loop\n'+Array.from({length:3},(_,j)=>'vertex '+tetra.slice(i*9+j*3,i*9+j*3+3).join(' ')).join('\n')+'\nendloop\nendfacet').join('\n')+'\nendsolid tetra',binary=Buffer.alloc(84+4*50);binary.writeUInt32LE(4,80);for(let i=0;i<4;i++)for(let k=0;k<9;k++)binary.writeFloatLE(tetra[i*9+k],84+i*50+12+k*4);
const fromAscii=defs.mesh_render.onFile('data:model/stl;base64,'+Buffer.from(ascii).toString('base64')),fromBinary=defs.mesh_render.onFile('data:model/stl;base64,'+binary.toString('base64'));assert.deepEqual(fromAscii,fromBinary);check(fromAscii);assert.equal(run('mesh_render',[],{},ctx,{data:{svg:fromAscii}})[1],fromAscii);assert.equal(run('mesh_render',[mature[1]],{},ctx,{data:{svg:fromAscii}})[1],mature[1]);assert.throws(()=>defs.mesh_render.onFile('data:model/stl;base64,'+Buffer.from('garbage').toString('base64')));
const badMesh={kind:'mesh',v:[NaN,0,0,0,1,0,1,0,0],tri:1,dims:[1,1,0]};assert.deepEqual(defs.mesh_render.compute([badMesh],defaults('mesh_render'),ctx),[H.EMPTY,null]);
for(const key of ['reaction_patterns','crystal_growth','mesh_render','drape','gravity']){
 const style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,phase:0,seed:11},ins=key==='mesh_render'?[undefined,style]:key==='gravity'?[motif,style]:[style],p=key==='drape'?{physicsMode:'Flag',clothDensity:16}:key==='gravity'?{physicsMode:'Rigid bodies',bodySource:'Motif copies',bodyCount:10,time:.6}:key==='reaction_patterns'?{steps:150}:{};run(key,ins,p);
}
for(const key of ['array','lens','view3d','drape','gravity']){
 const p={array:{layout:'Linear'},lens:{mode:'Bulge'},view3d:{deform:'None'},drape:{physicsMode:'Draped'},gravity:{physicsMode:'Falling grid'}}[key],ins=key==='drape'?[]:[shape],base=run(key,ins,p),noise={array:{columns:1,radius:3,yaw:88,motifSize:70},lens:{twist:710,falloff:.5},view3d:{bendAngle:350,bendRadius:2,bendAxis:'Vertical'},drape:{wind:100,phase:180,pull:true,clothDensity:8},gravity:{bodyGravity:0,time:0,bounce:90}}[key];assert.equal(hash(base),hash(run(key,ins,{...p,...noise})),'hidden new settings do not leak into '+key);
}
const free={paths:[rect(60,40,10,8)]},free0=run('gravity',[free],{physicsMode:'Rigid bodies',time:0,bodySpin:0,bodyGravity:100}),free1=run('gravity',[free],{physicsMode:'Rigid bodies',time:.2,bodySpin:0,bodyGravity:100});
const meanY=v=>v.paths[0].pts.reduce((n,q)=>n+q[1],0)/v.paths[0].pts.length;assert.ok(Math.abs(meanY(free1)-meanY(free0)-.5*100*.2*.2)<.3,'isolated body follows free fall');
assert.equal(hash(run('drape',[],{physicsMode:'Hanging',wind:0,clothGravity:0,phase:0})),hash(run('drape',[],{physicsMode:'Hanging',wind:0,clothGravity:0,phase:180})), 'no wind means phase has no force');
for(const key of ['reaction_patterns','crystal_growth','drape']){
 const p={reaction_patterns:{steps:300},crystal_growth:{},drape:{physicsMode:'Flag',clothDensity:16}}[key],manual={...p,...(key==='drape'?{phase:90}:{growth:25})},context={...ctx,frameIdx:1,frameCount:key==='drape'?4:5};assert.equal(hash(run(key,[],manual)),hash(run(key,[],{...p,motion:'Timeline'},context)),'timeline prefix '+key);
}
// Duplicate spine vertices must not erase endpoint tangents during extrapolation.
const duplicated={paths:[{pts:[[30,100],[30,100],[230,100],[230,100]],closed:false,layer:0}]};assert.equal(hash(run('path_bend',[shape,duplicated],{mode:'Actual length',start:50})),hash(run('path_bend',[shape,straight],{mode:'Actual length',start:50})));
const tinyStroke={paths:[{pts:[[100,100],[100.001,100.001]],closed:false,layer:0}]};assert.equal(run('view3d',[tinyStroke],{deform:'Twist'}).paths[0].pts.length,2,'short strokes survive deformation');
if(process.argv.includes('--browser-dir')){
 const dir=process.argv[process.argv.indexOf('--browser-dir')+1],app=fs.readFileSync('src/App.jsx','utf8'),code=app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export')),toSVG=Function('PENS',code+';return toSVG;')(H.PENS),files=['marbling','shape-packing','path-bend','seamless-tile','reaction-patterns','crystal-growth','mesh-render','array','lens','3d-view','drape','gravity'];
 const allDefs={...defs};for(const key of ['grid','superformula','lettering'])allDefs[key]=(await import('../src/defs/nodes/'+key+'.js')).default;
 const evaluate=(patch,context,override={})=>{const outputs={};for(const node of patch.root.nodes){const d=allDefs[node.type],ins=[];for(const e of patch.root.edges.filter(e=>e.to===node.id)){const v=outputs[e.from];ins[e.toPort]=Array.isArray(v)?v[e.fromPort]:v;}outputs[node.id]=d.compute(ins,{...node.params,...(node.id===patch.root.outputId?override:{})},context,node);}const out=outputs[patch.root.outputId];return Array.isArray(out)?out[0]:out;};
 const receipt=[];
 for(const name of files){const patch=JSON.parse(fs.readFileSync(dir+'/'+name+'.muusia.json')),v=evaluate(patch,patch.canvas);check(v);const actualSvg=fs.readFileSync(dir+'/'+name+'.svg','utf8');assert.ok(actualSvg.includes('width="'+patch.canvas.W+'mm"')&&actualSvg.includes('height="'+patch.canvas.H+'mm"'));const svgPaths=[...actualSvg.matchAll(/<path d="([^"]+)"/g)].map(m=>({closed:m[1].endsWith('Z'),pts:[...m[1].matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(q=>[+q[1],+q[2]])}));const ordered=[];for(const layer of [...new Set(v.paths.map(p=>p.layer))].sort((a,b)=>a-b))ordered.push(...v.paths.filter(p=>p.layer===layer));assert.equal(svgPaths.length,ordered.length,name+' SVG paths');for(let i=0;i<ordered.length;i++){assert.equal(svgPaths[i].closed,ordered[i].closed);assert.equal(svgPaths[i].pts.length,ordered[i].pts.length,name+' SVG points '+i);for(let j=0;j<ordered[i].pts.length;j++)for(let k=0;k<2;k++)assert.ok(Math.abs(svgPaths[i].pts[j][k]-ordered[i].pts[j][k])<=.005001,name+' SVG coordinate '+i+','+j);}assert.deepEqual([...actualSvg.matchAll(/<g [^>]+>/g)].map(m=>m[0]),[...toSVG(v,patch.canvas).matchAll(/<g [^>]+>/g)].map(m=>m[0]),name+' SVG pens');
  const gcode=fs.readFileSync(dir+'/'+name+'.gcode','utf8'),moves=gcode.split('\n').filter(l=>/^G[01] X/.test(l)).map(l=>l.match(/^G[01] X([\d.-]+) Y([\d.-]+)/).slice(1).map(Number));assert.deepEqual(moves.pop(),[0,0]);const expected=[];for(const layer of [...new Set(v.paths.map(p=>p.layer))].sort((a,b)=>a-b))for(const p of v.paths.filter(p=>p.layer===layer))expected.push(...p.pts,...(p.closed?[p.pts[0]]:[]));assert.equal(moves.length,expected.length,name+' actual G-code count');for(let i=0;i<moves.length;i++)for(let k=0;k<2;k++)assert.ok(Math.abs(moves[i][k]-expected[i][k])<=.005001,name+' actual G-code point '+i);
  receipt.push({name,paths:v.paths.length,points:v.paths.reduce((n,q)=>n+q.pts.length,0),gcodePoints:expected.length,svgSha256:createHash('sha256').update(fs.readFileSync(dir+'/'+name+'.svg')).digest('hex'),gcodeSha256:createHash('sha256').update(gcode).digest('hex')});
 }
 console.log('All 12 actual browser SVG and G-code exports match every ordered coordinate. Route off, origin 0, Flip Y off; default A servo profile, software only.');
 if(fs.existsSync(dir+'/drape-animation.zip')){
  const {unzipSync,strFromU8}=await import('fflate');
  for(const name of ['drape','gravity','reaction-patterns','crystal-growth']){const zip=unzipSync(fs.readFileSync(dir+'/'+name+'-animation.zip')),patch=JSON.parse(fs.readFileSync(dir+'/'+name+'.muusia.json'));assert.equal(Object.keys(zip).length,12);for(let i=0;i<12;i++){const context={...patch.canvas,frameIdx:i,frameCount:12},override=name==='gravity'?{bodyMotion:'Timeline'}:{motion:'Timeline'},v=evaluate(patch,context,override),file=Object.keys(zip).find(k=>k.endsWith('-f'+String(i).padStart(3,'0')+'.svg'));assert.ok(file);assert.equal(strFromU8(zip[file]),toSVG(v,context),'actual animation '+name+' frame '+i);}console.log(name+': all 12 actual SVG animation frames match');}
 }
 fs.writeFileSync(dir+'/export-verification.json',JSON.stringify({published:false,hardwareTested:false,routeOptimized:false,origin:[0,0],flipY:false,profile:'A servo default; canvas may exceed its work-area envelope; coordinate verification only',animationFrames:fs.existsSync(dir+'/drape-animation.zip')?48:0,exports:receipt},null,2)+'\n');
}
console.log(`PASS ${lab?'lab':'built-in'}: ${cases} cases across ${keys.length} nodes; legacy hashes, independent packing/bend/periodic-edge oracles, deterministic growth, mesh structure and bounded render/physics.`);
