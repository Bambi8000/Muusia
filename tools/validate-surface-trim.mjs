import assert from 'node:assert/strict';
import {test} from 'node:test';
import {thermalTrimLayout,addThermalTrimMarks,trimAllowanceMm,TRIM_GUARD_ROWS} from '../src/surface-trim.js';
import {EPSON_SURFACE,packSurfaceRows} from '../src/surface-print.js';
import {createSurfaceSession,readSurfaceSession} from '../src/surface-session.js';
import {paperBudget,productionPlan} from '../src/surface-production.js';
import {surfacePrintPackagePlan,stripPacket} from '../src/surface-print-package.js';
import {createStrip} from '../src/surface-composer.js';

test('trim marks remain wholly outside body pixels and calibrated side margins, including a resumed short body',()=>{
 for(const length of [0.1,100,2000]){
  const t=thermalTrimLayout(length,true),strip=createSurfaceSession().strips[0],out=new Uint8Array(t.rows*64);
  const body=out.subarray(t.bodyStartRow*64,t.bodyEndRow*64);body.fill(0x5a);const before=body.slice();
  addThermalTrimMarks(out,t,strip,EPSON_SURFACE);assert.deepEqual(body,before);
  assert.equal(t.leadingRows,22);assert.equal(t.trailingRows,22);assert.equal(t.bodyRows,Math.ceil(length*400/56.6-1e-9));
  for(const y of [t.bodyStartRow-1,t.bodyEndRow])assert.ok(out.subarray(y*64,(y+1)*64).some(x=>x));
  for(const [from,to]of [[0,t.bodyStartRow],[t.bodyEndRow,t.rows]])for(let y=from;y<to;y++){
   assert.equal(out[y*64]&128,0);assert.equal(out[y*64+62]&15,0);assert.equal(out[y*64+63],0);
  }
 }
 const off=thermalTrimLayout(100,false),bytes=new Uint8Array(off.rows*64);addThermalTrimMarks(bytes,off,createSurfaceSession().strips[0],EPSON_SURFACE);assert.ok(bytes.every(x=>x===0));assert.equal(off.leadingRows,0);
});
test('removable guards are counted once in both roll budget and selected range, and saved toggle survives',()=>{
 const s=createSurfaceSession();s.strips=[createStrip({id:'p',lengthMm:1000})];s.selectedId='p';s.production.fromMm=500;
 const on=paperBudget(s.strips,s.production),off=paperBudget(s.strips,{...s.production,trimMarks:false});
 assert.ok(Math.abs(on.totalM-off.totalM-trimAllowanceMm(true)/1000)<1e-12);
 assert.ok(Math.abs(productionPlan(s).totalM-.5-(20+trimAllowanceMm(true))/1000)<1e-12);
 assert.equal(readSurfaceSession(JSON.parse(JSON.stringify(s))).production.trimMarks,true);
 assert.equal(readSurfaceSession({...s,production:{...s.production,trimMarks:false}}).production.trimMarks,false);
 assert.throws(()=>readSurfaceSession({...s,production:{...s.production,trimMarks:1}}));
 const t=thermalTrimLayout(500,true),plan=surfacePrintPackagePlan(s,{selectedOnly:true});
 assert.equal(plan.bytes,t.rows*64);
 const packet=stripPacket(s,plan.ranges[0],{height:t.rows});assert.deepEqual(packet.geometry.trim,{leadingRows:22,trailingRows:22});assert.equal(packet.geometry.fromMm,500);assert.equal(packet.geometry.bodyRows,t.bodyRows);
});
test('dither phase follows body coordinates, rather than added guard rows',()=>{
 const range={strip:createSurfaceSession().strips[0],fromMm:123};
 const rgba={width:512,height:11,data:new Uint8ClampedArray(512*11*4).fill(127)};for(let i=3;i<rgba.data.length;i+=4)rgba.data[i]=255;
 const original=new Uint8Array(11*64),guarded=new Uint8Array((11+TRIM_GUARD_ROWS)*64);
 packSurfaceRows(rgba,original,0,range);packSurfaceRows(rgba,guarded,TRIM_GUARD_ROWS,range,{phaseOffsetRows:-TRIM_GUARD_ROWS});
 assert.deepEqual(guarded.subarray(TRIM_GUARD_ROWS*64),original);
 const labelStart=707+2*TRIM_GUARD_ROWS,source=new Uint8Array((707+11)*64),shifted=new Uint8Array((labelStart+11)*64);
 packSurfaceRows(rgba,source,707,range);
 packSurfaceRows(rgba,shifted,labelStart,range,{phaseOffsetRows:-TRIM_GUARD_ROWS,phaseChangeRow:labelStart,phaseAfterRows:-2*TRIM_GUARD_ROWS});
 assert.deepEqual(shifted.subarray(labelStart*64),source.subarray(707*64));
});
