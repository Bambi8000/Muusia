/** Local study fixtures from the real built-in node; not app export evidence. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import def from '../src/defs/nodes/murmuration.js';
const dir=new URL('../docs/murmuration-herd/',import.meta.url);
fs.mkdirSync(dir,{recursive:true});
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const canvas={W:297,H:210},studies=[];
for(const [id,motion,mark,overrides] of [
 ['migration','Migration','Dash',{birds:220,spread:42,travel:.85,scatter:4}],
 ['milling','Milling','Circle',{birds:260,spread:58,travel:.25,spacing:3,size:1.3}],
 ['gather','Gather & roam','Point',{birds:220,spread:48,pulse:1,scatter:3,travel:.7}],
]) {
 const params={...defaults,behaviour:'Reindeer herd',herdMotion:motion,herdMark:mark,...overrides};
 const patch={app:'muusia',v:1,name:`Reindeer herd — ${motion}`,canvas,root:{nodes:[{id:9001,type:'murmuration',x:30,y:20,params}],edges:[]}};
 fs.writeFileSync(new URL(`${id}.muusia.json`,dir),JSON.stringify(patch,null,2)+'\n');
 const paths=def.compute([],params,{...canvas,frameIdx:0,frameCount:36}).paths;
 const data=paths.map(p=>`<path d="${p.pts.map(([x,y],i)=>(i?'L':'M')+x.toFixed(4)+','+y.toFixed(4)).join('')}${p.closed?'Z':''}"/>`).join('');
 fs.writeFileSync(new URL(`${id}.svg`,dir),`<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210"><g fill="none" stroke="#263936" stroke-width=".3" stroke-linecap="round">${data}</g></svg>`);
 studies.push({id,motion,mark,params,paths:paths.length});
}
fs.writeFileSync(new URL('studies.json',dir),JSON.stringify({canvas,studies,sourceSha256:createHash('sha256').update(fs.readFileSync(new URL('../src/defs/nodes/murmuration.js',import.meta.url))).digest('hex')},null,2)+'\n');
console.log('Three editable reindeer projects and study SVGs generated.');
