import { EMPTY, applyStyle } from './helpers.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const number = (v, fallback, lo, hi) => clamp(Number.isFinite(+v) ? +v : fallback, lo, hi);

// A periodic drawing surface, rather than a history-dependent physics simulation.
// Coordinates here are sheet widths; the plotter receives only projected XY mm.
export function flyingSurface(p, ctx) {
  const W = number(ctx?.W, 0, 0, 100000), H = number(ctx?.H, 0, 0, 100000);
  const margin = number(p.margin, 10, 0, 100000);
  if (W - margin * 2 <= 0 || H - margin * 2 <= 0) return null;
  const aspect = clamp(H / W, .35, 2);
  const height = number(p.waveHeight, 12, 0, 40) / 100;
  const wavelength = number(p.wavelength, 140, 30, 250) / 100;
  const direction = number(p.waveDirection, 20, -3600, 3600) * Math.PI / 180;
  const cycles = Math.round(number(p.flightSpeed, 1, 0, 8));
  const frame = p.motion === 'Timeline' && Number.isFinite(ctx.frameIdx) && ctx.frameCount > 1
    ? ctx.frameIdx / ctx.frameCount : 0;
  // Reduce before trig: phase 0/360 and timeline 0/N are exactly the same pose.
  const turns = number(p.phase, 0, -1e6, 1e6) / 360 + frame * cycles;
  const phase = (Math.round(((turns % 1 + 1) % 1) * 1e12) % 1e12) / 1e12 * TAU;
  const twist = number(p.twist, 30, -180, 180) * Math.PI / 180;
  const curl = number(p.edgeCurl, 100, -270, 270) * Math.PI / 180;
  const profile = ['Roll', 'Loop', 'Corkscrew'].includes(p.flightMotion) ? p.flightMotion : 'Flutter';
  const amount = profile === 'Flutter' ? 0 : number(p.motionAmount, 100, 0, 100) / 100;
  const alongWidth = p.motionAxis !== 'Length', axisLength = alongWidth ? 1 : aspect;
  const attachment = p.flightPin || 'Free';
  const envelope = (u, v) => {
    if (attachment === 'Corners') return (Math.sin(Math.PI * u) ** 2 + Math.sin(Math.PI * v) ** 2) / 2;
    if (attachment === 'Top edge') return v;
    if (attachment === 'Left edge') return u;
    if (attachment === 'Centre') return 1 - Math.exp(-30 * ((u - .5) ** 2 + (v - .5) ** 2));
    return 1;
  };
  const world = (u, v) => {
    const x = u - .5, y = (.5 - v) * aspect, side = Math.sign(x);
    const length = Math.max(0, Math.abs(x) - .27);
    const angle = curl * (.75 + .25 * Math.sin(phase + v * Math.PI)) * length / .23;
    const bentX = length && Math.abs(angle) > 1e-8 ? side * (.27 + length * Math.sin(angle) / angle) : x;
    const bentZ = length && Math.abs(angle) > 1e-8 ? length * (1 - Math.cos(angle)) / angle : 0;
    const turn = twist * (v - .5) * (.7 + .3 * Math.cos(phase));
    const xx = bentX * Math.cos(turn) - bentZ * Math.sin(turn);
    const wave = TAU * (x * Math.cos(direction) + y * Math.sin(direction)) / wavelength;
    const zz = bentX * Math.sin(turn) + bentZ * Math.cos(turn)
      + height * (.78 * Math.sin(wave - phase) + .22 * Math.sin(wave * 2 + phase + v * 2));
    const e = envelope(u, v);
    if (!amount) return [x + (xx - x) * e, y, zz * e];
    const q = [xx, y, zz], axis = alongWidth ? 0 : 1;
    let target = q.slice();
    if (profile === 'Corkscrew') {
      // A complete helical turn across the sheet, with the twist travelling in time.
      const crossAxis = 1 - axis, angle = TAU * (q[axis] / axisLength + .2 * Math.sin(phase));
      target[crossAxis] = q[crossAxis] * Math.cos(angle) - zz * Math.sin(angle);
      target[2] = q[crossAxis] * Math.sin(angle) + zz * Math.cos(angle);
    } else {
      // Integrate a rotating tangent: the WHOLE sheet bends through more than
      // 360 degrees. A small spiral pitch separates overlapping wraps in depth.
      const bend = profile === 'Roll' ? TAU * .75 * (1 - Math.cos(phase)) : TAU * (1.05 + .2 * Math.sin(phase));
      if (bend > 1e-9) {
        const s = q[axis], angle = bend * s / axisLength;
        const gap = .06 * axisLength * Math.min(1, bend / TAU) * s / axisLength;
        const sinc = Math.abs(angle) < 1e-7 ? 1 - angle * angle / 6 : Math.sin(angle) / angle;
        const cosc = Math.abs(angle) < 1e-7 ? angle / 2 : (1 - Math.cos(angle)) / angle;
        target[axis] = s * sinc + (gap - zz) * Math.sin(angle);
        target[2] = s * cosc + (zz - gap) * Math.cos(angle);
      }
    }
    target = q.map((v, k) => v + (target[k] - v) * amount);
    // Attachment is applied after every deformation, including lengthwise rolls.
    return [x + (target[0] - x) * e, y + (target[1] - y) * e, target[2] * e];
  };
  const yaw = number(p.yaw, 25, -3600, 3600) * Math.PI / 180;
  const elev = number(p.pitch, 50, 1, 90) * Math.PI / 180;
  const eye = [Math.sin(yaw) * Math.cos(elev), -Math.cos(yaw) * Math.cos(elev), Math.sin(elev)];
  const right = [Math.cos(yaw), Math.sin(yaw), 0];
  const up = [-Math.sin(yaw) * Math.sin(elev), Math.cos(yaw) * Math.sin(elev), Math.cos(elev)];
  let perspective = number(p.persp, .35, 0, 1) * .4;
  const dot = (q, a) => q[0] * a[0] + q[1] * a[1] + q[2] * a[2];
  const view = q => {
    const depth = dot(q, eye), divisor = Math.max(.25, 1 - perspective * depth);
    return [dot(q, right) / divisor, -dot(q, up) / divisor, depth];
  };
  // Conservative box over EVERY phase, including all attachments. Interpolation
  // with the undeformed sheet cannot leave it. Fixed origin and scale avoid pumping.
  const turnMax = Math.abs(twist) / 2;
  const curlPeak = Math.min(Math.abs(curl), 2.331123);
  const zCurl = curlPeak < 1e-8 ? 0 : .23 * (1 - Math.cos(curlPeak)) / curlPeak;
  let xBound = Math.hypot(.5, zCurl), yBound = aspect / 2;
  let zBound = .5 * Math.sin(Math.min(Math.PI / 2, turnMax)) + zCurl + height;
  let zMin = -zBound, zMax = zBound;
  if (amount) {
    // Rotations preserve radius. A wrapped arc is no farther from its origin
    // than its source arc length; add the transported normal and spiral pitch.
    if (profile === 'Corkscrew') {
      const crossBound = alongWidth ? yBound : xBound, radius = Math.hypot(crossBound, zBound);
      if (alongWidth) yBound += (radius - yBound) * amount;
      else xBound += (radius - xBound) * amount;
      zBound += (radius - zBound) * amount;
      zMin = -zBound; zMax = zBound;
    } else {
      const axisBound = alongWidth ? xBound : yBound, gapBound = .06 * axisBound;
      const minBend = TAU * .85;
      const across = (profile === 'Loop' ? Math.min(axisBound, axisLength / minBend) : axisBound) + gapBound + zBound;
      const depth = (profile === 'Loop' ? Math.min(axisBound, 2 * axisLength / minBend) : axisBound) + gapBound + zBound;
      if (alongWidth) xBound += (across - xBound) * amount;
      else yBound += (across - yBound) * amount;
      zMin = -zBound - gapBound * amount;
      zMax = zBound + (depth - zBound) * amount;
    }
  }
  if (amount) {
    const depthBound = xBound * Math.abs(eye[0]) + yBound * Math.abs(eye[1]) + Math.max(-zMin, zMax) * Math.abs(eye[2]);
    perspective = Math.min(perspective, .7 / Math.max(1e-8, depthBound));
  }
  let bx = 0, by = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [-xBound, xBound]) for (const y of [-yBound, yBound]) for (const z of [zMin, zMax]) {
    const q = view([x, y, z]); bx = Math.max(bx, Math.abs(q[0])); by = Math.max(by, Math.abs(q[1]));
    x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
  }
  const centreX = amount ? (x0 + x1) / 2 : 0, centreY = amount ? (y0 + y1) / 2 : 0;
  const scale = amount ? Math.min((W - margin * 2) / Math.max(1e-8, x1 - x0), (H - margin * 2) / Math.max(1e-8, y1 - y0))
    : Math.min((W - margin * 2) / (2 * Math.max(1e-8, bx)), (H - margin * 2) / (2 * Math.max(1e-8, by)));
  const project = q => { const v = view(q); return [W / 2 + (v[0] - centreX) * scale, H / 2 + (v[1] - centreY) * scale, v[2]]; };
  const detail = Math.round(number(p.clothDensity, 28, 8, 45));
  // Rendering mesh follows the smallest allowed wavelength, independently of grid spacing.
  const nx = Math.max(amount ? 72 : 48, detail * 2, Math.ceil(24 / wavelength));
  const ny = Math.max(24, Math.ceil(nx * aspect));
  const vertices = Array.from({ length: (nx + 1) * (ny + 1) }, (_, k) => world(k % (nx + 1) / nx, Math.floor(k / (nx + 1)) / ny));
  // Both artwork and occlusion use exactly the same triangles. Bilinear artwork
  // over a triangular z-buffer would create holes in otherwise visible letters.
  const surface = (u, v) => {
    const a = clamp(u, 0, 1) * nx, b = clamp(v, 0, 1) * ny;
    const i = Math.min(nx - 1, Math.floor(a)), j = Math.min(ny - 1, Math.floor(b));
    const s = a - i, t = b - j, k = j * (nx + 1) + i;
    const A = vertices[k], D = vertices[k + nx + 2];
    const B = s >= t ? vertices[k + 1] : vertices[k + nx + 1];
    const weights = s >= t ? [1 - s, s - t, t] : [1 - t, t - s, s];
    return project(A.map((a, k) => a * weights[0] + B[k] * weights[1] + D[k] * weights[2]));
  };
  return { W, H, margin, aspect, scale, phase, detail, nx, ny, vertices, world, surface, project, perspective };
}

// Slab clipping in UV prevents out-of-canvas art from accumulating along an edge.
function clipUV(a, b) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 2; k++) {
    const delta = b[k] - a[k];
    if (Math.abs(delta) < 1e-14) { if (a[k] < 0 || a[k] > 1) return null; }
    else { const t0 = -a[k] / delta, t1 = (1 - a[k]) / delta; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
  }
  return hi - lo > 1e-12 ? [a.map((v, k) => v + (b[k] - v) * lo), a.map((v, k) => v + (b[k] - v) * hi)] : null;
}

export function renderFlyingCloth(ins, p, ctx) {
  const sheet = flyingSurface(p, ctx);
  if (!sheet) return EMPTY;
  const { W, H, margin, nx, ny, detail, surface, project, vertices, perspective } = sheet;
  const content = p.flightContent || 'Artwork';
  const source = content.startsWith('Artwork') ? ins[3]?.paths || [] : [];
  if (!Array.isArray(source) || source.length > 12000) return EMPTY;
  let inputPoints = 0, length = 0;
  const curves = [];
  for (const path of source) {
    if (!Array.isArray(path?.pts) || path.pts.length < (path.closed ? 3 : 2)) return EMPTY;
    inputPoints += path.pts.length;
    if (inputPoints > 120000 || path.pts.some(q => !Array.isArray(q) || !Number.isFinite(q[0]) || !Number.isFinite(q[1]) || Math.abs(q[0]) > 1e9 || Math.abs(q[1]) > 1e9)) return EMPTY;
    const uv = path.pts.map(q => [q[0] / W, q[1] / H]);
    // Collect all clipped segments before choosing one uniform sampling rate.
    const segments = [];
    for (let i = 0; i < uv.length - (path.closed ? 0 : 1); i++) {
      const s = clipUV(uv[i], uv[(i + 1) % uv.length]);
      if (s) { length += Math.hypot((s[1][0] - s[0][0]) * W, (s[1][1] - s[0][1]) * H); segments.push(s); }
    }
    curves.push({ segments, closed: !!path.closed && uv.every(q => q.every(v => v >= 0 && v <= 1)), layer: Math.round(number(path.layer, 0, 0, 11)) });
  }
  const pen = Math.round(number(p.layer, 0, 0, 11));
  const gridY = Math.max(4, Math.round(detail * sheet.aspect));
  if (content !== 'Artwork') {
    for (let i = 0; i <= detail; i++) curves.push({ segments: [[[i / detail, 0], [i / detail, 1]]], closed: false, layer: pen });
    if (content !== 'Threads') for (let j = 0; j <= gridY; j++) curves.push({ segments: [[[0, j / gridY], [1, j / gridY]]], closed: false, layer: pen });
    length += (detail + 1) * H + (content === 'Threads' ? 0 : (gridY + 1) * W);
  }
  if (!curves.length) return EMPTY;
  // Use a tile index and exact ray/triangle depth at each stroke sample instead
  // of pixel centre depth; steep visible folds must not erase their own artwork.
  const tiles = 48, buckets = Array.from({ length: tiles * tiles }, () => []);
  const tileX = x => clamp(Math.floor(x / W * tiles), 0, tiles - 1);
  const tileY = y => clamp(Math.floor(y / H * tiles), 0, tiles - 1);
  if (p.hidden !== false) {
    const screen = vertices.map(project);
    const add = (A, B, C) => {
      const det = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(det) < 1e-12) return;
      const tri = { A, B, C, det };
      for (let y = tileY(Math.min(A[1], B[1], C[1])); y <= tileY(Math.max(A[1], B[1], C[1])); y++)
        for (let x = tileX(Math.min(A[0], B[0], C[0])); x <= tileX(Math.max(A[0], B[0], C[0])); x++) buckets[y * tiles + x].push(tri);
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * (nx + 1) + i;
      add(screen[k], screen[k + 1], screen[k + nx + 2]); add(screen[k], screen[k + nx + 2], screen[k + nx + 1]);
    }
  }
  const visible = q => {
    if (p.hidden === false) return true;
    for (const { A, B, C, det } of buckets[tileY(q[1]) * tiles + tileX(q[0])]) {
      const a = ((B[1] - C[1]) * (q[0] - C[0]) + (C[0] - B[0]) * (q[1] - C[1])) / det;
      const b = ((C[1] - A[1]) * (q[0] - C[0]) + (A[0] - C[0]) * (q[1] - C[1])) / det, c = 1 - a - b;
      if (a < -1e-8 || b < -1e-8 || c < -1e-8) continue;
      // Perspective-correct depth (linear screen depth is wrong at grazing folds).
      const wa = a / Math.max(.25, 1 - perspective * A[2]), wb = b / Math.max(.25, 1 - perspective * B[2]), wc = c / Math.max(.25, 1 - perspective * C[2]);
      const depth = (wa * A[2] + wb * B[2] + wc * C[2]) / (wa + wb + wc);
      if (depth > q[2] + 1e-6) return false;
    }
    return true;
  };
  const paths = [];
  const step = Math.max(.45, length / Math.max(1000, 75000 - inputPoints));
  let count = 0;
  const emit = (pts, closed, layer) => {
    if (pts.length < (closed ? 3 : 2)) return;
    paths.push({ pts, closed, layer }); count += pts.length;
  };
  for (const curve of curves) {
    let run = [], allVisible = true, first = null, last = null;
    const flush = () => { emit(run, false, curve.layer); run = []; };
    for (const [a, b] of curve.segments) {
      const steps = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * W, (b[1] - a[1]) * H) / step));
      if (last && Math.hypot(a[0] - last[0], a[1] - last[1]) > 1e-9) { flush(); allVisible = false; }
      for (let i = 0; i <= steps; i++) {
        if (i === 0 && run.length) continue;
        const uv = [a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps];
        const q = surface(...uv), v = visible(q);
        if (!first) first = uv;
        if (v) { const pt = [clamp(q[0], margin, W - margin), clamp(q[1], margin, H - margin)]; if (!run.length || Math.hypot(pt[0] - run.at(-1)[0], pt[1] - run.at(-1)[1]) > 1e-10) run.push(pt); }
        else { flush(); allVisible = false; }
      }
      last = b;
    }
    if (allVisible && curve.closed && first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9 && run.length > 3) {
      run.pop(); emit(run, true, curve.layer);
    } else flush();
    if (count > 118000) return EMPTY; // Refuse the complete drawing; never a prefix.
  }
  let out = applyStyle({ paths }, ins[0]);
  // A dash style can multiply points. Coarsen all dashes together, retaining art.
  for (let i = 0; i < 10 && out.paths.reduce((n, q) => n + q.pts.length, 0) > 118000; i++) {
    const factor = 2 ** (i + 1);
    out = applyStyle({ paths }, { ...ins[0], dash: Math.max(.1, +ins[0]?.dash || 4) * factor, gap: Math.max(.1, +ins[0]?.gap || 3) * factor });
  }
  return out.paths.reduce((n, q) => n + q.pts.length, 0) <= 118000 ? out : EMPTY;
}
