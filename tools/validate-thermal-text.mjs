import assert from "node:assert/strict";
import thermalText from "../src/defs/nodes/thermal_text.js";

const defs = [["built-in", thermalText]];

for (const [label, def] of defs) {
  assert.equal(def.key, "thermal_text", label);
  assert.equal(def.ins[0].type, "paths", label);
  assert.equal(def.outs[0].type, "paths", label);
  assert.equal(def.params.find(p => p.key === "page").options.length, 42, label);
  assert.equal(def.params.find(p => p.key === "country").options.length, 18, label);
  const defaults = Object.fromEntries(def.params.map(param => [param.key, param.def]));
  const drawing = { paths: [{ pts: [[1, 2], [3, 4]], layer: 0 }] };
  const before = def.compute([drawing], defaults);
  assert.equal(before.paths, drawing.paths, label);
  assert.equal(before.thermalText.length, 1, label);
  assert.deepEqual(before.thermalText[0], {
    position: "before", text: "HELLO WORLD", hex: "", align: 0, font: "A",
    width: 1, height: 1, bold: false, underline: false, reverse: false,
    page: 0, country: 0,
  }, label);
  const after = def.compute([before], { ...defaults, text: "Þór|Ísland", position: "After",
    align: "Right", font: "B", width: 2.4, height: 8, bold: true,
    underline: true, reverse: true, page: "35 · PC861 Icelandic", country: "5 · Sweden" });
  assert.equal(after.paths, drawing.paths, label);
  assert.equal(after.thermalText.length, 2, label);
  assert.equal(after.thermalText[0], before.thermalText[0], label);
  assert.deepEqual(after.thermalText[1], {
    position: "after", text: "Þór\nÍsland", hex: "", align: 2, font: "B",
    width: 2, height: 8, bold: true, underline: true, reverse: true,
    page: 35, country: 5,
  }, label);
  assert.deepEqual(drawing, { paths: [{ pts: [[1, 2], [3, 4]], layer: 0 }] }, label);
  const textOnly = def.compute([], { ...defaults, hex: "8E 84", text: "" });
  assert.equal(textOnly.paths.length, 0, label);
  assert.equal(textOnly.thermalText[0].hex, "8E 84", label);
  assert.equal(def.compute([drawing], { ...defaults, text: "", hex: "" }), drawing, label);
}
console.log(`Thermal Text validated: ${defs.map(([label]) => label).join(" and ")}.`);
