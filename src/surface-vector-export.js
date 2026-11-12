import { clipPathsToStrip, stripsInPrintOrder } from "./surface-composer.js";
import { cropTestPiece } from "./preview-crop.js";
import { readSurfaceSession } from "./surface-session.js";
import { compositionPieces, regularCompositionMatches } from "./surface-layouts.js";
import { prepareSurfaceSource } from "./surface-source.js";

/** Existing slicers own regular grids and production marks. Freeform drawings
 * use the shared depth/metadata-preserving crop in each paper's own coordinates. */
export function surfaceVectorTiles(session, globalPaths, { sliceMega, sliceRoll, fontStrokes }, { selectedOnly = false } = {}) {
  const family = session.composition?.family;
  if (!family) throw new Error("Choose Mega Canvas or Roll Mode for vector layout export.");
  const p = session.composition.settings, regular = regularCompositionMatches(session);
  if (regular) {
    const g = session.composition.generated;
    if (family === "Roll" && Math.ceil(g.rollLengthMm / p.pieceLengthMm) * g.rollCount > 8192) throw new Error("Too many export pieces; increase the piece length.");
    const tiles = family === "Sheets"
      ? sliceMega(globalPaths, g.sheetWidthMm, g.sheetHeightMm, g.columns, g.rows, g.seamMm, g.join, p.marks, p.markPen, p.labels).map(t => ({ ...t, W: g.sheetWidthMm, H: g.sheetHeightMm }))
      : sliceRoll(globalPaths, g.rollWidthMm, p.pieceLengthMm, g.rollCount, g.rollLengthMm, g.seamMm, g.join, p.marks, p.markPen, p.labels);
    return tiles.map((tile, i) => {
      const columns = family === "Sheets" ? g.columns : g.rollCount, row = Math.floor(i / columns), column = i % columns;
      const paper = session.strips[family === "Sheets" ? i : column];
      return { ...tile, stripId: paper.id, number: session.strips.indexOf(paper) + 1, piece: family === "Roll" ? row + 1 : 1, fromMm: family === "Roll" ? row * p.pieceLengthMm : 0,
        tag: family === "Sheets" ? `tile-${String(i + 1).padStart(2, "0")}-r${row + 1}c${column + 1}` : `strip-${String(column + 1).padStart(2, "0")}-piece-${String(row + 1).padStart(2, "0")}` };
    }).filter(t => !selectedOnly || t.stripId === session.selectedId);
  }
  const papers = stripsInPrintOrder(session.strips).filter(s => !selectedOnly || s.id === session.selectedId), result = [];
  for (const paper of papers) {
    const local = clipPathsToStrip(globalPaths, paper), number = session.strips.findIndex(s => s.id === paper.id) + 1;
    const pieces = compositionPieces(session, paper);
    if (result.length + pieces.length > 8192) throw new Error("Too many export pieces; export papers separately or increase piece length.");
    const marks = family === "Sheets"
      ? sliceMega({ paths: [] }, paper.physicalWidthMm, paper.lengthMm, 1, 1, 0, "Gap", p.marks, p.markPen, false)
      : sliceRoll({ paths: [] }, paper.physicalWidthMm, p.pieceLengthMm, 1, paper.lengthMm, 0, "Gap", p.marks, p.markPen, false);
    for (const piece of pieces) {
      const drawing = cropTestPiece(local, { x: 0, y: piece.fromMm, w: piece.widthMm, h: piece.lengthMm, margin: 0 });
      const paths = [...drawing.paths, ...marks[piece.index].paths];
      if (p.labels) for (const stroke of fontStrokes(family === "Sheets" ? `${number}` : `S${number} P${piece.index + 1}`, 4, 1).strokes) paths.push({ pts: stroke.map(([x, y]) => [6 + x, piece.lengthMm - 11 + y]), closed: false, layer: p.markPen });
      result.push({ paths, W: piece.widthMm, H: piece.lengthMm, stripId: paper.id, number, piece: piece.index + 1, fromMm: piece.fromMm,
        tag: family === "Sheets" ? `sheet-${String(number).padStart(2, "0")}` : `strip-${String(number).padStart(2, "0")}-piece-${String(piece.index + 1).padStart(2, "0")}` });
    }
  }
  return result;
}

export async function surfaceVectorFiles(input, kind, options, services) {
  const session = readSurfaceSession(input);
  if (session.source.kind !== "graph") throw new Error("Vector export requires a graph output. Use PNG for an image source.");
  if (!["svg", "dxf", "gcode"].includes(kind)) throw new Error("Unknown export format.");
  const source = await prepareSurfaceSource(session, services.evaluateGraph);
  const paths = services.preparePaths ? services.preparePaths(source.paths) : source.paths;
  const tiles = options.sourceOnly ? [{ ...paths, W: session.widthMm, H: session.heightMm, tag: "source" }] : surfaceVectorTiles(session, paths, services, options);
  if (!tiles.length) throw new Error("Select a visible paper to export.");
  const prefix = String(options.projectName || "surface").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80), files = [];
  let bytes = 0;
  for (const tile of tiles) {
    if (services.cancelled?.()) throw new Error("Export cancelled.");
    if (files.length % 32 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    const text = services.exportText(kind, tile, tile.W, tile.H);
    bytes += new TextEncoder().encode(text).length;
    if (bytes > 128 * 1024 * 1024) throw new Error("Export exceeds 128 MiB. Export papers separately.");
    files.push({ name: `${prefix}-${tile.tag}.${kind === "gcode" ? "gcode" : kind}`, text });
  }
  return { files, tiles, regular: regularCompositionMatches(session) };
}
