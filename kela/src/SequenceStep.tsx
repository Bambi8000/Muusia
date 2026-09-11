import { useEffect, useRef, useState } from 'react';
import type { ExtractedFrame } from './frames';
import { orderedFrames, timelineFrames, moveFrame, playbackPosition } from './sequence';
import type { SequenceSettings, SequenceOrder } from './sequence';
import type { useFrames } from './useFrames';

function Player({ frames, fps, loop }: { frames: ExtractedFrame[]; fps: number; loop: boolean }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const position = useRef(0);
  const shown = frames[index];
  useEffect(() => {
    if (!playing || !frames.length) return;
    const start = position.current, time = performance.now();
    let request = 0;
    const tick = (now: number) => {
      const next = playbackPosition(start, now - time, fps, frames.length, loop);
      position.current = next.index; setIndex(next.index);
      if (next.ended) setPlaying(false); else request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, fps, loop, frames.length]);
  useEffect(() => {
    // Warm the next images without retaining a decoded copy of the entire reel.
    const upcoming = [1, 2].map(offset => frames[(index + offset) % frames.length]).filter(Boolean);
    const images = upcoming.map(frame => { const image = new Image(); image.src = frame!.url; return image; });
    return () => { images.forEach(image => { image.src = ''; }); };
  }, [frames, index]);
  useEffect(() => {
    const stop = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', stop);
    return () => document.removeEventListener('visibilitychange', stop);
  }, []);
  function seek(next: number) { setPlaying(false); position.current = next; setIndex(next); }
  return <section className="player-panel" aria-label="Animation preview">
    <div className="preview-heading"><div><p className="eyebrow">Animation preview</p><h2>Paper in motion</h2></div><span className="playback-state">{playing ? 'Playing' : 'Paused'}</span></div>
    <div className="animation-stage" style={{ aspectRatio: shown ? `${shown.width} / ${shown.height}` : '4 / 3' }}>
      {shown ? <img src={shown.url} width={shown.width} height={shown.height} alt={`Source frame ${shown.frame + 1}, sheet ${shown.sheet + 1}`} /> : <p>Include a frame below to preview the animation.</p>}
    </div>
    <div className="playback-controls"><button className="icon-button" aria-label="Previous frame" disabled={!frames.length || index === 0} onClick={() => seek(index - 1)}>←</button><button className="primary" disabled={!frames.length} onClick={() => {
      if (!playing && !loop && index === frames.length - 1) { position.current = 0; setIndex(0); }
      setPlaying(p => !p);
    }}>{playing ? 'Pause' : 'Play'}</button><button className="icon-button" aria-label="Next frame" disabled={!frames.length || index === frames.length - 1} onClick={() => seek(index + 1)}>→</button></div>
    <label className="field scrub-field"><span>Playback position · {frames.length ? index + 1 : 0} / {frames.length}</span><input aria-label="Playback position" type="range" min={1} max={Math.max(1, frames.length)} value={frames.length ? index + 1 : 1} disabled={!frames.length} onChange={e => seek(Number(e.target.value) - 1)} /></label>
    <p className="hint player-caption">{shown ? `Source frame ${shown.frame + 1} · Sheet ${shown.sheet + 1} · ${shown.width} × ${shown.height} px` : 'All frames are excluded.'}</p>
  </section>;
}

type Props = {
  extraction: ReturnType<typeof useFrames>; resolution: number; setResolution: (n: number) => void;
  stabilize: boolean; setStabilize: (value: boolean) => void;
  total: number; readiness: string; sequence: SequenceSettings; setSequence: (settings: SequenceSettings) => void;
  onBack: () => void; onExport: () => void;
};

export default function SequenceStep({ extraction, resolution, setResolution, stabilize, setStabilize, total, readiness, sequence, setSequence, onBack, onExport }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [moveNotice, setMoveNotice] = useState('');
  const frames = extraction.completed ? extraction.frames : [];
  const ordered = orderedFrames(frames, sequence), timeline = timelineFrames(frames, sequence);
  const timelineKey = timeline.map(f => f.id).join('|');
  function move(from: string, to: string) {
    const manual = moveFrame(ordered.map(f => f.id), from, to);
    setSequence({ ...sequence, order: 'Manual', manual });
    const source = frames.find(f => f.id === from);
    setMoveNotice(`Source frame ${source ? source.frame + 1 : ''} moved to position ${manual.indexOf(from) + 1}.`);
  }
  return <>
    <section className="intro"><div><p className="eyebrow">05 / Build the sequence</p><h1>Bring it <em>to life.</em></h1><p>Extract your drawings, set the rhythm and arrange the frames. Each crop comes directly from the original photograph.</p></div></section>
    <div className="extraction-bar"><div><strong>{extraction.completed ? `${frames.length} frames ready` : extraction.busy ? `Extracting frame ${Math.min(extraction.frames.length + 1, total)} of ${total}…` : 'Turn your sheets into frames'}</strong><p>{extraction.completed ? stabilize ? 'Position stabilized. Size, rotation and your paper adjustments are preserved.' : 'These frames include your latest paper and tone adjustments.' : 'Check the markers and choose your look in Adjust before extracting.'}</p></div>
      <label className="field"><span>Resolution · long side</span><select value={resolution} disabled={extraction.busy} onChange={e => setResolution(Number(e.target.value))}>{[480, 720, 1080, 2160].map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
      {extraction.busy ? <button className="secondary" onClick={extraction.cancel}>Cancel extraction</button> : <button className="primary" disabled={Boolean(readiness)} onClick={() => { void extraction.extract(); }}>{extraction.completed ? 'Extract again' : 'Extract frames'}</button>}
    </div>
    <div className="stabilization-setting"><label className="checkbox"><input type="checkbox" checked={stabilize} disabled={extraction.busy} onChange={e => setStabilize(e.target.checked)} />Stabilize position</label><p className="hint">Center one isolated drawing in every frame, keeping its size and rotation. Useful for a spinning object. Leave off when the drawing should travel across the frame. Changing this setting requires fresh extraction.</p></div>
    {readiness && <p className="warning" role="status">{readiness}</p>}
    {extraction.error && <p className="error" role="alert">{extraction.error}</p>}
    {[...new Set(frames.flatMap(f => f.warning ? [f.warning] : []))].map(warning => <p key={warning} className="warning" role="status">{warning}</p>)}
    {extraction.busy && <div className="extraction-progress" role="status"><progress aria-label="Frame extraction" value={extraction.frames.length} max={total} /><span>{extraction.frames.length} / {total} frames</span></div>}
    {extraction.completed ? <>
      <div className="sequence-workspace">
        <Player key={timelineKey} frames={timeline} fps={sequence.fps} loop={sequence.loop} />
        <section className="settings sequence-settings" aria-label="Playback settings"><fieldset><legend>Rhythm & order</legend>
          <label className="field"><span>Sequence order</span><select value={sequence.order} onChange={e => setSequence({ ...sequence, order: e.target.value as SequenceOrder })}>{(['Original', 'Reverse', 'Ping-pong', 'Manual'] as const).map(mode => <option key={mode}>{mode}</option>)}</select></label>
          <p className="hint">{sequence.order === 'Ping-pong' ? 'Forward and back, without repeating the end frames.' : sequence.order === 'Manual' ? 'Drag thumbnails or use their arrow buttons to arrange the frames.' : sequence.order === 'Reverse' ? 'Play the plotted sequence from last to first.' : 'Follow the frame order set in Sheet, across all photos.'}</p>
          <label className="field"><span>Speed · {sequence.fps} fps</span><input aria-label="Frames per second" type="range" min={1} max={30} value={sequence.fps} onChange={e => setSequence({ ...sequence, fps: Number(e.target.value) })} /></label>
          <label className="checkbox"><input type="checkbox" checked={sequence.loop} onChange={e => setSequence({ ...sequence, loop: e.target.checked })} />Loop playback</label>
        </fieldset><dl className="sequence-metrics"><div><dt>Included drawings</dt><dd>{frames.filter(f => !sequence.excluded.includes(f.id)).length} / {frames.length}</dd></div><div><dt>Playback steps</dt><dd>{timeline.length}</dd></div><div><dt>Duration</dt><dd>{(timeline.length / sequence.fps).toFixed(2)} s</dd></div></dl><p className="hint">Return to Adjust to change paper lighting or tones, or continue to Export to save your animation.</p></section>
      </div>
      <section className="frame-library" aria-label="Extracted frames"><div className="preview-heading"><div><p className="eyebrow">Your drawings</p><h2>Arrange the frames</h2></div><button className="secondary" disabled={!sequence.excluded.length} onClick={() => setSequence({ ...sequence, excluded: [] })}>Include all</button></div><p className="hint">Drag to reorder, or use the arrows. Uncheck Include to skip a drawing. Source numbers always refer to the original plotted frames.</p>
        <p role="status" className="sr-only">{moveNotice}</p>
        <ol className="frame-grid">{ordered.map((frame, i) => <li key={frame.id} className={sequence.excluded.includes(frame.id) ? 'excluded' : ''} draggable onDragStart={e => { setDragged(frame.id); e.dataTransfer.setData('text/plain', frame.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragged(null)} onDragOver={e => { if (dragged) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }} onDrop={e => { e.preventDefault(); if (dragged) move(dragged, frame.id); setDragged(null); }}>
          <img src={frame.thumbnailUrl} width={frame.width} height={frame.height} alt={`Source frame ${frame.frame + 1}`} loading="lazy" draggable={false} />
          <div className="frame-card-heading"><strong>{i + 1}</strong><span>Source {frame.frame + 1}<small>Sheet {frame.sheet + 1}</small></span></div>
          <label className="checkbox"><input aria-label={`Include source frame ${frame.frame + 1}`} type="checkbox" checked={!sequence.excluded.includes(frame.id)} onChange={e => setSequence({ ...sequence, excluded: e.target.checked ? sequence.excluded.filter(id => id !== frame.id) : [...sequence.excluded, frame.id] })} />Include</label>
          <div className="frame-move"><button className="secondary" aria-label={`Move source frame ${frame.frame + 1} earlier`} disabled={i === 0} onClick={() => move(frame.id, ordered[i - 1]!.id)}>←</button><button className="secondary" aria-label={`Move source frame ${frame.frame + 1} later`} disabled={i === ordered.length - 1} onClick={() => move(frame.id, ordered[i + 1]!.id)}>→</button></div>
        </li>)}</ol>
      </section>
    </> : !extraction.busy && <div className="preview-placeholder"><span aria-hidden="true">▷</span><h2>Your animation starts here</h2><p>Extract the frames to see the drawings move.</p></div>}
    <div className="step-actions"><button className="secondary" onClick={onBack}>← Adjust</button><button className="primary" disabled={!extraction.completed || !timeline.length} onClick={onExport}>Export animation →</button></div>
  </>;
}
