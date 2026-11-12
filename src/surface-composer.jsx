import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { stripTransform, stripCorners, surfaceSummary } from "./surface-composer.js";
import { createContentPlacement, contentTransform, placePathsOnSurface } from "./surface-render.js";
import { addSurfaceStrip, updateSurfaceStrip, updateSurfaceLayout, removeSurfaceStrip, regenerateSurface, MAX_SOURCE_PIXELS, MAX_SOURCE_URL_LENGTH } from "./surface-session.js";
import "./surface-composer.css";
import { paperBudget, productionPlan, productionSettings, advanceProduction } from "./surface-production.js";
import { DEFAULT_EXPORT_DPI, exportSurfacePngs, surfaceExportPlan } from "./surface-export.js";
import { preparePrintSource, renderSurfaceReceipt, checkSurfacePrinter, submitSurfaceReceipt, surfacePrintStatus } from "./surface-print.js";

function fitView(session) {
  const bounds = surfaceSummary(session.strips).bounds;
  const x = Math.min(0, bounds?.minXmm ?? 0), y = Math.min(0, bounds?.minYmm ?? 0);
  const w = Math.max(session.widthMm, bounds?.maxXmm ?? 0) - x;
  const h = Math.max(session.heightMm, bounds?.maxYmm ?? 0) - y;
  const pad = Math.max(w, h) * .06;
  return { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };
}
const polygon = points => points.map(p => p.join(",")).join(" ");
const mm = n => Math.round(n * 10) / 10;

function NumberField({ label, value, onChange, min, max, step = .1, disabled = false }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n) && (min == null || n >= min) && (max == null || n <= max)) { if (n !== value && onChange(n) === null) setDraft(String(value)); }
    else setDraft(String(value));
  };
  return <label className="sc-field"><span>{label}</span><input aria-label={label} type="number" value={draft} min={min} max={max} step={step} disabled={disabled}
    onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.stopPropagation(); setDraft(String(value)); } }} /></label>;
}

export default function SurfaceComposer({ session: inputSession, onChange, onClose, onSave, evaluateGraph, sourceNodes, currentSelection, onLegacyMode, pens, projectName }) {
  const session = useMemo(() => inputSession.production ? inputSession : { ...inputSession, production: productionSettings() }, [inputSession]);
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef(null), dialogRef = useRef(null), closeRef = useRef(null), fileRef = useRef(null);
  const dragRef = useRef(null), history = useRef({ past: [], future: [] });
  const sessionRef = useRef(session), alive = useRef(true);
  sessionRef.current = session;
  const [historyVersion, setHistoryVersion] = useState(0);
  const [view, setView] = useState(() => fitView(session));
  const [gesture, setGesture] = useState(null);
  const [error, setError] = useState("");
  const [loadingImage, setLoadingImage] = useState(false);
  const [labels, setLabels] = useState(true);
  const [reference, setReference] = useState(false);
  const [consecutive, setConsecutive] = useState(false); // Deliberate opt-in, never restored from a file.
  const [printBusy, setPrintBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportResolution, setExportResolution] = useState("epson");
  const [exportArea, setExportArea] = useState("paper");
  const [exportMessage, setExportMessage] = useState("");
  const cancelExport = useRef(false);
  const busy = printBusy || exportBusy;
  const [printMessage, setPrintMessage] = useState("");
  const stopPrint = useRef(false);
  const recoveredPrint = useRef(false);
  const s = gesture || session;
  const selected = s.strips.find(strip => strip.id === s.selectedId);
  const summary = useMemo(() => surfaceSummary(s.strips), [s.strips]);
  const budget = useMemo(() => paperBudget(s.strips, s.production), [s.strips, s.production]);
  const pendingJob = s.production.lastJob && ["queued", "printing", "unknown"].includes(s.production.lastJob.status);
  let printPlan = null, printPlanError = "";
  try { printPlan = productionPlan(s, { consecutive }); } catch (e) { printPlanError = e.message; }
  const sorted = useMemo(() => [...s.strips].sort((a, b) => a.zIndex - b.zIndex), [s.strips]);
  const clipIds = useMemo(() => new Map(s.strips.map((strip, i) => [strip.id, `${uid}-ink-${i}`])), [s.strips, uid]);
  const saveHistory = old => {
    const h = history.current;
    h.past.push(old); if (h.past.length > 50) h.past.shift(); h.future = [];
    setHistoryVersion(v => v + 1);
  };
  const commit = (next, record = true) => {
    if (busy) return null;
    try { const current = sessionRef.current; const result = typeof next === "function" ? next(current) : next; if (record) saveHistory(current); onChange(result); setError(""); return result; }
    catch (e) { setError(e.message); return null; }
  };
  const undo = () => { const h = history.current; if (!h.past.length) return; h.future.push(session); const restored = h.past.pop(); onChange({ ...restored, production: restored.selectedId === session.selectedId ? session.production : { ...session.production, fromMm: 0, toMm: null } }); setHistoryVersion(v => v + 1); };
  const redo = () => { const h = history.current; if (!h.future.length) return; h.past.push(session); const restored = h.future.pop(); onChange({ ...restored, production: restored.selectedId === session.selectedId ? session.production : { ...session.production, fromMm: 0, toMm: null } }); setHistoryVersion(v => v + 1); };
  const changeStrip = (key, value) => commit(old => updateSurfaceStrip(old, old.selectedId, { [key]: value }));
  const changeLayout = (key, value) => commit(old => updateSurfaceLayout(old, { [key]: value }));
  const changeSource = patch => commit(old => ({ ...old, source: { ...old.source, ...patch } }));
  const changeProduction = (key, value) => commit(old => ({ ...old, production: productionSettings({ ...old.production, [key]: value }) }), false);
  const selectStrip = stripId => { if (!busy) onChange(old => ({ ...old, selectedId: stripId, production: { ...old.production, fromMm: 0, toMm: null } })); };

  const exportOptions = { dpi: exportResolution === "epson" ? DEFAULT_EXPORT_DPI : Number(exportResolution), area: exportArea, projectName };
  let selectedExport = null, allExport = null, exportError = "";
  try { selectedExport = surfaceExportPlan(s, { ...exportOptions, selectedOnly: true }); } catch { /* A selection is optional for the complete ZIP. */ }
  try { allExport = surfaceExportPlan(s, exportOptions); } catch (e) { exportError = e.message; }
  const exportStrips = async selectedOnly => {
    if (busy || loadingImage) return;
    cancelExport.current = false; setExportBusy(true); setExportMessage("Preparing export…");
    try {
      const result = await exportSurfacePngs(sessionRef.current, { ...exportOptions, selectedOnly }, {
        evaluateGraph, pens, cancelled: () => cancelExport.current || !alive.current,
        onProgress: ({ index, total, progress }) => { if (alive.current) setExportMessage(`Exporting strip ${index}/${total} · ${Math.round(progress * 100)}%`); },
      });
      if (!alive.current || cancelExport.current) return;
      const url = URL.createObjectURL(result.blob), link = document.createElement("a");
      link.href = url; link.download = result.filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportMessage(`Saved ${result.manifest.strips.length} strip(s) · ${(result.blob.size / 1024 / 1024).toFixed(2)} MB. Print at actual size / 100%.`);
    } catch (e) { if (alive.current) setExportMessage(e.message); }
    finally { if (alive.current) setExportBusy(false); }
  };

  const recordJob = (job, removeId = null) => {
    try {
      const key = "muusia-surface-pending", previous = JSON.parse(localStorage.getItem(key) || "null");
      if (job && ["queued", "printing", "unknown"].includes(job.status)) {
        if (!previous || previous.job.id === job.id) localStorage.setItem(key, JSON.stringify({ job, url: sessionRef.current.production.serverUrl }));
      } else if (previous && previous.job.id === (job?.id ?? removeId ?? sessionRef.current.production.lastJob?.id)) localStorage.removeItem(key);
    } catch { /* Project files also retain the last job; storage can be unavailable. */ }
    onChange(old => ({ ...old, production: { ...old.production, lastJob: job } }));
  };
  const pollJob = async (url, job) => {
    for (;;) {
      const result = await surfacePrintStatus(url, job.id);
      if (!alive.current) return null;
      if (["done", "failed", "cancelled"].includes(result.status)) return result;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };
  const checkLastJob = async () => {
    const job = sessionRef.current.production.lastJob;
    if (!job) return;
    setPrintBusy(true);
    try {
      const result = await surfacePrintStatus(sessionRef.current.production.serverUrl, job.id);
      recordJob({ ...job, status: result.status });
      if (result.status === "done" && job.status !== "done" && !recoveredPrint.current) onChange(old => advanceProduction(old, { originalId: job.stripId, fromMm: job.fromMm, toMm: job.toMm }));
      setPrintMessage(result.status === "done" ? (recoveredPrint.current ? "Recovered job was sent. Check the paper and set where to resume; allow cooling first." : "Sent. Let the printer cool; start the next strip when ready.") : `Job ${result.status}. ${result.error || ""}`);
    } catch (e) { setPrintMessage(e.message); }
    finally { setPrintBusy(false); }
  };
  const printStrips = async () => {
    if (busy || pendingJob || loadingImage) return;
    const snapshot = sessionRef.current;
    let activeJob = null;
    let dryRun = false;
    stopPrint.current = false; recoveredPrint.current = false; setPrintBusy(true); setPrintMessage("Checking printer…");
    try {
      const plan = productionPlan(snapshot, { consecutive });
      if (plan.totalM > paperBudget(snapshot.strips, snapshot.production).availableM + 1e-9) throw new Error("This print run exceeds the available roll. Adjust the range or roll settings.");
      const printer = await checkSurfacePrinter(snapshot.production.serverUrl);
      dryRun = printer.mode === "test file";
      setPrintMessage("Preparing print content…");
      const source = await preparePrintSource(snapshot, evaluateGraph);
      for (let i = 0; i < plan.ranges.length; i++) {
        if (stopPrint.current || !alive.current) break;
        const range = plan.ranges[i];
        const receipt = await renderSurfaceReceipt(snapshot, range, source, { cancelled: () => stopPrint.current || !alive.current, onProgress: n => { if (alive.current) setPrintMessage(`Preparing strip ${i + 1}/${plan.ranges.length} · ${Math.round(n * 100)}%`); } });
        if (stopPrint.current || !alive.current) break;
        activeJob = { id: crypto.randomUUID().replaceAll("-", ""), stripId: range.originalId, fromMm: range.fromMm, toMm: range.toMm, status: "unknown" };
        recordJob(activeJob);
        const submitted = await submitSurfaceReceipt(snapshot.production.serverUrl, { ...receipt, requestId: activeJob.id });
        activeJob = { ...activeJob, id: submitted.id, status: "queued" };
        if (!alive.current) break;
        recordJob(activeJob); setPrintMessage(`Printing strip ${i + 1}/${plan.ranges.length} · ${range.lengthMm.toFixed(0)} mm…`);
        const result = await pollJob(snapshot.production.serverUrl, activeJob);
        if (!result) break;
        activeJob = { ...activeJob, status: result.status }; recordJob(activeJob);
        if (result.status !== "done") throw new Error(result.error || `Print job ${result.status}. Enter the actual restart position before continuing.`);
        onChange(old => advanceProduction(old, range)); activeJob = null;
      }
      if (alive.current) setPrintMessage(dryRun ? "Dry run saved to a file. No paper printed; the next strip waits for you." : consecutive && !stopPrint.current ? "Selected print run sent. Let the printer cool." : "Sent. Cooling pause — start the next strip when ready.");
    } catch (e) {
      if (alive.current) { if (activeJob && !["done", "failed", "cancelled"].includes(activeJob.status)) recordJob(activeJob.status === "unknown" && [400,403,409,413,503].includes(e.status) ? null : { ...activeJob, status: "unknown" }, activeJob.id); setPrintMessage(e.message); }
    } finally { if (alive.current) setPrintBusy(false); }
  };

  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => { alive.current = false; stopPrint.current = true; cancelExport.current = true; previous?.focus?.(); };
  }, []);
  useEffect(() => {
    if (sessionRef.current.production.lastJob) return;
    try {
      const saved = JSON.parse(localStorage.getItem("muusia-surface-pending") || "null");
      if (!saved) return;
      const validated = productionSettings({ serverUrl: saved.url, lastJob: saved.job });
      recoveredPrint.current = true;
      onChange(old => ({ ...old, production: { ...old.production, serverUrl: validated.serverUrl, lastJob: validated.lastJob } }));
      setPrintMessage("Recovered an unfinished print. Check its status before resuming.");
    } catch { /* Ignore an unavailable or invalid local recovery record. */ }
  }, [onChange]);

  const content = useMemo(() => {
    try {
      if (s.source.kind === "image") {
        const image = s.source.image;
        if (!image) return { empty: "Choose an image to map onto the paper strips." };
        const placement = createContentPlacement({ sourceWidth: image.width, sourceHeight: image.height, widthMm: s.widthMm, heightMm: s.heightMm, fit: s.source.fit });
        const t = contentTransform(placement);
        const a = t.sourceToGlobal([0, 0]), b = t.sourceToGlobal([1, 0]), c = t.sourceToGlobal([0, 1]);
        return { image, matrix: [b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1], a[0], a[1]] };
      }
      if (s.source.nodeId == null) return { empty: "Select a graph output or choose an image." };
      const ps = evaluateGraph(s.widthMm, s.heightMm, s.source.graphPath, s.source.nodeId);
      const placement = createContentPlacement({ sourceWidth: s.widthMm, sourceHeight: s.heightMm, widthMm: s.widthMm, heightMm: s.heightMm });
      const global = placePathsOnSurface(ps, placement, { widthMm: s.widthMm, heightMm: s.heightMm });
      const count = global.paths.reduce((n, p) => n + p.pts.length, 0);
      return { paths: global.paths, stride: Math.max(1, Math.ceil(count / 150000)), empty: global.paths.length ? null : "This graph output contains no lines. Choose another output or an image." };
    } catch (e) { return { empty: e.message }; }
  }, [s.source, s.widthMm, s.heightMm, evaluateGraph]);

  const loadImage = async file => {
    if (!file) return;
    setLoadingImage(true); setError("");
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choose a PNG, JPEG or WebP image.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Choose an image smaller than 8 MB.");
      const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read the image.")); reader.readAsDataURL(file); });
      if (src.length > MAX_SOURCE_URL_LENGTH) throw new Error("The image is too large to store in a project.");
      const image = await createImageBitmap(file, { imageOrientation: "from-image" });
      const width = image.width, height = image.height; image.close();
      if (width * height > MAX_SOURCE_PIXELS) throw new Error("Choose an image of at most 25 megapixels.");
      if (alive.current) changeSource({ image: { src, width, height, name: file.name } });
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setLoadingImage(false); }
  };

  const begin = (event, mode, strip = null) => {
    if (busy) return;
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault(); event.stopPropagation();
    const inverse = svgRef.current.getScreenCTM()?.inverse();
    if (!inverse) return;
    const at = (x, y) => new DOMPoint(x, y).matrixTransform(inverse);
    const start = at(event.clientX, event.clientY);
    const base = strip ? { ...session, selectedId: strip.id, production: strip.id === session.selectedId ? session.production : { ...session.production, fromMm: 0, toMm: null } } : session;
    if (strip) onChange(base);
    else onChange({ ...session, selectedId: null });
    dragRef.current = { mode, strip, inverse, start, view, base, latest: null, moved: false };
    svgRef.current.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(drag.inverse);
    const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (drag.mode === "pan") { setView({ ...drag.view, x: drag.view.x - dx, y: drag.view.y - dy }); return; }
    if (Math.hypot(dx, dy) < .01 && !drag.moved) return;
    if (!drag.moved) { saveHistory(drag.base); drag.moved = true; }
    const strip = drag.strip;
    let patch;
    if (drag.mode === "rotate") {
      const a = Math.atan2(drag.start.y - strip.centerYmm, drag.start.x - strip.centerXmm);
      const b = Math.atan2(p.y - strip.centerYmm, p.x - strip.centerXmm);
      let rotationDeg = strip.rotationDeg + (b - a) * 180 / Math.PI;
      if (event.shiftKey) rotationDeg = Math.round(rotationDeg / 15) * 15;
      patch = { rotationDeg };
    } else if (drag.mode === "length") {
      const t = stripTransform(strip), top = t.toGlobal([strip.physicalWidthMm / 2, 0]);
      const end = t.toGlobal([strip.physicalWidthMm / 2, 1]);
      const ax = end[0] - top[0], ay = end[1] - top[1];
      const lengthMm = mm(Math.max(1, (p.x - top[0]) * ax + (p.y - top[1]) * ay));
      patch = { lengthMm, centerXmm: top[0] + ax * lengthMm / 2, centerYmm: top[1] + ay * lengthMm / 2 };
    } else patch = { centerXmm: mm(strip.centerXmm + dx), centerYmm: mm(strip.centerYmm + dy) };
    try { drag.latest = updateSurfaceStrip(drag.base, strip.id, patch); setGesture(drag.latest); }
    catch (e) { setError(e.message); }
  };
  const end = (event, cancel = false) => {
    const drag = dragRef.current;
    if (drag?.latest && !cancel) onChange(drag.latest);
    if (cancel && drag?.moved) { history.current.past.pop(); setHistoryVersion(v => v + 1); }
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    dragRef.current = null; setGesture(null);
  };
  const wheel = event => {
    event.preventDefault();
    const inverse = svgRef.current.getScreenCTM()?.inverse(); if (!inverse || dragRef.current) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    const k = Math.max(.2, Math.min(5, Math.exp(event.deltaY * .001)));
    setView(old => { const w = Math.max(10, Math.min(2000000, old.w * k)), ratio = w / old.w; return { x: p.x - (p.x - old.x) * ratio, y: p.y - (p.y - old.y) * ratio, w, h: old.h * ratio }; });
  };
  useEffect(() => {
    const svg = svgRef.current;
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  });
  const keyDown = event => {
    event.stopPropagation();
    if (event.key === "Escape") { if (!busy) onClose(); return; }
    if (event.key === "Tab") {
      const items = [...dialogRef.current.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex='0']")].filter(el => el.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    }
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (busy) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if ((event.key === "Delete" || event.key === "Backspace") && s.selectedId) { event.preventDefault(); commit(old => removeSurfaceStrip(old, old.selectedId)); }
    if (selected && event.key.startsWith("Arrow")) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; commit(old => updateSurfaceStrip(old, selected.id, { centerXmm: selected.centerXmm + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), centerYmm: selected.centerYmm + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) })); }
  };
  const radius = Math.max(view.w, view.h) * .006;
  const controls = selected ? (() => {
    const t = stripTransform(selected), w = selected.physicalWidthMm, l = selected.lengthMm;
    return { top: t.toGlobal([w / 2, 0]), rotate: t.toGlobal([w / 2, -radius * 6]), bottom: t.toGlobal([w / 2, l]) };
  })() : null;

  return <div className="sc-overlay" data-busy={busy} role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} ref={dialogRef} onKeyDown={keyDown}>
    <header className="sc-header"><div><h1 id={`${uid}-title`}>Surface Composer</h1><span>Paper is part of the composition.</span></div><div className="sc-actions">
      <button onClick={undo} disabled={busy || !history.current.past.length} title="Undo (⌘/Ctrl Z)">Undo</button><button onClick={redo} disabled={busy || !history.current.future.length} title="Redo (⌘/Ctrl Shift Z)">Redo</button>
      <button onClick={onSave}>Save project</button><button className="sc-primary" ref={closeRef} disabled={busy} onClick={onClose}>Done</button></div></header>
    <nav className="sc-tabs" aria-label="Surface modes"><button disabled={busy} onClick={() => onLegacyMode("Sheets")}>Mega Canvas ↗</button><button disabled={busy} onClick={() => onLegacyMode("Roll")}>Roll Mode ↗</button>
      <button aria-pressed={s.mode === "tiling"} onClick={() => commit({ ...session, mode: "tiling" }, false)}>Strip Tiling</button><button aria-pressed={s.mode === "freeform"} onClick={() => commit({ ...session, mode: "freeform" }, false)}>Freeform Strips</button><span>All dimensions in mm</span></nav>
    {error && <div className="sc-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
    <div className="sc-body">
      <aside className="sc-sidebar"><section><h2>Content</h2><label className="sc-field"><span>Source</span><select aria-label="Content source" value={s.source.kind} onChange={e => changeSource({ kind: e.target.value })}><option value="graph">Graph output</option><option value="image">Image</option></select></label>
        {s.source.kind === "graph" ? <><label className="sc-field"><span>Node output</span><select aria-label="Graph output" value={s.source.nodeId ?? ""} onChange={e => { const node = sourceNodes.find(n => String(n.id) === e.target.value); changeSource({ nodeId: node?.id ?? null }); }}><option value="">Choose a node</option>{sourceNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label><button disabled={!currentSelection} onClick={() => changeSource({ nodeId: currentSelection.id, graphPath: currentSelection.path })}>Use selected node</button></> : <><button disabled={loadingImage} onClick={() => fileRef.current.click()}>{loadingImage ? "Reading image…" : "Choose image…"}</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { loadImage(e.target.files?.[0]); e.target.value = ""; }} /><p className="sc-note">{s.source.image ? `${s.source.image.name} · ${s.source.image.width} × ${s.source.image.height} px` : "PNG, JPEG or WebP · up to 8 MB"}</p>
        <label className="sc-field"><span>Image fit</span><select aria-label="Image fit" value={s.source.fit} onChange={e => changeSource({ fit: e.target.value })}><option value="contain">Contain · whole image</option><option value="cover">Cover · crop to surface</option></select></label></>}
      </section>
      <section><h2>Surface & paper</h2><div className="sc-grid"><NumberField label="Surface width" value={s.widthMm} min={1} onChange={widthMm => commit({ ...session, widthMm })} /><NumberField label="Surface height" value={s.heightMm} min={1} onChange={heightMm => commit({ ...session, heightMm })} /></div>
        <div className={`sc-paper-budget ${budget.fits ? "fits" : "short"}`} aria-live="polite"><span>Total paper · full layout</span><strong>{budget.totalM.toFixed(2)} m</strong><span>{budget.fits ? `Fits on this roll · ${(budget.availableM - budget.totalM).toFixed(2)} m spare` : `${budget.shortfallM.toFixed(2)} m more paper needed`}</span></div>
        <p className="sc-note">{budget.artworkM.toFixed(2)} m strips + {budget.allowanceM.toFixed(2)} m feed/cut allowance</p>
        <div className="sc-grid"><NumberField label="Roll length (m)" value={s.production.rollLengthM} min={.1} onChange={v => changeProduction("rollLengthM", v)} /><NumberField label="Already used (m)" value={s.production.usedOnRollM} min={0} onChange={v => changeProduction("usedOnRollM", v)} /><NumberField label="Reserve (m)" value={s.production.reserveM} min={0} onChange={v => changeProduction("reserveM", v)} /><NumberField label="Allowance per strip" value={s.production.allowanceMm} min={0} onChange={v => changeProduction("allowanceMm", v)} /></div><p className="sc-note">Enter roll use manually. Feed/cut allowance is an estimate; hidden strips are excluded.</p>
      </section>
      <section><h2>Generate strips</h2><label className="sc-field"><span>Direction</span><select aria-label="Strip direction" value={s.layout.rotationDeg === 0 ? "vertical" : s.layout.rotationDeg === 90 ? "horizontal" : "diagonal"} onChange={e => changeLayout("rotationDeg", e.target.value === "vertical" ? 0 : e.target.value === "horizontal" ? 90 : 45)}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="diagonal">Diagonal</option></select></label>
        <div className="sc-grid"><NumberField label="Layout angle" value={s.layout.rotationDeg} onChange={v => changeLayout("rotationDeg", v)} /><NumberField label="Paper gap" value={s.layout.gapMm} min={0} onChange={v => changeLayout("gapMm", v)} /><NumberField label="Physical width" value={s.layout.physicalWidthMm} min={.1} onChange={v => changeLayout("physicalWidthMm", v)} /><NumberField label="Printable width" value={s.layout.printableWidthMm} min={.1} onChange={v => changeLayout("printableWidthMm", v)} /><NumberField label="Printable offset" value={s.layout.printableOffsetMm} min={0} onChange={v => changeLayout("printableOffsetMm", v)} /></div>
        <label className="sc-check"><input type="checkbox" checked={s.layout.count === null} onChange={e => changeLayout("count", e.target.checked ? null : Math.max(1, s.strips.length))} />Automatic count</label>{s.layout.count !== null && <NumberField label="Strip count" value={s.layout.count} min={1} max={4096} step={1} onChange={v => changeLayout("count", v)} />}
        <label className="sc-check"><input type="checkbox" checked={s.layout.lengthMm === null} onChange={e => changeLayout("lengthMm", e.target.checked ? null : s.heightMm)} />Automatic length</label>{s.layout.lengthMm !== null && <NumberField label="Strip length" value={s.layout.lengthMm} min={1} onChange={v => changeLayout("lengthMm", v)} />}
        <button className="sc-primary sc-wide" onClick={() => { const next = commit(old => regenerateSurface(old)); if (next) setView(fitView(next)); }}>Generate strips</button><p className="sc-note">Generate replaces the current layout. Undo restores manual edits. Paper width is nominal; the 4.6 mm side margins were checked on the Epson.</p>
      </section>
      <section className="sc-export"><h2>Export PNG</h2>
        <label className="sc-field"><span>Resolution</span><select aria-label="PNG resolution" value={exportResolution} disabled={busy} onChange={e => setExportResolution(e.target.value)}><option value="epson">Epson · measured 179.5 dpi</option><option value="150">150 dpi</option><option value="300">300 dpi</option><option value="600">600 dpi</option></select></label>
        <label className="sc-field"><span>Image area</span><select aria-label="PNG image area" value={exportArea} disabled={busy} onChange={e => setExportArea(e.target.value)}><option value="paper">Full paper · white margins</option><option value="printable">Printable area only</option></select></label>
        {selectedExport && <p className="sc-note">Selected: {selectedExport.entries[0].plan.width} × {selectedExport.entries[0].plan.height} px</p>}
        <button className="sc-wide" disabled={busy || loadingImage || !selectedExport || !!content.empty} onClick={() => exportStrips(true)}>Export selected PNG</button>
        <button className="sc-wide" disabled={busy || loadingImage || !allExport || !!content.empty} onClick={() => exportStrips(false)}>Export all PNGs + manifest · ZIP</button>
        <p className="sc-note">{allExport ? `${allExport.entries.length} visible strips in print order. ` : `${exportError} `}Whole strips; start/end print positions do not crop these files. Colours and physical size are preserved. Use actual size / 100% when printing.</p>
        {exportBusy && <button className="sc-wide" onClick={() => { cancelExport.current = true; setExportMessage("Cancelling export…"); }}>Cancel export</button>}
        {exportMessage && <p className="sc-print-status" role="status">{exportMessage}</p>}
      </section></aside>

      <main className="sc-stage"><div className="sc-stage-tools"><button onClick={() => setView(fitView(s))}>Fit all</button><button onClick={() => setView({ x: -s.widthMm * .05, y: -s.heightMm * .05, w: s.widthMm * 1.1, h: s.heightMm * 1.1 })}>Fit surface</button><label><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} />Numbers</label><label><input type="checkbox" checked={reference} onChange={e => setReference(e.target.checked)} />Source reference</label><span>{content.stride > 1 ? "Preview simplified" : "Image Mapping"}</span></div>
        <div className="sc-drawing"><svg aria-label="Surface composition" ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} onPointerDown={e => begin(e, "pan")} onPointerMove={move} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)} onContextMenu={e => e.preventDefault()}>
          <defs><clipPath id={`${uid}-canvas`}><rect width={s.widthMm} height={s.heightMm} /></clipPath><g id={`${uid}-art`} clipPath={`url(#${uid}-canvas)`}>
            {content.image && <image href={content.image.src} width={content.image.width} height={content.image.height} transform={`matrix(${content.matrix.join(" ")})`} preserveAspectRatio="none" />}
            {content.paths?.map((p, i) => { const points = content.stride > 1 ? p.pts.filter((q, j) => j % content.stride === 0 || j === p.pts.length - 1) : p.pts; return <path key={i} d={`M${points.map(q => `${q[0]},${q[1]}`).join("L")}${p.closed ? "Z" : ""}`} fill="none" stroke={pens[p.layer % pens.length]?.c || "#222"} strokeWidth={.8} vectorEffect="non-scaling-stroke" />; })}
          </g>{sorted.map(strip => <clipPath key={strip.id} id={clipIds.get(strip.id)}><polygon points={polygon(stripCorners(strip, "printable"))} /></clipPath>)}</defs>
          <rect width={s.widthMm} height={s.heightMm} fill="#343c45" stroke="#788694" strokeWidth={view.w * .0008} strokeDasharray={`${view.w * .004} ${view.w * .004}`} />
          {reference && <use href={`#${uid}-art`} opacity=".22" pointerEvents="none" />}
          {sorted.filter(strip => strip.visible).map(strip => <g key={strip.id} data-strip-id={strip.id} onPointerDown={e => begin(e, e.button === 1 ? "pan" : "move", strip)} className="sc-paper">
            <polygon points={polygon(stripCorners(strip))} fill="#fffdf8" stroke={s.selectedId === strip.id ? "#edaa62" : "#acb5b8"} strokeWidth={view.w * (s.selectedId === strip.id ? .0018 : .0005)} />
            <use href={`#${uid}-art`} clipPath={`url(#${clipIds.get(strip.id)})`} pointerEvents="none" />
          </g>)}
          {labels && sorted.filter(strip => strip.visible).map(strip => { const t = stripTransform(strip), p = t.toGlobal([strip.physicalWidthMm / 2, Math.min(strip.lengthMm / 2, radius * 3)]); return <g key={strip.id} pointerEvents="none"><circle cx={p[0]} cy={p[1]} r={radius * 1.4} fill={s.selectedId === strip.id ? "#edaa62" : "#263541"} /><text x={p[0]} y={p[1]} fill={s.selectedId === strip.id ? "#1a2025" : "#fff"} textAnchor="middle" dominantBaseline="central" fontSize={radius * 1.5}>{s.strips.indexOf(strip) + 1}</text></g>; })}
          {selected && <g><polygon points={polygon(stripCorners(selected))} fill="none" stroke="#edaa62" strokeWidth={view.w * .0018} strokeDasharray={selected.visible ? undefined : `${radius} ${radius}`} pointerEvents="none" /><line x1={controls.top[0]} y1={controls.top[1]} x2={controls.rotate[0]} y2={controls.rotate[1]} stroke="#edaa62" strokeWidth={radius * .25} pointerEvents="none" /><circle aria-label="Rotate selected strip" role="button" cx={controls.rotate[0]} cy={controls.rotate[1]} r={radius * 1.6} fill="#edaa62" stroke="#1d2630" strokeWidth={radius * .3} onPointerDown={e => begin(e, "rotate", selected)} className="sc-handle"><title>Drag to rotate · Shift snaps to 15°</title></circle><rect aria-label="Resize selected strip" role="button" x={controls.bottom[0] - radius * 1.5} y={controls.bottom[1] - radius * 1.5} width={radius * 3} height={radius * 3} fill="#79b6c4" stroke="#1d2630" strokeWidth={radius * .3} onPointerDown={e => begin(e, "length", selected)} className="sc-handle"><title>Drag to change length</title></rect></g>}
        </svg>{content.empty && <div className="sc-empty">{content.empty}</div>}</div>
        <div className="sc-stage-help">Drag paper to move · orange handle to rotate · blue handle to resize · wheel to zoom · background to pan</div>
        <footer className="sc-summary"><strong>{budget.totalM.toFixed(2)} m total</strong><span>{summary.stripCount} visible strips</span><span>{budget.fits ? "Fits on roll" : `${budget.shortfallM.toFixed(2)} m short`}</span><span>Paper envelope {summary.bounds ? `${mm(summary.bounds.widthMm)} × ${mm(summary.bounds.heightMm)} mm` : "—"}</span><span>Surface {s.widthMm} × {s.heightMm} mm</span></footer>
      </main>

      <aside className="sc-inspector"><section><h2>{selected ? `Strip ${s.strips.indexOf(selected) + 1}` : "Select a strip"}</h2>{selected ? <>
        <label className="sc-check"><input type="checkbox" checked={selected.visible} onChange={e => changeStrip("visible", e.target.checked)} />Visible · included in production</label>
        <div className="sc-grid"><NumberField label="Centre X" value={mm(selected.centerXmm)} onChange={v => changeStrip("centerXmm", v)} /><NumberField label="Centre Y" value={mm(selected.centerYmm)} onChange={v => changeStrip("centerYmm", v)} /><NumberField label="Rotation" value={mm(selected.rotationDeg)} onChange={v => changeStrip("rotationDeg", v)} /><NumberField label="Length" value={mm(selected.lengthMm)} min={1} onChange={v => changeStrip("lengthMm", v)} /><NumberField label="Paper width" value={selected.physicalWidthMm} min={.1} onChange={v => changeStrip("physicalWidthMm", v)} /><NumberField label="Ink width" value={selected.printableWidthMm} min={.1} onChange={v => changeStrip("printableWidthMm", v)} /><NumberField label="Ink offset" value={selected.printableOffsetMm} min={0} onChange={v => changeStrip("printableOffsetMm", v)} /><NumberField label="Layer" value={selected.zIndex} step={1} onChange={v => changeStrip("zIndex", v)} /><NumberField label="Print order" value={selected.printOrder} min={1} step={1} onChange={v => changeStrip("printOrder", v)} /></div>
        <div className="sc-actions"><button onClick={() => commit(old => addSurfaceStrip(old, old.selectedId))}>Duplicate strip</button><button onClick={() => commit(old => removeSurfaceStrip(old, old.selectedId))}>Remove</button></div></> : <p className="sc-note">Choose paper in the preview or in the list.</p>}</section>
        <section className="sc-production"><h2>Print / continue</h2><label className="sc-field"><span>Start with strip</span><select aria-label="Print strip" value={s.selectedId ?? ""} disabled={busy} onChange={e => selectStrip(e.target.value)}><option value="">Select a strip</option>{[...s.strips].filter(x => x.visible).sort((a,b) => a.printOrder-b.printOrder).map(strip => <option key={strip.id} value={strip.id}>{s.strips.indexOf(strip)+1} · {mm(strip.lengthMm)} mm</option>)}</select></label>
          <NumberField label="Start at (mm)" value={s.production.fromMm} min={0} disabled={busy} onChange={v => changeProduction("fromMm", v)} />
          <label className="sc-check"><input type="checkbox" checked={s.production.toMm === null} disabled={busy || consecutive} onChange={e => changeProduction("toMm", e.target.checked ? null : selected?.lengthMm ?? 100)} />To end of strip</label>{s.production.toMm !== null && !consecutive && <NumberField label="End at (mm)" value={s.production.toMm} min={0} disabled={busy} onChange={v => changeProduction("toMm", v)} />}
          <div className="sc-print-mode">One strip at a time. The next waits for you to let the printer cool.</div>
          <label className="sc-check"><input type="checkbox" aria-label="Print remaining strips consecutively" checked={consecutive} disabled={busy} onChange={e => setConsecutive(e.target.checked)} />Print remaining consecutively · short strips</label>
          <label className="sc-check"><input type="checkbox" checked={s.production.cut} disabled={busy} onChange={e => changeProduction("cut", e.target.checked)} />Cut after each strip</label>
          <label className="sc-field"><span>Print service</span><input aria-label="Surface print service" defaultValue={s.production.serverUrl} key={s.production.serverUrl} disabled={busy} onBlur={e => { if (changeProduction("serverUrl", e.target.value) === null) e.target.value = s.production.serverUrl; }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
          <p className="sc-note">{printPlan ? `${printPlan.ranges.length} strip(s) · ${printPlan.totalM.toFixed(2)} m incl. allowance` : printPlanError}</p>
          <button className="sc-primary sc-wide" disabled={busy || loadingImage || pendingJob || !printPlan || !!content.empty || printPlan.totalM > budget.availableM + 1e-9} onClick={printStrips}>{consecutive ? "Print remaining consecutively" : "Print selected range"}</button>
          {printBusy && <button className="sc-wide" onClick={() => { stopPrint.current = true; setPrintMessage("Stopping after the current strip; no next strip will start."); }}>Stop after this strip</button>}
          {s.production.lastJob && <button className="sc-wide" disabled={busy} onClick={checkLastJob}>Check last job</button>}
          {pendingJob && !printBusy && <><p className="sc-note">If status cannot be recovered, check the paper and enter the actual restart position.</p><button className="sc-wide" disabled={busy} onClick={() => { recordJob(null); setPrintMessage("Print record cleared. Set the actual restart position before printing."); }}>Resume manually · clear record</button></>}
          {printMessage && <p className="sc-print-status" role="status">{printMessage}</p>}
        </section>
        <section className="sc-strip-section"><div className="sc-section-heading"><h2>All strips <span>{s.strips.length}</span></h2><button onClick={() => commit(old => addSurfaceStrip(old))}>+ Add</button></div><div className="sc-strip-list">{s.strips.map((strip, i) => <div key={strip.id} className={strip.id === s.selectedId ? "sc-strip-row is-selected" : "sc-strip-row"}><input aria-label={`Show strip ${i + 1}`} type="checkbox" checked={strip.visible} onChange={e => commit(old => updateSurfaceStrip(old, strip.id, { visible: e.target.checked }))} /><button aria-label={`Select strip ${i + 1}`} aria-pressed={strip.id === s.selectedId} onClick={() => selectStrip(strip.id)}><b>{String(i + 1).padStart(2, "0")}</b><span>{mm(strip.lengthMm)} mm</span><small>{mm(strip.rotationDeg)}°</small></button></div>)}</div></section>
      </aside>
    </div><span hidden>{historyVersion}</span>
  </div>;
}
