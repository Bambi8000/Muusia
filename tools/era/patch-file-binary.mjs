/* One-shot era patch: add the `fileBinary` definition-level flag.
   A node with fileBinary: true gets its file read as a dataURL (like
   fileImage) but routed to the existing def.onFile branch, so onFile
   receives the dataURL string and can base64-decode binary formats
   (WAV audio etc). fileAccept now wins over the image/* default.
   Run once from repo root: node tools/era/patch-file-binary.mjs
   NOT idempotent beyond the SKIP guard - do not re-run carelessly.
   Post-patch sentinels:
     grep -c "fileBinary" src/App.jsx   -> 1
     grep -c "DroPanel" src/App.jsx     -> 2  (unchanged, overwrite guard) */
import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("fileBinary")) {
  console.log("SKIP  fileBinary already present in " + FILE);
  process.exit(0);
}

let ok = 0, miss = 0;
const rep = (name, from, to) => {
  const i = src.indexOf(from);
  if (i < 0) { console.log("MISS  " + name); miss++; return; }
  if (src.indexOf(from, i + 1) >= 0) { console.log("MISS  " + name + " (anchor not unique)"); miss++; return; }
  src = src.slice(0, i) + to + src.slice(i + from.length);
  console.log("OK    " + name);
  ok++;
};

rep("fileMode: fileBinary reads as dataURL",
  'fileMode={def.fileImage ? "dataurl" : "text"}',
  'fileMode={def.fileImage || def.fileBinary ? "dataurl" : "text"}');

rep("file input accept: fileAccept wins over image/*",
  'accept={fileMode === "dataurl" ? "image/*" : (fileAccept || ".svg,image/svg+xml")}',
  'accept={fileAccept || (fileMode === "dataurl" ? "image/*" : ".svg,image/svg+xml")}');

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - " + FILE + " NOT written");
  process.exit(1);
}
fs.writeFileSync(FILE, src);
console.log("WROTE " + FILE + " (" + ok + " replacements)");
