/* MUUSIA Era B — v2.21 -> v2.22
   Fix: Mountains cross (dead rowStep line = ReferenceError),
        Delaunay spacing (600-pt cap masked the slider -> spacing escalation),
        Smooth rewrite (Relax mm-radius + Round corners),
        Potato No overlap default (true-extent check),
        Moon Craters default view Top.
   Runs sandbox tests BEFORE touching the file. */
import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const log = [];
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };
const assertOnce = (needle, what) => {
  const i = src.indexOf(needle);
  if (i < 0) die("anchor not found (" + what + ")");
  if (src.indexOf(needle, i + 1) >= 0) die("anchor not unique (" + what + ")");
  return i;
};
function matchBrace(s, open) {
  let depth = 0, mode = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (mode === null) {
      if (c === '"' || c === "'" || c === "`") mode = c;
      else if (c === "/" && n === "/") { mode = "//"; i++; }
      else if (c === "/" && n === "*") { mode = "/*"; i++; }
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (!depth) return i; }
    } else if (mode === "//") { if (c === "\n") mode = null; }
    else if (mode === "/*") { if (c === "*" && n === "/") { mode = null; i++; } }
    else { if (c === "\\") i++; else if (c === mode) mode = null; }
  }
  die("unbalanced braces");
}
function blockBounds(displayName) {
  const ni = assertOnce('name: "' + displayName + '"', "block " + displayName);
  const heads = [...src.slice(0, ni).matchAll(/\n  ([a-z0-9_]+): \{/g)];
  const m = heads[heads.length - 1];
  const start = m.index + 1;
  const close = matchBrace(src, m.index + m[0].length - 1);
  let end = close + 1;
  if (src[end] === ",") end++;
  if (src[end] === "\n") end++;
  return [start, end];
}

/* ================= new node blocks ================= */
const SMOOTH_BLOCK = `  smooth: {
    name: "Smooth", cat: "mod", group: "pathops",
    desc: "Smooths paths. Relax runs an arc-length moving average (Radius mm) over the line - visible on typical densely sampled Muusia geometry; endpoints stay pinned and closed paths wrap. Round corners is classic Chaikin corner-cutting, useful on sparse polylines like Random Lines or Delaunay edges.",
    ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Relax", "Round corners"], def: "Relax" },
      { key: "radius", label: "Radius mm (Relax)", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
      { key: "iter", label: "Iterations", type: "slider", min: 1, max: 5, step: 1, def: 2 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const it = Math.max(1, Math.min(8, Math.round(p.iter)));
      if (p.mode === "Round corners") {
        const chaikin = (pts, closed) => {
          if (pts.length < 3) return pts;
          const out = [];
          const N = pts.length;
          const last = closed ? N : N - 1;
          if (!closed) out.push(pts[0].slice());
          for (let i = 0; i < last; i++) {
            const a = pts[i], b = pts[(i + 1) % N];
            out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
            out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
          }
          if (!closed) out.push(pts[N - 1].slice());
          return out;
        };
        const paths = src.paths.map((path) => {
          let pts = path.pts;
          for (let i = 0; i < it; i++) pts = chaikin(pts, path.closed);
          return { ...path, pts };
        });
        return { paths };
      }
      /* Relax: moving average over a Radius-mm arc-length window */
      const R = Math.max(0.2, p.radius);
      const step = Math.max(0.4, Math.min(1.5, R / 4));
      const w = Math.max(1, Math.round(R / step));
      const paths = src.paths.map((path) => {
        if (path.pts.length < 3) return path;
        let pts = resample(path.pts, path.closed, step);
        const N = pts.length;
        if (N < 5) return path;
        for (let n = 0; n < it; n++) {
          const out = new Array(N);
          for (let i = 0; i < N; i++) {
            if (!path.closed && (i === 0 || i === N - 1)) { out[i] = pts[i]; continue; }
            let sx = 0, sy = 0, cnt = 0;
            for (let k = -w; k <= w; k++) {
              let j = i + k;
              if (path.closed) j = ((j % N) + N) % N;
              else { if (j < 0) j = 0; else if (j > N - 1) j = N - 1; }
              sx += pts[j][0]; sy += pts[j][1]; cnt++;
            }
            out[i] = [sx / cnt, sy / cnt];
          }
          pts = out;
        }
        return { ...path, pts };
      });
      return { paths };
    },
  },
`;

const POTATO_BLOCK = `  potato: {
      name: "Potato",
    cat: "gen", group: "nature",
    desc: "Asymmetric blobs (low-frequency harmonics + random squash) with optional eye texture as dots or curved arcs. Placement: No overlap keeps every potato fully separated using its true extent (fewer may fit on a tight sheet); Loose allows touching and light overlap.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Potatoes", type: "slider", min: 1, max: 60, step: 1, def: 9 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 120, step: 1, def: 38 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "irr", label: "Irregularity", type: "slider", min: 0, max: 0.6, step: 0.02, def: 0.22 },
      { key: "place", label: "Placement", type: "select", options: ["No overlap", "Loose (may overlap)"], def: "No overlap" },
      { key: "eyes", label: "Eyes (texture)", type: "select", options: ["None", "Dots", "Arcs (eyes)"], def: "Arcs (eyes)" },
      { key: "eyeCount", label: "Eyes per potato", type: "slider", min: 1, max: 30, step: 1, def: 7 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 73 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 2311 + 41);
      const L = Math.round(p.layer);
      const paths = [];
      const placed = []; /* [cx, cy, rMax, R] */
      const noOv = p.place !== "Loose (may overlap)";
      const target = Math.round(p.count);
      let guard = 0;
      while (placed.length < target && guard++ < target * 80) {
        const R = (p.size / 2) * (1 - p.sizeVar * rng());
        /* shape FIRST so the true extent is known before placement */
        const nH = 3;
        const amps = [], phs = [];
        for (let h = 0; h < nH; h++) {
          amps.push((p.irr * R * (0.4 + 0.6 * rng())) / (h + 1));
          phs.push(rng() * Math.PI * 2);
        }
        const squash = 0.75 + 0.2 * rng();
        const sqA = rng() * Math.PI;
        const rAt = (th) => {
          let r = R;
          for (let h = 0; h < nH; h++) r += amps[h] * Math.sin((h + 2) * th + phs[h]);
          return Math.max(R * 0.3, r);
        };
        const ca = Math.cos(sqA), sa = Math.sin(sqA);
        const shape = [];
        let rMax = 0;
        for (let k = 0; k < 72; k++) {
          const th = (k / 72) * Math.PI * 2;
          const r = rAt(th);
          let x = Math.cos(th) * r, y = Math.sin(th) * r;
          const u = x * ca + y * sa, v = -x * sa + y * ca;
          x = u * ca - v * squash * sa;
          y = u * sa + v * squash * ca;
          shape.push([x, y]);
          const d = Math.hypot(x, y);
          if (d > rMax) rMax = d;
        }
        const pad = noOv ? rMax : R;
        if (W - 2 * p.margin < 2 * pad || H - 2 * p.margin < 2 * pad) continue;
        const cx = p.margin + pad + rng() * (W - 2 * p.margin - 2 * pad);
        const cy = p.margin + pad + rng() * (H - 2 * p.margin - 2 * pad);
        let ok = true;
        for (const q of placed) {
          const d = Math.hypot(cx - q[0], cy - q[1]);
          if (noOv ? d < rMax + q[2] + 0.8 : d < (R + q[3]) * 0.75) { ok = false; break; }
        }
        if (!ok && (noOv || guard < target * 40)) continue;
        placed.push([cx, cy, rMax, R]);
        paths.push({ pts: shape.map(([x, y]) => [cx + x, cy + y]), closed: true, layer: L });
        /* silmat */
        if (p.eyes !== "None") {
          for (let e = 0; e < Math.round(p.eyeCount); e++) {
            const th = rng() * Math.PI * 2;
            const rr = Math.sqrt(rng()) * 0.62 * rAt(th) * squash;
            const ex = cx + Math.cos(th) * rr;
            const ey = cy + Math.sin(th) * rr;
            if (p.eyes === "Dots") {
              const er = 0.5 + rng() * 0.9;
              const dot = [];
              for (let q = 0; q < 7; q++) {
                const a = (q / 7) * Math.PI * 2;
                dot.push([ex + Math.cos(a) * er, ey + Math.sin(a) * er]);
              }
              paths.push({ pts: dot, closed: true, layer: L });
            } else {
              const ea = rng() * Math.PI * 2;
              const el = 1 + rng() * 2.2;
              const eca = Math.cos(ea), esa = Math.sin(ea);
              const arc = [[-el, -el * 0.25], [-el * 0.35, el * 0.28], [el * 0.35, el * 0.28], [el, -el * 0.25]];
              paths.push({
                pts: arc.map(([ax, ay]) => [ex + ax * eca - ay * esa, ey + ax * esa + ay * eca]),
                closed: false, layer: L,
              });
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
`;

const DELAUNAY_GATHER = `      /* points: from wired paths (resampled/vertices) or seeded random */
      let pts = [];
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        if (p.spacing > 0.01) {
          /* escalate spacing until under the triangulation budget so the
             slider has a visible effect at every value */
          let sp = Math.max(1, p.spacing);
          const gather = (s) => {
            const out = [];
            for (const pa of ins[0].paths) for (const q of resample(pa.pts, pa.closed, s)) out.push([q[0], q[1]]);
            return out;
          };
          pts = gather(sp);
          let g2 = 0;
          while (pts.length > 600 && g2++ < 14) { sp *= 1.3; pts = gather(sp); }
        } else {
          for (const pa of ins[0].paths) for (const q of pa.pts) pts.push([q[0], q[1]]);
        }
      } else {
        const rng = mulberry32(p.seed * 3803 + 27);
        const N = Math.max(3, Math.min(400, Math.round(p.points)));
        for (let i = 0; i < N; i++) {
          pts.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
        }
      }
`;

/* ================= sandbox tests (run BEFORE editing) ================= */
function realResample(pts, closed, step) {
  if (pts.length < 2) return pts.map((q) => q.slice());
  const P = closed ? pts.concat([pts[0]]) : pts;
  const out = [pts[0].slice()];
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    let ax = P[i - 1][0], ay = P[i - 1][1];
    const bx = P[i][0], by = P[i][1];
    let seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= step && seg > 1e-9) {
      const t = (step - acc) / seg;
      ax = ax + (bx - ax) * t; ay = ay + (by - ay) * t;
      out.push([ax, ay]);
      seg = Math.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += seg;
  }
  if (closed) {
    const l = out[out.length - 1];
    if (Math.hypot(l[0] - pts[0][0], l[1] - pts[0][1]) < 1e-6) out.pop();
  } else {
    const e = pts[pts.length - 1], l = out[out.length - 1];
    if (Math.hypot(l[0] - e[0], l[1] - e[1]) > 0.01) out.push(e.slice());
  }
  return out;
}
const H = {
  Pin: (t, l) => ({ type: t, label: l }),
  EMPTY: { paths: [] },
  PENS: Array.from({ length: 6 }, () => ({})),
  mulberry32: (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
  hash2: () => 0.5, noise2: () => 0.5,
  resample: realResample,
  pathLength: () => 0,
  applyStyle: (ps) => ps,
  signedArea: () => 0,
};
function evalBlock(block) {
  const body = block.replace(/^\s*[a-z0-9_]+: \{/, "({").replace(/\},\s*$/, "})");
  return new Function(...Object.keys(H), '"use strict"; return ' + body + ";")(...Object.values(H));
}
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));
const clone = (x) => JSON.parse(JSON.stringify(x));

{ /* Smooth tests */
  const d = evalBlock(SMOOTH_BLOCK);
  const zig = [];
  for (let i = 0; i <= 100; i++) zig.push([i, i % 2 ? 8 : 0]);
  const input = { paths: [{ pts: zig, closed: false, layer: 0 }] };
  for (const mode of ["Relax", "Round corners"]) {
    const p = { mode, radius: 4, iter: 2 };
    const r1 = d.compute([clone(input)], p, { W: 300, H: 200 });
    const r2 = d.compute([clone(input)], p, { W: 300, H: 200 });
    if (!finiteAll(r1)) die("smooth " + mode + ": non-finite/short");
    if (JSON.stringify(r1) !== JSON.stringify(r2)) die("smooth " + mode + ": non-deterministic");
  }
  const rel = d.compute([clone(input)], { mode: "Relax", radius: 4, iter: 2 }, { W: 300, H: 200 });
  const pts = rel.paths[0].pts;
  let dev = 0;
  const lo = Math.floor(pts.length * 0.15), hi = Math.ceil(pts.length * 0.85);
  for (let i = lo; i < hi; i++) dev = Math.max(dev, Math.abs(pts[i][1] - 4));
  if (dev > 2.5) die("smooth Relax: zigzag not flattened (dev " + dev.toFixed(2) + ")");
  const e0 = pts[0], eN = pts[pts.length - 1];
  if (Math.hypot(e0[0] - 0, e0[1] - 0) > 0.01 || Math.hypot(eN[0] - 100, eN[1] - 0) > 0.01) die("smooth Relax: endpoints moved");
  log.push("smooth sandbox OK (zigzag dev " + dev.toFixed(2) + " mm, endpoints pinned)");
}
{ /* Potato tests */
  const d = evalBlock(POTATO_BLOCK);
  for (const seed of [73, 7, 191]) {
    const p = { count: 12, size: 45, sizeVar: 0.45, irr: 0.35, place: "No overlap", eyes: "None", eyeCount: 7, margin: 10, seed, layer: 0 };
    const r1 = d.compute([undefined], p, { W: 300, H: 200 });
    const r2 = d.compute([undefined], p, { W: 300, H: 200 });
    if (!finiteAll(r1)) die("potato: non-finite");
    if (JSON.stringify(r1) !== JSON.stringify(r2)) die("potato: non-deterministic");
    const blobs = r1.paths.filter((pa) => pa.closed && pa.pts.length > 60);
    for (let a = 0; a < blobs.length; a++) for (let b = a + 1; b < blobs.length; b++) {
      let min = Infinity;
      for (const q of blobs[a].pts) for (const w of blobs[b].pts) {
        const dd = Math.hypot(q[0] - w[0], q[1] - w[1]);
        if (dd < min) min = dd;
      }
      if (min < 0.05) die("potato No overlap: blobs " + a + "/" + b + " touch (seed " + seed + ", gap " + min.toFixed(3) + ")");
    }
    log.push("potato seed " + seed + ": " + blobs.length + "/12 placed, min gaps OK");
  }
  const loose = d.compute([undefined], { count: 9, size: 38, sizeVar: 0.45, irr: 0.22, place: "Loose (may overlap)", eyes: "Arcs (eyes)", eyeCount: 7, margin: 12, seed: 73, layer: 0 }, { W: 300, H: 200 });
  if (!finiteAll(loose)) die("potato Loose: non-finite");
  log.push("potato Loose OK");
}

/* ================= file edits ================= */
{ /* 1. Mountains dead line */
  const i = assertOnce("const step = Math.max(1, Math.round((rowStep", "mountains dead line");
  const ls = src.lastIndexOf("\n", i), le = src.indexOf("\n", i);
  src = src.slice(0, ls) + src.slice(le);
  log.push("mountains: removed dead rowStep line (cross fixed)");
}
{ /* 2. Moon Craters default */
  const a = 'options: ["Top", "3D"], def: "3D"';
  assertOnce(a, "mooncraters view def");
  src = src.replace(a, 'options: ["Top", "3D"], def: "Top"');
  log.push("mooncraters: default view Top");
}
{ /* 3. Smooth block replace */
  const [s, e] = blockBounds("Smooth");
  src = src.slice(0, s) + SMOOTH_BLOCK + src.slice(e);
  log.push("smooth: replaced (Relax + Round corners)");
}
{ /* 4. Potato block replace */
  const [s, e] = blockBounds("Potato");
  src = src.slice(0, s) + POTATO_BLOCK + src.slice(e);
  log.push("potato: replaced (No overlap default)");
}
{ /* 5. Delaunay gathering section */
  const a = "      /* points: from wired paths (resampled/vertices) or seeded random */";
  const b = "      /* dedupe near-identical points";
  const ia = assertOnce(a, "delaunay gather start");
  const ib = src.indexOf(b, ia);
  if (ib < 0) die("delaunay gather end anchor");
  src = src.slice(0, ia) + DELAUNAY_GATHER + src.slice(ib);
  log.push("delaunay: spacing escalation in");
}
{ /* 6. help table entries if present */
  src = src.replace(/smooth: "corner-rounding relaxation\."/,
    'smooth: "Relax: arc-length moving average (Radius mm) that visibly smooths dense paths, endpoints pinned. Round corners: Chaikin corner-cutting for sparse polylines."');
  src = src.replace(/potato: "(?:[^"\\]|\\.)*"/,
    'potato: "asymmetric blobs (low-frequency harmonics + random squash); No overlap placement keeps potatoes fully separated (default), Loose allows touching; optional eyes as dots or arcs."');
}
{ /* 7. version */
  const vm = src.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  if (!vm) die("APP_VERSION not found");
  if (vm[1] !== "2.21") die("expected 2.21, found " + vm[1]);
  src = src.replace(vm[0], vm[0].replace("2.21", "2.22"));
}
const count = (src.match(/cat: "/g) || []).length;
log.push('node count = ' + count + " (expected 165)");
fs.writeFileSync(FILE + ".bak-era-b", fs.readFileSync(FILE));
fs.writeFileSync(FILE, src);
log.forEach((l) => console.log(l));
console.log("OK - now run: npm run build");