/* Era C1b - big preview ZoomBox wrap (still v2.23) */
import fs from "fs";
const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };
const J = (a) => a.join("\n");

const OLD = J([
'              <PathsSVG ps={primaryPS} W={megaW} H={megaH}',
'                width={Math.min(window.innerWidth - 100, (window.innerHeight - 140) * (canvasW / canvasH))}',
'                height={Math.min(window.innerHeight - 140, (window.innerWidth - 100) * (canvasH / canvasW))}',
'                arrows={showArrows} pad={16} guides={primaryGuides} magnets={previewMagnets} onMagnets={jigMode === "Manual" ? setManualMags : null} placing={jigMode === "Manual" && jigPlace} />',
]);
const NEW = J([
'              (() => {',
'                const bw2 = Math.min(window.innerWidth - 100, (window.innerHeight - 140) * (canvasW / canvasH));',
'                const bh2 = Math.min(window.innerHeight - 140, (window.innerWidth - 100) * (canvasH / canvasW));',
'                return (',
'                  <ZoomBox width={bw2} height={bh2}>',
'                    <PathsSVG ps={primaryPS} W={megaW} H={megaH} width={bw2} height={bh2}',
'                      arrows={showArrows} pad={16} guides={primaryGuides} magnets={previewMagnets} onMagnets={jigMode === "Manual" ? setManualMags : null} placing={jigMode === "Manual" && jigPlace} />',
'                  </ZoomBox>',
'                );',
'              })()',
]);
const i = src.indexOf(OLD);
if (i < 0) die("big preview anchor not found");
if (src.indexOf(OLD, i + 1) >= 0) die("anchor not unique");
src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src);
console.log("big preview: ZoomBox wrap OK - run npm run build");