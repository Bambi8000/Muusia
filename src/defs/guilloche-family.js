import { mulberry32, noise2 } from "./helpers.js";

/* Guilloché curve family - the banknote fine-line mathematics shared by the
   Guilloché generator and the BG Fill Guilloché mode.

   The caller places the family on the sheet (R, cx, cy) and gets back complete
   UNCLIPPED curves; each consumer applies its own clipping, pen mapping and
   point-budget policy on top. All randomness is seeded (mulberry32 + noise2),
   so identical arguments always produce identical geometry: the same project
   and frame re-draw byte-identical plates. */

const TAU = Math.PI * 2;

/* Samples per curve, by style. The wavy styles scale with the lobe count so a
   full ripple is always resolved; the fan is a straight-ish chord so far fewer
   samples suffice; the spiral multiplies by its turn count. */
export function guillocheSamples(mode, waves, copies) {
  const k = Math.max(1, Math.round(waves));
  const N = Math.max(1, Math.round(copies));
  if (mode === "Fan") return Math.min(161, Math.max(16, Math.round(2 * Math.sqrt(2 * k) + 1)));
  if (mode === "Spiral") {
    const turns = Math.max(2, Math.min(60, Math.round(N * 0.5)));
    return Math.min(60000, Math.max(128, Math.round(k * turns * 2)));
  }
  return Math.min(720, Math.max(64, Math.round(2 * k)));
}

/* Curves per motif, before any budget thinning. Every style except the single
   coil draws one curve per copy (Weave alternates its two families within the
   same copy count). */
export function guillocheCurveCount(mode, copies) {
  if (mode === "Spiral") return 1;
  return Math.max(1, Math.round(copies));
}

/**
 * @param {object} o { mode, waves, copies, amplitude, growth, jitter, angle (rad),
 *                     seed, R, cx, cy, accent (0..1 fraction), samples? (override) }
 * @returns {{ pts: number[][], closed: boolean, slot: 0|1 }[]} complete family;
 *   slot 1 marks the accent share, mapped to pens by the consumer.
 */
export function guillocheFamily(o) {
  const mode = typeof o.mode === "string" && o.mode ? o.mode : "Rosette";
  const k = Math.max(1, Math.round(o.waves));
  const N = Math.max(1, Math.round(o.copies));
  const e = +o.amplitude || 0;
  const g = +o.growth || 0;
  const jit = +o.jitter || 0;
  const rot = +o.angle || 0;
  const seed = Math.round(+o.seed || 0);
  const R = +o.R;
  const cx = +o.cx;
  const cy = +o.cy;
  const accentF = +o.accent || 0;

  const S = Math.max(2, Math.round(o.samples ?? guillocheSamples(mode, k, N)));

  const paths = [];
  const pushCurve = (pts, closed, penSlot) => {
    if (pts.length >= 2) paths.push({ pts, closed, slot: penSlot });
  };

  const copyMeta = [];
  for (let i = 0; i < N; i++) {
    const rng = mulberry32((seed ^ Math.imul(i + 1, 0x9e3779b9) | 0) >>> 0);
    copyMeta.push({ phi: rng() * TAU, delta: (rng() * 2 - 1) * jit * (Math.PI / N) * 0.5, pick: rng() });
  }
  const slotOf = (i) => (accentF > 0 && copyMeta[i].pick < accentF ? 1 : 0);
  const wob = (theta, i) => jit * e * R * 0.5 * (noise2(theta * 1.7 + i * 6.17, i * 2.31, seed) * 2 - 1);

  if (mode === "Fan") {
    for (let i = 0; i < N; i++) {
      const beta = rot + (TAU * i) / N + copyMeta[i].delta * 2;
      const d = R * (0.25 + 0.65 * mulberry32((seed ^ Math.imul(i + 1, 0x51ed270b) | 0) >>> 0)());
      const dd = Math.min(d, R * 0.92);
      const half = Math.sqrt(Math.max(0, R * R - dd * dd)) * 0.9;
      const ux = -Math.sin(beta), uy = Math.cos(beta);
      const bx = cx + Math.cos(beta) * dd, by = cy + Math.sin(beta) * dd;
      const pts = [];
      for (let s = 0; s <= S; s++) {
        const t = s / S * 2 - 1;
        const w = e * R * 0.35 * Math.sin(k * Math.PI * t + copyMeta[i].phi) + wob(t * Math.PI, i) * 0.5;
        pts.push([bx + ux * t * half + ux * w, by + uy * t * half + uy * w]);
      }
      pushCurve(pts, false, slotOf(i));
    }
  } else if (mode === "Spiral") {
    const turns = Math.max(2, Math.min(60, Math.round(N * 0.5)));
    const m0 = copyMeta[0];
    const pts = [];
    for (let s = 0; s <= S; s++) {
      const th = (s / S) * turns * TAU;
      const shrink = 1 - (th / (turns * TAU)) * 0.88;
      const r = R * shrink * (1 - e * Math.cos(k * th + m0.phi)) + wob(th, 0);
      const a = th + rot;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    pushCurve(pts, false, 0);
  } else {
    const weave = mode === "Weave";
    const rings = mode === "Rings";
    for (let i = 0; i < N; i++) {
      const fam = weave ? (i % 2 === 1 ? 1 : -1) : 1;
      const scale = (1 + i * g) * (weave && fam === 1 ? 1.04 : 1);
      const a0 = rot + (TAU * i) / N + copyMeta[i].delta + (weave && fam === 1 ? Math.PI / k : 0);
      const pts = new Array(S);
      for (let s = 0; s < S; s++) {
        const th = (s / S) * TAU;
        const base = rings ? (1 + 0.6 * e * Math.cos(k * th + copyMeta[i].phi)) : (1 - e * fam * Math.cos(k * th + copyMeta[i].phi));
        const r = R * scale * base + wob(th, i);
        const a = th + a0;
        pts[s] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      }
      pushCurve(pts, true, slotOf(i));
    }
  }

  return paths;
}
