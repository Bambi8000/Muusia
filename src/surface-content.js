import { createStrip, clipPathsToStrip, stripsInPrintOrder } from "./surface-composer.js";
import { createContentPlacement, placePathsOnSurface } from "./surface-render.js";
import { stripPrintRange } from "./surface-production.js";

/** Stable ID, not draw order, owns a paper's repeatable seed. */
export function surfacePaperContext(session, paper) {
  let seed = (session.contentSeed ?? 1) >>> 0;
  for (const c of paper.id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const ordered = stripsInPrintOrder(session.strips), rank = ordered.findIndex(p => p.id === paper.id);
  return Object.freeze({ number: session.strips.findIndex(p => p.id === paper.id) + 1, printRank: rank + 1, count: ordered.length,
    centerXmm: paper.centerXmm, centerYmm: paper.centerYmm, rotationDeg: paper.rotationDeg, widthMm: paper.physicalWidthMm, lengthMm: paper.lengthMm,
    distanceMm: Math.hypot(paper.centerXmm - session.widthMm / 2, paper.centerYmm - session.heightMm / 2), seed, t: ordered.length > 1 ? rank / (ordered.length - 1) : 0 });
}
export function evaluatePaperContent(session, paper, evaluateGraph) {
  const W = paper.physicalWidthMm, H = paper.lengthMm;
  const ps = evaluateGraph(W, H, session.source.graphPath, session.source.nodeId, surfacePaperContext(session, paper));
  return placePathsOnSurface(ps, createContentPlacement({ sourceWidth: W, sourceHeight: H, widthMm: W, heightMm: H }), { widthMm: W, heightMm: H });
}

/** Resolve against the full original paper before applying a production range.
 * Independent content has an unrotated local sampling frame; mapped content
 * retains the global surface and pose. Neither is fitted to a resume segment. */
export function resolveSurfaceContent(source, session, paper, fromMm = 0, toMm = null) {
  if (paper.contentMode === "independent") {
    if (!source.forPaper) throw new Error("Independent Content must be evaluated for this paper.");
    const local = createStrip({ ...paper, contentMode: "image-mapping", rotationDeg: 0, centerXmm: paper.physicalWidthMm / 2, centerYmm: paper.lengthMm / 2 });
    const strip = stripPrintRange(local, fromMm, toMm).strip;
    return { source: source.forPaper(paper), frame: { widthMm: paper.physicalWidthMm, heightMm: paper.lengthMm }, strip };
  }
  return { source, frame: session, strip: stripPrintRange(paper, fromMm, toMm).strip };
}
export function paperLocalPaths(source, session, paper, fromMm = 0, toMm = null) {
  const resolved = resolveSurfaceContent(source, session, paper, fromMm, toMm);
  return clipPathsToStrip(resolved.source.paths, resolved.strip);
}
