import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");
let ok = 0, miss = 0, skip = 0;

const SENTINEL = "img: { w, h, g, rgb }";
if (src.includes(SENTINEL)) {
  console.log("SKIP  patch-image-rgb already applied (sentinel found)");
  process.exit(0);
}

const edits = [
  {
    name: "declare rgb array next to g",
    old: "                                      const g = new Array(w * h);",
    neu: "                                      const g = new Array(w * h);\n                                      const rgb = new Array(w * h * 3);",
  },
  {
    name: "fill rgb inside the decode loop (alpha over white)",
    old: "                                        g[i] = (1 - lum) * a;",
    neu: "                                        g[i] = (1 - lum) * a;\n                                        rgb[i * 3] = Math.round(d[i * 4] * a + 255 * (1 - a));\n                                        rgb[i * 3 + 1] = Math.round(d[i * 4 + 1] * a + 255 * (1 - a));\n                                        rgb[i * 3 + 2] = Math.round(d[i * 4 + 2] * a + 255 * (1 - a));",
  },
  {
    name: "store rgb in node.data.img",
    old: "data: { ...(n.data || {}), img: { w, h, g } } }",
    neu: "data: { ...(n.data || {}), img: { w, h, g, rgb } } }",
  },
];

for (const e of edits) {
  const parts = src.split(e.old);
  if (parts.length === 2) {
    src = parts.join(e.neu);
    console.log("OK    " + e.name);
    ok++;
  } else if (parts.length === 1) {
    console.log("MISS  " + e.name);
    miss++;
  } else {
    console.log("MISS  " + e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
    miss++;
  }
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - App.jsx NOT written");
  process.exit(1);
}
writeFileSync(FILE, src);
console.log("DONE  " + ok + "/3 edits applied, App.jsx written");
