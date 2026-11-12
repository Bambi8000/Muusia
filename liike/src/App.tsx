import { useState } from 'react';
import { buildLayout, DEFAULTS, framesOnSheet, LAYOUTS, ORDERS, validateSettings } from './layout';
import type { CaptureMode, Crop, MarkerStyle, Order, ReceiptAspect, ReceiptView, Rect, SheetSettings } from './layout';
import { individualFrames, photoForMode, requiredPhotos } from './capture';
import { photoLabel } from './frame-number';
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
import type { PaperTone } from './paper';
import ProjectBar from './ProjectBar';
import type { RestoredProject } from './project-archive';

type NumericKey = 'W' | 'H' | 'cols' | 'rows' | 'margin' | 'gap' | 'markSize' | 'total' | 'pad' | 'clearance' | 'trim';
type Draft = Record<NumericKey, string> & { order: Order; crop: Crop; paperTone: PaperTone; captureMode: CaptureMode; markerStyle: MarkerStyle; receiptView: ReceiptView; receiptAspect: ReceiptAspect };
const numericKeys: NumericKey[] = ['W', 'H', 'cols', 'rows', 'margin', 'gap', 'markSize', 'total', 'pad', 'clearance', 'trim'];
const makeDraft = (p: SheetSettings): Draft => ({ ...Object.fromEntries(Object.entries(p).map(([key, value]) => [key, String(value)])), paperTone: p.paperTone ?? 'light', markerStyle: p.markerStyle ?? 'hatched', captureMode: p.captureMode ?? 'sheet', clearance: String(p.clearance ?? 0), trim: String(p.trim ?? 0), receiptView: p.receiptView ?? (p.pad > 0 ? 'surround' : 'frame'), receiptAspect: p.receiptAspect ?? '3:4' }) as Draft;
const readDraft = (d: Draft): SheetSettings => ({
  order: d.order, crop: d.crop, paperTone: d.paperTone, captureMode: d.captureMode, markerStyle: d.markerStyle, receiptView: d.receiptView, receiptAspect: d.receiptAspect,
  ...Object.fromEntries(numericKeys.map(key => [key, d[key].trim() === '' ? NaN : Number(d[key])])) as Record<NumericKey, number>,
});
const mm = (value: number) => Number(value.toFixed(2)).toLocaleString('en-US');
const rectProps = (r: Rect) => ({ x: r.x, y: r.y, width: r.w, height: r.h });

function SheetPreview({ settings, sheet, guides }: { settings: SheetSettings; sheet: number; guides: boolean }) {
  const l = buildLayout(settings);
  const frames = framesOnSheet(settings, sheet);
  const byCell = new Map(frames.map(f => [f.index, f.frame + 1]));
  const fontSize = Math.min(l.cw, l.ch) * 0.22;
  const dark = settings.paperTone === 'dark', paperColor = dark ? '#0e0d0b' : '#fffaf2', inkColor = dark ? '#ff8a26' : '#24201c';
  const receipt = settings.captureMode === 'receipts';
  const view = receipt && settings.pad > 0 ? l.cells[0]!.crop : { x: 0, y: 0, w: settings.W, h: settings.H };
  return <svg className="sheet" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label={`Sheet ${sheet + 1}: ${frames.length} frames in ${settings.cols} columns and ${settings.rows} rows`}>
    <defs><pattern id="marker-hatch" width="1" height="0.6" patternUnits="userSpaceOnUse"><path d="M0 .3H1" stroke={inkColor} strokeWidth=".3" /></pattern></defs>
    {receipt && settings.pad > 0 && <rect {...rectProps(view)} fill={dark ? '#29302e' : '#e8e7df'} />}
    <rect width={settings.W} height={settings.H} fill={paperColor} />
    {l.cells.map(({ index, cell, window, crop }) => <g key={index} className={byCell.has(index) ? 'occupied' : 'empty'}>
      {guides && <rect {...rectProps(cell)} className="cell-guide" />}
      <rect {...rectProps(receipt ? cell : individualFrames(settings) ? crop : window)} className="frame-window" style={dark ? { fill: '#24180f', stroke: '#ff6a00' } : undefined} />
      {byCell.has(index) && (settings.crop === 'Full cell' || settings.pad > 0) && <rect {...rectProps(crop)} className="crop-guide" />}
      <text x={window.x + window.w / 2} y={window.y + window.h / 2} fontSize={fontSize} textAnchor="middle" dominantBaseline="central" fill={dark ? '#ff8a26' : byCell.has(index) ? '#b94c00' : '#8b7868'}>{byCell.get(index) ?? '—'}</text>
    </g>)}
    {receipt ? l.cells.map(({ index, cell }) => { const arm = Math.min(4, cell.w / 10, cell.h / 10); return <g key={index} fill="none" stroke={inkColor} strokeWidth=".3"><path d={`M${cell.x},${cell.y + arm}V${cell.y}h${arm} M${cell.x + cell.w - arm},${cell.y}h${arm}v${arm} M${cell.x + cell.w},${cell.y + cell.h - arm}v${arm}h${-arm} M${cell.x + arm},${cell.y + cell.h}h${-arm}v${-arm}`} /></g>; }) : individualFrames(settings) ? l.cells.map(({ index, cell }) => <g key={index}><rect {...rectProps(cell)} fill="none" stroke={inkColor} strokeWidth=".3" /><circle cx={cell.x - 2.5} cy={cell.y - 2.5} r={1.5} fill="none" stroke={inkColor} strokeWidth=".3" /></g>) : l.markers.map((m, i) => <g key={i}>
      <rect x={m.x - settings.markSize / 2} y={m.y - settings.markSize / 2} width={settings.markSize} height={settings.markSize} fill={settings.markerStyle === 'outline' ? 'none' : 'url(#marker-hatch)'} stroke={inkColor} strokeWidth=".3" />
      {m.hole && (settings.markerStyle === 'outline'
        ? <path d={`M${m.x-settings.markSize/2},${m.y-settings.markSize/2}l${settings.markSize},${settings.markSize}M${m.x+settings.markSize/2},${m.y-settings.markSize/2}l${-settings.markSize},${settings.markSize}`} fill="none" stroke={inkColor} strokeWidth=".3" />
        : <circle cx={m.x} cy={m.y} r={settings.markSize * .2} fill={paperColor} stroke={inkColor} strokeWidth=".3" />)}
    </g>)}
  </svg>;
}

export default function App() {
  const [projectName, setProjectName] = useState('Untitled');
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectRevision, setProjectRevision] = useState(0);
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
  let crop = layout?.cells[0]?.crop;
  const outside = layout?.cells.some(({ crop: q }) => q.x < 0 || q.y < 0 || q.x + q.w > settings.W + 1e-9 || q.y + q.h > settings.H + 1e-9);
  const closeup = individualFrames(settings);
  const receipt = settings.captureMode === 'receipts';
  const needed = layout ? requiredPhotos(settings) : 0;
  const availablePhotos = library.photos.slice(0, needed).map(photo => photoForMode(photo, settings));
  const registrationPhotoIndex = Math.max(0, Math.min(photoIndex, library.photos.length - 1));
  const rawRegistrationPhoto = library.photos[registrationPhotoIndex];
  const registrationPhoto = rawRegistrationPhoto && photoForMode(rawRegistrationPhoto, settings);
  const selectedPhotoIndex = Math.max(0, Math.min(photoIndex, availablePhotos.length - 1));
  const selectedPhoto = availablePhotos[selectedPhotoIndex];
  let readiness = issues[0] ?? '';
  if (!readiness) {
    try { crop = planFrames(settings, library.photos, resolution)[0]?.frames[0]?.crop ?? crop; }
    catch (error) { readiness = error instanceof Error ? error.message : 'Check the photographed sheets.'; }
  }

  function update(patch: Partial<Draft>) {
    setDraft(current => ({ ...current, ...patch }));
    setSheetIndex(0);
  }
  function chooseCaptureMode(captureMode: CaptureMode) {
    if (captureMode === 'receipts') {
      update({ captureMode, W: '72', H: '100', cols: '1', rows: '1', margin: '0', gap: '0', markSize: '8', total: '12', crop: 'Full cell', clearance: '0', trim: '0', pad: '0', receiptView: 'frame', receiptAspect: '3:4', order: 'Row-major', paperTone: 'light' });
      setPaper('Custom'); setLayoutMode('Custom');
      setNotice('Receipt setup: match the crop width and height ratio to the Muusia canvas. New large L marks and frame numbers are read automatically; check every result. Older receipts can be placed manually.');
      setAdjustments(current => ({ ...current, flatten: false, whiteBalance: false, autoAdjust: false }));
    } else { update({ captureMode, crop: captureMode === 'frames' ? 'Full cell' : 'Frame window', clearance: captureMode === 'frames' ? '3' : '0', trim: captureMode === 'frames' ? '1' : '0', pad: '0' }); setNotice(''); }
    setResolution(captureMode === 'sheet' ? 1080 : 2160);
    setStabilize(false); setSequence({ ...INITIAL_SEQUENCE, order: captureMode === 'sheet' ? 'Original' : 'Frame number' }); setPhotoIndex(0);
  }
  function restore({ project, photos }: RestoredProject) {
    extraction.cancel();
    library.replaceAll(photos);
    setProjectName(project.name); setDraft(makeDraft(project.settings));
    const { W, H, cols, rows } = project.settings;
    const wide = Math.max(W, H), tall = Math.min(W, H);
    setPaper(wide === 420 && tall === 297 ? 'A3' : wide === 297 && tall === 210 ? 'A4' : 'Custom');
    setLayoutMode(LAYOUTS.some(([c, r]) => c === cols && r === rows) ? `${cols}x${rows}` : 'Custom');
    setAdjustments(project.adjustments); setSequence(project.sequence); setExportOptions(project.exportOptions);
    setResolution(project.resolution); setStabilize(project.settings.captureMode === 'receipts' ? false : project.stabilize);
    setPhotoIndex(0); setSheetIndex(0); setNotice(''); setStep(photos.length ? 1 : 0);
    setProjectRevision(value => value + 1);
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
    <header><a className="wordmark" href="./">Liike<span>↗</span></a><a className="secondary" href="#receipt">Receipt animation →</a></header>
    <ProjectBar state={{ name: projectName, settings, adjustments, sequence, exportOptions, resolution, stabilize }} photos={library.photos} disabled={library.busy || library.photos.some(p => p.detection?.status === 'running' || p.numberDetection?.status === 'running')} saveIssue={issues[0] ?? ''} setName={setProjectName} onBusy={setProjectBusy} onLoad={restore} loaded={projectRevision > 0} />
    <div inert={projectBusy} key={projectRevision}>
    <nav aria-label="Workflow"><ol className="steps">{['Sheet', 'Photos', 'Register', 'Adjust', 'Sequence', 'Export'].map((name, i) => <li key={name} aria-current={i === step ? 'step' : undefined}><button onClick={() => setStep(i)} disabled={library.busy || (i > 0 && !layout) || (i === 2 && !registrationPhoto) || (i === 3 && !selectedPhoto)}><span className="step-number">{i + 1}</span>{name}</button></li>)}</ol></nav>
    {step === 0 && <>
    <section className="intro"><div><p className="eyebrow">01 / Set up your sheet</p><h1>Start with <em>the paper.</em></h1><p>{receipt ? 'Match the rectangle between the four L-shaped crop marks on each printed receipt.' : 'Match the Frame Grid settings you plotted. Every frame will share the same crop and scale.'}</p></div><button className="secondary" onClick={() => reset()}>Muusia defaults ↺</button></section>
    <div className="workspace">
      <section className="settings" aria-label="Sheet settings">
        <fieldset><legend><span>01</span> Canvas</legend>
          <label className="field"><span>Capture mode</span><select value={draft.captureMode} onChange={e => chooseCaptureMode(e.target.value as CaptureMode)}><option value="sheet">Whole sheets</option><option value="frames">Individual plotter frames</option><option value="receipts">Printed receipt frames</option></select></label>
          <p className="hint">{receipt ? 'One photo per receipt frame. Include all four L-shaped crop marks and the F number strip. New receipts are read automatically; check or correct every result.' : closeup ? "One close-up photo per frame. Include the full cell outline and the small circle outside its top-left corner." : "One photo per sheet. Include all four corner markers and match their style below."}</p>
          <label className="field"><span>Paper color</span><select value={draft.paperTone} onChange={e => update({ paperTone: e.target.value as PaperTone })}><option value="light">White / light</option><option value="dark">Black / dark</option></select></label>
          {!receipt && <div className="field-row"><label className="field"><span>Paper size</span><select value={paper} onChange={e => choosePaper(e.target.value)}><option>A3</option><option>A4</option><option>Custom</option></select></label>
            <label className="field"><span>Orientation</span><select value={settings.H > settings.W ? 'Portrait' : 'Landscape'} disabled={!Number.isFinite(settings.W) || !Number.isFinite(settings.H)} onChange={e => {
              const portrait = e.target.value === 'Portrait';
              update({ W: String(portrait ? Math.min(settings.W, settings.H) : Math.max(settings.W, settings.H)), H: String(portrait ? Math.max(settings.W, settings.H) : Math.min(settings.W, settings.H)) });
            }}><option>Landscape</option><option>Portrait</option></select></label></div>}
          <div className="field-row">{numberField('W', receipt ? 'Crop width · mm' : 'Width · mm', 41, .1)}{numberField('H', receipt ? 'Crop height · mm' : 'Height · mm', 41, .1)}</div>
          {receipt && <p className="hint">These two values set the shared frame aspect ratio. The sample receipt is about 72 × 100 mm between crop marks; adjust if your printed marks make a different rectangle.</p>}
        </fieldset>
        <fieldset><legend><span>02</span> Frame grid</legend>
          {!receipt && <label className="field"><span>Layout</span><select value={layoutMode} onChange={e => {
            setLayoutMode(e.target.value);
            if (e.target.value !== 'Custom') { const [cols, rows] = e.target.value.split('x'); update({ cols, rows }); }
          }}>{LAYOUTS.map(([c, r]) => <option key={`${c}x${r}`} value={`${c}x${r}`}>{c} × {r} · {c * r} frames</option>)}<option>Custom</option></select></label>}
          {!receipt && layoutMode === 'Custom' && <div className="field-row">{numberField('cols', 'Columns', 1, 1, 6)}{numberField('rows', 'Rows', 1, 1, 6)}</div>}
          {!receipt && <div className="field-row">{numberField('margin', 'Margin · mm', 0, .5)}{numberField('gap', 'Gap · mm', 0, .5)}</div>}
          {!receipt && <label className="field"><span>Frame order</span><select disabled={closeup} value={draft.order} onChange={e => update({ order: e.target.value as Order })}>{ORDERS.map(order => <option key={order}>{order}</option>)}</select></label>}
          <p className="hint">{receipt ? 'Liike reads the new receipt number strip and can sort the animation by frame number. Correct any unreadable numbers in Photos.' : closeup ? "Photo order sets the animation order. Add close-ups in frame-number order and rearrange them in Photos." : "Boustrophedon alternates left-to-right and right-to-left on each row."}</p>
          {!closeup && <label className="field"><span>Marker style</span><select value={draft.markerStyle} onChange={e => update({ markerStyle: e.target.value as MarkerStyle })}><option value="hatched">Hatched squares</option><option value="outline">Light outlines</option></select></label>}
          <div className="field-row">{numberField('total', 'Total frames', 1)}{!closeup && numberField('markSize', 'Marker size · mm', 8, .5, 15)}</div>
          <p className="hint">{receipt ? 'The printed L marks define the four frame corners. Large marks on new Muusia receipts are detected automatically; older small marks can be placed by hand.' : closeup ? "Use Cell frames and Corner dots in Muusia. Sheet corner markers are not needed." : <>Marker centers are fixed at 20 mm from the sheet edges. {settings.markerStyle === 'outline' ? 'The X identifies the top-left square. Match Light outlines in Muusia; cell borders and corner dots are optional.' : `The ${settings.paperTone === 'dark' ? 'dark' : 'white'} hole marks the top-left corner.`}</>}</p>
          {!receipt && <>{numberField('clearance', 'Plot clearance · mm', 0, .5, 10)}<p className="hint">Match Muusia’s Clearance mm. This is the blank band between the drawing and the cell frame.</p></>}
        </fieldset>
        <fieldset><legend><span>03</span> Crop</legend>
          {receipt ? <>
            <label className="field"><span>Image area</span><select value={settings.receiptView ?? (settings.pad > 0 ? 'surround' : 'frame')} onChange={e => update({ crop: 'Full cell', receiptView: e.target.value as ReceiptView, pad: e.target.value === 'surround' ? '6' : '0', trim: '0' })}><option value="frame">Between L marks</option><option value="surround">Frame + near surroundings</option><option value="photo">Align whole photos by L marks</option></select></label>
            {settings.receiptView === 'surround' && <>{numberField('pad', 'Surround on each side · %', .5, .5, 50)}<p className="hint">The same margin is added around every marked frame. The L-mark rectangle stays centered and aligned; the photographed surroundings can change from frame to frame.</p></>}
            {settings.receiptView === 'photo' && <><label className="field"><span>Output shape</span><select value={settings.receiptAspect ?? '3:4'} onChange={e => update({ receiptAspect: e.target.value as ReceiptAspect })}><option value="3:4">Shared photo area · 3:4</option><option value="9:16">Vertical reel · 9:16</option></select></label><p className="hint">Liike aligns the receipts by their four L marks, then crops every photo to the area shared by the smallest one. The drawing stays in place and the surroundings retain their shape.</p></>}
            {settings.receiptView === 'frame' && <>{numberField('trim', 'Border trim · mm', 0, .25, 10)}<p className="hint">Only the area between the four L marks is exported. Use Border trim if a mark reaches into the frame.</p></>}
          </> : <>
            <div className="field-row crop-fields"><label className="field"><span>Crop area</span><select value={draft.crop} onChange={e => update({ crop: e.target.value as Crop })}><option>Frame window</option><option>Full cell</option></select></label>{numberField('pad', 'Pad · %', 0, .5, 100)}</div>
            <p className="hint">{closeup ? "Full cell keeps the drawing inside its plotted frame. Frame window follows the original canvas aspect ratio and may crop strokes outside it." : "Frame window follows the original canvas aspect ratio. Padding adds the chosen percentage on each side."}</p>
            {settings.crop === 'Full cell' && <>{numberField('trim', 'Border trim · mm', 0, .25, 10)}<p className="hint">Remove the same strip from every cell edge to hide the frame line. 1 mm is a useful starting point.</p></>}
          </>}
        </fieldset>
      </section>
      <section className="preview-panel" aria-label="Layout preview">
        <div className="preview-heading"><div><p className="eyebrow">Layout preview</p><h2>{layout ? receipt ? 'Receipt frame between L marks' : `${settings.cols} × ${settings.rows} frame grid` : 'Check your settings'}</h2></div><label className="checkbox"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />Cell guides</label></div>
        {layout ? <>
          <div className="paper-stage"><SheetPreview settings={settings} sheet={sheet} guides={guides} /></div>
          <div className="preview-controls"><button className="icon-button" aria-label="Previous sheet" disabled={sheet === 0} onClick={() => setSheetIndex(sheet - 1)}>←</button><span>{receipt ? 'Receipt' : 'Sheet'} {sheet + 1} of {layout.sheets}<small>{receipt ? 'one photographed frame per receipt' : `${count} of ${layout.framesPerSheet} positions filled`}</small></span><button className="icon-button" aria-label="Next sheet" disabled={sheet + 1 === layout.sheets} onClick={() => setSheetIndex(sheet + 1)}>→</button></div>
          <div className="legend"><span><i className="swatch window" />Frame window</span><span><i className="swatch cell" />Cell boundary</span>{(settings.crop === 'Full cell' || settings.pad > 0) && <span><i className="swatch crop" />Selected crop</span>}</div>
          <dl className="metrics"><div><dt>{receipt ? 'Mark rectangle' : 'Sheet size'}</dt><dd>{mm(settings.W)} × {mm(settings.H)}<small>mm</small></dd></div><div><dt>{receipt && settings.receiptView === 'photo' ? 'Shared photo area' : 'Crop size'}</dt><dd>{crop ? `${mm(crop.w)} × ${mm(crop.h)}` : '—'}<small>mm per frame</small></dd></div><div><dt>Photos needed</dt><dd>{needed}<small>{receipt ? 'one per receipt' : closeup ? 'in frame order' : 'in sheet order'}</small></dd></div></dl>
          {outside && !receipt && <p className="warning" role="status">The padded crop extends beyond the sheet. Reduce padding to keep the full crop on paper.</p>}
          <p className="hint preview-note">{receipt ? settings.receiptView === 'photo' ? 'This diagram shows the L marks. Sequence shows the common crop of all aligned photos after extraction.' : settings.pad > 0 ? 'The inner rectangle is fixed by the four L marks. The outer rectangle is the exported image, including the changing surroundings.' : 'Keep all four L-shaped marks and the printed F number visible. The frame is cropped between the four inner L corners.' : closeup ? "Keep all four cell corners, the orientation circle and frame number visible in each close-up." : "Numbers and guides are preview overlays. Empty positions will be skipped. No cell borders are required on the actual plot."}</p>
        </> : <div className="error" role="alert"><h3>Adjust these settings to see the sheet</h3><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        <div className="reference"><div><strong>Working with the reference plot?</strong><p>Load the confirmed settings for the 12-frame A4 plot.</p></div><button className="secondary" onClick={() => reset(true)}>Use reference sheet</button></div>
        <p className="notice" role="status">{notice}</p>
      </section>
    </div>
    <div className="step-actions"><p className="hint">{library.photos.length ? 'Your photos and marker positions stay available when you change sheet settings.' : 'Ready to add the photographed sheets.'}</p><button className="primary" disabled={!layout} onClick={() => setStep(1)}>Add photos →</button></div>
    </>}
    {step === 1 && layout && <PhotosStep library={library} sheets={needed} settings={settings} onUsePhotos={() => update({ total: String(library.photos.length) })} onSortNumbers={() => { library.sortNumbers(); setPhotoIndex(0); setSequence(current => ({ ...current, order: 'Frame number', manual: [] })); }} onBack={() => setStep(0)} onRegister={index => { setPhotoIndex(index); setStep(2); }} />}
    {step === 2 && layout && registrationPhoto && <>
      <section className="intro"><div><p className="eyebrow">03 / Register the {closeup ? 'frame' : 'sheet'}</p><h1>Find <em>the corners.</em></h1><p>{receipt ? 'Check the detected L corners and frame number. For older receipts or unclear photos, tap the inner intersection of each L mark in clockwise order.' : closeup ? "Use the four corners of the cell outline. Top-left is the corner beside the small external circle." : <>Match the markers in your photo to the sheet. Begin with the marker that has {settings.markerStyle === 'outline' ? 'an X' : `a ${settings.paperTone === 'dark' ? 'dark' : 'white'} hole`}.</>}</p></div><label className="field"><span>Photographed {closeup ? 'frame' : 'sheet'}</span><select value={registrationPhotoIndex} onChange={e => setPhotoIndex(Number(e.target.value))}>{library.photos.map((photo, i) => <option key={photo.id} value={i}>{photoLabel(photo, i, settings.captureMode)} · {photo.name}{i >= needed ? ' · extra photo' : ''}</option>)}</select></label></section>
      {availablePhotos.length < needed && <p className="warning">{needed - availablePhotos.length} more photos needed. You can register these photos now and add the rest in Photos.</p>}
      {registrationPhotoIndex >= needed && <p className="warning">This extra photo can be registered now, but is not used in the sequence yet. Increase Total frames in Sheet or move this photo earlier in Photos to include it.</p>}
      <RegistrationStep key={`${registrationPhoto.id}:${settings.captureMode}`} photo={registrationPhoto} settings={settings} sheet={registrationPhotoIndex} setPoints={(id, points) => library.setPoints(id, points, settings.captureMode ?? 'sheet')} detect={library.detect} undoDetection={library.undoDetection} setFrameNumber={library.setFrameNumber} />
      <div className="step-actions"><button className="secondary" onClick={() => setStep(1)}>← Photos</button>{registrationPhotoIndex + 1 < library.photos.length ? <button className="primary" onClick={() => setPhotoIndex(registrationPhotoIndex + 1)}>Next {closeup ? 'frame' : 'sheet'} →</button> : <button className="primary" onClick={() => { setPhotoIndex(selectedPhotoIndex); setStep(3); }}>Adjust paper & tones →</button>}</div>
    </>}
    {step === 3 && layout && selectedPhoto && <>
      <section className="intro"><div><p className="eyebrow">04 / Adjust the paper</p><h1>Let the drawing <em>shine.</em></h1><p>Even out the lighting and give the whole animation a consistent look.</p></div><label className="field"><span>Photographed {closeup ? 'frame' : 'sheet'}</span><select value={selectedPhotoIndex} onChange={e => setPhotoIndex(Number(e.target.value))}>{availablePhotos.map((photo, i) => <option key={photo.id} value={i}>{photoLabel(photo, i, settings.captureMode)} · {photo.name}</option>)}</select></label></section>
      <AdjustStep key={`${selectedPhoto.id}:${settings.captureMode}`} photo={selectedPhoto} settings={settings} sheet={selectedPhotoIndex} adjustments={adjustments} setAdjustments={setAdjustments} setPaperTone={paperTone => update({ paperTone })} readiness={readiness} onBack={() => setStep(2)} onSequence={() => { setStep(4); if (!extraction.completed) void extraction.extract(); }} />
    </>}
    {step === 4 && layout && <SequenceStep closeup={closeup} receipt={receipt} photos={library.photos} numberBusy={library.busy} setFrameNumber={library.setFrameNumber} onReadNumber={id => { void library.detect(id, settings, true); }} onReadMissingNumbers={() => { void library.readMissingNumbers(settings); }} stabilize={stabilize} setStabilize={setStabilize} extraction={extraction} resolution={resolution} setResolution={setResolution} total={settings.total} readiness={readiness} sequence={sequence} setSequence={setSequence} onBack={() => setStep(selectedPhoto ? 3 : 1)} onExport={() => setStep(5)} />}
    {step === 5 && layout && <ExportStep frames={extraction.completed ? extraction.frames : []} sequence={sequence} setSequence={setSequence} options={exportOptions} setOptions={setExportOptions} onBack={() => setStep(4)} />}
    </div>
    <footer><span>Photos stay on your device.</span><span>Save project to keep your work after closing or refreshing.</span></footer>
  </main>;
}
