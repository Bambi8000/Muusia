import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseAst} from 'rolldown/parseAst';
import gifenc from 'gifenc';
import * as H from '../src/defs/helpers.js';

const root=fileURLToPath(new URL('../',import.meta.url)),baked=path.join(root,'src/defs/nodes/text_roll.js'),lab=path.join(root,'nodes-lab/text_roll.plotternode.js');
export const source=()=>fs.existsSync(baked)?'('+fs.readFileSync(baked,'utf8').split('export default ')[1].trim().replace(/;$/,'')+')':fs.readFileSync(lab,'utf8');
export const N=fs.existsSync(baked)?(await import(pathToFileURL(baked))).default:new Function(...Object.keys(H),'return '+source())(...Object.values(H));
export const defaults=()=>Object.fromEntries(N.params.map(p=>[p.key,p.def]));
export const canvas={W:72,H:100};
export const presets=[
 {name:'Sculpted drum',params:{}},
 {name:'Rolling ring',params:{text:'TYPE LOOP',surface:'Ring',height:90,radius:130,depth:75,slices:22,twist:20,elevation:46,phase:40,roll:12,wave:15}},
 {name:'Rippled scroll',params:{text:'FLOW',height:220,arc:290,depth:80,slices:26,wave:40,waves:3,twist:70,elevation:20,phase:110}},
 {name:'Rocking receipt',params:{text:'ROLL',motion:'Rock',height:260,radius:80,depth:60,slices:22,wave:0,twist:0,elevation:22,phase:35}},
];
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toSVG');
export const toSVG=new Function('PENS',app.slice(decl.start,decl.end)+';return toSVG;')(H.PENS);
export const run=(over={},frameIdx=0,frameCount=32)=>N.compute([],{...defaults(),...over},{...canvas,frameIdx,frameCount},{});
export function generate(dir,animate=true){
 fs.mkdirSync(dir,{recursive:true});const records=[],src=source();
 fs.writeFileSync(path.join(dir,'text_roll.plotternode.js'),src+'\n');
 for(const [i,p]of presets.entries()){
  const params={...defaults(),...p.params,time:'Timeline'},out=run(params),stem='text-roll-'+(i+1);
  fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(out,canvas));
  fs.writeFileSync(path.join(dir,stem+'.muusia.json'),JSON.stringify({app:'muusia',v:1,name:'Text Roll · '+p.name,canvas,customNodes:[{key:N.key,source:src}],root:{nodes:[{id:9101,type:'text_roll',x:40,y:20,params}],edges:[]}},null,2));
  records.push({name:p.name,paths:out.paths.length,points:out.paths.reduce((n,q)=>n+q.pts.length,0)});
 }
 if(animate){
  const width=720,height=1040,gif=gifenc.GIFEncoder(),palette=[[250,248,241],[35,40,39]];
  for(let frame=0;frame<32;frame++){
   const pixels=new Uint8Array(width*height);
   const line=(a,b,r=.5)=>{const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*1.5));for(let i=0;i<=steps;i++){const x=a[0]+(b[0]-a[0])*i/steps,y=a[1]+(b[1]-a[1])*i/steps;for(let yy=Math.floor(y-r);yy<=Math.ceil(y+r);yy++)for(let xx=Math.floor(x-r);xx<=Math.ceil(x+r);xx++)if(xx>=0&&yy>=0&&xx<width&&yy<height&&(xx-x)**2+(yy-y)**2<r*r+.1)pixels[yy*width+xx]=1;}};
   for(let i=0;i<4;i++){
    const {name,params}=presets[i],out=run({...params,time:'Timeline'},frame,32),ox=i%2*360,oy=Math.floor(i/2)*520,scale=340/72;
    for(const s of H.fontStrokes(name,8,1).strokes)for(let j=1;j<s.length;j++)line([ox+10+s[j-1][0],oy+8+s[j-1][1]],[ox+10+s[j][0],oy+8+s[j][1]]);
    for(const q of out.paths)for(let j=0;j<q.pts.length-(q.closed?0:1);j++){const a=q.pts[j],b=q.pts[(j+1)%q.pts.length];line([ox+10+a[0]*scale,oy+30+a[1]*scale],[ox+10+b[0]*scale,oy+30+b[1]*scale],.15*scale);}
   }
   gif.writeFrame(pixels,width,height,{palette,delay:95,repeat:0});
  }
  gif.finish();fs.writeFileSync(path.join(dir,'text-roll-gallery.gif'),gif.bytes());
 }
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(records,null,2)+'\n');
 return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(generate(path.resolve(process.argv[2]||'output/text-roll'),!process.argv.includes('--stills')));
