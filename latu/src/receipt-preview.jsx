import { useEffect, useRef, useState } from "react";
import { receiptImageData } from "./receipt.js";
import { RECEIPT_RENDER_ROWS, RECEIPT_DOTS_PER_MM } from "../../src/receipt-format.js";

export default function ReceiptPreview({ file, onClose }) {
  const canvasRefs = useRef([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewStart, setPreviewStart] = useState(0);
  const frames = file.frames;
  const receipt = frames ? frames[frameIndex]?.receipt : file.receipt;
  // Keep decoded canvas memory bounded even for a 50 m roll. The packed bitmap
  // remains intact; the position control only selects the visible section.
  const windowed = !!receipt && receipt.height > 8192;
  const visibleRows = receipt ? Math.min(receipt.height, windowed ? 4096 : 8192) : 0;
  const maxStart = receipt ? receipt.height - visibleRows : 0;
  const startRow = Math.min(previewStart, maxStart);
  const tileCount = Math.ceil(visibleRows / RECEIPT_RENDER_ROWS);
  useEffect(() => {
    if (!playing || !frames || frames.length < 2) return;
    const timer = setInterval(() => setFrameIndex(index => (index + 1) % frames.length), 170);
    return () => clearInterval(timer);
  }, [playing, frames]);
  useEffect(() => {
    if (!receipt) return;
    for (let i = 0; i < tileCount; i++) {
      const canvas = canvasRefs.current[i];
      if (!canvas) continue;
      const row = startRow + i * RECEIPT_RENDER_ROWS, rows = Math.min(RECEIPT_RENDER_ROWS, startRow + visibleRows - row);
      if (rows < 1) continue;
      canvas.width = receipt.width;
      canvas.height = rows;
      const context = canvas.getContext("2d");
      context.putImageData(new ImageData(receiptImageData(receipt, row, rows), receipt.width, rows), 0, 0);
    }
  }, [receipt, startRow, visibleRows, tileCount]);
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="dialog receipt-dialog" role="dialog" aria-modal="true" aria-label="Receipt preview">
      <div className="receipt-head"><div><h2>Receipt preview</h2><p>{file.name}</p></div><button onClick={onClose} aria-label="Close receipt preview">×</button></div>
      {file.error ? <div className="receipt-error" role="alert">{file.error}</div> : <>
        <div className="receipt-meta">{receipt.format} · {receipt.width} × {receipt.height} dots · about {Math.round(receipt.height / RECEIPT_DOTS_PER_MM)} mm long · {receipt.cut ? "cut" : "no cut"}{receipt.frame ? ` · frame ${receipt.frame}/${receipt.frameCount}` : ""}</div>
        {frames && <div className="receipt-playback">
          <button onClick={() => { setPlaying(false); setFrameIndex(index => (index - 1 + frames.length) % frames.length); }} aria-label="Previous receipt frame">◀◀</button>
          <button onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause receipt animation" : "Play receipt animation"}>{playing ? "Pause" : "Play"}</button>
          <button onClick={() => { setPlaying(false); setFrameIndex(index => (index + 1) % frames.length); }} aria-label="Next receipt frame">▶▶</button>
          <input type="range" min="0" max={frames.length - 1} value={frameIndex} onChange={event => { setPlaying(false); setFrameIndex(Number(event.target.value)); }} aria-label="Receipt animation frame" />
          <span>{frameIndex + 1} / {frames.length}</span>
        </div>}
        {windowed && <label className="receipt-meta">Preview position · {Math.round(startRow / RECEIPT_DOTS_PER_MM)}–{Math.round((startRow + visibleRows) / RECEIPT_DOTS_PER_MM)} mm
          <input type="range" min="0" max={maxStart} step="1" value={startRow} aria-label="Receipt preview position" onChange={event => setPreviewStart(Number(event.target.value))} style={{ width: "100%" }} />
        </label>}
        <div className="receipt-scroll"><div className="receipt-paper" role="img" aria-label="Black and white receipt image">
          {Array.from({ length: tileCount }, (_, i) => <canvas key={i} ref={element => { canvasRefs.current[i] = element; }} aria-hidden="true" style={{ display: "block" }} />)}
        </div></div>
        <p className="receipt-note">Preview only. Receipt pixels cannot be edited as LATU G-code strokes.</p>
      </>}
      <div className="dialog-actions"><button className="primary" onClick={onClose}>Close</button></div>
    </div>
  </div>;
}
