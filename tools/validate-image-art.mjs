import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import image from '../src/defs/nodes/image.js';
import {PENS, signedArea} from '../src/defs/helpers.js';
import stroke from '../src/defs/nodes/viiva.js';
const defaults=Object.fromEntries(image.params.map(q=>[q.key,q.def]));
const modes=['Organic dots','Short strokes','Cross stitches','Square weave'];
const w=40,h=30,g=Array.from({length:w*h},(_,i)=>(i%w)/(w-1)*(0.5+0.5*Math.floor(i/w)/(h-1)));
const gray={w,h,g},ctx={W:120,H:90};
const run=(p={},img=gray,c=ctx,style)=>image.compute([style],{...defaults,mode:'Organic dots',...p},c,{data:{img}});
const geom=r=>r.paths.map(({pts,closed})=>({pts,closed}));
const count=r=>r.paths.reduce((s,p)=>s+p.pts.length,0);
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Frozen on e81eff1 with the same grayscale fixture/parameters: the old five
// renderers must remain byte-identical, including the hidden Trace Image alias.
const legacy={
 'Scanline wave':'7041862744cac39167f1f9e22bf07bae881d45a2eed60e8dbaf9cbbf2528d098',
 'Halftone dots':'0437b2249d21e7efb23c7b8a1ce037c55b279bed9281e87b85d96ddfeeaf477f',
 'Hatch levels':'ce409b28bf4f88fe3947482111237378981a67a82e34b2767ab995a59aeb4b69',
 'Flow shade':'13a9f5f5e9c769f54a158cb519c546d532a662b118e928aae6e458702a2666a1',
 'Contours (trace)':'035103e8d078170d1ea46116a76050b8651c46a550393ee1247ecdf4a17c6f48'
};
for(const [mode,expected] of Object.entries(legacy))eq(hash(run({mode})),expected,'legacy geometry: '+mode);
// Preserve the three already-reviewed local art modes when adding square rendering.
const previousArt={
 "Square weave": "cd00070845173ac5a2f5490ee5c60cc16a130e30079d162d36fc13a9dc0dc6b5",
 "Organic dots": "b3c3dc5daedefe627d0cce63b4f926fa06905bb4fd9a18c0c858989e69345260",
 "Short strokes": "a85dbcbdd8c4bdabdf6e7504ab656ff78827c34a14d583dc5f0e973806b71395",
 "Cross stitches": "bc89ac1eea7a90645e854012d8ad1fa8b5a89448fcfc453d7ddd69a8257f742b"
};
for(const [mode,expected] of Object.entries(previousArt))eq(hash(run({mode})),expected,"previous art geometry: "+mode);
ok(image.fileImage&&image.params.some(p=>p.type==='file'),'real image picker contract');
ok(image.imageMax===640,'640 pixel intake opt-in');
ok(image.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'select descriptor contract');
ok(new Set(image.params.map(p=>p.key)).size===image.params.length,'unique params');
function valid(r,p={},c=ctx){
 const fit=image._artFit({...defaults,...p},c,gray);
 ok(r.paths.length>0,'nonempty');ok(count(r)<=112000,'bounded points');
 ok(r.paths.every(q=>q.pts.length>=2&&q.pts.every(pt=>pt.length===2&&pt.every(Number.isFinite))),'finite real paths');
 ok(r.paths.every(q=>Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12),'valid pens');
 ok(r.paths.every(q=>q.pts.every(([x,y])=>x>=fit.x-1e-7&&x<=fit.x+fit.w+1e-7&&y>=fit.y-1e-7&&y<=fit.y+fit.h+1e-7)),'image/margin bounds');
}
const white={w:8,h:8,g:Array(64).fill(0)},black={w:8,h:8,g:Array(64).fill(1)};
for(const mode of modes){
 const a=run({mode});valid(a);eq(run({mode}),a,mode+' deterministic');
 eq(run({mode},null).paths,[],mode+' no image');eq(run({mode},white).paths,[],mode+' white is empty');
 ok(run({mode,invert:true},white).paths.length>0,mode+' inversion');
 const original=JSON.stringify(gray);run({mode});eq(JSON.stringify(gray),original,mode+' no input mutation');
 for(let colours=1;colours<=6;colours++){
  const r=run({mode,colours,colourmap:'Tone bands'});eq(geom(r),geom(a),mode+' pens preserve geometry');
 }
 for(const p of [{cell:0.4,pitch:0.15,passes:4,strength:1},{cell:12,margin:0},{jitter:0.45,colours:6},{seed:987}])valid(run({mode,...p}),p);
 const huge={mode,cell:0.4,pitch:0.15,passes:4,margin:0};
 const big=run(huge,black,{W:420,H:297});ok(count(big)<=112000,mode+' maximum budget');
 const quadrants=new Set(big.paths.map(q=>{const [x,y]=q.pts[0];return (x>210?1:0)+(y>148.5?2:0);}));eq(quadrants.size,4,mode+' budget covers whole sheet');
 for(const bad of [{w:0,h:2,g:[]},{w:2,h:2,g:[]},{w:NaN,h:2,g:[]}])eq(run({mode},bad).paths,[],mode+' invalid payload');
 eq(run({mode},gray,{W:10,H:10}).paths,[],mode+' no fitted area');
}
for(const dotfill of ['Outline','Concentric rings','Spiral fill']){
 const r=run({dotfill});valid(r);
 if(dotfill==='Spiral fill')ok(r.paths.every(p=>!p.closed),'continuous fill spirals');
 else ok(r.paths.every(p=>p.closed&&signedArea(p.pts)>0),'clockwise loops');
}
// Each output circle has a geometric centre/radius. Check actual spacing,
// including adjacent staggered rows and maximal jitter, independently of the grid.
const circles=run({dotfill:'Outline',jitter:0.45,strength:1,cell:4},black).paths.map(p=>{
 const x=p.pts.reduce((s,q)=>s+q[0],0)/p.pts.length,y=p.pts.reduce((s,q)=>s+q[1],0)/p.pts.length;
 return {x,y,r:Math.hypot(p.pts[0][0]-x,p.pts[0][1]-y)};
});
let separated=true;for(let i=0;i<circles.length;i++)for(let j=0;j<i;j++){const a=circles[i],b=circles[j];if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r-1e-8)separated=false;}
ok(separated,'organic circles do not overlap at maximum jitter');
// Independent gradient oracle: a purely horizontal brightness ramp has a
// vertical image tangent, not a random noise-field direction.
const fixed=run({mode:'Short strokes',direction:'Fixed angle',angle:30,passes:1,jitter:0},black);
ok(fixed.paths.every(p=>{const [a,b]=p.pts;return Math.abs((b[1]-a[1])/(b[0]-a[0])-Math.tan(Math.PI/6))<1e-8;}),'fixed angle is exact');
const edgeImg={w:100,h:100,g:Array.from({length:10000},(_,i)=>i%100<50?0.2:0.9)};
const directed=run({mode:'Short strokes',direction:'Image contours',flow:1,angle:0,passes:1,cell:2,jitter:0},edgeImg,{W:100,H:100}).paths.filter(p=>Math.abs((p.pts[0][0]+p.pts[1][0])/2-50)<1.5);
ok(directed.length>4,'edge oracle samples the edge');ok(directed.every(p=>Math.abs(p.pts[1][0]-p.pts[0][0])<0.05),'image edge steers tangent vertically');
for(const direction of ['Image contours','Flow field','Fixed angle'])valid(run({mode:'Short strokes',direction}));
const pidx=[0,4,6,1,5,10];
const rgb=[];for(let y=0;y<12;y++)for(let x=0;x<72;x++){const c=PENS[pidx[Math.floor(x/12)]].c;rgb.push(...[1,3,5].map(k=>parseInt(c.slice(k,k+2),16)));}
const coloured={w:72,h:12,rgb,g:Array.from({length:72*12},(_,i)=>1-(.299*rgb[i*3]+.587*rgb[i*3+1]+.114*rgb[i*3+2])/255)};
const cr=run({colours:6,colourmap:'Source colours',dotfill:'Outline',cell:3},coloured,{W:300,H:100});
eq([...new Set(cr.paths.map(p=>p.layer))].sort((a,b)=>a-b),[0,1,4,5,6,10],'RGB chooses all six actual pen colours');
eq(geom(cr),geom(run({colours:1,dotfill:'Outline',cell:3},coloured,{W:300,H:100})),'RGB assignments preserve geometry');
for(const path of cr.paths){const x=path.pts.reduce((s,p)=>s+p[0],0)/path.pts.length;const stripe=Math.floor((x-12)/276*6);if(stripe>=0&&stripe<6&&Math.abs((x-12)/276*6-Math.round((x-12)/276*6))>0.1)ok(path.layer===pidx[stripe],'source palette region');}
const old=PENS[4].c,beforePalette=hash(run({colours:6},coloured));try{PENS[4].c='#FFFFFF';ok(hash(run({colours:6},coloured))!==beforePalette,'editing an ink changes source-colour assignment');}finally{PENS[4].c=old;}
eq(run({colours:6,colourmap:'Source colours'}),run({colours:6,colourmap:'Tone bands'}),'old grayscale data falls back to tone bands');
const style=stroke.compute([], {...Object.fromEntries(stroke.params.map(p=>[p.key,p.def])),dash:1,gap:0.5},ctx);
ok(hash(run({},gray,ctx,style))!==hash(run()),'real Style input');
for(const mode of modes){const bad={mode};for(const p of image.params)if(['slider','seed','pen'].includes(p.type))bad[p.key]=NaN;valid(run(bad));}
const visible=p=>image.params.filter(q=>!q.showIf||q.showIf({...defaults,...p})).map(q=>q.key);
ok(!visible({mode:'Scanline wave'}).includes('colours'),'legacy hides art controls');
ok(visible({mode:'Organic dots'}).includes('dotfill')&&!visible({mode:'Organic dots'}).includes('direction'),'dots show own controls');
ok(visible({mode:'Short strokes',colours:6}).includes('pen6')&&!visible({mode:'Short strokes'}).includes('levels'),'stroke controls clean');
// Square geometry: tone scales AREA, regular rows remain regular, and actual
// axis-aligned bounds are disjoint even with maximum jitter.
const squareParams={mode:'Square weave',squarefill:'Outline',jitter:0,cell:4,margin:0,strength:1};
const squareRun=(p={},img=black)=>run({...squareParams,...p},img,{W:40,H:40});
const box=q=>{const xs=q.pts.map(p=>p[0]),ys=q.pts.map(p=>p[1]);return {l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)};};
const squares=squareRun();
ok(squares.paths.every(q=>q.closed&&q.pts.length===4&&signedArea(q.pts)>0),'square outlines are four clockwise corners');
const b0=box(squares.paths[0]),b1=box(squares.paths[1]),brow=box(squares.paths.find(q=>box(q).t>b0.b));
eq(b1.l-b0.l,4,'regular column spacing');eq(brow.l-b0.l,2,'alternating rows offset half a cell');
const grid=squareRun({squarelayout:'Grid'}).paths;
const grow=box(grid.find(q=>box(q).t>box(grid[0]).b));eq(grow.l,box(grid[0]).l,'Grid rows align');
const quarter=squareRun({}, {...black,g:black.g.map(()=>0.25)});
ok(Math.abs(signedArea(quarter.paths[0].pts)/signedArea(squares.paths[0].pts)-0.25)<1e-9,'quarter darkness gives quarter square area');
const jittered=squareRun({jitter:0.45}).paths.map(box);
let apart=true;for(let i=0;i<jittered.length;i++)for(let j=0;j<i;j++){const a=jittered[i],b=jittered[j];if(Math.min(a.r,b.r)-Math.max(a.l,b.l)>1e-8&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>1e-8)apart=false;}
ok(apart,'square bounds never overlap at maximum jitter');
for(const squarefill of ['Hatch fill','Woven fill']){
 const filled=squareRun({squarefill,pitch:0.3});eq(filled.paths.length,squares.paths.length,'one continuous path per filled square');
 for(let i=0;i<filled.paths.length;i++){
  const q=filled.paths[i],b=box(squares.paths[i]);
  ok(!q.closed&&q.pts.length>5,'continuous outline plus hatch');
  ok(q.pts.every(([x,y])=>x>=b.l-1e-8&&x<=b.r+1e-8&&y>=b.t-1e-8&&y<=b.b+1e-8),'fill stays inside its outline');
  ok(q.pts.slice(1).every(([x,y],j)=>Math.abs(x-q.pts[j][0])<1e-8||Math.abs(y-q.pts[j][1])<1e-8),'no diagonal hatch connectors');
  const rows=(q.pts.length-5)/2;
  ok((b.b-b.t)/(rows+1)<=0.3+1e-8,'hatch gap no wider than pen pitch');
 }
 const orientations=new Set(filled.paths.map(q=>Math.abs(q.pts[6][0]-q.pts[5][0])<1e-8?'vertical':'horizontal'));
 eq(orientations.size,squarefill==='Woven fill'?2:1,'woven fill alternates direction');
}
ok(visible({mode:'Square weave',colours:6}).includes('squarefill')&&!visible({mode:'Square weave'}).includes('direction'),'square-specific controls');
const colourSquares=run({mode:'Square weave',colours:6,colourmap:'Source colours',cell:3},coloured,{W:300,H:100});
eq([...new Set(colourSquares.paths.map(p=>p.layer))].sort((a,b)=>a-b),[0,1,4,5,6,10],'square mode uses six source inks');
console.log(`Image art: ${checks} checks passed, original five render modes byte-identical.`);
