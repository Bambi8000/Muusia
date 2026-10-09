import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {motions, recipes, animationPages} from './content.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const writeJSON=(file,value)=>fs.writeFile(file,JSON.stringify(value)+'\n');

export async function englishProposals() {
  const lines=(await fs.readFile(path.join(HERE,'proposals.en.tsv'),'utf8')).trim().split('\n');
  assert.equal(lines.shift(),'key\tidea\tnote');
  const entries=lines.map((line,i)=>{
    const fields=line.split('\t');
    assert.ok(fields.length===3&&fields.every(Boolean),`English proposal row ${i+2}`);
    return [fields[0],{idea:fields[1],note:fields[2]}];
  });
  assert.equal(new Set(entries.map(([key])=>key)).size,entries.length,'Duplicate English proposal');
  return Object.fromEntries(entries);
}

/** An editorial edition of the captured studies. Never rerun or rewrite captures here. */
export async function buildAnimation(site) {
  const out=path.join(site,'animation'), combined=path.join(out,'combine-movements'), auditOut=path.join(out,'node-motion');
  const source=path.join(ROOT,'docs/animation-examples'), composite=path.join(ROOT,'docs/animation-composite'), auditSource=path.join(ROOT,'docs/animation-audit');
  await Promise.all([out,combined,auditOut,path.join(out,'patches')].map(dir=>fs.mkdir(dir,{recursive:true})));
  for(const [template,dest] of [['examples.html',out],['composite.html',combined],['audit.html',auditOut]]) {
    let html=await fs.readFile(path.join(HERE,template),'utf8');
    const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
    assert.ok(script,`${template}: module script`);
    await fs.writeFile(path.join(dest,'study.js'),script[1]);
    html=html.replace(script[0],'<script type="module" src="./study.js"></script>');
    await fs.writeFile(path.join(dest,'index.html'),html);
  }
  const examples=await json(path.join(source,'data.json'));
  assert.deepEqual(examples.map(e=>e.key).sort(),Object.keys(motions).sort());
  await writeJSON(path.join(out,'data.json'),examples.map(e=>({...e,...motions[e.key]})));
  const provenance={schemaVersion:1,language:'en',scope:'English editorial edition. Only project names and teaching text change; graphs, canvas, preview geometry and measurements are preserved. Browser records describe the original source patches, linked below by checksum.',patches:[]};
  for(const example of examples) {
    const relative=`patches/${example.key}.muusia.json`, bytes=await fs.readFile(path.join(source,relative));
    const patch={...JSON.parse(bytes),name:motions[example.key].title};
    const published=JSON.stringify(patch,null,2)+'\n';
    await fs.writeFile(path.join(out,relative),published);
    provenance.patches.push({key:example.key,source:`docs/animation-examples/${relative}`,sourceSha256:sha(bytes),sourceJsonSha256:sha(JSON.stringify(JSON.parse(bytes))),published:`animation/${relative}`,publishedSha256:sha(published),changedFields:['name']});
    await fs.copyFile(path.join(source,`${example.key}.svg`),path.join(out,`${example.key}.svg`));
  }
  await writeJSON(path.join(out,'provenance.json'),provenance);
  for(const file of ['checks.json','browser-checks.json']) await fs.copyFile(path.join(source,file),path.join(out,file));
  for(const file of ['data.json','checks.json','browser-checks.json','grid-hairs-solids.muusia.json','first-frame.svg','contact-sheet.svg']) await fs.copyFile(path.join(composite,file),path.join(combined,file));
  const audit=await json(path.join(auditSource,'audit.json')), translations=await englishProposals();
  assert.deepEqual(audit.nodes.map(n=>n.key).sort(),Object.keys(translations).sort(),'English inventory covers the complete source study');
  audit.nodes=audit.nodes.map(n=>({...n,...translations[n.key]}));
  await writeJSON(path.join(auditOut,'audit.json'),audit);
  const probes=await json(path.join(auditSource,'probes.json')), previews=await json(path.join(auditSource,'previews.json'));
  assert.deepEqual(probes.probes.map(p=>p.key).sort(),Object.keys(recipes).sort());
  probes.probes=probes.probes.map(p=>({...p,...recipes[p.key]}));
  await writeJSON(path.join(auditOut,'probes.json'),probes);
  await writeJSON(path.join(auditOut,'previews.json'),previews.map(p=>({...p,...recipes[p.key]})));
  await fs.writeFile(path.join(auditOut,'proposals.tsv'),['key\tstatus\tmotion\tcontrols\tidea\tnote',...audit.nodes.map(n=>[n.key,n.status,n.motion,n.controls.map(p=>p.key).join(','),n.idea,n.note].join('\t'))].join('\n')+'\n');
  return animationPages.length;
}
