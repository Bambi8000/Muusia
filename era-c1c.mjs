/* Era C1c - magnet drag vs pan, popout flex-shrink zoom bug, pen index in G-code (still v2.23) */
import fs from "fs";
const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };
const J = (a) => a.join("\n");
function rep(oldS, newS, what) {
  const i = src.indexOf(oldS);
  if (i < 0) die("anchor not found (" + what + ")");
  if (src.indexOf(oldS, i + 1) >= 0) die("anchor not unique (" + what + ")");
  src = src.replace(oldS, newS);
  console.log(what);
}

/* 1. ZoomBox: pan only from background/drawing, not magnet handles */
rep(J([
'  const onMouseDown = (e) => {',
'    if (z <= 1) return;',
'    drag.current = { x: e.clientX, y: e.clientY, tx, ty };',
'  };',
]), J([
'  const onMouseDown = (e) => {',
'    if (z <= 1) return;',
'    const t = (e.target.tagName || "").toLowerCase();',
'    if (t === "circle" || t === "text") return; /* magnet handles keep their own drag */',
'    drag.current = { x: e.clientX, y: e.clientY, tx, ty };',
'  };',
]), "ZoomBox: ignore circle/text on pan start");

/* 2. popout: kill flex-shrink so width zoom is visible + un-center when zoomed */
rep('#muusia-pop{padding:10px;width:100%;}',
    '#muusia-pop{padding:10px;width:100%;flex:0 0 auto;}',
    "popout css: flex 0 0 auto");
rep(J([
'      zw = Math.max(100, Math.min(1600, zw * Math.exp(-e.deltaY * 0.0015)));',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = zw + "%";',
]), J([
'      zw = Math.max(100, Math.min(1600, zw * Math.exp(-e.deltaY * 0.0015)));',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = zw + "%";',
'      w.document.body.style.justifyContent = zw > 100.5 ? "flex-start" : "center";',
]), "popout: justify-content toggle");
rep(J([
'      zw = 100;',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = "100%";',
]), J([
'      zw = 100;',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = "100%";',
'      w.document.body.style.justifyContent = "center";',
]), "popout: dblclick recenters");

/* 3. pen index in G-code comments */
rep('lines.push(`${prof.pauseCmd || "M0"} ; CHANGE PEN -> ${PENS[L % PENS.length].name}`);',
    'lines.push(`${prof.pauseCmd || "M0"} ; CHANGE PEN -> ${L % PENS.length}: ${PENS[L % PENS.length].name}`);',
    "gcode: pen index in change comment");
rep('} else lines.push(`; Pen: ${PENS[L % PENS.length].name}`);',
    '} else lines.push(`; Pen ${L % PENS.length}: ${PENS[L % PENS.length].name}`);',
    "gcode: pen index in layer comment");
fs.writeFileSync(FILE, src);
console.log("OK - now run: npm run build");