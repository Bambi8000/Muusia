/* Era patch: machine profiles phase 1 — explicit export workflow
   (docs/MUUSIA-MACHINE-PROFILES-CLAUDE-HANDOFF.md). Run from the repo root
   after src/machine.js and tools/validate-machine.mjs are in place. Anchored
   exact-string replacement; MISS aborts before writing; SKIP if applied.

   App.jsx
     - imports src/machine.js; DEFAULT_MACHINE / _B move there (single source)
     - prof gate: gcodeProf, toGcodeGated, jigGcodeGated — every G-code route
       (normal export, Mega preview + zip, animation frames, Stack, laser jig)
       returns gcodeRefusal() for an svg-external profile
     - import / export / copy / patch save+load / Set default go through
       readMachineFile, writeMachineFile (v2 + minApp), normalizeMachine(s),
       assignIds, clampIdx; failed imports never empty the list
     - ctx.machine via machineCtx (svg-external: no origin / flip / laser offset)
     - profile switch or workflow change clears the generated preview
     - MACHINE SETUP: Workflow select; svg-external shows name, manufacturer,
       model, work area (unset until given), source URL, verified-on, the
       external-program instructions and the minimum app version; all G-code
       sections (origin, flip, pause, Telegram, Moonraker, Z mode, speeds, laser
       jig, canvas check, start/end, rotation, dip, maintenance) hidden
     - G-code / animation / jig buttons disabled with a reason; DRO gets no URL
   stack-view.jsx
     - gcodeEnabled prop: the G-code .zip button is hidden for svg-external     */

import { readFileSync, writeFileSync } from "node:fs";

const F_APP = "src/App.jsx", F_STACK = "src/stack-view.jsx";
let app = readFileSync(F_APP, "utf8"), stack = readFileSync(F_STACK, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };
if (app.includes('from "./machine.js"')) { console.log("SKIP  patch-machine-workflow already applied (sentinel found)"); process.exit(0); }

const one = (src, old, neu, name) => { const parts = src.split(old); if (parts.length === 2) { OK(name); return parts.join(neu); } MISS(name + (parts.length === 1 ? " (anchor not found)" : " (anchor not unique: " + (parts.length - 1) + " hits)")); return src; };
const all = (src, old, neu, name, expected) => { const parts = src.split(old); if (parts.length === expected + 1) { OK(name + " (" + expected + " sites)"); return parts.join(neu); } MISS(name + " (expected " + expected + " hits, got " + (parts.length - 1) + ")"); return src; };

/* ---------- App.jsx ---------- */

/* 1. import */
app = one(app, 'import StackView from "./stack-view.jsx";',
  'import StackView from "./stack-view.jsx";\nimport { DEFAULT_MACHINE, DEFAULT_MACHINE_B, DEFAULT_SVG_MACHINE, MACHINE_FILE_VERSION, MACHINE_MIN_APP, SVG_WORKFLOW_HELP, isGcodeWorkflow, gcodeRefusal, normalizeMachine, normalizeMachines, readMachineFile, writeMachineFile, convertWorkflow, machineCtx, nextId, assignIds } from "./machine.js";',
  "App.jsx: import machine.js");

/* 2. legacy templates move to machine.js (deletion before insertions) */
app = one(app, `  const DEFAULT_MACHINE = {
    name: "A — Servo Z (multi-tip brush)",
    workW: 330, workH: 240, originX: 0, originY: 0, flipY: false, pauseCmd: "M0", tgPen: false,
    startG: "G21 ; mm\\nG90 ; absolute\\nG28 ; home",
    endG: "G0 X0 Y0",
    zMode: "servo", servoName: "pen", servoUp: 90, servoDown: 35,
    penUp: 3, penDown: 0, feedDraw: 1800, feedTravel: 6000, zFeed: 600,
    zHop: 1.5, zHopOn: true, penDelayDown: 120, penDelayUp: 80,
    rotOn: false, rotStepper: "pen_rotate", rotThresh: 20,
    dipOn: false, dipX: 320, dipY: 20, dipZ: -2, dipEvery: 800, dipDwell: 600,
    maintOn: false, maintEvery: 4000, maintMsg: "Advance chalk / re-sharpen", maintPark: false, maintX: 20, maintY: 20,
    laserOn: false, laserOffX: 0, laserOffY: 0, laserOnCmd: "SET_PIN PIN=laser VALUE=1", laserOffCmd: "SET_PIN PIN=laser VALUE=0",
    moonrakerUrl: "ws://192.168.0.57:7125/websocket",
    canvasCheckOn: false,
  };
  const DEFAULT_MACHINE_B = {
    ...DEFAULT_MACHINE,
    name: "B — Bed Z + rotation",
    zMode: "bed", rotOn: true,
  };
  const [machines, setMachines] = useState([DEFAULT_MACHINE, DEFAULT_MACHINE_B]);`,
  `  /* machine templates live in src/machine.js (DEFAULT_MACHINE, DEFAULT_MACHINE_B, DEFAULT_SVG_MACHINE) */
  const [machines, setMachines] = useState(() => assignIds([DEFAULT_MACHINE, DEFAULT_MACHINE_B]));`,
  "App.jsx: DEFAULT_MACHINE / _B removed from the component, ids assigned");

/* 3. prof + gate + machine file io */
app = one(app, `  const prof = machines[Math.min(machineIdx, machines.length - 1)];
  const setProf = (fn) => setMachines((ms) => ms.map((m, i) =>
    i === Math.min(machineIdx, ms.length - 1) ? (typeof fn === "function" ? fn(m) : fn) : m));
  const exportMachine = () => {
    const blob = new Blob([JSON.stringify({ app: "muusia-machine", v: 1, prof }, null, 1)], { type: "application/json" });`,
  `  const prof = machines[Math.min(machineIdx, machines.length - 1)];
  const setProf = (fn) => setMachines((ms) => ms.map((m, i) =>
    i === Math.min(machineIdx, ms.length - 1) ? (typeof fn === "function" ? fn(m) : fn) : m));
  /* export-workflow gate: every G-code route goes through these two; an svg-external profile gets the refusal text */
  const gcodeProf = isGcodeWorkflow(prof);
  const toGcodeGated = (ps, c) => (gcodeProf ? toGcode(ps, c, prof) : gcodeRefusal(prof));
  const jigGcodeGated = (positions, pr, w, h, label) => (gcodeProf ? jigGcode(positions, pr, w, h, label) : { text: gcodeRefusal(prof), warnings: ["G-code export is disabled for an External SVG profile"] });
  const setWorkflow = (wf) => setProf((pr) => convertWorkflow(pr, wf));
  const exportMachine = () => {
    const blob = new Blob([writeMachineFile(prof)], { type: "application/json" });`,
  "App.jsx: gate (gcodeProf, toGcodeGated, jigGcodeGated), setWorkflow, exportMachine v2");

app = one(app, `  const importMachine = (text) => {
    try {
      const data = JSON.parse(text);
      const p = data.prof || data;
      /* yhdista oletuksiin ettei puutu kenttia -> vanhat profiilit paivittyvat */
      const merged = { ...DEFAULT_MACHINE, ...p };
      setMachines((ms) => [...ms, merged]);
      setMachineIdx(machines.length);
    } catch (e) { alert("Could not read machine profile: " + e.message); }
  };
  const addMachine = () => {
    setMachines((ms) => [...ms, { ...prof, name: (prof.name || "machine") + " copy" }]);
    setMachineIdx(machines.length);
  };`,
  `  const importMachine = (text) => {
    try {
      const data = JSON.parse(text);
      const r = readMachineFile(data);           /* v1 / bare -> legacy gcode; v2 -> as declared; invalid -> error, list untouched */
      if (r.error) { alert("Could not read machine profile: " + r.error); return; }
      setMachines((ms) => [...ms, { ...r.prof, id: nextId(ms) }]);
      setMachineIdx(machines.length);
    } catch (e) { alert("Could not read machine profile: " + e.message); }
  };
  const addMachine = () => {
    setMachines((ms) => [...ms, { ...prof, id: nextId(ms), name: (prof.name || "machine") + " copy" }]);
    setMachineIdx(machines.length);
  };`,
  "App.jsx: importMachine via readMachineFile, addMachine assigns a new id");

/* 4. ctx.machine */
app = one(app, "machine: { originX: prof.originX || 0, originY: prof.originY || 0, flipY: !!prof.flipY, laserOffX: prof.laserOffX || 0, laserOffY: prof.laserOffY || 0, workW: prof.workW || 0, workH: prof.workH || 0 } }), [megaW, megaH, frameIdx, frameCount, prof]);",
  "machine: machineCtx(prof) }), [megaW, megaH, frameIdx, frameCount, prof]);",
  "App.jsx: ctx.machine via machineCtx");

/* 5. G-code routes */
app = one(app, "      : `; ${note}\\n` + toGcode(t0, sheetCtx, prof);", "      : `; ${note}\\n` + toGcodeGated(t0, sheetCtx);", "App.jsx: megaPreview gated");
app = one(app, "const doExport = () => { setGcode(megaOn ? megaPreview(\"gcode\") : toGcode(exportPS(), ctx, prof)); setExportKind(\"gcode\"); setCopied(false); };",
  "const doExport = () => { setGcode(megaOn ? megaPreview(\"gcode\") : toGcodeGated(exportPS(), ctx)); setExportKind(\"gcode\"); setCopied(false); };", "App.jsx: doExport gated");
app = one(app, "text: kind === \"svg\" ? toSVG(t, sheetCtx) : kind === \"dxf\" ? toDXF(t, sheetCtx) : toGcode(t, sheetCtx, prof)",
  "text: kind === \"svg\" ? toSVG(t, sheetCtx) : kind === \"dxf\" ? toDXF(t, sheetCtx) : toGcodeGated(t, sheetCtx)", "App.jsx: downloadMega gated");
app = one(app, "const text = kind === \"svg\" ? toSVG(ps, ctxF) : kind === \"dxf\" ? toDXF(ps, ctxF) : toGcode(ps, ctxF, prof);",
  "const text = kind === \"svg\" ? toSVG(ps, ctxF) : kind === \"dxf\" ? toDXF(ps, ctxF) : toGcodeGated(ps, ctxF);", "App.jsx: exportAllFrames gated");
app = one(app, "exportText={(kind, ps, ctxE) => kind === \"svg\" ? toSVG(ps, ctxE) : kind === \"dxf\" ? toDXF(ps, ctxE) : toGcode(ps, ctxE, prof)}",
  "exportText={(kind, ps, ctxE) => kind === \"svg\" ? toSVG(ps, ctxE) : kind === \"dxf\" ? toDXF(ps, ctxE) : toGcodeGated(ps, ctxE)} gcodeEnabled={gcodeProf}", "App.jsx: Stack exportText gated + gcodeEnabled prop");
app = all(app, "const g = jigGcode(", "const g = jigGcodeGated(", "App.jsx: jig G-code gated", 4);

/* 6. preview cleared on profile / workflow change; patch format; loadPatch normalisation */
app = one(app, "  const buildPatchJSON = () =>\n    JSON.stringify({ app: \"muusia\", v: 1, name: projName, canvas: { W: canvasW, H: canvasH }, jig: { mode: jigMode, magnets: manualMags }, mega: megaOn ? { C: megaC, R: megaR, seam: megaSeam, mode: megaMode, marks: megaMarks, markPen: megaMarkPen, labels: megaLabels, kind: megaKind, rollW, rollLen, rollStrips, rollSeg } : null, prof, machines, machineIdx, customNodes, root }, null, 1);",
  "  /* a generated file belongs to the profile that made it: switching profile or workflow clears the preview */\n  useEffect(() => { setGcode(null); }, [machineIdx, prof.workflow]);\n  const buildPatchJSON = () =>\n    JSON.stringify({ app: \"muusia\", v: 1, name: projName, canvas: { W: canvasW, H: canvasH }, jig: { mode: jigMode, magnets: manualMags }, mega: megaOn ? { C: megaC, R: megaR, seam: megaSeam, mode: megaMode, marks: megaMarks, markPen: megaMarkPen, labels: megaLabels, kind: megaKind, rollW, rollLen, rollStrips, rollSeg } : null, prof, machines, machineIdx, machineFormat: MACHINE_FILE_VERSION, customNodes, root }, null, 1);",
  "App.jsx: preview clear effect + machineFormat in patches");

app = one(app, `      if (Array.isArray(data.machines) && data.machines.length) {
        setMachines(data.machines.map((m) => ({ ...DEFAULT_MACHINE, ...m })));
        setMachineIdx(Math.min(data.machineIdx || 0, data.machines.length - 1));
      } else if (data.prof) {
        setMachines([{ ...DEFAULT_MACHINE, ...data.prof }]);
        setMachineIdx(0);
      }`,
  `      {
        /* machines (non-empty) wins, else legacy prof, else the current list stays; invalid entries are skipped, never emptying the list */
        const nm = normalizeMachines(data.machines, data.machineIdx, data.machineFormat);
        const unsupported = !nm.machines && nm.errors.some((e) => /Unsupported machine format/.test(e));
        if (nm.machines) { setMachines(nm.machines); setMachineIdx(nm.machineIdx); }
        else if (data.prof && !unsupported) { const r = normalizeMachine(data.prof); if (r.prof) { setMachines(assignIds([r.prof])); setMachineIdx(0); } else nm.errors.push(r.error); }
        if (nm.errors.length && !silent) alert("Machine profiles in this patch were skipped:\\n" + nm.errors.join("\\n"));
      }`,
  "App.jsx: loadPatch machines via normalizeMachines");

/* 7. DRO: no URL for svg-external */
app = one(app, "<DroPanel url={prof.moonrakerUrl} />", "<DroPanel url={gcodeProf ? prof.moonrakerUrl : \"\"} />", "App.jsx: DRO gets no URL on svg-external");

/* 8. MACHINE SETUP: workflow row + svg branch, wrap the G-code fields */
app = one(app, `                {profNum("workW", "Work area W mm")}
                {profNum("workH", "Work area H mm")}
                {profNum("originX", "Origin X mm (canvas on bed)")}`,
  `                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Workflow</div>
                  <select value={gcodeProf ? "gcode" : "svg-external"} onChange={(e) => setWorkflow(e.target.value)}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }}>
                    <option value="gcode">G-code — Muusia generates the machine file</option>
                    <option value="svg-external">External SVG plotter — SVG goes to the plotter's own software</option>
                  </select>
                </div>
                {!gcodeProf && (
                  <>
                    <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.5, margin: "2px 0 8px" }}>{SVG_WORKFLOW_HELP}</div>
                    {[["manufacturer", "Manufacturer"], ["model", "Model"]].map(([k, l]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <div style={{ fontSize: 10, color: T.dim, width: 110 }}>{l}</div>
                        <input type="text" value={prof[k] || ""} placeholder="optional" onChange={(e) => setProf((pr) => ({ ...pr, [k]: e.target.value }))}
                          style={{ flex: 1, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                      </div>
                    ))}
                    {profNum("workW", "Work area W mm")}
                    {profNum("workH", "Work area H mm")}
                    <div style={{ fontSize: 9, color: T.dim, marginBottom: 6 }}>
                      {prof.workW > 0 && prof.workH > 0
                        ? \`Work area \${prof.workW}\\u00D7\${prof.workH} mm \\u2014 canvas \${canvasW}\\u00D7\${canvasH} mm \${canvasW <= prof.workW && canvasH <= prof.workH ? "fits" : "\\u26A0 is larger"} (comparison only; place the paper in your plotter software)\`
                        : "Work area not set \\u2014 enter the verified travel of your plotter (0 = unknown). No default is assumed."}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Source URL</div>
                      <input type="text" value={prof.sourceUrl || ""} placeholder="where these values come from (optional)" onChange={(e) => setProf((pr) => ({ ...pr, sourceUrl: e.target.value }))}
                        style={{ flex: 1, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Verified on</div>
                      <input type="text" value={prof.verifiedOn || ""} placeholder="YYYY-MM-DD (optional)" onChange={(e) => setProf((pr) => ({ ...pr, verifiedOn: e.target.value }))}
                        style={{ flex: 1, background: T.panel2, color: T.text, border: \`1px solid \${T.line}\`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                    </div>
                    <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.5, marginBottom: 4 }}>
                      {prof.sourceUrl ? "Values from the source above." : "Own definition \\u2014 not manufacturer-verified."} Saved in this patch and in exported profiles (file format v{MACHINE_FILE_VERSION}); needs Muusia {MACHINE_MIN_APP} or newer \\u2014 older versions would merge it into G-code defaults. Machine Setup edits live in this session until you save the patch, export the profile or Set default.
                    </div>
                  </>
                )}
                {gcodeProf && (
                  <>
                {profNum("workW", "Work area W mm")}
                {profNum("workH", "Work area H mm")}
                {profNum("originX", "Origin X mm (canvas on bed)")}`,
  "App.jsx: Workflow select + svg-external fields, G-code fields opened");

app = one(app, `                <textarea value={prof.endG} spellCheck={false}
                  onChange={(e) => setProf((pr) => ({ ...pr, endG: e.target.value }))}
                  style={{ width: "100%", height: 40, background: "#12151B", color: "#9FB3D1", border: \`1px solid \${T.line}\`, borderRadius: 4, fontFamily: mono, fontSize: 10, padding: 6, resize: "vertical", lineHeight: 1.5 }} />
              </>
            )}`,
  `                <textarea value={prof.endG} spellCheck={false}
                  onChange={(e) => setProf((pr) => ({ ...pr, endG: e.target.value }))}
                  style={{ width: "100%", height: 40, background: "#12151B", color: "#9FB3D1", border: \`1px solid \${T.line}\`, borderRadius: 4, fontFamily: mono, fontSize: 10, padding: 6, resize: "vertical", lineHeight: 1.5 }} />
                  </>
                )}
              </>
            )}`,
  "App.jsx: G-code fields closed after END G-CODE");

app = one(app, `            {mchOpen && (
              <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 6px" }}>
              <input type="checkbox" checked={prof.rotOn}`,
  `            {mchOpen && gcodeProf && (
              <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 6px" }}>
              <input type="checkbox" checked={prof.rotOn}`,
  "App.jsx: rotation / dip / maintenance only for G-code profiles");

/* 9. buttons */
app = one(app, `            <button onClick={doExport} disabled={!primaryPS.paths.length}
              style={{
                width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 5, border: "none",
                background: primaryPS.paths.length ? T.accent : T.line, color: primaryPS.paths.length ? "#0D1117" : T.dim,
                fontFamily: disp, fontWeight: 700, fontSize: 12, cursor: primaryPS.paths.length ? "pointer" : "default", letterSpacing: "0.03em",
              }}>
              GENERATE G-CODE (selected node)
            </button>`,
  `            <button onClick={doExport} disabled={!primaryPS.paths.length || !gcodeProf}
              title={gcodeProf ? "" : "This machine profile uses the External SVG workflow \\u2014 export SVG and open it in your plotter software"}
              style={{
                width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 5, border: "none",
                background: primaryPS.paths.length && gcodeProf ? T.accent : T.line, color: primaryPS.paths.length && gcodeProf ? "#0D1117" : T.dim,
                fontFamily: disp, fontWeight: 700, fontSize: 12, cursor: primaryPS.paths.length && gcodeProf ? "pointer" : "default", letterSpacing: "0.03em",
              }}>
              {gcodeProf ? "GENERATE G-CODE (selected node)" : "G-CODE OFF \\u2014 External SVG profile: export SVG below"}
            </button>`,
  "App.jsx: G-code button disabled with a reason");
app = one(app, `                <button onClick={() => exportAllFrames("gcode")} disabled={!primaryPS.paths.length}`,
  `                <button onClick={() => exportAllFrames("gcode")} disabled={!primaryPS.paths.length || !gcodeProf} title={gcodeProf ? "" : "External SVG profile \\u2014 use SVG"}`,
  "App.jsx: animation G-code button gated");
app = one(app, `                <button onClick={downloadJig}
                  style={{ background: T.panel2, border: \`1px solid \${T.line}\`, color: T.text, borderRadius: 4, fontSize: 10, padding: "5px 10px", cursor: "pointer", fontFamily: mono }}>`,
  `                <button onClick={downloadJig} disabled={!gcodeProf} title={gcodeProf ? "" : "Laser jig G-code needs a G-code profile"}
                  style={{ background: T.panel2, border: \`1px solid \${T.line}\`, color: gcodeProf ? T.text : T.dim, borderRadius: 4, fontSize: 10, padding: "5px 10px", cursor: gcodeProf ? "pointer" : "default", fontFamily: mono }}>`,
  "App.jsx: jig button gated");

/* ---------- stack-view.jsx ---------- */
stack = one(stack, "export default function StackView({ PENS, T, mono, disp, W, H, frameCount, primaryPS, evalFrame, exportText, buildZip, projName, fontStrokes, sheetsCount, onClose }) {",
  "export default function StackView({ PENS, T, mono, disp, W, H, frameCount, primaryPS, evalFrame, exportText, buildZip, projName, fontStrokes, sheetsCount, onClose, gcodeEnabled = true }) {",
  "stack-view.jsx: gcodeEnabled prop (default true)");
stack = one(stack, `            {["svg", "dxf", "gcode"].map((k) => (`, `            {(gcodeEnabled ? ["svg", "dxf", "gcode"] : ["svg", "dxf"]).map((k) => (`, "stack-view.jsx: G-code zip button hidden for svg-external");

if (miss > 0) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_APP, app); writeFileSync(F_STACK, stack);
console.log("DONE  " + ok + " edits applied: " + F_APP + ", " + F_STACK);
