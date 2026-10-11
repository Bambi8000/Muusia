import fs from 'node:fs/promises';
import {EXAMPLES} from '../../src/examples.js';
import {PENS} from '../../src/defs/helpers.js';
export const TEXT_KEYS=['hersheytext','lettering','concrete','ribbontype','textpath','stitchtype','crossstitch','typegrating','scribbletype','typerain','asciiart','braille','numerals','signature'];
export const definitions={};
for(const key of [...TEXT_KEYS,'radat','microbes','grid_hairs'])definitions[key]=(await import(`../../src/defs/nodes/${key}.js`)).default;
export const defaults=key=>Object.fromEntries(definitions[key].params.map(p=>[p.key,p.def]));
const node=(type,params={},id=9001)=>({id,type,x:30+(id-9001)*340,y:30,params:{...defaults(type),...params}});
export function single(key,params={}){return {app:'muusia',v:1,name:definitions[key].name,canvas:{W:200,H:140},root:{nodes:[node(key,params)],edges:[],outputId:9001}};}
export async function fixtures(){
 const read=id=>fs.readFile(new URL(`../../docs/typography-audit/patches/${id}.muusia.json`,import.meta.url),'utf8').then(JSON.parse);
 const projects={
 hersheytext:single('hersheytext',{text:'TYPE',size:34}),lettering:single('lettering',{text:'FORM',size:44,depth:0,fill:'Outline',weight:32}),
 concrete:single('concrete',{text:'WORDS MOVE',mode:'Columns',columns:2,size:5,motion:'Row squeeze',amount:.8,clock:'Timeline'}),
 ribbontype:await read('ribbon'),textpath:await read('orbit'),stitchtype:await read('stitches'),
 crossstitch:single('crossstitch',{text:'TYPE',pitch:5}),typegrating:single('typegrating',{text:'TYPE',size:38,mode:'Phase shift'}),
 scribbletype:single('scribbletype',{text:'INK',size:38,legibility:.7,mess:.4,tails:.15}),
 typerain:single('typerain',{glyphs:'TYPE/',size:3,density:.45,pens:2}),asciiart:await read('ascii'),
 braille:single('braille',{text:'Muusia',tx:42,ty:55,scale:3}),numerals:single('numerals',{value:'1 12 123 2026',size:26,system:'Cistercian'}),
 signature:single('signature',{text:'YOUR NAME',date:'2026',size:7,layout:'Two lines',font:'Hand'})};
 const ex=EXAMPLES.find(e=>e.name==='Stitch Type · Letters made of cells');
 projects['custom-motif']={app:'muusia',v:1,name:ex.name,canvas:ex.canvas,root:{...ex.make(defaults),outputId:9002}};
 for(const [id,motion,extra] of [['poetry-shift','Shift',{text:'TYPE',mode:'Fill region',size:5,shiftPattern:'Rows'}],['poetry-zoom','Zoom',{text:'N',size:2.5,zoomRows:28,zoomCycle:'In & out'}]]) projects[id]=single('concrete',{...extra,motion,clock:'Timeline',cycles:1});
 return projects;
}
export function evaluate(patch,frameIdx=0,frameCount=36){const cache=new Map(),byId=Object.fromEntries(patch.root.nodes.map(n=>[n.id,n]));
 const ev=id=>{if(cache.has(id))return cache.get(id);const n=byId[id],d=definitions[n.type],ins=[];
 for(const e of patch.root.edges.filter(e=>e.to===id)){const r=ev(e.from);ins[e.toPort]=Array.isArray(r)?r[e.fromPort]:r;}
 const r=d.compute(ins,n.params,{...patch.canvas,frameIdx,frameCount},n);cache.set(id,r);return r;};
 const out=ev(patch.root.outputId||patch.root.nodes.at(-1).id);return Array.isArray(out)?out[1]:out;
}
export function svg(result,canvas){return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.W}mm" height="${canvas.H}mm" viewBox="0 0 ${canvas.W} ${canvas.H}" fill="none" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${result.paths.map(p=>`<path stroke="${PENS[p.layer].c}" d="${p.pts.map((pt,i)=>(i?'L':'M')+pt.slice(0,2).map(v=>+v.toFixed(3)).join(' ')).join('')}${p.closed?'Z':''}"/>`).join('')}</svg>`;}
