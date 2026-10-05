import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {NODE_RECENCY} from '../src/defs/node-recency-data.js';
import {compareNodeRecency,nodeRecencyLabel} from '../src/node-recency.js';

export async function validateNodeRecency(){
 const errors=[],keys=[];
 for(const file of fs.readdirSync('src/defs/nodes').filter(f=>f.endsWith('.js'))){
  const p='src/defs/nodes/'+file,{default:N}=await import(pathToFileURL(path.resolve(p))),r=NODE_RECENCY[N.key];keys.push(N.key);
  if(!r){errors.push('Missing '+N.key);continue;}
  if(!Number.isInteger(r.order)||r.order<0||r.date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(r.date))errors.push('Malformed '+N.key);
  if(createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==r.sha256)errors.push('Stale '+N.key);
 }
 for(const k of Object.keys(NODE_RECENCY))if(!keys.includes(k))errors.push('Orphan '+k);
 return errors;
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const errors=await validateNodeRecency();assert.deepEqual(errors,[],'Run node tools/make-node-recency.mjs: '+errors.join(', '));
 const h={a:{order:1,date:'2026-01-01'},b:{order:2,date:'2026-02-01'},c:{order:2,date:'2026-02-01'}};
 const rows=[['a',{name:'A'}],['z',{name:'Custom'}],['c',{name:'C'}],['b',{name:'B'}]];
 assert.deepEqual(rows.toSorted((a,b)=>compareNodeRecency(a,b,h)).map(r=>r[0]),['b','c','a','z']);
 assert.equal(nodeRecencyLabel('z',h),'Update date unavailable');
 assert.equal(nodeRecencyLabel('b',h),'Updated 2026-02-01');
 console.log('Recency: '+Object.keys(NODE_RECENCY).length+' current source records; ordering, ties and unknown dates pass');
}
