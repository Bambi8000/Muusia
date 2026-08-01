/* Era C1d - popout zoom: cursor-anchored + drag pan (still v2.23) */
import fs from "fs";
const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };
const J = (a) => a.join("\n");

const OLD = J([
'    let zw = 100;',
'    w.document.addEventListener("wheel", (e) => {',
'      e.preventDefault();',
'      zw = Math.max(100, Math.min(1600, zw * Math.exp(-e.deltaY * 0.0015)));',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = zw + "%";',
'      w.document.body.style.justifyContent = zw > 100.5 ? "flex-start" : "center";',
'    }, { passive: false });',
'    w.document.addEventListener("dblclick", () => {',
'      zw = 100;',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = "100%";',
'      w.document.body.style.justifyContent = "center";',
'    });',
]);
const NEW = J([
'    let zw = 100;',
'    let pd = null;',
'    const sc = () => w.document.scrollingElement || w.document.documentElement;',
'    w.document.addEventListener("wheel", (e) => {',
'      e.preventDefault();',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (!el2) return;',
'      const oldW = el2.offsetWidth;',
'      zw = Math.max(100, Math.min(1600, zw * Math.exp(-e.deltaY * 0.0015)));',
'      el2.style.width = zw + "%";',
'      w.document.body.style.justifyContent = zw > 100.5 ? "flex-start" : "center";',
'      const k = el2.offsetWidth / oldW; /* layout is sync after the width write */',
'      sc().scrollLeft = (sc().scrollLeft + e.clientX) * k - e.clientX;',
'      sc().scrollTop = (sc().scrollTop + e.clientY) * k - e.clientY;',
'    }, { passive: false });',
'    w.document.addEventListener("mousedown", (e) => {',
'      if (zw <= 100.5) return;',
'      pd = { x: e.clientX, y: e.clientY, sl: sc().scrollLeft, st: sc().scrollTop };',
'      w.document.body.style.cursor = "grabbing";',
'      e.preventDefault();',
'    });',
'    w.document.addEventListener("mousemove", (e) => {',
'      if (!pd) return;',
'      sc().scrollLeft = pd.sl - (e.clientX - pd.x);',
'      sc().scrollTop = pd.st - (e.clientY - pd.y);',
'    });',
'    w.document.addEventListener("mouseup", () => { pd = null; w.document.body.style.cursor = ""; });',
'    w.document.addEventListener("dblclick", () => {',
'      zw = 100;',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = "100%";',
'      w.document.body.style.justifyContent = "center";',
'      sc().scrollLeft = 0; sc().scrollTop = 0;',
'    });',
]);
const i = src.indexOf(OLD);
if (i < 0) die("popout zoom block not found (was era-c1c applied?)");
if (src.indexOf(OLD, i + 1) >= 0) die("anchor not unique");
src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src);
console.log("popout: cursor-anchored zoom + drag pan OK - run npm run build");