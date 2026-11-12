import { createStrip, generateStripTiling, surfaceSummary, MAX_GENERATED_STRIPS } from "./surface-composer.js";

export const SURFACE_VERSION = 1;
export const MAX_SOURCE_PIXELS = 25000000;
export const MAX_SOURCE_URL_LENGTH = 12000000;

const positive = (n, name) => {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be greater than zero.`);
  return n;
};
const id = n => typeof n === "string" && n.length > 0 || Number.isSafeInteger(n);

function layoutSettings(input) {
  const material = createStrip({ id: "settings", ...input, lengthMm: 1 });
  const gapMm = input.gapMm ?? 8;
  if (!Number.isFinite(gapMm) || gapMm < 0) throw new Error("Paper gap must not be negative.");
  const count = input.count ?? null, lengthMm = input.lengthMm ?? null;
  if (count !== null && (!Number.isSafeInteger(count) || count < 1 || count > MAX_GENERATED_STRIPS)) throw new Error("Invalid strip count.");
  if (lengthMm !== null) positive(lengthMm, "Strip length");
  return { physicalWidthMm: material.physicalWidthMm, printableWidthMm: material.printableWidthMm, printableOffsetMm: material.printableOffsetMm, rotationDeg: material.rotationDeg, gapMm, count, lengthMm };
}

export function createSurfaceSession() {
  const layout = layoutSettings({ physicalWidthMm: 80, printableWidthMm: 70.8, printableOffsetMm: 4.6, rotationDeg: 0, gapMm: 8 });
  const strips = generateStripTiling({ widthMm: 2000, heightMm: 2000, ...layout, count: undefined, lengthMm: undefined });
  return { version: SURFACE_VERSION, mode: "tiling", widthMm: 2000, heightMm: 2000, layout, strips, selectedId: strips[0].id, nextId: strips.length + 1, source: { kind: "graph", nodeId: null, graphPath: [], fit: "contain", image: null } };
}

/** Missing field = old Muusia project, with a fresh surface session. Validate
 *  before changing graph/project state so a malformed surface cannot half-load. */
export function readSurfaceSession(input) {
  if (input == null) return createSurfaceSession();
  if (input.version !== SURFACE_VERSION) throw new Error("Unsupported Surface Composer version.");
  if (!["tiling", "freeform"].includes(input.mode)) throw new Error("Unknown surface mode.");
  const widthMm = positive(input.widthMm, "Surface width"), heightMm = positive(input.heightMm, "Surface height");
  const layout = layoutSettings(input.layout || {});
  if (!Array.isArray(input.strips) || input.strips.length > MAX_GENERATED_STRIPS) throw new Error("Invalid surface strip array.");
  const strips = input.strips.map(createStrip);
  surfaceSummary(strips, { includeHidden: true }); // Includes stable-ID checks.
  const source = input.source;
  if (!source || !["graph", "image"].includes(source.kind) || !["contain", "cover"].includes(source.fit)) throw new Error("Invalid surface content source.");
  if (source.nodeId !== null && !id(source.nodeId)) throw new Error("Invalid graph node ID.");
  if (!Array.isArray(source.graphPath) || !source.graphPath.every(id)) throw new Error("Invalid graph group path.");
  let image = null;
  if (source.image != null) {
    const img = source.image;
    if (!Number.isSafeInteger(img.width) || !Number.isSafeInteger(img.height) || img.width < 1 || img.height < 1 || img.width * img.height > MAX_SOURCE_PIXELS) throw new Error("Source image exceeds the 25 megapixel limit.");
    if (typeof img.src !== "string" || img.src.length > MAX_SOURCE_URL_LENGTH || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(img.src)) throw new Error("Source must be an embedded PNG, JPEG or WebP image.");
    image = { src: img.src, width: img.width, height: img.height, name: typeof img.name === "string" ? img.name.slice(0, 300) : "Image" };
  }
  if (!Number.isSafeInteger(input.nextId) || input.nextId < 1) throw new Error("Invalid next strip ID.");
  return { version: SURFACE_VERSION, mode: input.mode, widthMm, heightMm, layout, strips, selectedId: strips.some(s => s.id === input.selectedId) ? input.selectedId : null, nextId: input.nextId, source: { kind: source.kind, nodeId: source.nodeId, graphPath: [...source.graphPath], fit: source.fit, image } };
}

export function regenerateSurface(session) {
  const strips = generateStripTiling({ widthMm: session.widthMm, heightMm: session.heightMm, ...session.layout, count: session.layout.count ?? undefined, lengthMm: session.layout.lengthMm ?? undefined });
  return { ...session, strips, selectedId: strips[0].id, nextId: strips.length + 1, mode: "tiling" };
}

export function updateSurfaceLayout(session, patch) {
  return { ...session, layout: layoutSettings({ ...session.layout, ...patch }) };
}

export function updateSurfaceStrip(session, stripId, patch) {
  if (!session.strips.some(s => s.id === stripId)) throw new Error("Strip no longer exists.");
  if (patch.id !== undefined && patch.id !== stripId) throw new Error("Strip IDs cannot change.");
  return { ...session, mode: "freeform", strips: session.strips.map(s => s.id === stripId ? createStrip({ ...s, ...patch }) : s) };
}

export function addSurfaceStrip(session, duplicateId = null) {
  if (session.strips.length >= MAX_GENERATED_STRIPS) throw new Error("Strip count limit reached.");
  const original = duplicateId ? session.strips.find(s => s.id === duplicateId) : null;
  if (duplicateId && !original) throw new Error("Strip no longer exists.");
  const ids = new Set(session.strips.map(s => s.id));
  let nextId = session.nextId, newId;
  do {
    if (!Number.isSafeInteger(nextId) || nextId >= Number.MAX_SAFE_INTEGER) throw new Error("Strip ID counter is exhausted.");
    newId = `strip-${String(nextId++).padStart(3, "0")}`;
  } while (ids.has(newId));
  const s = createStrip({
    ...session.layout, lengthMm: session.layout.lengthMm ?? session.heightMm,
    centerXmm: session.widthMm / 2, centerYmm: session.heightMm / 2,
    ...original, id: newId, visible: true,
    ...(original ? { centerXmm: original.centerXmm + 20, centerYmm: original.centerYmm + 20 } : {}),
    zIndex: session.strips.reduce((n, s) => Math.max(n, s.zIndex), -1) + 1,
    printOrder: session.strips.reduce((n, s) => Math.max(n, s.printOrder), 0) + 1,
  });
  return { ...session, strips: [...session.strips, s], selectedId: s.id, nextId, mode: "freeform" };
}

export function removeSurfaceStrip(session, stripId) {
  const strips = session.strips.filter(s => s.id !== stripId);
  return { ...session, strips, selectedId: session.selectedId === stripId ? strips[0]?.id ?? null : session.selectedId, mode: "freeform" };
}

/** Calls Muusia's real evaluator, including bound group inputs. No alternate
 *  node engine or scaling of an already evaluated small canvas is introduced. */
export function evaluateSurfaceGraph(root, graphPath, ctx, evaluate) {
  let level = root, result = evaluate(root, ctx, null);
  for (const gid of graphPath) {
    const group = level.nodes.find(node => node.id === gid);
    if (!group?.data?.bindings) throw new Error("The selected source group no longer exists.");
    const inputs = group.data.bindings.map((binding, port) => {
      const edge = level.edges.find(e => e.to === gid && e.toPort === port);
      return edge ? result.out[edge.from]?.[edge.fromPort || 0] : undefined;
    });
    level = group.data;
    result = evaluate(level, ctx, inputs);
  }
  return { level, result };
}

export function surfaceGraphLevel(root, graphPath) {
  let level = root;
  for (const gid of graphPath) {
    const group = level.nodes.find(node => node.id === gid);
    if (!group?.data?.nodes) return null;
    level = group.data;
  }
  return level;
}
