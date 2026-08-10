#!/usr/bin/env node
/* Muusia export side of the canvas check feature:
   - toGcode(): emit CANVAS_CHECK with real path bounds (machine coords,
     origin + flipY baked in via fx/fy) + laser offset from the profile
   - DEFAULT_MACHINE: canvasCheckOn: false (opt-in — the macro pauses the job)
   - profile panel: CANVAS CHECK checkbox after the laser jig section
   Anchored replacement, OK/MISS report, writes only if ALL anchors hit once.
   ONE-SHOT — lives in tools/era/ after running. Run from the repo root:
     node tools/era/patch-canvas-check.mjs */

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const edits = [
  {
    name: "C1 toGcode: emit CANVAS_CHECK after startG",
    find: `  lines.push(\`; Pen settle: down \${prof.penDelayDown}ms / up \${prof.penDelayUp}ms\`);
  for (const l of String(prof.startG || "").split("\\n")) if (l.trim()) lines.push(l);`,
    replace: `  lines.push(\`; Pen settle: down \${prof.penDelayDown}ms / up \${prof.penDelayUp}ms\`);
  for (const l of String(prof.startG || "").split("\\n")) if (l.trim()) lines.push(l);
  /* canvas check: laser-framed bounds before plotting (CANVAS_CHECK macro in
     klipper/canvas-check.cfg). Bounds in machine coords via fx/fy so origin +
     flipY are baked in; laser offset comes from the profile. Opt-in. */
  if (prof.canvasCheckOn) {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const pa of ps.paths) {
      if (pa.__stop) continue;
      for (const q of pa.pts) {
        const gx = fx(q[0]), gy = fy(q[1]);
        if (gx < bx0) bx0 = gx;
        if (gx > bx1) bx1 = gx;
        if (gy < by0) by0 = gy;
        if (gy > by1) by1 = gy;
      }
    }
    if (isFinite(bx0)) lines.push(\`CANVAS_CHECK X_MIN=\${f2(bx0)} X_MAX=\${f2(bx1)} Y_MIN=\${f2(by0)} Y_MAX=\${f2(by1)} LASER_OFF_X=\${f2(prof.laserOffX || 0)} LASER_OFF_Y=\${f2(prof.laserOffY || 0)} ; frame the job, pause for confirm\`);
  }`,
  },
  {
    name: "C2 DEFAULT_MACHINE: canvasCheckOn",
    find: `    moonrakerUrl: "ws://192.168.0.57:7125/websocket",`,
    replace: `    moonrakerUrl: "ws://192.168.0.57:7125/websocket",
    canvasCheckOn: false,`,
  },
  {
    name: "C3 profile panel: CANVAS CHECK toggle after laser jig",
    find: `Offset = laser dot position relative to the pen tip. The jig moves the pen so the laser lands on each magnet spot.
                    </div>
                  </>
                )}`,
    replace: `Offset = laser dot position relative to the pen tip. The jig moves the pen so the laser lands on each magnet spot.
                    </div>
                  </>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 6px" }}>
                  <input type="checkbox" checked={!!prof.canvasCheckOn} onChange={(e) => setProf((pr) => ({ ...pr, canvasCheckOn: e.target.checked }))} style={{ accentColor: T.accent }} />
                  <div style={{ fontSize: 10, color: T.text, letterSpacing: "0.05em" }}>CANVAS CHECK (laser frame before plot)</div>
                </div>
                {prof.canvasCheckOn && (
                  <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.5, marginBottom: 4 }}>
                    G-code starts with CANVAS_CHECK: the laser traces the job bounds, then the job pauses for Continue/Abort on the touchscreen. Needs canvas-check.cfg on the machine. Uses the laser offset above.
                  </div>
                )}`,
  },
];

let ok = true;
for (const e of edits) {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error(`MISS  ${e.name} — anchor found ${n}x (expected 1)`); ok = false; }
}
if (!ok) { console.error("No changes written."); process.exit(1); }
for (const e of edits) { src = src.replace(e.find, e.replace); console.log(`OK    ${e.name}`); }
writeFileSync(FILE, src);
console.log(`Wrote ${FILE}. Next: npm run build, then bump APP_VERSION.`);
