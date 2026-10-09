import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'docs/animation-audit');
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const all=[];
for(const file of fs.readdirSync(path.join(root,'src/defs/nodes')).filter(x=>x.endsWith('.js')).sort()) {
  const source='src/defs/nodes/'+file,def=(await import(path.join(root,source))).default;
  const help=app.slice(app.indexOf('const NODE_HELP ='));
  const match=help.match(new RegExp('\\b'+def.key+':\\s*("(?:[^"\\\\]|\\\\.)*")'));
  all.push({key:def.key,name:def.name,category:def.cat,group:def.group||'',hidden:!!def.hidden,description:def.desc||(match?JSON.parse(match[1]):''),source,sha256:hash(fs.readFileSync(path.join(root,source))),params:def.params.map(p=>({key:p.key,label:p.label,type:p.type,min:p.min,max:p.max,step:p.step,default:p.def,options:p.options,conditional:!!p.showIf}))});
}
all.push({key:'group',name:'Group',category:'duo',hidden:true,source:'src/App.jsx',params:[]},{key:'reititys',name:'Route',category:'route',hidden:true,source:'src/App.jsx',params:[{key:'preserve',label:'Preserve direction',type:'check',default:true}]});
const lines=fs.readFileSync(path.join(dir,'proposals.tsv'),'utf8').trimEnd().split('\n');
assert.equal(lines.shift(),'key\tstatus\tmotion\tcontrols\tidea\tnote');
const seen=new Set();
for(const line of lines) {
  const fields=line.split('\t');assert.equal(fields.length,6,'six columns');
  const [key,status,motion,controls,idea,note]=fields;
  assert.ok(!seen.has(key),'unique proposal '+key);seen.add(key);
  const node=all.find(n=>n.key===key);assert.ok(node,'known node '+key);
  assert.ok(['now','careful','extend','utility','legacy'].includes(status));
  assert.ok(['cycle','pulse','stepped','pipeline'].includes(motion));
  const selected=controls.split(',').filter(Boolean).map(k=>{const p=node.params.find(p=>p.key===k);assert.ok(p,key+': actual control '+k);return p;});
  assert.ok(idea.length>20&&note.length>20,'substantive proposal '+key);
  Object.assign(node,{status,motion,controls:selected,idea,note});
}
assert.equal(seen.size,all.length,'all built-ins covered, including hidden nodes');
assert.equal(all.length,310,'review new/removed nodes before regenerating');
all.sort((a,b)=>a.name.localeCompare(b.name,'en'));
const probes=JSON.parse(fs.readFileSync(path.join(dir,'probes.json')));
for(const [p,h] of Object.entries(probes.sourceHashes||{})) assert.equal(hash(fs.readFileSync(path.join(root,p))),h,'recapture changed probe source '+p);
assert.equal(Object.keys(probes.sourceHashes||{}).length,13,'probe source evidence');
assert.equal(probes.probes.length,8);
for(const p of probes.probes) for(const n of [24,48]) assert.ok(p.runs.some(r=>r.frames===n&&r.virtualEndpointMaxMm<1e-7&&r.deterministic));
const previews=JSON.parse(fs.readFileSync(path.join(dir,'previews.json')));
assert.equal(previews.length,8);previews.forEach(p=>assert.equal(p.frames.length,48));
const data={schemaVersion:1,reviewDate:'2026-10-07',baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),appVersion:app.match(/const APP_VERSION = "([^"]+)"/)[1],snapshot:'Uncommitted grid-hairs batch; not the published 2.112 source.',scope:'All built-in descriptors/source reviewed for design proposals; only the eight named recipes probed at 24/48 frames. No hardware tests, no animation implementation.',counts:Object.fromEntries(['now','careful','extend','utility','legacy'].map(s=>[s,all.filter(n=>n.status===s).length])),sourceHashes:Object.fromEntries(['src/App.jsx','src/defs/helpers.js','src/machine.js'].map(p=>[p,hash(fs.readFileSync(path.join(root,p)))])),nodes:all};
fs.writeFileSync(path.join(dir,'audit.json'),JSON.stringify(data,null,2)+'\n');
const json=v=>JSON.stringify(v).replaceAll('<','\\u003c');
const template=fs.readFileSync(path.join(dir,'template.html'),'utf8');
let html=template.replace('/*AUDIT_DATA*/',json(data)).replace('/*PROBE_DATA*/',json(probes)).replace('/*PREVIEW_DATA*/',json(previews));
assert.ok(!/\/\*(?:AUDIT|PROBE|PREVIEW)_DATA\*\//.test(html));
for(const m of template.matchAll(/(?:href|src)="([^"#?]+)"/g)) {
  if(m[1].includes('${')) continue; // Dynamic node links are checked below.
  if(!/^(https?:|data:)/.test(m[1])) assert.ok(fs.existsSync(path.resolve(dir,m[1])),'local link '+m[1]);
}
for(const node of all) assert.ok(fs.existsSync(path.join(root,node.source)),node.source);
fs.writeFileSync(path.join(dir,'index.html'),html);
console.log(JSON.stringify({nodes:all.length,hidden:all.filter(n=>n.hidden).length,counts:data.counts,recipes:probes.probes.length,frameRuns:16,bytes:Buffer.byteLength(html),report:'docs/animation-audit/index.html'},null,2));
