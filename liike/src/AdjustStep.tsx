import { useMemo, useState } from 'react';
import type { Photo } from './photos';
import { framesOnSheet } from './layout';
import type { SheetSettings } from './layout';
import { registrationTransform } from './homography';
import type { Quad } from './homography';
import { DEFAULT_ADJUSTMENTS } from './adjustments';
import type { Adjustments } from './adjustments';
import { useAdjustmentPreview } from './useAdjustmentPreview';

type Props = { photo: Photo; settings: SheetSettings; sheet: number; adjustments: Adjustments; setAdjustments: (a: Adjustments) => void; readiness: string; onBack: () => void; onSequence: () => void };

export default function AdjustStep({ photo, settings, sheet, adjustments, setAdjustments, readiness, onBack, onSequence }: Props) {
  const [selected, setSelected] = useState(0);
  const [original, setOriginal] = useState(false);
  const frames = framesOnSheet(settings, sheet);
  const frame = frames[Math.max(0, Math.min(selected, frames.length - 1))]!;
  const rect = selected === -1 ? { x: 0, y: 0, w: settings.W, h: settings.H } : frame.crop;
  const registration = useMemo(() => {
    if (photo.points.some(p => !p)) return { h: null, error: 'Place all four markers for this sheet in Register to preview adjustments.' };
    try { return { h: registrationTransform(settings.W, settings.H, photo.points as Quad), error: '' }; }
    catch (error) { return { h: null, error: error instanceof Error ? error.message : 'Check the marker positions.' }; }
  }, [photo.points, settings.W, settings.H]);
  const { preview, busy, error } = useAdjustmentPreview(photo, settings, registration.h, rect, adjustments);
  const update = (patch: Partial<Adjustments>) => setAdjustments({ ...adjustments, ...patch });
  function slider(key: 'black' | 'white' | 'gamma' | 'saturation' | 'threshold', label: string, min: number, max: number, step = 1, suffix = '') {
    return <label className="field adjustment-slider"><span>{label}<output>{key === 'gamma' ? adjustments[key].toFixed(2) : adjustments[key]}{suffix}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={adjustments[key]} disabled={key === 'threshold' && !adjustments.thresholdEnabled} onChange={e => update({ [key]: Number(e.target.value) })} /></label>;
  }
  return <>
    <div className="workspace adjust-workspace">
      <section className="settings" aria-label="Color adjustments">
        <fieldset><legend><span>01</span> Paper & light</legend>
          <label className="checkbox"><input type="checkbox" checked={adjustments.flatten} onChange={e => update({ flatten: e.target.checked })} />Paper flatten</label><p className="hint">Even out smooth shadows and brighten the paper.</p>
          <label className="checkbox"><input type="checkbox" checked={adjustments.whiteBalance} onChange={e => update({ whiteBalance: e.target.checked })} />Auto white balance</label><p className="hint">Remove the lighting's color cast using blank paper.</p>
        </fieldset>
        <fieldset><legend><span>02</span> Shared tones</legend>{slider('black', 'Black point', 0, 120)}{slider('white', 'White point', 135, 255)}{slider('gamma', 'Gamma', .3, 3, .05)}{slider('saturation', 'Saturation', 0, 200, 1, '%')}
          <p className="hint">These settings apply equally to every frame on every sheet.</p>
        </fieldset>
        <fieldset><legend><span>03</span> Two-tone ink</legend><label className="checkbox"><input type="checkbox" checked={adjustments.thresholdEnabled} onChange={e => update({ thresholdEnabled: e.target.checked })} />Ink threshold</label>{slider('threshold', 'Ink cutoff', 0, 255)}<p className="hint">Make a black-and-white image. Raise the cutoff to keep lighter pen strokes.</p></fieldset>
        <button className="secondary adjustment-reset" onClick={() => setAdjustments({ ...DEFAULT_ADJUSTMENTS })}>Reset adjustments</button>
      </section>
      <section className="adjust-preview" aria-label="Adjustment preview">
        <div className="preview-heading"><div><p className="eyebrow">Before & after</p><h2>Keep the ink. Lift the paper.</h2></div></div>
        <div className="adjust-preview-controls"><label className="field"><span>Preview area</span><select value={selected === -1 ? -1 : Math.min(selected, frames.length - 1)} onChange={e => setSelected(Number(e.target.value))}><option value={-1}>Whole sheet</option>{frames.map((f, i) => <option key={f.frame} value={i}>Source frame {f.frame + 1}</option>)}</select></label><div className="comparison-toggle" role="group" aria-label="Compare adjustments"><button className={!original ? 'selected' : ''} aria-pressed={!original} onClick={() => setOriginal(false)}>Adjusted</button><button className={original ? 'selected' : ''} aria-pressed={original} onClick={() => setOriginal(true)}>Original</button></div></div>
        {registration.error || error ? <p className="error" role="alert">{registration.error || error}</p> : preview ? <div className="adjust-image-stage" aria-busy={busy}>
          <img src={original ? preview.before : preview.after} width={preview.width} height={preview.height} alt={`${original ? 'Original' : 'Adjusted'} ${selected === -1 ? 'sheet' : `source frame ${frame.frame + 1}`}`} />
          <span className="comparison-label">{original ? 'Original' : 'Adjusted'}</span>
        </div> : <div className="preview-placeholder"><span aria-hidden="true">◐</span><h2>Reading the paper…</h2><p>The preview will update as you move the sliders.</p></div>}
        <p className="notice adjustment-status" role="status">{busy ? 'Updating preview…' : preview ? preview.note : ''}</p>
        <p className="hint">Compare with Original to check fine strokes and colors. The preview uses a smaller copy; the sequence is rendered from your full-resolution photos.</p>
        <div className="reference"><div><strong>One look for the whole animation</strong><p>Paper lighting is estimated separately for each photograph. Every frame shares the same tone controls. Original photos stay unchanged.</p></div></div>
      </section>
    </div>
    {readiness && <p className="warning" role="status">{readiness}</p>}
    <div className="step-actions"><button className="secondary" onClick={onBack}>← Register</button><button className="primary" disabled={Boolean(readiness)} onClick={onSequence}>Build sequence →</button></div>
  </>;
}
