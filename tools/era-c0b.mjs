/* Era C0b - fix C0: move isStyle into helpers, return group home, re-migrate the 83 */
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

/* ---------- 1. isStyle -> helpers.js ---------- */
let helpers = fs.readFileSync("src/defs/helpers.js", "utf8");
{
  let i = src.indexOf("function isStyle(");
  let text, start, end;
  if (i >= 0) {
    start = src.lastIndexOf("\n", i) + 1;
    end = lineEnd(matchBrace(src, src.indexOf("{", i)));
    text = src.slice(start, end);
    helpers += "\nexport " + text;
  } else {
    i = src.indexOf("const isStyle = ");
    if (i < 0) die("isStyle not found in App.jsx");
    start = src.lastIndexOf("\n", i) + 1;
    end = lineEnd(i + src.slice(i).indexOf(";"));
    text = src.slice(start, end);
    helpers += "\nexport " + text;
  }
  src = src.slice(0, start) + src.slice(end);
  fs.writeFileSync("src/defs/helpers.js", helpers);
  log.push("isStyle moved to helpers.js");
}
{
  const impAnchor = ' } from "./defs/helpers.js";';
  const i = assertOnce(impAnchor, "helpers import line");
  src = src.slice(0, i) + ", isStyle" + src.slice(i);
  log.push("App.jsx imports isStyle");
}

/* ---------- 2. group back home ---------- */
{
  const gf = "src/defs/nodes/group.js";
  if (fs.existsSync(gf)) {
    const g = fs.readFileSync(gf, "utf8");
    const open = g.indexOf("export default {");
    const braceIdx = g.indexOf("{", open);
    const close = matchBrace(g, braceIdx);
    let inner = g.slice(braceIdx + 1, close);
    inner = inner.replace(/\n\s*key: "group",/, "");
    const entry = "  group: {" + inner + "\n  },\n";
    const di = assertOnce("const DEFS = {\n  ...DEFS_NODES,", "DEFS spread anchor");
    const ins = di + "const DEFS = {\n  ...DEFS_NODES,".length;
    src = src.slice(0, ins) + "\n" + entry.replace(/\n$/, "") + src.slice(ins);
    fs.unlinkSync(gf);
    log.push("group returned to App.jsx");
  } else log.push("NOTE: group.js not found (already home?)");
}

/* ---------- 3. re-migrate remaining DEFS entries (except group, reititys) ---------- */
const NODE_HELPERS = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample", "pathLength",
  "applyStyle", "signedArea", "SFONT", "fontStrokes", "parseSVG", "isStyle"];
const KEEP = new Set(["group", "reititys"]);
const defsStart = assertOnce("const DEFS = {", "DEFS start");
const defsClose = matchBrace(src, src.indexOf("{", defsStart));
const entries = [];
{
  const re = /\n  ([a-z0-9_]+): \{/g;
  re.lastIndex = src.indexOf("{", defsStart) + 1;
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
log.push("found " + entries.length + " entries still in App.jsx");
const migrate = entries.filter((e) => !KEEP.has(e.key));
const failed = [];
for (const e of migrate) {
  const used = NODE_HELPERS.filter((h) => new RegExp("\\b" + h + "\\b").test(e.inner));
  const imp = used.length ? 'import { ' + used.join(", ") + ' } from "../helpers.js";\n\n' : "";
  const file = path.resolve("src/defs/nodes/" + e.key + ".js");
  fs.writeFileSync(file, imp + "export default {\n  key: " + JSON.stringify(e.key) + "," + e.inner + "\n};\n");
  let refErr = null;
  try {
    const mod = await import(pathToFileURL(file).href + "?v=" + Date.now());
    const def = mod.default;
    const params = Object.fromEntries((def.params || []).map((q) => [q.key, q.def]));
    const fakeNode = { params, data: undefined, id: 1 };
    try {
      const insArr = typeof def.ins === "function" ? def.ins(fakeNode) : def.ins || [];
      def.compute(insArr.map(() => undefined), params, { W: 300, H: 200 }, fakeNode);
      if (def.overlay) def.overlay(params, { W: 300, H: 200 });
    } catch (err) {
      if (err instanceof ReferenceError) refErr = err.message;
    }
  } catch (err) { refErr = "module load: " + err.message; }
  if (refErr) {
    fs.unlinkSync(file);
    failed.push(e.key);
    log.push("STILL QUARANTINED " + e.key + " (" + refErr + ")");
  }
}
const ok = new Set(migrate.filter((e) => !failed.includes(e.key)).map((e) => e.key));
const removals = entries.filter((e) => ok.has(e.key)).map((e) => [e.start, e.end]).sort((a, b) => b[0] - a[0]);
for (const [s, e] of removals) src = src.slice(0, s) + src.slice(e);
log.push(ok.size + " nodes re-migrated, " + failed.length + " still quarantined");

fs.writeFileSync(FILE + ".bak-era-c0b", fs.readFileSync(FILE));
fs.writeFileSync(FILE, src);
log.forEach((l) => console.log(l));
console.log("files in src/defs/nodes: " + fs.readdirSync("src/defs/nodes").length);
console.log("App.jsx lines: " + src.split("\n").length);
console.log("OK - now run: npm run build");