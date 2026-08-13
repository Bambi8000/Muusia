/* patch-shortcuts-v260.mjs — ONE-SHOT era patch, do not re-run.
 *
 *   E1  kbOpen state (next to pensOpen)
 *   E2  "?" key toggles the shortcuts popover
 *   E3  toolbar Keys button (next to Pens) + the popover itself:
 *       every keyboard shortcut in one two-column list, grouped
 *
 * Run once from repo root: node tools/era/patch-shortcuts-v260.mjs
 * Sentinel afterwards: grep -c "kbOpen" src/App.jsx   (expect 2)
 */

import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
let ok = 0, miss = 0;

function edit(id, anchor, replacement, mode) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) { console.log("MISS " + id + " (anchor found " + n + "x)"); miss++; return; }
  src = src.replace(anchor,
    mode === "after" ? anchor + replacement :
    mode === "before" ? replacement + anchor : replacement);
  console.log("OK   " + id);
  ok++;
}

/* ---------- E1: state ---------- */
edit("E1 kbOpen state",
  "  const [pensOpen, setPensOpen] = useState(false);",
  "\n  const [kbOpen, setKbOpen] = useState(false); /* keyboard shortcuts popover */",
  "after");

/* ---------- E2: ? key ---------- */
edit("E2 ? key toggles popover",
  '      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "b") { e.preventDefault(); setCatalogOpen((v) => !v); }',
  '\n      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "?") { e.preventDefault(); setKbOpen((v) => !v); }',
  "after");

/* ---------- E3: toolbar button + popover ---------- */
edit("E3 Keys button + popover",
  '        <button style={toolBtn(true)} onClick={() => setPensOpen((v) => !v)} title="Edit pen colors (preview / SVG)">Pens</button>',
  `        <button style={toolBtn(true)} onClick={() => setKbOpen((v) => !v)} title="? \u2014 keyboard shortcuts">Keys</button>
        {kbOpen && (
          <div onClick={() => setKbOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 400 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ position: "absolute", top: 44, right: 260, width: 296, background: T.panel, border: "1px solid " + T.line, borderRadius: 7, padding: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
              <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.08em", marginBottom: 8 }}>KEYBOARD SHORTCUTS</div>
              {[
                ["Add nodes", [
                  ["G / M / D / C / X", "quick-add: Gen / Mod / Dec / Comb / Math"],
                  ["N or Cmd/Ctrl+K", "quick-add: all nodes (deep search)"],
                  ["\\u2191 \\u2193 + Enter", "pick and place in quick-add"],
                  ["B", "visual node catalog"],
                ]],
                ["Edit", [
                  ["Cmd/Ctrl+Z", "undo"],
                  ["Shift+Cmd/Ctrl+Z", "redo"],
                  ["Cmd/Ctrl+D", "duplicate selection"],
                  ["Cmd/Ctrl+G", "group selection"],
                  ["Delete / Backspace", "remove selection"],
                  ["Esc", "clear selection / close preview"],
                ]],
                ["View", [
                  ["Space", "big preview on/off"],
                  ["T", "tidy nodes by dataflow"],
                  ["?", "this list"],
                ]],
              ].map(([title, rows]) => (
                <div key={title} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.accent, letterSpacing: "0.08em", marginBottom: 3, textTransform: "uppercase" }}>{title}</div>
                  {rows.map(([k, what]) => (
                    <div key={k} style={{ display: "flex", gap: 8, fontSize: 10, marginBottom: 2 }}>
                      <div style={{ width: 128, color: T.text, fontFamily: mono, flexShrink: 0 }}>{k}</div>
                      <div style={{ color: T.dim }}>{what}</div>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ fontSize: 9, color: T.dim, marginTop: 4 }}>Shortcuts pause while typing in a field. Wheel = zoom, drag = pan, dblclick = reset in previews.</div>
            </div>
          </div>
        )}
        <button style={toolBtn(true)} onClick={() => setPensOpen((v) => !v)} title="Edit pen colors (preview / SVG)">Pens</button>`);

fs.writeFileSync(FILE, src);
console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
