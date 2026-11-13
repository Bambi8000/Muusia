import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStrip, stripTransform } from '../src/surface-composer.js';
import { createSurfaceSession, readSurfaceSession } from '../src/surface-session.js';
import { prepareSurfaceSource } from '../src/surface-source.js';
import { surfacePaperContext, paperLocalPaths, resolveSurfaceContent } from '../src/surface-content.js';
import { assemblySettings, assemblyModel, paperRelation, extendedPaper, endLabelPaths, labelCutSvg } from '../src/surface-assembly.js';
import { paperBudget, productionPlan } from '../src/surface-production.js';
import { surfaceExportPlan } from '../src/surface-export.js';
const paper = extra => createStrip({id:'a',physicalWidthMm:80,printableWidthMm:70.8,printableOffsetMm:4.6,lengthMm:1000,centerXmm:120,centerYmm:900,rotationDeg:37,contentMode:'independent',...extra});
const session = () => ({...createSurfaceSession(),mode:'freeform',widthMm:400,heightMm:2000,selectedId:'a',strips:[paper(),paper({id:'b',centerXmm:300,rotationDeg:80,printOrder:2}),paper({id:'h',visible:false})],source:{kind:'graph',nodeId:1,graphPath:[],fit:'contain',image:null}});
test('paper context uses original IDs, visible print rank, measured geometry and deterministic stable seeds',()=>{
 const s=session(),a=surfacePaperContext(s,s.strips[0]); assert.equal(a.number,1);assert.equal(a.count,2);assert.equal(a.widthMm,80);assert.equal(a.lengthMm,1000);assert.equal(a.rotationDeg,37);assert.equal(a.distanceMm,Math.hypot(-80,-100));
 const reordered={...s,strips:s.strips.map(p=>({...p,printOrder:3-p.printOrder,zIndex:88}))};assert.equal(surfacePaperContext(reordered,s.strips[0]).seed,a.seed);assert.notEqual(surfacePaperContext(s,s.strips[1]).seed,a.seed);assert.notEqual(surfacePaperContext({...s,contentSeed:9},s.strips[0]).seed,a.seed);
});
test('independent graphs evaluate at full local dimensions once per paper; resumed ranges keep original sample and context',async()=>{
 const s=session(), calls=[];
 const source=await prepareSurfaceSource(s,(W,H,path,id,ctx)=>{calls.push({W,H,ctx});return {paths:[{pts:[[40,0,2],[40,H,8]],layer:2,closed:false}]};});
 const all=paperLocalPaths(source,s,s.strips[0]),part=paperLocalPaths(source,s,s.strips[0],200,350);
 assert.equal(all.paths[0].pts[1][1],1000);assert.deepEqual(part.paths[0].pts.map(p=>p.slice(0,2)),[[40,0],[40,150]]);assert.equal(part.paths[0].layer,2);assert.ok(Math.abs(part.paths[0].pts[0][2]-3.2)<1e-9);
 assert.equal(calls.filter(c=>c.ctx?.number===1).length,1);assert.equal(calls.find(c=>c.ctx?.number===1).H,1000);
 const resolved=resolveSurfaceContent(source,s,s.strips[0],200,350);assert.equal(resolved.frame.heightMm,1000);assert.equal(resolved.strip.rotationDeg,0);assert.equal(resolved.strip.centerYmm,275);
 assert.throws(()=>resolveSurfaceContent({paths:[]},s,s.strips[0]),/must be evaluated/);
});
test('mapped papers keep global pose while independent papers ignore placement except graph context',async()=>{
 const s=session();s.strips[1].contentMode='image-mapping'; const source=await prepareSurfaceSource(s,(W,H)=>({paths:[{pts:[[0,0],[W,H]],layer:0}]}));
 const r=resolveSurfaceContent(source,s,s.strips[1],100,200);assert.equal(r.frame,s);assert.equal(r.strip.rotationDeg,80);assert.deepEqual(stripTransform(r.strip).toGlobal([0,0]),stripTransform(s.strips[1]).toGlobal([0,100]));
});
test('labels extend the tail without shifting body corners, length budget includes labels and mechanical allowance',()=>{
 const s=session();s.production.trimMarks=false;s.assembly=assemblySettings({labelMode:'tear',labelLengthMm:32,cutterFeedMm:20});
 const original=stripTransform(s.strips[0]),extended=stripTransform(extendedPaper(s.strips[0],s.assembly));
 for(const pt of [[0,0],[80,0],[80,1000],[0,1000]]) original.toGlobal(pt).forEach((v,i)=>assert.ok(Math.abs(v-extended.toGlobal(pt)[i])<1e-9));
 const b=paperBudget(s.strips,s.production,s.assembly);assert.equal(b.artworkM,2);assert.equal(b.labelsM,.064);assert.equal(b.allowanceM,.08);assert.equal(b.totalM,2.144);
 assert.equal(productionPlan(s).ranges.length,1);assert.equal(productionPlan(s).totalM,1.072);
 const plan=surfaceExportPlan(s,{selectedOnly:true});assert.equal(plan.entries[0].plan.heightMm,1032);assert.equal(plan.manifest.strips[0].bodyLengthMm,1000);assert.equal(plan.manifest.strips[0].contentMode,'independent');
});
test('label switches, resume text and isolated cut guide never add a cut path to the artwork',()=>{
 const s=session(); assert.equal(endLabelPaths(s,s.strips[0]).paths.length,0);
 s.assembly=assemblySettings({labelMode:'tear',bridgeMm:1.5});const label=endLabelPaths(s,s.strips[0],{fromMm:200,toMm:350});
 assert.ok(label.paths.length);assert.ok(label.paths.every(p=>p.pts.every(([x,y])=>x>=4.6&&x<=75.4&&y>=150&&y<=182)));assert.deepEqual(label.cutPaths[0].pts,[[1.5,150],[80,150]]);
 assert.match(labelCutSvg(s,s.strips[0]),/M1.5 1000H80/);
 s.assembly=assemblySettings({labelMode:'tear',numbers:false,registration:false,dimensions:false});assert.deepEqual(endLabelPaths(s,s.strips[0]).paths,[]);
});
test('assembly pairs have analytic centre distances/bearings/relative angles and exact rotated corner registration',()=>{
 const s=session();s.strips=[paper({centerXmm:0,centerYmm:0,rotationDeg:350}),paper({id:'b',centerXmm:3,centerYmm:4,rotationDeg:10,printOrder:2})];
 const m=assemblyModel(s);assert.equal(m.papers.length,2);assert.deepEqual(m.papers[0].A,stripTransform(s.strips[0]).toGlobal([0,0]));const r=paperRelation(m.papers[0],m.papers[1]);assert.equal(r.distanceMm,5);assert.equal(r.relativeAngleDeg,20);assert.equal(r.bearingDeg,Math.atan2(4,3)*180/Math.PI);
});
test('project retains content mode/seed and assembly preferences, rejects invalid saved settings',()=>{
 const s=session();s.contentSeed=42;s.assembly=assemblySettings({labelMode:'tear'});assert.deepEqual(readSurfaceSession(JSON.parse(JSON.stringify(s))),s);
 for(const extra of [{contentSeed:-1},{contentSeed:1.5},{assembly:{labelLengthMm:0}},{assembly:{bridgeMm:-1}},{assembly:{numbers:1}},{assembly:{labelMode:'bad'}}])assert.throws(()=>readSurfaceSession({...s,...extra}));
});

test('nearest edge gap distinguishes separated rotated rectangles, touching and overlapping papers',()=>{
 const a=paper({centerXmm:0,centerYmm:0,rotationDeg:0});
 assert.equal(paperRelation(a,paper({id:'b',centerXmm:100,centerYmm:0,rotationDeg:0})).edgeGapMm,20);
 assert.equal(paperRelation(a,paper({id:'b',centerXmm:80,centerYmm:0,rotationDeg:0})).overlap,false);
 assert.equal(paperRelation(a,paper({id:'b',centerXmm:79,centerYmm:0,rotationDeg:0})).overlap,true);
 const r=paperRelation(a,paper({id:'b',centerXmm:0,centerYmm:2000,rotationDeg:90}));
 assert.equal(r.edgeGapMm,1460);assert.equal(r.overlap,false);
});
test('measured internal-cut allowance includes body tail and label blank once, preserving explicit saved overrides',()=>{
 const s=session();s.production.trimMarks=false;s.assembly=assemblySettings({labelMode:'tear'});
 assert.equal(s.assembly.cutterFeedMm,17);
 const plan=productionPlan(s);assert.equal(plan.ranges.length,1);assert.equal(plan.totalM,1.069);
 const old={...s,assembly:{...s.assembly,cutterFeedMm:20}};
 assert.equal(readSurfaceSession(old).assembly.cutterFeedMm,20);
 assert.ok(Math.abs(productionPlan(old).totalM-plan.totalM-.003)<1e-9);
 assert.deepEqual(endLabelPaths(s,s.strips[0]),endLabelPaths(old,old.strips[0]));
 assert.equal(paperBudget(s.strips,s.production,s.assembly).allowanceM,.074);
});
