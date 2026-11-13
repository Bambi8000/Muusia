import { thermalTrimLayout } from "./surface-trim.js";
import { zipSync, strToU8 } from "fflate";
import { readSurfaceSession } from "./surface-session.js";
import { stripsInPrintOrder } from "./surface-composer.js";
import { stripPrintRange, productionPlan } from "./surface-production.js";
import { labelExtraMm } from "./surface-assembly.js";
import { preparePrintSource, renderSurfaceReceipt, EPSON_SURFACE } from "./surface-print.js";

export const PRINT_PACKAGE_LIMITS = Object.freeze({ items:64, pixelsBytes:32*1024*1024, zipBytes:12000000 });
export const SURFACE_PRINT_PROFILE = Object.freeze({ id:"epson-tmt88v-measured-20261112", width:512, dotsPerMm:EPSON_SURFACE.dotsPerMm });
const safe = s => String(s || "surface").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,60);
export function surfacePrintPackagePlan(input, { selectedOnly=false }={}) {
  const session=readSurfaceSession(input);
  const ranges=selectedOnly ? productionPlan(session).ranges : stripsInPrintOrder(session.strips).map(p=>stripPrintRange(p));
  if(!ranges.length)throw new Error("Show at least one strip to export.");
  if(ranges.length>PRINT_PACKAGE_LIMITS.items)throw new Error("Export up to 64 strips per Print package.");
  let bytes=0;
  for(const r of ranges){
    if(r.strip.physicalWidthMm<78||r.strip.physicalWidthMm>82)throw new Error("The Epson Print package requires nominal 80 mm paper. Choose 80 mm strips or export PNG for another printer.");
    const height=thermalTrimLayout(r.lengthMm,session.production.trimMarks).rows+Math.ceil(labelExtraMm(session.assembly)*EPSON_SURFACE.dotsPerMm-1e-9);
    if(height>EPSON_SURFACE.maxHeight)throw new Error("This strip is too long for one Print job. Export a selected range of at most 9.2 m.");
    bytes+=height*64;
  }
  if(bytes>PRINT_PACKAGE_LIMITS.pixelsBytes)throw new Error("Print package exceeds 32 MiB of thermal data. Export fewer strips or one selected range.");
  return {session,ranges,bytes};
}
export function stripPacket(session,range,receipt) {
  const paper=session.strips.find(p=>p.id===range.originalId);
  return {format:"muusia-surface-strip",version:1,...receipt,profile:SURFACE_PRINT_PROFILE,geometry:{accountForBezels:session.accountForBezels ?? true,stripId:paper.id,number:session.strips.findIndex(p=>p.id===paper.id)+1,printOrder:paper.printOrder,physicalWidthMm:paper.physicalWidthMm,printableOffsetMm:paper.printableOffsetMm,printableWidthMm:paper.printableWidthMm,originalLengthMm:paper.lengthMm,fromMm:range.fromMm,toMm:range.toMm,bodyLengthMm:range.lengthMm,labelLengthMm:labelExtraMm(session.assembly),bodyRows:thermalTrimLayout(range.lengthMm,session.production.trimMarks).bodyRows,...(session.production.trimMarks?{trim:{leadingRows:thermalTrimLayout(range.lengthMm,true).leadingRows,trailingRows:thermalTrimLayout(range.lengthMm,true).trailingRows}}:{})}};
}
export async function exportSurfacePrintPackage(input,options={},services={}) {
  const job=surfacePrintPackagePlan(input,options),files={},entries=[];
  const check=()=>{if(services.cancelled?.())throw new Error("Print export cancelled.");};check();
  const source=services.source ?? await preparePrintSource(job.session,services.evaluateGraph);
  for(let i=0;i<job.ranges.length;i++){
    check();const range=job.ranges[i];
    const receipt=await (services.renderReceipt ?? renderSurfaceReceipt)(job.session,range,source,{cancelled:services.cancelled,onProgress:n=>services.onProgress?.(`Preparing Print strip ${i+1}/${job.ranges.length} · ${Math.round(n*100)}%`)});
    const packet=stripPacket(job.session,range,receipt),name=`${safe(options.projectName)}-strip-${String(i+1).padStart(4,'0')}.muusia-strip.json`;
    files[name]=strToU8(JSON.stringify(packet));entries.push({filename:name,stripId:range.originalId,number:packet.geometry.number,printOrder:packet.geometry.printOrder});
  }
  check();
  if(options.selectedOnly){const name=entries[0].filename;return {blob:new Blob([files[name]],{type:'application/json'}),filename:name,count:1};}
  files['manifest.json']=strToU8(JSON.stringify({format:'muusia-print-package',version:1,profile:SURFACE_PRINT_PROFILE,defaultPrintMode:'manual',instructions:'Open in Print. Inspect each strip, print one, let the printer cool, then start the next. Data is already calibrated; do not resize.',strips:entries}));
  const bytes=zipSync(files,{level:6});if(bytes.length>PRINT_PACKAGE_LIMITS.zipBytes)throw new Error("Print ZIP exceeds 12 MB. Export fewer strips.");check();
  return {blob:new Blob([bytes],{type:'application/zip'}),filename:`${safe(options.projectName)}-print.zip`,count:entries.length};
}
