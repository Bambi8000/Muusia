/* Era C3 - file param: node-defined accept + label (Point Cloud needs .xyz etc.) */
import fs from "fs";
const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };
function edit(oldS, newS, what) {
  const i = src.indexOf(oldS);
  if (i < 0) die("anchor not found (" + what + ")");
  if (src.indexOf(oldS, i + 1) >= 0) die("anchor not unique (" + what + ")");
  src = src.replace(oldS, newS);
  console.log("OK   " + what);
}
edit("function ParamRow({ def, value, onChange, wired, liveVal, portRef, portProps, onFileText, fileMode, fileLabel, onPromote }) {",
     "function ParamRow({ def, value, onChange, wired, liveVal, portRef, portProps, onFileText, fileMode, fileLabel, fileAccept, onPromote }) {",
     "ParamRow signature: fileAccept prop");
edit('<input type="file" accept={fileMode === "dataurl" ? "image/*" : ".svg,image/svg+xml"} style={{ display: "none" }}',
     '<input type="file" accept={fileMode === "dataurl" ? "image/*" : (fileAccept || ".svg,image/svg+xml")} style={{ display: "none" }}',
     "file input: accept from node def");
edit('fileLabel={def.fileImage ? "Choose image…" : null}',
     'fileLabel={def.fileImage ? "Choose image…" : (def.fileLabel || null)}\n                                  fileAccept={def.fileAccept || null}',
     "call site: pass fileAccept + fileLabel from def");
fs.writeFileSync(FILE, src);
console.log("OK - run npm run build");