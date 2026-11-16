import { mulberry32 } from './helpers.js';

// An optical-density field lets many thin, opaque threads build grey tones.
// Fractional pixel coverage is integrated along each chord, without snapping
// the entire thread into one opaque raster cell. All geometry stays on nails.
export function fitStringArt({ nails, radius, W, H, darkness, width, ink, detail, quality, limit, seed, focus }) {
  const count = nails.length, size = 192 + Math.round(Math.max(0, Math.min(1, detail)) * 128);
  const cell = 2 * radius / size, left = W / 2 - radius, top = H / 2 - radius;
  const n = size * size, target = new Float32Array(n), residual = new Float32Array(n);
  const importance = new Float32Array(n), tone = new Float32Array(n);
  let mass = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xx = left + (x + .5) * cell, yy = top + (y + .5) * cell, i = y * size + x;
    if (Math.hypot(xx - W / 2, yy - H / 2) > radius) continue;
    let d = 0;
    for (const oy of [-.25, .25]) for (const ox of [-.25, .25]) d += darkness(xx + ox * cell, yy + oy * cell) * .25;
    tone[i] = d;
    target[i] = residual[i] = -Math.log(Math.max(.04, 1 - d));
    const q = ((xx - focus.x) / focus.rx) ** 2 + ((yy - focus.y) / focus.ry) ** 2;
    importance[i] = (1 + 1.2 * (1 - d)) * (1 + focus.boost * Math.max(0, 1 - q));
    mass += d;
  }
  if (mass < .01) return [];
  // Protect small features as well as the large dark masses. The finite
  // difference is local, so increasing Thread lines never changes the target.
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = y * size + x;
    importance[i] *= 1 + 3 * Math.hypot(tone[i + 1] - tone[i - 1], tone[i + size] - tone[i - size]);
  }
  const keyOf = (a, b) => Math.min(a, b) * count + Math.max(a, b);
  const uses = new Uint8Array(count * count);
  const cache = new Array(count * count), queued = new Uint32Array(count * count), CACHE_BYTES = 64 * 1024 * 1024;
  let cacheBytes = 0, queueHead = 0, queueTail = 0;
  const strength = Math.max(.001, Math.min(2, width * ink / cell));
  const chord = (aa, bb) => {
    const key = keyOf(aa, bb);
    const saved = cache[key];
    if (saved) return saved;
    const a = nails[Math.min(aa, bb)], b = nails[Math.max(aa, bb)];
    let ax = (a[0] - left) / cell - .5, ay = (a[1] - top) / cell - .5;
    let bx = (b[0] - left) / cell - .5, by = (b[1] - top) / cell - .5;
    const steep = Math.abs(by - ay) > Math.abs(bx - ax);
    if (steep) { [ax, ay] = [ay, ax]; [bx, by] = [by, bx]; }
    if (ax > bx) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
    const dx = bx - ax, dy = by - ay;
    const steps = Math.max(1, Math.ceil(dx)), amount = strength * Math.hypot(dx, dy) / steps;
    const ids = new Uint32Array(steps * 2), cover = new Uint8Array(steps * 2);
    let length = 0;
    for (let k = 0; k < steps; k++) {
      const t = (k + .5) / steps, u = ax + dx * t, v = ay + dy * t;
      const major = Math.round(u), minor = Math.floor(v), f = v - minor;
      for (let side = 0; side < 2; side++) {
        const x = steep ? minor + side : major, y = steep ? major : minor + side;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const i = y * size + x, c = Math.round(255 * (side ? f : 1 - f));
        if (c && importance[i]) { ids[length] = i; cover[length++] = c; }
      }
    }
    const entry = { ids: ids.subarray(0, length), cover: cover.subarray(0, length), amount: amount / 255, key };
    const bytes = ids.byteLength + cover.byteLength;
    while (cacheBytes + bytes > CACHE_BYTES && queueHead < queueTail) {
      const oldest = queued[queueHead++ % queued.length], item = cache[oldest];
      cacheBytes -= item.ids.buffer.byteLength + item.cover.buffer.byteLength;
      cache[oldest] = undefined;
    }
    cache[key] = entry; queued[queueTail++ % queued.length] = key; cacheBytes += bytes;
    return entry;
  };
  const apply = (line, sign) => {
    const { ids, cover, amount } = line;
    for (let k = 0; k < ids.length; k++) residual[ids[k]] += sign * cover[k] * amount;
  };
  const gain = line => {
    const { ids, cover, amount } = line;
    let sum = 0;
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k], d = cover[k] * amount;
      sum += importance[i] * d * (2 * residual[i] - d);
    }
    return sum;
  };
  const skip = Math.max(2, Math.round(count * .015));
  const valid = (a, b) => {
    const gap = Math.abs(a - b);
    return Math.min(gap, count - gap) >= skip && !uses[keyOf(a, b)];
  };
  const rng = mulberry32((seed | 0) * 7919 + 933);
  const route = [Math.floor(rng() * count)];
  const add = next => {
    const current = route[route.length - 1], line = chord(current, next);
    apply(line, -1); uses[line.key]++; route.push(next);
  };
  const nextFrom = current => {
    let best = -1, score = 1e-8;
    for (let next = 0; next < count; next++) {
      if (!valid(current, next)) continue;
      const s = gain(chord(current, next));
      if (s > score) { score = s; best = next; }
    }
    return { best, score };
  };
  // Refine only completed, fixed-size blocks. A shorter line cap therefore
  // remains the exact prefix of a longer drawing, even with route refinement.
  const BLOCK = 128, planned = Math.ceil(limit / BLOCK) * BLOCK;
  let finished = false, bridges = 0;
  for (let begin = 0; begin < planned && !finished; begin += BLOCK) {
    const first = route.length - 1, end = Math.min(planned, begin + BLOCK);
    while (route.length - 1 < end) {
      const current = route[route.length - 1], choice = nextFrom(current);
      if (choice.best >= 0) { add(choice.best); continue; }
      // A beneficial two-chord move can cross a locally unhelpful region
      // without lifting or teleporting. The crossing is scored and deposited.
      if (++bridges > 12) break;
      const candidates = [];
      for (let next = 0; next < count; next++) if (valid(current, next)) candidates.push({ next, score: gain(chord(current, next)) });
      candidates.sort((a, b) => b.score - a.score || a.next - b.next);
      let bridge = -1, best = 1e-8;
      for (const candidate of candidates.slice(0, 12)) {
        const line = chord(current, candidate.next);
        apply(line, -1); uses[line.key]++;
        const follow = nextFrom(candidate.next);
        apply(line, 1); uses[line.key]--;
        if (follow.best >= 0 && candidate.score + follow.score > best) { best = candidate.score + follow.score; bridge = candidate.next; }
      }
      if (bridge < 0) break;
      add(bridge);
    }
    const last = route.length - 1;
    if (last === first) break;
    const attempts = (last - first) * Math.max(0, Math.round(quality));
    for (let attempt = 0; attempt < attempts && last - first > 1; attempt++) {
      const index = first + 1 + Math.floor(rng() * (last - first - 1));
      const a = route[index - 1], old = route[index], b = route[index + 1];
      if (a === b) continue;
      const oldA = chord(a, old), oldB = chord(old, b);
      apply(oldA, 1); apply(oldB, 1); uses[oldA.key]--; uses[oldB.key]--;
      // Temporarily applying the first chord counts overlap exactly when
      // evaluating the second. Every accepted replacement lowers total loss.
      const pairGain = v => {
        const leftLine = chord(a, v), rightLine = chord(v, b);
        const s = gain(leftLine); apply(leftLine, -1);
        const value = s + gain(rightLine); apply(leftLine, 1);
        return value;
      };
      let chosen = old, best = pairGain(old);
      for (let c = 0; c < 6; c++) {
        const next = c < 4 ? (old + count + (c & 1 ? -1 : 1) * (1 + Math.floor(c / 2))) % count : Math.floor(rng() * count);
        if (next === old || !valid(a, next) || !valid(next, b)) continue;
        const score = pairGain(next);
        if (score > best + 1e-7) { best = score; chosen = next; }
      }
      route[index] = chosen;
      const newA = chord(a, chosen), newB = chord(chosen, b);
      apply(newA, -1); apply(newB, -1); uses[newA.key]++; uses[newB.key]++;
    }
    // Refinement may free useful directions. Try again after a short block;
    // never stop merely because one greedy endpoint ran out of positive moves.
    if (last < end && nextFrom(route[last]).best < 0) finished = true;
  }
  return route.slice(0, limit + 1).map(i => nails[i].slice());
}
