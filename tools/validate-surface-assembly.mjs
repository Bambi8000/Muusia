import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { createStrip } from '../src/surface-composer.js';
import { createSurfaceSession } from '../src/surface-session.js';
import { assemblySettings, assemblyPieces } from '../src/surface-assembly.js';
import { exportAssemblyPdf } from '../src/surface-assembly-pdf.js';
const paper = (id,x,angle=0) => createStrip({id,physicalWidthMm:80,printableWidthMm:70.8,printableOffsetMm:4.6,lengthMm:1000,centerXmm:x,centerYmm:500,rotationDeg:angle,printOrder:Math.max(1, Math.ceil(x/100))});
const session = () => ({...createSurfaceSession(),mode:'freeform',widthMm:300,heightMm:1000,strips:[paper('a',100),paper('b',200,45)],selectedId:'a',source:{kind:'graph',nodeId:1,graphPath:[],fit:'contain',image:null}});
const services={evaluateGraph:(W,H)=>({paths:[{pts:[[W/2,0],[W/2,H]],layer:0}]}),projectName:'Assembly test'};
test('actual PDF has overview, dimensions, every paper and pair table; switches remove optional sections',async()=>{
 const s=session();const full=await exportAssemblyPdf(s,services),doc=await PDFDocument.load(await full.blob.arrayBuffer());assert.equal(doc.getPageCount(),5);assert.match(doc.getTitle(),/Assembly test/);assert.equal(doc.getPage(0).getWidth(),420*72/25.4);
 s.assembly=assemblySettings({dimensions:false,relations:false,artwork:false,numbers:false,registration:false});const minimal=await exportAssemblyPdf(s,{});assert.equal(minimal.pages,3);
});
test('Roll piece indices include one end label at tail, short extra pieces and transformed start corners',async()=>{
 const s=session();s.composition={family:'Roll',settings:{pieceLengthMm:200}};s.assembly=assemblySettings({labelMode:'tear'});
 const pieces=assemblyPieces(s,s.strips[0]);assert.equal(pieces.length,6);assert.equal(pieces.at(-1).fromMm,1000);assert.equal(pieces.at(-1).lengthMm,32);assert.equal(pieces.at(-1).labelOnly,true);assert.deepEqual(pieces.at(-1).A,[60,1000]);
 const pdf=await exportAssemblyPdf(s,services);assert.equal(pdf.pages,6);
});
test('empty/excessive/cancelled and excessive machine-piece PDFs fail explicitly',async()=>{
 await assert.rejects(()=>exportAssemblyPdf({...session(),strips:[]},services),/at least one/);
 await assert.rejects(()=>exportAssemblyPdf({...session(),strips:Array.from({length:129},(_,i)=>paper(String(i),i+1))},services),/128/);
 await assert.rejects(()=>exportAssemblyPdf(session(),{...services,cancelled:()=>true}),/cancelled/);
 const s=session();s.composition={family:'Roll',settings:{pieceLengthMm:.01}};assert.throws(()=>assemblyPieces(s,s.strips[0]),/Too many/);
});
