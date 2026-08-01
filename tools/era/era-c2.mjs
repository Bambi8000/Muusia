/* Era C2 - composed full-mega SVG + tile labels option (v2.30 work) */
import fs from "fs";
const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const log = [];
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };
function edit(oldS, newS, what) {
  const i = src.indexOf(oldS);
  if (i < 0) die("anchor not found (" + what + ")");
  if (src.indexOf(oldS, i + 1) >= 0) die("anchor not unique (" + what + ")");
  src = src.replace(oldS, newS);
  log.push("OK   " + what);
}
const J = (a) => a.join("\n");

/* 1. sliceMega: labels param + drawing */
edit("function sliceMega(ps, sw, sh, C, R, seam, mode, marks, markPen = 0) {",
     "function sliceMega(ps, sw, sh, C, R, seam, mode, marks, markPen = 0, labels = false) {",
     "sliceMega signature");
edit("      tiles.push({ paths });", J([
"      if (labels) {",
"        const LP = Math.max(0, Math.round(markPen));",
"        const txt = (r * C + c + 1) + \" R\" + (r + 1) + \"C\" + (c + 1);",
"        const fsx = fontStrokes(txt, 4, 1);",
"        for (const st of fsx.strokes) {",
"          paths.push({ pts: st.map(([gx, gy]) => [6 + gx, sh - 11 + gy]), closed: false, layer: LP });",
"        }",
"      }",
"      tiles.push({ paths });",
]), "sliceMega label drawing");

/* 2. state + call */
edit("const [megaSeam, setMegaSeam] = useState(5);", J([
"const [megaSeam, setMegaSeam] = useState(5);",
"  const [megaLabels, setMegaLabels] = useState(false);",
]), "megaLabels state");
edit("const megaTiles = () => sliceMega(exportPS(), canvasW, canvasH, megaC, megaR, megaSeam, megaMode, megaMarks, megaMarkPen);",
     "const megaTiles = () => sliceMega(exportPS(), canvasW, canvasH, megaC, megaR, megaSeam, megaMode, megaMarks, megaMarkPen, megaLabels);",
     "megaTiles call");

/* 3. composed full SVG handler */
edit("  const downloadJig = () => {", J([
"  const downloadMegaFull = () => {",
"    const svg = \"<!-- MEGA CANVAS - composed full work \" + Math.round(megaW) + \"x\" + Math.round(megaH) + \" mm. Proofing reference; the numbered tiles are the plottable output. -->\\n\"",
"      + toSVG(exportPS(), { W: megaW, H: megaH, frameIdx, frameCount });",
"    const blob = new Blob([svg], { type: \"image/svg+xml\" });",
"    const a = document.createElement(\"a\");",
"    a.href = URL.createObjectURL(blob);",
"    a.download = (projName || \"patch\") + \"-mega-full.svg\";",
"    document.body.appendChild(a);",
"    a.click();",
"    document.body.removeChild(a);",
"    setTimeout(() => URL.revokeObjectURL(a.href), 2000);",
"  };",
"  const downloadJig = () => {",
]), "downloadMegaFull handler");

/* 4. UI: labels checkbox + full-svg button before the crop marks row */
edit(J([
'                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>',
'                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: T.dim, flex: 1 }}>',
'                    <input type="checkbox" checked={megaMarks} onChange={(e) => setMegaMarks(e.target.checked)} />',
'                    Crop marks',
]), J([
'                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: T.dim }}>',
'                  <input type="checkbox" checked={megaLabels} onChange={(e) => setMegaLabels(e.target.checked)} />',
'                  Tile labels (number + row/col, mark pen)',
'                </label>',
'                <button onClick={downloadMegaFull}',
'                  title="One SVG of the whole composed work at full mega size - proofing reference, not a plottable tile"',
'                  style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid " + T.line, background: "transparent", color: T.accent, fontFamily: disp, fontWeight: 700, fontSize: 10, cursor: "pointer", letterSpacing: "0.03em", alignSelf: "flex-start" }}>',
'                  Download full SVG (composed proof)',
'                </button>',
'                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>',
'                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: T.dim, flex: 1 }}>',
'                    <input type="checkbox" checked={megaMarks} onChange={(e) => setMegaMarks(e.target.checked)} />',
'                    Crop marks',
]), "mega panel UI");

/* 5. persistence: save + load */
edit("mega: megaOn ? { C: megaC, R: megaR, seam: megaSeam, mode: megaMode, marks: megaMarks, markPen: megaMarkPen } : null",
     "mega: megaOn ? { C: megaC, R: megaR, seam: megaSeam, mode: megaMode, marks: megaMarks, markPen: megaMarkPen, labels: megaLabels } : null",
     "project save: labels");
edit("setMegaMarkPen(data.mega.markPen || 0); }",
     "setMegaMarkPen(data.mega.markPen || 0); setMegaLabels(!!data.mega.labels); }",
     "project load: labels");

fs.writeFileSync(FILE + ".bak-era-c2", fs.readFileSync(FILE));
fs.writeFileSync(FILE, src);
log.forEach((l) => console.log(l));
console.log("OK - now run: node tools/validate-megalabels.mjs && npm run build");