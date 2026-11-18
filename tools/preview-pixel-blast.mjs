// Actual vector outputs and original animation renders; never reference media.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseAst} from 'rolldown/parseAst';
import gifenc from 'gifenc';
import * as H from '../src/defs/helpers.js';
import M from '../src/defs/nodes/merge.js';
import {EXAMPLES} from '../src/examples.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const baked=path.join(root,'src/defs/nodes/pixel_blast.js'),lab=path.join(root,'nodes-lab/pixel_blast.plotternode.js');
export const N=fs.existsSync(baked)?(await import(pathToFileURL(baked))).default:new Function(...Object.keys(H),'return '+fs.readFileSync(lab,'utf8'))(...Object.values(H));
export const defaults=key=>Object.fromEntries((key==='merge'?M:N).params.map(p=>[p.key,p.def]));
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8'),ast=parseAst(app,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toSVG');
export const toSVG=new Function('PENS',app.slice(decl.start,decl.end)+';return toSVG;')(H.PENS);
export const examples=EXAMPLES.filter(e=>e.name.startsWith('Pixel Blast · '));
export function evaluate(ex,frameIdx=0,frameCount=32){
 const graph=ex.make(defaults),out=new Map(),ctx={...ex.canvas,frameIdx,frameCount};
 for(const n of graph.nodes){const ins=[];for(const e of graph.edges.filter(e=>e.to===n.id))ins[e.toPort]=out.get(e.from);out.set(n.id,(n.type==='merge'?M:N).compute(ins,n.params,ctx,n));}
 return {graph,result:out.get(graph.nodes.at(-1).id)};
}
export function portableSource(){if(!fs.existsSync(baked))return fs.readFileSync(lab,'utf8');const s=fs.readFileSync(baked,'utf8');return '('+s.slice(s.indexOf('export default ')+15).trim().replace(/;$/,'')+')';}
export function generate(dir,animate=true){
 fs.mkdirSync(dir,{recursive:true});const source=portableSource(),records=[],cards=[];
 fs.writeFileSync(path.join(dir,'pixel_blast.plotternode.js'),source+'\n');
 for(const [i,ex]of examples.entries()){
  const {graph,result}=evaluate(ex),stem='pixel-blast-'+(i+1);
  if(!result.paths.length)throw Error('Empty starter '+ex.name);
  fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(result,ex.canvas));
  fs.writeFileSync(path.join(dir,stem+'.muusia.json'),JSON.stringify({app:'muusia',v:1,name:ex.name,canvas:ex.canvas,customNodes:[{key:N.key,source}],root:graph},null,2));
  records.push({name:ex.name,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0)});
  cards.push(`<article><h2>${ex.name.slice(14)}</h2><img src="${stem}.svg"><p><a href="${stem}.muusia.json">Open project</a> · ${records.at(-1).paths} strokes</p></article>`);
 }
 if(animate){
  const cols=4,cellW=240,cellH=352,width=cols*cellW,height=cellH*2,frames=32,gif=gifenc.GIFEncoder(),palette=[[250,248,241],[35,40,39]];
  for(let frame=0;frame<frames;frame++){
   const pixels=new Uint8Array(width*height);
   const line=(a,b,radius=.45)=>{const dx=b[0]-a[0],dy=b[1]-a[1],steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)*1.5)),rad=Math.max(.5,radius);for(let j=0;j<=steps;j++){const x=a[0]+dx*j/steps,y=a[1]+dy*j/steps;for(let yy=Math.floor(y-rad);yy<=Math.ceil(y+rad);yy++)for(let xx=Math.floor(x-rad);xx<=Math.ceil(x+rad);xx++)if(xx>=0&&yy>=0&&xx<width&&yy<height&&(xx-x)**2+(yy-y)**2<rad*rad+.1)pixels[yy*width+xx]=1;}};
   for(let i=0;i<8;i++){
    const ex=examples[i],{result}=evaluate(ex,frame,frames),ox=i%cols*cellW,oy=Math.floor(i/cols)*cellH,scale=(cellW-12)/72;
    const label=H.fontStrokes(ex.make(defaults).nodes[0].params.effect,8,1);for(const ps of label.strokes)for(let j=1;j<ps.length;j++)line([ox+8+ps[j-1][0],oy+6+ps[j-1][1]],[ox+8+ps[j][0],oy+6+ps[j][1]],.5);
    for(const p of result.paths)for(let j=0;j<p.pts.length-(p.closed?0:1);j++){const a=p.pts[j],b=p.pts[(j+1)%p.pts.length];line([ox+6+a[0]*scale,oy+24+a[1]*scale],[ox+6+b[0]*scale,oy+24+b[1]*scale],.15*scale);}
   }
   gif.writeFrame(pixels,width,height,{palette,delay:90,repeat:0});
  }
  gif.finish();fs.writeFileSync(path.join(dir,'pixel-blast-gallery.gif'),gif.bytes());
 }
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(records,null,2)+'\n');
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><meta charset="utf-8"><title>Muusia · Pixel Blast</title><style>body{font:14px/1.4 system-ui;background:#e9e6de;color:#242827;margin:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}article{padding:12px;background:#faf8f1}h2{font-size:15px}img{width:100%;height:320px;object-fit:contain;background:white}</style><h1>Pixel Blast</h1><p>Actual ink paths · eight original effects · receipt-sized projects</p><main>${cards.join('')}</main>`);
 return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(generate(path.resolve(process.argv[2]||'output/pixel-blast')));
