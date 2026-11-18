import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import gifenc from 'gifenc';
import {fontStrokes} from '../src/defs/helpers.js';
import {N,source,defaults,canvas,toSVG,run} from './preview-text-roll.mjs';

export const ribbonPresets=[
 {name:'Raised ribbon',params:{construction:'Raised ribbon',wave:0,twist:0,roll:-10,elevation:28,depth:100,shoulder:3}},
 {name:'Wave ribbon',params:{construction:'Raised ribbon',text:'FLOW',wave:15,twist:25,depth:100,roll:-8,elevation:24,height:250,shoulder:3}},
 {name:'Raised ring',params:{construction:'Raised ribbon',text:'TYPE LOOP',surface:'Ring',height:90,radius:140,depth:70,ribbonLines:48,wave:0,twist:0,roll:0,elevation:50,phase:40}},
];
function raster(width,height,tiles){
 const pixels=new Uint8Array(width*height);
 const line=(a,b,r=.5)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*1.5));for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,y=a[1]+(b[1]-a[1])*i/n;for(let yy=Math.floor(y-r);yy<=Math.ceil(y+r);yy++)for(let xx=Math.floor(x-r);xx<=Math.ceil(x+r);xx++)if(xx>=0&&yy>=0&&xx<width&&yy<height&&(xx-x)**2+(yy-y)**2<r*r+.1)pixels[yy*width+xx]=1;}};
 for(const {result,label,x=0,y=0}of tiles){
  const scale=340/72;
  for(const s of fontStrokes(label,8,1).strokes)for(let j=1;j<s.length;j++)line([x+10+s[j-1][0],y+8+s[j-1][1]],[x+10+s[j][0],y+8+s[j][1]]);
  for(const p of result.paths)for(let j=0;j<p.pts.length-(p.closed?0:1);j++){const a=p.pts[j],b=p.pts[(j+1)%p.pts.length];line([x+10+a[0]*scale,y+30+a[1]*scale],[x+10+b[0]*scale,y+30+b[1]*scale],.15*scale);}
 }
 return pixels;
}
export function generateRibbon(dir,animate=true){
 fs.mkdirSync(dir,{recursive:true});const src=source(),records=[];
 fs.writeFileSync(path.join(dir,'text_roll.plotternode.js'),src+'\n');
 for(const [i,p]of ribbonPresets.entries()){
  const params={...defaults(),...p.params,time:'Timeline'},out=run(params),stem='text-ribbon-'+(i+1);
  fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(out,canvas));
  fs.writeFileSync(path.join(dir,stem+'.muusia.json'),JSON.stringify({app:'muusia',v:1,name:'Text Roll · '+p.name,canvas,customNodes:[{key:N.key,source:src}],root:{nodes:[{id:9101,type:'text_roll',x:40,y:20,params}],edges:[]}},null,2));
  records.push({name:p.name,paths:out.paths.length,points:out.paths.reduce((n,q)=>n+q.pts.length,0)});
 }
 if(animate){
  const gif=gifenc.GIFEncoder(),gallery=gifenc.GIFEncoder(),palette=[[250,248,241],[35,40,39]];
  for(let f=0;f<32;f++){
   const tiles=ribbonPresets.map((p,i)=>({result:run({...p.params,time:'Timeline'},f,32),label:p.name,x:i%2*360,y:Math.floor(i/2)*520}));
   tiles.push({result:run({time:'Timeline'},f,32),label:'Floating letters',x:360,y:520});
   gallery.writeFrame(raster(720,1040,tiles),720,1040,{palette,delay:100,repeat:0});
   gif.writeFrame(raster(360,520,[tiles[0]]),360,520,{palette,delay:100,repeat:0});
  }
  gif.finish();gallery.finish();fs.writeFileSync(path.join(dir,'raised-ribbon.gif'),gif.bytes());fs.writeFileSync(path.join(dir,'text-ribbon-gallery.gif'),gallery.bytes());
 }
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(records,null,2)+'\n');return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(generateRibbon(path.resolve(process.argv[2]||'output/text-ribbon'),!process.argv.includes('--stills')));
