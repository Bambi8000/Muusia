import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as H from '../../src/defs/helpers.js';
import {lessons} from './content.mjs';
export const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../..');
export const patches=Object.fromEntries(lessons.map(l=>[l.id,JSON.parse(fs.readFileSync(path.join(HERE,'patches',l.id+'.muusia.json')))]));
export const definitions={};
for(const key of new Set([...Object.values(patches).flatMap(p=>p.root.nodes.map(n=>n.type)),'frame','matem']))definitions[key]=(await import(path.join(ROOT,'src/defs/nodes',key+'.js'))).default;
const app=fs.readFileSync(path.join(ROOT,'src/App.jsx'),'utf8');
export const engineSource=app.slice(app.indexOf('function defIns(node)'),app.indexOf('/* ============================================================\n   G-CODE'));
export const exporterSource=app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export'));
assert.ok(engineSource.includes('function evalLevel')&&exporterSource.includes('function toSVG'));
const solid=JSON.parse(app.match(/const SOLID_STYLE = (\{[^;]+\});/)[1].replace(/(\w+):/g,'"$1":'));
const evalLevel=Function('DEFS','EMPTY','SOLID_STYLE',engineSource+';return evalLevel;')(definitions,H.EMPTY,solid);
export const toSVG=Function('PENS',exporterSource+';return toSVG;')(H.PENS);
export const evaluate=(p,i=0,N=12)=>evalLevel(p.root,{...p.canvas,frameIdx:i,frameCount:N}).out[p.root.outputId][0];
const defaults=key=>Object.fromEntries(definitions[key].params.map(p=>[p.key,p.def]));
export function animationPatch(lesson){
 if(lesson.animation.kind==='still')return null;
 const p=structuredClone(patches[lesson.id]),out=p.root.nodes.find(n=>n.id===p.root.outputId);p.name+=' · Animation';
 if(lesson.animation.kind==='timeline')out.params[lesson.key==='gravity'?'bodyMotion':'motion']='Timeline';
 else {
  const clock={id:9801,type:'frame',x:20,y:950,params:defaults('frame')},port=definitions.frame.outs.findIndex(p=>p.label===lesson.animation.source);assert.ok(port>=0,lesson.id+' clock');p.root.nodes.push(clock);let from=clock.id,fromPort=port;
  for(const [i,op] of (lesson.animation.math?(Array.isArray(lesson.animation.math)?lesson.animation.math:[lesson.animation.math]):[]).entries()){const math={id:9802+i,type:'matem',x:360+i*340,y:950,params:{...defaults('matem'),...op}};p.root.nodes.push(math);p.root.edges.push({id:'craft-clock-'+i,from,fromPort,to:math.id,toPort:0});from=math.id;fromPort=0;}
  p.root.edges.push({id:'craft-motion',from,fromPort,to:out.id,toPort:'p:'+lesson.animation.target});
 }
 return p;
}
export const pinName=pin=>pin.label||({paths:'Paths',mesh:'Mesh',value:'Value',style:'Style'}[pin.type])||pin.type;
export const shownParams=node=>definitions[node.type].params.filter(pd=>pd.type!=='file'&&(!pd.showIf||pd.showIf(node.params)));
