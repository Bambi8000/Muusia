import { useEffect, useRef } from "react";
import { receiptImageData } from "./receipt.js";

export default function ReceiptPreview({ file, onClose }) {
  const canvasRef = useRef(null);
  const receipt = file.receipt;
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
        <div className="receipt-meta">{receipt.format} · {receipt.width} × {receipt.height} dots · about {Math.round(receipt.height / 180 * 25.4)} mm long · {receipt.cut ? "cut" : "no cut"}</div>
        <div className="receipt-scroll"><canvas ref={canvasRef} aria-label="Black and white receipt image" /></div>
        <p className="receipt-note">Preview only. Receipt pixels cannot be edited as LATU G-code strokes.</p>
      </>}
      <div className="dialog-actions"><button className="primary" onClick={onClose}>Close</button></div>
    </div>
  </div>;
}
