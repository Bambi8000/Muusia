/* tools/era/patch-bg-image.mjs — v2.51 engine seam for background underlay images
 *
 * Adds the bgImage definition flag plumbing:
 *   E1  PathsSVG gains a `bg` prop
 *   E2  PathsSVG renders the bg <image> under paths (rect frame stays below it)
 *   E3  ctx gains additive `machine` subset of the active profile
 *   E4  file intake: def.bgImage routes to the intakeImage pipeline (EXIF,
 *       1280 px, JPEG dataURL at node.data.src) — same branch as faceAnalysis
 *   E5  previewBg: first bgImage node with a loaded photo, def.bgRender()
 *   E6  small preview PathsSVG call gets bg={previewBg}
 *   E7  big preview PathsSVG call gets bg={previewBg}
 *
 * Anchored exact-string replacement. Idempotent: SKIP when the new string is
 * already present. All-or-nothing: any MISS aborts without writing.
 *
 * After a successful run:
 *   grep -c "bgRender" src/App.jsx        -> 2
 *   grep -c "previewBg" src/App.jsx       -> 3
 *   grep -c "def.bgImage" src/App.jsx     -> 2 (E4 + E5 bdef.bgImage substring)
 *   grep -c "machine: { originX" src/App.jsx -> 1
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const EDITS = [
  {
    name: "E1 PathsSVG signature: bg prop",
    find: `function PathsSVG({ ps, W, H, width, height, arrows = false, pad = 4, guides = null, magnets = null, onMagnets = null, placing = false }) {`,
    repl: `function PathsSVG({ ps, W, H, width, height, arrows = false, pad = 4, guides = null, magnets = null, onMagnets = null, placing = false, bg = null }) {`,
  },
  {
    name: "E2 PathsSVG render: bg image under paths",
    find: `      <rect x={ox} y={oy} width={W * s} height={H * s} fill="none" stroke={T.paperLine} strokeWidth="1" />
      {els}`,
    repl: `      <rect x={ox} y={oy} width={W * s} height={H * s} fill="none" stroke={T.paperLine} strokeWidth="1" />
      {bg && bg.src ? (
        <image key="bg" href={bg.src}
          x={ox + (bg.cx - bg.w / 2) * s} y={oy + (bg.cy - bg.h / 2) * s}
          width={Math.max(0, bg.w * s)} height={Math.max(0, bg.h * s)}
          transform={\`rotate(\${bg.rotDeg || 0} \${ox + bg.cx * s} \${oy + bg.cy * s})\`}
          opacity={bg.opacity == null ? 0.4 : bg.opacity}
          style={bg.gray ? { filter: "grayscale(1)" } : undefined}
          preserveAspectRatio="none" />
      ) : null}
      {els}`,
  },
  {
    name: "E3 ctx.machine (additive profile subset)",
    find: `  const ctx = useMemo(() => ({ W: megaW, H: megaH, frameIdx, frameCount }), [megaW, megaH, frameIdx, frameCount]);`,
    repl: `  const ctx = useMemo(() => ({ W: megaW, H: megaH, frameIdx, frameCount, machine: { originX: prof.originX || 0, originY: prof.originY || 0, flipY: !!prof.flipY, laserOffX: prof.laserOffX || 0, laserOffY: prof.laserOffY || 0, workW: prof.workW || 0, workH: prof.workH || 0 } }), [megaW, megaH, frameIdx, frameCount, prof]);`,
  },
  {
    name: "E4 intake: bgImage joins the intakeImage branch",
    find: `                                  onFileText={pd.type === "file" && def.fileImage ? (dataUrl, name) => {
                                    if (def.faceAnalysis) {`,
    repl: `                                  onFileText={pd.type === "file" && def.fileImage ? (dataUrl, name) => {
                                    if (def.faceAnalysis || def.bgImage) {`,
  },
  {
    name: "E5 previewBg computation (after primaryGuides)",
    find: `    try { return def.overlay(merged, ctx, oins, primaryNode); } catch (e) { return null; }
  })();`,
    repl: `    try { return def.overlay(merged, ctx, oins, primaryNode); } catch (e) { return null; }
  })();

  /* background underlay: first bgImage node with a loaded photo (one at a time by design) */
  const previewBg = (() => {
    for (const n of lvl.nodes) {
      const bdef = DEFS[n.type];
      if (!bdef || !bdef.bgImage || !bdef.bgRender) continue;
      if (!n.data || !n.data.src) continue;
      const bmerged = { ...n.params, ...((pvals && pvals[n.id]) || {}) };
      if (bmerged.show === false) continue;
      try { const bgv = bdef.bgRender(bmerged, ctx, n); if (bgv && bgv.src) return bgv; } catch (e) {}
    }
    return null;
  })();`,
  },
  {
    name: "E6 small preview: bg prop",
    find: `<PathsSVG ps={primaryPS} W={megaW} H={megaH} width={316} guides={primaryGuides}`,
    repl: `<PathsSVG ps={primaryPS} W={megaW} H={megaH} width={316} bg={previewBg} guides={primaryGuides}`,
  },
  {
    name: "E7 big preview: bg prop",
    find: `<PathsSVG ps={primaryPS} W={megaW} H={megaH} width={bw2} height={bh2}
                      arrows={showArrows} pad={16} guides={primaryGuides}`,
    repl: `<PathsSVG ps={primaryPS} W={megaW} H={megaH} width={bw2} height={bh2}
                      arrows={showArrows} pad={16} bg={previewBg} guides={primaryGuides}`,
  },
];

const report = [];
let miss = 0, skip = 0, ok = 0;
for (const e of EDITS) {
  if (src.includes(e.repl)) { report.push(`SKIP  ${e.name} (already applied)`); skip++; continue; }
  const parts = src.split(e.find);
  if (parts.length === 2) { report.push(`OK    ${e.name}`); ok++; }
  else { report.push(`MISS  ${e.name} (found ${parts.length - 1} occurrences, need exactly 1)`); miss++; }
}
console.log(report.join("\n"));

if (miss > 0) {
  console.log(`\nABORT — ${miss} MISS, nothing written. Anchors have drifted; re-derive from current src/App.jsx.`);
  process.exit(1);
}
if (ok === 0) {
  console.log("\nAll edits already applied — nothing to do.");
  process.exit(0);
}
for (const e of EDITS) {
  if (src.includes(e.repl)) continue;
  src = src.split(e.find).join(e.repl);
}
writeFileSync(FILE, src);
console.log(`\nWROTE ${FILE} — ${ok} applied, ${skip} skipped.`);
console.log(`Verify: grep -c "bgRender" src/App.jsx (expect 2), grep -c "previewBg" (expect 3), grep -c "def.bgImage" (expect 2), grep -c "machine: { originX" (expect 1).`);
