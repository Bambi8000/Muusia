// Driven drawing extension. Gravity mode remains the original RK4 simulation.
export function fullDiscFrame(p, { W, H }) {
  let radius = Math.max(1, p.l1) + Math.max(1, p.l2);
  let x = W * p.cx / 100, y = H * p.cy / 100;
  if (p.fitCanvas !== false) {
    const margin = Math.min(12, Math.min(W, H) * .06);
    radius = Math.min(radius, Math.max(.1, Math.min(W, H) / 2 - margin));
    x = Math.max(margin + radius, Math.min(W - margin - radius, x));
    y = Math.max(margin + radius, Math.min(H - margin - radius, y));
  }
  return { x, y, radius };
}

const pointSegmentDistance2 = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
};
const segmentsDistance2 = (a, b, c, d) => {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
  if (ac * ad < 0 && ca * cb < 0) return 0;
  return Math.min(pointSegmentDistance2(a, c, d), pointSegmentDistance2(b, c, d), pointSegmentDistance2(c, a, b), pointSegmentDistance2(d, a, b));
};

// Every drawn segment, including a replacement connector, is checked. Returning
// an honest open prefix is preferable to lifting, teleporting or scraping a loop.
function withoutRetracing(input, gap, frame) {
  if (input.length < 2) return input;
  const bins = new Map(), visits = new Map(), segments = [];
  const cell = gap, gap2 = gap * gap, recent = gap * 3;
  const cosLimit = Math.cos(Math.PI / 10); // within 18 degrees = following ink
  let travelled = 0, checks = 0;
  const key = (x, y) => x + ',' + y;
  const cells = (a, b, pad, fn) => {
    for (let y = Math.floor((Math.min(a[1], b[1]) - pad) / cell); y <= Math.floor((Math.max(a[1], b[1]) + pad) / cell); y++)
      for (let x = Math.floor((Math.min(a[0], b[0]) - pad) / cell); x <= Math.floor((Math.max(a[0], b[0]) + pad) / cell); x++) fn(key(x, y));
  };
  const allowed = (a, b, arc = travelled) => {
    if (++checks > 400000) return false;
    if (frame.innerRadius > 0 && pointSegmentDistance2([frame.x, frame.y], a, b) < frame.innerRadius ** 2) return false;
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-7) return false;
    if (a === output[output.length - 1] && output.length > 1) {
      const prev = output[output.length - 2], px = a[0] - prev[0], py = a[1] - prev[1];
      if ((px * dx + py * dy) / (Math.hypot(px, py) * length) < -.8) return false;
    }
    let ok = true;
    const found = new Set();
    cells(a, b, gap, k => { for (const id of bins.get(k) || []) found.add(id); });
    for (const id of found) {
      const old = segments[id];
      if (arc - old.end < recent) continue;
      const align = Math.abs(dx * old.dx + dy * old.dy) / (length * old.length);
      if (align >= cosLimit && segmentsDistance2(a, b, old.a, old.b) < gap2 * .999) { ok = false; break; }
    }
    if (!ok) return false;
    // Count separate visits, rather than polyline samples in the same visit.
    const steps = Math.max(1, Math.ceil(length / (cell * .45)));
    for (let i = 1; i <= steps; i++) {
      const x = a[0] + dx * i / steps, y = a[1] + dy * i / steps;
      const visit = visits.get(key(Math.floor(x / cell), Math.floor(y / cell)));
      if (visit && visit.count >= 12 && arc - visit.arc > recent) return false;
    }
    return true;
  };
  const append = b => {
    const a = output[output.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    const id = segments.length;
    segments.push({ a, b, dx, dy, length, end: travelled + length });
    cells(a, b, 0, k => { let bin = bins.get(k); if (!bin) { bin = []; bins.set(k, bin); } bin.push(id); });
    const steps = Math.max(1, Math.ceil(length / (cell * .45)));
    for (let i = 0; i <= steps; i++) {
      const x = a[0] + dx * i / steps, y = a[1] + dy * i / steps, arc = travelled + length * i / steps;
      const k = key(Math.floor(x / cell), Math.floor(y / cell)), old = visits.get(k);
      visits.set(k, { count: old ? old.count + (arc - old.arc > recent ? 1 : 0) : 1, arc });
    }
    travelled += length; output.push(b);
  };
  const output = [input[0]];
  for (let i = 1; i < input.length && output.length < 112000; i++) {
    const a = output[output.length - 1];
    if (Math.hypot(a[0] - input[i][0], a[1] - input[i][1]) < 1e-7) continue;
    if (allowed(a, input[i])) { append(input[i]); continue; }
    // Search a later free part of the driven motion. Matching the incoming
    // and outgoing tangents avoids tiny zigzag detours along an inked rim.
    const prev = output.length > 1 ? output[output.length - 2] : [a[0] - 1, a[1]];
    const heading = Math.atan2(a[1] - prev[1], a[0] - prev[0]);
    let curve = null, resume = -1;
    for (let j = i + 2; j < Math.min(input.length, i + 3000) && checks < 400000; j += 10) {
      const b = input[j], distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (distance < Math.max(2, gap * 3) || distance > frame.radius * .45) continue;
      for (const turn of [0, .6, -.6, 1.1, -1.1, 1.65, -1.65, 2.1, -2.1]) {
        const ux = (b[0] - a[0]) / distance, uy = (b[1] - a[1]) / distance;
        const next = input[Math.min(input.length - 1, j + 2)];
        const tail = Math.hypot(next[0] - b[0], next[1] - b[1]);
        if (tail < 1e-7) continue;
        const tx = (next[0] - b[0]) / tail, ty = (next[1] - b[1]) / tail;
        const hx = Math.cos(heading + turn), hy = Math.sin(heading + turn);
        if (hx * ux + hy * uy < .1 || tx * ux + ty * uy < .1) continue;
        const handle = distance * .4;
        const controls = [[a[0] + hx * handle, a[1] + hy * handle], [b[0] - tx * handle, b[1] - ty * handle]];
        const rmax = Math.max(.001, frame.radius - gap * .1);
        for (const c of controls) {
          const rr = Math.hypot(c[0] - frame.x, c[1] - frame.y);
          if (rr > rmax) { c[0] = frame.x + (c[0] - frame.x) * rmax / rr; c[1] = frame.y + (c[1] - frame.y) * rmax / rr; }
        }
        const [c1, c2] = controls;
        const proj1 = (c1[0] - a[0]) * ux + (c1[1] - a[1]) * uy;
        const proj2 = (c2[0] - a[0]) * ux + (c2[1] - a[1]) * uy;
        if (proj1 < 0 || proj1 > proj2 || proj2 > distance) continue;
        const bound = Math.hypot(c1[0] - a[0], c1[1] - a[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(b[0] - c2[0], b[1] - c2[1]);
        const steps = Math.max(4, Math.ceil(3 * bound / Math.min(.6, gap * .5)));
        const points = [];
        let last = a, arc = travelled, px = a[0] - prev[0], py = a[1] - prev[1], ok = true;
        for (let k = 1; k <= steps; k++) {
          const t = k / steps, u = 1 - t;
          const q = [u ** 3 * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * b[0], u ** 3 * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * b[1]];
          const dx = q[0] - last[0], dy = q[1] - last[1], len = Math.hypot(dx, dy);
          if (len < 1e-7) continue;
          if ((px * dx + py * dy) / (Math.hypot(px, py) * len) < -.8 || !allowed(last, q, arc)) { ok = false; break; }
          points.push(q); arc += len; last = q; px = dx; py = dy;
        }
        if (ok && points.length) { curve = points; resume = j; break; }
      }
      if (curve) break;
    }
    if (!curve || output.length + curve.length > 112000) break;
    for (const q of curve) append(q);
    i = resume;
  }
  return output;
}

export function drawFullDisc(p, ctx, step) {
  const { x: X, y: Y, radius } = fullDiscFrame(p, ctx);
  const l1 = Math.max(1, p.l1), l2 = Math.max(1, p.l2), sum = l1 + l2;
  const gap = Math.max(.2, Math.min(3, p.lineGap ?? .6));
  const spacing = Math.max(.1, Math.min(2, p.detail));
  const dt = .004, steps = Math.min(60000, Math.round(Math.max(.5, p.time) / dt));
  const phase1 = p.a1 * Math.PI / 180, phase2 = p.a2 * Math.PI / 180;
  const omega = 2 * Math.PI * 1.4 * Math.sqrt(Math.max(.05, p.grav) * 80 / sum);
  const ratio = (1 + Math.sqrt(5)) / 2;
  let state = [phase1, phase2, 0, 0];
  const point = t => {
    // Incommensurate drive phases distribute petals around the disc.
    // The original coupled RK4 motion supplies a bounded chaotic perturbation.
    const a = phase1 + omega * t + .2 * (Math.sin(state[0]) - Math.sin(phase1));
    const b = phase2 + ratio * omega * t + .2 * (Math.sin(state[1]) - Math.sin(phase2));
    let u = l1 * Math.sin(a) + l2 * Math.sin(b), v = l1 * Math.cos(a) + l2 * Math.cos(b);
    const r = Math.hypot(u, v);
    let mapped = r / sum;
    if (p.fillCentre !== false) mapped = Math.sqrt(Math.max(0, (r * r - (l1 - l2) ** 2) / (4 * l1 * l2)));
    // Slow radial breathing spreads outer turning points over a band instead
    // of repeatedly polishing one fixed-radius circular caustic.
    const breathing = .75 + .25 * Math.sin(t * .53 + phase1) ** 2;
    const scale = r > 1e-9 ? Math.min(1, mapped) * radius * breathing / r : 0;
    return [X + u * scale, Y + v * scale];
  };
  const points = [point(0)], POINT_BUDGET = 112000;

  for (let i = 1; i <= steps && points.length < POINT_BUDGET; i++) {
    state = step(state);
    const next = point(i * dt), previous = points[points.length - 1];
    const distance = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
    if (distance < spacing && i < steps) continue;
    const subdivisions = Math.max(1, Math.ceil(distance / spacing));
    for (let k = 1; k <= subdivisions && points.length < POINT_BUDGET; k++) {
      if (distance > 1e-7) points.push([previous[0] + (next[0] - previous[0]) * k / subdivisions, previous[1] + (next[1] - previous[1]) * k / subdivisions]);
    }
  }
  return p.noRetrace === false ? points : withoutRetracing(points, gap, { x: X, y: Y, radius, innerRadius: p.fillCentre === false ? Math.max(0, radius * .75 * Math.abs(l1 - l2) / sum - .01) : 0 });
}
