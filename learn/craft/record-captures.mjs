// Run only after actually capturing the corresponding UI/exports. Never run in the build.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {lessons} from './content.mjs';
import {HERE,ROOT,patches,definitions,engineSource,exporterSource} from './fixtures.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),record=file=>({file,sha256:sha(fs.readFileSync(path.join(HERE,file)))}),receipt={schemaVersion:1,appVersion:'2.130',capturedAt:'2026-10-19',sourceCommit:'f881d9ef3adfe82596807ea3b38186880292ae4c',scope:'Actual local Muusia build containing Craft nodes. Twelve original SVG exports, twelve Focus screenshots and twelve fresh graph screenshots; source cards minimized for readability. Ten actual 12-frame SVG batch exports. No pixel retouching, hardware execution or publication.',engineScopeSha256:sha(engineSource),exportScopeSha256:sha(exporterSource),sourceHashes:Object.fromEntries([...Object.keys(definitions).map(k=>'src/defs/nodes/'+k+'.js'),'src/defs/helpers.js'].map(file=>[file,sha(fs.readFileSync(path.join(ROOT,file)))])),lessons:[]};
for(const l of lessons){const captures=[];for(const kind of ['graph','focus']){const file='assets/'+l.id+'-'+kind+'.png',b=fs.readFileSync(path.join(HERE,file));assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');captures.push({...record(file),view:kind,width:b.readUInt32BE(16),height:b.readUInt32BE(20),graphZoom:kind==='graph'?.5787037037037038:1});}const r={id:l.id,patch:record('patches/'+l.id+'.muusia.json'),svg:record('assets/'+l.id+'.svg'),captures};if(l.animation.kind!=='still'){const file='animations/'+l.id+'.zip',zip=unzipSync(fs.readFileSync(path.join(HERE,file)));assert.equal(Object.keys(zip).length,12);r.animation={...record(file),frames:12,patch:record('patches/'+l.id+'-animation.muusia.json')};}assert.ok(patches[l.id]);receipt.lessons.push(r);}
fs.writeFileSync(path.join(HERE,'capture-manifest.json'),JSON.stringify(receipt,null,2)+'\n');console.log('Recorded 24 actual UI captures, 12 SVGs and 10 real animation ZIPs.');
