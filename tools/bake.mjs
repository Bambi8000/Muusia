/* bake.mjs - convert nodes-lab plotternode files into built-in ESM nodes
   Usage: node tools/bake.mjs <name...>   or   node tools/bake.mjs --all */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const HELPERS = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
  "pathLength", "applyStyle", "isStyle", "signedArea", "SFONT", "fontStrokes", "parseSVG"];
const args = process.argv.slice(2);
if (!args.length) { console.error("usage: node tools/bake.mjs <name...> | --all"); process.exit(1); }
const list = args[0] === "--all"
  ? fs.readdirSync("nodes-lab").filter((f) => f.endsWith(".plotternode.js")).map((f) => f.replace(".plotternode.js", ""))
  : args;
let fail = 0;
for (const n of list) {
  const srcFile = "nodes-lab/" + n + ".plotternode.js";
  if (!fs.existsSync(srcFile)) { console.error("SKIP " + n + ": " + srcFile + " not found"); fail++; continue; }
  const raw = fs.readFileSync(srcFile, "utf8").trim();
  if (!raw.startsWith("(") || !raw.endsWith(")")) { console.error("SKIP " + n + ": expected ({ ... }) wrapper"); fail++; continue; }
  const inner = raw.slice(1, -1).trim();          /* "{ ... }" */
  const used = HELPERS.filter((h) => new RegExp("\\b" + h + "\\b").test(inner));
  const imp = used.length ? 'import { ' + used.join(", ") + ' } from "../helpers.js";\n\n' : "";
  const target = "src/defs/nodes/" + n + ".js";
  fs.writeFileSync(target, imp + "export default " + inner + ";\n");
  try {
    const mod = await import(pathToFileURL(path.resolve(target)).href + "?v=" + Date.now());
    const def = mod.default;
    if (!def || !def.key || typeof def.compute !== "function") throw new Error("def invalid");
    if (def.key !== n) console.log("NOTE " + n + ": key is '" + def.key + "' (filename differs - fine, key wins)");
    console.log("BAKED " + n + " -> " + target + " (helpers: " + (used.join(", ") || "none") + ")");
  } catch (err) {
    fs.unlinkSync(target);
    console.error("FAIL " + n + ": " + err.message + " - not baked");
    fail++;
  }
}
process.exit(fail ? 1 : 0);