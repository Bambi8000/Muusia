import { useRef, useState } from 'react';
import type { usePhotos } from './usePhotos';
import type { SheetSettings } from './layout';

type Props = { library: ReturnType<typeof usePhotos>; sheets: number; settings: SheetSettings; onBack: () => void; onRegister: (index: number) => void };
export default function PhotosStep({ library, sheets, settings, onBack, onRegister }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const replace = useRef<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const { photos, busy, errors, add, remove, move } = library;
  const remaining = sheets - photos.length;
  return <>
    <section className="intro"><div><p className="eyebrow">02 / Add your photographs</p><h1>Bring in <em>the ink.</em></h1><p>Add one photo per sheet, in sheet order. Keep all four markers visible. Photos stay on your device.</p></div></section>
    <input ref={input} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,.heic,.heif" multiple={!replace.current} onChange={e => {
      const files = Array.from(e.target.files ?? []); const id = replace.current;
      e.target.value = ''; replace.current = undefined;
      void add(files, id, settings);
    }} />
    <div className={`photo-drop ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => {
      e.preventDefault(); setDragging(false); if (!busy) void add(Array.from(e.dataTransfer.files), undefined, settings);
    }}>
      <span className="drop-symbol" aria-hidden="true">＋</span><h2>One sheet, one photograph</h2><p>Drop photos here, or choose them from your device.</p>
      <button className="primary" disabled={busy} onClick={() => { replace.current = undefined; if (input.current) { input.current.multiple = true; input.current.click(); } }}>{busy ? 'Opening photos & finding markers…' : 'Choose photos'}</button><small>JPEG · PNG · WebP</small>
    </div>
    <div className="photo-count" role="status"><strong>{photos.length} / {sheets} photos</strong><span>{remaining > 0 ? `Add ${remaining} more ${remaining === 1 ? 'photo' : 'photos'} for the complete sequence. You can place markers on the photos already added.` : remaining < 0 ? `You can place markers on every photo. Only the first ${sheets === 1 ? 'photo is' : `${sheets} photos are`} used in the sequence. Increase Total frames in Sheet or reorder photos to include the others.` : 'All sheets have a photo. Review or place their markers manually.'}</span></div>
    {errors.length > 0 && <div className="error" role="alert">{errors.map((error, i) => <p key={i}>{error}</p>)}</div>}
    <ol className="photo-list">{photos.map((photo, i) => <li key={photo.id}>
      <img src={photo.url} alt={`Sheet ${i + 1}: ${photo.name}`} />
      <div className="photo-details"><p className="eyebrow">Sheet {i + 1}{i >= sheets ? ' · extra photo' : ''}</p><h2>{photo.name}</h2><p>{photo.width} × {photo.height} px · {photo.points.filter(Boolean).length}/4 markers placed</p>{photo.detection && <p role="status">{photo.detection.message}</p>}
        <div className="photo-actions"><button className="secondary" disabled={busy} onClick={() => onRegister(i)}>Place markers manually</button><button className="secondary" disabled={busy} onClick={() => { replace.current = photo.id; if (input.current) { input.current.multiple = false; input.current.click(); } }}>Replace</button><button className="secondary" disabled={busy} onClick={() => remove(photo.id)}>Remove</button><button className="icon-button" disabled={busy || i === 0} aria-label={`Move sheet ${i + 1} earlier`} onClick={() => move(photo.id, -1)}>↑</button><button className="icon-button" disabled={busy || i === photos.length - 1} aria-label={`Move sheet ${i + 1} later`} onClick={() => move(photo.id, 1)}>↓</button></div>
      </div>
    </li>)}</ol>
    <div className="step-actions"><button className="secondary" disabled={busy} onClick={onBack}>← Sheet settings</button><button className="primary" disabled={busy || photos.length === 0} onClick={() => onRegister(0)}>Review markers →</button></div>
  </>;
}
