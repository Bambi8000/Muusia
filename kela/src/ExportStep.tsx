import { useMemo } from 'react';
import type { ExtractedFrame } from './frames';
import type { SequenceSettings } from './sequence';
import { buildExportPlan } from './export-plan';
import type { ExportOptions, ExportPlan } from './export-plan';
import { useExport, useVideoSupport } from './useExport';

type Props = { frames: ExtractedFrame[]; sequence: SequenceSettings; setSequence: (value: SequenceSettings) => void; options: ExportOptions; setOptions: (value: ExportOptions) => void; onBack: () => void };
const sizeLabel = (bytes: number) => bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;

export default function ExportStep({ frames, sequence, setSequence, options, setOptions, onBack }: Props) {
  const { plan, issue } = useMemo((): { plan: ExportPlan | null; issue: string } => {
    try { return { plan: frames.length ? buildExportPlan(frames, sequence, options) : null, issue: '' }; }
    catch (error) { return { plan: null, issue: error instanceof Error ? error.message : 'Check your export settings.' }; }
  }, [frames, sequence, options]);
  const job = useExport(plan), support = useVideoSupport(plan);
  const format = options.format === 'video' ? (options.videoFormat === 'webm' || support.format === 'webm' || job.result?.format === 'webm') ? 'WebM' : 'MP4' : options.format === 'gif' ? 'GIF' : 'PNG ZIP';
  const result = job.result;
  const update = (patch: Partial<ExportOptions>) => setOptions({ ...options, ...patch });
  return <>
    <section className="intro"><div><p className="eyebrow">06 / Export your animation</p><h1>Ready to <em>roll.</em></h1><p>Keep the movement as a GIF or video, or take the individual drawings into your next project.</p></div></section>
    {!frames.length ? <div className="preview-placeholder"><span aria-hidden="true">↗</span><h2>Build your frames first</h2><p>Open Sequence and extract your drawings before exporting.</p><button className="primary" onClick={onBack}>Go to Sequence →</button></div> : <div className="workspace export-workspace">
      <section className="settings" aria-label="Export settings">
        <fieldset><legend>Make it yours</legend>
          <label className="field"><span>File format</span><select value={options.format} onChange={e => update({ format: e.target.value as ExportOptions['format'] })}><option value="gif">Animated GIF</option><option value="video">Video</option><option value="png">PNG frames · ZIP</option></select></label>
          <label className="field"><span>Export size · long side</span><select value={options.longSide} onChange={e => update({ longSide: Number(e.target.value) })}><option value={0}>Original · {Math.max(frames[0]!.width, frames[0]!.height)} px</option>{[480, 720, 1080].filter(n => n < Math.max(frames[0]!.width, frames[0]!.height) || n === options.longSide).map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
          <label className="field"><span>Speed · {sequence.fps} fps</span><input aria-label="Frames per second" type="range" min={1} max={30} value={sequence.fps} onChange={e => setSequence({ ...sequence, fps: Number(e.target.value) })} /></label>
          <p className="hint">Uses your Sequence order and exclusions. Speed changes also update the preview in Sequence.</p>
        </fieldset>
        <fieldset><legend>{options.format === 'gif' ? 'GIF options' : options.format === 'video' ? 'Video options' : 'Individual drawings'}</legend>
          {options.format === 'gif' && <>
            <label className="checkbox"><input type="checkbox" checked={sequence.loop} onChange={e => setSequence({ ...sequence, loop: e.target.checked })} />Loop forever</label>
            <label className="checkbox"><input type="checkbox" checked={options.dither} onChange={e => update({ dither: e.target.checked })} />Dither colors</label>
            <p className="hint">A shared palette keeps colors consistent. Dithering softens color steps with fine dots. GIF timing is rounded to hundredths of a second.</p>
          </>}
          {options.format === 'video' && <>
            <label className="field"><span>Video format</span><select value={options.videoFormat} onChange={e => update({ videoFormat: e.target.value as ExportOptions['videoFormat'] })}><option value="auto">MP4 · automatic WebM fallback</option><option value="webm">WebM</option></select></label>
            <div className="field-row"><label className="field"><span>Quality</span><select value={options.quality} onChange={e => update({ quality: e.target.value as ExportOptions['quality'] })}><option>Standard</option><option>High</option></select></label><label className="field"><span>Repeats</span><input type="number" min={1} max={20} step={1} value={options.loops} onChange={e => update({ loops: Number(e.target.value) })} /></label></div>
            <p className="hint">Repeat the whole sequence 1–20 times in one silent video. This sets the file length independently of Loop playback.</p>
            {plan && <p className="notice" role="status">{support.checking ? 'Checking video support…' : support.format === 'mp4' ? 'MP4 export is available in this browser.' : support.format === 'webm' ? options.videoFormat === 'auto' ? 'MP4 is unavailable here. Your video will be a WebM file.' : 'WebM export is available in this browser.' : 'Video export is unavailable at this size. Try a smaller size, or choose GIF or PNG ZIP.'}</p>}
          </>}
          {options.format === 'png' && <p className="hint">One complete sequence, with numbered lossless PNG files and a sequence.json guide for timing and source frames. Ping-pong includes the return journey.</p>}
        </fieldset>
      </section>
      <section className="export-output" aria-label="Export result">
        <div className="preview-heading"><div><p className="eyebrow">Your finished reel</p><h2>{result ? 'Made from paper' : 'Create your file'}</h2></div><span className="playback-state">{format}</span></div>
        {plan && <dl className="metrics"><div><dt>Size</dt><dd>{plan.width} × {plan.height}<small>pixels</small></dd></div><div><dt>Length</dt><dd>{plan.duration.toFixed(2)} s<small>{plan.fps} fps</small></dd></div><div><dt>Frames</dt><dd>{plan.frameCount}<small>{options.format === 'video' ? `${options.loops} repeats` : 'one sequence'}</small></dd></div></dl>}
        {result ? <>
          {result.format === 'gif' ? <div className="export-media"><img src={result.url} width={result.width} height={result.height} alt="Exported GIF animation" /></div> : result.format !== 'png' ? <div className="export-media"><video src={result.url} width={result.width} height={result.height} controls playsInline preload="metadata" aria-label="Exported video" /></div> : <div className="export-zip"><span aria-hidden="true">▤</span><h2>{result.frames} drawings, packed.</h2><p>Numbered PNG files and a timing guide, ready for your next project.</p></div>}
          <div className="export-download"><div><strong>{result.format === 'png' ? 'PNG ZIP' : result.format.toUpperCase()} ready</strong><p>{sizeLabel(result.blob.size)} · {result.width} × {result.height} px · {result.duration.toFixed(2)} s</p></div><a className="primary" href={result.url} download={`liike-${result.width}x${result.height}-${sequence.fps}fps.${result.format === 'png' ? 'zip' : result.format}`}>Download {result.format === 'png' ? 'ZIP' : result.format.toUpperCase()} ↓</a></div>
          {result.note && <p className="notice" role="status">{result.note}</p>}
        </> : <div className="export-empty"><span aria-hidden="true">↗</span><p>{job.busy ? 'Your file is taking shape.' : 'Your animation will appear here when the file is ready.'}</p></div>}
        {issue && <p className="warning" role="status">{issue}</p>}
        {job.error && <p className="error" role="alert">{job.error}</p>}
        {job.busy && <div className="extraction-progress" role="status"><progress aria-label="File export" value={job.progress?.done ?? 0} max={job.progress?.total ?? 1} /><span>{job.progress ? `${job.progress.phase} · ${job.progress.done} / ${job.progress.total}` : 'Starting export…'}</span></div>}
        <div className="export-actions">{job.busy ? <button className="secondary" onClick={job.cancel}>Cancel export</button> : <button className={result ? 'secondary' : 'primary'} disabled={!plan || (options.format === 'video' && (support.checking || !support.format))} onClick={() => { void job.create(); }}>{result ? 'Create again' : `Create ${format}`}</button>}</div>
        <p className="hint">Download your file before leaving this step. Changing export settings clears the previous file.</p>
      </section>
    </div>}
    <div className="step-actions"><button className="secondary" onClick={onBack}>← Sequence</button></div>
  </>;
}
