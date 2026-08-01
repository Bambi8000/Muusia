/* Era C2b - XML comments must come AFTER the declaration (composed proof + panel preview) */
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
const J = (a) => a.join("\n");

edit(J([
'    const svg = "<!-- MEGA CANVAS - composed full work " + Math.round(megaW) + "x" + Math.round(megaH) + " mm. Proofing reference; the numbered tiles are the plottable output. -->\\n"',
'      + toSVG(exportPS(), { W: megaW, H: megaH, frameIdx, frameCount });',
]), J([
'    const svg = toSVG(exportPS(), { W: megaW, H: megaH, frameIdx, frameCount })',
'      .replace("?>\\n", "?>\\n<!-- MEGA CANVAS - composed full work " + Math.round(megaW) + "x" + Math.round(megaH) + " mm. Proofing reference; the numbered tiles are the plottable output. -->\\n");',
]), "composed proof: comment after xml declaration");

edit('      ? `<!-- ${note} -->\\n` + toSVG(tiles[0], sheetCtx)',
     '      ? toSVG(tiles[0], sheetCtx).replace("?>\\n", `?>\\n<!-- ${note} -->\\n`)',
     "panel preview: comment after xml declaration");

fs.writeFileSync(FILE, src);
console.log("OK - run npm run build");