import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GRID_MM = 12;

function buildIndex(doc) {
  const grid = new Map();
  const segments = [];
  const add = (segment) => {
    const id = segments.length;
    segments.push(segment);
    const minX = Math.floor(Math.min(segment.a[0], segment.b[0]) / GRID_MM);
    const maxX = Math.floor(Math.max(segment.a[0], segment.b[0]) / GRID_MM);
    const minY = Math.floor(Math.min(segment.a[1], segment.b[1]) / GRID_MM);
    const maxY = Math.floor(Math.max(segment.a[1], segment.b[1]) / GRID_MM);
    for (let gx = minX; gx <= maxX; gx += 1) for (let gy = minY; gy <= maxY; gy += 1) {
      const key = `${gx}:${gy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(id);
    }
  };
  for (const stroke of doc.strokes) {
    for (let i = 1; i < stroke.pts.length; i += 1) add({ a: stroke.pts[i - 1], b: stroke.pts[i], line: stroke.pointLines[i], stroke, pointIndex: i });
  }
  return { grid, segments };
}

function distanceToSegment(point, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = point[0] - a[0], wy = point[1] - a[1];
  const denom = vx * vx + vy * vy;
  const t = denom ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / denom)) : 0;
  return Math.hypot(point[0] - (a[0] + t * vx), point[1] - (a[1] + t * vy));
}

function fitView(doc, width, height) {
  const b = doc.bounds || { minX: 0, minY: 0, maxX: doc.meta.workW || 300, maxY: doc.meta.workH || 210 };
  const spanX = Math.max(1, b.maxX - b.minX), spanY = Math.max(1, b.maxY - b.minY);
  const scale = Math.max(.1, Math.min(64, Math.min((width - 72) / spanX, (height - 72) / spanY)));
  return { scale, ox: (width - spanX * scale) / 2 - b.minX * scale, oy: (height - spanY * scale) / 2 - b.minY * scale };
}

export default function CanvasView({ doc, viewResetKey, showTravels, yUp, hoveredLine, selectedLine, selectedStrokeIds, selectedPoints, boxSelecting, drawing, measuring, draftPoints, playback, onAddPoint, onInsertPoint, onHoverLine, onSelectLine, onSelectStrokes, onTranslate, onMovePoints, onCursor }) {
  const wrapRef = useRef(null);
  const staticRef = useRef(null);
  const overlayRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState(() => fitView(doc, 800, 600));
  const fittedKeyRef = useRef(null);
  const dragRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(null);
  const [boxRect, setBoxRect] = useState(null);
  const [measurement, setMeasurement] = useState(null);
  const index = useMemo(() => buildIndex(doc), [doc]);
  const selectedPointKeys = useMemo(() => new Set(selectedPoints.map((point) => `${point.strokeId}:${point.pointIndex}`)), [selectedPoints]);
  const playbackActive = !!playback?.active;

  const toScreen = useCallback((point) => [view.ox + point[0] * view.scale, yUp ? size.height - (view.oy + point[1] * view.scale) : view.oy + point[1] * view.scale], [view, yUp, size.height]);
  const toWorld = useCallback((point) => [(point[0] - view.ox) / view.scale, yUp ? ((size.height - point[1]) - view.oy) / view.scale : (point[1] - view.oy) / view.scale], [view, yUp, size.height]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!size.width || !size.height || fittedKeyRef.current === viewResetKey) return;
    fittedKeyRef.current = viewResetKey;
    setView(fitView(doc, size.width, size.height));
  }, [doc, size.width, size.height, viewResetKey]);
  useEffect(() => { if (!measuring) setMeasurement(null); }, [measuring]);

  useEffect(() => {
    const canvas = staticRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr)); canvas.height = Math.max(1, Math.round(size.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#11161b"; ctx.fillRect(0, 0, size.width, size.height);
    const rect = (x, y, w, h, color, dash = []) => {
      const a = toScreen([x, y]), b = toScreen([x + w, y + h]);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash(dash);
      ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    };
    if (doc.meta.workW && doc.meta.workH) rect(0, 0, doc.meta.workW, doc.meta.workH, "#34404a", [5, 5]);
    if (doc.meta.canvasW && doc.meta.canvasH) rect(doc.meta.originX || 0, doc.meta.originY || 0, doc.meta.canvasW, doc.meta.canvasH, "#64717c");
    if (showTravels) {
      ctx.strokeStyle = "rgba(139, 151, 163, .36)"; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
      ctx.beginPath();
      for (const travel of doc.travels) { const a = toScreen(travel.from), b = toScreen(travel.to); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = playbackActive ? .16 : 1;
    for (const stroke of doc.strokes) {
      if (stroke.pts.length < 2) continue;
      ctx.strokeStyle = stroke.color; ctx.lineWidth = playbackActive ? Math.max(1, (Number(playback.penWidths?.[stroke.penIndex]) || .3) * view.scale) : 1.4; ctx.beginPath();
      const start = toScreen(stroke.pts[0]); ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < stroke.pts.length; i += 1) { const point = toScreen(stroke.pts[i]); ctx.lineTo(point[0], point[1]); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.font = "13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const event of doc.events) {
      const point = toScreen([event.x, event.y]);
      ctx.fillStyle = "#202832"; ctx.strokeStyle = "#f4b860"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(point[0], point[1], 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f4b860"; ctx.fillText(event.kind === "dip" ? "•" : "Ⅱ", point[0], point[1]);
    }
  }, [doc, showTravels, view, size, toScreen, playback, playbackActive]);

  useEffect(() => {
    const canvas = overlayRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr)); canvas.height = Math.max(1, Math.round(size.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size.width, size.height);
    if (playbackActive) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const step of playback.timeline.steps) {
        if (step.kind !== "draw" || step.start >= playback.time) continue;
        const progress = step.duration ? Math.min(1, (playback.time - step.start) / step.duration) : 1;
        const end = [step.from[0] + (step.to[0] - step.from[0]) * progress, step.from[1] + (step.to[1] - step.from[1]) * progress];
        const a = toScreen(step.from), b = toScreen(end);
        ctx.strokeStyle = step.color; ctx.lineWidth = Math.max(1, (Number(playback.penWidths?.[step.penIndex]) || .3) * view.scale); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      const tool = playback.sample?.position;
      if (tool && Number.isFinite(tool[0]) && Number.isFinite(tool[1])) {
        const point = toScreen(tool); ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(point[0] - 9, point[1]); ctx.lineTo(point[0] + 9, point[1]); ctx.moveTo(point[0], point[1] - 9); ctx.lineTo(point[0], point[1] + 9); ctx.stroke();
        ctx.fillStyle = "#11161b"; ctx.beginPath(); ctx.arc(point[0], point[1], 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    for (const strokeId of selectedStrokeIds) {
      const stroke = doc.strokes[strokeId]; if (!stroke) continue;
      ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      stroke.pts.forEach((rawPoint, pointIndex) => {
        const movingPoint = dragOffset && selectedPointKeys.has(`${strokeId}:${pointIndex}`);
        const movingStroke = dragOffset && !selectedPoints.length;
        const point = movingPoint || movingStroke ? [rawPoint[0] + dragOffset[0], rawPoint[1] + dragOffset[1]] : rawPoint;
        const screen = toScreen(point); if (!pointIndex) ctx.moveTo(screen[0], screen[1]); else ctx.lineTo(screen[0], screen[1]);
      }); ctx.stroke();
      if (view.scale >= 1.5 || selectedPoints.length) for (let pointIndex = 0; pointIndex < stroke.pts.length; pointIndex += 1) {
        const rawPoint = stroke.pts[pointIndex]; const isSelected = selectedPointKeys.has(`${strokeId}:${pointIndex}`); const moving = dragOffset && isSelected;
        const screen = toScreen(moving ? [rawPoint[0] + dragOffset[0], rawPoint[1] + dragOffset[1]] : rawPoint);
        ctx.fillStyle = isSelected ? "#fff" : "#fbbf24";
        ctx.beginPath(); ctx.arc(screen[0], screen[1], isSelected ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (draftPoints.length) {
      ctx.strokeStyle = "#7dd3fc"; ctx.fillStyle = "#7dd3fc"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath();
      draftPoints.forEach((point, index) => { const screen = toScreen(point); if (!index) ctx.moveTo(screen[0], screen[1]); else ctx.lineTo(screen[0], screen[1]); }); ctx.stroke(); ctx.setLineDash([]);
      for (const point of draftPoints) { const screen = toScreen(point); ctx.beginPath(); ctx.arc(screen[0], screen[1], 3, 0, Math.PI * 2); ctx.fill(); }
    }
    if (boxRect) {
      ctx.fillStyle = "rgba(125, 211, 252, .08)"; ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.fillRect(Math.min(boxRect[0], boxRect[2]), Math.min(boxRect[1], boxRect[3]), Math.abs(boxRect[2] - boxRect[0]), Math.abs(boxRect[3] - boxRect[1]));
      ctx.strokeRect(Math.min(boxRect[0], boxRect[2]), Math.min(boxRect[1], boxRect[3]), Math.abs(boxRect[2] - boxRect[0]), Math.abs(boxRect[3] - boxRect[1])); ctx.setLineDash([]);
    }
    if (measuring && measurement) {
      const a = toScreen(measurement.a), b = toScreen(measurement.b);
      const dx = measurement.b[0] - measurement.a[0], dy = measurement.b[1] - measurement.a[1];
      const distance = Math.hypot(dx, dy);
      ctx.save(); ctx.strokeStyle = "#67e8f9"; ctx.fillStyle = "#67e8f9"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      for (const point of [a, b]) { ctx.beginPath(); ctx.arc(point[0], point[1], 4, 0, Math.PI * 2); ctx.fill(); }
      const label = `${distance.toFixed(2)} mm   ΔX ${dx.toFixed(2)}   ΔY ${dy.toFixed(2)}`;
      ctx.font = "600 11px SFMono-Regular, Consolas, monospace"; const width = ctx.measureText(label).width + 14;
      const x = Math.max(width / 2 + 5, Math.min(size.width - width / 2 - 5, (a[0] + b[0]) / 2));
      const y = Math.max(14, Math.min(size.height - 14, (a[1] + b[1]) / 2 - 14));
      ctx.fillStyle = "rgba(12, 20, 25, .94)"; ctx.strokeStyle = "#3e7881"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x - width / 2, y - 11, width, 22, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#a5f3fc"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x, y); ctx.restore();
    }
    const line = selectedLine ?? hoveredLine;
    const segment = line == null ? null : index.segments.find((item) => item.line === line);
    if (segment && !selectedStrokeIds.includes(segment.stroke.id)) {
      const a = toScreen(segment.a), b = toScreen(segment.b);
      ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const event = line == null ? null : doc.events.find((item) => line >= item.lineStart && line <= item.lineEnd);
    if (event) { const p = toScreen([event.x, event.y]); ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], 12, 0, Math.PI * 2); ctx.stroke(); }
  }, [hoveredLine, selectedLine, selectedStrokeIds, selectedPoints, selectedPointKeys, dragOffset, draftPoints, boxRect, measurement, measuring, doc, index, view, size, toScreen, playback, playbackActive]);

  const pointerPoint = (event) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const pick = (screen) => {
    const world = toWorld(screen); const radius = 8 / view.scale;
    const gx = Math.floor(world[0] / GRID_MM), gy = Math.floor(world[1] / GRID_MM);
    let best = null, bestDistance = radius, bestPoint = null, pointDistance = 7 / view.scale;
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      for (const id of index.grid.get(`${gx + dx}:${gy + dy}`) || []) {
        const segment = index.segments[id]; const distance = distanceToSegment(world, segment.a, segment.b);
        if (distance < bestDistance) { bestDistance = distance; best = segment; }
        const candidates = [[segment.pointIndex - 1, segment.a], [segment.pointIndex, segment.b]];
        for (const [pointIndex, point] of candidates) {
          const distancePoint = Math.hypot(world[0] - point[0], world[1] - point[1]);
          if (distancePoint < pointDistance) { pointDistance = distancePoint; bestPoint = { ...segment, pointIndex, line: segment.stroke.pointLines[pointIndex] }; }
        }
      }
    }
    if (bestPoint) return bestPoint;
    if (best) return best;
    const event = doc.events.find((item) => { const point = toScreen([item.x, item.y]); return Math.hypot(point[0] - screen[0], point[1] - screen[1]) <= 12; });
    return event ? { line: event.lineStart, event } : null;
  };
  const onPointerDown = (event) => {
    overlayRef.current.setPointerCapture(event.pointerId);
    const screen = pointerPoint(event); const hit = pick(screen);
    const pointSelected = hit?.stroke && selectedPointKeys.has(`${hit.stroke.id}:${hit.pointIndex}`);
    const worldStart = toWorld(screen);
    if (measuring) setMeasurement({ a: worldStart, b: worldStart });
    dragRef.current = { start: screen, worldStart, view, moved: false, mode: measuring ? "measure" : drawing ? "draw" : boxSelecting ? "box" : pointSelected ? "pointsMove" : hit?.stroke && selectedStrokeIds.includes(hit.stroke.id) ? "move" : "pan", hit };
  };
  const onPointerMove = (event) => {
    const point = pointerPoint(event); const world = toWorld(point); onCursor(world);
    if (dragRef.current && event.buttons) {
      const dx = point[0] - dragRef.current.start[0], rawDy = point[1] - dragRef.current.start[1];
      if (Math.hypot(dx, rawDy) > 3) dragRef.current.moved = true;
      if (dragRef.current.mode === "measure") { setMeasurement({ a: dragRef.current.worldStart, b: world }); return; }
      if (dragRef.current.mode === "draw") return;
      if (dragRef.current.mode === "box") { setBoxRect([dragRef.current.start[0], dragRef.current.start[1], point[0], point[1]]); return; }
      if (dragRef.current.mode === "move" || dragRef.current.mode === "pointsMove") {
        const current = toWorld(point); setDragOffset([current[0] - dragRef.current.worldStart[0], current[1] - dragRef.current.worldStart[1]]); return;
      }
      const dy = yUp ? -rawDy : rawDy;
      setView({ ...dragRef.current.view, ox: dragRef.current.view.ox + dx, oy: dragRef.current.view.oy + dy });
      return;
    }
    onHoverLine(pick(point)?.line ?? null);
  };
  const onPointerUp = (event) => {
    const drag = dragRef.current; dragRef.current = null;
    if (drag?.mode === "measure") { setMeasurement({ a: drag.worldStart, b: toWorld(pointerPoint(event)) }); return; }
    if (drag?.mode === "draw") { if (!drag.moved) onAddPoint(toWorld(pointerPoint(event))); return; }
    if (drag?.mode === "box") {
      const end = pointerPoint(event), a = toWorld(drag.start), b = toWorld(end);
      const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]), minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
      const ids = doc.strokes.filter((stroke) => stroke.pts.some((point) => point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY)).map((stroke) => stroke.id);
      onSelectStrokes(ids, event.shiftKey); setBoxRect(null); return;
    }
    if ((drag?.mode === "move" || drag?.mode === "pointsMove") && drag.moved && dragOffset) {
      const step = event.shiftKey ? 1 : .1;
      const dx = Math.round(dragOffset[0] / step) * step, dy = Math.round(dragOffset[1] / step) * step;
      if (drag.mode === "pointsMove") onMovePoints(dx, dy); else onTranslate(dx, dy);
      setDragOffset(null); return;
    }
    setDragOffset(null);
    if (drag && !drag.moved) { const hit = pick(pointerPoint(event)); onSelectLine(hit?.line ?? null, { additive: event.shiftKey, point: hit?.stroke && hit.pointIndex != null ? { strokeId: hit.stroke.id, pointIndex: hit.pointIndex } : null }); }
  };
  const onWheel = (event) => {
    event.preventDefault(); const point = pointerPoint(event); const before = toWorld(point);
    const scale = Math.max(.1, Math.min(64, view.scale * Math.exp(-event.deltaY * .0015)));
    const screenY = yUp ? size.height - point[1] : point[1];
    setView({ scale, ox: point[0] - before[0] * scale, oy: screenY - before[1] * scale });
  };

  const zoomAtCenter = (factor) => {
    const point = [size.width / 2, size.height / 2], before = toWorld(point);
    const scale = Math.max(.1, Math.min(64, view.scale * factor));
    const screenY = yUp ? size.height - point[1] : point[1];
    setView({ scale, ox: point[0] - before[0] * scale, oy: screenY - before[1] * scale });
  };

  const onDoubleClick = (event) => {
    if (drawing || measuring) return;
    const screen = pointerPoint(event), hit = pick(screen);
    if (hit?.stroke) onInsertPoint(hit.stroke.id, hit.line, toWorld(screen));
    else setView(fitView(doc, size.width, size.height));
  };
  return <div className={`canvas-view${drawing ? " drawing" : ""}${measuring ? " measuring" : ""}`} ref={wrapRef} onDoubleClick={onDoubleClick}>
    <canvas ref={staticRef} />
    <canvas ref={overlayRef} className="overlay" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => { onHoverLine(null); onCursor(null); }} onWheel={onWheel} />
    <div className="canvas-controls"><button aria-label="Zoom out" title="Zoom out" onClick={() => zoomAtCenter(1 / 1.5)}>−</button><span>{view.scale.toFixed(view.scale < 10 ? 1 : 0)} px/mm</span><button aria-label="Zoom in" title="Zoom in" onClick={() => zoomAtCenter(1.5)}>＋</button><button title="Fit drawing" onClick={() => setView(fitView(doc, size.width, size.height))}>Fit</button></div>
  </div>;
}
