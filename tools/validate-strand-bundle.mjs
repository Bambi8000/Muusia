import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as H from '../src/defs/helpers.js';
const lab=process.argv.includes('--lab');
const D=lab?Function(...Object.keys(H),'return '+fs.readFileSync('nodes-lab/strand_bundle.plotternode.js','utf8'))(...Object.values(H)):(await import('../src/defs/nodes/strand_bundle.js')).default;
const defaults=Object.fromEntries(D.params.map(p=>[p.key,p.def])),ctx={W:210,H:297};let checks=0;
const run=(p={},c=ctx,ins=[])=>D.compute(ins,{...defaults,...p},c);
const settings=p=>D._frame({...defaults,...p},ctx);
const pts=o=>o[0].paths.reduce((s,p)=>s+p.pts.length,0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function valid(o,c=ctx,m=15,nib=.5){assert.equal(o.length,3);assert.ok(o[0].paths.length);assert.ok(pts(o)<=110000);assert.ok(o.slice(1).every(Number.isFinite));assert.ok(o[1]<=nib+1e-7);for(const p of o[0].paths){assert.ok(p.pts.length>=2);assert.equal(p.closed,false);assert.ok(Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12);for(const [x,y] of p.pts){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=m+nib/2-1e-7&&x<=c.W-m-nib/2+1e-7&&y>=m+nib/2-1e-7&&y<=c.H-m-nib/2+1e-7);}}}
function test(n,f){f();checks++;console.log('ok '+n);}
const straight={stem:'Straight',angle:0,style:'Fan',tipVar:0,length:120,spread:50};
test('four thread styles work in both continuous behaviors',()=>{for(const behavior of ['Fray end','Split and return'])for(const style of ['Fan','Flow','Wander','Tangle'])valid(run({behavior,style}));});
test('seed reconstructs identical geometry and changes chaotic strands',()=>{const a=run(),b=run({seed:18});assert.deepEqual(a,run());assert.notDeepEqual(a,b);});
test('nib and overlap determine analytical solid-core pitch and width',()=>{for(const nib of [.2,.5,1,2])for(const overlap of [0,40,80]){const p={...straight,nib,overlap,width:12},f=settings(p),o=run(p);valid(o,ctx,15,nib);assert.equal(o[0].paths.length,Math.ceil((12-nib)/(nib*(1-overlap/100)))+1);near(o[1],f.pitch);near(o[2],12);assert.ok(f.pitch<=nib*(1-overlap/100)+1e-9);}});
test('all packed stem paths are exact translated copies at pitch <= nib',()=>{const o=run({...straight,width:10}),ps=o[0].paths,n=settings({...straight,width:10}).steps;for(let i=1;i<ps.length;i++)for(let k=0;k<=Math.floor(n*.48);k++){near(ps[i].pts[k][0],ps[0].pts[k][0]);near(ps[i].pts[k][1]-ps[i-1].pts[k][1],o[1]);}});
test('tidy Fan and Flow retain ordered non-crossing graphs, including a wavy stem',()=>{for(const style of ['Fan','Flow'])for(const stem of ['Straight','Sine','Meander']){const o=run({...straight,style,stem,bend:20});for(let i=1;i<o[0].paths.length;i++)for(let k=0;k<o[0].paths[0].pts.length;k++){near(o[0].paths[i].pts[k][0],o[0].paths[i-1].pts[k][0]);assert.ok(o[0].paths[i].pts[k][1]>o[0].paths[i-1].pts[k][1]);}}});
test('return mode rejoins every strand exactly and keeps the final stem packed',()=>{const p={...straight,style:'Tangle',behavior:'Split and return',release:30,rejoin:80,stem:'Sine',bend:17};const a=run(p),closed=run({...p,spread:0});assert.equal(a[0].paths.length,closed[0].paths.length);const dx=a[0].paths[0].pts[0][0]-closed[0].paths[0].pts[0][0],dy=a[0].paths[0].pts[0][1]-closed[0].paths[0].pts[0][1];for(let i=0;i<a[0].paths.length;i++){const s=a[0].paths[i].pts,t=closed[0].paths[i].pts;assert.equal(s.length,t.length);for(let k=0;k<s.length;k++)if(t[k][0]-t[0][0]>=120*.8-1e-7){near(s[k][0]-t[k][0],dx);near(s[k][1]-t[k][1],dy);}}});
test('release and rejoin stations have zero lateral displacement at every exact endpoint',()=>{const p={...straight,behavior:'Split and return',release:30,rejoin:80},f=settings(p),o=run(p),a=o[0].paths[0].pts;for(const t of [0,.3,.8,1]){const x=a[0][0]+120*t;const j=a.findIndex(q=>Math.abs(q[0]-x)<1e-7);assert.ok(j>=0);for(let i=1;i<o[0].paths.length;i++)near(o[0].paths[i].pts[j][1]-o[0].paths[i-1].pts[j][1],f.pitch);}});
test('Fan opens to the analytical requested spread at the free tip',()=>{const o=run({...straight,width:12,spread:50}),a=o[0].paths[0].pts.at(-1),b=o[0].paths.at(-1).pts.at(-1);near(b[1]-a[1],11.5+50);});
test('tip variation changes free tip lengths and never shortens the solid core',()=>{const o=run({...straight,tipVar:60}),starts=o[0].paths.map(p=>p.pts[0][0]);const lens=o[0].paths.map((p,i)=>p.pts.at(-1)[0]-starts[i]);assert.ok(new Set(lens.map(v=>v.toFixed(5))).size>10);assert.ok(Math.min(...lens)>120*.48);});
test('Wander zero chaos matches the Fan construction',()=>assert.deepEqual(run({...straight,style:'Wander',chaos:0}),run(straight)));
test('Tangle actually contains backwards loops in the loose area',()=>{const o=run({...straight,style:'Tangle',spread:180,chaos:100,threadCycles:6});assert.ok(o[0].paths.some(p=>p.pts.some((v,k)=>k&&v[0]<p.pts[k-1][0]-.01)));});
test('stem curvature is independent of the strand spread',()=>{const a=run({...straight,spread:0,stem:'Sine',bend:20}),b=run({...straight,spread:0,stem:'Straight'});assert.notDeepEqual(a,b);const p=a[0].paths[0].pts;assert.ok(Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]))>30);});
test('rotation keeps centreline lengths and physical pitch',()=>{const a=run({...straight,angle:0}),b=run({...straight,angle:90});near(a[1],b[1]);for(let i=0;i<a[0].paths.length;i++)near(H.pathLength(a[0].paths[i].pts,false),H.pathLength(b[0].paths[i].pts,false));});
test('multi-bundle layouts preserve every full strand in every cell',()=>{for(const layout of ['Columns','Rows']){const p={...straight,count:6,layout},o=run(p);valid(o);assert.equal(o[0].paths.length,settings(p).lines*6);assert.ok(o[1]<=.3);}});
test('fitting only shrinks the whole bundle, retaining a nib radius inside each margin',()=>{const p={style:'Tangle',spread:180,length:400,bend:80,margin:10,nib:.5},c={W:80,H:100},o=run(p,c);valid(o,c,10);assert.ok(o[1]<settings(p).pitch);assert.ok(o[2]<12);});
test('dense requests narrow all cores uniformly rather than truncate later strands/bundles',()=>{const p={behavior:'Split and return',nib:.05,overlap:80,width:60,count:6,detail:320,style:'Tangle',threadCycles:6},f=settings(p),o=run(p);valid(o,ctx,15,.05);assert.ok(f.span<59.95);assert.equal(o[0].paths.length,f.lines*6);assert.ok(pts(o)<=110000&&pts(o)>50000);for(let i=0;i<6;i++)assert.equal(o[0].paths.slice(i*f.lines,(i+1)*f.lines).length,f.lines);});
test('a core narrower than the selected nib remains one continuous strand',()=>{const o=run({...straight,width:1,nib:3});valid(o,ctx,15,3);assert.equal(o[0].paths.length,1);near(o[1],0);near(o[2],3);});
test('hidden controls have no effect on inactive modes',()=>{for(const behavior of ['Fray end','Split and return'])for(const style of ['Fan','Flow','Wander','Tangle'])for(const stem of ['Straight','Sine']){const p={...defaults,behavior,style,stem},a=D.compute([],p,ctx);for(const q of D.params)if(q.showIf&&!q.showIf(p)){assert.deepEqual(D.compute([],{...p,[q.key]:q.max??'Rows'},ctx),a,q.key);}}});
test('invalid paper and numeric wires remain bounded and deterministic',()=>{for(const c of [{W:NaN,H:297},{W:20,H:200},{W:200,H:20}])assert.deepEqual(run({},c),[H.EMPTY,0,0]);const p={count:999,nib:NaN,angle:Infinity,spread:1e10,width:Infinity,release:999,rejoin:-999,chaos:999,layer:99,detail:1e9};valid(run(p));assert.deepEqual(run(p),run(p));});
test('Style processing preserves original parameters and valid pen indices',()=>{const p={...defaults,layer:7},before=JSON.stringify(p);const a=D.compute([],p,ctx),b=D.compute([{kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,phase:0,seed:1}],p,ctx);assert.ok(b[0].paths.length>a[0].paths.length);assert.ok(b[0].paths.every(p=>p.layer===7));assert.equal(JSON.stringify(p),before);});
test('length above 400 is real geometry before fitting, through 2000 mm',()=>{
  assert.equal(D.params.find(p=>p.key==='length').max,2000);
  for(const length of [400,403,650,1189,2000]){
    const o=run({...straight,spread:0,length}, {W:2500,H:500});
    near(o[0].paths[0].pts.at(-1)[0]-o[0].paths[0].pts[0][0],length);
    near(o[1],settings(straight).pitch);
  }
  assert.notDeepEqual(run({...straight,length:403},{W:1000,H:500}),run({...straight,length:400},{W:1000,H:500}));
});
test('zero cuts preserve the published default geometry byte for byte',()=>{
  const hash=createHash('sha256').update(JSON.stringify(run())).digest('hex');
  assert.equal(hash,'1c6c40b573bfa38801512e85b41f0375b2e1fad5fbe3a395bb2056a4d3cbe95c');
  assert.deepEqual(run({startCut:0,endCut:0}),run({startCut:undefined,endCut:undefined}));
});
test('independent signed cuts place every straight packed endpoint on its analytical plane',()=>{
  for(const startCut of [-60,0,35])for(const endCut of [-45,0,65]){
    const p={...straight,behavior:'Split and return',width:20,length:180,rejoin:70,spread:0,startCut,endCut},o=run(p,{W:500,H:500});
    const roots=o[0].paths.map(p=>p.pts[0]),tips=o[0].paths.map(p=>p.pts.at(-1));
    for(const [ends,angle] of [[roots,startCut],[tips,endCut]]){
      const slope=Math.tan(angle*Math.PI/180),c=ends[0][0]-slope*ends[0][1];
      for(const v of ends)near(v[0]-slope*v[1],c);
    }
    near(o[1],settings(p).pitch);near(o[2],20);
    const base=run({...p,startCut:0,endCut:0},{W:500,H:500});
    for(let i=0;i<o[0].paths.length;i++){
      assert.ok(H.pathLength(o[0].paths[i].pts,false)<=H.pathLength(base[0].paths[i].pts,false)+1e-7);
      if(!startCut)near(roots[i][0]-roots[0][0],0);
      if(!endCut)near(tips[i][0]-tips[0][0],0);
    }
  }
});
test('free Fan tips also meet an exact tilted end plane',()=>{
  for(const endCut of [-25,25]){
    const o=run({...straight,length:200,spread:60,endCut},{W:500,H:500});
    const ends=o[0].paths.map(p=>p.pts.at(-1)),slope=Math.tan(endCut*Math.PI/180),c=ends[0][0]-slope*ends[0][1];
    for(const v of ends)near(v[0]-slope*v[1],c);
  }
});
test('cuts preserve one connected stroke and protected release/rejoin across all styles and stems',()=>{
  for(const behavior of ['Fray end','Split and return'])for(const style of ['Fan','Flow','Wander','Tangle'])for(const stem of ['Straight','Sine','Meander']){
    const p={behavior,style,stem,startCut:65,endCut:-70,release:15,rejoin:95,bend:50,tipVar:65,width:30,spread:180,length:150};
    const o=run(p);valid(o);assert.equal(o[0].paths.length,settings(p).lines);
    for(const path of o[0].paths)for(let k=1;k<path.pts.length;k++)assert.ok(Math.hypot(path.pts[k][0]-path.pts[k-1][0],path.pts[k][1]-path.pts[k-1][1])>1e-10,'duplicate cut point');
  }
});
test('clamped fractional rejoin stations still receive the end cut',()=>{
  const p={...straight,behavior:'Split and return',length:180,release:20,rejoin:25,endCut:40};
  const o=run(p,{W:500,H:500}),slope=Math.tan(40*Math.PI/180),ends=o[0].paths.map(p=>p.pts.at(-1)),c=ends[0][0]-slope*ends[0][1];
  for(const v of ends)near(v[0]-slope*v[1],c);
});
test('steep cuts retain every narrow, short and dense bundle within the same physical budget',()=>{
  for(const p of [
    {length:30,width:60,startCut:75,endCut:-75,behavior:'Split and return',release:10,rejoin:95},
    {width:1,nib:3,startCut:-75,endCut:75},
    {nib:.05,overlap:80,width:60,count:6,detail:320,startCut:75,endCut:-75,length:2000,style:'Tangle',behavior:'Split and return'}
  ]){const o=run(p);valid(o,ctx,15,p.nib??.5);assert.equal(o[0].paths.length,settings(p).lines*(p.count??1));assert.deepEqual(o,run(p));}
});
const coloured=(o,pen=2)=>o[0].paths.flatMap((p,i)=>p.layer===pen?[i]:[]);
const geometry=o=>o[0].paths.map(({layer,...path})=>path);
test('one explicit strand is recoloured without duplicated paths or geometric changes',()=>{
  const base=run(),o=run({colourMode:'By number',strandNumbers:'20',accentPen:2});valid(o);
  assert.deepEqual(coloured(o),[19]);assert.deepEqual(geometry(o),geometry(base));assert.deepEqual(o.slice(1),base.slice(1));
});
test('lists, inclusive and reversed ranges form a unique bounded selection',()=>{
  const o=run({colourMode:'By number',strandNumbers:'1, 5; 10 - 12  12  16–14 0 -2 bad 3.5 99999',accentPen:5});
  assert.deepEqual(coloured(o,5),[0,4,9,10,11,13,14,15]);
  const all=run({colourMode:'By number',strandNumbers:'1-999999999',accentPen:11});
  assert.ok(all[0].paths.every(p=>p.layer===11));
  assert.deepEqual(coloured(run({colourMode:'By number',strandNumbers:'bad 0 -1 3.5 1e3'})),[]);
});
test('spaced selection uses exact one-based first, count and interval without wrapping',()=>{
  const p={colourMode:'Spaced',colourFirst:3,colourCount:4,colourStep:7};assert.deepEqual(coloured(run(p)),[2,9,16,23]);
  assert.deepEqual(coloured(run({...p,colourFirst:999})),[]);
  const o=run({...p,colourFirst:1,colourCount:1200,colourStep:1});assert.equal(coloured(o).length,o[0].paths.length);
});
test('random colour selection is unique, repeatable, nested by count and independent of shape seed',()=>{
  const p={colourMode:'Random',colourCount:7,colourSeed:25},a=run(p);assert.equal(coloured(a).length,7);assert.deepEqual(a,run(p));
  assert.notDeepEqual(coloured(a),coloured(run({...p,colourSeed:26})));
  assert.deepEqual(coloured(a),coloured(run({...p,seed:2000,style:'Tangle',startCut:40,endCut:-35})));
  const more=new Set(coloured(run({...p,colourCount:12})));for(const i of coloured(a))assert.ok(more.has(i));
  assert.deepEqual(geometry(a),geometry(run()));
});
test('each bundle receives the same local strand numbers, including packed return and cuts',()=>{
  const p={colourMode:'By number',strandNumbers:'2, 7-9',count:6,behavior:'Split and return',startCut:50,endCut:-45,style:'Tangle'};
  const o=run(p),base=run({...p,colourMode:'Off'}),n=settings(p).lines;valid(o);assert.deepEqual(geometry(o),geometry(base));
  for(let b=0;b<6;b++)assert.deepEqual(coloured([{paths:o[0].paths.slice(b*n,(b+1)*n)}]),[1,6,7,8]);
});
test('colour controls are inactive and hidden outside their selection mode',()=>{
  for(const colourMode of ['Off','By number','Spaced','Random']){
    const p={...defaults,colourMode},a=D.compute([],p,ctx);
    for(const q of D.params)if(q.showIf&&!q.showIf(p))assert.deepEqual(D.compute([],{...p,[q.key]:q.type==='text'?'2-30':q.max??'Rows'},ctx),a,q.key);
  }
});
test('colouring replaces the base pen and survives Style without adding duplicate full strokes',()=>{
  const p={colourMode:'By number',strandNumbers:'2, 5-6',layer:7,accentPen:3},o=run(p);
  assert.deepEqual(coloured(o,3),[1,4,5]);assert.ok(o[0].paths.every(p=>p.layer===3||p.layer===7));
  assert.deepEqual(run({...p,accentPen:7}),run({layer:7}));
  const style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,phase:0,seed:1},d=run(p,ctx,[style]);
  assert.ok(d[0].paths.some(p=>p.layer===3)&&d[0].paths.some(p=>p.layer===7));
  const g=run({...p,colourMode:'Off'},ctx,[style]);assert.deepEqual(geometry(d),geometry(g));
});
test('colour selection handles single-strand, dense and invalid numeric cases within the point budget',()=>{
  for(const p of [{width:1,nib:3,colourMode:'Random',colourCount:1200},{nib:.05,overlap:80,width:60,count:6,detail:320,colourMode:'Random',colourCount:1200,accentPen:999},{colourMode:'Spaced',colourFirst:NaN,colourCount:Infinity,colourStep:-999,accentPen:NaN}]){
    const o=run(p);valid(o,ctx,15,p.nib??.5);assert.deepEqual(geometry(o),geometry(run({...p,colourMode:'Off'})));
  }
});
const frame3=p=>D._frame({...defaults,dimension:'3D',...p},ctx);
const raw3=p=>D._bundle3D(frame3(p),0);
test('3D creates noncoplanar geometry and free tips in every radial direction',()=>{
  const p={...straight,dimension:'3D',length:150,width:12,spread:80},f=frame3(p),b=raw3(p),ends=b.map(p=>p.pts.at(-1));
  assert.ok(ends.some(p=>p[1]>30)&&ends.some(p=>p[1]<-30)&&ends.some(p=>p[2]>30)&&ends.some(p=>p[2]<-30));
  const a=b[0].pts[0],q=b[Math.floor(f.lines/4)].pts[0],r=b[Math.floor(f.lines/2)].pts[0],t=ends[0];
  const v=q.map((x,k)=>x-a[k]),w=r.map((x,k)=>x-a[k]),z=t.map((x,k)=>x-a[k]);
  assert.ok(Math.abs((v[1]*w[2]-v[2]*w[1])*z[0]+(v[2]*w[0]-v[0]*w[2])*z[1]+(v[0]*w[1]-v[1]*w[0])*z[2])>100);
});
test('3D cylindrical core respects nib pitch around its full circumference',()=>{
  for(const nib of [.2,.5,1])for(const overlap of [0,40,80]){
    const f=frame3({nib,overlap,width:12});near(f.pitch,Math.PI*f.span/f.lines);assert.ok(f.pitch<=nib*(1-overlap/100)+1e-9);
    assert.ok(f.lines>=Math.ceil(Math.PI*(12-nib)/(nib*(1-overlap/100))));
  }
});
test('3D projects every style, behavior and camera to bounded XY-only paths',()=>{
  for(const behavior of ['Fray end','Split and return'])for(const style of ['Fan','Flow','Wander','Tangle'])for(const [viewAz,viewEl] of [[0,0],[70,20],[90,90],[-180,-90]]){
    const o=run({dimension:'3D',behavior,style,viewAz,viewEl,startCut:45,endCut:-30});valid(o);
    assert.ok(o[0].paths.every(p=>p.pts.every(v=>v.length===2)),'no machine-Z components');
  }
});
test('3D return rejoins the same complete cylindrical core in Y and Z',()=>{
  for(const style of ['Fan','Flow','Wander','Tangle']){
    const p={behavior:'Split and return',style,stem:'Meander',release:30,rejoin:80,tipVar:0};
    const a=raw3(p),b=raw3({...p,spread:0});
    for(let i=0;i<a.length;i++)for(let k=0;k<a[i].pts.length;k++){
      const x=b[i].pts[k][0];if(x<=200*.3+1e-8||x>=200*.8-1e-8)for(let j=0;j<3;j++)near(a[i].pts[k][j],b[i].pts[k][j]);
    }
  }
});
test('3D own-axis roll rotates a fixed object without changing zoom or framing centre',()=>{
  const p={dimension:'3D',stem:'Straight',style:'Wander',tipVar:0,angle:0,viewAz:70,viewEl:20};
  const f=frame3(p),raw=raw3(p),o0=D._project3D(structuredClone(raw),f,0),f180={...f,axisRotation:Math.PI},o180=D._project3D(structuredClone(raw),f180,0);
  near(o0.fit,o180.fit);const xs=raw.flatMap(p=>p.pts.map(v=>v[0])),mid=(Math.min(...xs)+Math.max(...xs))/2;
  for(let i=0;i<raw.length;i++)for(const k of [0,Math.floor(raw[i].pts.length/2),raw[i].pts.length-1]){
    const x=raw[i].pts[k][0]-mid;
    near(o0.paths[i].pts[k][0]+o180.paths[i].pts[k][0],2*(ctx.W/2+Math.sin(f.viewAz)*x*o0.fit));
    near(o0.paths[i].pts[k][1]+o180.paths[i].pts[k][1],2*(ctx.H/2+Math.sin(f.viewEl)*Math.cos(f.viewAz)*x*o0.fit));
  }
  assert.notDeepEqual(o0.paths,o180.paths);
  for(const axisRotation of [0,45,90,180,270,360])near(D._project3D(structuredClone(raw),{...f,axisRotation:axisRotation*Math.PI/180},0).fit,o0.fit);
});
test('a full 3D revolution closes exactly within numerical precision and camera changes the projected view',()=>{
  const p={dimension:'3D',behavior:'Split and return',axisRotation:0},a=run(p),b=run({...p,axisRotation:360});
  assert.equal(a[0].paths.length,b[0].paths.length);for(let i=0;i<a[0].paths.length;i++)for(let k=0;k<a[0].paths[i].pts.length;k++)for(let j=0;j<2;j++)near(a[0].paths[i].pts[k][j],b[0].paths[i].pts[k][j]);
  assert.notDeepEqual(a,run({...p,axisRotation:45}));assert.notDeepEqual(a,run({...p,viewAz:25}));assert.notDeepEqual(a,run({...p,viewEl:-35}));
});
test('3D start and end cuts trim XYZ polylines on exact object-space planes',()=>{
  const f=frame3({...straight,behavior:'Split and return',length:400,width:20,release:30,rejoin:70,startCut:-50,endCut:55}),b=D._bundle3D(f,0);
  D._cutEnds(b,f.startCut,f.endCut);
  for(const [start,angle] of [[true,f.startCut],[false,f.endCut]]){const endpoints=b.map(p=>start?p.pts[0]:p.pts.at(-1)),s=Math.tan(angle),c=endpoints[0][0]-s*endpoints[0][1];for(const v of endpoints){near(v[0]-s*v[1],c);assert.equal(v.length,3);}}
});
test('3D preserves colour identities, styles, all bundles and the dense point budget',()=>{
  for(const p of [{count:6,layout:'Rows',startCut:75,endCut:-75},{count:6,nib:.05,overlap:80,width:60,detail:320,length:2000,style:'Tangle'}]){
    const args={...p,dimension:'3D',colourMode:'By number',strandNumbers:'2, 7',accentPen:5},o=run(args);valid(o,ctx,15,p.nib??.5);
    assert.deepEqual(geometry(o),geometry(run({...args,colourMode:'Off'})));assert.equal(coloured(o,5).length,2*p.count);
    assert.equal(o[0].paths.length,frame3(p).lines*p.count);
  }
  const p={dimension:'3D',colourMode:'By number',strandNumbers:'1',accentPen:5},style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,phase:0,seed:1};
  const o=run(p,ctx,[style]);assert.ok(o[0].paths.some(p=>p.layer===5)&&o[0].paths.some(p=>p.layer===0));assert.ok(o[0].paths.every(p=>p.pts.every(v=>v.length===2)));
});
test('3D end-on collapsed strands become small XY end marks within physical margins',()=>{
  const p={dimension:'3D',stem:'Straight',spread:0,style:'Fan',viewAz:0,viewEl:0,angle:0},o=run(p);valid(o);
  for(const path of o[0].paths){assert.equal(path.pts.length,2);assert.ok(H.pathLength(path.pts,false)>.01);}
});
test('3D ignores inactive controls and clamps nonfinite camera wires safely',()=>{
  for(const dimension of ['2D','3D'])for(const style of ['Fan','Tangle']){
    const p={...defaults,dimension,style},a=D.compute([],p,ctx);for(const q of D.params)if(q.showIf&&!q.showIf(p))assert.deepEqual(D.compute([],{...p,[q.key]:q.max??'Rows'},ctx),a,q.key);
  }
  valid(run({dimension:'3D',axisRotation:Infinity,viewAz:NaN,viewEl:-999}));
});
test('3D end directions are independent rigid rotations and zero angles are identity',()=>{
  const p={dimension:'3D',behavior:'Split and return',stem:'Straight',style:'Fan',tipVar:0,release:30,rejoin:70,length:200};
  const f=frame3(p),raw=D._bundle3D(f,0);assert.equal(D._steer3D(raw,f),raw);
  const start=D._steer3D(raw,{...f,startTurn:Math.PI/3,startLift:Math.PI/6}),end=D._steer3D(raw,{...f,endTurn:-Math.PI/4,endLift:-Math.PI/6});
  const both=D._steer3D(raw,{...f,startTurn:Math.PI/3,startLift:Math.PI/6,endTurn:-Math.PI/4,endLift:-Math.PI/6});
  for(let i=0;i<raw.length;i++){
    assert.deepEqual(start[i].pts.at(-1),raw[i].pts.at(-1));assert.deepEqual(end[i].pts[0],raw[i].pts[0]);
    assert.deepEqual(both[i].pts[0],start[i].pts[0]);assert.deepEqual(both[i].pts.at(-1),end[i].pts.at(-1));
    for(let k=0;k<raw[i].pts.length;k++)if(raw[i].ts[k]>=f.release&&raw[i].ts[k]<=f.rejoin)assert.deepEqual(both[i].pts[k],raw[i].pts[k]);
    if(i){for(const endpoint of [0,-1])near(Math.hypot(...both[i].pts.at(endpoint).map((v,k)=>v-both[i-1].pts.at(endpoint)[k])),Math.hypot(...raw[i].pts.at(endpoint).map((v,k)=>v-raw[i-1].pts.at(endpoint)[k])));}
  }
  const v=raw[0].pts[0].map((x,k)=>x-raw[0].startPivot[k]),cp=Math.cos(Math.PI/6),sp=Math.sin(Math.PI/6),cy=.5,sy=Math.sin(Math.PI/3),x=v[0]*cp-v[2]*sp,z=v[2]*cp+v[0]*sp;
  const expected=[raw[0].startPivot[0]+x*cy-v[1]*sy,raw[0].startPivot[1]+x*sy+v[1]*cy,raw[0].startPivot[2]+z];
  for(let k=0;k<3;k++)near(start[0].pts[0][k],expected[k]);
});
test('3D cut interpolation retains time stations before independently bending both ends',()=>{
  const f=frame3({behavior:'Split and return',startCut:65,endCut:-60,startTurn:75,startLift:-35,endTurn:-80,endLift:40}),raw=D._bundle3D(f,0);
  D._cutEnds(raw,f.startCut,f.endCut);const bent=D._steer3D(raw,f);
  for(let i=0;i<raw.length;i++){
    assert.equal(raw[i].pts.length,raw[i].ts.length);assert.ok(raw[i].ts[0]>=0&&raw[i].ts.at(-1)<=raw[i].endT);
    assert.ok(raw[i].ts.every((t,k)=>!k||t>=raw[i].ts[k-1]));assert.ok(bent[i].pts.every(v=>v.length===3&&v.every(Number.isFinite)));
  }
});
test('bent 3D ends stay bounded, retain every strand and keep roll framing stable',()=>{
  for(const behavior of ['Fray end','Split and return'])for(const style of ['Fan','Flow','Wander','Tangle']){
    const p={dimension:'3D',behavior,style,startTurn:150,startLift:80,endTurn:-160,endLift:-85,startCut:-70,endCut:65,tipVar:60};valid(run(p));
    const f=frame3(p),raw=D._bundle3D(f,0),a=D._project3D(structuredClone(raw),f,0),b=D._project3D(structuredClone(raw),{...f,axisRotation:2},0);near(a.fit,b.fit);
  }
  const p={dimension:'3D',nib:.05,width:60,overlap:80,count:6,detail:320,startTurn:180,endTurn:-180,startLift:90,endLift:-90,style:'Tangle'};valid(run(p),ctx,15,.05);
});
test('3D rejects paper cells too narrow for physical nib and end-mark padding',()=>{assert.deepEqual(run({dimension:'3D',nib:3},{W:33.04,H:100}),[H.EMPTY,0,0]);});
console.log(`Strand Bundle: ${checks} geometry/contract cases passed (${lab?'prototype':'built-in'}).`);
