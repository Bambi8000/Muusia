import { formatPlaybackTime } from "./sim.js";

const SPEEDS = [1, 2, 5, 10, 25, 50, 100];

export default function PlaybackPanel({ timeline, time, playing, speed, autoFollow, penWidths, paperColor, onPaperColor, onPenWidth, onTime, onPlaying, onSpeed, onAutoFollow, onClose, onChapter }) {
  const percent = timeline.total ? time / timeline.total * 100 : 0;
  return <section className="playback-panel" aria-label="Playback">
    <div className="playback-controls">
      <button aria-label={playing ? "Pause playback" : "Play playback"} className="play-button" onClick={() => onPlaying(!playing)} disabled={!timeline.total}>{playing ? "Ⅱ" : "▶"}</button>
      <button onClick={() => { onPlaying(false); onTime(0); }} disabled={!time}>↺</button>
      <strong>{formatPlaybackTime(time)}</strong><span>/ {formatPlaybackTime(timeline.total)}</span>
      <label>Speed<select aria-label="Playback speed" value={speed} onChange={(event) => onSpeed(Number(event.target.value))}>{SPEEDS.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
      <label className="follow-toggle"><input type="checkbox" checked={autoFollow} onChange={(event) => onAutoFollow(event.target.checked)} /> Follow text</label>
      <label className="paper-picker">Paper color<input aria-label="Playback paper color" type="color" value={paperColor} onChange={(event) => onPaperColor(event.target.value)} /></label>
      <button className="playback-close" onClick={onClose}>Close</button>
    </div>
    <div className="timeline-wrap">
      <input aria-label="Playback timeline" type="range" min="0" max={timeline.total || 1} step="0.01" value={Math.min(time, timeline.total || 1)} onChange={(event) => onTime(Number(event.target.value))} style={{ "--progress": `${percent}%` }} />
      <div className="chapter-marks">{timeline.chapters.map((chapter, index) => <button key={`${chapter.lineIndex}-${index}`} aria-label={`Pause: ${chapter.label}`} title={chapter.label} style={{ left: `${timeline.total ? chapter.time / timeline.total * 100 : 0}%` }} onClick={() => onChapter(chapter)} />)}</div>
    </div>
    <div className="pen-times">
      <div className="pen-times-title">Playback pen widths (mm)</div>
      <div className="pen-time-head"><span>Pen</span><span>Width</span><span>Draw</span><span>Travel</span><span>Wait</span><strong>Total</strong></div>
      {timeline.perPen.map((pen) => <div className="pen-time-row" key={pen.penIndex}><span><i style={{ background: pen.color }} />{pen.penIndex}: {pen.name}</span><label><input aria-label={`Pen ${pen.penIndex} width`} type="number" min="0.05" max="20" step="0.05" value={penWidths[pen.penIndex] ?? 0.3} onChange={(event) => onPenWidth(pen.penIndex, event.target.value)} /> mm</label><span>{formatPlaybackTime(pen.draw)}</span><span>{formatPlaybackTime(pen.travel)}</span><span>{formatPlaybackTime(pen.dwell + pen.settle + pen.other)}</span><strong>{formatPlaybackTime(pen.total)}</strong></div>)}
    </div>
  </section>;
}
