import { useEffect, useRef, useState } from "react";
import { receiptImageData } from "./receipt.js";

export default function ReceiptPreview({ file, onClose }) {
  const canvasRef = useRef(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frames = file.frames;
  const receipt = frames ? frames[frameIndex]?.receipt : file.receipt;
  useEffect(() => {
    if (!playing || !frames || frames.length < 2) return;
    const timer = setInterval(() => setFrameIndex(index => (index + 1) % frames.length), 170);
    return () => clearInterval(timer);
  }, [playing, frames]);
  useEffect(() => {
    if (!receipt || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = receipt.width;
    canvas.height = receipt.height;
    const context = canvas.getContext("2d");
    context.putImageData(new ImageData(receiptImageData(receipt), receipt.width, receipt.height), 0, 0);
  }, [receipt]);
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="dialog receipt-dialog" role="dialog" aria-modal="true" aria-label="Receipt preview">
      <div className="receipt-head"><div><h2>Receipt preview</h2><p>{file.name}</p></div><button onClick={onClose} aria-label="Close receipt preview">×</button></div>
      {file.error ? <div className="receipt-error" role="alert">{file.error}</div> : <>
        <div className="receipt-meta">{receipt.format} · {receipt.width} × {receipt.height} dots · about {Math.round(receipt.height / 180 * 25.4)} mm long · {receipt.cut ? "cut" : "no cut"}{receipt.frame ? ` · frame ${receipt.frame}/${receipt.frameCount}` : ""}</div>
        {frames && <div className="receipt-playback">
          <button onClick={() => { setPlaying(false); setFrameIndex(index => (index - 1 + frames.length) % frames.length); }} aria-label="Previous receipt frame">◀◀</button>
          <button onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause receipt animation" : "Play receipt animation"}>{playing ? "Pause" : "Play"}</button>
          <button onClick={() => { setPlaying(false); setFrameIndex(index => (index + 1) % frames.length); }} aria-label="Next receipt frame">▶▶</button>
          <input type="range" min="0" max={frames.length - 1} value={frameIndex} onChange={event => { setPlaying(false); setFrameIndex(Number(event.target.value)); }} aria-label="Receipt animation frame" />
          <span>{frameIndex + 1} / {frames.length}</span>
        </div>}
        <div className="receipt-scroll"><canvas ref={canvasRef} aria-label="Black and white receipt image" /></div>
        <p className="receipt-note">Preview only. Receipt pixels cannot be edited as LATU G-code strokes.</p>
      </>}
      <div className="dialog-actions"><button className="primary" onClick={onClose}>Close</button></div>
    </div>
  </div>;
}
