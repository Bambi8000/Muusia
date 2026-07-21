/* MUUSIA Era C0 - split DEFS nodes into src/defs/nodes/*.js + helpers.js
   Engine-bound nodes are auto-quarantined (stay in App.jsx). No version bump. */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const log = [];
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };

function assertOnce(needle, what) {
  const i = src.indexOf(needle);
  if (i < 0) die("anchor not found (" + what + ")");
  if (src.indexOf(needle, i + 1) >= 0) die("anchor not unique (" + what + ")");
  return i;
}
function matchBrace(s, open) {
  let depth = 0, mode = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (mode === null) {
      if (c === '"' || c === "'" || c === "`") mode = c;
      else if (c === "/" && n === "/") { mode = "//"; i++; }
      else if (c === "/" && n === "*") { mode = "/*"; i++; }
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (!depth) return i; }
    } else if (mode === "//") { if (c === "\n") mode = null; }
    else if (mode === "/*") { if (c === "*" && n === "/") { mode = null; i++; } }
    else { if (c === "\\") i++; else if (c === mode) mode = null; }
  }
  die("unbalanced braces");
}
const lineEnd = (i) => { const e = src.indexOf("\n", i); return e < 0 ? src.length : e + 1; };

/* ---------- 1. locate helper ranges (original coordinates) ---------- */
const cuts = []; /* [start, end, text] */
const grabFn = (name) => {
  const i = assertOnce("function " + name + "(", "helper " + name);
  const start = src.lastIndexOf("\n", i) + 1;
  const close = matchBrace(src, src.indexOf("{", i));
  const end = lineEnd(close);
  cuts.push([start, end, src.slice(start, end)]);
};
const grabLine = (needle, what) => {
  const i = assertOnce(needle, what);
  const start = src.lastIndexOf("\n", i) + 1;
  const end = lineEnd(i);
  cuts.push([start, end, src.slice(start, end)]);
};
{ /* PENS cluster: PENS_DEFAULT .. resetPens (one line) */
  const a = assertOnce("const PENS_DEFAULT = [", "PENS cluster start");
  const b = assertOnce("function resetPens()", "PENS cluster end");
  if (b < a) die("PENS cluster order");
  const end = lineEnd(b);
  cuts.push([a, end, src.slice(a, end)]);
}
["mulberry32", "hash2", "noise2", "pathLength", "resample", "applyStyle", "parseSVG", "signedArea", "fontStrokes"].forEach(grabFn);
grabLine("const EMPTY = { paths: [] };", "EMPTY");
grabLine("const Pin = (type, label) => ({ type, label });", "Pin");
{ /* SFONT object */
  const i = assertOnce("const SFONT = {", "SFONT");
  const close = matchBrace(src, src.indexOf("{", i));
  const end = lineEnd(close);
  cuts.push([i, end, src.slice(i, end)]);
}
const HELPER_TEXT = cuts.map((c) => c[2]).join("\n");

/* ---------- 2. parse DEFS entries ---------- */
const defsStart = assertOnce("const DEFS = {", "DEFS start");
const defsClose = matchBrace(src, src.indexOf("{", defsStart));
const entries = [];
{
  let pos = src.indexOf("{", defsStart) + 1;
  const re = /\n  ([a-z0-9_]+): \{/g;
  re.lastIndex = pos;
  let m;
  while ((m = re.exec(src)) && m.index < defsClose) {
    const braceIdx = m.index + m[0].length - 1;
    const close = matchBrace(src, braceIdx);
    let end = close + 1;
    if (src[end] === ",") end++;
    if (src[end] === "\n") end++;
    entries.push({ key: m[1], start: m.index + 1, end, inner: src.slice(braceIdx + 1, close) });
    re.lastIndex = close;
  }
}
if (entries.length < 150) die("only " + entries.length + " DEFS entries found");
log.push("parsed " + entries.length + " DEFS entries");

/* ---------- 3. write helpers.js ---------- */
fs.mkdirSync("src/defs/nodes", { recursive: true });
const HELPER_NAMES = ["PENS_DEFAULT", "PENS", "savePens", "resetPens", "mulberry32", "hash2", "noise2",
  "EMPTY", "pathLength", "resample", "applyStyle", "Pin", "parseSVG", "signedArea", "SFONT", "fontStrokes"];
let helpersJs = "/* Muusia shared node helpers - extracted from App.jsx (Era C0) */\n" + HELPER_TEXT;
for (const n of HELPER_NAMES) {
  helpersJs = helpersJs
    .replace("function " + n + "(", "export function " + n + "(")
    .replace("const " + n + " = ", "export const " + n + " = ");
}
fs.writeFileSync("src/defs/helpers.js", helpersJs);
log.push("wrote src/defs/helpers.js");

/* ---------- 4. write node files ---------- */
const NODE_HELPERS = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample", "pathLength",
  "applyStyle", "signedArea", "SFONT", "fontStrokes", "parseSVG"];
for (const e of entries) {
  const used = NODE_HELPERS.filter((h) => new RegExp("\\b" + h + "\\b").test(e.inner));
  const imp = used.length ? 'import { ' + used.join(", ") + ' } from "../helpers.js";\n\n' : "";
  fs.writeFileSync("src/defs/nodes/" + e.key + ".js",
    imp + "export default {\n  key: " + JSON.stringify(e.key) + "," + e.inner + "\n};\n");
}
log.push("wrote " + entries.length + " candidate node files");

/* ---------- 5. runtime quarantine ---------- */
const stayHome = new Set();
for (const e of entries) {
  const file = path.resolve("src/defs/nodes/" + e.key + ".js");
  let refErr = null;
  try {
    const mod = await import(pathToFileURL(file).href + "?v=" + Date.now());
    const def = mod.default;
    const params = Object.fromEntries((def.params || []).map((q) => [q.key, q.def]));
    const fakeNode = { params, data: undefined, id: 1 };
    try {
      const insArr = typeof def.ins === "function" ? def.ins(fakeNode) : def.ins || [];
      const outsArr = typeof def.outs === "function" ? def.outs(fakeNode) : def.outs || [];
      void outsArr;
      def.compute(insArr.map(() => undefined), params, { W: 300, H: 200 }, fakeNode);
      if (def.overlay) def.overlay(params, { W: 300, H: 200 });
    } catch (err) {
      if (err instanceof ReferenceError) refErr = err.message;
    }
  } catch (err) {
    refErr = "module load: " + err.message;
  }
  if (refErr) {
    fs.unlinkSync(file);
    stayHome.add(e.key);
    log.push("QUARANTINE " + e.key + " stays in App.jsx (" + refErr + ")");
  }
}
const migrated = entries.filter((e) => !stayHome.has(e.key));
log.push(migrated.length + " nodes migrated, " + stayHome.size + " quarantined");

/* ---------- 6. write index.js ---------- */
fs.writeFileSync("src/defs/index.js", [
  "/* Auto-assembled node registry (Era C0). Drop a node file into ./nodes to add it. */",
  'const mods = import.meta.glob("./nodes/*.js", { eager: true });',
  "export const DEFS_NODES = {};",
  "for (const p of Object.keys(mods).sort()) {",
  "  const d = mods[p].default;",
  "  DEFS_NODES[d.key] = d;",
  "}",
  "",
].join("\n"));
log.push("wrote src/defs/index.js");

/* ---------- 7. rewrite App.jsx ---------- */
const removals = [
  ...cuts.map((c) => [c[0], c[1]]),
  ...migrated.map((e) => [e.start, e.end]),
].sort((a, b) => b[0] - a[0]);
for (const [s, e] of removals) src = src.slice(0, s) + src.slice(e);
{
  const i = assertOnce("const DEFS = {", "DEFS start after removals");
  const ins = "\n  ...DEFS_NODES,";
  src = src.slice(0, i + "const DEFS = {".length) + ins + src.slice(i + "const DEFS = {".length);
}
{
  const reactImp = src.indexOf("\n", src.indexOf('import React'));
  src = src.slice(0, reactImp + 1) +
    'import { DEFS_NODES } from "./defs/index.js";\n' +
    'import { ' + HELPER_NAMES.join(", ") + ' } from "./defs/helpers.js";\n' +
    src.slice(reactImp + 1);
}
fs.writeFileSync(FILE + ".bak-era-c0", fs.readFileSync(FILE));
fs.writeFileSync(FILE, src);
log.push("App.jsx rewritten (" + src.split("\n").length + " lines)");

/* ---------- 8. tools/ + nodes-lab/ ---------- */
fs.mkdirSync("tools", { recursive: true });
fs.mkdirSync("nodes-lab", { recursive: true });
for (const f of fs.readdirSync(".")) {
  if (/^(era-.*\.mjs|extract\.mjs|validate-.*\.mjs)$/.test(f) && f !== "era-c0.mjs") {
    fs.renameSync(f, "tools/" + f);
    log.push("moved " + f + " -> tools/");
  }
  if (/\.plotternode\.js$/.test(f)) {
    fs.renameSync(f, "nodes-lab/" + f);
    log.push("moved " + f + " -> nodes-lab/");
  }
}
log.forEach((l) => console.log(l));
console.log("files in src/defs/nodes: " + fs.readdirSync("src/defs/nodes").length);
console.log("OK - now run: npm run build");