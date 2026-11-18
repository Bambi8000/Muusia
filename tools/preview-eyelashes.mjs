import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseAst} from 'rolldown/parseAst';
import gifenc from 'gifenc';
import * as H from '../src/defs/helpers.js';
import Lissajous from '../src/defs/nodes/lissajous.js';
const root=fileURLToPath(new URL('../',import.meta.url)),baked=path.join(root,'src/defs/nodes/eyelashes.js'),lab=path.join(root,'nodes-lab/eyelashes.plotternode.js');
export const source=()=>fs.existsSync(baked)?'('+fs.readFileSync(baked,'utf8').split('export default ')[1].trim().replace(/;$/,'')+')':fs.readFileSync(lab,'utf8');
export const N=fs.existsSync(baked)?(await import(pathToFileURL(baked))).default:new Function(...Object.keys(H),'return '+source())(...Object.values(H));
export const defaults=()=>Object.fromEntries(N.params.map(p=>[p.key,p.def]));
export const canvas={W:297,H:210};
export const presets=[
 {name:'Beautiful accident',params:{shape:'Oval',angle:168,lower:false,content:'None',count:510,length:32,clumping:96,clumps:48,curl:7,lean:-18,disorder:78,ink:90,rootWidth:1.1,width:210,height:92,seed:72}},
 {name:'Blinking eye',params:{}},
 {name:'Slit eye',params:{shape:'Swept',iris:'Slit',count:220,clumping:75,clumps:34,ink:50,curl:48,lean:25,angle:-8,seed:89}},
 {name:'Wired dream',params:{count:260,content:'Auto',artFit:'Cover',ink:75,clumping:92,lowerCount:37,seed:131},wired:true},
 {name:'Receipt blink',canvas:{W:72,H:100},params:{width:61,height:25,length:11,count:150,rootWidth:.4,pitch:.25,clumps:24,ink:40,lowerCount:40,margin:4,seed:51}},
 {name:'Tapered spikes',params:{form:'Tapered spikes',spikeWidth:2.8,count:220,clumping:72,clumps:35,ink:55,length:30,lower:false,angle:168,shape:'Oval',content:'None',seed:101}}
];
const defs={eyelashes:N,lissajous:Lissajous};
export const nodeDefaults=type=>Object.fromEntries(defs[type].params.map(p=>[p.key,p.def]));
export function makeGraph(preset){
 const params={...defaults(),...preset.params,time:'Timeline'};
 if(!preset.wired)return {nodes:[{id:9001,type:'eyelashes',x:40,y:30,params}],edges:[]};
 return {nodes:[{id:9001,type:'lissajous',x:20,y:30,params:{...nodeDefaults('lissajous'),fx:5,fy:7,phase:1.1,turns:1,margin:12,layer:4}},{id:9002,type:'eyelashes',x:350,y:30,params}],edges:[{id:'e9101',from:9001,fromPort:0,to:9002,toPort:1}]};
}
export function evaluate(preset,frameIdx=0,frameCount=24){
 const ctx={...(preset.canvas||canvas),frameIdx,frameCount},graph=makeGraph(preset),node=graph.nodes.at(-1),art=preset.wired?Lissajous.compute([],graph.nodes[0].params,ctx,graph.nodes[0]):undefined;
 return {graph,node,ctx,art,result:N.compute([undefined,art],node.params,ctx,node)};
}
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toSVG');
export const toSVG=new Function('PENS',app.slice(decl.start,decl.end)+';return toSVG;')(H.PENS);
export function raster(items,width,height){
 const pixels=new Uint8Array(width*height),cols=2,cellW=width/cols,cellH=height/Math.ceil(items.length/cols);
 const line=(a,b,r=.5)=>{const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*1.4));for(let i=0;i<=steps;i++){const x=a[0]+(b[0]-a[0])*i/steps,y=a[1]+(b[1]-a[1])*i/steps;for(let yy=Math.floor(y-r);yy<=Math.ceil(y+r);yy++)for(let xx=Math.floor(x-r);xx<=Math.ceil(x+r);xx++)if(xx>=0&&yy>=0&&xx<width&&yy<height&&(xx-x)**2+(yy-y)**2<=r*r+.12)pixels[yy*width+xx]=1;}};
 for(const [i,{name,result,ctx}]of items.entries()){
  const ox=i%cols*cellW,oy=Math.floor(i/cols)*cellH,scale=Math.min((cellW-24)/ctx.W,(cellH-36)/ctx.H),dx=(cellW-ctx.W*scale)/2,dy=30+(cellH-36-ctx.H*scale)/2;
  for(const s of H.fontStrokes(name,8,1).strokes)for(let j=1;j<s.length;j++)line([ox+12+s[j-1][0],oy+9+s[j-1][1]],[ox+12+s[j][0],oy+9+s[j][1]]);
  for(const q of result.paths)for(let j=0;j<q.pts.length-(q.closed?0:1);j++){const a=q.pts[j],b=q.pts[(j+1)%q.pts.length];line([ox+dx+a[0]*scale,oy+dy+a[1]*scale],[ox+dx+b[0]*scale,oy+dy+b[1]*scale],Math.max(.35,.15*scale));}
 }return pixels;
}
export function generate(dir,animate=true){
 fs.mkdirSync(dir,{recursive:true});const src=source(),records=[];
 fs.writeFileSync(path.join(dir,'eyelashes.plotternode.js'),src+'\n');
 for(const [i,preset]of presets.entries()){
  const {graph,ctx,result}=evaluate(preset),stem='eyelashes-'+(i+1);if(!result.paths.length)throw Error('Empty '+preset.name);
  fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(result,ctx));
  fs.writeFileSync(path.join(dir,stem+'.muusia.json'),JSON.stringify({app:'muusia',v:1,name:'Eyelashes · '+preset.name,canvas:preset.canvas||canvas,customNodes:[{key:N.key,source:src}],root:graph},null,2));
  records.push({name:preset.name,paths:result.paths.length,points:result.paths.reduce((n,q)=>n+q.pts.length,0)});
 }
 const palette=[[250,248,241],[35,38,38]],width=1040,height=780;
 const gif=gifenc.GIFEncoder();
 for(let frame=0;frame<(animate?24:1);frame++){
  const items=[presets[0],presets[5],presets[1],presets[3]].map(p=>({name:p.name,...evaluate(p,frame,24)}));
  gif.writeFrame(raster(items,width,height),width,height,{palette,delay:110,repeat:0});
 }
 gif.finish();fs.writeFileSync(path.join(dir,'eyelashes-gallery.gif'),gif.bytes());
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(records,null,2)+'\n');return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(generate(path.resolve(process.argv[2]||'output/eyelashes'),!process.argv.includes('--stills')));
