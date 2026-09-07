/* tools/era/patch-export-guard-tgpen.mjs — one-shot, two exporter changes.

   1. Pen colour to Telegram. The G-code already names the pen in a comment,
      but a comment reaches nobody's phone. An 11-pen plot pauses ten times and
      "PEN CHANGE" without the colour is not actionable. Opt-in per profile,
      because RESPOND aborts a print on a Klipper without [respond].

   2. Pre-flight bounds guard. The magnet-jig exporter checks every move against
      the work area; the plot exporter only warned if the whole canvas was
      oversized, so a single label overhanging by 4 mm shipped silently. This
      scans the finished file so it also covers start/end G-code the user typed.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-export-guard-tgpen.mjs                              */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const APP = ["src/App.jsx", "App.jsx"].find((p) => existsSync(p));
if (!APP) { console.log("MISS  src/App.jsx not found"); process.exit(1); }
let s = readFileSync(APP, "utf8");

if (s.includes("tgPen")) { console.log("SKIP  already applied (tgPen present)"); process.exit(0); }

const edits = [];
const swap = (label, from, to) => {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.log("MISS  " + label + " (" + n + " hits, need 1)"); process.exit(1); }
  s = s.replace(from, to);
  edits.push(label);
};

/* --- 1a. profile default --- */
swap("profile default tgPen",
  'flipY: false, pauseCmd: "M0",',
  'flipY: false, pauseCmd: "M0", tgPen: false,');

/* --- 1b. profile UI toggle, right under Pause command --- */
swap("profile UI toggle",
  `                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Moonraker WS URL</div>`,
  `                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, flex: 1 }}>Announce pen colour (Telegram tgalarm)</div>
                  <input type="checkbox" checked={!!prof.tgPen} onChange={(e) => setProf((pr) => ({ ...pr, tgPen: e.target.checked }))} style={{ accentColor: T.accent }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Moonraker WS URL</div>`);

/* --- 1c. emit the announcement before the pause --- */
swap("pen-change announcement",
  '      lines.push(`${prof.pauseCmd || "M0"} ; CHANGE PEN -> ${L % PENS.length}: ${PENS[L % PENS.length].name}`);',
  `      /* the phone needs the colour; the comment below is only ever read on screen */
      if (prof.tgPen) lines.push(\`RESPOND PREFIX=tgalarm MSG="Pen \${L % PENS.length}: \${PENS[L % PENS.length].name}"\`);
      lines.push(\`\${prof.pauseCmd || "M0"} ; CHANGE PEN -> \${L % PENS.length}: \${PENS[L % PENS.length].name}\`);`);

/* --- 2. bounds guard over the finished file --- */
swap("pre-flight bounds guard",
  `  lines.push("; done");
  return lines.join("\\n");`,
  `  /* Pre-flight bounds guard. Scanning the finished lines rather than the path
     data means start/end G-code and macro-driven moves are covered too. Klipper
     would reject these anyway, but mid-plot rather than before the pen moves. */
  {
    const bad = [];
    for (let i = 0; i < lines.length; i++) {
      const code = String(lines[i]).split(";")[0];
      if (!/^G[0-3]\\b/.test(code.trim())) continue;
      const mx = code.match(/(?:^|\\s)X(-?\\d+(?:\\.\\d+)?)/);
      const my = code.match(/(?:^|\\s)Y(-?\\d+(?:\\.\\d+)?)/);
      if (mx) { const v = parseFloat(mx[1]); if (v < 0 || v > prof.workW) bad.push(\`line \${i + 1}: X\${f2(v)} outside 0..\${prof.workW}\`); }
      if (my) { const v = parseFloat(my[1]); if (v < 0 || v > prof.workH) bad.push(\`line \${i + 1}: Y\${f2(v)} outside 0..\${prof.workH}\`); }
    }
    if (bad.length) {
      const at = Math.max(0, lines.findIndex((l) => !String(l).startsWith(";")));
      const moves = new Set(bad.map((b) => b.split(":")[0])).size;
      const block = [
        \`; !! OUT OF BOUNDS \\u2014 \${moves} move(s), \${bad.length} coordinate(s) outside the \${prof.workW} x \${prof.workH} mm work area\`,
        ...bad.slice(0, 8).map((b) => "; !!   " + b),
      ];
      if (bad.length > 8) block.push(\`; !!   ... and \${bad.length - 8} more\`);
      block.push(\`M117 OUT OF BOUNDS - \${moves} moves off the bed\`);
      lines.splice(at, 0, ...block);
    }
  }
  lines.push("; done");
  return lines.join("\\n");`);

writeFileSync(APP, s);
for (const e of edits) console.log("OK    " + e);
console.log("DONE  bump the version and rebuild");
