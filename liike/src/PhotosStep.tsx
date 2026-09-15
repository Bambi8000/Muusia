import { useRef, useState } from 'react';
import type { usePhotos } from './usePhotos';
import type { SheetSettings } from './layout';
import { individualFrames, photoForMode } from './capture';
import { frameNumberIssue, photoLabel } from './frame-number';
import FrameNumberField from './FrameNumberField';

type Props = { library: ReturnType<typeof usePhotos>; sheets: number; settings: SheetSettings; onBack: () => void; onRegister: (index: number) => void; onUsePhotos?: () => void; onSortNumbers?: () => void };
export default function PhotosStep({ library, sheets, settings, onBack, onRegister, onUsePhotos, onSortNumbers }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const replace = useRef<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const { photos, busy, errors, add, remove, move } = library;
  const remaining = sheets - photos.length;
  const closeup = individualFrames(settings), noun = closeup ? 'Photo' : 'Sheet', feature = closeup ? 'corners' : 'markers';
  const visiblePhotos = photos.map(photo => photoForMode(photo, settings));
  return <>
    <section className="intro"><div><p className="eyebrow">02 / Add your photographs</p><h1>Bring in <em>the ink.</em></h1><p>{closeup ? "Add one photo per frame, in frame-number order. Keep the complete outline and its top-left circle visible." : "Add one photo per sheet, in sheet order. Keep all four markers visible."} Photos stay on your device.</p></div></section>
    <input ref={input} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,.heic,.heif" multiple={!replace.current} onChange={e => {
      const files = Array.from(e.target.files ?? []); const id = replace.current;
      e.target.value = ''; replace.current = undefined;
      void add(files, id, settings);
    }} />
    <div className={`photo-drop ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => {
      e.preventDefault(); setDragging(false); if (!busy) void add(Array.from(e.dataTransfer.files), undefined, settings);
    }}>
      <span className="drop-symbol" aria-hidden="true">＋</span><h2>{closeup ? 'One frame, one photograph' : 'One sheet, one photograph'}</h2><p>Drop photos here, or choose them from your device.</p>
      <button className="primary" disabled={busy} onClick={() => { replace.current = undefined; if (input.current) { input.current.multiple = true; input.current.click(); } }}>{busy ? `Opening photos & finding ${feature}…` : 'Choose photos'}</button><small>JPEG · PNG · WebP</small>
    </div>
    <div className="photo-count" role="status"><strong>{photos.length} / {sheets} photos</strong><span>{remaining > 0 ? `Add ${remaining} more ${remaining === 1 ? 'photo' : 'photos'} for the complete sequence. You can place ${feature} on the photos already added.` : remaining < 0 ? `You can place ${feature} on every photo. Only the first ${sheets === 1 ? 'photo is' : `${sheets} photos are`} used in the sequence. Increase Total frames in Sheet or reorder photos to include the others.` : `Every ${closeup ? 'frame' : 'sheet'} has a photo. Review or place its ${feature} manually.`}</span></div>
    {closeup && remaining !== 0 && photos.length > 0 && onUsePhotos && <button className="secondary" disabled={busy} onClick={onUsePhotos}>Use these {photos.length} frames</button>}
    {closeup && <div className="frame-number-help"><p className="hint">Detection finds the outline and orientation, not the printed number. Enter the frame number shown on paper. Photo numbers only indicate the current photo order.</p>{photos.length > 1 && <><button className="secondary" disabled={busy || Boolean(frameNumberIssue(photos))} onClick={onSortNumbers}>Order by frame number</button><p className="hint" role="status">{frameNumberIssue(photos) || 'Arrange photos in ascending frame-number order. This also resets playback to that order.'}</p></>}</div>}
    {errors.length > 0 && <div className="error" role="alert">{errors.map((error, i) => <p key={i}>{error}</p>)}</div>}
    <ol className="photo-list">{visiblePhotos.map((photo, i) => <li key={photo.id}>
      <img src={photo.url} alt={`${photoLabel(photo, i, settings.captureMode)}: ${photo.name}`} />
      <div className="photo-details"><p className="eyebrow">{photoLabel(photo, i, settings.captureMode)}{i >= sheets ? ' · extra photo' : ''}</p><h2>{photo.name}</h2><p>{photo.width} × {photo.height} px · {photo.points.filter(Boolean).length}/4 {feature} placed</p>{photo.detection && <p role="status">{photo.detection.message}</p>}
        {closeup && <FrameNumberField photo={photo} setNumber={library.setFrameNumber} disabled={busy} />}
        <div className="photo-actions"><button className="secondary" disabled={busy} onClick={() => onRegister(i)}>Place {feature} manually</button><button className="secondary" disabled={busy} onClick={() => { replace.current = photo.id; if (input.current) { input.current.multiple = false; input.current.click(); } }}>Replace</button><button className="secondary" disabled={busy} onClick={() => remove(photo.id)}>Remove</button><button className="icon-button" disabled={busy || i === 0} aria-label={`Move ${noun.toLowerCase()} ${i + 1} earlier`} onClick={() => move(photo.id, -1)}>↑</button><button className="icon-button" disabled={busy || i === photos.length - 1} aria-label={`Move ${noun.toLowerCase()} ${i + 1} later`} onClick={() => move(photo.id, 1)}>↓</button></div>
      </div>
    </li>)}</ol>
    <div className="step-actions"><button className="secondary" disabled={busy} onClick={onBack}>← Sheet settings</button><button className="primary" disabled={busy || photos.length === 0} onClick={() => onRegister(0)}>Review {feature} →</button></div>
  </>;
}
