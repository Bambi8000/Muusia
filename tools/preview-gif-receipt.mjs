import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseAst} from 'rolldown/parseAst';
import gifenc from 'gifenc';
import * as H from '../src/defs/helpers.js';
const root=fileURLToPath(new URL('../',import.meta.url)),baked=path.join(root,'src/defs/nodes/gif_receipt.js'),lab=path.join(root,'nodes-lab/gif_receipt.plotternode.js');
export const source=()=>fs.existsSync(baked)?'('+fs.readFileSync(baked,'utf8').split('export default ')[1].trim().replace(/;$/,'')+')':fs.readFileSync(lab,'utf8');
export const N=fs.existsSync(baked)?(await import(pathToFileURL(baked))).default:new Function(...Object.keys(H),'return '+source())(...Object.values(H));
export const defaults=()=>Object.fromEntries(N.params.map(p=>[p.key,p.def]));
export const canvas={W:72,H:100};
export const presets=[
 {name:'Colour to dots',params:{}},
 {name:'Colouring outlines',params:{render:'Outlines',edge:14,columns:192}},
 {name:'Light colouring guide',params:{render:'Outlines + light tone',ink:18,mode:'Bayer 4×4',columns:160}},
 {name:'Turned animation',params:{angle:-25,scale:125,mode:'Atkinson',contrast:1.25,columns:160}},
 {name:'Bold threshold',params:{mode:'Threshold',channel:'Darkest channel',threshold:60,scale:85}}
];
export function makeGraph(preset){return {nodes:[{id:9001,type:'gif_receipt',x:40,y:30,params:{...defaults(),...preset.params,source:'Colour demo',time:'Timeline'}}],edges:[]};}
export function evaluate(preset,frameIdx=0,frameCount=24){const ctx={...canvas,frameIdx,frameCount},graph=makeGraph(preset),node=graph.nodes[0];return {ctx,graph,node,result:N.compute([],node.params,ctx,node)};}
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toSVG');
export const toSVG=new Function('PENS',app.slice(decl.start,decl.end)+';return toSVG;')(H.PENS);
export function fixtures(dir){
 fs.mkdirSync(dir,{recursive:true});const palette=[[255,255,255],[0,0,0],[235,55,25],[25,190,70],[35,80,230],[250,210,15],[170,35,205],[90,90,90]];
 const W=16,H=12,patches=[
  {x:0,y:0,w:W,h:H,dispose:1,delay:60,pix:(x,_y)=>x<8?2:4},
  {x:3,y:2,w:8,h:6,dispose:3,delay:180,transparent:true,pix:(x,y)=>(x+y)%3?3:0},
  {x:8,y:4,w:6,h:7,dispose:2,delay:90,transparent:true,pix:(x,y)=>x===y%6?0:5},
  {x:0,y:0,w:5,h:8,dispose:1,delay:120,transparent:true,interlace:true,pix:(x,y)=>y%2?6:0},
  {x:0,y:0,w:W,h:H,dispose:1,delay:50,transparent:true,pix:(x,y)=>(x+y)%4?0:1}
 ];
 const head=new Uint8Array([71,73,70,56,57,97,W,0,H,0,130,0,0,...palette.flat()]),parts=[head];let pixels=new Uint8Array(W*H*3).fill(255),previous=null,saved=null;const expected=[];
 for(const f of patches){
  if(previous?.dispose===2)for(let y=previous.y;y<previous.y+previous.h;y++)for(let x=previous.x;x<previous.x+previous.w;x++)pixels.set([255,255,255],(y*W+x)*3);
  else if(previous?.dispose===3)pixels=saved.slice();
  saved=f.dispose===3?pixels.slice():null;
  const indexed=new Uint8Array(f.w*f.h);for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){const index=f.pix(x,y);indexed[y*f.w+x]=index;if(!f.transparent||index!==0)pixels.set(palette[index],((y+f.y)*W+x+f.x)*3);}
  let rows=indexed;if(f.interlace){rows=new Uint8Array(indexed.length);let at=0;for(const [start,step]of [[0,8],[4,8],[2,4],[1,2]])for(let y=start;y<f.h;y+=step){rows.set(indexed.subarray(y*f.w,(y+1)*f.w),at);at+=f.w;}}
  const encoder=gifenc.GIFEncoder();encoder.writeFrame(rows,f.w,f.h,{palette,delay:f.delay,dispose:f.dispose,transparent:!!f.transparent,transparentIndex:0,repeat:0});encoder.finish();
  const frame=N._meta(encoder.bytes()).frames[0],gce=[33,249,4,(f.dispose<<2)|(f.transparent?1:0),f.delay/10,0,0,0],descriptor=[44,f.x,0,f.y,0,f.w,0,f.h,0,128|2|(f.interlace?64:0)];
  parts.push(new Uint8Array([...gce,...descriptor,...palette.flat()]));parts.push(frame.data);previous=f;expected.push({delay:f.delay,rgb:Buffer.from(pixels).toString('base64')});
 }
 parts.push(Uint8Array.of(59));const complex=Buffer.concat(parts);fs.writeFileSync(path.join(dir,'disposal-interlace.gif'),complex);fs.writeFileSync(path.join(dir,'disposal-interlace.expected.json'),JSON.stringify({w:W,h:H,frames:expected},null,2)+'\n');
 const demo=gifenc.GIFEncoder(),S=N._sequence(defaults(),{}),demoPalette=[[255,255,255],[35,85,225],[235,75,40],...Array.from({length:16},(_,i)=>[255,i*17,i*17])];
 for(let i=0;i<24;i++){const rgb=N._rgb(S,i),rgba=new Uint8Array(S.w*S.h*4);for(let j=0;j<S.w*S.h;j++)rgba.set([...rgb.subarray(j*3,j*3+3),255],j*4);const indices=gifenc.applyPalette(rgba,demoPalette);demo.writeFrame(indices,S.w,S.h,{palette:demoPalette,delay:i%6===0?180:80,repeat:0});}
 demo.finish();fs.writeFileSync(path.join(dir,'colour-orbit.gif'),demo.bytes());
 return {complexFrames:patches.length,colourFrames:24};
}
export function generate(dir){fs.mkdirSync(dir,{recursive:true});const src=source(),records=[];fs.writeFileSync(path.join(dir,'gif_receipt.plotternode.js'),src+'\n');
 for(const [i,p]of presets.entries()){const {graph,ctx,result}=evaluate(p),stem='gif-receipt-'+(i+1);fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(result,ctx));fs.writeFileSync(path.join(dir,stem+'.muusia.json'),JSON.stringify({app:'muusia',v:1,name:'GIF to Receipt · '+p.name,canvas,animation:{frames:24},customNodes:[{key:N.key,source:src}],root:graph},null,2));records.push({name:p.name,paths:result.paths.length,points:result.paths.length*2});}
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(records,null,2)+'\n');return records;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){console.log(fixtures(path.join(root,'fixtures/gif-receipt')));console.log(generate(path.resolve(process.argv[2]||'output/gif-receipt')));}
