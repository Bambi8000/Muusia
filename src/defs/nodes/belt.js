import { Pin, mulberry32, hash2, resample, applyStyle } from "../helpers.js";

export default {
  /* Belt Drive - a tape/belt threading between pulley circles like film
     through rollers. Directed-circle tangent geometry: each pulley has a
     wrap direction (spin); same spins between neighbours -> external
     tangent, opposite spins -> crossing internal tangent. Pulleys come
     from the optional Pulleys input (closed paths approximated as circles)
     or are generated with a seed. */
  key: "belt",
  name: "Belt Drive",
  cat: "gen",
  group: "machines",
  desc: "A tape threading between pulley circles like film through rollers, built from exact circle tangents: Weave Alternate crosses the belt between pulleys (the serpentine look), Same side hugs them all one way, Random mixes per pulley (seeded). Pulleys are generated inside the Margin, or wire closed paths into Pulleys and each becomes a pulley (centroid + mean radius; Polka Dots and Circle Pack work directly, non-circular shapes are approximated as circles). Order picks the visiting sequence, Loop closes the circuit, and an open belt curls End wrap degrees around its end pulleys. Belt width 0 draws a single line; wider belts render as Edges (two offset lines) or Ribbon (a filled tape: outline plus parallel rail lines at Fill pitch across the width - a closed capsule on an open belt). Gap lifts the belt off the pulley edge, and a wide belt rides half its width further out so the inner edge clears the pulley by Gap. The tape never cuts through a pulley: a straight run that would hit one (loose ones included) deflects around it like tape pressing on a roller. Where a wide belt would pinch through itself at a tight wrap, Auto idlers inserts a small guide roller behind the crossing that steers the belt clear, exactly like the idler pulleys in real machines. Show tape and Show pulleys plot each part alone for separate passes. Pulley draw adds outlines plus Rings or Spiral fills on a seeded Filled % of pulleys; Loose pulleys scatters extra circles that the belt ignores. The Empty output carries every pulley circle that got no built-in fill - all of them when Pulley draw is Outline or None, unfilled ones under Rings/Spiral, auto idlers included - as clean closed regions on the Pulley pen, untouched by the Style input: wire it straight into a region-filling node and Merge the result on top. Tip: Ribbon + large width turns the belt itself into a shape for BG Fill's Void input.",
  ins: [Pin("style", "Style"), Pin("paths", "Pulleys")],
  outs: [Pin("paths", "Out"), Pin("paths", "Empty")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "count", label: "Pulleys", type: "slider", min: 2, max: 24, step: 1, def: 7 },
    { key: "rmin", label: "Min radius", type: "slider", min: 2, max: 40, step: 0.5, def: 6 },
    { key: "rmax", label: "Max radius", type: "slider", min: 2, max: 60, step: 0.5, def: 18 },
    { key: "loose", label: "Loose pulleys", type: "slider", min: 0, max: 20, step: 1, def: 3 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "order", label: "Order", type: "select", options: ["Chain", "Source order", "Random"], def: "Chain" },
    { key: "weave", label: "Weave", type: "select", options: ["Alternate", "Same side", "Random"], def: "Alternate" },
    { key: "loop", label: "Loop", type: "check", def: true },
    { key: "endwrap", label: "End wrap deg", type: "slider", min: 0, max: 330, step: 5, def: 150, showIf: (p) => !p.loop },
    { key: "showtape", label: "Show tape", type: "check", def: true },
    { key: "width", label: "Belt width", type: "slider", min: 0, max: 24, step: 0.5, def: 0, showIf: (p) => p.showtape },
    { key: "brender", label: "Belt render", type: "select", options: ["Centerline", "Edges", "Ribbon"], def: "Edges", showIf: (p) => p.showtape && p.width > 0 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 15, step: 0.5, def: 0, showIf: (p) => p.showtape },
    { key: "idlers", label: "Auto idlers", type: "check", def: true, showIf: (p) => p.showtape && p.width > 0 },
    { key: "showpul", label: "Show pulleys", type: "check", def: true },
    { key: "pdraw", label: "Pulley draw", type: "select", options: ["Outline", "Rings", "Spiral", "None"], def: "Rings", showIf: (p) => p.showpul },
    { key: "fillfrac", label: "Filled %", type: "slider", min: 0, max: 100, step: 5, def: 55, showIf: (p) => p.showpul && (p.pdraw === "Rings" || p.pdraw === "Spiral") },
    { key: "pitch", label: "Fill pitch", type: "slider", min: 0.4, max: 5, step: 0.1, def: 1, showIf: (p) => (p.showpul && (p.pdraw === "Rings" || p.pdraw === "Spiral")) || (p.showtape && p.width > 0 && p.brender === "Ribbon") },
    { key: "lpen", label: "Belt pen", type: "pen", def: 0, showIf: (p) => p.showtape },
    { key: "ppen", label: "Pulley pen", type: "pen", def: 0, showIf: (p) => p.showpul },
  ],

  /* Shared layout: pulley circles + visit route + spins. Called as a
     method from both compute and overlay (the verified-safe pattern);
     overlay additionally guards the binding. */
  _layout(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const margin = Math.max(0, p.margin);
    const gap = Math.max(0, p.gap);
    const width = Math.max(0, p.width);
    const pulleys = [];
    const src = ins && ins[1];
    const wired = !!(src && src.paths && src.paths.length);

    if (wired) {
      for (const path of src.paths) {
        if (pulleys.length >= 64) break;
        if (!path || !path.pts || path.pts.length < 3 || !path.closed) continue;
        const pts = resample(path.pts, true, 2);
        if (pts.length < 3) continue;
        let cx = 0, cy = 0;
        for (const q of pts) { cx += q[0]; cy += q[1]; }
        cx /= pts.length; cy /= pts.length;
        let r = 0;
        for (const q of pts) r += Math.hypot(q[0] - cx, q[1] - cy);
        r /= pts.length;
        if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r < 0.8) continue;
        pulleys.push({ x: cx, y: cy, r, onBelt: true });
      }
    } else {
      const rng = mulberry32((p.seed >>> 0) * 7919 + 13);
      let rmin = Math.max(0.8, Math.min(p.rmin, p.rmax));
      let rmax = Math.max(0.8, Math.max(p.rmin, p.rmax));
      const nBelt = Math.max(0, Math.min(64, Math.round(p.count)));
      const nLoose = Math.max(0, Math.min(64, Math.round(p.loose)));
      const clear = Math.max(2, width + 2 * gap + 3);
      for (let i = 0; i < nBelt + nLoose; i++) {
        let placed = null;
        for (let t = 0; t < 240 && !placed; t++) {
          const shrink = 1 - 0.6 * (t / 240);
          const r = rmin + rng() * (rmax - rmin) * shrink;
          const spanX = W - 2 * (margin + r), spanY = H - 2 * (margin + r);
          const jx = rng(), jy = rng();
          if (spanX <= 0 || spanY <= 0) continue;
          const x = margin + r + jx * spanX;
          const y = margin + r + jy * spanY;
          let ok = true;
          for (const q of pulleys) {
            if (Math.hypot(q.x - x, q.y - y) < q.r + r + clear) { ok = false; break; }
          }
          if (ok) placed = { x, y, r, onBelt: i < nBelt };
        }
        if (placed) pulleys.push(placed);
      }
    }

    /* visit order over on-belt pulleys */
    const beltIdx = [];
    for (let i = 0; i < pulleys.length; i++) if (pulleys[i].onBelt) beltIdx.push(i);
    let route = beltIdx.slice();
    if (p.order === "Random") {
      const rr = mulberry32((p.seed >>> 0) * 613 + 29);
      for (let i = route.length - 1; i > 0; i--) {
        const j = Math.floor(rr() * (i + 1));
        const t = route[i]; route[i] = route[j]; route[j] = t;
      }
    } else if (p.order === "Chain" && route.length > 2) {
      const rr = mulberry32((p.seed >>> 0) * 331 + 71);
      const left = route.slice();
      const out = [left.splice(Math.floor(rr() * left.length), 1)[0]];
      while (left.length) {
        const c = pulleys[out[out.length - 1]];
        let bi = 0, bd = Infinity;
        for (let i = 0; i < left.length; i++) {
          const q = pulleys[left[i]];
          const d = Math.hypot(q.x - c.x, q.y - c.y);
          if (d < bd) { bd = d; bi = i; }
        }
        out.push(left.splice(bi, 1)[0]);
      }
      route = out;
    }

    /* spins along the route */
    const rs = mulberry32((p.seed >>> 0) * 953 + 5);
    const spins = route.map((_, j) => {
      if (p.weave === "Same side") return 1;
      if (p.weave === "Random") return rs() < 0.5 ? 1 : -1;
      return j % 2 === 0 ? 1 : -1;
    });
    return { pulleys, route, spins, gap, width };
  },

  overlay(p, ctx, ins, node) {
    const guides = [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
    try {
      if (typeof this._layout !== "function") return guides;
      const L = this._layout(ins, p, ctx);
      let n = 0;
      for (const q of L.pulleys) {
        if (n++ >= 64) break;
        guides.push({ kind: "circle", cx: q.x, cy: q.y, r: q.r + L.gap });
      }
    } catch (e) { /* an overlay must never throw */ }
    return guides;
  },

  compute(ins, p, ctx, node) {
    const L = this._layout(ins, p, ctx);
    const pulleys = L.pulleys, gap = L.gap, width = L.width;
    const lpen = Math.max(0, Math.min(11, Math.round(p.lpen)));
    const ppen = Math.max(0, Math.min(11, Math.round(p.ppen)));
    const TAU = Math.PI * 2;
    const mod = (a, b) => ((a % b) + b) % b;
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || used > BUDGET) return;
      used += pts.length;
      paths.push({ pts, closed, layer });
    };

    /* --- build the belt route with validity fallbacks ---
       the belt centerline rides half its width off the gap ring so the
       inner edge of a wide belt clears the pulley by exactly Gap */
    const halfw = width / 2;
    const eff = (i) => pulleys[i].r + gap + halfw;
    const tang = (i, si, j, sj) => {
      const a = pulleys[i], b = pulleys[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < 1e-4) return null;
      const R1 = si * eff(i), R2 = sj * eff(j);
      const k = (R1 - R2) / d;
      if (k * k > 0.9998) return null;
      const ux = dx / d, uy = dy / d, q = Math.sqrt(Math.max(0, 1 - k * k));
      const nx = k * ux + q * uy, ny = k * uy - q * ux;
      return { ax: a.x + R1 * nx, ay: a.y + R1 * ny, bx: b.x + R2 * nx, by: b.y + R2 * ny };
    };

    let chain = [];
    {
      const route = L.route, spins = L.spins;
      for (let j = 0; j < route.length; j++) {
        if (chain.length === 0) { chain.push({ i: route[j], s: spins[j] }); continue; }
        const prev = chain[chain.length - 1];
        let s = spins[j];
        if (!tang(prev.i, prev.s, route[j], s)) s = prev.s;
        if (!tang(prev.i, prev.s, route[j], s)) continue;
        chain.push({ i: route[j], s });
      }
      if (p.loop) {
        while (chain.length > 2 && !tang(chain[chain.length - 1].i, chain[chain.length - 1].s, chain[0].i, chain[0].s)) {
          const last = chain[chain.length - 1];
          const flipped = -last.s;
          const inOk = tang(chain[chain.length - 2].i, chain[chain.length - 2].s, last.i, flipped);
          const outOk = tang(last.i, flipped, chain[0].i, chain[0].s);
          if (inOk && outOk) { last.s = flipped; break; }
          chain.pop();
        }
        if (chain.length === 2 && !tang(chain[1].i, chain[1].s, chain[0].i, chain[0].s)) {
          chain[1].s = chain[0].s;
        }
      }
    }

    /* --- roller collision: a tangent run may not cut through any pulley;
       deflect around the obstacle on the side the line already passes,
       exactly like tape pressing against an intervening roller --- */
    const segDist = (x, y, ax, ay, bx, by) => {
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    };
    const resolveCollisions = () => {
      const skip = {};
      let guard = 0;
      while (chain.length >= 2 && guard++ < 80) {
        const segN = (p.loop && chain.length >= 2) ? chain.length : chain.length - 1;
        let inserted = false;
        for (let j = 0; j < segN && !inserted; j++) {
          const a = chain[j], b = chain[(j + 1) % chain.length];
          const t = tang(a.i, a.s, b.i, b.s);
          if (!t) continue;
          const dxs = t.bx - t.ax, dys = t.by - t.ay, Ls = Math.hypot(dxs, dys);
          if (Ls < 1e-6) continue;
          let best = -1, bestT = Infinity, bestS = 1;
          for (let k = 0; k < pulleys.length; k++) {
            if (k === a.i || k === b.i) continue;
            if (skip[a.i + "_" + b.i + "_" + k]) continue;
            const c = pulleys[k];
            if (segDist(c.x, c.y, t.ax, t.ay, t.bx, t.by) < eff(k) - 0.01) {
              const tt = ((c.x - t.ax) * dxs + (c.y - t.ay) * dys) / (Ls * Ls);
              if (tt < bestT) {
                bestT = tt;
                best = k;
                bestS = (dxs * (c.y - t.ay) - dys * (c.x - t.ax)) >= 0 ? 1 : -1;
              }
            }
          }
          if (best < 0) continue;
          const sA = bestS, sB = -bestS;
          if (tang(a.i, a.s, best, sA) && tang(best, sA, b.i, b.s)) {
            chain.splice(j + 1, 0, { i: best, s: sA });
          } else if (tang(a.i, a.s, best, sB) && tang(best, sB, b.i, b.s)) {
            chain.splice(j + 1, 0, { i: best, s: sB });
          } else {
            skip[a.i + "_" + b.i + "_" + best] = 1;
          }
          inserted = true;
        }
        if (!inserted) break;
      }
    };
    resolveCollisions();

    /* --- pinch fix: when the incoming and outgoing runs of one wrap
       cross at an ACUTE angle, a wide belt overlaps itself in a long
       sliver. Try a small idler roller in the fork (like real machines),
       fall back to flipping the wrap side; every candidate is measured
       and reverted unless it strictly reduces the pinch count, so the
       fix can never make things worse --- */
    if (width > 0 && p.idlers !== false && chain.length >= 2) {
      const segCross = (ax, ay, bx, by, cx2, cy2, dx2, dy2) => {
        const d1x = bx - ax, d1y = by - ay, d2x = dx2 - cx2, d2y = dy2 - cy2;
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 1e-9) return null;
        const t = ((cx2 - ax) * d2y - (cy2 - ay) * d2x) / den;
        const u = ((cx2 - ax) * d1y - (cy2 - ay) * d1x) / den;
        if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
        return [ax + d1x * t, ay + d1y * t];
      };
      const buildT = () => {
        const segN = (p.loop && chain.length >= 2) ? chain.length : chain.length - 1;
        const T = [];
        for (let j2 = 0; j2 < segN; j2++) {
          const a = chain[j2], b = chain[(j2 + 1) % chain.length];
          const t = tang(a.i, a.s, b.i, b.s);
          if (!t) return null;
          T.push(t);
        }
        return T;
      };
      const COSTHR = Math.cos((30 * Math.PI) / 180);
      const pinchList = () => {
        const T = buildT();
        if (!T) return null;
        const segN = T.length;
        const out = [];
        for (let m = 0; m < chain.length; m++) {
          if (pulleys[chain[m].i].idler) continue;
          const tout = m < segN ? T[m] : null;
          const tin = m > 0 ? T[m - 1] : (p.loop ? T[segN - 1] : null);
          if (!tin || !tout) continue;
          const X = segCross(tin.ax, tin.ay, tin.bx, tin.by, tout.ax, tout.ay, tout.bx, tout.by);
          if (!X) continue;
          const v1x = tin.bx - tin.ax, v1y = tin.by - tin.ay;
          const v2x = tout.bx - tout.ax, v2y = tout.by - tout.ay;
          const co = Math.abs(v1x * v2x + v1y * v2y) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1);
          if (co > COSTHR) out.push({ m, X });
        }
        return out;
      };
      const iR = Math.min(8, Math.max(2.5, halfw + 1.5));
      const unfix = {};
      let fixes = 0;
      while (fixes < 6) {
        const list = pinchList();
        if (!list) break;
        const job = list.find((q) => !unfix[chain[q.m].i]);
        if (!job) break;
        const before = list.length;
        const pid = chain[job.m].i;
        const snapC = chain.map((c) => ({ i: c.i, s: c.s }));
        const snapN = pulleys.length;
        const restore = () => {
          chain.length = 0;
          for (const c of snapC) chain.push({ i: c.i, s: c.s });
          pulleys.length = snapN;
        };
        const better = () => {
          const l2 = pinchList();
          return l2 && l2.length < before;
        };
        /* candidate 1: idler roller in the fork past the crossing */
        {
          const P = pulleys[pid];
          const dx = job.X[0] - P.x, dy = job.X[1] - P.y, dl = Math.hypot(dx, dy) || 1;
          let cx = 0, cy = 0, ok2 = false;
          for (let push = 0; push < 5 && !ok2; push++) {
            const dist = dl + iR + gap + halfw + 0.8 + push * 3;
            cx = P.x + (dx / dl) * dist; cy = P.y + (dy / dl) * dist;
            ok2 = pulleys.every((q) => Math.hypot(q.x - cx, q.y - cy) >= q.r + iR + 0.5);
          }
          if (ok2) {
            pulleys.push({ x: cx, y: cy, r: iR, onBelt: false, idler: true });
            chain.splice(job.m + 1, 0, { i: pulleys.length - 1, s: -chain[job.m].s });
            resolveCollisions();
            if (better()) { fixes++; continue; }
            restore();
          }
        }
        /* candidate 2: wrap the pulley from the other side */
        {
          const at = chain.findIndex((c, idx) => c.i === pid && idx === job.m);
          if (at >= 0) {
            chain[at].s = -chain[at].s;
            resolveCollisions();
            if (better()) { fixes++; continue; }
            restore();
          }
        }
        unfix[pid] = 1;
      }
    }

    /* --- belt as primitives: tangent lines + arcs --- */
    const prims = [];
    const closedBelt = !!p.loop && chain.length >= 2;
    if (chain.length >= 2) {
      const segN = closedBelt ? chain.length : chain.length - 1;
      const tangents = [];
      for (let j = 0; j < segN; j++) {
        const a = chain[j], b = chain[(j + 1) % chain.length];
        tangents.push(tang(a.i, a.s, b.i, b.s));
      }
      if (!tangents.some((t) => !t)) {
        const ang = (i, x, y) => Math.atan2(y - pulleys[i].y, x - pulleys[i].x);
        const wrap = (Math.max(0, Math.min(350, p.endwrap)) * Math.PI) / 180;
        for (let j = 0; j < segN; j++) {
          const a = chain[j], t = tangents[j];
          if (j === 0 && !closedBelt) {
            if (wrap > 0.001) {
              const aD = ang(a.i, t.ax, t.ay);
              prims.push({ type: "arc", i: a.i, a0: aD - a.s * wrap, sweep: a.s * wrap });
            }
          } else {
            const tPrev = tangents[mod(j - 1, segN)];
            const aA = ang(a.i, tPrev.bx, tPrev.by);
            const aD = ang(a.i, t.ax, t.ay);
            const sw = a.s > 0 ? mod(aD - aA, TAU) : mod(aA - aD, TAU);
            prims.push({ type: "arc", i: a.i, a0: aA, sweep: a.s * sw });
          }
          prims.push({ type: "line", x0: t.ax, y0: t.ay, x1: t.bx, y1: t.by });
        }
        if (!closedBelt && wrap > 0.001) {
          const last = chain[chain.length - 1], tPrev = tangents[segN - 1];
          const aA = ang(last.i, tPrev.bx, tPrev.by);
          prims.push({ type: "arc", i: last.i, a0: aA, sweep: last.s * wrap });
        }
      }
    }

    /* --- emit belt polyline(s) at offset e from the centerline --- */
    const emit = (e) => {
      const pts = [];
      const add = (x, y) => {
        const q = pts[pts.length - 1];
        if (q && Math.abs(q[0] - x) < 1e-4 && Math.abs(q[1] - y) < 1e-4) return;
        pts.push([x, y]);
      };
      for (const pr of prims) {
        if (pr.type === "line") {
          const dx = pr.x1 - pr.x0, dy = pr.y1 - pr.y0, d = Math.hypot(dx, dy);
          if (d < 1e-6) continue;
          const ox = (dy / d) * e, oy = (-dx / d) * e;
          add(pr.x0 + ox, pr.y0 + oy);
          add(pr.x1 + ox, pr.y1 + oy);
        } else {
          const c = pulleys[pr.i];
          const spin = pr.sweep >= 0 ? 1 : -1;
          const R = Math.max(0.05, eff(pr.i) + e * spin);
          const sw = Math.abs(pr.sweep);
          const n = Math.max(2, Math.ceil((R * sw) / 0.8));
          for (let k = 0; k <= n; k++) {
            const a = pr.a0 + pr.sweep * (k / n);
            add(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R);
          }
        }
      }
      if (closedBelt && pts.length > 2) {
        const f = pts[0], l = pts[pts.length - 1];
        if (Math.abs(f[0] - l[0]) < 1e-4 && Math.abs(f[1] - l[1]) < 1e-4) pts.pop();
      }
      return pts;
    };

    if (prims.length && p.showtape !== false) {
      const mode = width > 0 ? p.brender : "Centerline";
      if (mode === "Centerline") {
        push(emit(0), closedBelt, lpen);
      } else if (mode === "Edges") {
        push(emit(halfw), closedBelt, lpen);
        push(emit(-halfw), closedBelt, lpen);
      } else {
        /* Ribbon: a filled tape - outline plus parallel rail lines
           across the width at Fill pitch spacing */
        if (closedBelt) {
          push(emit(halfw), true, lpen);
          push(emit(-halfw), true, lpen);
        } else {
          const a = emit(halfw), b = emit(-halfw).reverse();
          push(a.concat(b), true, lpen);
        }
        const rp = Math.max(0.4, p.pitch);
        for (let e = -halfw + rp; e < halfw - rp * 0.45; e += rp) {
          push(emit(e), closedBelt, lpen);
        }
      }
    }

    /* --- pulleys: outlines and seeded fills --- */
    const circle = (cx, cy, r) => {
      const n = Math.max(16, Math.ceil((TAU * r) / 1));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return pts;
    };
    const frac = Math.max(0, Math.min(100, p.fillfrac)) / 100;
    const isFilled = (i) => !pulleys[i].idler && (p.pdraw === "Rings" || p.pdraw === "Spiral") && hash2(i, 17, (p.seed >>> 0) * 31 + 7) < frac;
    if (p.showpul !== false && p.pdraw !== "None") {
      const pitch = Math.max(0.3, p.pitch);
      for (let i = 0; i < pulleys.length; i++) {
        const q = pulleys[i];
        push(circle(q.x, q.y, q.r), true, ppen);
        if (!isFilled(i)) continue;
        if (p.pdraw === "Rings") {
          for (let r = q.r - pitch; r > pitch * 0.4; r -= pitch) push(circle(q.x, q.y, r), true, ppen);
        } else {
          const pts = [];
          let a = 0, r = q.r;
          while (r > 0.3 && pts.length < 20000) {
            pts.push([q.x + Math.cos(a) * r, q.y + Math.sin(a) * r]);
            const da = Math.max(0.02, 0.8 / Math.max(0.5, r));
            a += da;
            r = q.r - (pitch * a) / TAU;
          }
          push(pts, false, ppen);
        }
        if (used > BUDGET) break;
      }
    }

    /* --- Empty output: every pulley circle without a built-in fill,
       as clean closed regions for downstream fill nodes (no Style) --- */
    const paths2 = [];
    for (let i = 0; i < pulleys.length; i++) {
      if (isFilled(i) || used > BUDGET) continue;
      const q = pulleys[i];
      const pts = circle(q.x, q.y, q.r);
      used += pts.length;
      paths2.push({ pts, closed: true, layer: ppen });
    }
    return [applyStyle({ paths }, ins[0]), { paths: paths2 }];
  },
};
