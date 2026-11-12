import assert from "node:assert/strict";
import { test } from "node:test";
import { createSurfaceSession, readSurfaceSession } from "../src/surface-session.js";
import { paperBudget, stripPrintRange, productionPlan, productionSettings, advanceProduction } from "../src/surface-production.js";
import { stripTransform } from "../src/surface-composer.js";
import { packSurfaceRows, EPSON_SURFACE } from "../src/surface-print.js";

test("total metres include visible strips and explicit feed/cut allowance", () => {
  const s = createSurfaceSession(), b = paperBudget(s.strips, s.production);
  assert.equal(b.artworkM, 46); assert.equal(b.allowanceM, .46); assert.equal(b.totalM, 46.46);
  assert.equal(b.availableM, 79); assert.equal(b.fits, true);
  const hidden = s.strips.map((strip,i) => ({ ...strip, visible: i !== 0 }));
  assert.equal(paperBudget(hidden, s.production).totalM, 44.44);
  const short = paperBudget(s.strips, { ...s.production, rollLengthM: 40 });
  assert.equal(short.fits, false); assert.ok(Math.abs(short.shortfallM - 7.46) < 1e-9);
  assert.equal(paperBudget([], s.production).totalM, 0);
});

test("default plan prints ONE strip; consecutive remaining order is explicit", () => {
  const s = createSurfaceSession(); s.selectedId = s.strips[5].id;
  assert.equal(productionPlan(s).ranges.length, 1);
  assert.equal(productionPlan(s, { consecutive: true }).ranges.length, 18);
  s.strips[6].visible = false;
  assert.equal(productionPlan(s, { consecutive: true }).ranges.length, 17);
  assert.equal(productionPlan(s).ranges[0].originalId, s.strips[5].id);
});

test("resume by millimetres preserves global image coordinates at arbitrary angles", () => {
  for (const angle of [0,45,90,137]) {
    const s = createSurfaceSession().strips[0]; s.rotationDeg = angle;
    const r = stripPrintRange(s, 450, 850), a = stripTransform(s), b = stripTransform(r.strip);
    assert.equal(r.lengthMm, 400);
    for (const [x,y] of [[5,0],[40,200],[75,400]]) {
      const g = a.toGlobal([x,y+450]), h = b.toGlobal([x,y]);
      assert.ok(Math.hypot(g[0]-h[0],g[1]-h[1]) < 1e-8);
    }
  }
});

test("partial completion advances the cursor without starting the next job", () => {
  const s = createSurfaceSession();
  let next = advanceProduction(s, stripPrintRange(s.strips[0], 450, 850));
  assert.equal(next.selectedId, s.strips[0].id); assert.equal(next.production.fromMm, 850);
  next = advanceProduction(next, stripPrintRange(s.strips[0], 850));
  assert.equal(next.selectedId, s.strips[1].id); assert.equal(next.production.fromMm, 0);
  assert.equal(next.production.usedOnRollM, 0, "Manual roll-use estimate is not a pretend paper sensor");
  assert.equal(productionPlan(next).ranges.length, 1);
});

test("production settings and print records persist, old files get manual defaults", () => {
  const s = createSurfaceSession(); s.production.fromMm = 123;
  s.production.lastJob = { id:'a'.repeat(32),stripId:s.strips[0].id,fromMm:0,toMm:123,status:'done' };
  assert.deepEqual(readSurfaceSession(JSON.parse(JSON.stringify(s))), s);
  delete s.production;
  const restored = readSurfaceSession(s);
  assert.equal(restored.production.fromMm, 0);
  assert.equal(restored.production.lastJob, null);
  assert.equal(restored.production.consecutive, undefined, "Batch mode must never be restored");
});

test("thermal packing preserves checked side columns and never stretches the artwork", () => {
  const s = createSurfaceSession(), range = stripPrintRange(s.strips[0], 0, 100);
  const rgba = { width:512,height:2,data:new Uint8ClampedArray(512*2*4) };
  for(let i=3;i<rgba.data.length;i+=4)rgba.data[i]=255;
  const out = new Uint8Array(128); packSurfaceRows(rgba,out,0,range,{dither:false});
  const black = x => !!(out[x>>3] & (0x80>>(x&7)));
  assert.equal(black(0),false); assert.equal(black(1),true); assert.equal(black(499),true); assert.equal(black(500),false); assert.equal(black(511),false);
  assert.equal(EPSON_SURFACE.dotsPerMm,400/56.6);
  const white = {width:512,height:2,data:new Uint8ClampedArray(4096).fill(255)};
  const blank = new Uint8Array(128); packSurfaceRows(white,blank,0,range); assert.ok(blank.every(x=>x===0));
});

test("bad roll, resume ranges and hidden selections fail before printing", () => {
  const s=createSurfaceSession();
  for(const patch of [{rollLengthM:0},{reserveM:80},{usedOnRollM:81},{allowanceMm:-1},{serverUrl:'http://example.com'}]) assert.throws(()=>productionSettings(patch));
  for(const [from,to]of [[-1,100],[100,50],[2000,null],[0,3000]])assert.throws(()=>stripPrintRange(s.strips[0],from,to));
  s.strips[0].visible=false; assert.throws(()=>productionPlan(s));
});
