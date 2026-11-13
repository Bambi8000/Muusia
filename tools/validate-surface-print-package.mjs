import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync,strFromU8} from 'fflate';
import {createSurfaceSession} from '../src/surface-session.js';
import {createStrip} from '../src/surface-composer.js';
import {assemblySettings} from '../src/surface-assembly.js';
import {surfacePrintPackagePlan,exportSurfacePrintPackage,SURFACE_PRINT_PROFILE} from '../src/surface-print-package.js';
const s=()=>({...createSurfaceSession(),mode:'freeform',strips:[createStrip({id:'b',centerXmm:0,centerYmm:0,lengthMm:1000,printOrder:2}),createStrip({id:'a',centerXmm:0,centerYmm:0,lengthMm:1000,printOrder:1}),createStrip({id:'hidden',lengthMm:1000,visible:false})],selectedId:'a',production:{...createSurfaceSession().production,trimMarks:false},assembly:assemblySettings({labelMode:'tear'})});
const services={source:{paths:[]},renderReceipt:async(session,range)=>{const d=SURFACE_PRINT_PROFILE.dotsPerMm,body=Math.ceil(range.lengthMm*d-1e-9),height=body+Math.ceil(32*d-1e-9);return {width:512,height,data:Buffer.alloc(height*64).toString('base64'),cut:true,tearAtRow:body,name:range.originalId};}};
test('Print ZIP contains calibrated 1-bit jobs in visible print order and a manual-only manifest',async()=>{
 const out=await exportSurfacePrintPackage(s(),{projectName:'Test'},services),files=unzipSync(new Uint8Array(await out.blob.arrayBuffer())),m=JSON.parse(strFromU8(files['manifest.json']));
 assert.equal(m.format,'muusia-print-package');assert.equal(m.defaultPrintMode,'manual');assert.equal(m.strips.length,2);assert.deepEqual(m.strips.map(s=>s.stripId),['a','b']);assert.equal(Object.keys(files).length,3);
 const job=JSON.parse(strFromU8(files[m.strips[0].filename]));assert.equal(job.format,'muusia-surface-strip');assert.equal(job.profile.dotsPerMm,400/56.6);assert.equal(job.width,512);assert.equal(job.tearAtRow,7068);assert.equal(job.height,7295);assert.equal(job.geometry.bodyLengthMm,1000);assert.equal(job.geometry.labelLengthMm,32);assert.equal(Buffer.from(job.data,'base64').length,job.height*64);
});
test('selected Print file uses the original production range, while full ZIP always contains complete papers',async()=>{
 const input=s();input.production={...input.production,fromMm:200,toMm:350};const single=await exportSurfacePrintPackage(input,{selectedOnly:true},services),job=JSON.parse(await single.blob.text());assert.equal(single.count,1);assert.equal(job.geometry.fromMm,200);assert.equal(job.geometry.toMm,350);assert.equal(job.geometry.originalLengthMm,1000);assert.equal(job.geometry.bodyLengthMm,150);
 assert.ok(surfacePrintPackagePlan(input).ranges.every(r=>r.fromMm===0&&r.toMm===1000));
});
test('wrong width, excessive length/count/bytes and cancellation fail before printing or partial download',async()=>{
 const input=s();input.strips[0]={...input.strips[0],physicalWidthMm:100};assert.throws(()=>surfacePrintPackagePlan(input),/80 mm/);
 assert.throws(()=>surfacePrintPackagePlan({...s(),strips:[createStrip({id:'long',lengthMm:10000})]}),/too long/);
 assert.throws(()=>surfacePrintPackagePlan({...s(),strips:Array.from({length:65},(_,i)=>createStrip({id:String(i),lengthMm:100}))}),/64/);
 assert.throws(()=>surfacePrintPackagePlan({...s(),strips:Array.from({length:10},(_,i)=>createStrip({id:String(i),lengthMm:9000}))}),/32 MiB/);
 await assert.rejects(()=>exportSurfacePrintPackage(s(),{}, {...services,cancelled:()=>true}),/cancelled/);
});
