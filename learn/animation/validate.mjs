import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {motions,recipes,animationPages} from './content.mjs';
import {englishProposals} from './build.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>fs.readFile(file,'utf8');
const json=async file=>JSON.parse(await read(file));
const same=(a,b,message)=>assert.deepEqual(a,b,message);

export async function validateAnimation(site) {
  const out=path.join(site,'animation'), source=path.join(ROOT,'docs/animation-examples');
  const composite=path.join(ROOT,'docs/animation-composite'), combined=path.join(out,'combine-movements');
  const auditSource=path.join(ROOT,'docs/animation-audit'), auditOut=path.join(out,'node-motion');
  const translations=await englishProposals();
  const audit=await json(path.join(auditSource,'audit.json')), publishedAudit=await json(path.join(auditOut,'audit.json'));
  same(Object.keys(translations).sort(),audit.nodes.map(n=>n.key).sort(),'Every reviewed node needs an English proposal');
  same(publishedAudit,{...audit,nodes:audit.nodes.map(n=>({...n,...translations[n.key]}))},'English inventory must preserve the reviewed controls and statuses');
  const table=(await read(path.join(auditOut,'proposals.tsv'))).trim().split('\n');
  same(table.length,audit.nodes.length+1,'Download includes the complete inventory');
  for(const line of table.slice(1)) assert.equal(line.split('\t').length,6,'Six TSV columns');
  const probes=await json(path.join(auditSource,'probes.json')), previews=await json(path.join(auditSource,'previews.json'));
  same(await json(path.join(auditOut,'probes.json')),{...probes,probes:probes.probes.map(p=>({...p,...recipes[p.key]}))},'Probe measurements unchanged');
  same(await json(path.join(auditOut,'previews.json')),previews.map(p=>({...p,...recipes[p.key]})),'Probe preview geometry unchanged');
  assert.equal(previews.length,8);
  for(const p of previews) assert.equal(p.frames.length,48,`${p.key}: preview frame count`);

  const examples=await json(path.join(source,'data.json')), checks=await json(path.join(source,'checks.json'));
  const browser=await json(path.join(source,'browser-checks.json'));
  same(await json(path.join(out,'data.json')),examples.map(e=>({...e,...motions[e.key]})),'Gallery translations must preserve frames and measurements');
  assert.equal(examples.length,6);
  const provenance=await json(path.join(out,'provenance.json'));
  assert.equal(provenance.patches.length,examples.length);
  for(const e of examples) {
    const relative=`patches/${e.key}.muusia.json`, original=await read(path.join(source,relative)), published=await read(path.join(out,relative));
    same(JSON.parse(published),{...JSON.parse(original),name:motions[e.key].title},`${e.key}: only project name may change`);
    const record=provenance.patches.find(p=>p.key===e.key), checked=checks.examples.find(p=>p.key===e.key);
    assert.ok(record&&checked);
    assert.equal(record.sourceSha256,sha(original)); assert.equal(record.publishedSha256,sha(published));
    assert.equal(record.sourceJsonSha256,sha(JSON.stringify(JSON.parse(original))));
    assert.equal(record.sourceJsonSha256,checked.patchSha256); assert.equal(record.sourceJsonSha256,browser.patchHashes[e.key]);
    same(record.changedFields,['name']);
    same(record.published,`animation/${relative}`);
    same(record.source,`docs/animation-examples/${relative}`);
    same(e.runs,checked.runs,`${e.key}: displayed metrics match checks`);
    for(const n of [36,48]) assert.equal(e.frames[n].length,n,`${e.key}: ${n} stored frames`);
    same(await read(path.join(out,`${e.key}.svg`)),await read(path.join(source,`${e.key}.svg`)),`${e.key}: contact sheet unchanged`);
    for(const run of checked.runs) assert.ok(run.virtualEndpointMaxMm<1e-7,`${e.key}: endpoint does not close`);
    assert.ok(browser.exports.some(p=>p.key===e.key&&p.frame===0),`${e.key}: missing actual browser export`);
  }
  for(const item of browser.exports) {
    const run=checks.examples.find(e=>e.key===item.key)?.runs.find(r=>r.frames===item.frames);
    assert.ok(run); const expected=item.frame===0?run.firstSvg:run.middleSvg;
    same([item.fnv,item.paths,item.points],[expected.fnv,expected.paths,expected.points],`${item.key}: captured SVG matches geometry`);
    same(item.page,['140mm','140mm']);
  }
  for(const file of ['checks.json','browser-checks.json']) same(await read(path.join(out,file)),await read(path.join(source,file)),`Gallery ${file}: preserve original capture record`);
  for(const file of ['data.json','checks.json','browser-checks.json','grid-hairs-solids.muusia.json','first-frame.svg','contact-sheet.svg']) same(await read(path.join(combined,file)),await read(path.join(composite,file)),`Combined study ${file}: exact source copy`);
  const combinedChecks=await json(path.join(composite,'checks.json')), combinedBrowser=await json(path.join(composite,'browser-checks.json'));
  assert.equal(sha(JSON.stringify(await json(path.join(composite,'grid-hairs-solids.muusia.json')))),combinedChecks.patchSha256);
  assert.equal(combinedBrowser.patchSha256,combinedChecks.patchSha256);
  const svgPaths=[...(await read(path.join(combined,'first-frame.svg'))).matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(sha(svgPaths.join('|')),combinedChecks.runs[0].firstSvg.sha256,'First SVG ordered path checksum');
  for(const item of combinedBrowser.exports) {
    const run=combinedChecks.runs.find(r=>r.frames===item.frames);
    assert.ok(run);
    const expected=item.frame===0?run.firstSvg:item.frame===item.frames/2?run.middleSvg:item.frame===run.reportedFrameSvg?.frame?run.reportedFrameSvg:null;
    assert.ok(expected,'Known combined browser capture frame');
    same([item.fnv,item.paths,item.points],[expected.fnv,expected.paths,expected.points],'Combined browser capture matches geometry');
    same(item.page,['140mm','140mm']);
  }
  const combinedData=await json(path.join(combined,'data.json'));
  same(combinedData.runs,combinedChecks.runs);
  for(const run of combinedChecks.runs) {
    assert.equal(combinedData.frames[run.frames].length,run.frames);
    assert.ok(run.virtualEndpointMaxMm<0.001,'Combined endpoint within clipping tolerance');
  }

  // Only the editable example dependencies are freshness gates. The 310-node
  // audit is a dated design snapshot; its historical full App.jsx hash is not.
  const app=await read(path.join(ROOT,'src/App.jsx'));
  function scope(start,end) {
    const a=app.indexOf(start), b=app.indexOf(end,a);
    assert.ok(a>=0&&b>a,`Animation source selector missing: ${start}`);
    return sha(app.slice(a,b));
  }
  for(const capture of [checks,browser,combinedChecks,combinedBrowser]) {
    assert.equal(scope('function defIns(node)','/* ============================================================\n   G-CODE'),capture.engineScopeSha256,'Animation evaluator changed; recapture affected examples');
    assert.equal(scope('function toSVG(ps, ctx)','/* --- DXF R12 export'),capture.exportScopeSha256,'Animation SVG exporter changed; recapture affected examples');
    for(const [file,expected] of Object.entries(capture.sourceHashes)) {
      assert.notEqual(file,'src/App.jsx','Do not hash the whole App.jsx as a release gate');
      assert.equal(sha(await fs.readFile(path.join(ROOT,file))),expected,`${file}: animation dependency changed; recapture affected examples`);
    }
  }
  // Check dynamically selected assets as well as the static links checked by
  // Learn's general root/subdirectory link walker.
  const englishText=[...Object.values(translations).flatMap(x=>Object.values(x)),...Object.values(motions).flatMap(x=>Object.values(x))].join('\n');
  assert.ok(!/\b(?:ruutua|kynä|Kokeile|liikkuu|sauma|piirros|Toista|Lataa)\b/iu.test(englishText),'Untranslated teaching copy');
  for(const page of animationPages) {
    const html=await read(path.join(site,page)), js=await read(path.join(site,path.dirname(page),'study.js'));
    assert.ok(html.includes('lang="en"')&&html.includes('id="main"'));
    assert.ok(!/\b(?:Toista|Pysäytä|Lataa|Ruutuja|Nykyiset|Kokeiltavissa)\b/iu.test(html+js),'Untranslated page UI');
    assert.ok(!html.includes('../../src/')&&!js.includes('../../src/'),'Do not publish broken repository source links');
  }
  console.log('Animation studies validated: 310 English proposals, 8 preserved probes, 7 unchanged graphs, preview data, capture provenance and selected source scopes.');
}
