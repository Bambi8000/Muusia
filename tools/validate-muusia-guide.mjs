import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { CATALOG } from "../src/defs/catalog.js";
import { DEFAULT_MACHINE, DEFAULT_SVG_MACHINE } from "../src/machine.js";
import { testCropRect } from "../src/preview-crop.js";
import { describeNode, inspectPatch, preparePlot, searchGuide, drawingInfo, GUIDE_TOPICS } from "../src/muusia-guide.js";

const defs = {};
for (const file of fs.readdirSync("src/defs/nodes").filter(f => f.endsWith(".js"))) {
  const { default: def } = await import(pathToFileURL(`${process.cwd()}/src/defs/nodes/${file}`));
  defs[def.key] = def;
}
const params = type => Object.fromEntries(defs[type].params.map(p => [p.key, p.def]));
const node = (id, type) => ({ id, type, params: params(type) });
const grid = node(1, "grid"), wave = node(2, "aaltoilu"), value = node(3, "arvo"), pass = node(4, "direction_passes");
const graph = { nodes: [grid, wave, value, pass], edges: [
  { from: 1, fromPort: 0, to: 2, toPort: 0 },
  { from: 3, fromPort: 0, to: 2, toPort: "p:amp" },
] };
const ps = { paths: [{ pts: [[10, 20], [100, 20]], layer: 2 }] };
const results = { 1: [ps], 2: [ps], 3: [12.5] }, pvals = { 2: { ...wave.params, amp: 12.5 } };
const before = JSON.stringify({ graph, results, pvals });
const d = describeNode(wave, graph, defs, CATALOG, results, pvals);
assert.match(d.description, /wave|sin/i);
assert.equal(d.inputs[0].peerId, 1);
assert.equal(d.inputs[0].connection, "Grid #1");
assert.equal(d.parameters.find(p => p.key === "amp").value, 12.5);
assert.equal(d.parameters.find(p => p.key === "amp").source, "Value #3");
assert.equal(d.parameters.find(p => p.key === "amp").validWire, true);
assert.equal(describeNode(value, graph, defs, CATALOG, results).outputs[0].value, 12.5);
assert.equal(describeNode(grid, graph, defs, CATALOG, results).outputs[0].connections[0].name, "Wave #2");
assert.deepEqual(inspectPatch(graph, defs, results, 2), [], "Free optional inputs and standalone nodes are not structural failures");
assert.equal(JSON.stringify({ graph, results, pvals }), before, "Guide never changes graph data");
assert.equal(describeNode(null, graph, defs, CATALOG), null);
assert.ok(describeNode({ id: 99, type: "missing" }, graph, defs, CATALOG).description.includes("not loaded"));
const badValue = describeNode(wave, graph, defs, CATALOG, { ...results, 3: [NaN] });
assert.equal(badValue.parameters.find(p => p.key === "amp").validWire, false);
const customRange = describeNode({ ...wave, pmax: { amp: 200 } }, graph, defs, CATALOG);
assert.equal(customRange.parameters.find(p => p.key === "amp").max, 200);
const custom = { name: "Custom", params: [{ key: "x", showIf() { throw new Error("not ready"); } }], ins: [], outs: [] };
assert.equal(describeNode({ id: 8, type: "custom", params: {} }, { nodes: [], edges: [] }, { custom }, {}).parameters[0].active, true);

assert.equal(inspectPatch(graph, defs, { 3: [4] }, 3).length, 0, "Numeric outputs are not empty drawings");
assert.equal(inspectPatch(graph, defs, { 2: [{ paths: [] }] }, 2).at(-1).id, "empty");
assert.equal(inspectPatch(graph, defs, { 4: [{ paths: [] }, ps, { paths: [] }, { paths: [] }] }, 4).at(-1).title, "Selected preview direction has no paths");
const bad = { nodes: graph.nodes, edges: [
  { from: 3, fromPort: 0, to: 2, toPort: 0 },
  { from: 1, fromPort: 90, to: 2, toPort: 0 },
  { from: 999, fromPort: 0, to: 2, toPort: 1 },
  { from: 1, fromPort: 0, to: 2, toPort: "p:missing" },
] };
const issues = inspectPatch(bad, defs, results, 2);
for (const text of ["types do not match", "port is missing", "missing node", "Two wires"]) assert.ok(issues.some(i => i.title.includes(text)), text);
const loop = inspectPatch({ nodes: graph.nodes, edges: [...graph.edges, { from: 2, fromPort: 0, to: 1, toPort: 0 }] }, defs, results);
assert.equal(loop.filter(i => i.title.includes("Feedback")).length, 1);
const numericDefs = { n: { name: "Number", params: [{ key: "x", type: "number" }], ins: [], outs: [{ type: "value" }] } };
assert.ok(inspectPatch({ nodes: [{ id: 1, type: "n" }], edges: [{ from: 1, to: 1, fromPort: 0, toPort: "p:x" }] }, numericDefs).some(i => i.title.includes("Feedback")), "Parameter loops are included");
const dynamicDefs = { group: { name: "Group", params: [], ins: n => n.data.bindings.map(() => ({ type: "paths", label: "Group drawing" })), outs: [{ type: "paths" }] }, ...defs };
const groupNode = { id: 10, type: "group", data: { bindings: [{ nodeId: 2, port: 0 }] } };
assert.equal(describeNode(groupNode, { nodes: [groupNode], edges: [] }, dynamicDefs, CATALOG).inputs[0].label, "Group drawing");
assert.equal(describeNode(wave, { nodes: [wave], edges: [], bindings: [{ nodeId: 2, port: 0 }] }, defs, CATALOG).inputs[0].connection, "Parent group input");

for (const [type, def] of Object.entries(defs)) {
  const n = node(1, type);
  const info = describeNode(n, { nodes: [n], edges: [] }, defs, CATALOG);
  assert.ok(info.description.length, `${type} has a reference`);
  assert.equal(info.parameters.length, def.params.reduce((n, p) => n + (p.type === "multi" ? p.options.length : 1), 0));
  if (info.lesson) assert.ok(Array.isArray(info.lesson.recipe), `${type} has a valid guided example`);
}
assert.ok(searchGuide("ruudukko", defs, CATALOG).some(r => r.id === "grid"));
assert.ok(searchGuide("vaaka pysty", defs, CATALOG).some(r => r.id === "direction_passes" || r.id === "direction"));
assert.ok(searchGuide("test crop", defs, CATALOG).some(r => r.id === "sample"));
assert.deepEqual(searchGuide("what is the weather tomorrow", defs, CATALOG), [], "Out-of-domain questions have no fabricated answer");
assert.deepEqual(searchGuide("", defs, CATALOG), []);
assert.ok(GUIDE_TOPICS.length >= 8);

const canvas = { W: 594, H: 420 }, profile = { ...DEFAULT_MACHINE, originX: 5, originY: 7, workW: 330, workH: 240, flipY: true };
const crop = { ...testCropRect({ paper: "a4-landscape", x: 70, y: 100, margin: 12.5 }, canvas.W, canvas.H), active: true };
const samplePS = { paths: [{ pts: [[60, 130], [400, 130]], layer: 3 }, { pts: [[100, 90], [100, 320]], layer: 2 }] };
const passOutput = defs.direction_passes.compute([samplePS], { tolerance: .1, preview: "All" });
const fullBefore = JSON.stringify({ samplePS, canvas, profile, crop, passOutput });
const plot = preparePlot({ ps, samplePS, canvas, crop, profile, directionOutputs: passOutput });
assert.equal(plot.sample, true);
assert.deepEqual(plot.paper, { W: 297, H: 210 });
assert.equal(plot.fit, true, "Fits on sample paper even when the original A2 canvas is larger than the machine");
assert.deepEqual(plot.info.bounds, { minX: 12.5, minY: 12.5, maxX: 284.5, maxY: 197.5 });
assert.deepEqual(plot.machineBounds, { minX: 17.5, maxX: 289.5, minY: 19.5, maxY: 204.5 });
assert.deepEqual(plot.passes, [1, 1, 0]);
assert.deepEqual(plot.issues, []);
assert.equal(plot.suggestedPaper, "a4-landscape");
assert.equal(JSON.stringify({ samplePS, canvas, profile, crop, passOutput }), fullBefore, "Preparing guidance cannot clip or rewrite the source data");
const outsidePass = [{ paths: [] }, ps, { paths: [{ pts: [[700, 10], [700, 80]] }] }, { paths: [] }];
assert.ok(preparePlot({ ps: outsidePass[0], canvas, profile, directionOutputs: outsidePass }).issues.some(i => i.id === "machine-bounds"), "Pass checks cover all directions even when Preview is empty or soloed");
const smallProfile = { ...profile, workW: 100, workH: 100 };
assert.ok(preparePlot({ ps, canvas, crop, samplePS, profile: smallProfile }).issues.some(i => i.id === "machine-bounds"));
assert.ok(preparePlot({ ps, canvas, crop: { ...crop, margin: 0 }, profile }).issues.some(i => i.id === "zero-margin"));
assert.ok(preparePlot({ ps, canvas, crop: { ...crop, fits: false }, profile }).issues.some(i => i.id === "sample-size"));
const external = preparePlot({ ps, canvas, profile: DEFAULT_SVG_MACHINE });
assert.equal(external.gcode, false);
assert.equal(external.fit, null);
assert.equal(external.knownArea, false);
assert.ok(!external.issues.some(i => i.id === "machine-bounds"));
assert.equal(preparePlot({ ps, canvas: { W: 100, H: 100 }, profile }).suggestedPaper, undefined);
const invalid = { paths: [{ pts: [[NaN, 10], [20, Infinity]] }] };
assert.equal(drawingInfo(invalid).invalid, 2);
assert.ok(preparePlot({ ps: invalid, canvas, profile }).issues.some(i => i.id === "coordinates"));
console.log(`PASS: ${Object.keys(defs).length} node references; live numeric wires, optional/group inputs, broken ports and cycles, Muusia-only search, exact 1:1 clipping and Flip Y sample bounds; immutable app data.`);
