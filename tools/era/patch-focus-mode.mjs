/* patch-focus-mode.mjs — Focus mode (F) + space-preview fixes.
 *
 * App.jsx:
 *   - Focus mode state (focusOn / focusWatch / focusGuides / lastSel)
 *   - primary falls back to last selected node (existence-checked per level)
 *   - keydown guard passes Space through from focused range sliders (scroll-jump fix)
 *   - F toggles focus mode, L locks WATCH, arrows navigate the wire graph
 *   - canvas narrows to a one-card strip, big WATCH preview panel beside it
 *   - right inspector panel hidden while focused
 *   - keyboard popover + Help texts updated
 *   - APP_VERSION bumped (read from disk, minor +1)
 * docs/MUUSIA-HANDOFF.md:
 *   - UI systems bullet + version history entry
 *
 * Anchored exact-string edits. MISS (0 or >1 hits) aborts before writing.
 * Idempotent: SKIP if already applied. Run from repo root.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "App.jsx");
if (!fs.existsSync(appPath)) {
  console.error("ABORT: src/App.jsx not found — run from the repo root");
  process.exit(1);
}
const handoffPath = ["docs/MUUSIA-HANDOFF.md", "MUUSIA-HANDOFF.md"]
  .map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
if (!handoffPath) {
  console.error("ABORT: MUUSIA-HANDOFF.md not found (looked in docs/ and root)");
  process.exit(1);
}

let app = fs.readFileSync(appPath, "utf8");
let hoff = fs.readFileSync(handoffPath, "utf8");

if (app.includes("setFocusOn")) {
  console.log("SKIP: focus mode already applied");
  process.exit(0);
}

const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) {
  console.error("ABORT: APP_VERSION not found in App.jsx");
  process.exit(1);
}
const oldV = vm[1] + "." + vm[2];
const newV = vm[1] + "." + (Number(vm[2]) + 1);

const J = (a) => a.join("\n");

/* ---------------- App.jsx edits ---------------- */

const edits = [];

edits.push({
  name: "state: focusOn / focusWatch / focusGuides / lastSel",
  find: '  const [kbOpen, setKbOpen] = useState(false); /* keyboard shortcuts popover */',
  replace: J([
    '  const [kbOpen, setKbOpen] = useState(false); /* keyboard shortcuts popover */',
    '  const [focusOn, setFocusOn] = useState(false);        /* Focus mode (F): node strip + big preview */',
    '  const [focusWatch, setFocusWatch] = useState(null);   /* locked WATCH node id; null = follow EDIT */',
    '  const [focusGuides, setFocusGuides] = useState(true); /* overlay guides toggle in focus preview */',
    '  const [lastSel, setLastSel] = useState(null);         /* last selected node id: preview fallback */',
  ]),
});

edits.push({
  name: "primary: fall back to last selected node",
  find: '  const primary = selIds.length ? selIds[selIds.length - 1] : null;',
  replace: J([
    '  const primary = selIds.length ? selIds[selIds.length - 1]',
    '    : (lastSel != null && lvl.nodes.some((n) => n.id === lastSel) ? lastSel : null);',
  ]),
});

edits.push({
  name: "record lastSel on selection change",
  find: '  const setEdgesL = (up) => setLevel((l) => ({ edges: typeof up === "function" ? up(l.edges) : up }));',
  replace: J([
    '  const setEdgesL = (up) => setLevel((l) => ({ edges: typeof up === "function" ? up(l.edges) : up }));',
    '  useEffect(() => { if (selIds.length) setLastSel(selIds[selIds.length - 1]); }, [selIds]);',
  ]),
});

edits.push({
  name: "keydown guard: let Space through from range sliders (scroll-jump fix)",
  find: J([
    '      const tag = (e.target.tagName || "").toLowerCase();',
    '      if (tag === "input" || tag === "textarea" || tag === "select") return;',
  ]),
  replace: J([
    '      const tag = (e.target.tagName || "").toLowerCase();',
    '      const ityp = tag === "input" ? (e.target.type || "").toLowerCase() : "";',
    '      if (tag === "input" && ityp === "range") { if (e.key !== " ") return; }',
    '      else if (tag === "input" || tag === "textarea" || tag === "select") return;',
  ]),
});

edits.push({
  name: "Escape: close focus mode first",
  find: '      else if (e.key === "Escape") { setBigPreview(false); setSelIds([]); }',
  replace: '      else if (e.key === "Escape") { if (focusOn) { setFocusOn(false); setFocusWatch(null); } else { setBigPreview(false); setSelIds([]); } }',
});

edits.push({
  name: "Space: no big preview while focus mode is on",
  find: '        setBigPreview((v) => (v ? false : primaryPS.paths.length > 0));',
  replace: '        if (!focusOn) setBigPreview((v) => (v ? false : primaryPS.paths.length > 0));',
});

edits.push({
  name: "keys: F toggle, L lock, arrow navigation",
  find: '      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); tidyNodes(); }',
  replace: J([
    '      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "f") {',
    '        e.preventDefault();',
    '        if (focusOn) { setFocusOn(false); setFocusWatch(null); }',
    '        else if (primary != null) { setBigPreview(false); setFocusOn(true); setFocusWatch(null); }',
    '      }',
    '      else if (focusOn && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "l") {',
    '        e.preventDefault();',
    '        setFocusWatch((w) => (w != null ? null : primary));',
    '      }',
    '      else if (focusOn && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {',
    '        e.preventDefault();',
    '        focusNav(e.key);',
    '      }',
    '      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); tidyNodes(); }',
  ]),
});

edits.push({
  name: "focusNav + auto-scroll effect",
  find: '  /* --- nappaimisto --- */',
  replace: J([
    '  /* --- Focus mode (F): EDIT node docked left, big WATCH preview beside it.',
    '     Arrow navigation over the wire graph: left/right = first-input upstream /',
    '     first-consumer downstream, up/down = sibling inputs of the same consumer',
    '     (fallback: cycle all nodes in level order). Only data edges (numeric',
    '     toPort) count — param wires are not navigation. --- */',
    '  const focusNav = (key) => {',
    '    if (primary == null) return;',
    '    const dataEdges = lvl.edges.filter((e) => typeof e.toPort === "number");',
    '    const go = (id) => { if (id != null && lvl.nodes.some((n) => n.id === id)) setSelIds([id]); };',
    '    if (key === "ArrowLeft") {',
    '      const ins = dataEdges.filter((e) => e.to === primary).sort((a, b) => a.toPort - b.toPort);',
    '      if (ins.length) go(ins[0].from);',
    '    } else if (key === "ArrowRight") {',
    '      const outs = dataEdges.filter((e) => e.from === primary);',
    '      if (outs.length) go(outs[0].to);',
    '    } else {',
    '      const dir = key === "ArrowDown" ? 1 : -1;',
    '      const consumer = dataEdges.find((e) => e.from === primary);',
    '      if (consumer) {',
    '        const sibs = [...new Set(dataEdges.filter((e) => e.to === consumer.to).sort((a, b) => a.toPort - b.toPort).map((e) => e.from))];',
    '        if (sibs.length > 1) {',
    '          const i = sibs.indexOf(primary);',
    '          go(sibs[(i + dir + sibs.length) % sibs.length]);',
    '          return;',
    '        }',
    '      }',
    '      const ids = lvl.nodes.map((n) => n.id);',
    '      const i = ids.indexOf(primary);',
    '      if (ids.length > 1 && i >= 0) go(ids[(i + dir + ids.length) % ids.length]);',
    '    }',
    '  };',
    '  useEffect(() => {',
    '    if (!focusOn || primary == null || !areaRef.current) return;',
    '    const fn = lvl.nodes.find((x) => x.id === primary);',
    '    if (!fn) return;',
    '    areaRef.current.scrollLeft = Math.max(0, fn.x * zoom - 20);',
    '    areaRef.current.scrollTop = Math.max(0, fn.y * zoom - 20);',
    '    // eslint-disable-next-line react-hooks/exhaustive-deps',
    '  }, [focusOn, primary, zoom]);',
    '',
    '  /* --- nappaimisto --- */',
  ]),
});

edits.push({
  name: "canvas: narrow to a one-card strip in focus mode",
  find: '          style={{ flex: 1, overflow: "auto", position: "relative", backgroundColor: T.bg }}>',
  replace: '          style={{ flex: focusOn ? "0 0 " + Math.round((NODE_W + 56) * zoom) + "px" : 1, overflow: "auto", position: "relative", backgroundColor: T.bg }}>',
});

edits.push({
  name: "focus preview panel (between canvas and right panel)",
  find: '        {/* ---------- Tarkastelupaneeli ---------- */}',
  replace: J([
    '        {/* ---------- Focus mode: iso WATCH-preview (F) ---------- */}',
    '        {focusOn && (() => {',
    '          const watchId = focusWatch != null && lvl.nodes.some((n) => n.id === focusWatch) ? focusWatch : primary;',
    '          const locked = focusWatch != null;',
    '          const wNode = lvl.nodes.find((n) => n.id === watchId);',
    '          const wOut = watchId != null ? results[watchId] : null;',
    '          const wPS = wOut && wOut[0] && wOut[0].paths ? wOut[0] : EMPTY;',
    '          const wStats = totalStats(wPS);',
    '          const nameOf = (n) => n ? (n.type === "group" ? "Group " + n.id : (DEFS[n.type] ? DEFS[n.type].name : n.type)) : "\\u2014";',
    '          const guides = focusGuides && watchId === primary ? primaryGuides : null;',
    '          const stripW = Math.round((NODE_W + 56) * zoom);',
    '          const availW = Math.max(220, window.innerWidth - 168 - stripW - 64);',
    '          const availH = Math.max(220, window.innerHeight - 190);',
    '          const fw = Math.min(availW, availH * (canvasW / canvasH));',
    '          const fh = Math.min(availH, availW * (canvasH / canvasW));',
    '          return (',
    '            <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid " + T.line, background: T.panel, display: "flex", flexDirection: "column" }}>',
    '              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid " + T.line, fontSize: 10, color: T.dim, letterSpacing: "0.08em" }}>',
    '                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>',
    '                  FOCUS {"\\u2014"} edit <span style={{ color: T.accent }}>{nameOf(primaryNode)}</span>',
    '                  {" \\u00B7 watch "}<span style={{ color: locked ? T.group : T.accent }}>{nameOf(wNode)}{locked ? " \\uD83D\\uDD12" : ""}</span>',
    '                </div>',
    '                <div style={{ flex: 1 }} />',
    '                <button style={toolBtn(locked)} onClick={() => setFocusWatch((w) => (w != null ? null : primary))}',
    '                  title="L \\u2014 lock the watched node: arrows then change only the edited node">',
    '                  {locked ? "Unlock watch" : "Lock watch"}',
    '                </button>',
    '                <button style={toolBtn(focusGuides)} onClick={() => setFocusGuides((v) => !v)}',
    '                  title="Overlay guides on/off in the preview (drawn when edit = watch)">',
    '                  Guides',
    '                </button>',
    '                <button style={toolBtn(true)} onClick={() => { setFocusOn(false); setFocusWatch(null); }} title="Esc / F">Close</button>',
    '              </div>',
    '              <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 8, overflow: "hidden" }}>',
    '                {wOut && !wPS.paths.length && (isStyle(wOut[0]) || typeof wOut[0] === "number") ? (',
    '                  <OutPreview out={wOut} W={megaW} H={megaH} width={Math.min(420, fw)} />',
    '                ) : simOn ? (',
    '                  <SimView ps={routeOpt ? routeOptimize(wPS, preserveDir) : wPS} W={megaW} H={megaH} width={fw} height={fh} />',
    '                ) : (',
    '                  <ZoomBox width={fw} height={fh}>',
    '                    <PathsSVG ps={wPS} W={megaW} H={megaH} width={fw} height={fh} arrows={showArrows} pad={12} bg={previewBg} guides={guides} />',
    '                  </ZoomBox>',
    '                )}',
    '              </div>',
    '              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 12px", borderTop: "1px solid " + T.line, fontSize: 10, color: T.dim }}>',
    '                <button style={toolBtn(simOn)} onClick={() => setSimOn((v) => !v)}>{simOn ? "\\u25FC Simulate" : "\\u25B6 Simulate"}</button>',
    '                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>',
    '                  <input type="checkbox" checked={showArrows} onChange={(e) => setShowArrows(e.target.checked)} style={{ accentColor: T.accent }} />',
    '                  Show direction',
    '                </label>',
    '                <div style={{ flex: 1 }} />',
    '                <div style={{ fontVariantNumeric: "tabular-nums", fontFamily: mono, whiteSpace: "nowrap" }}>',
    '                  {String(wStats.n).padStart(4, "\\u2007") + " paths \\u00B7 " + String(wStats.pts).padStart(6, "\\u2007") + " pts \\u00B7 " + (wStats.L / 1000).toFixed(2).padStart(6, "\\u2007") + " m"}',
    '                </div>',
    '                <div style={{ whiteSpace: "nowrap" }}>{"\\u2190\\u2192 stream \\u00B7 \\u2191\\u2193 siblings \\u00B7 L lock \\u00B7 Esc close"}</div>',
    '              </div>',
    '            </div>',
    '          );',
    '        })()}',
    '',
    '        {/* ---------- Tarkastelupaneeli ---------- */}',
  ]),
});

edits.push({
  name: "right panel hidden while focus mode is on",
  find: '        <div style={{ width: 340, borderLeft: `1px solid ${T.line}`, background: T.panel, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>',
  replace: '        <div style={{ width: 340, borderLeft: `1px solid ${T.line}`, background: T.panel, display: focusOn ? "none" : "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>',
});

edits.push({
  name: "keyboard popover: F / arrows / L rows",
  find: '                  ["Space", "big preview on/off"],',
  replace: J([
    '                  ["Space", "big preview on/off"],',
    '                  ["F", "focus mode: node docked left + big preview"],',
    '                  ["\\u2190 \\u2192", "focus: edit upstream / downstream"],',
    '                  ["\\u2191 \\u2193", "focus: cycle sibling inputs"],',
    '                  ["L", "focus: lock/unlock watched node"],',
  ]),
});

edits.push({
  name: "Help text: focus mode line",
  find: '                "Space \\u2014 toggle large preview (with route simulator).",',
  replace: J([
    '                "Space \\u2014 toggle large preview (with route simulator).",',
    '                "F \\u2014 focus mode: the selected node docks left as a live card and a large preview fills the rest. \\u2190/\\u2192 walk the wire chain, \\u2191/\\u2193 hop between sibling inputs, L locks the watched node so you can edit one node while watching another (e.g. tune a Merge input while watching the Merge).",',
  ]),
});

edits.push({
  name: "version bump " + oldV + " -> " + newV,
  find: 'APP_VERSION = "' + oldV + '"',
  replace: 'APP_VERSION = "' + newV + '"',
});

/* ---------------- HANDOFF edits ---------------- */

const hoffEdits = [];

hoffEdits.push({
  name: "HANDOFF: UI systems bullet",
  find: '  width % with cursor-anchored scroll compensation + grab-drag pan.',
  replace: J([
    '  width % with cursor-anchored scroll compensation + grab-drag pan.',
    '- **Focus mode (v' + newV + ', F):** the canvas narrows to a one-card strip (the',
    '  selected node auto-scrolled into it, fully live: sliders, files, gear',
    '  setup, promoted group params) and a large preview panel fills the rest.',
    '  Two roles: EDIT (the node in the strip) and WATCH (the preview source).',
    '  L / Lock watch pins WATCH so arrows only move EDIT — watch a Merge while',
    '  tuning its inputs. ←/→ walk first-input upstream / first-consumer',
    '  downstream, ↑/↓ cycle sibling inputs of the same consumer (fallback: all',
    '  nodes in level order); only data edges count, param wires are not',
    '  navigation. Guides button toggles overlay guides (drawn only when',
    '  EDIT = WATCH). Right panel hidden while focused; Esc/F exits. Space fix',
    '  shipped alongside: `primary` falls back to the last selected node',
    '  (existence-checked per level) so Space always opens a preview, and the',
    '  keydown guard passes Space through from focused range sliders with',
    '  preventDefault — the browser default (page scroll) was the "canvas jumps',
    '  to the bottom" bug.',
  ]),
});

hoffEdits.push({
  name: "HANDOFF: version history entry",
  find: '## Hard-won pitfalls (keep)',
  replace: J([
    '- **' + newV + '** **Focus mode** (engine, era patch patch-focus-mode.mjs): F',
    '  narrows the canvas to a one-card strip + big WATCH preview beside it;',
    '  EDIT/WATCH roles with L lock; arrow-key wire-graph navigation (←/→',
    '  stream, ↑/↓ siblings); Guides overlay toggle; Simulate + direction +',
    '  stats in the panel; right panel hidden while focused. Space-preview',
    '  fixes: last-selected fallback for `primary`, and Space from a focused',
    '  range slider no longer scrolls the canvas (guard passes it through with',
    '  preventDefault).',
    '',
    '## Hard-won pitfalls (keep)',
  ]),
});

/* ---------------- verify all, then apply ---------------- */

let miss = 0;
const check = (src, e, file) => {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error("MISS (" + n + " hits) [" + file + "] " + e.name); miss++; }
};
for (const e of edits) check(app, e, "App.jsx");
for (const e of hoffEdits) check(hoff, e, "HANDOFF");
if (miss) {
  console.error("ABORT: " + miss + " anchor(s) not found exactly once — nothing written");
  process.exit(1);
}

for (const e of edits) { app = app.split(e.find).join(e.replace); console.log("OK  " + e.name); }
for (const e of hoffEdits) { hoff = hoff.split(e.find).join(e.replace); console.log("OK  " + e.name); }

fs.writeFileSync(appPath, app);
fs.writeFileSync(handoffPath, hoff);
console.log("DONE: focus mode applied, APP_VERSION " + oldV + " -> " + newV);
