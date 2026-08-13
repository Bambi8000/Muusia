/* patch-catalog-search-v257.mjs — ONE-SHOT era patch, do not re-run.
 *
 * Wires the node catalog (src/defs/catalog.js) into App.jsx:
 *   E1  import CATALOG
 *   E2  quick-add filter -> scored deep search (name/nick 3, tags 2, desc+catalog text 1,
 *       word-start matching, AND semantics per word) + match snippet for deep-only hits
 *   E3  Cmd/Ctrl+K opens the all-nodes quick-add (alias of N)
 *   E4  quick-add rows render the deep-match snippet
 *   E5  Help text mentions Cmd+K + deep search
 *
 * Run once from repo root: node tools/era/patch-catalog-search-v257.mjs
 * Sentinel afterwards: grep -c "CATALOG" src/App.jsx   (expect 2)
 */

import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
let ok = 0, miss = 0;

function edit(id, anchor, replacement, mode) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) { console.log("MISS " + id + " (anchor found " + n + "x)"); miss++; return; }
  src = src.replace(anchor, mode === "after" ? anchor + replacement : replacement);
  console.log("OK   " + id);
  ok++;
}

/* ---------- E1: import ---------- */
edit("E1 import CATALOG",
  'import { EXAMPLES } from "./examples.js";',
  '\nimport { CATALOG } from "./defs/catalog.js";',
  "after");

/* ---------- E2: scored deep search ---------- */
edit("E2 quick-add deep search",
`        const qq = quickAdd.query.toLowerCase();
        const list = Object.entries(DEFS).filter(([t, d]) =>
          !d.hidden &&
          (quickAdd.cat === null || d.cat === quickAdd.cat) &&
          (d.name.toLowerCase().includes(qq) || (nodeNicks[t] || "").toLowerCase().includes(qq)));`,
`        const qq = quickAdd.query.toLowerCase().trim();
        const terms = qq.split(/\\s+/).filter(Boolean);
        /* word-start match per term: "rib" hits "ribbon", "round" does not hit "background" */
        const rescape = (w) => w.split("").map((c) => /[a-z0-9]/.test(c) ? c : "\\\\" + c).join("");
        const termRes = terms.map((w) => new RegExp("(^|[^a-z0-9])" + rescape(w)));
        /* deep search: name/nick 3, tags 2, desc + catalog paragraph 1; every word must hit (AND) */
        const scoreOf = (t, d) => {
          if (!terms.length) return [1, null];
          const name = d.name.toLowerCase(), nick = (nodeNicks[t] || "").toLowerCase();
          const ce = CATALOG[t] || {};
          const tagStr = (ce.tags || []).join(" ");
          const deepRaw = (d.desc || "") + " " + (ce.t || "");
          const deep = deepRaw.toLowerCase();
          let s = 0, firstDeep = -1;
          for (const re of termRes) {
            if (re.test(name) || re.test(nick)) s += 3;
            else if (re.test(tagStr)) s += 2;
            else {
              const m = re.exec(deep);
              if (!m) return [0, null];
              s += 1;
              if (firstDeep < 0) firstDeep = m.index + m[1].length;
            }
          }
          let snip = null;
          if (firstDeep >= 0) {
            const a = Math.max(0, firstDeep - 24);
            snip = (a > 0 ? "\\u2026" : "") + deepRaw.slice(a, firstDeep + 46).trim() + "\\u2026";
          }
          return [s, snip];
        };
        const list = Object.entries(DEFS)
          .map(([t, d]) => {
            if (d.hidden || (quickAdd.cat !== null && d.cat !== quickAdd.cat)) return null;
            const [s, snip] = scoreOf(t, d);
            return s > 0 ? [t, d, s, snip] : null;
          })
          .filter(Boolean)
          .sort((a, b) => b[2] - a[2] || a[1].name.localeCompare(b[1].name));`);

/* ---------- E3: Cmd/Ctrl+K ---------- */
edit("E3 Cmd+K binding",
  '      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") { e.preventDefault(); groupSelected(); }',
  '\n      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setQuickAdd({ cat: null, query: "", sel: 0 }); }',
  "after");

/* ---------- E4: snippet row ---------- */
edit("E4 row snippet render",
`                {list.map(([type, d], i) => (`,
`                {list.map(([type, d, _s, snip], i) => (`);

edit("E4b snippet div",
`                    <div style={{ flex: 1, fontSize: 12, color: T.text, fontFamily: mono }}>
                      {d.name}
                      {nodeNicks[type] && <span style={{ color: T.accent, marginLeft: 6, fontSize: 11 }}>· {nodeNicks[type]}</span>}
                    </div>`,
`                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.text, fontFamily: mono }}>
                        {d.name}
                        {nodeNicks[type] && <span style={{ color: T.accent, marginLeft: 6, fontSize: 11 }}>· {nodeNicks[type]}</span>}
                      </div>
                      {snip && <div style={{ fontSize: 9, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{snip}</div>}
                    </div>`);

/* ---------- E5: help text ---------- */
edit("E5 help text",
  '"G / M / D / C / X \\u2014 quick-add search: Generators / Modifiers / Decorators / Combiners / Math \\u00B7 N \\u2014 all nodes. Type to filter, \\u2191\\u2193 + Enter places the node.",',
  '"G / M / D / C / X \\u2014 quick-add search: Generators / Modifiers / Decorators / Combiners / Math \\u00B7 N or Cmd/Ctrl+K \\u2014 all nodes. Search digs deeper than names: descriptions and tags too (try round, mesh, ribbon). Type to filter, \\u2191\\u2193 + Enter places the node.",');

fs.writeFileSync(FILE, src);
console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
