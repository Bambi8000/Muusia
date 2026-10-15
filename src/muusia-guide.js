import { isParameterActive } from "./defs/parameter-visibility.js";
// Local guide: inspect existing app data; never evaluate nodes or change a patch.
import { nodeGuides } from "../learn/content.mjs";
import { cropTestPiece, TEST_PAPERS } from "./preview-crop.js";
import { isGcodeWorkflow } from "./machine.js";

export const GUIDE_TOPICS = [
  { id: "basics", title: "Build your first patch", keywords: "start beginner basics alku aloita perusteet",
    steps: ["Add a generator, such as Grid, from the Catalog or with N.", "Add a modifier, such as Wave, and connect matching output and input ports.", "Select the last node in the chain to preview and export the finished drawing. Save keeps the editable patch." ] },
  { id: "wires", title: "Connect nodes and control parameters", keywords: "wire connection input output number value kytkenta johto arvo numero parametri",
    steps: ["Drag from an output on the right to an input on the left. Port types must match: blue paths, green numbers, purple styles, orange meshes.", "Green parameter ports accept numbers from Value, Random, Math or Frame. Checkbox ports use below 0.5 for Off and 0.5 or above for On. A wired parameter follows its source; edit that source to change the value.", "A free input can be optional. Read the node description before deciding it needs a wire. Group inputs can receive data through the parent group." ] },
  { id: "empty", title: "Find an empty preview", keywords: "empty blank invisible missing tyhja ei nay esikatselu",
    steps: ["Select the stage you want to draw. Number, style and mesh outputs are intermediate data, rather than directly exportable paths.", "In Check patch, follow the input connection upstream until you find drawing paths. Look for an unloaded source file, zero counts, or clipping that removes the drawing.", "Check the selected node's settings and wired values. An empty output alone does not identify the cause." ] },
  { id: "sample", title: "Make a 1:1 test crop", keywords: "test crop sample margin A4 A3 1:1 koeajo koepala rajaus marginaali",
    steps: ["In Prepare a plot, enable Test crop and choose A4 or A3 paper that fits inside the artwork canvas.", "Move the frame with X/Y or drag it in the preview. Margin mm leaves blank paper on every edge; the dashed inner frame is the drawable area.", "Download a test 1:1 file. Use actual size / 100% in the plotter program. The original artwork and its canvas stay at their original dimensions." ] },
  { id: "direction", title: "Plot horizontal and vertical passes", keywords: "direction horizontal vertical grid rotate mult itip ruudukko vaaka pysty kaanna monikarki",
    steps: ["Connect the finished drawing to Direction Passes and select that node.", "Download G-code passes .zip. Run 01-horizontal, raise the pen, turn the tool manually 90° about its centre, then run 02-vertical with the same paper placement and origin.", "Other directions remain in 03-other when present. Preview direction does not remove the other passes from the ZIP. Test crop passes uses one sample rectangle and margin for all passes." ] },
  { id: "orientation", title: "Understand Y direction and origin", keywords: "flip Y orientation upside origin ylosalaisin suunta origo",
    steps: ["Muusia's drawing coordinates start at the top-left and Y increases downward.", "Flip Y in Machine Setup converts drawing Y to machine Y-up, using the export's paper height. Test crops use the sample paper height.", "LATU's Y+ points up changes its display. Choose Muusia's Flip Y according to the machine's coordinates, and use a matching view in LATU. Origin X/Y then places the paper on the machine." ] },
  { id: "pens", title: "Prepare several pen layers", keywords: "pen colour color layer stroke kyna vari kerros viiva",
    steps: ["Pen controls assign strokes to layers. The Pens panel names those layers and sets their preview / SVG colours.", "Use Set Pen to assign an incoming drawing to one pen, or combine separately assigned drawings with Merge.", "Stack → Pens can export separate pen files. In G-code, the active profile's pen-change settings determine the pauses or changes." ] },
  { id: "export", title: "Choose SVG or G-code", keywords: "export svg gcode machine plot print vienti kone piirto",
    steps: ["Select the final node. Ordinary exports use its first output; connect another output to a downstream node when you want that branch.", "For an External SVG profile, export SVG and set paper placement and pen height in the plotter's own program.", "For G-code, use Prepare a plot to compare drawing coordinates with the active profile. Review the generated file, including its start/end and maintenance moves, before the physical test." ] },
  { id: "animation", title: "Make an animated series", keywords: "animation frame time loop animaatio aika ruutu",
    steps: ["Open ANIMATE, choose the number of frames and add a Frame node when the drawing needs wired time values.", "Connect its green outputs to numeric parameters or checkbox ports. Bang is On for one frame; Toggle holds its On/Off state until the next hit. Nodes with their own Timeline mode can follow ANIMATE directly; read their description.", "Preview the loop, then export one file per frame. Use registration marks if you will scan and align the sheets." ] },
];

const NUMERIC = new Set(["slider", "number", "seed"]);
const WIREABLE = new Set([...NUMERIC, "check"]);
const controlParams = def => (def?.params || []).flatMap(p => p.type === "multi"
  ? p.options.map((option, i) => ({ ...p, key: `${p.key}[${i}]`, label: `${p.label} · ${option}`, type: "check", def: (p.def || []).includes(option), multiKey: p.key, multiOption: option })) : [p]);
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ALIASES = { ruudukko: "grid", vaaka: "horizontal", pysty: "vertical", marginaali: "margin", kyna: "pen", kynat: "pens", vari: "color", kerros: "layer", koepala: "sample", koeajo: "test", rajaus: "crop", vienti: "export", tyhja: "empty", aalto: "wave", teksti: "text", pilvi: "cloud", vuori: "mountain", rihmasto: "mycelium" };
const STOP_WORDS = new Set("a an the to for of with and how do i my this make want draw can is in on from haluan miten teen tehda tama taman ja tai on se ei".split(" "));
export function searchGuide(query, defs, catalog) {
  const terms = [...new Set((norm(query).match(/[a-z0-9]+/g) || []).filter(t => !STOP_WORDS.has(t)).map(t => ALIASES[t] || t))];
  if (!terms.length) return [];
  const entries = [
    ...GUIDE_TOPICS.map(t => ({ ...t, kind: "topic", text: `${t.title} ${t.keywords} ${t.steps.join(" ")}` })),
    ...Object.entries(defs).filter(([, d]) => !d.hidden).map(([id, d]) => ({ id, kind: "node", title: d.name || id, text: `${id} ${d.name} ${(catalog[id]?.tags || []).join(" ")} ${catalog[id]?.t || d.desc || ""} ${(d.params || []).map(p => p.label).join(" ")}` })),
  ];
  return entries.map(e => {
    const title = norm(e.title), text = norm(e.text);
    const matched = terms.filter(t => text.includes(t));
    const score = matched.reduce((n, t) => n + (title.includes(t) ? 4 : 1), 0);
    return { ...e, score, coverage: matched.length / terms.length };
  }).filter(e => e.coverage >= .6 && e.score).sort((a, b) => b.coverage - a.coverage || b.score - a.score || a.title.localeCompare(b.title)).slice(0, 6);
}

function pins(def, key, node) {
  try { return typeof def?.[key] === "function" ? def[key](node) || [] : def?.[key] || []; }
  catch { return []; }
}
const nameOf = (node, defs) => node ? `${defs[node.type]?.name || node.type} #${node.id}` : "Missing node";

export function describeNode(node, level, defs, catalog, results = {}, pvals = {}) {
  if (!node) return null;
  const def = defs[node.type];
  if (!def) return { name: nameOf(node, defs), description: "This definition is not loaded. Import the custom node definition before editing it.", inputs: [], outputs: [], parameters: [] };
  const peer = id => level.nodes.find(n => n.id === id);
  const incoming = port => level.edges.find(e => e.to === node.id && e.toPort === port);
  return {
    name: nameOf(node, defs), category: { gen: "Generator", mod: "Modifier", dec: "Decorator", duo: "Combiner", math: "Numbers", route: "Routing" }[def.cat] || "Group",
    description: catalog[node.type]?.t || def.desc || (node.type === "group" ? "A group contains a patch. Open it to inspect its internal nodes and selected group output." : "Use the ports and current settings below to inspect this node."),
    lesson: nodeGuides[node.type],
    inputs: pins(def, "ins", node).map((pin, port) => {
      const edge = incoming(port);
      const bound = level.bindings?.some(b => b.nodeId === node.id && b.port === port);
      return { label: pin.label || `Input ${port + 1}`, type: pin.type, peerId: edge?.from, connection: edge ? nameOf(peer(edge.from), defs) : bound ? "Parent group input" : "Free input", bound: !!bound };
    }),
    outputs: pins(def, "outs", node).map((pin, port) => ({ label: pin.label || `Output ${port + 1}`, type: pin.type,
      connections: level.edges.filter(e => e.from === node.id && (e.fromPort || 0) === port).map(e => ({ peerId: e.to, name: nameOf(peer(e.to), defs), target: typeof e.toPort === "string" ? e.toPort.slice(2) : pins(defs[peer(e.to)?.type], "ins", peer(e.to))[e.toPort]?.label || `Input ${e.toPort + 1}` })),
      value: typeof results[node.id]?.[port] === "number" ? results[node.id][port] : null,
      count: results[node.id]?.[port]?.paths?.length,
    })),
    parameters: controlParams(def).map(p => {
      const edge = incoming(`p:${p.key}`), stored = p.multiKey ? (node.params?.[p.multiKey] || []).includes(p.multiOption) : node.params?.[p.key] ?? p.def;
      const evaluated = p.multiKey ? pvals[node.id]?.[p.multiKey]?.includes(p.multiOption) : pvals[node.id]?.[p.key];
      const sourceValue = edge ? results[edge.from]?.[edge.fromPort || 0] : null;
      const bound = !edge && level.bindings?.some(b => b.nodeId === node.id && b.port === `p:${p.key}`);
      return { key: p.key, label: p.label || p.key, type: p.type, value: evaluated ?? (p.multiKey && node.params?.[p.multiKey] === undefined ? p.def : stored), wired: !!edge || !!bound,
        peerId: edge?.from, source: edge ? nameOf(peer(edge.from), defs) : bound ? "Parent group input" : null,
        validWire: !edge || (typeof sourceValue === "number" && Number.isFinite(sourceValue)), options: p.options,
        min: p.min, max: node.pmax?.[p.key] ?? p.max, numeric: NUMERIC.has(p.type), boolean: p.type === "check", active: isParameterActive(p, { ...node.params, ...pvals[node.id] }) };
    }),
  };
}

export function inspectPatch(level, defs, results = {}, selectedId = null) {
  const issues = [], nodes = new Map(level.nodes.map(n => [n.id, n])), slots = new Set();
  for (const node of level.nodes) if (!defs[node.type]) issues.push({ id: `unknown-${node.id}`, nodeId: node.id, title: "Node definition is missing", text: `${nameOf(node, defs)} needs its custom definition loaded.` });
  for (const [i, e] of level.edges.entries()) {
    const a = nodes.get(e.from), b = nodes.get(e.to), id = `wire-${i}`;
    if (!a || !b) { issues.push({ id, nodeId: b?.id || a?.id, title: "Wire refers to a missing node", text: "Remove or reconnect this wire in the patch." }); continue; }
    const out = pins(defs[a.type], "outs", a)[e.fromPort || 0];
    const parameter = typeof e.toPort === "string" && e.toPort.startsWith("p:") ? controlParams(defs[b.type]).find(p => p.key === e.toPort.slice(2) && WIREABLE.has(p.type)) : null;
    const input = typeof e.toPort === "number" ? pins(defs[b.type], "ins", b)[e.toPort] : parameter ? { type: "value" } : null;
    if (!out || !input) issues.push({ id, nodeId: b.id, title: "Wire port is missing", text: `${nameOf(a, defs)} → ${nameOf(b, defs)} refers to a port that is no longer available.` });
    else if (out.type !== input.type) issues.push({ id, nodeId: b.id, title: "Port types do not match", text: `${nameOf(a, defs)} sends ${out.type}; ${nameOf(b, defs)} expects ${input.type}. Connect matching port colours.` });
    const slot = `${e.to}|${e.toPort}`;
    if (slots.has(slot)) issues.push({ id: `duplicate-${i}`, nodeId: b.id, title: "Two wires target one input", text: "The evaluator uses the first wire. Keep the intended connection and remove the duplicate." });
    slots.add(slot);
  }
  // Follow both data and parameter dependencies. Report the loop, not its tail.
  const state = new Map(), chain = [], reported = new Set(), adjacency = new Map();
  for (const e of level.edges) if (nodes.has(e.from) && nodes.has(e.to)) {
    if (!adjacency.has(e.to)) adjacency.set(e.to, []);
    adjacency.get(e.to).push(e.from);
  }
  const visit = id => {
    if (state.get(id) === 1) {
      const loop = chain.slice(chain.indexOf(id)), key = [...loop].sort().join(",");
      if (!reported.has(key)) { reported.add(key); issues.push({ id: `loop-${key}`, nodeId: id, title: "Feedback loop in the patch", text: `${loop.map(n => nameOf(nodes.get(n), defs)).join(" → ")} → ${nameOf(nodes.get(id), defs)}. Remove a return wire; the evaluator substitutes defaults when it encounters a loop.` }); }
      return;
    }
    if (state.get(id) === 2) return;
    state.set(id, 1); chain.push(id);
    for (const upstream of adjacency.get(id) || []) visit(upstream);
    chain.pop(); state.set(id, 2);
  };
  for (const id of nodes.keys()) visit(id);
  const selected = nodes.get(selectedId), out = results[selectedId]?.[0];
  if (selected && out?.paths && !out.paths.length) {
    const solo = selected.type === "direction_passes" && results[selectedId]?.slice(1).some(o => o?.paths?.length);
    issues.push({ id: "empty", nodeId: selectedId,
      title: solo ? "Selected preview direction has no paths" : "Selected path output is empty",
      text: solo ? "Other direction outputs contain drawing paths. Choose All in Preview to see them together; the pass ZIP includes every non-empty direction regardless of Preview." : "Follow its inputs upstream, check the settings and any source file. Free inputs can be optional; an empty output alone does not tell us why it is empty." });
  }
  return issues;
}

export function drawingInfo(ps) {
  let points = 0, invalid = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const pens = new Set();
  const drawable = (ps?.paths || []).filter(p => p.pts?.length >= 2);
  for (const p of drawable) {
    pens.add(p.layer ?? 0);
    for (const q of p.pts) {
      points++;
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { invalid++; continue; }
      minX = Math.min(minX, q[0]); minY = Math.min(minY, q[1]); maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]);
    }
  }
  return { paths: drawable.length, points, invalid, pens: [...pens].sort((a, b) => a - b), bounds: Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null };
}

export function preparePlot({ ps, samplePS = ps, canvas, crop, profile, directionOutputs }) {
  const sample = !!(crop?.active && crop.fits), issues = [];
  const passDrawings = directionOutputs ? [1, 2, 3].map(port => {
    const source = directionOutputs[port] || { paths: [] };
    return sample ? cropTestPiece(source, crop) : source;
  }) : null;
  let drawing = passDrawings ? { paths: passDrawings.flatMap(p => p.paths) } : sample ? samplePS : ps;
  const paper = sample ? { W: crop.w, H: crop.h } : canvas;
  if (crop?.active && !crop.fits) issues.push({ id: "sample-size", title: "Sample paper does not fit", text: "Choose a smaller paper or another orientation inside the artwork canvas." });
  if (sample && !passDrawings) drawing = cropTestPiece(drawing, crop);
  const info = drawingInfo(drawing), gcode = isGcodeWorkflow(profile);
  if (!info.paths) issues.push({ id: "no-paths", title: sample ? "No lines in this test crop" : "No drawing paths to export", text: sample ? "Move the sample frame onto the drawing or adjust its margin." : "Select a node whose first output contains drawing paths." });
  if (info.invalid) issues.push({ id: "coordinates", title: "Invalid drawing coordinates", text: `${info.invalid} point(s) contain a non-finite X or Y. Inspect the upstream settings before export.` });
  if (sample && crop.margin === 0) issues.push({ id: "zero-margin", title: "Test margin is zero", text: "Set Margin mm to the blank border your plotter needs." });
  const b = info.bounds;
  if (b && (b.minX < -.001 || b.minY < -.001 || b.maxX > paper.W + .001 || b.maxY > paper.H + .001)) issues.push({ id: "paper-bounds", title: "Some paths extend outside the paper", text: "Check placement, scale or clipping. This compares path coordinates with the paper edge." });
  let machineBounds = null, fit = null;
  const knownArea = Number.isFinite(profile?.workW) && profile.workW > 0 && Number.isFinite(profile?.workH) && profile.workH > 0;
  if (gcode && b && !info.invalid && knownArea) {
    const ox = profile.originX || 0, oy = profile.originY || 0;
    machineBounds = { minX: b.minX + ox, maxX: b.maxX + ox, minY: (profile.flipY ? paper.H - b.maxY : b.minY) + oy, maxY: (profile.flipY ? paper.H - b.minY : b.maxY) + oy };
    fit = machineBounds.minX >= -.001 && machineBounds.minY >= -.001 && machineBounds.maxX <= profile.workW + .001 && machineBounds.maxY <= profile.workH + .001;
    if (!fit) issues.push({ id: "machine-bounds", title: "Drawing XY exceeds the machine work area", text: "Check the active profile's work area and Origin X/Y, or prepare a smaller test crop. Flip Y uses this export's paper height." });
  }
  const preferred = TEST_PAPERS.filter(p => p.w <= canvas.W && p.h <= canvas.H).sort((a, b) => Number((b.w >= b.h) === (canvas.W >= canvas.H)) - Number((a.w >= a.h) === (canvas.W >= canvas.H)));
  const passes = passDrawings?.map(p => drawingInfo(p).paths) || null;
  return { paper, info, sample, gcode, knownArea, machineBounds, fit, issues, suggestedPaper: preferred[0]?.id, passes };
}
