import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAst} from 'rolldown/parseAst';
import * as H from '../src/defs/helpers.js';
import {EXAMPLES} from '../src/examples.js';
import {DEFAULT_MACHINE,needleExportError} from '../src/machine.js';
import {joinReceiptFrames} from '../src/receipt-animation.js';
import {RECEIPT_MAX_HEIGHT_DOTS} from '../src/receipt-format.js';
import {N,source,defaults,canvas,presets,evaluate,toSVG} from './preview-gif-receipt.mjs';
let checks=0,frames=0;const ok=(v,s)=>{assert.ok(v,s);checks++;},eq=(a,b,s)=>{assert.deepEqual(a,b,s);checks++;},hash=JSON.stringify;
const run=(over={},ctx=canvas,node={})=>N.compute([],{...defaults(),...over},ctx,node),flat=r=>r.paths.flatMap(q=>q.pts);
function valid(r,ctx=canvas){ok(r.paths.length>0,'nonempty output');ok(flat(r).length<=120000,'whole frame budget');ok(r.paths.every(q=>q.pts.length===2&&!q.closed&&Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12&&q.strokeWidth>0&&q.strokeWidth<=10&&q.receiptStrokeWidth===q.strokeWidth),'real horizontal coverage strokes');ok(flat(r).every(q=>q.length===2&&q.every(Number.isFinite)&&q[0]>=0&&q[1]>=0&&q[0]<=ctx.W&&q[1]<=ctx.H),'finite on-paper XY');ok(r.paths.every(q=>q.pts[0][1]===q.pts[1][1]&&q.pts[1][0]>q.pts[0][0]),'nonzero horizontal runs');}
const baseline=run();valid(baseline);eq(run(),baseline,'deterministic repeatability');
ok(N.fileBinary&&N.fileAnimation&&N.params.some(q=>q.type==='file')&&N.fileAccept.includes('gif'),'actual animation picker contract');
for(const mode of ['Bayer 8×8','Bayer 4×4','Floyd–Steinberg','Atkinson','Threshold'])for(const render of ['Halftone','Outlines','Outlines + light tone'])for(const channel of ['Luminance','Average','Red','Green','Blue','Darkest channel']){const r=run({mode,render,channel,ink:render==='Outlines + light tone'?18:100});valid(r);eq(run({mode,render,channel,ink:render==='Outlines + light tone'?18:100}),r,'random-access rendering');}
for(const over of [{scale:180},{angle:37},{x:12},{y:-9},{fit:'Cover'},{brightness:20},{contrast:2},{gamma:1.8},{black:15},{white:80},{threshold:70},{dither:30},{invert:true},{columns:100},{margin:9},{ink:20},{layer:3},{aspect:false,scaleX:140,scaleY:80}]){const r=run(over);valid(r);ok(hash(r)!==hash(baseline),'live '+hash(over));}
eq(run({aspect:true,scaleX:190,scaleY:50}),baseline,'aspect lock ignores hidden stretch');
const S=N._sequence(defaults(),{}),layout=N._layout(defaults(),canvas,S);ok(Math.abs(layout.w/layout.h-S.sourceW/S.sourceH)<1e-12,'locked original aspect');
const unlocked=N._layout({...defaults(),aspect:false,scaleX:200,scaleY:50},canvas,S);ok(Math.abs(unlocked.w/unlocked.h-4*S.sourceW/S.sourceH)<1e-12,'unlocked independent scales');
const rotated=N._layout({...defaults(),angle:90},canvas,S);ok(Math.abs(rotated.quad[1][0]-rotated.quad[0][0])<1e-10&&Math.abs(Math.abs(rotated.quad[1][1]-rotated.quad[0][1])-layout.w)<1e-10,'90 degree rotation is geometric');
const pixelSource={w:2,h:1,sourceW:2,sourceH:1},rgb=Uint8Array.from([0,0,0,255,255,255]),F={...N._layout({...defaults(),margin:0}, {W:4,H:2},pixelSource),cols:2,rows:1,dx:2,dy:2};
eq(Array.from(N._tones(defaults(),pixelSource,rgb,F).values),[0,1],'independent black/white sample oracle');
eq(Array.from(N._tones({...defaults(),invert:true},pixelSource,rgb,F).values),[1,0],'inversion inside image');
const grid={cols:8,rows:8},half={values:new Float32Array(64).fill(.5),mask:new Uint8Array(64).fill(1)};for(const mode of ['Bayer 8×8','Bayer 4×4'])ok(N._monochrome({...defaults(),mode},half,grid).reduce((a,b)=>a+b,0)===32,'ordered half gray has exactly half black dots');
const outline=run({render:'Outlines'});ok(outline.paths.length<baseline.paths.length/2,'colouring removes solid interior tone');eq(run({render:'Outlines',mode:'Threshold',ink:0,dither:0}),run({render:'Outlines',mode:'Atkinson',ink:100,dither:100}),'outline ignores hidden halftone controls');
ok(run({ink:0}).paths.length===0,'zero ink leaves paper white');
for(const loops of [0,1,2,8]){const p={...defaults(),loops};eq(N._index(p,{frameIdx:0,frameCount:24},S),N._index(p,{frameIdx:24,frameCount:24},S),'exact loop endpoint');if(!loops)eq(run({loops},{...canvas,frameIdx:17,frameCount:24}),run({loops},{...canvas,frameIdx:0,frameCount:24}),'zero cycles freeze');}
for(let f=0;f<24;f++)eq(N._index(defaults(),{frameIdx:f,frameCount:24},S),f,'all source frames exactly once');
const delays={frames:[{delay:100},{delay:300},{delay:100}]};eq(Array.from({length:5},(_,i)=>N._index({...defaults(),timing:'Original timing'},{frameIdx:i,frameCount:5},delays)),[0,1,1,1,2],'original delay sampling');
eq(N._index({...defaults(),time:'Manual',frame:999},{},S),23,'manual clamps to actual frame count');
for(const ctx of [{W:0,H:1},{W:NaN,H:100},{W:72,H:Infinity},{W:3,H:3}])eq(run({},ctx),H.EMPTY,'invalid canvas refused');
for(const ctx of [{W:72,H:1000},{W:72,H:50000},{W:1000,H:72}]){const r=run({columns:512},ctx);valid(r,ctx);ok(r.effectiveColumns<=512,'uniform spatial budget');}
eq(run({source:'GIF file'}),H.EMPTY,'explicit missing source never silently demos');eq(run({file:'Loading example…'}),H.EMPTY,'pending file remains empty');
const data={kind:'gif-receipt-v1',w:2,h:1,sourceW:2,sourceH:1,frames:[{delay:100,rgb:Buffer.from(rgb).toString('base64')}]};valid(run({},canvas,{data:{svg:data}}));
for(const bad of [{...data,w:1025},{...data,frames:[]},{...data,frames:[{delay:100,rgb:'bad'}]},{...data,sourceH:Infinity}])eq(run({source:'GIF file'},canvas,{data:{svg:bad}}),H.EMPTY,'malformed frozen frames refused');
for(const name of ['colour-orbit','disposal-interlace']){const bytes=fs.readFileSync(new URL('../fixtures/gif-receipt/'+name+'.gif',import.meta.url)),meta=N._meta(bytes);ok(meta.frames.length===(name==='colour-orbit'?24:5),'actual encoded fixture count');ok(meta.duration>0,'delays parsed');for(const n of [0,5,12,bytes.length-1])assert.throws(()=>N._meta(bytes.subarray(0,n)));checks+=4;}
assert.throws(()=>N._meta(new Uint8Array(20)));checks++;
const portable=new Function(...Object.keys(H),'return '+source())(...Object.values(H));eq(portable.compute([],defaults(),canvas,{}),baseline,'portable exact output');
for(const preset of presets)for(let f=0;f<24;f++){const {result,ctx}=evaluate(preset,f,24);valid(result,ctx);frames++;}
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(q=>q.type==='FunctionDeclaration'&&q.id.name==='toGcode');const toGcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',app.slice(decl.start,decl.end)+';return toGcode;')(H.PENS,H.pathLength,needleExportError,'test');
for(const preset of presets){const {result,ctx}=evaluate(preset);ok((toSVG(result,ctx).match(/<path /g)||[]).length===result.paths.length,'SVG complete');const code=toGcode(result,ctx,{...DEFAULT_MACHINE,workW:1000,workH:1000});ok(code.split('\n').filter(q=>/^G1 X/.test(q)).length===result.paths.length,'G-code all horizontal runs');ok(!code.includes('OUT OF BOUNDS'),'G-code bounded');}
const make=h=>({width:512,height:h,data:Buffer.alloc(h*64,0xaa).toString('base64')}),a=make(2),b=make(3),strip=joinReceiptFrames([a,b]);eq(strip.height,5,'joined height');eq(Buffer.from(strip.data,'base64'),Buffer.concat([Buffer.from(a.data,'base64'),Buffer.from(b.data,'base64')]),'joined exact row order');eq(strip.frames,[{frame:1,y:0,height:2},{frame:2,y:2,height:3}],'registration offsets retained');for(const bad of [[],[{...a,width:511}],[{...a,data:'AA=='}],[{...a,thermalText:[{}]}],[{...a,height:RECEIPT_MAX_HEIGHT_DOTS+1}]]){assert.throws(()=>joinReceiptFrames(bad));checks++;}
const help=EXAMPLES.filter(e=>e.name.startsWith('GIF to Receipt · '));if(process.argv.includes('--baked')){eq(help.length,5,'five built-in starters');for(const p of presets){const ex=help.find(e=>e.name==='GIF to Receipt · '+p.name);eq(ex.make(()=>defaults()),evaluate(p).graph,'Help actual graph parity');}}
console.log(`GIF to Receipt: ${checks} checks passed; ${frames} actual frames; transforms, channels, five monochrome modes, colouring outlines, timing, bounded geometry, portable output and continuous row concatenation.`);
