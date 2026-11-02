import { useEffect, useState } from "react";

export default function ResumePanel({ doc, target, result, filename, pending, onTarget, onClose, onCreate }) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setConfirmed(false); }, [doc, target, result.error]);
  return <section className="selection-inspector resume-panel" aria-label="Continue drawing">
    <div className="inspector-heading"><h2>Continue from here</h2><button className="quiet" onClick={onClose}>Cancel</button></div>
    <p className="selection-empty">Click the drawing where you stopped, or select a G-code move. Drag empty canvas to pan.</p>
    <label className="resume-field">Original G-code line<input aria-label="Continuation line" type="number" min="1" max={doc.lines.length} value={target.lineIndex == null ? "" : target.lineIndex + 1} onChange={(event) => onTarget({ lineIndex: event.target.value === "" ? null : Number(event.target.value) - 1, fraction: 0 })} /></label>
    <label className="resume-field">Start within this move <span>{Number((target.fraction * 100).toFixed(1))}%</span><input aria-label="Start within move" type="range" min="0" max="100" step="0.1" value={target.fraction * 100} onChange={(event) => onTarget({ ...target, fraction: Number(event.target.value) / 100 })} /></label>
    <p className="selection-tip">0% repeats this move. 100% continues from its endpoint. Nothing before the start is drawn again.</p>
    {result.error ? <p className="resume-error" role="alert">{result.error}</p> : <>
      <dl className="resume-summary">
        <dt>Start X / Y</dt><dd>{result.position[0].toFixed(2)} / {result.position[1].toFixed(2)} mm</dd>
        <dt>Load pen</dt><dd>{result.stroke.penIndex}: {result.penName}</dd>
        <dt>Skip / keep</dt><dd>{(result.removedLength / 1000).toFixed(2)} / {(result.remainingLength / 1000).toFixed(2)} m</dd>
        <dt>Remaining</dt><dd>{result.remainingStrokes} strokes</dd>
      </dl>
      <p className="resume-warning">No automatic homing or paper-zero setup. Prepare the machine at the original plot height with the same paper position and X/Y zero. LATU lifts the pen before travelling to the start.</p>
      {!!result.omittedStartup.length && <p className="selection-tip">Startup commands not replayed: {[...new Set(result.omittedStartup.map((item) => item.command))].join(", ")}.</p>}
      <label className="resume-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I will check the machine alignment, plot height and correct pen before running.</label>
    </>}
    <button className="primary resume-create" disabled={pending || !!result.error || !confirmed} onClick={onCreate}>Create continuation copy</button>
    <p className="selection-tip">Creates <strong>{filename}</strong> in the editor. Review with Playback, then Save. The original file is not overwritten; Undo restores the full drawing.</p>
  </section>;
}
