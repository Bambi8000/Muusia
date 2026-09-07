import { useEffect, useMemo, useRef, useState } from "react";
import CanvasView from "./canvas-view.jsx";
import { emitGcode } from "./emitter.js";
import Outline from "./outline.jsx";
import { parseGcode } from "./parser.js";
import TextView from "./text-view.jsx";
import { addStroke, auditDocument, copyStrokes, deletePoint, deleteSelection, finalizeForSave, insertMidpoint, insertPoint, joinAdjacentStrokes, movePoint, optimizeRoute, pasteAfterSelection, reverseStrokes, rotateStrokes, scaleStrokes, splitStroke, translateStrokes } from "./model.js";
import EventsPalette from "./events-palette.jsx";
import { applyContinuousFeed, insertEvent, removeContinuousFeed } from "./events.js";
import ProfileManager from "./profile-manager.jsx";
import { loadProfiles, profileForDocument, saveProfiles } from "./profile.js";
import PlaybackPanel from "./playback-panel.jsx";
import { buildTimeline, sampleTimeline } from "./sim.js";

const EMPTY = `; LATU\n; Open a Muusia .gcode file to inspect its toolpath.\n`;

function rememberedProfileId(fallback) {
  try { return localStorage.getItem("latu-active-machine") || fallback; }
  catch { return fallback; }
}

function formatLength(mm) {
  return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${mm.toFixed(1)} mm`;
}

export default function App() {
  const [profiles, setProfiles] = useState(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState(() => rememberedProfileId(profiles[0].id));
  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) || profiles[0], [profiles, activeProfileId]);
  const [source, setSource] = useState(EMPTY);
  const sourceRef = useRef(EMPTY);
  sourceRef.current = source;
  const [name, setName] = useState("untitled.gcode");
  const [doc, setDoc] = useState(() => parseGcode(EMPTY, activeProfile));
  const [hoveredLine, setHoveredLine] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [showTravels, setShowTravels] = useState(true);
  const [yUp, setYUp] = useState(false);
  const [paneMode, setPaneMode] = useState("split");
  const [split, setSplit] = useState(56);
  const [dirty, setDirty] = useState(false);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState([]);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [message, setMessage] = useState("");
  const [move, setMove] = useState({ x: 0, y: 0 });
  const [scaleOpen, setScaleOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);
  const [autoFollow, setAutoFollow] = useState(true);
  const [penMode, setPenMode] = useState(false);
  const [boxMode, setBoxMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [scaleOptions, setScaleOptions] = useState({ mode: "factor", sx: 1, sy: 1, uniform: true, angle: 0, width: 297, height: 420, margin: 0, preserveAspect: true, anchor: "center", customX: 0, customY: 0 });
  const inputRef = useRef(null);
  const fileHandleRef = useRef(null);
  const parseTimer = useRef(null);
  const dividerDrag = useRef(false);
  const historyRef = useRef({ past: [], future: [] });
  const clipboardRef = useRef("");
  const loadTextRef = useRef(null);
  const playbackTimeRef = useRef(0);

  useEffect(() => () => clearTimeout(parseTimer.current), []);
  useEffect(() => { saveProfiles(profiles); }, [profiles]);
  useEffect(() => { try { localStorage.setItem("latu-active-machine", activeProfile.id); } catch { /* Profile remains active for this session. */ } setDoc(parseGcode(sourceRef.current, activeProfile)); }, [activeProfile]);
  const parseText = (text, markDirty = true) => {
    if (markDirty && text !== source) {
      historyRef.current.past.push(source); historyRef.current.future = [];
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    }
    setSource(text);
    if (markDirty) setDirty(true);
    clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => setDoc(parseGcode(text, activeProfile)), 260);
  };
  const loadText = (text, filename, handle = null) => {
    clearTimeout(parseTimer.current);
    const matchingProfile = profileForDocument(profiles, text, activeProfile.id);
    setActiveProfileId(matchingProfile.id);
    setSource(text); setDoc(parseGcode(text, matchingProfile)); setName(filename || "untitled.gcode");
    setDirty(false); setSelectedLine(null); setHoveredLine(null); fileHandleRef.current = handle;
    setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoint(null); historyRef.current = { past: [], future: [] };
  };
  loadTextRef.current = loadText;
  const applySource = (next, label = "Edit", preserveSelection = true) => {
    if (next === source) return;
    historyRef.current.past.push(source); historyRef.current.future = [];
    if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    const parsed = parseGcode(next, activeProfile);
    setSource(next); setDoc(parsed); setDirty(true); setMessage(label);
    if (!preserveSelection) { setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoint(null); setSelectedLine(null); }
  };
  const undo = () => {
    const previous = historyRef.current.past.pop(); if (previous == null) return;
    historyRef.current.future.push(source); setSource(previous); setDoc(parseGcode(previous, activeProfile)); setDirty(true); setMessage("Undo");
  };
  const redo = () => {
    const next = historyRef.current.future.pop(); if (next == null) return;
    historyRef.current.past.push(source); setSource(next); setDoc(parseGcode(next, activeProfile)); setDirty(true); setMessage("Redo");
  };
  const selectLine = (line, options = {}) => {
    setSelectedLine(line);
    if (line == null) { if (!options.additive) { setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoint(null); } return; }
    const stroke = options.point ? doc.strokes[options.point.strokeId] : doc.strokes.find((item) => line >= item.lineStart && line <= item.lineEnd);
    const event = doc.events.find((item) => line >= item.lineStart && line <= item.lineEnd);
    if (stroke) { setSelectedStrokeIds((ids) => options.additive ? (ids.includes(stroke.id) ? ids.filter((id) => id !== stroke.id) : [...ids, stroke.id]) : [stroke.id]); setSelectedPoint(options.point || null); }
    else if (!options.additive) setSelectedStrokeIds([]);
    if (event) setSelectedEventIds((ids) => options.additive ? (ids.includes(event.id) ? ids.filter((id) => id !== event.id) : [...ids, event.id]) : [event.id]);
    else if (!options.additive) setSelectedEventIds([]);
  };
  const loadFile = async (file, handle = null) => loadText(await file.text(), file.name, handle);

  const openFile = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({ types: [{ description: "G-code", accept: { "text/plain": [".gcode", ".gc", ".nc"] } }] });
        await loadFile(await handle.getFile(), handle);
        return;
      } catch (error) { if (error.name === "AbortError") return; }
    }
    inputRef.current.click();
  };
  const download = (text, filename) => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/x-gcode" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const save = async (saveAs = false) => {
    const currentDoc = doc.source === source ? doc : parseGcode(source, activeProfile);
    const text = dirty ? finalizeForSave(currentDoc, activeProfile.name) : emitGcode(currentDoc);
    let handle = saveAs ? null : fileHandleRef.current;
    if (window.showSaveFilePicker && !handle) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "G-code", accept: { "text/plain": [".gcode"] } }] });
      } catch (error) { if (error.name === "AbortError") return; }
    }
    if (handle) {
      const writable = await handle.createWritable(); await writable.write(text); await writable.close();
      fileHandleRef.current = handle; setName(handle.name || name);
    } else download(text, name);
    if (text !== source) { setSource(text); setDoc(parseGcode(text, activeProfile)); }
    setDirty(false);
  };
  const stats = useMemo(() => [
    `${doc.strokes.length} strokes`, `${doc.strokes.reduce((sum, stroke) => sum + stroke.pts.length, 0)} points`,
    `${formatLength(doc.stats.drawLength)} draw`, `${formatLength(doc.stats.travelLength)} travel`, `${doc.stats.totalMinutes.toFixed(1)} min`,
  ], [doc]);
  const timeline = useMemo(() => buildTimeline(doc, activeProfile), [doc, activeProfile]);
  const playbackSample = useMemo(() => sampleTimeline(timeline, playbackTime), [timeline, playbackTime]);
  const seekPlayback = (value) => {
    const next = Math.max(0, Math.min(Number(value) || 0, timeline.total));
    playbackTimeRef.current = next; setPlaybackTime(next);
  };
  const changePlaying = (next) => {
    if (next && playbackTimeRef.current >= timeline.total) seekPlayback(0);
    setPlaying(next && timeline.total > 0);
  };
  const changeMode = (mode) => setPaneMode((current) => current === mode ? "split" : mode);
  const selectedOrAll = selectedStrokeIds.length ? selectedStrokeIds : doc.strokes.map((stroke) => stroke.id);
  const runDelete = () => applySource(selectedPoint ? deletePoint(doc, selectedPoint.strokeId, selectedPoint.pointIndex) : deleteSelection(doc, selectedStrokeIds, selectedEventIds), selectedPoint ? "Deleted point" : "Deleted selection", false);
  const runCopy = async () => {
    const fragment = copyStrokes(doc, selectedStrokeIds); if (!fragment) return;
    clipboardRef.current = fragment; setMessage(`Copied ${selectedStrokeIds.length} stroke${selectedStrokeIds.length === 1 ? "" : "s"}`);
    try { await navigator.clipboard.writeText(fragment); } catch { /* Internal clipboard remains available. */ }
  };
  const runPaste = async () => {
    let fragment = clipboardRef.current;
    if (!fragment) try { fragment = await navigator.clipboard.readText(); } catch { /* Use internal clipboard only. */ }
    applySource(pasteAfterSelection(doc, fragment, selectedStrokeIds), "Pasted strokes", false);
  };
  const runMove = (dx = Number(move.x), dy = Number(move.y)) => {
    if (!selectedStrokeIds.length || (!dx && !dy)) return;
    applySource(selectedPoint ? movePoint(doc, selectedPoint.strokeId, selectedPoint.pointIndex, dx, dy) : translateStrokes(doc, selectedStrokeIds, dx, dy), `Moved ${selectedPoint ? "point" : "selection"} ${dx}, ${dy} mm`); setMove({ x: 0, y: 0 });
  };
  const runJoin = () => { const result = joinAdjacentStrokes(doc, selectedStrokeIds); if (result.error) setMessage(result.error); else applySource(result.source, "Joined strokes", false); };
  const runOptimize = () => { const result = optimizeRoute(doc, selectedOrAll); if (result.error) setMessage(result.error); else applySource(result.source, "Optimized route", false); };
  const runScale = () => {
    if (scaleOptions.mode === "rotate") applySource(rotateStrokes(doc, selectedOrAll, scaleOptions.angle, scaleOptions.anchor === "custom" ? [Number(scaleOptions.customX), Number(scaleOptions.customY)] : null), `Rotated ${scaleOptions.angle}°`, false);
    else { const result = scaleStrokes(doc, selectedOrAll, scaleOptions); applySource(result.source, `Scaled ${selectedStrokeIds.length ? "selection" : "document"}${result.collapsed ? `; removed ${result.collapsed} collapsed points` : ""}`, false); }
    setScaleOpen(false);
  };
  const fitWorkArea = () => {
    const result = scaleStrokes(doc, doc.strokes.map((stroke) => stroke.id), { mode: "fit", width: activeProfile.workW, height: activeProfile.workH, margin: 5, preserveAspect: true, anchor: "origin" });
    applySource(result.source, `Fit to ${activeProfile.workW} × ${activeProfile.workH} mm work area`, false);
  };
  const runInsertEvent = (options) => { applySource(insertEvent(doc, activeProfile, { ...options, lineIndex: selectedLine }), `Inserted ${options.kind}`, false); setEventsOpen(false); };
  const runContinuous = (rate) => { applySource(applyContinuousFeed(doc, selectedStrokeIds, Number(rate)), `Continuous feed ${rate} µl/mm`); setEventsOpen(false); };
  const runRemoveContinuous = () => { applySource(removeContinuousFeed(doc, selectedStrokeIds), "Removed continuous feed"); setEventsOpen(false); };
  const chooseProfile = (id) => { setActiveProfileId(id); setDirty(true); setMessage("Machine profile changed"); };
  const updateProfiles = (next) => {
    setProfiles(next);
    if (!next.some((profile) => profile.id === activeProfileId)) chooseProfile(next[0].id);
  };
  const safety = useMemo(() => auditDocument(doc), [doc]);
  const visualLocked = doc.warnings.unsafeModal || playbackOpen;
  const commitDraft = () => {
    if (draftPoints.length < 2) { setDraftPoints([]); setPenMode(false); return; }
    const sectionId = selectedStrokeIds.length ? doc.strokes[selectedStrokeIds[0]]?.sectionId : doc.sections[0]?.id;
    applySource(addStroke(doc, draftPoints, sectionId), "Added stroke", false); setDraftPoints([]); setPenMode(false);
  };

  useEffect(() => {
    let inbox;
    try { inbox = localStorage.getItem("latu-inbox"); } catch { return; }
    if (!inbox) return;
    try {
      const parsed = JSON.parse(inbox);
      loadTextRef.current(typeof parsed === "string" ? parsed : parsed.gcode || parsed.source || "", parsed.name || "muusia-inbox.gcode");
    } catch { loadTextRef.current(inbox, "muusia-inbox.gcode"); }
    try { localStorage.removeItem("latu-inbox"); } catch { /* The imported copy is still usable. */ }
    setMessage("Opened from Muusia inbox");
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.target.closest?.(".cm-editor, input, textarea, select, [contenteditable=true]")) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (command && event.key.toLowerCase() === "a") { event.preventDefault(); setSelectedStrokeIds(doc.strokes.map((stroke) => stroke.id)); setSelectedEventIds([]); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); runDelete(); }
      else if (event.key === "Escape") { setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoint(null); setSelectedLine(null); setDraftPoints([]); setPenMode(false); }
      else if (event.key === "Enter" && penMode) { event.preventDefault(); commitDraft(); }
      else if (selectedStrokeIds.length && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); const step = event.shiftKey ? 1 : .1;
        runMove(event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0);
      }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    playbackTimeRef.current = 0; setPlaybackTime(0); setPlaying(false);
  }, [doc, activeProfile]);

  useEffect(() => {
    if (!playing || !timeline.total) return undefined;
    let frame; let previous = performance.now();
    const tick = (now) => {
      const next = Math.min(timeline.total, playbackTimeRef.current + (now - previous) / 1000 * playbackSpeed);
      previous = now; playbackTimeRef.current = next; setPlaybackTime(next);
      if (next < timeline.total) frame = requestAnimationFrame(tick); else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, playbackSpeed, timeline.total]);

  return <div className={`app${playbackOpen ? " playback-shown" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) loadFile(file); }}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">L</span><div><strong>LATU</strong><small>G-code reader</small></div></div>
      <div className="toolbar">
        <button className="primary" onClick={openFile}>Open</button>
        <button onClick={() => save(false)}>Save</button>
        <button onClick={() => save(true)}>Save as</button>
        <select className="profile-select" aria-label="Machine profile" value={activeProfile.id} onChange={(event) => chooseProfile(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
        <button onClick={() => setProfilesOpen(true)}>Profiles</button>
        <span className="separator" />
        <button onClick={undo} disabled={!historyRef.current.past.length}>Undo</button>
        <button onClick={redo} disabled={!historyRef.current.future.length}>Redo</button>
        <span className="separator" />
        <button onClick={runDelete} disabled={visualLocked || !selectedStrokeIds.length && !selectedEventIds.length}>Delete</button>
        <button onClick={runCopy} disabled={!selectedStrokeIds.length}>Copy</button>
        <button onClick={runPaste} disabled={visualLocked}>Paste</button>
        <button onClick={() => selectedStrokeIds.length && applySource(reverseStrokes(doc, selectedStrokeIds), "Reversed strokes") } disabled={visualLocked || !selectedStrokeIds.length}>Reverse</button>
        <button onClick={() => selectedStrokeIds.length === 1 && applySource(insertMidpoint(doc, selectedStrokeIds[0], selectedLine), "Inserted midpoint") } disabled={visualLocked || selectedStrokeIds.length !== 1}>+ Point</button>
        <button onClick={() => selectedStrokeIds.length === 1 && applySource(splitStroke(doc, selectedStrokeIds[0], selectedLine), "Split stroke", false)} disabled={visualLocked || selectedStrokeIds.length !== 1}>Split</button>
        <button onClick={runJoin} disabled={visualLocked || selectedStrokeIds.length !== 2}>Join</button>
        <button onClick={runOptimize} disabled={visualLocked || doc.strokes.length < 2}>Optimize</button>
        <button className={boxMode ? "on" : ""} onClick={() => { setBoxMode((value) => !value); setPenMode(false); setDraftPoints([]); }} disabled={visualLocked}>Box select</button>
        <button className={penMode ? "on" : ""} onClick={() => { setPenMode((value) => !value); setBoxMode(false); setDraftPoints([]); }} disabled={visualLocked}>Pen tool</button>
        <button onClick={() => setEventsOpen(true)} disabled={visualLocked}>＋ Event</button>
        <button onClick={() => setScaleOpen(true)} disabled={visualLocked || !doc.strokes.length}>Scale / Fit</button>
        <button onClick={fitWorkArea} disabled={visualLocked || !doc.strokes.length}>Fit work area</button>
        <span className="move-fields"><input aria-label="Move X" title="ΔX mm" type="number" step="0.1" value={move.x} onChange={(event) => setMove((value) => ({ ...value, x: event.target.value }))} /><input aria-label="Move Y" title="ΔY mm" type="number" step="0.1" value={move.y} onChange={(event) => setMove((value) => ({ ...value, y: event.target.value }))} /><button onClick={() => runMove()} disabled={visualLocked || !selectedStrokeIds.length}>Move</button></span>
        <span className="separator" />
        <button className={showTravels ? "on" : ""} onClick={() => setShowTravels((value) => !value)}>Travels</button>
        <button className={yUp ? "on" : ""} onClick={() => setYUp((value) => !value)}>Y axis ↑</button>
        <span className="separator" />
        <button className={paneMode === "canvas" ? "on" : ""} onClick={() => changeMode("canvas")}>Canvas</button>
        <button className={paneMode === "text" ? "on" : ""} onClick={() => changeMode("text")}>Text</button>
        <button className={playbackOpen ? "on" : ""} onClick={() => { const next = !playbackOpen; setPlaybackOpen(next); setPlaying(false); setBoxMode(false); setPenMode(false); }}>Playback</button>
      </div>
      <div className="file-meta"><strong>{dirty ? "● " : ""}{name}</strong><small>{doc.meta.machineName || "Generic G-code"}</small></div>
      <input ref={inputRef} type="file" accept=".gcode,.gc,.nc,text/plain" hidden onChange={(event) => event.target.files[0] && loadFile(event.target.files[0])} />
    </header>
    <main className={`workspace mode-${paneMode}`} onPointerMove={(event) => {
      if (!dividerDrag.current) return;
      const rect = event.currentTarget.getBoundingClientRect(); setSplit(Math.max(25, Math.min(75, ((event.clientX - rect.left) / rect.width) * 100)));
    }} onPointerUp={() => { dividerDrag.current = false; }}>
      {paneMode !== "text" && <Outline doc={doc} selectedLine={selectedLine} selectedStrokeIds={selectedStrokeIds} onSelectLine={selectLine} onReorder={(next) => applySource(next, "Reordered strokes", false)} />}
      {paneMode !== "text" && <section className="canvas-pane" style={paneMode === "split" ? { width: `calc(${split}% - 96px)` } : undefined}>
        <CanvasView doc={doc} showTravels={showTravels} yUp={yUp} hoveredLine={hoveredLine} selectedLine={selectedLine} selectedStrokeIds={selectedStrokeIds} selectedPoint={selectedPoint} boxSelecting={boxMode} drawing={penMode} draftPoints={draftPoints} playback={playbackOpen ? { active: true, time: playbackTime, timeline, sample: playbackSample } : null} onAddPoint={(point) => setDraftPoints((points) => [...points, point])} onInsertPoint={(strokeId, line, point) => !visualLocked && applySource(insertPoint(doc, strokeId, line, point), "Inserted point")} onHoverLine={setHoveredLine} onSelectLine={selectLine} onSelectStrokes={(ids, additive) => { setSelectedPoint(null); setSelectedStrokeIds((current) => additive ? [...new Set([...current, ...ids])] : ids); }} onTranslate={(dx, dy) => !visualLocked && runMove(dx, dy)} onMovePoint={(dx, dy) => !visualLocked && runMove(dx, dy)} onCursor={setCursor} />
        {boxMode && <div className="canvas-hint">Drag a box around strokes · Shift adds</div>}
        {penMode && <div className="canvas-hint">Click points · Enter to finish · Esc to cancel <strong>{draftPoints.length} pts</strong></div>}
        {!!safety.length && <div className="safety-panel">{safety.map((warning) => <div key={warning.kind}>⚠ {warning.message}</div>)}</div>}
      </section>}
      {paneMode === "split" && <div className="divider" onPointerDown={(event) => { dividerDrag.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} />}
      {paneMode !== "canvas" && <section className="text-pane">
        <TextView value={source} parsed={doc} hoveredLine={hoveredLine} selectedLine={selectedLine} playbackLine={playbackOpen ? playbackSample.lineIndex : null} autoFollow={playbackOpen && autoFollow} onHoverLine={setHoveredLine} onSelectLine={selectLine} onChange={parseText} />
      </section>}
    </main>
    {playbackOpen && <PlaybackPanel timeline={timeline} time={playbackTime} playing={playing} speed={playbackSpeed} autoFollow={autoFollow} onTime={seekPlayback} onPlaying={changePlaying} onSpeed={setPlaybackSpeed} onAutoFollow={setAutoFollow} onClose={() => { setPlaybackOpen(false); setPlaying(false); }} onChapter={(chapter) => { seekPlayback(chapter.time); setSelectedLine(chapter.lineIndex); }} />}
    <footer className="statusbar">
      <span>{stats.join(" · ")}</span>
      <span>{safety.length ? `⚠ ${safety.length} safety warning${safety.length === 1 ? "" : "s"}` : "Dialect OK"}</span>
      <span>{message || (selectedPoint ? `Point ${selectedPoint.pointIndex + 1} selected` : selectedStrokeIds.length ? `${selectedStrokeIds.length} stroke${selectedStrokeIds.length === 1 ? "" : "s"} selected` : selectedLine == null ? "No selection" : `Line ${selectedLine + 1}`)} · {cursor ? `X ${cursor[0].toFixed(2)}  Y ${cursor[1].toFixed(2)} mm` : "—"}</span>
    </footer>
    {scaleOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setScaleOpen(false)}><div className="dialog">
      <h2>Scale / Fit</h2><p>{selectedStrokeIds.length ? `${selectedStrokeIds.length} selected strokes` : "Whole drawing"}</p>
      <div className="segmented"><button className={scaleOptions.mode === "factor" ? "on" : ""} onClick={() => setScaleOptions((value) => ({ ...value, mode: "factor" }))}>Scale factor</button><button className={scaleOptions.mode === "fit" ? "on" : ""} onClick={() => setScaleOptions((value) => ({ ...value, mode: "fit" }))}>Fit to size</button><button className={scaleOptions.mode === "rotate" ? "on" : ""} onClick={() => setScaleOptions((value) => ({ ...value, mode: "rotate" }))}>Rotate</button></div>
      {scaleOptions.mode === "factor" ? <><div className="field-row"><label>X factor<input type="number" step="0.01" value={scaleOptions.sx} onChange={(event) => setScaleOptions((value) => ({ ...value, sx: event.target.value, sy: value.uniform ? event.target.value : value.sy }))} /></label><label>Y factor<input type="number" step="0.01" value={scaleOptions.sy} disabled={scaleOptions.uniform} onChange={(event) => setScaleOptions((value) => ({ ...value, sy: event.target.value }))} /></label></div><label className="check"><input type="checkbox" checked={scaleOptions.uniform} onChange={(event) => setScaleOptions((value) => ({ ...value, uniform: event.target.checked, sy: event.target.checked ? value.sx : value.sy }))} /> Uniform scale</label>{!scaleOptions.uniform && Number(scaleOptions.sx) !== Number(scaleOptions.sy) && <div className="notice">Non-uniform scaling distorts the aspect ratio.</div>}</>
        : scaleOptions.mode === "fit" ? <><div className="presets"><button onClick={() => setScaleOptions((value) => ({ ...value, width: 148, height: 210 }))}>A5</button><button onClick={() => setScaleOptions((value) => ({ ...value, width: 210, height: 297 }))}>A4</button><button onClick={() => setScaleOptions((value) => ({ ...value, width: 297, height: 420 }))}>A3</button><button onClick={() => setScaleOptions((value) => ({ ...value, width: 420, height: 594 }))}>A2</button></div><div className="field-row"><label>Width mm<input type="number" value={scaleOptions.width} onChange={(event) => setScaleOptions((value) => ({ ...value, width: event.target.value }))} /></label><label>Height mm<input type="number" value={scaleOptions.height} onChange={(event) => setScaleOptions((value) => ({ ...value, height: event.target.value }))} /></label><label>Margin<input type="number" value={scaleOptions.margin} onChange={(event) => setScaleOptions((value) => ({ ...value, margin: event.target.value }))} /></label></div><label className="check"><input type="checkbox" checked={scaleOptions.preserveAspect} onChange={(event) => setScaleOptions((value) => ({ ...value, preserveAspect: event.target.checked }))} /> Preserve aspect ratio</label></>
          : <div className="field-row"><label>Angle °<input type="number" step="1" value={scaleOptions.angle} onChange={(event) => setScaleOptions((value) => ({ ...value, angle: event.target.value }))} /></label></div>}
      <label>Anchor<select value={scaleOptions.anchor} onChange={(event) => setScaleOptions((value) => ({ ...value, anchor: event.target.value }))}><option value="center">Drawing center</option><option value="origin">Drawing origin</option><option value="custom">Custom point</option></select></label>
      {scaleOptions.anchor === "custom" && <div className="field-row custom-anchor"><label>Anchor X<input type="number" value={scaleOptions.customX} onChange={(event) => setScaleOptions((value) => ({ ...value, customX: event.target.value }))} /></label><label>Anchor Y<input type="number" value={scaleOptions.customY} onChange={(event) => setScaleOptions((value) => ({ ...value, customY: event.target.value }))} /></label></div>}
      <div className="dialog-actions"><button onClick={() => setScaleOpen(false)}>Cancel</button><button className="primary" onClick={runScale}>Apply</button></div>
    </div></div>}
    {eventsOpen && <EventsPalette profile={activeProfile} selectedCount={selectedStrokeIds.length} onClose={() => setEventsOpen(false)} onInsert={runInsertEvent} onContinuous={runContinuous} onRemoveContinuous={runRemoveContinuous} />}
    {profilesOpen && <ProfileManager profiles={profiles} activeId={activeProfile.id} onChange={updateProfiles} onActivate={(id) => { chooseProfile(id); setProfilesOpen(false); }} onClose={() => setProfilesOpen(false)} onExport={(single) => download(JSON.stringify(single ? { app: "latu-machine", v: 1, prof: single } : { app: "latu-machines", v: 1, machines: profiles }, null, 2), single ? `${single.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json` : "latu-machines.json")} />}
  </div>;
}
