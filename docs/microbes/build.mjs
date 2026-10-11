import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import def from '../../src/defs/nodes/microbes.js';
import {PENS_DEFAULT} from '../../src/defs/helpers.js';
import {EXAMPLES} from '../../src/examples.js';
const dir=path.dirname(fileURLToPath(import.meta.url));
const defaults=()=>Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const ids=['living-microscope','single-cell','swimming-bacteria','specimen-collection'];
for(const [i,ex] of EXAMPLES.filter(e=>e.name.startsWith('Microbes ·')).entries()){
 const root=ex.make(defaults),patch={app:'muusia',v:1,name:ids[i],canvas:ex.canvas,root};
 fs.writeFileSync(path.join(dir,ids[i]+'.muusia.json'),JSON.stringify(patch,null,2)+'\n');
 const paths=def.compute([],root.nodes[0].params,{...ex.canvas,frameIdx:0,frameCount:24}).paths;
 const body=paths.map(p=>`<path fill="none" stroke="${PENS_DEFAULT[p.layer].c}" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round" d="M${p.pts.map(q=>q.map(v=>v.toFixed(3)).join(',')).join('L')}${p.closed?'Z':''}"/>`).join('\n');
 fs.writeFileSync(path.join(dir,ids[i]+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${ex.canvas.W}mm" height="${ex.canvas.H}mm" viewBox="0 0 ${ex.canvas.W} ${ex.canvas.H}"><title>${ex.name}</title>\n${body}\n</svg>\n`);
}
console.log('Microbes: four reproducible patches and vector studies');
