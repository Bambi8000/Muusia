import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as H from '../src/defs/helpers.js';
import {withParameterVisibility} from '../src/defs/parameter-visibility.js';
const keys=['sdfcontours','image','glyphtone','weave_draft'],defs={},lab=process.argv.includes('--lab');
for(const k of keys)defs[k]=k==='weave_draft'&&lab?Function(...Object.keys(H),'return '+fs.readFileSync('nodes-lab/weave_draft.plotternode.js','utf8'))(...Object.values(H)):(await import('../src/defs/nodes/'+k+'.js')).default;
const defaults=k=>Object.fromEntries(defs[k].params.map(q=>[q.key,structuredClone(q.def)]));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),ctx={W:120,H:90};let cases=0;
function run(k,over={},ins=[],node={},c=ctx){const p={...defaults(k),...over},before=hash({ins,p,node,c}),raw=defs[k].compute(ins,p,c,node),r=Array.isArray(raw)?raw[0]:raw;assert.equal(hash({ins,p,node,c}),before,k+' mutates input');assert.ok(r?.paths);assert.ok(r.paths.reduce((n,q)=>n+q.pts.length,0)<=120000,k+' work budget');for(const q of r.paths){assert.ok(q.pts.length>=(q.closed?3:2));assert.ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12);for(const [x,y]of q.pts){assert.ok(Number.isFinite(x)&&Number.isFinite(y));if(!p.keep){assert.ok(x>=-1e-6&&x<=c.W+1e-6,k+' X bounds');assert.ok(y>=-1e-6&&y<=c.H+1e-6,k+' Y bounds');}}}cases++;return r;}
const circle=(x,y,r,layer=0)=>({pts:Array.from({length:100},(_,i)=>[x+r*Math.cos(i*Math.PI/50),y+r*Math.sin(i*Math.PI/50)]),closed:true,layer});
const pair={paths:[circle(35,40,10),circle(57,40,10)]},ring={paths:[circle(45,45,24),circle(45,45,10)]};
// Compare unchanged modes with the actual last published definitions.
for(const k of ['sdfcontours','glyphtone','image']){
 const raw=execFileSync('git',['show','755a458:src/defs/nodes/'+k+'.js'],{encoding:'utf8'}).replace(/^import[^;]+;\s*/,'').replace('export default','');
 const old=Function(...Object.keys(H),'return ('+raw.replace(/;\s*$/,'')+')')(...Object.values(H));
 const op=Object.fromEntries(old.params.map(q=>[q.key,q.def])),data={data:{img:{w:20,h:20,g:Array.from({length:400},(_,i)=>(i%20)/19)}}};
 const modes=k==='image'?old.params.find(q=>q.key==='mode').options:[null];
 for(const mode of modes){const ins=k==='sdfcontours'?[pair]:[],p={...op,...(mode?{mode}:{} )};assert.equal(hash(defs[k].compute(ins,p,ctx,data)),hash(old.compute(ins,p,ctx,data)),k+' legacy '+mode);}
}
for(const k of keys){assert.equal(new Set(defs[k].params.map(q=>q.key)).size,defs[k].params.length);for(const q of defs[k].params)if(q.type==='select')assert.ok(q.options.includes(q.def));}
const soft={mode:'Soft union',count:1,keep:false,minlen:0};
assert.equal(run('sdfcontours',{...soft,blend:0},[pair]).paths.length,2);
assert.equal(run('sdfcontours',{...soft,blend:5},[pair]).paths.length,1,'blend joins independent of offset');
const pip=(pt,poly)=>{let b=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],d=poly[j];if((a[1]>pt[1])!==(d[1]>pt[1])&&pt[0]<(d[0]-a[0])*(pt[1]-a[1])/(d[1]-a[1])+a[0])b=!b;}return b;};
const inside=(r,p)=>r.paths.filter(q=>q.closed&&pip(p,q.pts)).length%2===1;
for(const blend of [0,2,4]){const r=run('sdfcontours',{...soft,blend},[ring]);assert.equal(r.paths.length,2,'counter survives');assert.ok(!inside(r,[45,45]));assert.ok(inside(r,[61,45]));}
assert.equal(run('sdfcontours',{...soft,fillRule:'Union'},[ring]).paths.length,1,'union intentionally fills nested outlines');
const bbox=r=>{const a=r.paths.flatMap(q=>q.pts);return [Math.min(...a.map(p=>p[0])),Math.max(...a.map(p=>p[0]))];};
const a=run('sdfcontours',{...soft,softOffset:0},[pair]),b=run('sdfcontours',{...soft,softOffset:4},[pair]);assert.ok(bbox(b)[0]<bbox(a)[0]&&bbox(b)[1]>bbox(a)[1],'offset grows independently');
const stroke={paths:[{pts:[[25,40],[90,40]],closed:false,layer:0}]};
for(const interpretation of ['Closed fills','Stroked paths'])for(const softStroke of [1,5])assert.ok(run('sdfcontours',{...soft,interpretation,softStroke,blend:1},[stroke]).paths.length);
assert.equal(run('sdfcontours',soft,[H.EMPTY]).paths.length,0);
assert.equal(hash(run('sdfcontours',soft,[pair])),hash(run('sdfcontours',soft,[pair])));
for(const p of [{blend:0,softOffset:-2},{blend:10,count:6,inside:true},{softCell:.2,count:8,blend:4}])run('sdfcontours',{...soft,...p},[ring]);
const levels=run('sdfcontours',{...soft,softOffset:-3,count:3,inside:true},[ring]);assert.equal(new Set(levels.paths.map(q=>JSON.stringify(q.pts))).size,levels.paths.length,'no duplicated negative levels');
// Distance transform checked independently with brute-force Euclidean distances.
const mask=Uint8Array.from([0,0,1,0,0,0,0,0,0,0,1,0]);const distances=defs.sdfcontours._softDistance(mask,4,3,1);
for(let y=0;y<3;y++)for(let x=0;x<4;x++)assert.equal(distances[y*4+x],Math.min((x-2)**2+y*y,(x-2)**2+(y-2)**2));
const uniform=d=>({data:{img:{w:32,h:32,g:Array(1024).fill(d)}}}),ramp={data:{img:{w:64,h:32,g:Array.from({length:2048},(_,i)=>(i%64)/63)}}};
for(const ditherScreen of defs.image.params.find(q=>q.key==='ditherScreen').options){
 const p={mode:'Vector dither',ditherScreen,cell:2,strength:1,cutoff:0,margin:10};
 assert.equal(run('image',p,[],uniform(0)).paths.length,0);const black=run('image',p,[],uniform(1));assert.ok(black.paths.length);
 const half=run('image',p,[],uniform(.5));assert.ok(Math.abs(half.paths.length/black.paths.length-.5)<.03,'50% dither coverage '+ditherScreen);
 assert.equal(hash(run('image',p,[],ramp)),hash(run('image',p,[],ramp)),'deterministic '+ditherScreen);
 for(const ditherMark of ['Circle','Short line','Outlined cell'])run('image',{...p,ditherMark,ditherAngle:45},[],ramp);
 const noSource=run('image',{...p,source:'Drawing (wired)'},[undefined,H.EMPTY],ramp);assert.equal(noSource.paths.length,0,'empty drawing never falls back');
 assert.ok(run('image',{...p,source:'Drawing (wired)',drawingFill:true},[undefined,pair]).paths.length);
 run('image',{...p,cell:.1,ditherSize:80,margin:0},[],uniform(1),{W:594,H:420});
}
const dp={mode:'Vector dither',cell:2,strength:1,cutoff:0,margin:10};
assert.equal(hash(run('image',{...dp,seed:1},[],ramp)),hash(run('image',{...dp,seed:2},[],ramp)),'ordered screen ignores seed');
assert.notEqual(hash(run('image',{...dp,ditherScreen:'Dispersed 16×16',seed:1},[],ramp)),hash(run('image',{...dp,ditherScreen:'Dispersed 16×16',seed:2},[],ramp)));
const motif={paths:[{pts:[[-2,-2],[2,2]],closed:false,layer:1},{pts:[[-2,2],[2,-2]],closed:false,layer:7}]};
const mp={motifMode:'Wired motif',source:'Image',cell:6,jitter:0,cutoff:0};
for(const motifTone of ['Size','Occupancy'])for(const motifOrientation of ['Fixed','Tone gradient'])for(const motifPens of ['Cell pen','Keep motif pens']){
 const p={...mp,motifTone,motifOrientation,motifPens},r=run('glyphtone',p,[undefined,motif],ramp);assert.ok(r.paths.length);assert.equal(r.paths.length%2,0);const groups=new Map();for(const q of r.paths){if(!groups.has(q.group))groups.set(q.group,[]);groups.get(q.group).push(q);}assert.ok([...groups.values()].every(a=>a.length===2),'compound motif kept intact');if(motifPens==='Keep motif pens')assert.deepEqual([...new Set(r.paths.map(q=>q.layer))].sort((a,b)=>a-b),[1,7]);
 assert.equal(hash(r),hash(run('glyphtone',p,[undefined,motif],ramp)));
}
assert.equal(run('glyphtone',mp,[undefined,H.EMPTY],ramp).paths.length,0);assert.equal(run('glyphtone',mp,[undefined,motif],uniform(0)).paths.length,0);
const geom=r=>r.paths.map(q=>({pts:q.pts,closed:q.closed}));assert.deepEqual(geom(run('glyphtone',{...mp,motifPens:'Cell pen'},[undefined,motif],ramp)),geom(run('glyphtone',{...mp,motifPens:'Keep motif pens'},[undefined,motif],ramp)),'pens do not alter geometry');
const dense={paths:Array.from({length:150},(_,i)=>circle(50,50,5+i*.01,i%12))};run('glyphtone',{...mp,cell:2},[undefined,dense],uniform(.8),{W:594,H:420});
// An independent crossing oracle checks actual line coverage, not just the matrix.
const covers=(q,x,y)=>{const [a,b]=q.pts;return Math.abs(a[0]-b[0])<1e-8?Math.abs(x-a[0])<1e-8&&y>=a[1]-1e-8&&y<=b[1]+1e-8:Math.abs(y-a[1])<1e-8&&x>=a[0]-1e-8&&x<=b[0]+1e-8;};
for(const pattern of ['Plain','2/2 Twill','2/2 Basket','5-end Satin','Custom']){
 const p={pattern,warp:12,weft:12,tracks:1,pitch:5,clearance:.5,draft:'100|010|001',warpColours:'1',weftColours:'2'},r=run('weave_draft',p);const x0=30,y0=15;
 for(let row=0;row<12;row++)for(let col=0;col<12;col++){
  const expected=pattern==='Plain'?(row+col)%2===0:pattern==='2/2 Twill'?((col-row+40)%4)<2:pattern==='2/2 Basket'?(Math.floor(row/2)+Math.floor(col/2))%2===0:pattern==='5-end Satin'?(col-row*2+40)%5===0:row%3===col%3;
  const hits=r.paths.filter(q=>covers(q,x0+(col+.5)*5,y0+(row+.5)*5));assert.equal(hits.length,1,pattern+' exactly one crossing');assert.equal(hits[0].layer,expected?0:1,pattern+' over/under agrees');
 }
 assert.equal(hash(r),hash(run('weave_draft',p)));
}
const four=run('weave_draft',{colours:4,warpColours:'1:3,2:2,3:3,4:2',weftColours:'4:3,3:2,2:3,1:2'});assert.equal(new Set(four.paths.map(q=>q.layer)).size,4);
const parse=defs.weave_draft._sequence.bind(defs.weave_draft);assert.deepEqual(parse('1,2,3','Point',3),[0,1,2,1]);assert.deepEqual(parse('1,2,3','Mirror',3),[0,1,2,2,1,0]);
for(const over of [{pattern:'Custom',draft:'10|1'},{warpColours:'5:3'},{weftColours:'1:999'}])assert.equal(run('weave_draft',over).paths.length,0);
for(const sizing of ['Fit to margin','Keep pitch (crop)'])for(const tracks of [1,7])run('weave_draft',{sizing,tracks,warp:160,weft:160,pitch:8,colours:4},[],{},{W:594,H:420});
for(const k of keys){const visible=withParameterVisibility(defs[k]);for(const q of visible.params){if(q.showIf)assert.doesNotThrow(()=>q.showIf(defaults(k)));}}
console.log('Design Minis: '+cases+' geometry cases; published-mode equality, field distance oracle, counters, tonal coverage, whole motifs, crossing oracle, colour sequences and dense-sheet bounds passed.');
