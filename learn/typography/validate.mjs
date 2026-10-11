import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {TEXT_KEYS,definitions,fixtures,evaluate,svg} from './fixtures.mjs';
import {guides,typographyPages} from './content.mjs';
import {validateTypographyCapture} from './validate-capture.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export async function validateTypography(site){
 await validateTypographyCapture();
 assert.deepEqual(TEXT_KEYS.slice().sort(),Object.keys(guides).sort());
 for(const page of typographyPages)assert.ok((await fs.readFile(path.join(site,page),'utf8')).includes('<main'));
 const ref=await fs.readFile(path.join(site,'typography/nodes/index.html'),'utf8');
 for(const key of TEXT_KEYS){assert.ok(ref.includes(`id="${key}"`));for(const p of definitions[key].params)assert.ok(ref.includes(p.label.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')),key+'.'+p.key);}
 const projects=await fixtures();const checks=JSON.parse(await fs.readFile(path.join(site,'typography/checks.json'),'utf8'));
 for(const [id,patch] of Object.entries(projects)){
 const bytes=await fs.readFile(path.join(site,`typography/patches/${id}.muusia.json`));assert.deepEqual(JSON.parse(bytes),patch,id+' patch');
 for(const n of patch.root.nodes){const d=definitions[n.type];assert.ok(d,n.type);for(const [key,value] of Object.entries(n.params)){const pd=d.params.find(p=>p.key===key);assert.ok(pd,n.type+'.'+key);if(pd.options)assert.ok(pd.options.includes(value),key+' option');}}
 for(const e of patch.root.edges){const a=patch.root.nodes.find(n=>n.id===e.from),b=patch.root.nodes.find(n=>n.id===e.to);assert.equal(definitions[a.type].outs[e.fromPort].type,definitions[b.type].ins[e.toPort].type);}
 const result=evaluate(patch,id==='poetry-zoom'?9:0), art=await fs.readFile(path.join(site,`assets/typography/${id}.svg`),'utf8');assert.equal(art,svg(result,patch.canvas));
 const record=checks.records.find(r=>r.id===id);assert.equal(record.patchSha256,sha(bytes));assert.equal(record.svgSha256,sha(art));
 }
 for(const id of ['concrete','poetry-shift','poetry-zoom'])for(const frames of [24,48]){const patch=projects[id];const first=evaluate(patch,0,frames);assert.deepEqual(first,evaluate(patch,frames,frames),id+' periodic endpoint');const outcomes=[];for(let f=0;f<frames;f++){const r=evaluate(patch,f,frames);assert.ok(r.paths.every(p=>p.pts.every(pt=>pt.every(Number.isFinite))));outcomes.push(sha(JSON.stringify(r)));}assert.ok(new Set(outcomes).size>1,id+' moves');}
 const audit=JSON.parse(await fs.readFile(path.join(site,'typography/research/inventory.json')));assert.equal(audit.length,311);
 const specimens=JSON.parse(await fs.readFile(path.join(site,'typography/research/specimens.json')));assert.equal(specimens.length,12);
 for(const s of specimens){assert.ok((await fs.stat(path.join(site,`typography/research/patches/${s.id}.muusia.json`))).size);assert.ok((await fs.stat(path.join(site,`typography/research/assets/${s.id}.svg`))).size);}
 const lesson=await fs.readFile(path.join(site,'typography/index.html'),'utf8');for(const id of ['type-play','type-motion','type-frames','type-art','type-scrub'])assert.ok(lesson.includes(`id="${id}"`));
 const player=await fs.readFile(path.join(site,'assets/typography/player.js'),'utf8');assert.ok(player.length>1000&&!/from\s*['"](?:\.\.\/)*src\//.test(player));
 console.log('Typography passed: 14 text references, 17 generated projects, 12 preserved study patches, 216 animated frames and complete survey.');
}
