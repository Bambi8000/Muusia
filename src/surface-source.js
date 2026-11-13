import { evaluatePaperContent } from "./surface-content.js";
import { createContentPlacement, placePathsOnSurface } from "./surface-render.js";

// Decode the original image or evaluate graph geometry once per output run.
export async function prepareSurfaceSource(session, evaluateGraph) {
  const cache = new Map();
  const cached = (paper, make) => { if (!cache.has(paper.id)) cache.set(paper.id, make()); return cache.get(paper.id); };
  if (session.source.kind === "graph") {
    const ps = evaluateGraph(session.widthMm, session.heightMm, session.source.graphPath, session.source.nodeId);
    return { forPaper: paper => cached(paper, () => ({ paths: evaluatePaperContent(session, paper, evaluateGraph) })), paths: placePathsOnSurface(ps, createContentPlacement({ sourceWidth: session.widthMm, sourceHeight: session.heightMm, widthMm: session.widthMm, heightMm: session.heightMm }), session) };
  }
  const source = session.source.image;
  if (!source) throw new Error("Choose an image before printing.");
  const blob = await (await fetch(source.src)).blob(), bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    if (bitmap.width !== source.width || bitmap.height !== source.height) throw new Error("The stored image dimensions do not match the source.");
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Image rendering is unavailable.");
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { image, forPaper: paper => cached(paper, () => ({ image, placement: createContentPlacement({ sourceWidth: source.width, sourceHeight: source.height, widthMm: paper.physicalWidthMm, heightMm: paper.lengthMm, fit: session.source.fit }) })), placement: createContentPlacement({ sourceWidth: source.width, sourceHeight: source.height, widthMm: session.widthMm, heightMm: session.heightMm, fit: session.source.fit }) };
  } finally { bitmap.close(); }
}
