import { createStrip, stripTransform, stripCorners, stripsInPrintOrder } from "./surface-composer.js";
import { fontStrokes } from "./defs/helpers.js";

export const DEFAULT_ASSEMBLY = Object.freeze({ numbers: true, registration: true, dimensions: true, relations: true, artwork: true, labelMode: "off", labelLengthMm: 32, bridgeMm: 1.5, cutterFeedMm: 20 });
export function assemblySettings(input = {}) {
  const p = { ...DEFAULT_ASSEMBLY, ...input };
  for (const key of ["numbers", "registration", "dimensions", "relations", "artwork"]) if (typeof p[key] !== "boolean") throw new Error("Invalid assembly option.");
  if (!["off", "attached", "tear"].includes(p.labelMode)) throw new Error("Invalid end label mode.");
  if (!Number.isFinite(p.labelLengthMm) || p.labelLengthMm < 24 || p.labelLengthMm > 100) throw new Error("End labels must be 24–100 mm long.");
  if (!Number.isFinite(p.bridgeMm) || p.bridgeMm < .2 || p.bridgeMm > 10) throw new Error("Bridge must be 0.2–10 mm wide.");
  if (!Number.isFinite(p.cutterFeedMm) || p.cutterFeedMm < 0 || p.cutterFeedMm > 100) throw new Error("Cutter feed allowance must be 0–100 mm.");
  return Object.fromEntries(Object.keys(DEFAULT_ASSEMBLY).map(key => [key, p[key]]));
}
export const labelExtraMm = settings => { const p = assemblySettings(settings); return p.labelMode === "off" ? 0 : p.labelLengthMm; };
export const labelFeedMm = settings => { const p = assemblySettings(settings); return p.labelMode === "tear" ? p.cutterFeedMm : 0; };
export function extendedPaper(paper, settings) {
  const extra = labelExtraMm(settings), t = stripTransform(paper), centre = t.toGlobal([paper.physicalWidthMm / 2, (paper.lengthMm + extra) / 2]);
  return createStrip({ ...paper, centerXmm: centre[0], centerYmm: centre[1], lengthMm: paper.lengthMm + extra });
}
const deg = a => ((a + 180) % 360 + 360) % 360 - 180;
function paperGap(a, b) {
  const A = a.corners ?? stripCorners(a), B = b.corners ?? stripCorners(b);
  let separated = false, minOverlap = Infinity;
  for (const polygon of [A,B]) for (let i=0;i<4;i++) {
    const e = polygon[(i+1)%4], start = polygon[i], length = Math.hypot(e[0]-start[0],e[1]-start[1]);
    const axis = [-(e[1]-start[1])/length,(e[0]-start[0])/length];
    const ap = A.map(p=>p[0]*axis[0]+p[1]*axis[1]), bp = B.map(p=>p[0]*axis[0]+p[1]*axis[1]);
    const overlap = Math.min(Math.max(...ap),Math.max(...bp))-Math.max(Math.min(...ap),Math.min(...bp));
    minOverlap = Math.min(minOverlap,overlap); if (overlap < -1e-9) separated = true;
  }
  if (!separated) return { edgeGapMm:0, overlap:minOverlap>1e-9 };
  const distance = (p,a,b) => {
    const dx=b[0]-a[0],dy=b[1]-a[1], t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
  };
  let gap = Infinity;
  for (const [P,Q] of [[A,B],[B,A]]) for (const p of P) for(let i=0;i<4;i++) gap=Math.min(gap,distance(p,Q[i],Q[(i+1)%4]));
  return { edgeGapMm:gap, overlap:false };
}
export function paperRelation(a, b) {
  const dxMm = b.centerXmm - a.centerXmm, dyMm = b.centerYmm - a.centerYmm;
  return { ...paperGap(a,b), fromId: a.id, toId: b.id, dxMm, dyMm, distanceMm: Math.hypot(dxMm, dyMm), bearingDeg: Math.atan2(dyMm, dxMm) * 180 / Math.PI, relativeAngleDeg: deg(b.rotationDeg - a.rotationDeg) };
}
export function assemblyModel(session) {
  const papers = stripsInPrintOrder(session.strips).map((p, i) => {
    const corners = stripCorners(p), number = session.strips.findIndex(s => s.id === p.id) + 1;
    return { ...p, number, rank: i + 1, corners, A: corners[0], B: corners[1], C: corners[2], D: corners[3] };
  });
  return { settings: assemblySettings(session.assembly), widthMm: session.widthMm, heightMm: session.heightMm, papers, origin: "top-left; +X right; +Y down; angles clockwise; A/B are the left/right corners of the paper start edge" };
}

/** Label is additional material after the body. Art never moves or resizes.
 * Cut guide leaves the requested bridge at the paper's local left edge. */
export function endLabelPaths(session, paper, { fromMm = 0, toMm = paper.lengthMm } = {}) {
  const p = assemblySettings(session.assembly), L = toMm - fromMm;
  if (p.labelMode === "off") return { paths: [], cutPaths: [], lengthMm: 0 };
  const left = paper.printableOffsetMm, width = paper.printableWidthMm;
  const number = session.strips.findIndex(s => s.id === paper.id) + 1, t = stripTransform(paper), A = t.toGlobal([0, 0]);
  const inset = Math.min(3, width / 6), crossRadius = Math.min(2, width / 10);
  const paths = [], line = (pts, layer = 0) => paths.push({ pts, closed: false, layer });
  const text = (value, y, size = 2.2) => {
    const drawing = fontStrokes(value, size, 1), extent = Math.max(1, ...drawing.strokes.flat().map(q => q[0]));
    const scale = Math.min(1, (width - inset * 2) / extent);
    for (const stroke of drawing.strokes) line(stroke.map(([x, dy]) => [left + inset + x * scale, L + y + dy * scale]));
  };
  if (p.numbers) text(`P${number}  ORDER ${session.strips.filter(s => s.visible).sort((a,b) => a.printOrder-b.printOrder).findIndex(s => s.id === paper.id) + 1}`, 3, 3.4);
  if (p.dimensions) {
    text(`X${A[0].toFixed(1)} Y${A[1].toFixed(1)} A${paper.rotationDeg.toFixed(1)}`, 10);
    text(`${paper.physicalWidthMm.toFixed(1)} x ${paper.lengthMm.toFixed(1)} mm`, 15);
    if (fromMm || toMm !== paper.lengthMm) text(`${fromMm.toFixed(1)} - ${toMm.toFixed(1)} mm`, 20);
  }
  if (p.registration) {
    const y = L + p.labelLengthMm - 4;
    for (const x of [left + inset, left + width - inset]) { line([[x - crossRadius, y], [x + crossRadius, y]]); line([[x, y - crossRadius], [x, y + crossRadius]]); }
    text("START A LEFT / B RIGHT", p.labelLengthMm - 7, 1.8);
  }
  const cutPaths = p.labelMode === "tear" ? [{ pts: [[Math.min(p.bridgeMm, paper.physicalWidthMm), L], [paper.physicalWidthMm, L]], closed: false, layer: 0 }] : [];
  return { paths, cutPaths, lengthMm: p.labelLengthMm };
}
export function labelCutSvg(session, paper) {
  const p = assemblySettings(session.assembly), W = paper.physicalWidthMm, H = paper.lengthMm + labelExtraMm(p);
  const bridge = Math.min(p.bridgeMm, W);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><title>Paper ${paper.id}: end-label cut guide, ${bridge} mm left bridge</title><g id="cut-guide" fill="none" stroke="#f0006c" stroke-width="0.1"><path d="M${bridge} ${paper.lengthMm}H${W}"/></g></svg>`;
}

/** Machine pieces subdivide one continuous physical Roll paper. End label is
 * included once at its tail, even if it needs a short additional machine piece. */
export function assemblyPieces(session, paper) {
  const pieceLength = session.composition?.family === "Roll" ? session.composition.settings.pieceLengthMm : paper.lengthMm + labelExtraMm(session.assembly);
  const total = paper.lengthMm + labelExtraMm(session.assembly), count = Math.ceil(total / pieceLength);
  if (count > 8192) throw new Error("Too many machine pieces for Assembly PDF.");
  const t = stripTransform(paper);
  return Array.from({length:count}, (_,i) => {
    const fromMm = i * pieceLength, toMm = Math.min(total, (i+1) * pieceLength);
    return { index:i+1, fromMm, toMm, lengthMm:toMm-fromMm, labelOnly:fromMm >= paper.lengthMm, A:t.toGlobal([0,fromMm]), B:t.toGlobal([paper.physicalWidthMm,fromMm]), C:t.toGlobal([paper.physicalWidthMm,toMm]), D:t.toGlobal([0,toMm]) };
  });
}
