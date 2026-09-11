import { useState } from 'react';
import { buildLayout, DEFAULTS, framesOnSheet, LAYOUTS, ORDERS, validateSettings } from './layout';
import type { Crop, Order, Rect, SheetSettings } from './layout';
import { REFERENCE_SETTINGS } from './reference-settings';
import { usePhotos } from './usePhotos';
import PhotosStep from './PhotosStep';
import RegistrationStep from './RegistrationStep';
import SequenceStep from './SequenceStep';
import { useFrames } from './useFrames';
import { planFrames } from './frames';
import { INITIAL_SEQUENCE } from './sequence';
import AdjustStep from './AdjustStep';
import { DEFAULT_ADJUSTMENTS } from './adjustments';
import type { Adjustments } from './adjustments';
import ExportStep from './ExportStep';
import { DEFAULT_EXPORT } from './export-plan';

type NumericKey = 'W' | 'H' | 'cols' | 'rows' | 'margin' | 'gap' | 'markSize' | 'total' | 'pad';
type Draft = Record<NumericKey, string> & { order: Order; crop: Crop };
const numericKeys: NumericKey[] = ['W', 'H', 'cols', 'rows', 'margin', 'gap', 'markSize', 'total', 'pad'];
const makeDraft = (p: SheetSettings): Draft => Object.fromEntries(Object.entries(p).map(([key, value]) => [key, String(value)])) as Draft;
const readDraft = (d: Draft): SheetSettings => ({
  order: d.order, crop: d.crop,
  ...Object.fromEntries(numericKeys.map(key => [key, d[key].trim() === '' ? NaN : Number(d[key])])) as Record<NumericKey, number>,
});
const mm = (value: number) => Number(value.toFixed(2)).toLocaleString('en-US');
const rectProps = (r: Rect) => ({ x: r.x, y: r.y, width: r.w, height: r.h });

function SheetPreview({ settings, sheet, guides }: { settings: SheetSettings; sheet: number; guides: boolean }) {
  const l = buildLayout(settings);
  const frames = framesOnSheet(settings, sheet);
  const byCell = new Map(frames.map(f => [f.index, f.frame + 1]));
  const fontSize = Math.min(l.cw, l.ch) * 0.22;
  return <svg className="sheet" viewBox={`0 0 ${settings.W} ${settings.H}`} role="img" aria-label={`Sheet ${sheet + 1}: ${frames.length} frames in ${settings.cols} columns and ${settings.rows} rows`}>
    <defs><pattern id="marker-hatch" width="1" height="0.6" patternUnits="userSpaceOnUse"><path d="M0 .3H1" stroke="#454b3d" strokeWidth=".3" /></pattern></defs>
    <rect width={settings.W} height={settings.H} fill="#fffef9" />
    {l.cells.map(({ index, cell, window, crop }) => <g key={index} className={byCell.has(index) ? 'occupied' : 'empty'}>
      {guides && <rect {...rectProps(cell)} className="cell-guide" />}
      <rect {...rectProps(window)} className="frame-window" />
      {byCell.has(index) && (settings.crop === 'Full cell' || settings.pad > 0) && <rect {...rectProps(crop)} className="crop-guide" />}
      <text x={window.x + window.w / 2} y={window.y + window.h / 2} fontSize={fontSize} textAnchor="middle" dominantBaseline="central" fill={byCell.has(index) ? '#526638' : '#92978b'}>{byCell.get(index) ?? '—'}</text>
    </g>)}
    {l.markers.map((m, i) => <g key={i}>
      <rect x={m.x - settings.markSize / 2} y={m.y - settings.markSize / 2} width={settings.markSize} height={settings.markSize} fill="url(#marker-hatch)" stroke="#454b3d" strokeWidth=".3" />
      {m.hole && <circle cx={m.x} cy={m.y} r={settings.markSize * .2} fill="#fffef9" stroke="#454b3d" strokeWidth=".3" />}
    </g>)}
  </svg>;
}

export default function App() {
  const [step, setStep] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const library = usePhotos();
  const [draft, setDraft] = useState<Draft>(() => makeDraft(DEFAULTS));
  const [paper, setPaper] = useState('A3');
  const [layoutMode, setLayoutMode] = useState('4x3');
  const [sheetIndex, setSheetIndex] = useState(0);
  const [guides, setGuides] = useState(true);
  const [notice, setNotice] = useState('');
  const [resolution, setResolution] = useState(1080);
  const [stabilize, setStabilize] = useState(false);
  const [sequence, setSequence] = useState(INITIAL_SEQUENCE);
  const [exportOptions, setExportOptions] = useState(DEFAULT_EXPORT);
  const [adjustments, setAdjustments] = useState<Adjustments>({ ...DEFAULT_ADJUSTMENTS });
  const settings = readDraft(draft);
  const extraction = useFrames(library.photos, settings, resolution, adjustments, stabilize);
  const issues = validateSettings(settings);
  const layout = issues.length ? null : buildLayout(settings);
  const sheet = layout ? Math.min(sheetIndex, layout.sheets - 1) : 0;
  const count = layout ? framesOnSheet(settings, sheet).length : 0;
  const crop = layout?.cells[0]?.crop;
  const outside = layout?.cells.some(({ crop: q }) => q.x < 0 || q.y < 0 || q.x + q.w > settings.W + 1e-9 || q.y + q.h > settings.H + 1e-9);
  const availablePhotos = library.photos.slice(0, layout?.sheets ?? 0);
  const selectedPhotoIndex = Math.max(0, Math.min(photoIndex, availablePhotos.length - 1));
  const selectedPhoto = availablePhotos[selectedPhotoIndex];
  let readiness = issues[0] ?? '';
  if (!readiness) {
    try { planFrames(settings, library.photos, resolution); }
    catch (error) { readiness = error instanceof Error ? error.message : 'Check the photographed sheets.'; }
  }

  function update(patch: Partial<Draft>) {
    setDraft(current => ({ ...current, ...patch }));
    setSheetIndex(0);
  }
  function reset(reference = false) {
    setDraft(makeDraft(reference ? REFERENCE_SETTINGS : DEFAULTS));
    setPaper(reference ? 'A4' : 'A3'); setLayoutMode('4x3'); setSheetIndex(0);
    setNotice(reference ? 'Confirmed reference settings loaded: A4 landscape, 4 × 3, 12 frames, Row-major, 30 mm margin, 8 mm gap and 15 mm markers. The plot uses Map canvas.' : 'Muusia handoff defaults restored.');
  }
  function choosePaper(value: string) {
    setPaper(value);
    if (value === 'Custom') return;
    const [wide, tall] = value === 'A4' ? [297, 210] : [420, 297];
    const portrait = settings.H > settings.W;
    update({ W: String(portrait ? tall : wide), H: String(portrait ? wide : tall) });
  }
  function numberField(key: NumericKey, label: string, min: number, step = 1, max?: number) {
    return <label className="field" key={key}><span>{label}</span><input type="number" inputMode={step < 1 ? 'decimal' : 'numeric'} min={min} max={max} step={step} value={draft[key]} onChange={e => {
      if (key === 'W' || key === 'H') setPaper('Custom');
      update({ [key]: e.target.value });
    }} /></label>;
  }

  return <main>
    <header><a className="wordmark" href="./">Liike<span>↗</span></a><span className="tagline">From paper to motion</span></header>
    <nav aria-label="Workflow"><ol className="steps">{['Sheet', 'Photos', 'Register', 'Adjust', 'Sequence', 'Export'].map((name, i) => <li key={name} aria-current={i === step ? 'step' : undefined}><button onClick={() => setStep(i)} disabled={library.busy || (i > 0 && !layout) || ((i === 2 || i === 3) && !selectedPhoto)}><span className="step-number">{i + 1}</span>{name}</button></li>)}</ol></nav>
    {step === 0 && <>
    <section className="intro"><div><p className="eyebrow">01 / Set up your sheet</p><h1>Start with <em>the paper.</em></h1><p>Match the Frame Grid settings you plotted. Every frame will share the same crop and scale.</p></div><button className="secondary" onClick={() => reset()}>Muusia defaults ↺</button></section>
    <div className="workspace">
      <section className="settings" aria-label="Sheet settings">
        <fieldset><legend><span>01</span> Canvas</legend>
          <div className="field-row"><label className="field"><span>Paper size</span><select value={paper} onChange={e => choosePaper(e.target.value)}><option>A3</option><option>A4</option><option>Custom</option></select></label>
            <label className="field"><span>Orientation</span><select value={settings.H > settings.W ? 'Portrait' : 'Landscape'} disabled={!Number.isFinite(settings.W) || !Number.isFinite(settings.H)} onChange={e => {
              const portrait = e.target.value === 'Portrait';
              update({ W: String(portrait ? Math.min(settings.W, settings.H) : Math.max(settings.W, settings.H)), H: String(portrait ? Math.max(settings.W, settings.H) : Math.min(settings.W, settings.H)) });
            }}><option>Landscape</option><option>Portrait</option></select></label></div>
          <div className="field-row">{numberField('W', 'Width · mm', 41, .1)}{numberField('H', 'Height · mm', 41, .1)}</div>
        </fieldset>
        <fieldset><legend><span>02</span> Frame grid</legend>
          <label className="field"><span>Layout</span><select value={layoutMode} onChange={e => {
            setLayoutMode(e.target.value);
            if (e.target.value !== 'Custom') { const [cols, rows] = e.target.value.split('x'); update({ cols, rows }); }
          }}>{LAYOUTS.map(([c, r]) => <option key={`${c}x${r}`} value={`${c}x${r}`}>{c} × {r} · {c * r} frames</option>)}<option>Custom</option></select></label>
          {layoutMode === 'Custom' && <div className="field-row">{numberField('cols', 'Columns', 1, 1, 6)}{numberField('rows', 'Rows', 1, 1, 6)}</div>}
          <div className="field-row">{numberField('margin', 'Margin · mm', 0, .5)}{numberField('gap', 'Gap · mm', 0, .5)}</div>
          <label className="field"><span>Frame order</span><select value={draft.order} onChange={e => update({ order: e.target.value as Order })}>{ORDERS.map(order => <option key={order}>{order}</option>)}</select></label>
          <p className="hint">Boustrophedon alternates left-to-right and right-to-left on each row.</p>
          <div className="field-row">{numberField('total', 'Total frames', 1)}{numberField('markSize', 'Marker size · mm', 8, .5, 15)}</div>
          <p className="hint">Marker centers are fixed at 20 mm from the sheet edges. The white hole marks the top-left corner.</p>
        </fieldset>
        <fieldset><legend><span>03</span> Crop</legend>
          <div className="field-row crop-fields"><label className="field"><span>Crop area</span><select value={draft.crop} onChange={e => update({ crop: e.target.value as Crop })}><option>Frame window</option><option>Full cell</option></select></label>{numberField('pad', 'Pad · %', 0, .5, 100)}</div>
          <p className="hint">Frame window follows the original canvas aspect ratio. Padding adds the chosen percentage on each side.</p>
        </fieldset>
      </section>
      <section className="preview-panel" aria-label="Layout preview">
        <div className="preview-heading"><div><p className="eyebrow">Layout preview</p><h2>{layout ? `${settings.cols} × ${settings.rows} frame grid` : 'Check your settings'}</h2></div><label className="checkbox"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />Cell guides</label></div>
        {layout ? <>
          <div className="paper-stage"><SheetPreview settings={settings} sheet={sheet} guides={guides} /></div>
          <div className="preview-controls"><button className="icon-button" aria-label="Previous sheet" disabled={sheet === 0} onClick={() => setSheetIndex(sheet - 1)}>←</button><span>Sheet {sheet + 1} of {layout.sheets}<small>{count} of {layout.framesPerSheet} positions filled</small></span><button className="icon-button" aria-label="Next sheet" disabled={sheet + 1 === layout.sheets} onClick={() => setSheetIndex(sheet + 1)}>→</button></div>
          <div className="legend"><span><i className="swatch window" />Frame window</span><span><i className="swatch cell" />Cell boundary</span>{(settings.crop === 'Full cell' || settings.pad > 0) && <span><i className="swatch crop" />Selected crop</span>}</div>
          <dl className="metrics"><div><dt>Sheet size</dt><dd>{mm(settings.W)} × {mm(settings.H)}<small>mm</small></dd></div><div><dt>Crop size</dt><dd>{crop ? `${mm(crop.w)} × ${mm(crop.h)}` : '—'}<small>mm per frame</small></dd></div><div><dt>Photos needed</dt><dd>{layout.sheets}<small>in sheet order</small></dd></div></dl>
          {outside && <p className="warning" role="status">The padded crop extends beyond the sheet. Reduce padding to keep the full crop on paper.</p>}
          <p className="hint preview-note">Numbers and guides are preview overlays. Empty positions will be skipped. No cell borders are required on the actual plot.</p>
        </> : <div className="error" role="alert"><h3>Adjust these settings to see the sheet</h3><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        <div className="reference"><div><strong>Working with the reference plot?</strong><p>Load the confirmed settings for the 12-frame A4 plot.</p></div><button className="secondary" onClick={() => reset(true)}>Use reference sheet</button></div>
        <p className="notice" role="status">{notice}</p>
      </section>
    </div>
    <div className="step-actions"><p className="hint">{library.photos.length ? 'Your photos and marker positions stay available when you change sheet settings.' : 'Ready to add the photographed sheets.'}</p><button className="primary" disabled={!layout} onClick={() => setStep(1)}>Add photos →</button></div>
    </>}
    {step === 1 && layout && <PhotosStep library={library} sheets={layout.sheets} settings={settings} onBack={() => setStep(0)} onRegister={() => setStep(2)} />}
    {step === 2 && layout && selectedPhoto && <>
      <section className="intro"><div><p className="eyebrow">03 / Register the sheet</p><h1>Find <em>the corners.</em></h1><p>Match the markers in your photo to the sheet. Begin with the marker that has a white hole.</p></div><label className="field"><span>Photographed sheet</span><select value={selectedPhotoIndex} onChange={e => setPhotoIndex(Number(e.target.value))}>{availablePhotos.map((photo, i) => <option key={photo.id} value={i}>Sheet {i + 1} · {photo.name}</option>)}</select></label></section>
      {availablePhotos.length < layout.sheets && <p className="warning">{layout.sheets - availablePhotos.length} more photos needed. You can register these sheets now and add the rest in Photos.</p>}
      <RegistrationStep key={selectedPhoto.id} photo={selectedPhoto} settings={settings} sheet={selectedPhotoIndex} setPoints={library.setPoints} detect={library.detect} undoDetection={library.undoDetection} />
      <div className="step-actions"><button className="secondary" onClick={() => setStep(1)}>← Photos</button>{selectedPhotoIndex + 1 < availablePhotos.length ? <button className="primary" onClick={() => setPhotoIndex(selectedPhotoIndex + 1)}>Next sheet →</button> : <button className="primary" onClick={() => setStep(3)}>Adjust paper & tones →</button>}</div>
    </>}
    {step === 3 && layout && selectedPhoto && <>
      <section className="intro"><div><p className="eyebrow">04 / Adjust the paper</p><h1>Let the drawing <em>shine.</em></h1><p>Even out the lighting and give the whole animation a consistent look.</p></div><label className="field"><span>Photographed sheet</span><select value={selectedPhotoIndex} onChange={e => setPhotoIndex(Number(e.target.value))}>{availablePhotos.map((photo, i) => <option key={photo.id} value={i}>Sheet {i + 1} · {photo.name}</option>)}</select></label></section>
      <AdjustStep key={selectedPhoto.id} photo={selectedPhoto} settings={settings} sheet={selectedPhotoIndex} adjustments={adjustments} setAdjustments={setAdjustments} readiness={readiness} onBack={() => setStep(2)} onSequence={() => { setStep(4); if (!extraction.completed) void extraction.extract(); }} />
    </>}
    {step === 4 && layout && <SequenceStep stabilize={stabilize} setStabilize={setStabilize} extraction={extraction} resolution={resolution} setResolution={setResolution} total={settings.total} readiness={readiness} sequence={sequence} setSequence={setSequence} onBack={() => setStep(selectedPhoto ? 3 : 1)} onExport={() => setStep(5)} />}
    {step === 5 && layout && <ExportStep frames={extraction.completed ? extraction.frames : []} sequence={sequence} setSequence={setSequence} options={exportOptions} setOptions={setExportOptions} onBack={() => setStep(4)} />}
    <footer><span>Photos stay on your device · Refreshing starts a new session.</span><span>Next in development: project save & load.</span></footer>
  </main>;
}
