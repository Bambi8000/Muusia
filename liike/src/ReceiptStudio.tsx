import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { loadPhoto, disposePhoto } from './photos';
import type { Photo } from './photos';
import type { Quad } from './homography';
import { detectReceiptMarks, readReceiptNumber, receiptFullExtent, receiptHeight, receiptTransform, sampleReceipt } from './receipt-marks';
import { detectLargeReceipt, readLargeReceiptNumber } from './receipt-detection';
import type { ExtractedFrame } from './frames';
import { releaseFrames } from './frames';
import CameraCapture from './CameraCapture';
import ExportStep from './ExportStep';
import { DEFAULT_EXPORT } from './export-plan';
import { INITIAL_SEQUENCE, timelineFrames } from './sequence';
import type { SequenceSettings } from './sequence';

type ReceiptPhoto = { photo: Photo; points: Quad | null; placed: [boolean, boolean, boolean, boolean]; number: number | null; message: string };
type Look = 'artwork' | 'surroundings';
const labels = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];
const numberFromName = (name: string) => {
  const match = name.match(/(?:^|[\s_-])f(?:rame)?[\s_-]*0*([1-9]\d{0,2})(?=[\s_.-]|$)/i);
  return match ? Number(match[1]) : null;
};
const readPrintedNumber = (photo: Photo, points: Quad, total: number) => {
  const modern = readLargeReceiptNumber(photo.working, points);
  return modern.status === 'found' ? modern.value! : readReceiptNumber(photo.working, points, total);
};
const findReceipt = (raster: Photo['working'], total: number) => {
  const modern = detectLargeReceipt(raster);
  if (modern.status === 'found' && modern.points) return { points: modern.points, number: modern.number?.status === 'found' ? modern.number.value! : null, modern: true };
  const points = detectReceiptMarks(raster);
  return points ? { points, number: readReceiptNumber(raster, points, total), modern: false } : null;
};

export default function ReceiptStudio() {
  const [photos, setPhotos] = useState<ReceiptPhoto[]>([]);
  const [selected, setSelected] = useState(0);
  const [corner, setCorner] = useState(0);
  const [total, setTotal] = useState(1);
  const [look, setLook] = useState<Look>('artwork');
  const [resolution, setResolution] = useState(1080);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [sequence, setSequence] = useState<SequenceSettings>({ ...INITIAL_SEQUENCE, order: 'Frame number' });
  const [options, setOptions] = useState(DEFAULT_EXPORT);
  const [view, setView] = useState<'prepare' | 'preview' | 'export'>('prepare');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const current = photos[selected];
  const previous = photos.at(-1);
  const photosRef = useRef(photos), framesRef = useRef(frames), generation = useRef(0);
  photosRef.current = photos; framesRef.current = frames;
  useEffect(() => () => { generation.current++; photosRef.current.forEach(p => disposePhoto(p.photo)); releaseFrames(framesRef.current); }, []);
  useEffect(() => { generation.current++; if (framesRef.current.length) { releaseFrames(framesRef.current); framesRef.current = []; setFrames([]); setView('prepare'); setPlaying(false); } }, [photos, look, resolution]);
  const ordered = timelineFrames(frames, sequence);
  useEffect(() => {
    if (!playing || !ordered.length) return;
    const timer = window.setInterval(() => setPosition(i => (i + 1) % ordered.length), 1000 / sequence.fps);
    return () => window.clearInterval(timer);
  }, [playing, ordered.length, sequence.fps]);
  const shown = ordered[Math.min(position, ordered.length - 1)];

  function updatePhoto(index: number, patch: Partial<ReceiptPhoto>) {
    setPhotos(list => list.map((item, i) => i === index ? { ...item, ...patch } : item));
  }
  async function add(files: FileList | File[]) {
    const images = Array.from(files);
    if (!images.length) return;
    setBusy(true); setError('');
    const loaded: ReceiptPhoto[] = [];
    const expected = Math.max(total, photosRef.current.length + images.length);
    try {
      for (const file of images) {
        const photo = await loadPhoto(file);
        const working = photo.working;
        const found = findReceipt(working, expected);
        const points = found?.points.map(p => ({ x: p.x * photo.width / working.width, y: p.y * photo.height / working.height })) as Quad | undefined;
        loaded.push({ photo, points: points ?? null, placed: [Boolean(points), Boolean(points), Boolean(points), Boolean(points)], number: found?.number ?? numberFromName(file.name), message: points ? found?.modern ? `Large L marks found${found.number ? `; frame ${found.number} read` : ''}. Check all four corners and the number.` : 'Older receipt marks found. Check all four corners and the number.' : 'Marks were unclear. Place the four corners on the photo.' });
      }
      setPhotos(list => [...list, ...loaded]);
      setTotal(expected); setSelected(photosRef.current.length);
    } catch (cause) {
      loaded.forEach(item => disposePhoto(item.photo));
      setError(cause instanceof Error ? cause.message : 'The photos could not be opened.');
    } finally { setBusy(false); }
  }
  function detect(index: number) {
    const item = photos[index]; if (!item) return;
    const found = findReceipt(item.photo.working, total);
    const points = found?.points.map(p => ({ x: p.x * item.photo.width / item.photo.working.width, y: p.y * item.photo.height / item.photo.working.height })) as Quad | undefined;
    const readingPoints = found?.points ?? (item.points && item.placed.every(Boolean) ? item.points.map(p => ({ x: p.x * item.photo.working.width / item.photo.width, y: p.y * item.photo.working.height / item.photo.height })) as Quad : null);
    let number: number | null = null;
    if (readingPoints) try { number = found?.number ?? readPrintedNumber(item.photo, readingPoints, total); } catch { /* Keep manual coordinates and number. */ }
    updatePhoto(index, { points: points ?? item.points, placed: points ? [true, true, true, true] : item.placed, number: number ?? item.number, message: points ? found?.modern ? 'Large L marks found. Check the corners and number.' : 'Older receipt marks found. Check the corners and number.' : 'Automatic detection was uncertain. Place the four corners.' });
  }
  function place(event: MouseEvent<SVGSVGElement>) {
    if (!current) return;
    const svg = event.currentTarget, matrix = svg.getScreenCTM(); if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const old = current.points ?? [{ x: 0, y: 0 }, { x: current.photo.width, y: 0 }, { x: current.photo.width, y: current.photo.height }, { x: 0, y: current.photo.height }] as Quad;
    const next = [...old] as Quad; next[corner] = { x: Math.max(0, Math.min(current.photo.width, p.x)), y: Math.max(0, Math.min(current.photo.height, p.y)) };
    const placed = [...current.placed] as ReceiptPhoto['placed']; placed[corner] = true;
    let number = current.number;
    if (placed.every(Boolean)) {
      const workingPoints = next.map(q => ({ x: q.x * current.photo.working.width / current.photo.width, y: q.y * current.photo.working.height / current.photo.height })) as Quad;
      try { number = readPrintedNumber(current.photo, workingPoints, total) ?? number; } catch { /* Manual number entry remains available. */ }
    }
    updatePhoto(selected, { points: next, placed, number, message: `${placed.filter(Boolean).length} of 4 corners placed. Check the outline before building.` });
    setCorner((corner + 1) % 4);
  }
  function remove(index: number) {
    const item = photos[index]; if (!item) return;
    disposePhoto(item.photo); setPhotos(list => list.filter((_, i) => i !== index)); setSelected(Math.max(0, Math.min(selected, photos.length - 2)));
  }
  async function build() {
    setError(''); setPlaying(false);
    if (!photos.length) { setError('Add at least one receipt photo.'); return; }
    if (photos.some(p => !p.points || !p.placed.every(Boolean))) { setError('Find or place all four marks on every receipt.'); return; }
    const numbers = photos.map(p => p.number);
    if (numbers.some(n => n === null || !Number.isInteger(n) || n < 1 || n > 999) || new Set(numbers).size !== numbers.length) { setError('Give each receipt a unique frame number. Check the printed F labels and correct any unreadable numbers.'); return; }
    const heights = photos.map(p => receiptHeight(p.points!)).sort((a, b) => a - b), height = heights[Math.floor(heights.length / 2)]!;
    let rect = { x: 0, y: 0, w: 512, h: height };
    if (look === 'surroundings') {
      const extents = photos.map(p => receiptFullExtent(p.points!, height, p.photo.width, p.photo.height));
      const rx = Math.max(...extents.map(e => e.w / 2)), ry = Math.max(...extents.map(e => e.h / 2));
      rect = { x: 256 - rx, y: height / 2 - ry, w: 2 * rx, h: 2 * ry };
      if (rect.w > 512 * 8 || rect.h > height * 8) { setError('A mark position makes the surrounding canvas too large. Check the four corners.'); return; }
    }
    const scale = resolution / Math.max(rect.w, rect.h), width = Math.max(1, Math.round(rect.w * scale)), outputHeight = Math.max(1, Math.round(rect.h * scale));
    const run = ++generation.current;
    releaseFrames(framesRef.current); framesRef.current = []; setFrames([]); setBusy(true);
    const produced: ExtractedFrame[] = [];
    try {
      for (let i = 0; i < photos.length; i++) {
        if (run !== generation.current) throw new Error('Animation build was cancelled.');
        const item = photos[i]!, bitmap = await createImageBitmap(item.photo.file, { imageOrientation: 'from-image' });
        try {
          const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = bitmap.width; sourceCanvas.height = bitmap.height;
          const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true }); if (!sourceContext) throw new Error('Image processing is unavailable.');
          sourceContext.drawImage(bitmap, 0, 0);
          const source = sourceContext.getImageData(0, 0, bitmap.width, bitmap.height);
          const raster = sampleReceipt(source, receiptTransform(item.points!, height, look === 'surroundings'), rect, width, outputHeight, look === 'surroundings');
          sourceCanvas.width = sourceCanvas.height = 1;
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = outputHeight;
          const context = canvas.getContext('2d'); if (!context) throw new Error('Frame rendering is unavailable.');
          const image = context.createImageData(width, outputHeight); image.data.set(raster.data); context.putImageData(image, 0, 0);
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not make a frame image.')), 'image/png'));
          const url = URL.createObjectURL(blob);
          const frame: ExtractedFrame = { id: `${item.photo.id}:0`, photoId: item.photo.id, sheet: i, frame: i, cell: 0, crop: rect, width, height: outputHeight, captureMode: 'frames', frameNumber: item.number!, paperTone: 'light', url, thumbnailUrl: url };
          produced.push(frame);
          canvas.width = canvas.height = 1;
        } finally { bitmap.close(); }
      }
      if (run !== generation.current) throw new Error('Animation build was cancelled.');
      setFrames(produced); setView('preview'); setPosition(0);
    } catch (cause) { releaseFrames(produced); setError(cause instanceof Error ? cause.message : 'Could not build the animation.'); }
    finally { setBusy(false); }
  }

  return <main className="receipt-studio">
    <header><a className="wordmark" href="#">Liike<span>↗</span></a><a className="secondary" href="#">← Sheet animation</a></header>
    <section className="intro"><div><p className="eyebrow">Receipt animation</p><h1>From receipt <em>to motion.</em></h1><p>Photograph each printed Muusia frame. Liike reads the large L marks and frame number on new receipts, then aligns the sequence. Older receipts can still be checked and corrected by hand. Your photos stay on this device.</p></div></section>
    <div className="receipt-tabs"><button className={view === 'prepare' ? 'selected' : ''} onClick={() => setView('prepare')}>1 · Prepare photos</button><button className={view === 'preview' ? 'selected' : ''} disabled={!frames.length} onClick={() => setView('preview')}>2 · Preview</button><button className={view === 'export' ? 'selected' : ''} disabled={!frames.length} onClick={() => setView('export')}>3 · Export</button></div>
    {view === 'prepare' && <>
      <div className="receipt-settings">
        <label className="field"><span>Add receipt photographs</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e => { void add(e.target.files ?? []); e.target.value = ''; }} /></label>
        <label className="field"><span>Printed total on labels</span><input type="number" min={1} max={999} value={total} onChange={e => setTotal(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} /></label>
        <button className="secondary" disabled={busy || !photos.length} onClick={() => photos.forEach((_, i) => detect(i))}>Read marks and numbers again</button>
        <fieldset><legend>Animation image</legend><label className="checkbox"><input type="radio" name="receipt-look" checked={look === 'artwork'} onChange={() => setLook('artwork')} />Artwork only · crop to marks</label><label className="checkbox"><input type="radio" name="receipt-look" checked={look === 'surroundings'} onChange={() => setLook('surroundings')} />Full photo · center the marked frame</label><p className="hint">Full photo keeps the receipt and changing surroundings visible. The marked frame stays in the same place while the background moves. New number strips support up to 999 frames; older tiny labels can be entered manually above 99.</p></fieldset>
        <label className="field"><span>Output size</span><select value={resolution} onChange={e => setResolution(Number(e.target.value))}><option value={480}>480 px</option><option value={720}>720 px</option><option value={1080}>1080 px</option><option value={2160}>2160 px</option></select></label>
      </div>
      <CameraCapture previous={previous ? { name: previous.photo.name, url: previous.photo.url, width: previous.photo.width, height: previous.photo.height, points: previous.placed.every(Boolean) ? previous.points : null } : undefined} busy={busy} onCapture={file => add([file])} />
      {photos.length > 0 && <div className="receipt-workspace">
        <section className="receipt-list" aria-label="Receipt photos"><h2>{photos.length} receipt photos</h2>{photos.map((item, i) => <button key={item.photo.id} className={selected === i ? 'selected' : ''} onClick={() => setSelected(i)}><img src={item.photo.url} alt="" /><span><strong>Frame {item.number ?? '?'}</strong><small>{item.photo.name}</small><small>{item.placed.filter(Boolean).length} / 4 marks placed</small></span></button>)}</section>
        {current && <section className="receipt-register"><div className="preview-heading"><div><p className="eyebrow">Register receipt {selected + 1}</p><h2>Check the four marks</h2></div><button className="secondary" onClick={() => remove(selected)}>Remove photo</button></div>
          <p className="hint">Select a corner, then tap the inner intersection of its L mark in the photo. The frame number can be corrected below.</p>
          <div className="receipt-corner-buttons">{labels.map((label, i) => <button key={label} className={corner === i ? 'selected' : ''} onClick={() => setCorner(i)}>{label}</button>)}</div>
          <svg viewBox={`0 0 ${current.photo.width} ${current.photo.height}`} onClick={place} role="img" aria-label="Receipt photo. Tap to place selected corner marker"><image href={current.photo.url} width={current.photo.width} height={current.photo.height} />{current.points && <>{current.placed.every(Boolean) && <polygon points={current.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#79e35b" strokeWidth={Math.max(2, current.photo.width / 350)} />}{current.points.map((p, i) => current.placed[i] && <g key={i}><circle cx={p.x} cy={p.y} r={Math.max(6, current.photo.width / 90)} fill="#fff" stroke="#3b6a28" strokeWidth={Math.max(2, current.photo.width / 400)} /><text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(9, current.photo.width / 60)} fill="#243b1b">{i + 1}</text></g>)}</>}</svg>
          <p className="notice" role="status">{current.message}</p><div className="receipt-number"><label className="field"><span>Frame number on receipt</span><input type="number" min={1} max={999} value={current.number ?? ''} onChange={e => updatePhoto(selected, { number: e.target.value ? Number(e.target.value) : null })} /></label><button className="secondary" onClick={() => detect(selected)}>Detect again</button></div>
        </section>}
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="step-actions"><p className="hint">Use one photo per printed frame. Unclear marks and numbers can be placed by hand.</p><button className="primary" disabled={busy || !photos.length} onClick={() => { void build(); }}>{busy ? 'Building animation…' : 'Build animation →'}</button></div>
    </>}
    {view === 'preview' && <><section className="intro"><div><p className="eyebrow">Animation preview</p><h1>Watch it <em>move.</em></h1><p>{look === 'surroundings' ? 'The whole photo stays visible and the receipt frame remains centered.' : 'The artwork is straightened and cropped to its four marks.'}</p></div></section><div className="receipt-player">{shown && <img src={shown.url} alt={`Frame ${shown.frameNumber}`} />}<div className="playback-controls"><button className="secondary" onClick={() => setPosition(Math.max(0, position - 1))}>← Previous</button><button className="primary" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button><button className="secondary" onClick={() => setPosition((position + 1) % ordered.length)}>Next →</button></div><label className="field"><span>Frame {position + 1} / {ordered.length} · {sequence.fps} fps</span><input type="range" min={0} max={Math.max(0, ordered.length - 1)} value={position} onChange={e => { setPlaying(false); setPosition(Number(e.target.value)); }} /></label><label className="field"><span>Speed</span><input type="range" min={1} max={30} value={sequence.fps} onChange={e => setSequence({ ...sequence, fps: Number(e.target.value) })} /></label></div><div className="step-actions"><button className="secondary" onClick={() => setView('prepare')}>← Edit photos</button><button className="primary" onClick={() => setView('export')}>Export animation →</button></div></>}
    {view === 'export' && <ExportStep frames={frames} sequence={sequence} setSequence={setSequence} options={options} setOptions={setOptions} onBack={() => setView('preview')} />}
    <footer><span>Photos stay on your device.</span><span>Made for Muusia's numbered thermal receipt frames.</span></footer>
  </main>;
}
