import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as H from '../src/defs/helpers.js';
import gifenc from 'gifenc';
import {raster} from './preview-eyelashes.mjs';
import {source as receiptSource,toSVG} from './preview-gif-receipt.mjs';
export {toSVG};
const root=fileURLToPath(new URL('../',import.meta.url)),baked=path.join(root,'src/defs/nodes/gif_gcode.js'),lab=path.join(root,'nodes-lab/gif_gcode.plotternode.js');
export const source=()=>fs.existsSync(baked)?'('+fs.readFileSync(baked,'utf8').split('export default ')[1].trim().replace(/;$/,'').replace('...GifReceipt,','...'+receiptSource()+',')+')':fs.readFileSync(lab,'utf8');
export const N=fs.existsSync(baked)?(await import(pathToFileURL(baked))).default:new Function(...Object.keys(H),'return '+source())(...Object.values(H));
export const defaults=()=>Object.fromEntries(N.params.map(p=>[p.key,p.def]));
export const canvas={W:297,H:210};
export const presets=[
 {name:'Engraved motion',params:{}},
 {name:'Contour film',params:{drawing:'Contours',simplify:.15}},
 {name:'Crosshatched motion',params:{drawing:'Crosshatching',pitch:2.2,hatchAngle:-35,levels:4}},
 {name:'Stipple film',params:{drawing:'Stipple',pitch:3,dotDiameter:.8}},
 {name:'Small plot frames',canvas:{W:72,H:100},params:{drawing:'Contours + hatching',pitch:.7,minLength:.3,margin:4,columns:192,simplify:.08}}
];
export function makeGraph(preset){return {nodes:[{id:9001,type:'gif_gcode',x:40,y:30,params:{...defaults(),...preset.params,source:'Colour demo',time:'Timeline'}}],edges:[]};}
export function evaluate(preset,frameIdx=0,frameCount=24){const ctx={...(preset.canvas||canvas),frameIdx,frameCount},graph=makeGraph(preset),node=graph.nodes[0],outputs=N.compute([],node.params,ctx,node);return {ctx,graph,node,outputs,result:outputs[0]};}
export function generate(dir){fs.mkdirSync(dir,{recursive:true});const src=source(),records=[];fs.writeFileSync(path.join(dir,'gif_gcode.plotternode.js'),src+'\n');
 for(const [i,p]of presets.entries()){const {graph,ctx,result}=evaluate(p),stem='gif-gcode-'+(i+1);fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(result,ctx));fs.writeFileSync(path.join(dir,stem+'.muusia.json'),JSON.stringify({app:'muusia',v:1,name:'GIF to G-code · '+p.name,canvas:{W:ctx.W,H:ctx.H},animation:{frames:24},customNodes:[{key:N.key,source:src}],root:graph},null,2));records.push({name:p.name,paths:result.paths.length,points:result.paths.reduce((n,q)=>n+q.pts.length,0),closed:result.paths.filter(q=>q.closed).length});}
 const gif=gifenc.GIFEncoder(),width=1040,height=780,palette=[[250,248,241],[35,38,38]];
 for(let frame=0;frame<24;frame++){const items=presets.slice(0,4).map(p=>({name:p.name,...evaluate(p,frame,24)}));gif.writeFrame(raster(items,width,height),width,height,{palette,delay:110,repeat:0});}gif.finish();fs.writeFileSync(path.join(dir,'gif-gcode-gallery.gif'),gif.bytes());
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(records,null,2)+'\n');return records;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(generate(path.resolve(process.argv[2]||'output/gif-gcode')));
