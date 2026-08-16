import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.includes("def.imageMax") && src.includes("pd.showIf")) {
  console.log("SKIP  patch-engine-v262 already applied (imageMax + showIf found)");
  process.exit(0);
}

const edits = [
  {
    name: "imageMax: per-node raster intake cap (default 160 unchanged)",
    old: "                                      const MAX = 160;",
    neu: "                                      const MAX = Math.max(32, Math.min(1600, Math.round(def.imageMax || 160)));",
  },
  {
    name: "showIf: mode-dependent parameter visibility",
    old: "                            def.params.map((pd) => {\n                              const isNum = pd.type === \"slider\" || pd.type === \"number\" || pd.type === \"seed\";",
    neu: "                            def.params.filter((pd) => {\n                              if (typeof pd.showIf !== \"function\") return true;\n                              if (wiredParams.has(pd.key)) return true;\n                              try { return !!pd.showIf(node.params); } catch (e) { return true; }\n                            }).map((pd) => {\n                              const isNum = pd.type === \"slider\" || pd.type === \"number\" || pd.type === \"seed\";",
  },
];

for (const e of edits) {
  const parts = src.split(e.old);
  if (parts.length === 2) { src = parts.join(e.neu); OK(e.name); }
  else if (parts.length === 1) MISS(e.name + " (anchor not found)");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - " + FILE + " NOT written");
  process.exit(1);
}
writeFileSync(FILE, src);
console.log("DONE  " + ok + "/2 edits applied, " + FILE + " written");
