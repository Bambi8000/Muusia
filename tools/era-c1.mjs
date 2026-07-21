/* MUUSIA Era C1 - v2.22 -> v2.23
   12 pens + editable colors (localStorage), pen row wrap, canvas size presets,
   node header D duplicate button, preview zoom (ZoomBox) + popout wheel zoom. */
import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const log = [];
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };
const J = (a) => a.join("\n");
function assertOnce(needle, what) {
  const i = src.indexOf(needle);
  if (i < 0) die("anchor not found (" + what + ")");
  if (src.indexOf(needle, i + 1) >= 0) die("anchor not unique (" + what + ")");
  return i;
}
function rep(oldS, newS, what) { assertOnce(oldS, what); src = src.replace(oldS, newS); log.push(what); }
function insBefore(anchor, ins, what) { const i = assertOnce(anchor, what); src = src.slice(0, i) + ins + src.slice(i); log.push(what); }
function insAfter(anchor, ins, what) { const i = assertOnce(anchor, what); src = src.slice(0, i + anchor.length) + ins + src.slice(i + anchor.length); log.push(what); }

/* ---------- 1. PENS: 12 colors + localStorage ---------- */
const OLD_PENS = J([
'const PENS = [',
'  { name: "Black", c: "#23242A" }, { name: "Blue", c: "#2A56A8" },',
'  { name: "Red", c: "#C23A30" }, { name: "Green", c: "#1F7A48" },',
'  { name: "Orange", c: "#D2761E" }, { name: "Purple", c: "#6C42A6" },',
'];',
]);
const NEW_PENS = J([
'const PENS_DEFAULT = [',
'  { name: "Black", c: "#23242A" }, { name: "Blue", c: "#2A56A8" },',
'  { name: "Red", c: "#C23A30" }, { name: "Green", c: "#1F7A48" },',
'  { name: "Orange", c: "#D2761E" }, { name: "Purple", c: "#6C42A6" },',
'  { name: "Teal", c: "#1F8A80" }, { name: "Magenta", c: "#C2408F" },',
'  { name: "Brown", c: "#7A4A2B" }, { name: "Gray", c: "#7D828C" },',
'  { name: "Ochre", c: "#B8952E" }, { name: "Sky", c: "#3E9BD6" },',
'];',
'const PENS = PENS_DEFAULT.map((p) => ({ ...p }));',
'try {',
'  const saved = JSON.parse(localStorage.getItem("muusia-pens") || "null");',
'  if (Array.isArray(saved)) saved.forEach((q, i) => {',
'    if (i < PENS.length && q && typeof q.c === "string" && /^#[0-9a-fA-F]{6}$/.test(q.c)) {',
'      PENS[i].c = q.c;',
'      if (typeof q.name === "string" && q.name.trim()) PENS[i].name = String(q.name).slice(0, 16);',
'    }',
'  });',
'} catch (e) { /* private mode / file:// quirks: fall back to defaults */ }',
'function savePens() { try { localStorage.setItem("muusia-pens", JSON.stringify(PENS)); } catch (e) {} }',
'function resetPens() { PENS.forEach((p, i) => { p.c = PENS_DEFAULT[i].c; p.name = PENS_DEFAULT[i].name; }); savePens(); }',
]);
{
  const hexes = [...NEW_PENS.matchAll(/c: "(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
  if (hexes.length !== 12) die("PENS_DEFAULT must have 12 colors, has " + hexes.length);
  if (new Set(hexes.map((h) => h.toLowerCase())).size !== 12) die("PENS_DEFAULT colors not unique");
}
rep(OLD_PENS, NEW_PENS, "pens: 12 colors + localStorage");

/* ---------- 2. pen param row: 12 dots, wrapping ---------- */
rep(J([
'        <div style={{ display: "flex", gap: 4, flex: 1 }}>',
'          {PENS.map((pen, i) => (',
'            <div key={i} onClick={() => onChange(i)} title={pen.name}',
'              style={{',
'                width: 16, height: 16, borderRadius: "50%", background: pen.c, cursor: "pointer",',
'                border: value === i ? `2px solid ${T.accent}` : "2px solid transparent",',
'                boxShadow: value === i ? "0 0 0 1px " + T.accent : "none",',
'              }} />',
'          ))}',
'        </div>',
]), J([
'        <div style={{ display: "flex", gap: 3, flex: 1, flexWrap: "wrap" }}>',
'          {PENS.map((pen, i) => (',
'            <div key={i} onClick={() => onChange(i)} title={i + ": " + pen.name}',
'              style={{',
'                width: 13, height: 13, borderRadius: "50%", background: pen.c, cursor: "pointer",',
'                border: value === i ? "2px solid " + T.accent : "2px solid transparent",',
'                boxShadow: value === i ? "0 0 0 1px " + T.accent : "none",',
'              }} />',
'          ))}',
'        </div>',
]), "pen row: 12 wrapping dots");

/* ---------- 3. toolbar: size presets + Pens editor ---------- */
insAfter(J([
'        <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.dim, fontSize: 11 }}>',
'          Canvas',
]).split("\n")[0] + "\n", J([
'          <select defaultValue="" onChange={(e) => { const v = e.target.value; if (!v) return; const wh = v.split("x"); setCanvasW(Number(wh[0])); setCanvasH(Number(wh[1])); e.target.value = ""; }}',
'            title="Paper size presets"',
'            style={{ background: T.panel2, color: T.text, border: "1px solid " + T.line, borderRadius: 3, padding: "2px 4px", fontSize: 10 }}>',
'            <option value="">Size preset</option>',
'            <option value="210x148">A5 wide</option>',
'            <option value="148x210">A5 tall</option>',
'            <option value="297x210">A4 wide</option>',
'            <option value="210x297">A4 tall</option>',
'            <option value="420x297">A3 wide</option>',
'            <option value="297x420">A3 tall</option>',
'            <option value="594x420">A2 wide</option>',
'            <option value="420x594">A2 tall</option>',
'          </select>',
'',
]), "toolbar: paper presets");
insAfter(J([
'          mm',
'        </div>',
]), "\n" + J([
'        <button style={toolBtn(true)} onClick={() => setPensOpen((v) => !v)} title="Edit pen colors (preview / SVG)">Pens</button>',
'        {pensOpen && (',
'          <div onClick={() => setPensOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 400 }}>',
'            <div onClick={(e) => e.stopPropagation()}',
'              style={{ position: "absolute", top: 44, right: 352, width: 236, background: T.panel, border: "1px solid " + T.line, borderRadius: 7, padding: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>',
'              <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.08em", marginBottom: 6 }}>PENS \u2014 preview / SVG colors</div>',
'              {PENS.map((pen, i) => (',
'                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>',
'                  <div style={{ fontSize: 9, color: T.dim, width: 14, textAlign: "right", fontFamily: mono }}>{i}</div>',
'                  <input type="color" value={pen.c}',
'                    onChange={(e) => { pen.c = e.target.value; savePens(); setPensVer((v) => v + 1); }}',
'                    style={{ width: 26, height: 20, padding: 0, border: "none", background: "none", cursor: "pointer" }} />',
'                  <input type="text" value={pen.name}',
'                    onChange={(e) => { pen.name = e.target.value.slice(0, 16); savePens(); setPensVer((v) => v + 1); }}',
'                    style={{ flex: 1, background: T.panel2, color: T.text, border: "1px solid " + T.line, borderRadius: 3, padding: "2px 5px", fontSize: 10, fontFamily: mono }} />',
'                </div>',
'              ))}',
'              <button style={toolBtn(true)} onClick={() => { resetPens(); setPensVer((v) => v + 1); }}>Reset defaults</button>',
'            </div>',
'          </div>',
'        )}',
]), "toolbar: Pens editor popover");

/* ---------- 4. states ---------- */
insAfter('  const [bigPreview, setBigPreview] = useState(false);', "\n" + J([
'  const [pensOpen, setPensOpen] = useState(false);',
'  const [, setPensVer] = useState(0);',
]), "states: pensOpen, pensVer");

/* ---------- 5. duplicate: refactor + D button ---------- */
rep(J([
'  const duplicateSelected = () => {',
'    if (!selIds.length) return;',
'    const sel = new Set(selIds);',
]), J([
'  const duplicateIds = (ids) => {',
'    if (!ids.length) return;',
'    const sel = new Set(ids);',
]), "duplicate: refactor to duplicateIds");
insAfter(J([
'    setSelIds(copies.map((c) => c.id));',
'  };',
]), "\n" + J([
'  const duplicateSelected = () => duplicateIds(selIds);',
'  const duplicateNode = (id) => duplicateIds([id]);',
]), "duplicate: wrappers");
insBefore(J([
'                      <div onClick={(ev) => { ev.stopPropagation(); toggleCollapse(node.id); }}',
'                        title={collapsed ? "Expand" : "Minimize"}',
]), J([
'                      <div onClick={(ev) => { ev.stopPropagation(); duplicateNode(node.id); }}',
'                        onMouseDown={(ev) => ev.stopPropagation()}',
'                        title="Duplicate this node"',
'                        style={{ cursor: "pointer", color: T.dim, fontSize: 10, lineHeight: 1, padding: "0 2px", fontWeight: 700, flexShrink: 0 }}>D</div>',
'',
]), "node header: D button");

/* ---------- 6. ZoomBox + wiring ---------- */
insBefore('function PathsSVG(', J([
'function ZoomBox({ children, width, height }) {',
'  const [z, setZ] = useState(1);',
'  const [tx, setTx] = useState(0);',
'  const [ty, setTy] = useState(0);',
'  const drag = useRef(null);',
'  const onWheel = (e) => {',
'    e.preventDefault();',
'    const r = e.currentTarget.getBoundingClientRect();',
'    const mx = e.clientX - r.left, my = e.clientY - r.top;',
'    const nz = Math.max(1, Math.min(16, z * Math.exp(-e.deltaY * 0.0015)));',
'    const k = nz / z;',
'    setZ(nz);',
'    setTx(nz === 1 ? 0 : mx - (mx - tx) * k);',
'    setTy(nz === 1 ? 0 : my - (my - ty) * k);',
'  };',
'  const onMouseDown = (e) => {',
'    if (z <= 1) return;',
'    drag.current = { x: e.clientX, y: e.clientY, tx, ty };',
'  };',
'  const onMouseMove = (e) => {',
'    if (!drag.current) return;',
'    setTx(drag.current.tx + (e.clientX - drag.current.x));',
'    setTy(drag.current.ty + (e.clientY - drag.current.y));',
'  };',
'  const end = () => { drag.current = null; };',
'  return (',
'    <div onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={end} onMouseLeave={end}',
'      onDoubleClick={() => { setZ(1); setTx(0); setTy(0); }}',
'      style={{ overflow: "hidden", width, height, cursor: z > 1 ? "grab" : "default", position: "relative" }}>',
'      <div style={{ transform: "translate(" + tx + "px, " + ty + "px) scale(" + z + ")", transformOrigin: "0 0", width, height }}>',
'        {children}',
'      </div>',
'      {z > 1 && (',
'        <div style={{ position: "absolute", right: 4, bottom: 4, fontSize: 9, color: T.dim, background: T.panel2 + "cc", padding: "1px 5px", borderRadius: 3, pointerEvents: "none" }}>',
'          {z.toFixed(1)}x \u00b7 dblclick reset',
'        </div>',
'      )}',
'    </div>',
'  );',
'}',
'',
]), "ZoomBox component");
rep(J([
'  const toMM = (e) => {',
'    const r = e.currentTarget.getBoundingClientRect();',
'    return [(e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s];',
'  };',
]), J([
'  const toMM = (e) => {',
'    const r = e.currentTarget.getBoundingClientRect();',
'    const k = r.width / width; /* CSS transform aware (ZoomBox) */',
'    return [((e.clientX - r.left) / k - ox) / s, ((e.clientY - r.top) / k - oy) / s];',
'  };',
]), "PathsSVG: transform-aware toMM");
rep('              <PathsSVG ps={primaryPS} W={megaW} H={megaH} width={316} guides={primaryGuides} height={316 * (megaH / megaW)} magnets={previewMagnets} onMagnets={jigMode === "Manual" ? setManualMags : null} placing={jigMode === "Manual" && jigPlace} arrows={showArrows} pad={8} />',
J([
'              <ZoomBox width={316} height={316 * (megaH / megaW)}>',
'                <PathsSVG ps={primaryPS} W={megaW} H={megaH} width={316} guides={primaryGuides} height={316 * (megaH / megaW)} magnets={previewMagnets} onMagnets={jigMode === "Manual" ? setManualMags : null} placing={jigMode === "Manual" && jigPlace} arrows={showArrows} pad={8} />',
'              </ZoomBox>',
]), "sidebar preview: ZoomBox wrap");
insBefore('    const poll = setInterval(() => { if (w.closed) { clearInterval(poll); setPopout(null); } }, 800);', J([
'    let zw = 100;',
'    w.document.addEventListener("wheel", (e) => {',
'      e.preventDefault();',
'      zw = Math.max(100, Math.min(1600, zw * Math.exp(-e.deltaY * 0.0015)));',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = zw + "%";',
'    }, { passive: false });',
'    w.document.addEventListener("dblclick", () => {',
'      zw = 100;',
'      const el2 = w.document.getElementById("muusia-pop");',
'      if (el2) el2.style.width = "100%";',
'    });',
'',
]), "popout: wheel zoom");

/* ---------- 7. version ---------- */
{
  const vm = src.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  if (!vm) die("APP_VERSION not found");
  if (vm[1] !== "2.22") die("expected 2.22, found " + vm[1]);
  src = src.replace(vm[0], vm[0].replace("2.22", "2.23"));
  log.push("version 2.23");
}
fs.writeFileSync(FILE + ".bak-era-c1", fs.readFileSync(FILE));
fs.writeFileSync(FILE, src);
log.forEach((l) => console.log(l));
console.log("OK - now run: npm run build");