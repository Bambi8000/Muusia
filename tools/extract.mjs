/* extract.mjs - print a DEFS node block by display name
   Usage: node extract.mjs "Mountains" */
import fs from "fs";
const src = fs.readFileSync("src/App.jsx", "utf8");
const name = process.argv[2];
if (!name) { console.error("usage: node extract.mjs \"Node Name\""); process.exit(1); }
const ni = src.indexOf('name: "' + name + '"');
if (ni < 0) { console.error("not found: " + name); process.exit(1); }
const heads = [...src.slice(0, ni).matchAll(/\n  ([a-z0-9_]+): \{/g)];
const m = heads[heads.length - 1];
let depth = 0, mode = null, close = -1;
for (let i = m.index + m[0].length - 1; i < src.length; i++) {
  const c = src[i], n = src[i + 1];
  if (mode === null) {
    if (c === '"' || c === "'" || c === "`") mode = c;
    else if (c === "/" && n === "/") { mode = "//"; i++; }
    else if (c === "/" && n === "*") { mode = "/*"; i++; }
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (!depth) { close = i; break; } }
  } else if (mode === "//") { if (c === "\n") mode = null; }
  else if (mode === "/*") { if (c === "*" && n === "/") { mode = null; i++; } }
  else { if (c === "\\") i++; else if (c === mode) mode = null; }
}
console.log(src.slice(m.index + 1, close + 1));