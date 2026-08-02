import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "blobrings",
  name: "Blob Rings",
  cat: "gen",
  group: "organic",
  desc: "Bold ink blobs with nested rings — deformed circles and elongated capsules that ring inward like tree rings, in the spirit of brush-and-ink abstractions. Each blob is a stadium (a spine segment swept by a radius) so nesting is a true erosion: rings keep the spine and shrink the radius, leaving slot-like centers in elongated blobs and dot centers in round ones. Every ring gets its own jitter and wobble phase for the sloppy hand-drawn look; Weight vary doubles some rings into thick strokes and Solid cores fills a share of the blobs black from halfway in. Blobs cluster toward the canvas center (Cluster), overlap by default (negative Spacing), and thin curved Connectors string nearest neighbours together like beads, with small ringed Satellites scattered in the gaps. Elongation and Angle spread control the capsule stretch; everything is seeded.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Blobs", type: "slider", min: 3, max: 60, step: 1, def: 18 },
    { key: "size", label: "Size mm", type: "slider", min: 4, max: 40, step: 0.5, def: 13 },
    { key: "variety", label: "Size variety", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "elong", label: "Elongation", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "angle", label: "Angle °", type: "slider", min: 0, max: 180, step: 1, def: 0 },
    { key: "spread", label: "Angle spread °", type: "slider", min: 0, max: 90, step: 1, def: 12 },
    { key: "cluster", label: "Cluster", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "spacing", label: "Spacing mm", type: "slider", min: -20, max: 10, step: 0.5, def: -4 },
    { key: "pitch", label: "Ring pitch mm", type: "slider", min: 0.5, max: 5, step: 0.05, def: 1.7 },
    { key: "weight", label: "Weight vary", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "solid", label: "Solid cores", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "connectors", label: "Connectors", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "satellites", label: "Satellites", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 58 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 20 || H - 2 * m < 20) return EMPTY;
    const L = Math.round(p.layer);
    const rng = mulberry32((Math.round(p.seed) || 1) * 1237 + 7);
    const paths = [];
    let budget = 120000;
    const push = (pts, closed) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed, layer: L });
    };

    /* ---- stadium-rengas: selkaranka A-B, sade rr, per-rengas wobble ---- */
    const wobAmp = (rr) => p.wobble * Math.min(2.5, 0.3 + rr * 0.22);
    const ringPts = (ax, ay, bx, by, rr, sd) => {
      const ux0 = bx - ax, uy0 = by - ay;
      const sl = Math.hypot(ux0, uy0);
      const ux = sl > 1e-9 ? ux0 / sl : 1, uy = sl > 1e-9 ? uy0 / sl : 0;
      const vx = -uy, vy = ux;
      const amp = wobAmp(rr);
      const pts = [];
      const emit = (px, py, nx, ny) => {
        const d = (noise2(px * 0.22 + sd * 0.61, py * 0.22 - sd * 0.37, sd) - 0.5) * 2 * amp;
        pts.push([px + nx * d, py + ny * d]);
      };
      const arcN = Math.max(6, Math.ceil((Math.PI * rr) / 0.8));
      /* kaari B:n ympari -90..+90 akselista */
      for (let k = 0; k <= arcN; k++) {
        const t = -Math.PI / 2 + (k / arcN) * Math.PI;
        const nx = ux * Math.cos(t) + vx * Math.sin(t), ny = uy * Math.cos(t) + vy * Math.sin(t);
        emit(bx + nx * rr, by + ny * rr, nx, ny);
      }
      /* sivu B->A (+v puoli) */
      const sideN = Math.max(1, Math.ceil(sl / 0.8));
      if (sl > 0.2) for (let k = 1; k < sideN; k++) {
        const t = k / sideN;
        emit(bx + vx * rr - ux0 * t, by + vy * rr - uy0 * t, vx, vy);
      }
      /* kaari A:n ympari +90..+270 */
      for (let k = 0; k <= arcN; k++) {
        const t = Math.PI / 2 + (k / arcN) * Math.PI;
        const nx = ux * Math.cos(t) + vx * Math.sin(t), ny = uy * Math.cos(t) + vy * Math.sin(t);
        emit(ax + nx * rr, ay + ny * rr, nx, ny);
      }
      /* sivu A->B (-v puoli) */
      if (sl > 0.2) for (let k = 1; k < sideN; k++) {
        const t = k / sideN;
        emit(ax - vx * rr + ux0 * t, ay - vy * rr + uy0 * t, -vx, -vy);
      }
      return pts;
    };

    /* ---- blobien sijoittelu: dart-throwing keskiklusterilla ---- */
    const rmax = p.size, rmin = Math.max(1.5, rmax * (1 - 0.8 * p.variety));
    const blobs = []; /* {cx, cy, ax, ay, bx, by, r, R, solid} */
    const target = Math.round(p.count);
    const spacing = p.spacing;
    let guard = 0;
    while (blobs.length < target && guard++ < target * 60) {
      const r = rmin + (rmax - rmin) * Math.pow(rng(), 1.3);
      const segL = r * p.elong * 4.5 * Math.pow(rng(), 1.1);
      const ext = segL / 2 + r + 2.5;
      const lo = m + ext;
      if (W - 2 * lo < 2 || H - 2 * lo < 2) continue;
      const gs = () => (rng() + rng() + rng()) / 3;
      const ux2 = m + ext + rng() * (W - 2 * m - 2 * ext);
      const uy2 = m + ext + rng() * (H - 2 * m - 2 * ext);
      const gx2 = W / 2 + (gs() - 0.5) * (W - 2 * m - 2 * ext) * 0.85;
      const gy2 = H / 2 + (gs() - 0.5) * (H - 2 * m - 2 * ext) * 0.85;
      const cx = ux2 + (gx2 - ux2) * p.cluster;
      const cy = uy2 + (gy2 - uy2) * p.cluster;
      const a = ((p.angle + (rng() - 0.5) * 2 * p.spread) * Math.PI) / 180;
      const R = segL / 2 + r;
      let ok = true;
      for (const q of blobs) {
        const need = Math.max(3, R + q.R + spacing);
        if (Math.hypot(cx - q.cx, cy - q.cy) < need) { ok = false; break; }
      }
      if (!ok) continue;
      blobs.push({
        cx, cy, r, R,
        ax: cx - Math.cos(a) * segL / 2, ay: cy - Math.sin(a) * segL / 2,
        bx: cx + Math.cos(a) * segL / 2, by: cy + Math.sin(a) * segL / 2,
        solid: rng() < p.solid,
      });
    }

    /* ---- renkaat sisaanpain: eroosio = sama selkaranka, pienempi sade ---- */
    const seed = Math.round(p.seed) || 1;
    const drawBlob = (b, bi, pitchMul) => {
      let rr = b.r;
      let ri = 0;
      /* koherentti muodonvaaristys: koko blobi nayteistaa SAMAA kohinakenttaa,
         jolloin renkaat pysyvat kvasi-yhdensuuntaisina; sotkuisuus tulee
         per-rengas keskipistejitterista */
      const fieldSd = seed * 31 + bi * 101;
      while (rr > 0.28 && budget > 0) {
        const sd = fieldSd + ri * 7;
        const jr = mulberry32(sd + 3);
        const jx = (jr() - 0.5) * 2 * p.wobble * p.pitch * 0.55;
        const jy = (jr() - 0.5) * 2 * p.wobble * p.pitch * 0.55;
        push(ringPts(b.ax + jx, b.ay + jy, b.bx + jx, b.by + jy, rr, fieldSd), true);
        /* painovaihtelu: osa renkaista tuplataan paksuksi vedoksi */
        if (jr() < p.weight * 0.45 && rr > 0.9) {
          push(ringPts(b.ax + jx, b.ay + jy, b.bx + jx, b.by + jy, rr - 0.32, fieldSd), true);
          if (jr() < 0.4 && rr > 1.3) push(ringPts(b.ax + jx, b.ay + jy, b.bx + jx, b.by + jy, rr - 0.64, fieldSd), true);
        }
        const solidNow = b.solid && rr <= b.r * 0.55;
        const step = solidNow ? 0.38 : Math.max(0.4, p.pitch * pitchMul * (1 + (jr() - 0.5) * 0.6 * p.wobble));
        rr -= step;
        ri++;
      }
    };
    blobs.forEach((b, bi) => drawBlob(b, bi, 1));

    /* ---- yhdyslangat: kaareva viiva lahimpaan naapuriin, leikattu blobien reunoihin ---- */
    const distToSeg = (x, y, b) => {
      const dx = b.bx - b.ax, dy = b.by - b.ay;
      const L2 = dx * dx + dy * dy;
      let t = L2 > 1e-12 ? ((x - b.ax) * dx + (y - b.ay) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(x - (b.ax + dx * t), y - (b.ay + dy * t));
    };
    if (p.connectors > 0 && blobs.length > 1) {
      const done = new Set();
      for (let i = 0; i < blobs.length; i++) {
        let bj = -1, bd = 1e18;
        for (let j = 0; j < blobs.length; j++) {
          if (j === i) continue;
          const d = Math.hypot(blobs[i].cx - blobs[j].cx, blobs[i].cy - blobs[j].cy);
          if (d < bd) { bd = d; bj = j; }
        }
        const key = Math.min(i, bj) + ":" + Math.max(i, bj);
        if (bj < 0 || done.has(key)) continue;
        done.add(key);
        if (rng() >= p.connectors) continue;
        const A = blobs[i], B = blobs[bj];
        const mx2 = (A.cx + B.cx) / 2, my2 = (A.cy + B.cy) / 2;
        const px2 = -(B.cy - A.cy), py2 = B.cx - A.cx;
        const pl = Math.hypot(px2, py2) || 1;
        const bow = (rng() - 0.5) * 2 * bd * 0.35;
        const c1x = mx2 + (px2 / pl) * bow, c1y = my2 + (py2 / pl) * bow;
        let run = [];
        for (let k = 0; k <= 28; k++) {
          const t = k / 28;
          const x = (1 - t) * (1 - t) * A.cx + 2 * (1 - t) * t * c1x + t * t * B.cx;
          const y = (1 - t) * (1 - t) * A.cy + 2 * (1 - t) * t * c1y + t * t * B.cy;
          const out2 = distToSeg(x, y, A) > A.r + 0.3 && distToSeg(x, y, B) > B.r + 0.3 &&
            x > m && x < W - m && y > m && y < H - m;
          if (out2) run.push([x, y]);
          else if (run.length) { if (run.length >= 3) push(run, false); run = []; }
        }
        if (run.length >= 3) push(run, false);
      }
    }

    /* ---- satelliitit: pienet rengastetut taplat valeihin ---- */
    const nSat = Math.round(p.satellites * target * 1.3);
    let sguard = 0, placedSat = 0;
    const sats = [];
    while (placedSat < nSat && sguard++ < nSat * 50) {
      const r = 1 + rng() * 2.2;
      const cx = m + r + 2 + rng() * (W - 2 * m - 2 * r - 4);
      const cy = m + r + 2 + rng() * (H - 2 * m - 2 * r - 4);
      let ok = true;
      for (const q of blobs) if (distToSeg(cx, cy, q) < q.r + r + 1.5) { ok = false; break; }
      for (const q of sats) if (Math.hypot(cx - q.cx, cy - q.cy) < r + q.r + 2) { ok = false; break; }
      if (!ok) continue;
      const b = { cx, cy, ax: cx, ay: cy, bx: cx, by: cy, r, solid: rng() < p.solid * 0.8 + 0.15 };
      sats.push(b);
      drawBlob(b, 4000 + placedSat, 0.55);
      placedSat++;
    }

    return applyStyle({ paths }, ins[0]);
  },
};
