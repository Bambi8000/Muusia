/* patch-stack-view.mjs — wire src/stack-view.jsx into App.jsx.
 *
 * Anchored exact-string edits, MISS aborts before writing, idempotent
 * (sentinel: the stack-view import line). Run from the repo root:
 *   node tools/era/patch-stack-view.mjs
 *
 * Edits:
 *  1. import StackView after the CatalogBrowser import
 *  2. stackOpen state after catalogOpen
 *  3. "s" key toggle after the "b" key line
 *  4. Stack toolbar button after the Catalog button
 *  5. Keys popover row in the View group
 *  6. StackView render block after the CatalogBrowser render block
 *     (evalFrame closure replicates the exportAllFrames per-frame
 *     evaluation: evalLevel + group-stack walk + primaryNode output)
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const SENTINEL = 'import StackView from "./stack-view.jsx";';
if (src.includes(SENTINEL)) {
  console.log("SKIP  patch-stack-view already applied");
  process.exit(0);
}

const edits = [
  {
    name: "1 import",
    anchor: 'import CatalogBrowser from "./catalog-browser.jsx";',
    insert: '\nimport StackView from "./stack-view.jsx";',
  },
  {
    name: "2 state",
    anchor: 'const [catalogOpen, setCatalogOpen] = useState(false); /* visual node catalog overlay */',
    insert: '\n  const [stackOpen, setStackOpen] = useState(false); /* 3D layer stack overlay */',
  },
  {
    name: "3 key",
    anchor: 'else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "b") { e.preventDefault(); setCatalogOpen((v) => !v); }',
    insert: '\n      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); setStackOpen((v) => !v); }',
  },
  {
    name: "4 toolbar",
    anchor: '<button style={toolBtn(true)} onClick={() => setCatalogOpen(true)} title="B — browse every node as a live thumbnail: deep search, category + tag filters, Surprise me">Catalog</button>',
    insert: '\n        <button style={toolBtn(true)} onClick={() => setStackOpen(true)} title="S — 3D layer stack: preview frames or pens as stacked plexi/glass sheets">Stack</button>',
  },
  {
    name: "5 popover row",
    anchor: '["T", "tidy nodes by dataflow"],',
    insert: '\n                  ["S", "3D layer stack view"],',
  },
  {
    name: "6 render block",
    anchor: 'defaults={defaults} onAdd={(t) => addNode(t)} onClose={() => setCatalogOpen(false)} />\n      )}',
    insert: `

      {/* ---------- Stack View (3D layer stack) ---------- */}
      {stackOpen && (
        <StackView PENS={PENS} T={T} mono={mono} disp={disp} W={canvasW} H={canvasH}
          frameCount={frameCount} primaryPS={primaryPS}
          evalFrame={(f, n) => {
            if (!primaryNode) return EMPTY;
            const ctxF = { W: canvasW, H: canvasH, frameIdx: f, frameCount: n };
            let level = root, res = evalLevel(root, ctxF, null);
            for (const gid of stack) {
              const g = level.nodes.find((nd) => nd.id === gid);
              if (!g || !g.data) break;
              const gIns = g.data.bindings.map((b, k) => {
                const e = level.edges.find((ed) => ed.to === g.id && ed.toPort === k);
                return e ? (res.out[e.from] || [])[e.fromPort || 0] : undefined;
              });
              level = g.data;
              res = evalLevel(level, ctxF, gIns);
            }
            const out = res.out[primaryNode.id];
            return out && out[0] && out[0].paths ? out[0] : EMPTY;
          }}
          onClose={() => setStackOpen(false)} />
      )}`,
  },
];

let fail = false;
const staged = [];
for (const e of edits) {
  const parts = src.split(e.anchor);
  if (parts.length !== 2) {
    console.log(`MISS  ${e.name} (${parts.length - 1} hits)`);
    fail = true;
  } else {
    console.log(`OK    ${e.name}`);
    staged.push(e);
  }
}
if (fail) {
  console.log("ABORT nothing written");
  process.exit(1);
}
for (const e of staged) {
  const parts = src.split(e.anchor);
  if (parts.length !== 2) {
    console.log(`ABORT ${e.name} anchor no longer unique after earlier edits — nothing written`);
    process.exit(1);
  }
  src = parts[0] + e.anchor + e.insert + parts[1];
}
writeFileSync(FILE, src);
console.log("DONE  6 edits written to src/App.jsx");
