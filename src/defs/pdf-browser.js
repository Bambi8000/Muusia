import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import workerCode from "pdfjs-dist/build/pdf.worker.min.mjs?raw";
import { extractPdfVectors } from "./pdf-import.js";

let workerUrl;
export async function parsePdfDataUrl(dataUrl) {
  if (!/^data:[^,]*;base64,/i.test(dataUrl)) throw new Error("Choose a PDF file");
  if (!workerUrl) {
    workerUrl = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }));
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  const raw = atob(dataUrl.split(",", 2)[1]);
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("This is not a PDF file");
  return extractPdfVectors(pdfjs, bytes);
}
