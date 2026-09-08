import { useEffect, useMemo, useRef, useState } from "react";
import CanvasView from "./canvas-view.jsx";
import { emitGcode } from "./emitter.js";
import Outline from "./outline.jsx";
import { parseGcode } from "./parser.js";
import TextView from "./text-view.jsx";
import { addStroke, auditDocument, combineGcodeSources, copyStrokes, deletePoint, deleteSelection, finalizeForSave, insertMidpoint, insertPoint, joinAdjacentStrokes, movePoints, moveStrokesToSection, optimizeRoute, pasteAfterSelection, resizeCanvas, reverseStrokes, rotateStrokes, scaleStrokes, splitStroke, translateStrokes, updatePenColor } from "./model.js";
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

function rememberedPenWidths() {
  try { return JSON.parse(localStorage.getItem("latu-pen-widths") || "{}"); }
  catch { return {}; }
}

function rememberedPaperColor() {
  try { return localStorage.getItem("latu-paper-color") || "#f5f1e8"; }
  catch { return "#f5f1e8"; }
}

const COLOR_PALETTE = ["#111111", "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#92400e", "#6b7280"];

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
  const [yUp, setYUp] = useState(true);
  const [paneMode, setPaneMode] = useState("split");
  const [split, setSplit] = useState(56);
  const [dirty, setDirty] = useState(false);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState([]);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [message, setMessage] = useState("");
  const [move, setMove] = useState({ x: 0, y: 0 });
  const [scaleOpen, setScaleOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);
  const [penWidths, setPenWidths] = useState(rememberedPenWidths);
  const [paperColor, setPaperColor] = useState(rememberedPaperColor);
  const [autoFollow, setAutoFollow] = useState(true);
  const [penMode, setPenMode] = useState(false);
  const [boxMode, setBoxMode] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [canvasOptions, setCanvasOptions] = useState({ width: 297, height: 420, originX: 0, originY: 0, scaleArtwork: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState({ query: "", replacement: "", caseSensitive: false });
  const [searchCommand, setSearchCommand] = useState(null);
  const [viewResetKey, setViewResetKey] = useState(0);
  const [draftPoints, setDraftPoints] = useState([]);
  const [scaleOptions, setScaleOptions] = useState({ mode: "factor", sx: 1, sy: 1, uniform: true, angle: 0, width: 297, height: 420, margin: 0, preserveAspect: true, anchor: "center", customX: 0, customY: 0 });
  const inputRef = useRef(null);
  const combineInputRef = useRef(null);
  const fileHandleRef = useRef(null);
  const parseTimer = useRef(null);
  const dividerDrag = useRef(false);
  const historyRef = useRef({ past: [], future: [] });
  const clipboardRef = useRef("");
  const loadTextRef = useRef(null);
  const playbackTimeRef = useRef(0);

  useEffect(() => () => clearTimeout(parseTimer.current), []);
  useEffect(() => { saveProfiles(profiles); }, [profiles]);
  useEffect(() => { try { localStorage.setItem("latu-pen-widths", JSON.stringify(penWidths)); } catch { /* Widths remain active for this session. */ } }, [penWidths]);
  useEffect(() => { try { localStorage.setItem("latu-paper-color", paperColor); } catch { /* Color remains active for this session. */ } }, [paperColor]);
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
    setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoints([]); setViewResetKey((value) => value + 1); historyRef.current = { past: [], future: [] };
  };
  loadTextRef.current = loadText;
  const applySource = (next, label = "Edit", preserveSelection = true) => {
    if (next === source) return;
    historyRef.current.past.push(source); historyRef.current.future = [];
    if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    const parsed = parseGcode(next, activeProfile);
    setSource(next); setDoc(parsed); setDirty(true); setMessage(label);
    if (!preserveSelection) { setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoints([]); setSelectedLine(null); }
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
    if (line == null) { if (!options.additive) { setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoints([]); } return; }
    const stroke = options.point ? doc.strokes[options.point.strokeId] : doc.strokes.find((item) => line >= item.lineStart && line <= item.lineEnd);
    const event = doc.events.find((item) => line >= item.lineStart && line <= item.lineEnd);
    if (stroke && options.point) {
      setSelectedPoints((points) => {
        const exists = points.some((point) => point.strokeId === options.point.strokeId && point.pointIndex === options.point.pointIndex);
        const next = options.additive ? (exists ? points.filter((point) => point.strokeId !== options.point.strokeId || point.pointIndex !== options.point.pointIndex) : [...points, options.point]) : [options.point];
        setSelectedStrokeIds([...new Set(next.map((point) => point.strokeId))]);
        return next;
      });
    } else if (stroke) { setSelectedStrokeIds((ids) => options.additive ? (ids.includes(stroke.id) ? ids.filter((id) => id !== stroke.id) : [...ids, stroke.id]) : [stroke.id]); setSelectedPoints([]); }
    else if (!options.additive) setSelectedStrokeIds([]);
    if (event) setSelectedEventIds((ids) => options.additive ? (ids.includes(event.id) ? ids.filter((id) => id !== event.id) : [...ids, event.id]) : [event.id]);
    else if (!options.additive) setSelectedEventIds([]);
  };
  const loadFile = async (file, handle = null) => loadText(await file.text(), file.name, handle);

  const combineFiles = async (files) => {
    const items = await Promise.all([...files].map(async (file) => ({ name: file.name, source: await file.text() })));
    if (!items.length) return;
    const result = combineGcodeSources(doc, items, activeProfile, name);
    applySource(result.source, `Combined ${items.length} file${items.length === 1 ? "" : "s"} · ${result.importedStrokes} strokes`, false);
    if (doc.strokes.length === 0 && items[0]?.name) setName(items.length === 1 ? items[0].name : "combined.gcode");
    else if (items.length) setName("combined.gcode");
    setViewResetKey((value) => value + 1);
  };

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
  const openCombine = async () => {
    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({ multiple: true, types: [{ description: "G-code", accept: { "text/plain": [".gcode", ".gc", ".nc"] } }] });
        const files = await Promise.all(handles.map((handle) => handle.getFile()));
        await combineFiles(files);
        return;
      } catch (error) { if (error.name === "AbortError") return; }
    }
    combineInputRef.current.click();
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
  const runDelete = () => {
    if (selectedPoints.length > 1) { setMessage("Select one point at a time to delete it"); return; }
    const point = selectedPoints[0];
    applySource(point ? deletePoint(doc, point.strokeId, point.pointIndex) : deleteSelection(doc, selectedStrokeIds, selectedEventIds), point ? "Deleted point" : "Deleted selection", false);
  };
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
    applySource(selectedPoints.length ? movePoints(doc, selectedPoints, dx, dy) : translateStrokes(doc, selectedStrokeIds, dx, dy), `Moved ${selectedPoints.length ? `${selectedPoints.length} point${selectedPoints.length === 1 ? "" : "s"}` : "selection"} ${dx}, ${dy} mm`); setMove({ x: 0, y: 0 });
  };
  const runJoin = () => { const result = joinAdjacentStrokes(doc, selectedStrokeIds, Infinity, selectedPoints); if (result.error) setMessage(result.error); else applySource(result.source, `Joined endpoints${result.distance > .001 ? ` with a ${result.distance.toFixed(2)} mm connector` : ""}`, false); };
  const runMoveToSection = (sectionId) => { const result = moveStrokesToSection(doc, selectedStrokeIds, sectionId); if (result.error) setMessage(result.error); else applySource(result.source, "Moved strokes under selected pen", false); };
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
  const openCanvasResize = () => { setCanvasOptions({ width: doc.meta.canvasW || 297, height: doc.meta.canvasH || 420, originX: doc.meta.originX || 0, originY: doc.meta.originY || 0, scaleArtwork: false }); setCanvasOpen(true); };
  const runCanvasResize = () => { const result = resizeCanvas(doc, canvasOptions); if (result.error) setMessage(result.error); else { applySource(result.source, `Canvas ${canvasOptions.width} × ${canvasOptions.height} mm`, false); setCanvasOpen(false); setViewResetKey((value) => value + 1); } };
  const runSearch = (action) => setSearchCommand({ ...search, action, id: Date.now() + Math.random() });
  const runInsertEvent = (options) => { applySource(insertEvent(doc, activeProfile, { ...options, lineIndex: selectedLine }), `Inserted ${options.kind}`, false); setEventsOpen(false); };
  const runContinuous = (rate) => { applySource(applyContinuousFeed(doc, selectedStrokeIds, Number(rate)), `Continuous feed ${rate} µl/mm`); setEventsOpen(false); };
  const runRemoveContinuous = () => { applySource(removeContinuousFeed(doc, selectedStrokeIds), "Removed continuous feed"); setEventsOpen(false); };
  const chooseProfile = (id) => { setActiveProfileId(id); setDirty(true); setMessage("Machine profile changed"); };
  const updateProfiles = (next) => {
    setProfiles(next);
    if (!next.some((profile) => profile.id === activeProfileId)) chooseProfile(next[0].id);
  };
  const safety = useMemo(() => auditDocument(doc), [doc]);
  const usedPens = useMemo(() => [...new Map(doc.sections.map((section) => [section.penIndex, { penIndex: section.penIndex, name: section.name, color: doc.meta.penColors?.[section.penIndex] || doc.strokes.find((stroke) => stroke.penIndex === section.penIndex)?.color || COLOR_PALETTE[section.penIndex % COLOR_PALETTE.length] }])).values()], [doc]);
  const visualLocked = doc.warnings.unsafeModal || playbackOpen || measureMode;
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
      else if (event.key === "Escape") { setSelectedStrokeIds([]); setSelectedEventIds([]); setSelectedPoints([]); setSelectedLine(null); setDraftPoints([]); setPenMode(false); setBoxMode(false); setMeasureMode(false); }
      else if (event.key === "Enter" && penMode) { event.preventDefault(); commitDraft(); }
      else if (selectedStrokeIds.length && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); const step = event.shiftKey ? 1 : .1;
        runMove(event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, event.key === "ArrowUp" ? (yUp ? step : -step) : event.key === "ArrowDown" ? (yUp ? -step : step) : 0);
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

  return <div className={`app${playbackOpen ? " playback-shown" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const files = event.dataTransfer.files; if (files.length > 1) combineFiles(files); else if (files[0]) loadFile(files[0]); }}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">L</span><div><strong>LATU</strong><small>G-code reader</small></div></div>
      <div className="toolbar">
        <div className="toolbar-row">
        <button className="primary" onClick={openFile}>Open</button>
        <div className="file-chip" title={name}><small>FILE</small><strong>{dirty ? "● " : ""}{name}</strong></div>
        <button onClick={openCombine}>Combine…</button>
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
        <button title="Select two endpoints with Shift-click, then Join" onClick={runJoin} disabled={visualLocked || selectedStrokeIds.length !== 2 || selectedPoints.length > 0 && selectedPoints.length !== 2}>Join endpoints</button>
        <button onClick={runOptimize} disabled={visualLocked || doc.strokes.length < 2}>Optimize</button>
        <select className="pen-target" aria-label="Move selected strokes to pen" value="" onChange={(event) => { if (event.target.value !== "") runMoveToSection(event.target.value); }} disabled={visualLocked || !selectedStrokeIds.length}>
          <option value="">Move to pen…</option>{doc.sections.map((section) => <option key={section.id} value={section.id}>{section.penIndex}: {section.name}</option>)}
        </select>
        </div>
        <div className="toolbar-row">
        <button className={boxMode ? "on" : ""} onClick={() => { setBoxMode((value) => !value); setPenMode(false); setMeasureMode(false); setDraftPoints([]); }} disabled={visualLocked}>Box select</button>
        <button className={penMode ? "on" : ""} onClick={() => { setPenMode((value) => !value); setBoxMode(false); setMeasureMode(false); setDraftPoints([]); }} disabled={visualLocked}>Pen tool</button>
        <button className={measureMode ? "on" : ""} onClick={() => { setMeasureMode((value) => !value); setBoxMode(false); setPenMode(false); setDraftPoints([]); }} disabled={paneMode === "text"}>Measure</button>
        <button onClick={() => setEventsOpen(true)} disabled={visualLocked}>＋ Event</button>
        <button onClick={() => setColorsOpen(true)} disabled={!doc.strokes.length}>Pen colors</button>
        <button className={playbackOpen ? "on" : ""} onClick={() => { const next = !playbackOpen; setPlaybackOpen(next); setPlaying(false); setBoxMode(false); setPenMode(false); setMeasureMode(false); }}>Playback</button>
        <button onClick={() => setScaleOpen(true)} disabled={visualLocked || !doc.strokes.length}>Scale / Fit</button>
        <button onClick={fitWorkArea} disabled={visualLocked || !doc.strokes.length}>Fit work area</button>
        <button onClick={openCanvasResize}>Canvas size</button>
        <span className="move-fields"><label title="Horizontal move in millimetres"><b>X</b><input aria-label="Move X" type="number" step="0.1" value={move.x} onChange={(event) => setMove((value) => ({ ...value, x: event.target.value }))} /></label><label title="Vertical move in millimetres; positive Y moves up"><b>Y</b><input aria-label="Move Y" type="number" step="0.1" value={move.y} onChange={(event) => setMove((value) => ({ ...value, y: event.target.value }))} /></label><button onClick={() => runMove()} disabled={visualLocked || !selectedStrokeIds.length}>Move</button></span>
        <span className="separator" />
        <button className={showTravels ? "on" : ""} onClick={() => setShowTravels((value) => !value)}>Travels</button>
        <button className={yUp ? "on" : ""} onClick={() => setYUp((value) => !value)}>Y+ ↑</button>
        <span className="separator" />
        <button className={paneMode === "canvas" ? "on" : ""} onClick={() => changeMode("canvas")}>Canvas</button>
        <button className={paneMode === "text" ? "on" : ""} onClick={() => changeMode("text")}>Text</button>
        <button className={searchOpen ? "on" : ""} title="G-code text is directly editable" onClick={() => { setSearchOpen((value) => !value); if (paneMode === "canvas") setPaneMode("split"); }}>Find / Replace</button>
        </div>
      </div>
      <div className="file-meta"><strong>{doc.meta.machineName || "Generic G-code"}</strong><small>{doc.meta.canvasW ? `${doc.meta.canvasW} × ${doc.meta.canvasH} mm` : "Canvas size not set"}</small></div>
      <input ref={inputRef} type="file" accept=".gcode,.gc,.nc,text/plain" hidden onChange={(event) => event.target.files[0] && loadFile(event.target.files[0])} />
      <input ref={combineInputRef} type="file" accept=".gcode,.gc,.nc,text/plain" multiple hidden onChange={(event) => { if (event.target.files.length) combineFiles(event.target.files); event.target.value = ""; }} />
    </header>
    <main className={`workspace mode-${paneMode}`} onPointerMove={(event) => {
      if (!dividerDrag.current) return;
      const rect = event.currentTarget.getBoundingClientRect(); setSplit(Math.max(25, Math.min(75, ((event.clientX - rect.left) / rect.width) * 100)));
    }} onPointerUp={() => { dividerDrag.current = false; }}>
      {paneMode !== "text" && <Outline doc={doc} selectedLine={selectedLine} selectedStrokeIds={selectedStrokeIds} onSelectLine={selectLine} onSelectGroup={(ids, additive) => { setSelectedPoints([]); setSelectedEventIds([]); setSelectedStrokeIds((current) => additive ? [...new Set([...current, ...ids])] : ids); setMessage(`Selected file group · ${ids.length} strokes`); }} onReorder={(next) => applySource(next, "Reordered strokes", false)} />}
      {paneMode !== "text" && <section className="canvas-pane" style={paneMode === "split" ? { width: `calc(${split}% - 96px)` } : undefined}>
        <CanvasView doc={doc} viewResetKey={viewResetKey} showTravels={showTravels} yUp={yUp} hoveredLine={hoveredLine} selectedLine={selectedLine} selectedStrokeIds={selectedStrokeIds} selectedPoints={selectedPoints} boxSelecting={boxMode} drawing={penMode} measuring={measureMode} draftPoints={draftPoints} playback={playbackOpen ? { active: true, time: playbackTime, timeline, sample: playbackSample, penWidths, paperColor } : null} onAddPoint={(point) => setDraftPoints((points) => [...points, point])} onInsertPoint={(strokeId, line, point) => !visualLocked && applySource(insertPoint(doc, strokeId, line, point), "Inserted point")} onHoverLine={setHoveredLine} onSelectLine={selectLine} onSelectStrokes={(ids, additive) => { setSelectedPoints([]); setSelectedStrokeIds((current) => additive ? [...new Set([...current, ...ids])] : ids); }} onTranslate={(dx, dy) => !visualLocked && runMove(dx, dy)} onMovePoints={(dx, dy) => !visualLocked && runMove(dx, dy)} onCursor={setCursor} />
        {boxMode && <div className="canvas-hint">Drag a box around strokes · Shift adds</div>}
        {penMode && <div className="canvas-hint">Click points · Enter to finish · Esc to cancel <strong>{draftPoints.length} pts</strong></div>}
        {measureMode && <div className="canvas-hint">Drag between two points to measure · Esc exits</div>}
        {!measureMode && selectedPoints.length > 1 && <div className="canvas-hint">{selectedPoints.length} points selected · drag a white point to move all · Join uses two endpoints</div>}
        {!!safety.length && <div className="safety-panel">{safety.map((warning) => <div key={warning.kind}>⚠ {warning.message}</div>)}</div>}
      </section>}
      {paneMode === "split" && <div className="divider" onPointerDown={(event) => { dividerDrag.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} />}
      {paneMode !== "canvas" && <section className={`text-pane${searchOpen ? " search-shown" : ""}`}>
        {searchOpen && <div className="find-bar"><input aria-label="Find" placeholder="Find, e.g. PAUSE" value={search.query} onChange={(event) => setSearch((value) => ({ ...value, query: event.target.value }))} onKeyDown={(event) => event.key === "Enter" && runSearch(event.shiftKey ? "previous" : "next")} autoFocus /><input aria-label="Replace" placeholder="Replace, e.g. M0" value={search.replacement} onChange={(event) => setSearch((value) => ({ ...value, replacement: event.target.value }))} /><button onClick={() => runSearch("previous")} disabled={!search.query}>↑</button><button onClick={() => runSearch("next")} disabled={!search.query}>↓</button><button onClick={() => runSearch("replace")} disabled={!search.query}>Replace</button><button onClick={() => runSearch("all")} disabled={!search.query}>All</button><label><input type="checkbox" checked={search.caseSensitive} onChange={(event) => setSearch((value) => ({ ...value, caseSensitive: event.target.checked }))} /> Aa</label><button onClick={() => setSearchOpen(false)}>×</button></div>}
        <TextView value={source} parsed={doc} hoveredLine={hoveredLine} selectedLine={selectedLine} playbackLine={playbackOpen ? playbackSample.lineIndex : null} autoFollow={playbackOpen && autoFollow} searchCommand={searchCommand} onHoverLine={setHoveredLine} onSelectLine={selectLine} onChange={parseText} />
      </section>}
    </main>
    {playbackOpen && <PlaybackPanel timeline={timeline} time={playbackTime} playing={playing} speed={playbackSpeed} autoFollow={autoFollow} penWidths={penWidths} paperColor={paperColor} onPaperColor={setPaperColor} onPenWidth={(penIndex, width) => setPenWidths((values) => ({ ...values, [penIndex]: Math.max(.05, Math.min(20, Number(width) || .3)) }))} onTime={seekPlayback} onPlaying={changePlaying} onSpeed={setPlaybackSpeed} onAutoFollow={setAutoFollow} onClose={() => { setPlaybackOpen(false); setPlaying(false); }} onChapter={(chapter) => { seekPlayback(chapter.time); setSelectedLine(chapter.lineIndex); }} />}
    <footer className="statusbar">
      <span>{stats.join(" · ")}</span>
      <span>{safety.length ? `⚠ ${safety.length} safety warning${safety.length === 1 ? "" : "s"}` : "Dialect OK"}</span>
      <span>{message || (selectedPoints.length ? `${selectedPoints.length} point${selectedPoints.length === 1 ? "" : "s"} selected` : selectedStrokeIds.length ? `${selectedStrokeIds.length} stroke${selectedStrokeIds.length === 1 ? "" : "s"} selected` : selectedLine == null ? "No selection" : `Line ${selectedLine + 1}`)} · {cursor ? `X ${cursor[0].toFixed(2)}  Y ${cursor[1].toFixed(2)} mm` : "—"}</span>
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
    {canvasOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCanvasOpen(false)}><div className="dialog">
      <h2>Canvas size</h2><p>Change the canvas boundary. G-code coordinates stay unchanged unless you scale the artwork.</p>
      <div className="field-row"><label>Width mm<input type="number" min="0.01" value={canvasOptions.width} onChange={(event) => setCanvasOptions((value) => ({ ...value, width: event.target.value }))} /></label><label>Height mm<input type="number" min="0.01" value={canvasOptions.height} onChange={(event) => setCanvasOptions((value) => ({ ...value, height: event.target.value }))} /></label></div>
      <div className="field-row custom-anchor"><label>Origin X<input type="number" value={canvasOptions.originX} onChange={(event) => setCanvasOptions((value) => ({ ...value, originX: event.target.value }))} /></label><label>Origin Y<input type="number" value={canvasOptions.originY} onChange={(event) => setCanvasOptions((value) => ({ ...value, originY: event.target.value }))} /></label></div>
      <label className="check"><input type="checkbox" checked={canvasOptions.scaleArtwork} onChange={(event) => setCanvasOptions((value) => ({ ...value, scaleArtwork: event.target.checked }))} /> Scale all artwork to the new canvas size</label>
      <div className="dialog-actions"><button onClick={() => setCanvasOpen(false)}>Cancel</button><button className="primary" onClick={runCanvasResize}>Apply</button></div>
    </div></div>}
    {colorsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setColorsOpen(false)}><div className="dialog color-dialog">
      <h2>Pen colors</h2><p>Pick a display and playback color for each G-code pen. The choice is stored as LATU metadata in the file.</p>
      <div className="color-rows">{usedPens.map((pen) => <div className="color-row" key={pen.penIndex}><strong><i style={{ background: pen.color }} />{pen.penIndex}: {pen.name}</strong><input aria-label={`Pen ${pen.penIndex} custom color`} type="color" value={pen.color} onChange={(event) => applySource(updatePenColor(doc, pen.penIndex, event.target.value), `Changed pen ${pen.penIndex} color`)} /><div className="color-palette">{COLOR_PALETTE.map((color) => <button key={color} aria-label={`Pen ${pen.penIndex} color ${color}`} className={pen.color.toLowerCase() === color ? "active" : ""} style={{ "--swatch": color }} onClick={() => applySource(updatePenColor(doc, pen.penIndex, color), `Changed pen ${pen.penIndex} color`)} />)}</div></div>)}</div>
      <div className="dialog-actions"><button className="primary" onClick={() => setColorsOpen(false)}>Done</button></div>
    </div></div>}
    {eventsOpen && <EventsPalette profile={activeProfile} selectedCount={selectedStrokeIds.length} onClose={() => setEventsOpen(false)} onInsert={runInsertEvent} onContinuous={runContinuous} onRemoveContinuous={runRemoveContinuous} />}
    {profilesOpen && <ProfileManager profiles={profiles} activeId={activeProfile.id} onChange={updateProfiles} onActivate={(id) => { chooseProfile(id); setProfilesOpen(false); }} onClose={() => setProfilesOpen(false)} onExport={(single) => download(JSON.stringify(single ? { app: "latu-machine", v: 1, prof: single } : { app: "latu-machines", v: 1, machines: profiles }, null, 2), single ? `${single.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json` : "latu-machines.json")} />}
  </div>;
}
