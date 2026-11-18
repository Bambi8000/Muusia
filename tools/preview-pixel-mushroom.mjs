// Render the real XY ink paths, including an optional previous-source comparison.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import gifenc from 'gifenc';
import * as H from '../src/defs/helpers.js';
import {N,defaults,toSVG,portableSource,examples} from './preview-pixel-blast.mjs';

export const canvas={W:72,H:100};
export const params={...examples.find(e=>e.name==='Pixel Blast · Mushroom cloud').make(defaults).nodes[0].params,motion:'Manual'};
export const phases=[8,20,35,50,68,84];
export function mushroomFrame(def=N,phase=50,over={}){return def.compute([],{...params,...over,phase},canvas,{});}
function raster(width,height,tiles){
 const pixels=new Uint8Array(width*height);
 const line=(a,b,radius)=>{
  const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*1.5));
  for(let j=0;j<=steps;j++){
   const x=a[0]+(b[0]-a[0])*j/steps,y=a[1]+(b[1]-a[1])*j/steps;
   for(let yy=Math.floor(y-radius);yy<=Math.ceil(y+radius);yy++)for(let xx=Math.floor(x-radius);xx<=Math.ceil(x+radius);xx++)if(xx>=0&&yy>=0&&xx<width&&yy<height&&(xx-x)**2+(yy-y)**2<radius*radius+.1)pixels[yy*width+xx]=1;
  }
 };
 for(const {result,label,x=0,y=0,w=360}of tiles){
  const scale=(w-20)/72;
  for(const ps of H.fontStrokes(label,8,1).strokes)for(let j=1;j<ps.length;j++)line([x+10+ps[j-1][0],y+8+ps[j-1][1]],[x+10+ps[j][0],y+8+ps[j][1]],.5);
  for(const p of result.paths)for(let j=0;j<p.pts.length-(p.closed?0:1);j++){const a=p.pts[j],b=p.pts[(j+1)%p.pts.length];line([x+10+a[0]*scale,y+28+a[1]*scale],[x+10+b[0]*scale,y+28+b[1]*scale],.15*scale);}
 }
 return pixels;
}
export function generateMushroom(dir,beforePath){
 fs.mkdirSync(dir,{recursive:true});
 const before=beforePath?new Function(...Object.keys(H),'return ('+fs.readFileSync(beforePath,'utf8').split('export default ')[1].trim().replace(/;$/,'')+');')(...Object.values(H)):null;
 const palette=[[250,248,241],[35,40,39]],gif=gifenc.GIFEncoder(),comparison=before?gifenc.GIFEncoder():null;
 for(let i=0;i<48;i++){
  const phase=(i/48*100+50)%100,result=mushroomFrame(N,phase);
  gif.writeFrame(raster(360,510,[{result,label:'MUSHROOM CLOUD'}]),360,510,{palette,delay:85,repeat:0});
  if(comparison)comparison.writeFrame(raster(720,510,[{result:mushroomFrame(before,phase),label:'BEFORE'},{result,label:'AFTER',x:360}]),720,510,{palette,delay:85,repeat:0});
 }
 gif.finish();fs.writeFileSync(path.join(dir,'mushroom-cloud.gif'),gif.bytes());
 if(comparison){comparison.finish();fs.writeFileSync(path.join(dir,'mushroom-before-after.gif'),comparison.bytes());}
 const contact=gifenc.GIFEncoder(),records=[];
 contact.writeFrame(raster(1080,1020,phases.map((phase,i)=>{
  const result=mushroomFrame(N,phase),stem='mushroom-phase-'+phase;
  fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(result,canvas));
  records.push({phase,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0)});
  return {result,label:'PHASE '+phase+'%',x:i%3*360,y:Math.floor(i/3)*510};
 })),1080,1020,{palette,delay:1000});
 contact.finish();fs.writeFileSync(path.join(dir,'mushroom-stages.gif'),contact.bytes());
 const source=portableSource();
 fs.writeFileSync(path.join(dir,'pixel_blast.plotternode.js'),source+'\n');
 fs.writeFileSync(path.join(dir,'mushroom-cloud.muusia.json'),JSON.stringify({app:'muusia',v:1,name:'Pixel Blast · Rolling mushroom cloud',canvas,customNodes:[{key:N.key,source}],root:{nodes:[{id:9001,type:'pixel_blast',x:40,y:20,params:{...params,motion:'Timeline',phase:50}}],edges:[]}},null,2));
 fs.writeFileSync(path.join(dir,'stages.json'),JSON.stringify(records,null,2)+'\n');
 return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(generateMushroom(path.resolve(process.argv[2]||'output/pixel-mushroom'),process.argv[3]));
