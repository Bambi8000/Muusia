import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { buildLayout, framesOnSheet } from './layout';
import type { SheetSettings } from './layout';
import { registrationTransform } from './homography';
import type { Point, Quad } from './homography';
import { sampleRect } from './sampling';
import { emptyPoints } from './photos';
import type { Photo, MarkerPoints } from './photos';
import { detectionSettingsKey } from './detection-client';

const NAMES = ['Top-left · hole', 'Top-right', 'Bottom-right', 'Bottom-left'];
const SHORT = ['TL', 'TR', 'BR', 'BL'];
const COLORS = ['#d47527', '#447bc3', '#945aa1', '#478567'];
type Props = { photo: Photo; settings: SheetSettings; sheet: number; setPoints: (id: string, points: MarkerPoints) => void; detect: (id: string, settings: SheetSettings) => Promise<void>; undoDetection: (id: string) => void };

export default function RegistrationStep({ photo, settings, sheet, setPoints, detect, undoDetection }: Props) {
  const [active, setActive] = useState(() => Math.max(0, photo.points.findIndex(p => !p)));
  const [showGuides, setShowGuides] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(false);
  const [rendered, setRendered] = useState<{ key: string; url: string } | null>(null);
  const [renderError, setRenderError] = useState('');
  const drag = useRef<{ index: number; dx: number; dy: number; pointerId: number } | null>(null);
  const pointsRef = useRef(photo.points);
  pointsRef.current = photo.points;
  const count = photo.points.filter(Boolean).length;
  const registration = useMemo(() => {
    if (photo.points.some(p => !p)) return { h: null, error: '' };
    try { return { h: registrationTransform(settings.W, settings.H, photo.points as Quad), error: '' }; }
    catch (error) { return { h: null, error: error instanceof Error ? error.message : 'Check the marker positions.' }; }
  }, [photo.points, settings.W, settings.H]);
  const key = JSON.stringify([photo.id, settings.W, settings.H, photo.points]);
  useEffect(() => {
    setRenderError('');
    if (!registration.h) return;
    const h = registration.h;
    const timer = window.setTimeout(() => {
      try {
        const factor = 900 / Math.max(settings.W, settings.H);
        const raster = sampleRect(photo.working, { width: photo.width, height: photo.height }, h, { x: 0, y: 0, w: settings.W, h: settings.H }, Math.max(1, Math.round(settings.W * factor)), Math.max(1, Math.round(settings.H * factor)));
        const canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Preview is unavailable in this browser.');
        const data = context.createImageData(raster.width, raster.height); data.data.set(raster.data);
        context.putImageData(data, 0, 0);
        setRendered({ key, url: canvas.toDataURL('image/jpeg', .95) });
      } catch (error) { setRenderError(error instanceof Error ? error.message : 'Could not create the preview.'); }
    }, 90);
    return () => clearTimeout(timer);
  }, [key, registration.h, photo.working, photo.width, photo.height, settings.W, settings.H]);

  function place(index: number, p: Point) {
    const next = [...pointsRef.current] as MarkerPoints;
    next[index] = { x: Math.max(0, Math.min(photo.width, p.x)), y: Math.max(0, Math.min(photo.height, p.y)) };
    pointsRef.current = next; setPoints(photo.id, next);
  }
  function imagePoint(event: ReactPointerEvent<SVGSVGElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * photo.width, y: (event.clientY - box.top) / box.height * photo.height };
  }
  function nudge(dx: number, dy: number) {
    const p = pointsRef.current[active]; if (p) place(active, { x: p.x + dx, y: p.y + dy });
  }
  const selected = photo.points[active];
  const layout = buildLayout(settings);
  const frames = framesOnSheet(settings, sheet);
  const radius = photo.width * .018;
  const loupeSide = photo.width * .14;
  const currentPreview = rendered?.key === key ? rendered.url : null;
  const rProps = (q: { x: number; y: number; w: number; h: number }) => ({ x: q.x, y: q.y, width: q.w, height: q.h });
  return <>
    <div className="detection-bar"><div><strong>{photo.detection?.status === 'found' ? 'Markers found automatically' : photo.detection?.status === 'running' ? 'Finding the corner markers…' : 'Automatic marker detection'}</strong><p role="status">{photo.detection?.settingsKey && photo.detection.settingsKey !== detectionSettingsKey(settings) ? 'Sheet dimensions or marker size changed. Check the positions or run detection again.' : photo.detection?.message ?? 'Find all four markers, then check the frame windows below.'}</p></div><div className="detection-actions"><button className="secondary" disabled={photo.detection?.status === 'running'} onClick={() => { void detect(photo.id, settings); }}>Detect markers</button>{photo.previousPoints && <button className="secondary" onClick={() => undoDetection(photo.id)}>Undo auto placement</button>}</div></div>
    <div className="marker-steps" aria-label="Select marker">{NAMES.map((name, i) => <button key={name} aria-pressed={active === i} className={active === i ? 'selected' : ''} onClick={() => setActive(i)}><span style={{ background: COLORS[i] }}>{i + 1}</span><strong>{name}</strong><small>{photo.points[i] ? 'Placed' : 'Tap to place'}</small></button>)}</div>
    <p className="placement-hint" role="status">{count < 4 ? `Select ${NAMES[active]!.toLowerCase()} and tap its center in the photo. Start at the white hole, then go clockwise.` : 'All four markers placed. Drag a handle or select a marker and fine-tune its center.'}</p>
    <div className="registration-grid">
      <section aria-label="Original photo" className="registration-panel">
        <div className="preview-heading"><div><p className="eyebrow">Original photograph</p><h2>Place the four centers</h2></div><label className="field zoom-field"><span>Zoom</span><select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={1}>Fit</option><option value={2}>2×</option><option value={3}>3×</option></select></label></div>
        {zoom > 1 && <label className="checkbox pan-control"><input type="checkbox" checked={pan} onChange={e => setPan(e.target.checked)} />Pan view · turn off to place markers</label>}
        <div className="photo-scroll"><svg className="photo-placement" style={{ width: zoom === 1 ? `min(100%, ${600 * photo.width / photo.height}px)` : `${zoom * 100}%`, touchAction: zoom > 1 && pan ? 'pan-x pan-y' : 'none' }} viewBox={`0 0 ${photo.width} ${photo.height}`} role="group" aria-label="Place markers on photo" onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary || (zoom > 1 && pan)) return;
          const target = event.target as Element;
          const handle = target.closest('[data-marker]');
          const index = handle ? Number(handle.getAttribute('data-marker')) : active;
          const p = imagePoint(event), existing = pointsRef.current[index];
          const offset = handle && existing ? { dx: existing.x - p.x, dy: existing.y - p.y } : { dx: 0, dy: 0 };
          drag.current = { index, ...offset, pointerId: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId); setActive(index);
          if (!handle) place(index, p);
        }} onPointerMove={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          const p = imagePoint(event), d = drag.current;
          place(d.index, { x: p.x + d.dx, y: p.y + d.dy });
        }} onPointerUp={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          if (drag.current) {
            const next = pointsRef.current.findIndex(p => !p);
            if (next >= 0) setActive(next);
          }
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
          <image href={photo.url} width={photo.width} height={photo.height} />
          {registration.h && <polygon className="registration-quad" points={photo.points.map(p => `${p!.x},${p!.y}`).join(' ')} />}
          {photo.points.map((p, i) => p && <g key={i} data-marker={i} tabIndex={0} role="button" aria-label={`Move ${NAMES[i]} marker`} onFocus={() => setActive(i)} onKeyDown={e => {
            const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            const direction = directions[e.key];
            if (direction) { e.preventDefault(); const step = e.shiftKey ? 10 : 1; place(i, { x: p.x + direction[0] * step, y: p.y + direction[1] * step }); }
          }}>
            <circle cx={p.x} cy={p.y} r={radius * 3.5 / zoom} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={radius / zoom} fill={COLORS[i]} stroke="#fff" strokeWidth={radius * .17 / zoom} />
            <path d={`M${p.x - radius * 1.7 / zoom},${p.y}h${radius * 3.4 / zoom}M${p.x},${p.y - radius * 1.7 / zoom}v${radius * 3.4 / zoom}`} stroke="#fff" strokeWidth={radius * .1 / zoom} pointerEvents="none" />
            <text x={p.x + radius * 1.8 / zoom} y={p.y - radius * 1.2 / zoom} fontSize={radius * 1.5 / zoom} fill="#fff" stroke="#29362b" paintOrder="stroke" strokeWidth={radius * .12 / zoom}>{i + 1} {SHORT[i]}</text>
          </g>)}
        </svg></div>
        <div className="fine-tune">
          {selected ? <>
            <svg className="loupe" viewBox={`${selected.x - loupeSide / 2} ${selected.y - loupeSide / 2} ${loupeSide} ${loupeSide}`} role="img" aria-label={`Magnified ${NAMES[active]} marker`}><image href={photo.url} width={photo.width} height={photo.height} /><path d={`M${selected.x - loupeSide / 2},${selected.y}h${loupeSide}M${selected.x},${selected.y - loupeSide / 2}v${loupeSide}`} stroke={COLORS[active]} strokeWidth={loupeSide / 130} /></svg>
            <div><p className="eyebrow">Fine-tune {SHORT[active]}</p><div className="coordinate-fields"><label className="field"><span>X · photo px</span><input type="number" min={0} max={photo.width} step={.1} value={Number(selected.x.toFixed(1))} onChange={e => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) place(active, { ...selected, x: e.target.valueAsNumber }); }} /></label><label className="field"><span>Y · photo px</span><input type="number" min={0} max={photo.height} step={.1} value={Number(selected.y.toFixed(1))} onChange={e => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) place(active, { ...selected, y: e.target.valueAsNumber }); }} /></label></div><div className="nudge-buttons">{([['←', -1, 0, 'left'], ['↑', 0, -1, 'up'], ['↓', 0, 1, 'down'], ['→', 1, 0, 'right']] as const).map(([symbol, dx, dy, name]) => <button className="icon-button" key={name} aria-label={`Nudge marker ${name}`} onClick={() => nudge(dx, dy)}>{symbol}</button>)}</div></div>
          </> : <p className="hint">Tap a marker to see a magnified view here. Place centers, not square corners.</p>}
        </div>
        <button className="secondary" onClick={() => { pointsRef.current = emptyPoints(); setPoints(photo.id, pointsRef.current); setActive(0); }}>Clear marker positions</button>
      </section>
      <section aria-label="Rectified preview" className="registration-panel">
        <div className="preview-heading"><div><p className="eyebrow">Straightened sheet</p><h2>Check every frame</h2></div><label className="checkbox"><input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} />Show guides</label></div>
        {registration.error || renderError ? <p className="error" role="alert">{registration.error || renderError}</p> : currentPreview && registration.h ? <div className="rectified-stage"><svg viewBox={`0 0 ${settings.W} ${settings.H}`} className="rectified-sheet" role="img" aria-label={`Rectified sheet ${sheet + 1} with ${frames.length} frame windows`}><image href={currentPreview} width={settings.W} height={settings.H} />
          {showGuides && <>{layout.cells.map(({ index, cell }) => <rect key={index} {...rProps(cell)} className="cell-guide" />)}{frames.map(f => <g key={f.frame}><rect {...rProps(f.window)} className="photo-window" />{(settings.crop === 'Full cell' || settings.pad > 0) && <rect {...rProps(f.crop)} className="crop-guide" />}<text x={f.window.x + 1.5} y={f.window.y + 5} fontSize={4} fill="#365b26" stroke="#fff" paintOrder="stroke" strokeWidth={.7}>{f.frame + 1}</text></g>)}</>}
        </svg></div> : <div className="preview-placeholder" role="status"><span aria-hidden="true">⌗</span><h2>{count === 4 ? 'Updating preview…' : `${count} of 4 markers placed`}</h2><p>The straightened sheet appears once all four centers are placed.</p></div>}
        <p className="hint preview-note">Check that every drawing sits inside its green frame window. Dashed lines show full cells. The photo supplies the artwork; the sheet settings supply the geometry.</p>
        {registration.h && <p className="hint">The hole should be at the top-left here. If the orientation is wrong, check which marker you labeled TL.</p>}
        <div className="reference registration-note"><div><strong>Always check the result</strong><p>Drag or place markers manually if detection is uncertain. All positions stay available for this session. Original resolution is kept for frame extraction.</p></div></div>
      </section>
    </div>
  </>;
}
