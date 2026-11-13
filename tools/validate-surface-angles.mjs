import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { createStrip } from '../src/surface-composer.js';
import { surfaceEdgeAngles, edgeAngleArc, formatEdgeAngle } from '../src/surface-angles.js';
import { assemblySettings } from '../src/surface-assembly.js';
import { readSurfaceSession } from '../src/surface-session.js';
const paper=(id,angle=0,extra={})=>createStrip({id,physicalWidthMm:20,printableWidthMm:20,printableOffsetMm:0,lengthMm:100,centerXmm:0,centerYmm:0,rotationDeg:angle,zIndex:id==='a'?10:11,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const angles=a=>a.map(v=>v.angleDeg).sort((a,b)=>a-b);
test('crossing rectangles show both analytic 45 and 135 degree edge openings, not just rotation delta',()=>{
 const out=surfaceEdgeAngles([paper('a'),paper('b',45)]);assert.equal(out.length,4);
 const sorted=angles(out);[45,45,135,135].forEach((n,i)=>near(n,sorted[i]));
 for(const a of out){const arc=edgeAngleArc(a,[0,0],5);near(Math.hypot(...arc[0]),5);near(Math.hypot(...arc.at(-1)),5);near(Math.atan2(arc[0][1],arc[0][0]),Math.atan2(Math.sin(a.startRad),Math.cos(a.startRad)));assert.notEqual(a.from.paperId,a.to.paperId);}
 assert.equal(formatEdgeAngle(97.095),'97.1°');
});
test('common rigid motion preserves every opening and transforms its physical vertex',()=>{
 const before=surfaceEdgeAngles([paper('a'),paper('b',45)]),theta=63*Math.PI/180;
 const after=surfaceEdgeAngles([paper('a',63,{centerXmm:123,centerYmm:-88}),paper('b',108,{centerXmm:123,centerYmm:-88})]);
 angles(before).forEach((n,i)=>near(n,angles(after)[i]));
 for(const a of before){const v=[123+a.vertex[0]*Math.cos(theta)-a.vertex[1]*Math.sin(theta),-88+a.vertex[0]*Math.sin(theta)+a.vertex[1]*Math.cos(theta)];assert.ok(after.some(b=>Math.hypot(v[0]-b.vertex[0],v[1]-b.vertex[1])<1e-7));}
});
test('higher sheets hide covered junctions; a background sheet does not hide visible seams',()=>{
 const a=paper('a'),b=paper('b',45),cover=paper('cover',0,{physicalWidthMm:200,printableWidthMm:200,lengthMm:200,zIndex:20});
 assert.equal(surfaceEdgeAngles([a,b,cover]).length,0);
 assert.equal(surfaceEdgeAngles([{...cover,zIndex:0},a,b]).length,4);
 assert.equal(surfaceEdgeAngles([{...a,zIndex:0},{...b,zIndex:0},{...cover,zIndex:0}]).length,0);
});
test('hidden papers preserve displayed paper numbers and original geometry remains untouched',()=>{
 const input=[paper('hidden',10,{visible:false}),paper('a'),paper('b',45)],before=JSON.stringify(input),out=surfaceEdgeAngles(input);
 assert.equal(JSON.stringify(input),before);assert.ok(out.every(a=>[a.from.number,a.to.number].every(n=>n===2||n===3)));
});
test('parallel, disjoint and flat touching boundaries create no false opening marks',()=>{
 assert.deepEqual(surfaceEdgeAngles([paper('a')]),[]);
 assert.deepEqual(surfaceEdgeAngles([paper('a'),paper('b',0,{centerXmm:40})]),[]);
 assert.deepEqual(surfaceEdgeAngles([paper('a'),paper('b',0,{centerXmm:20})]),[]);
 assert.throws(()=>surfaceEdgeAngles(Array.from({length:129},(_,i)=>paper(String(i)))),/128/);
});
test('the user example has six visible edge junctions with the correct acute and obtuse openings',()=>{
 const project=JSON.parse(fs.readFileSync(new URL('../docs/examples/surface-context-assembly.muusia.json',import.meta.url)));
 const out=surfaceEdgeAngles(project.surfaceLayouts.Sheets.strips);assert.equal(out.length,6);
 [28.8633312564,61.1366687436,87.3613596987,92.6386403013,97.0950053539,144.0416633897].forEach((n,i)=>near(n,angles(out)[i]));
 const session=project.surfaceLayouts.Sheets;assert.equal(readSurfaceSession(session).assembly.edgeAngles,true);
 const hidden=readSurfaceSession({...session,assembly:{...session.assembly,edgeAngles:false}});assert.equal(hidden.assembly.edgeAngles,false);assert.equal(assemblySettings(hidden.assembly).edgeAngles,false);
 assert.throws(()=>assemblySettings({edgeAngles:1}),/Invalid assembly/);
});
