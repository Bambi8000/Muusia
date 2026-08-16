/* Era patch: preview Measure tool.
   Adds a Measure button to the preview panel. When armed, click two points on
   the preview sheet; a dashed line with a live mm readout appears between them.
   Points drag like manual magnet-jig handles; double-click a point removes it.
   Works in the small preview and the big-preview overlay. Toggling Measure off
   clears the points. Idempotent, MISS-aborts, anchored exact-string edits. */

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.includes("measDragRef")) {
  console.log("SKIP  patch-measure-tool already applied (sentinel found)");
  process.exit(0);
}

const vm = src.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
console.log("INFO  app version from repo: " + vm[1]);

const edits = [
  {
    name: "PathsSVG signature: measure props",
    old: `function PathsSVG({ ps, W, H, width, height, arrows = false, pad = 4, guides = null, magnets = null, onMagnets = null, placing = false, bg = null }) {`,
    neu: `function PathsSVG({ ps, W, H, width, height, arrows = false, pad = 4, guides = null, magnets = null, onMagnets = null, placing = false, bg = null, measure = null, onMeasure = null, measuring = false }) {`,
  },
  {
    name: "PathsSVG: measure drag ref",
    old: `  const dragRef = useRef(-1);`,
    neu: `  const dragRef = useRef(-1);
  const measDragRef = useRef(-1);`,
  },
  {
    name: "PathsSVG: measure layer (line + label + draggable endpoints)",
    old: `        <text x={px + rr + 3} y={py + 3.5} fontSize="10" fill={M} stroke="none" fontFamily="ui-monospace, monospace">{i + 1}</text>
      </g>
    );
  });`,
    neu: `        <text x={px + rr + 3} y={py + 3.5} fontSize="10" fill={M} stroke="none" fontFamily="ui-monospace, monospace">{i + 1}</text>
      </g>
    );
  });
  /* measure layer: up to two draggable points, dashed line, live mm readout */
  const MC = "#FFC24D";
  const msEls = [];
  if (measure && measure.length) {
    const P = measure.map(([x, y]) => [ox + x * s, oy + y * s]);
    if (P.length === 2) {
      const dmm = Math.hypot(measure[1][0] - measure[0][0], measure[1][1] - measure[0][1]);
      msEls.push(<line key="msl" x1={P[0][0]} y1={P[0][1]} x2={P[1][0]} y2={P[1][1]}
        stroke={MC} strokeWidth="1.4" strokeDasharray="6 4" opacity="0.95" pointerEvents="none" />);
      const lbl = dmm.toFixed(1) + " mm";
      const lx = (P[0][0] + P[1][0]) / 2, ly = (P[0][1] + P[1][1]) / 2;
      msEls.push(<g key="mst" pointerEvents="none">
        <rect x={lx - lbl.length * 3.1 - 4} y={ly - 19} width={lbl.length * 6.2 + 8} height={14} rx={3}
          fill="rgba(13,17,23,0.85)" stroke={MC} strokeWidth="0.8" />
        <text x={lx} y={ly - 8.5} textAnchor="middle" fontSize="10" fill={MC}
          fontFamily="ui-monospace, monospace">{lbl}</text>
      </g>);
    }
    measure.forEach(([qx, qy], i) => {
      const px = ox + qx * s, py = oy + qy * s;
      msEls.push(
        <g key={"ms" + i}
          onPointerDown={onMeasure ? (e) => {
            e.stopPropagation();
            measDragRef.current = i;
            const svg = e.currentTarget.ownerSVGElement;
            if (svg && svg.setPointerCapture) try { svg.setPointerCapture(e.pointerId); } catch (err) {}
          } : undefined}
          onDoubleClick={onMeasure ? (e) => { e.stopPropagation(); onMeasure(measure.filter((_, k) => k !== i)); } : undefined}
          style={{ cursor: onMeasure ? "grab" : "default" }}
          stroke={MC} strokeWidth="1.6" opacity="0.95">
          <circle cx={px} cy={py} r={6.5} fill="rgba(255,194,77,0.16)" />
          <line x1={px - 4.5} y1={py} x2={px + 4.5} y2={py} />
          <line x1={px} y1={py - 4.5} x2={px} y2={py + 4.5} />
        </g>
      );
    });
  }`,
  },
  {
    name: "PathsSVG: crosshair cursor while placing measure points",
    old: `cursor: placing && onMagnets ? "crosshair" : "default"`,
    neu: `cursor: (measuring && onMeasure && (measure || []).length < 2) || (placing && onMagnets) ? "crosshair" : "default"`,
  },
  {
    name: "PathsSVG: pointer handlers handle measure placement + drag",
    old: `      onPointerDown={placing && onMagnets ? (e) => {
        const [mx, my] = toMM(e);
        if (mx >= 0 && mx <= W && my >= 0 && my <= H) onMagnets([...(magnets || []), [q1(mx), q1(my)]]);
      } : undefined}
      onPointerMove={onMagnets ? (e) => {
        const i = dragRef.current;
        if (i < 0) return;
        const [mx, my] = toMM(e);
        onMagnets(magnets.map((q, k) => k === i ? [q1(Math.min(W, Math.max(0, mx))), q1(Math.min(H, Math.max(0, my)))] : q));
      } : undefined}
      onPointerUp={onMagnets ? () => { dragRef.current = -1; } : undefined}>`,
    neu: `      onPointerDown={(placing && onMagnets) || (measuring && onMeasure) ? (e) => {
        const [mx, my] = toMM(e);
        if (mx < 0 || mx > W || my < 0 || my > H) return;
        if (measuring && onMeasure) {
          if ((measure || []).length < 2) onMeasure([...(measure || []), [q1(mx), q1(my)]]);
          return;
        }
        onMagnets([...(magnets || []), [q1(mx), q1(my)]]);
      } : undefined}
      onPointerMove={onMagnets || onMeasure ? (e) => {
        const i = dragRef.current, j = measDragRef.current;
        if (i < 0 && j < 0) return;
        const [mx, my] = toMM(e);
        const cx = q1(Math.min(W, Math.max(0, mx))), cy = q1(Math.min(H, Math.max(0, my)));
        if (j >= 0 && onMeasure) { onMeasure((measure || []).map((q, k) => k === j ? [cx, cy] : q)); return; }
        if (i >= 0 && onMagnets) onMagnets(magnets.map((q, k) => k === i ? [cx, cy] : q));
      } : undefined}
      onPointerUp={onMagnets || onMeasure ? () => { dragRef.current = -1; measDragRef.current = -1; } : undefined}>`,
  },
  {
    name: "PathsSVG: render measure layer on top",
    old: `      {els}
      {gEls}
      {mEls}
    </svg>`,
    neu: `      {els}
      {gEls}
      {mEls}
      {msEls}
    </svg>`,
  },
  {
    name: "App state: measureOn + measurePts",
    old: `  const [jigPlace, setJigPlace] = useState(false); /* click-to-place armed */`,
    neu: `  const [jigPlace, setJigPlace] = useState(false); /* click-to-place armed */
  const [measureOn, setMeasureOn] = useState(false); /* preview measure tool armed */
  const [measurePts, setMeasurePts] = useState([]); /* 0..2 points [x,y] mm, preview coords */`,
  },
  {
    name: "small preview: pass measure props",
    old: `placing={jigMode === "Manual" && jigPlace} arrows={showArrows} pad={8} />`,
    neu: `placing={jigMode === "Manual" && jigPlace} measure={measureOn ? measurePts : null} onMeasure={measureOn ? setMeasurePts : null} measuring={measureOn} arrows={showArrows} pad={8} />`,
  },
  {
    name: "big preview: pass measure props",
    old: `placing={jigMode === "Manual" && jigPlace} />`,
    neu: `placing={jigMode === "Manual" && jigPlace} measure={measureOn ? measurePts : null} onMeasure={measureOn ? setMeasurePts : null} measuring={measureOn} />`,
  },
  {
    name: "preview controls: Measure button + readout",
    old: `                Show direction
              </label>
              <div style={{ flex: 1 }} />`,
    neu: `                Show direction
              </label>
              <button onClick={() => { const nv = !measureOn; setMeasureOn(nv); if (!nv) setMeasurePts([]); }}
                title="Measure distance on the sheet: click two points in the preview, drag to adjust, double-click a point to remove it"
                style={{ background: measureOn ? T.accent : T.panel2, border: \`1px solid \${measureOn ? T.accent : T.line}\`, color: measureOn ? "#0D1117" : T.text, borderRadius: 4, fontSize: 10, padding: "2px 8px", cursor: "pointer", fontFamily: mono }}>
                Measure
              </button>
              {measureOn && measurePts.length === 2 && (
                <span style={{ fontSize: 10, color: T.accent, fontFamily: mono, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {Math.hypot(measurePts[1][0] - measurePts[0][0], measurePts[1][1] - measurePts[0][1]).toFixed(1)} mm
                </span>
              )}
              <div style={{ flex: 1 }} />`,
  },
];

for (const e of edits) {
  const parts = src.split(e.old);
  if (parts.length === 2) { src = parts.join(e.neu); OK(e.name); }
  else if (parts.length === 1) MISS(e.name + " (anchor not found)");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - " + FILE + " NOT written");
  process.exit(1);
}
writeFileSync(FILE, src);
console.log("DONE  " + ok + "/" + edits.length + " edits applied, " + FILE + " written");
