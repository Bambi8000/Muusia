import { Pin, EMPTY } from "../helpers.js";
import { placeImportedPaths } from "../import-placement.js";

export default {
  key: "pdfimport", name: "Import PDF", cat: "gen", group: "textimg",
  desc: "Import drawn vector paths from a PDF page. Images and text are skipped. Choose a page, then drag, resize or rotate the drawing in Preview.",
  ins: [Pin("style", "Style")], outs: [Pin("paths")],
  fileBinary: true, fileAccept: ".pdf,application/pdf", fileLabel: "Choose PDF…",
  params: [
    { key: "filename", label: "PDF file", type: "file", def: "" },
    { key: "page", label: "Page", type: "number", min: 1, max: 100, step: 1, def: 1 },
    { key: "fit", label: "Fit", type: "select", options: ["Fit to canvas", "Scale %"], def: "Fit to canvas" },
    { key: "scale", label: "Scale %", type: "slider", min: 1, max: 400, step: 1, def: 100, showIf: p => p.fit === "Scale %" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "offx", label: "Offset X mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
    { key: "offy", label: "Offset Y mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
    { key: "editScale", label: "Size %", type: "slider", min: 1, max: 500, step: 1, def: 100 },
    { key: "rotation", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "colmode", label: "Colors", type: "select", options: ["From PDF colors", "Single pen"], def: "Single pen" },
    { key: "layer", label: "Pen (if single)", type: "pen", def: 0, showIf: p => p.colmode === "Single pen" },
  ],
  async onFile(dataUrl) {
    const { parsePdfDataUrl } = await import("../pdf-browser.js");
    return parsePdfDataUrl(dataUrl);
  },
  compute(ins, p, ctx, node) {
    const pdf = node?.data?.svg;
    const page = pdf?.pages?.[Math.max(0, Math.min(pdf.pages.length - 1, Math.round(Number(p.page) || 1) - 1))];
    return page ? placeImportedPaths(page, p, ctx, ins[0]) : EMPTY;
  },
};
