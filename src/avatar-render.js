/**
 * Avatar mesh inspection: object-space clipping, fixed-scale projection and a
 * small software shaded renderer. No DOM or third-party dependency at import.
 * Coordinates are X across the body, Y depth (front is negative), Z upward.
 */
const EPS = 1e-9;
const BOUNDS_CACHE = new WeakMap();
const INDEX_CACHE = new WeakMap();
const CLIP_CACHE = new WeakMap();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const number = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const d = Math.hypot(...a) || 1; return a.map(v => v / d); };
const key3 = p => p.map(v => Math.round(v * 1e8)).join(',');
const interpolate = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < EPS;

export function avatarBounds(mesh) {
  if (mesh && BOUNDS_CACHE.has(mesh)) return BOUNDS_CACHE.get(mesh);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < (mesh?.v?.length || 0); i += 3) for (let k = 0; k < 3; k++) {
    const v = mesh.v[i + k];
    if (!Number.isFinite(v)) continue;
    min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v);
  }
  if (!Number.isFinite(min[0])) { min.fill(0); max.fill(0); }
  const result = { min, max, center: min.map((v, k) => (v + max[k]) / 2), dims: min.map((v, k) => max[k] - v) };
  if (mesh) BOUNDS_CACHE.set(mesh, result);
  return result;
}

function triangleArea(a, b, c) { return Math.hypot(...cross(sub(b, a), sub(c, a))); }
function emitTriangle(out, a, b, c) {
  if (triangleArea(a, b, c) > 1e-15) out.push(...a, ...b, ...c);
}
function clipPolygon(poly, z, above) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ai = above ? a[2] >= z - EPS : a[2] <= z + EPS;
    const bi = above ? b[2] >= z - EPS : b[2] <= z + EPS;
    if (ai) out.push(a);
    if (ai !== bi && Math.abs(b[2] - a[2]) > EPS) {
      const p = interpolate(a, b, clamp((z - a[2]) / (b[2] - a[2]), 0, 1)); p[2] = z; out.push(p);
    }
  }
  return out.filter((p, i) => i === 0 || !same(p, out[i - 1])).filter((p, i, all) => i !== all.length - 1 || all.length < 2 || !same(p, all[0]));
}
function planeSegment(triangle, z) {
  const points = [];
  const push = p => { if (!points.some(q => same(p, q))) points.push(p); };
  if (triangle.every(p => Math.abs(p[2] - z) <= EPS)) return null;
  for (let i = 0; i < 3; i++) {
    const a = triangle[i], b = triangle[(i + 1) % 3], da = a[2] - z, db = b[2] - z;
    if (Math.abs(da) <= EPS) push([a[0], a[1], z]);
    if (da * db < -EPS * EPS) { const q = interpolate(a, b, da / (da - db)); q[2] = z; push(q); }
  }
  return points.length === 2 && !same(points[0], points[1]) ? points : null;
}

/** Join plane/mesh intersection segments into ordered loops, retaining vertices. */
function sectionLoops(segments, plane) {
  const unique = new Map();
  for (const [a, b] of segments) {
    const ka = key3(a), kb = key3(b), key = ka < kb ? ka + ':' + kb : kb + ':' + ka;
    if (ka !== kb && !unique.has(key)) unique.set(key, [a, b]);
  }
  const edges = [...unique.values()], adjacent = new Map(), used = new Uint8Array(edges.length);
  edges.forEach((edge, i) => edge.forEach(p => { const k = key3(p); if (!adjacent.has(k)) adjacent.set(k, []); adjacent.get(k).push(i); }));
  const loops = [];
  const walk = (first, start) => {
    const pts = [start], startKey = key3(start); let tail = startKey, i = first;
    while (!used[i]) {
      used[i] = 1; const edge = edges[i], p = key3(edge[0]) === tail ? edge[1] : edge[0];
      pts.push(p); tail = key3(p);
      if (tail === startKey) break;
      const next = (adjacent.get(tail) || []).find(n => !used[n]);
      if (next === undefined) break; i = next;
    }
    const closed = tail === startKey;
    if (closed) pts.pop();
    if (pts.length >= (closed ? 3 : 2)) loops.push({ pts, closed, plane });
  };
  for (const [key, ids] of adjacent) if (ids.length !== 2) for (const i of ids) if (!used[i]) walk(i, edges[i].find(p => key3(p) === key));
  for (let i = 0; i < edges.length; i++) if (!used[i]) walk(i, edges[i][0]);
  return loops;
}
function polygonArea(points) {
  let area = 0; for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; area += a[0] * b[1] - b[0] * a[1]; } return area / 2;
}
function pointInside(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function addCap(out, path, facingUp) {
  if (!path.closed || path.pts.length < 3) return;
  const pts = path.pts, area = polygonArea(pts);
  if (Math.abs(area) < 1e-14) return;
  const ids = Array.from({ length: pts.length }, (_, i) => i);
  if (area < 0) ids.reverse();
  // A centroid fan preserves every intersection vertex and is exact for the
  // star-shaped cross sections of this avatar. Ear clipping handles concavity.
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], t = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * t; cy += (a[1] + b[1]) * t;
  }
  const center = [cx / (6 * area), cy / (6 * area), pts[0][2]];
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const fanSafe = pointInside(center, pts) && ids.every((id, i) => orient(pts[id], pts[ids[(i + 1) % ids.length]], center) >= -1e-12);
  const cap = (a, b, c) => facingUp ? emitTriangle(out, a, b, c) : emitTriangle(out, c, b, a);
  if (fanSafe) {
    for (let i = 0; i < ids.length; i++) cap(center, pts[ids[i]], pts[ids[(i + 1) % ids.length]]);
    return;
  }
  let safety = ids.length * ids.length;
  while (ids.length > 3 && safety-- > 0) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = pts[ids[(j + ids.length - 1) % ids.length]], b = pts[ids[j]], c = pts[ids[(j + 1) % ids.length]];
      if (orient(a, b, c) <= 1e-14) continue;
      const interior = ids.some(id => {
        const p = pts[id]; if (p === a || p === b || p === c) return false;
        return orient(a, b, p) > 1e-13 && orient(b, c, p) > 1e-13 && orient(c, a, p) > 1e-13;
      });
      if (interior) continue; cap(a, b, c); ids.splice(j, 1); found = true; break;
    }
    if (!found) break;
  }
  if (ids.length === 3) cap(...ids.map(i => pts[i]));
}
function getCutRange(mesh, options) {
  const bounds = avatarBounds(mesh), reference = mesh.cutReferenceBounds || mesh.sourceBounds || bounds;
  const low = reference.min[2], high = reference.max[2], height = Math.max(EPS, high - low);
  const mode = String(options.mode || 'Full body').toLowerCase();
  const lowerCut = ['bust','keep above','above','band','keep between'].includes(mode);
  const upperCut = ['feet','keep below','below','band','keep between'].includes(mode);
  const landmark = (fractionName, absoluteName, fallback) => {
    const landmarks = mesh.poseLandmarks || mesh.cutReferenceLandmarks || mesh.landmarks;
    const absolute = landmarks?.[absoluteName];
    return Number.isFinite(absolute) ? (absolute - low) / height : number(landmarks?.[fractionName], fallback);
  };
  let lo = (bounds.min[2] - low) / height, hi = (bounds.max[2] - low) / height;
  if (mode === 'bust' || mode === 'keep above' || mode === 'above') lo = clamp(number(options.cut, landmark('bust', 'bustCut', .70)), 0, 1);
  else if (mode === 'feet' || mode === 'keep below' || mode === 'below') hi = clamp(number(options.cut, landmark('feet', 'feetCut', .09)), 0, 1);
  else if (mode === 'band' || mode === 'keep between') {
    const center = clamp(number(options.cut, .5), 0, 1), thickness = clamp(number(options.band ?? options.thickness, .14), 0, 1);
    lo = clamp(center - thickness / 2, 0, 1); hi = clamp(center + thickness / 2, 0, 1);
  }
  return { range: [low + lo * height, low + hi * height], fractions: [lo, hi], bounds, reference, planes:[lowerCut?low+lo*height:null,upperCut?low+hi*height:null] };
}

/** Cut in source body coordinates. Crops deliberately never re-normalize. */
export function clipAvatarMesh(mesh, options = {}) {
  if (!mesh || !mesh.v || mesh.v.length % 9) return { kind: 'mesh', tri: 0, v: [], dims: [0, 0, 0], sectionPaths: [], sourceBounds: { min: [0, 0, -.5], max: [0, 0, .5] }, cutRange: [0, 0], capStart: 0 };
  const { range: [lo, hi], fractions, bounds, reference, planes } = getCutRange(mesh, options);
  const cacheKey = `${lo.toFixed(8)}:${hi.toFixed(8)}:${options.cap !== false}:${planes.map(v=>v===null?'-':v.toFixed(8)).join(':')}`;
  let cache = CLIP_CACHE.get(mesh); if (!cache) { cache = new Map(); CLIP_CACHE.set(mesh, cache); }
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const finish = (v, sectionPaths, capStart) => {
    const result = { ...mesh, kind: 'mesh', tri: v.length / 9, v, sectionPaths, sourceBounds: reference, cutRange: [lo, hi], cutFractions: fractions, cutPlanes:planes, capStart };
    const retainedBounds = avatarBounds(result);
    result.dims = retainedBounds.dims; result.bounds = { min: retainedBounds.min, max: retainedBounds.max };
    if (v !== mesh.v) { delete result.vertices; delete result.indices; }
    if (cache.size >= 12) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, result); return result;
  };
  if (hi - lo <= EPS || mesh.v.length === 0) return finish([], [], 0);
  if (lo <= bounds.min[2] + EPS && hi >= bounds.max[2] - EPS) return finish(mesh.v, [], mesh.tri ?? mesh.v.length / 9);
  const out = [], lower = [], upper = [], v = mesh.v;
  const useLower = lo > bounds.min[2] + EPS, useUpper = hi < bounds.max[2] - EPS;
  for (let i = 0; i < v.length; i += 9) {
    const tri = [v.slice(i, i + 3), v.slice(i + 3, i + 6), v.slice(i + 6, i + 9)];
    if (useLower) { const segment = planeSegment(tri, lo); if (segment) lower.push(segment); }
    if (useUpper) { const segment = planeSegment(tri, hi); if (segment) upper.push(segment); }
    let poly = useLower ? clipPolygon(tri, lo, true) : tri;
    if (useUpper && poly.length) poly = clipPolygon(poly, hi, false);
    for (let j = 1; j + 1 < poly.length; j++) emitTriangle(out, poly[0], poly[j], poly[j + 1]);
  }
  const sections = [...sectionLoops(lower, lo), ...sectionLoops(upper, hi)], capStart = out.length / 9;
  if (options.cap !== false) for (const path of sections) addCap(out, path, Math.abs(path.plane - hi) < EPS);
  return finish(out, sections, capStart);
}

function indexed(mesh) {
  if (INDEX_CACHE.has(mesh)) return INDEX_CACHE.get(mesh);
  const vertices = [], faces = [], map = new Map(), normals = [], faceNormals = [], edges = new Map(), faceCaps = [];
  let volume = 0;
  for (let i = 0; i < mesh.v.length; i += 9) {
    const a = mesh.v.slice(i, i + 3), b = mesh.v.slice(i + 3, i + 6), c = mesh.v.slice(i + 6, i + 9);
    volume += dot(a, cross(b, c));
  }
  const flip = volume < 0 ? -1 : 1;
  for (let i = 0; i < mesh.v.length; i += 9) {
    const points = [mesh.v.slice(i, i + 3), mesh.v.slice(i + 3, i + 6), mesh.v.slice(i + 6, i + 9)];
    const ids = points.map(p => {
      const key = key3(p); if (map.has(key)) return map.get(key);
      const id = vertices.length; map.set(key, id); vertices.push(p); normals.push([0, 0, 0]); return id;
    });
    const weighted = cross(sub(points[1], points[0]), sub(points[2], points[0])).map(x => x * flip);
    const fidx = faces.length, cap = fidx >= (mesh.capStart ?? Infinity);
    faces.push(ids); faceNormals.push(unit(weighted)); faceCaps.push(cap);
    if (!cap) for (const id of ids) for (let k = 0; k < 3; k++) normals[id][k] += weighted[k];
    for (let k = 0; k < 3; k++) {
      const a = ids[k], b = ids[(k + 1) % 3], key = a < b ? a + ':' + b : b + ':' + a;
      if (edges.has(key)) edges.get(key).faces.push(fidx); else edges.set(key, { a, b, faces: [fidx] });
    }
  }
  const averaged = normals.map(unit), sums = averaged.map(n => [...n]), counts = new Uint16Array(vertices.length); counts.fill(1);
  for (const edge of edges.values()) {
    if (Math.hypot(...averaged[edge.a]) < EPS || Math.hypot(...averaged[edge.b]) < EPS) continue;
    for (let k = 0; k < 3; k++) { sums[edge.a][k] += averaged[edge.b][k]; sums[edge.b][k] += averaged[edge.a][k]; }
    counts[edge.a]++; counts[edge.b]++;
  }
  const smoothNormals = averaged.map((n, i) => unit(n.map((v, k) => v * .55 + sums[i][k] / counts[i] * .45)));
  const result = { vertices, faces, normals: smoothNormals, faceNormals, edges: [...edges.values()], faceCaps };
  INDEX_CACHE.set(mesh, result); return result;
}
function transformer(options) {
  const yaw = number(options.yaw, 0) * Math.PI / 180, pitch = number(options.pitch, 0) * Math.PI / 180, roll = number(options.roll, 0) * Math.PI / 180;
  const ca = Math.cos(yaw), sa = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  return p => {
    const x = p[0] * ca - p[1] * sa, y = p[0] * sa + p[1] * ca;
    const z = y * sp + p[2] * cp, depth = -(y * cp - p[2] * sp);
    return [x * cr + z * sr, x * sr - z * cr, depth];
  };
}
function bounds2(points) {
  const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (const p of points) for (let k = 0; k < 2; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  if (!Number.isFinite(min[0])) { min.fill(0); max.fill(0); }
  return { min, max };
}
function framingBounds(mesh, clipped, options) {
  if (options.frameBox?.min && options.frameBox?.max) return options.frameBox;
  const fixed = mesh.poseFrameBounds;
  let b = fixed || (options.frame === 'selection' && clipped.tri ? avatarBounds(clipped) : mesh.sourceBounds || avatarBounds(mesh));
  if (fixed && options.frame === 'selection') {
    // A common pose envelope also keeps a selected cut steady across frames.
    const range = clipped.cutPlanes;
    const automatic=options.cut===undefined||options.cut===null;
    const mode=String(options.mode||'Full body').toLowerCase();
    const region=automatic?(['bust','keep above','above'].includes(mode)?fixed.regions?.Bust:['feet','keep below','below'].includes(mode)?fixed.regions?.Feet:null):null;
    b = {min:[...(region||fixed).min],max:[...(region||fixed).max]};
    const from=automatic&&['bust','keep above','above'].includes(mode)?mesh.poseCutFrameRanges?.Bust?.[0]:undefined;
    const to=automatic&&['feet','keep below','below'].includes(mode)?mesh.poseCutFrameRanges?.Feet?.[1]:undefined;
    if (range[0] !== null) b.min[2] = Math.max(b.min[2], Number.isFinite(from)?from:range[0]);
    if (range[1] !== null) b.max[2] = Math.min(b.max[2], Number.isFinite(to)?to:range[1]);
    if (b.max[2] <= b.min[2]) b = fixed;
  }
  const center = [0, 0, (b.min[2] + b.max[2]) / 2];
  // Yaw-invariant extent; no refitting as a cut moves. Selection framing is an
  // explicit zoom and is calculated before rotation, so its orbit is steady.
  let rxy = 0, radius = 0;
  const vertices = fixed ? Array.from({length:8},(_,i)=>[i&1?b.max[0]:b.min[0],i&2?b.max[1]:b.min[1],i&4?b.max[2]:b.min[2]]) : options.frame === 'selection' && clipped.tri ? indexed(clipped).vertices : indexed(mesh).vertices;
  for (const p of vertices) { rxy = Math.max(rxy, Math.hypot(p[0] - center[0], p[1] - center[1])); radius = Math.max(radius, Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])); }
  const transform = transformer(options), c = transform(center);
  if (options.rotationEnvelope === 'all') return { min: [c[0] - radius, c[1] - radius], max: [c[0] + radius, c[1] + radius] };
  const halfHeight = Math.max((b.max[2] - b.min[2]) / 2, rxy * .65, .01);
  return { min: [c[0] - Math.max(rxy, .02), c[1] - halfHeight], max: [c[0] + Math.max(rxy, .02), c[1] + halfHeight] };
}

/** Orthographic projected geometry; X/Y are normalized model units, not pixels. */
export function buildAvatarView(mesh, options = {}) {
  const clipped = clipAvatarMesh(mesh, options), data = indexed(clipped), transform = transformer(options);
  const vertices = data.vertices.map(transform), normals = data.normals.map(transform), faceNormals = data.faceNormals.map(transform);
  const light = unit(options.light || [-.45, -.65, 1]);
  const triangles = data.faces.map((face, i) => {
    const pts = face.map(id => vertices[id]), normal = faceNormals[i];
    return { pts, normals: data.faceCaps[i] ? [normal, normal, normal] : face.map(id => normals[id]), normal, shade: .25 + .75 * Math.max(0, dot(normal, light)), depth: (pts[0][2] + pts[1][2] + pts[2][2]) / 3, cap: data.faceCaps[i], face: i };
  });
  const edgeSegments = [], silhouette = [];
  for (const edge of data.edges) {
    const front = edge.faces.some(i => faceNormals[i][2] > EPS), back = edge.faces.some(i => faceNormals[i][2] <= EPS);
    const boundary = edge.faces.length === 1;
    const segment = { pts: [vertices[edge.a], vertices[edge.b]], closed: false, faces: edge.faces, silhouette: boundary || front && back };
    edgeSegments.push(segment); if (segment.silhouette) silhouette.push(segment);
  }
  const sections = clipped.sectionPaths.map(path => ({ ...path, pts: path.pts.map(transform) }));
  const referenceBounds = framingBounds(mesh, clipped, options);
  return { triangles, vertices, normals, faceNormals, silhouette, sections, edges: edgeSegments, bounds: bounds2(vertices), referenceBounds, frameBox: referenceBounds, mesh: clipped, sourceMesh: mesh, light };
}

function rasterize(view, width, height, options = {}) {
  const box = view.referenceBounds, pad = clamp(number(options.padding, .06), 0, .45);
  const dx = Math.max(EPS, box.max[0] - box.min[0]), dy = Math.max(EPS, box.max[1] - box.min[1]);
  const scale = Math.min(width * (1 - pad * 2) / dx, height * (1 - pad * 2) / dy);
  const ox = width / 2 - (box.min[0] + box.max[0]) / 2 * scale, oy = height / 2 - (box.min[1] + box.max[1]) / 2 * scale;
  const depth = new Float32Array(width * height); depth.fill(-Infinity);
  const normal = options.normals ? new Float32Array(width * height * 3) : null;
  const shade = options.shading ? new Float32Array(width * height) : null;
  const face = options.faceIds ? new Int32Array(width * height).fill(-1) : null;
  for (let i = 0; i < view.triangles.length; i++) {
    const t = view.triangles[i], p = t.pts.map(a => [a[0] * scale + ox, a[1] * scale + oy, a[2]]), [a, b, c] = p;
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(det) < 1e-12) continue;
    const x0 = clamp(Math.floor(Math.min(a[0], b[0], c[0])), 0, width - 1), x1 = clamp(Math.ceil(Math.max(a[0], b[0], c[0])), 0, width - 1);
    const y0 = clamp(Math.floor(Math.min(a[1], b[1], c[1])), 0, height - 1), y1 = clamp(Math.ceil(Math.max(a[1], b[1], c[1])), 0, height - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = ((b[1] - c[1]) * (x + .5 - c[0]) + (c[0] - b[0]) * (y + .5 - c[1])) / det;
      const v = ((c[1] - a[1]) * (x + .5 - c[0]) + (a[0] - c[0]) * (y + .5 - c[1])) / det, w = 1 - u - v;
      if (u < -1e-7 || v < -1e-7 || w < -1e-7) continue;
      const d = u * a[2] + v * b[2] + w * c[2], idx = y * width + x;
      if (d < depth[idx]) continue;
      depth[idx] = d; if (face) face[idx] = i;
      if (normal || shade) {
        const ns = t.normals, nx = u * ns[0][0] + v * ns[1][0] + w * ns[2][0], ny = u * ns[0][1] + v * ns[1][1] + w * ns[2][1], nz = u * ns[0][2] + v * ns[1][2] + w * ns[2][2], norm = Math.hypot(nx, ny, nz) || 1;
        if (normal) { normal[idx * 3] = nx / norm; normal[idx * 3 + 1] = ny / norm; normal[idx * 3 + 2] = nz / norm; }
        if (shade) shade[idx] = .25 + .75 * Math.max(0, (nx * view.light[0] + ny * view.light[1] + nz * view.light[2]) / norm);
      }
    }
  }
  return { width, height, depth, normal, shade, face, scale, ox, oy, project: p => [p[0] * scale + ox, p[1] * scale + oy, p[2]] };
}
let colorContext;
function parseColor(value, fallback) {
  if (Array.isArray(value)) return value.slice(0, 3);
  const s = String(value || '').trim(), hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(s);
  if (hex) { const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (rgb) return rgb.slice(1, 4).map(Number);
  if (s && s !== 'transparent') {
    try {
      if (!colorContext) {
        const surface = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : typeof document !== 'undefined' ? document.createElement('canvas') : null;
        if (surface) { surface.width = surface.height = 1; colorContext = surface.getContext('2d', { willReadFrequently: true }); }
      }
      if (colorContext) {
        colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = 'rgb(1, 2, 3)'; colorContext.fillStyle = s; colorContext.fillRect(0, 0, 1, 1);
        const pixel = colorContext.getImageData(0, 0, 1, 1).data;
        if (pixel[3] && !(pixel[0] === 1 && pixel[1] === 2 && pixel[2] === 3)) return [...pixel].slice(0, 3);
      }
    } catch { /* Keep the dependency-free renderer usable in non-browser tests. */ }
  }
  return fallback;
}
function themeColors(canvas, options) {
  let fg, bg, style;
  const ownerWindow = canvas?.ownerDocument?.defaultView;
  const styleOf = ownerWindow?.getComputedStyle ? ownerWindow.getComputedStyle.bind(ownerWindow) : typeof getComputedStyle === 'function' ? getComputedStyle : null;
  if (styleOf && canvas) {
    style = styleOf(canvas);
    fg = style.getPropertyValue('--foreground') || style.color;
    bg = style.getPropertyValue('--background');
  }
  // light-dark() and inherited custom properties must be resolved in the
  // canvas's actual document/color-scheme. A detached/offscreen canvas chooses
  // its own light scheme, which can make both dark-theme endpoints white.
  const resolve = value => {
    if (Array.isArray(value) || !value || !styleOf || !canvas?.ownerDocument) return value;
    const doc = canvas.ownerDocument, parent = canvas.parentElement || doc.body;
    if (!parent) return value;
    const probe = doc.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;';
    if (style?.colorScheme) probe.style.colorScheme = style.colorScheme;
    // Capture variables defined directly on this canvas as well as its parent.
    for (const name of ['--foreground', '--background']) {
      const token = style?.getPropertyValue(name);
      if (token) probe.style.setProperty(name, token);
    }
    probe.style.color = String(value);
    try { parent.appendChild(probe); return styleOf(probe).color || value; }
    finally { probe.remove(); }
  };
  const foreground = parseColor(resolve(options.foreground || options.color || options.inkColor || fg), [24, 24, 24]);
  const fallbackBackground = dot(foreground, [.2126, .7152, .0722]) > 128 ? [24, 24, 24] : [255, 255, 255];
  const backgroundValue = options.background && options.background !== 'transparent' ? options.background : bg;
  return { foreground, background: parseColor(resolve(backgroundValue), fallbackBackground) };
}

/** Draw a smooth normal-shaded mesh into a browser 2D canvas. No WebGL needed. */
export function drawAvatarCanvas(canvasOrContext, mesh, options = {}) {
  const context = canvasOrContext?.getContext ? canvasOrContext.getContext('2d') : canvasOrContext;
  if (!context) return null;
  const canvas = context.canvas, width = Math.max(1, Math.floor(number(options.width, canvas.width || 360))), height = Math.max(1, Math.floor(number(options.height, canvas.height || 520)));
  if (canvas.width !== width) canvas.width = width; if (canvas.height !== height) canvas.height = height;
  const view = options.view || buildAvatarView(mesh, options), raster = rasterize(view, width, height, { ...options, shading: true });
  const image = context.createImageData(width, height), pixels = image.data, { foreground, background } = themeColors(canvas, options);
  const lightBackground = dot(background, [.2126, .7152, .0722]) > dot(foreground, [.2126, .7152, .0722]);
  for (let i = 0; i < raster.depth.length; i++) if (Number.isFinite(raster.depth[i])) {
    const s = raster.shade[i], amount = lightBackground ? .20 + .59 * (1 - s) : .30 + .64 * s;
    for (let k = 0; k < 3; k++) pixels[i * 4 + k] = Math.round(background[k] * (1 - amount) + foreground[k] * amount);
    pixels[i * 4 + 3] = 255;
  }
  context.clearRect(0, 0, width, height); context.putImageData(image, 0, 0);
  const color = `rgb(${foreground.map(Math.round).join(',')})`;
  if (options.wireframe) {
    context.strokeStyle = color; context.globalAlpha = .18; context.lineWidth = .5;
    const every = Math.max(1, Math.ceil(view.edges.length / 4500)); context.beginPath();
    for (let i = 0; i < view.edges.length; i += every) {
      const e = view.edges[i], a = raster.project(e.pts[0]), b = raster.project(e.pts[1]), mid = interpolate(a, b, .5), x = Math.floor(mid[0]), y = Math.floor(mid[1]);
      if (x < 0 || y < 0 || x >= width || y >= height || mid[2] < raster.depth[y * width + x] - 2 / raster.scale) continue;
      context.moveTo(a[0], a[1]); context.lineTo(b[0], b[1]);
    }
    context.stroke(); context.globalAlpha = 1;
  }
  if (options.cutEdges !== false && view.sections.length) {
    context.strokeStyle = color; context.globalAlpha = .55; context.lineWidth = Math.max(.7, width / 700); context.beginPath();
    for (const section of view.sections) {
      let open = false;
      for (let i = 0; i < section.pts.length + (section.closed ? 1 : 0); i++) {
        const p = raster.project(section.pts[i % section.pts.length]), x = Math.floor(p[0]), y = Math.floor(p[1]);
        const visible = x >= 0 && y >= 0 && x < width && y < height && p[2] >= raster.depth[y * width + x] - 2 / raster.scale;
        if (visible) { if (open) context.lineTo(p[0], p[1]); else context.moveTo(p[0], p[1]); } open = visible;
      }
    }
    context.stroke(); context.globalAlpha = 1;
  }
  return { ...view, raster };
}

/** Inspection-only silhouette or sparse visible mesh edges in Muusia mm paths. */
export function avatarLineDrawing(mesh, options = {}, context = {}) {
  const view = options.view || buildAvatarView(mesh, options), W = Math.max(1, number(context.W, 210)), H = Math.max(1, number(context.H, 297));
  const margin = clamp(number(context.margin ?? options.margin, 12), 0, Math.min(W, H) / 2 - .001), box = view.referenceBounds;
  const scale = Math.min(Math.max(1, number(context.size ?? options.size, H - margin * 2)), (W - margin * 2) / Math.max(EPS, box.max[0] - box.min[0]), (H - margin * 2) / Math.max(EPS, box.max[1] - box.min[1]));
  const ox = W / 2 - (box.min[0] + box.max[0]) / 2 * scale, oy = H / 2 - (box.min[1] + box.max[1]) / 2 * scale;
  const pen = clamp(Math.round(number(context.pen ?? context.layer ?? options.pen ?? options.layer, 0)), 0, 11), paths = [];
  const resolution = 420, raster = rasterize(view, resolution, resolution, { padding: .025 });
  const visible = p => {
    const q = raster.project(p), x = Math.floor(q[0]), y = Math.floor(q[1]);
    if (x < 1 || y < 1 || x >= resolution - 1 || y >= resolution - 1) return false;
    let d = Infinity;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) d = Math.min(d, raster.depth[(y + j) * resolution + x + i]);
    return p[2] >= d - 1.3 / raster.scale;
  };
  const emit = (a, b) => { if (Math.hypot(a[0] - b[0], a[1] - b[1]) * scale > 1e-6 && paths.length < 45000) paths.push({ pts: [[ox + a[0] * scale, oy + a[1] * scale], [ox + b[0] * scale, oy + b[1] * scale]], closed: false, layer: pen }); };
  const wire = String(options.drawing || '').toLowerCase().includes('wire') || options.wireframe;
  const candidates = wire ? view.edges : view.silhouette, stride = Math.max(1, Math.ceil(candidates.length / 12000));
  for (let i = 0; i < candidates.length; i++) {
    const e = candidates[i]; if (wire && !e.silhouette && i % stride) continue;
    if (e.faces.every(id => view.faceNormals[id][2] < -EPS)) continue;
    const [a, b] = e.pts, count = Math.min(80, Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) * raster.scale * 1.6)));
    let start = visible(a) ? a : null;
    for (let j = 1; j <= count; j++) {
      const p = interpolate(a, b, j / count), on = visible(p);
      if (on && !start) start = interpolate(a, b, (j - 1) / count);
      if ((!on || j === count) && start) { emit(start, p); start = null; }
    }
  }
  for (const section of view.sections) for (let i = 0; i < section.pts.length - (section.closed ? 0 : 1); i++) {
    const a = section.pts[i], b = section.pts[(i + 1) % section.pts.length]; if (visible(interpolate(a, b, .5))) emit(a, b);
  }
  return { paths };
}

// Shared visibility/depth field for physical-scale surface plotting.
export {rasterize as rasterizeAvatarView};
