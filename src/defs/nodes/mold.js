import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "mold", name: "Mold", cat: "gen", group: "organic",
  desc: "Seeded growing colonies for plotter animation. Mold expands lobed patches, merges their fronts and matures a stippled spore surface. Mycelium grows persistent, branching hyphae into free space; older branches stay in place as new tips extend. Motion Timeline reads ANIMATE directly: the first frame is the germ, the last is mature, and playback restarts at the loop boundary (growth is not a seamless cycle). Manual ignores the timeline; wire Frame t 0→1 to Growth % through Multiply ×100, or scrub Growth % by hand. Outside animation, Timeline shows the mature drawing. Keep Seed, Colonies, Spread and structure settings fixed during playback. Spread is the maximum colony radius, capped to fit the paper; the dashed circles show its extent. Margin clips growth without rescaling between frames. Mold's rings are fixed age bands behind the moving front; Spores adds small closed plotter loops. Mycelium's Hypha spacing limits crowding, Branching sets fork probability, and Meander bends the tips. All geometry is ordinary 2D pen paths, with bounded detail; this is a visual growth model, not a biological simulation.",
  ins: [Pin("style", "Style")], outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Mold", "Mycelium"], def: "Mold" },
    { key: "motion", label: "Motion", type: "select", options: ["Timeline", "Manual"], def: "Timeline" },
    { key: "growth", label: "Growth %", type: "slider", min: 0, max: 100, step: 0.1, def: 70, showIf: p => p.motion === "Manual" },
    { key: "colonies", label: "Colonies", type: "slider", min: 1, max: 12, step: 1, def: 4 },
    { key: "placement", label: "Placement", type: "select", options: ["Scattered", "Center"], def: "Scattered" },
    { key: "spread", label: "Spread mm", type: "slider", min: 5, max: 300, step: 1, def: 70 },
    { key: "roughness", label: "Edge roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65, showIf: p => p.mode === "Mold" },
    { key: "rings", label: "Growth rings", type: "check", def: true, showIf: p => p.mode === "Mold" },
    { key: "bands", label: "Age bands", type: "slider", min: 1, max: 8, step: 1, def: 5, showIf: p => p.mode === "Mold" && p.rings },
    { key: "spores", label: "Spores", type: "check", def: true, showIf: p => p.mode === "Mold" },
    { key: "density", label: "Spore density %", type: "slider", min: 0, max: 100, step: 1, def: 52, showIf: p => p.mode === "Mold" && p.spores },
    { key: "sporeSize", label: "Spore size mm", type: "slider", min: 0.1, max: 2, step: 0.05, def: 0.65, showIf: p => p.mode === "Mold" && p.spores && p.density > 0 },
    { key: "branching", label: "Branching %", type: "slider", min: 0, max: 25, step: 0.5, def: 7, showIf: p => p.mode === "Mycelium" },
    { key: "spacing", label: "Hypha spacing mm", type: "slider", min: 0.5, max: 5, step: 0.1, def: 1.3, showIf: p => p.mode === "Mycelium" },
    { key: "meander", label: "Meander", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55, showIf: p => p.mode === "Mycelium" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "seed", label: "Seed", type: "seed", def: 73 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const num = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback));
    const W = num(ctx.W, 297, 0, 10000), H = num(ctx.H, 210, 0, 10000);
    const m = num(p.margin, 15, 0, Math.min(W, H) / 2);
    const w = W - 2 * m, h = H - 2 * m;
    if (w < 2 || h < 2) return [];
    const r = Math.min(num(p.spread, 70, 5, 300), Math.min(w, h) * 0.44);
    const rng = mulberry32(num(p.seed, 73, -2147483648, 2147483647) | 0), n = Math.round(num(p.colonies, 4, 1, 12));
    const guides = [{ kind: "rect", x: m, y: m, w, h }];
    for (let i = 0; i < n; i++) {
      const u = rng(), v = rng(), rr = r * (0.8 + rng() * 0.2);
      const x = p.placement === "Center" ? W / 2 + (u - 0.5) * r * (n > 1 ? 0.65 : 0) : m + rr + u * (w - 2 * rr);
      const y = p.placement === "Center" ? H / 2 + (v - 0.5) * r * (n > 1 ? 0.65 : 0) : m + rr + v * (h - 2 * rr);
      guides.push({ kind: "circle", cx: x, cy: y, r: rr });
      for (let j = 0; j < 3; j++) rng();
    }
    return guides;
  },
  compute(ins, p, ctx) {
    const num = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback));
    const W = num(ctx.W, 297, 0, 10000), H = num(ctx.H, 210, 0, 10000);
    const margin = num(p.margin, 15, 0, Math.min(W, H) / 2), w = W - margin * 2, h = H - margin * 2;
    if (w < 2 || h < 2) return EMPTY;
    const frames = Math.max(1, Math.floor(num(ctx.frameCount, 1, 1, 100000)));
    const t = p.motion === "Manual" ? num(p.growth, 70, 0, 100) / 100 : frames > 1 ? num(ctx.frameIdx, 0, 0, frames - 1) / (frames - 1) : 1;
    // A visible germ on the first timeline frame; Manual 0 is truly empty.
    const growth = p.motion === "Manual" ? t : 0.025 + 0.975 * t;
    if (growth <= 0) return EMPTY;
    const seed = num(p.seed, 73, -2147483648, 2147483647) | 0, rng = mulberry32(seed);
    const n = Math.round(num(p.colonies, 4, 1, 12)), radius = Math.min(num(p.spread, 70, 5, 300), Math.min(w, h) * 0.44);
    const sites = [];
    for (let i = 0; i < n; i++) {
      const u = rng(), v = rng(), r = radius * (0.8 + rng() * 0.2);
      const x = p.placement === "Center" ? W / 2 + (u - 0.5) * radius * (n > 1 ? 0.65 : 0) : margin + r + u * (w - 2 * r);
      const y = p.placement === "Center" ? H / 2 + (v - 0.5) * radius * (n > 1 ? 0.65 : 0) : margin + r + v * (h - 2 * r);
      sites.push({ x, y, r, a: rng() * Math.PI * 2, b: rng() * Math.PI * 2, c: rng() * Math.PI * 2 });
    }
    const paths = [], layer = Math.round(num(p.layer, 0, 0, 11));
    let budget = 95000;
    const push = (pts, closed = false) => {
      if (pts.length < 2 || pts.length > budget) return;
      budget -= pts.length; paths.push({ pts, closed, layer });
    };
    const inside = (x, y, inset = 0) => x >= margin + inset && y >= margin + inset && x <= W - margin - inset && y <= H - margin - inset;
    if (p.mode !== "Mycelium") {
      const rough = num(p.roughness, 0.65, 0, 1);
      const arrival = (x, y) => {
        let best = 100;
        for (const s of sites) {
          const dx = x - s.x, dy = y - s.y, a = Math.atan2(dy, dx);
          const lobes = 1 - rough * (0.22 + 0.10 * Math.sin(a * 3 + s.a) + 0.07 * Math.sin(a * 7 + s.b) + 0.035 * Math.cos(a * 13 + s.c));
          best = Math.min(best, Math.hypot(dx, dy) / (s.r * lobes));
        }
        return best;
      };
      // March a fixed field; no frame-dependent fitting or randomized redraws.
      const nx = Math.max(8, Math.min(220, Math.ceil(w / 1.7))), ny = Math.max(8, Math.min(220, Math.ceil(h / 1.7)));
      const dx = w / nx, dy = h / ny, stride = nx + 1;
      const field = new Float64Array(stride * (ny + 1));
      for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) field[y * stride + x] = arrival(margin + x * dx, margin + y * dy);
      const contour = level => {
        const edges = [], links = new Map();
        const connect = (a, b) => { const id = edges.length; edges.push([a, b]); for (const q of [a, b]) { if (!links.has(q.key)) links.set(q.key, []); links.get(q.key).push(id); } };
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          const ids = [y * stride + x, y * stride + x + 1, (y + 1) * stride + x + 1, (y + 1) * stride + x];
          const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], cuts = [];
          for (let e = 0; e < 4; e++) {
            const j = (e + 1) % 4, va = field[ids[e]], vb = field[ids[j]];
            if ((va <= level) === (vb <= level)) continue;
            const f = (level - va) / (vb - va), a = corners[e], b = corners[j];
            cuts.push({ key: Math.min(ids[e], ids[j]) + ":" + Math.max(ids[e], ids[j]), pt: [margin + (a[0] + (b[0] - a[0]) * f) * dx, margin + (a[1] + (b[1] - a[1]) * f) * dy] });
          }
          if (cuts.length === 2) connect(cuts[0], cuts[1]);
          else if (cuts.length === 4) {
            const mid = arrival(margin + (x + 0.5) * dx, margin + (y + 0.5) * dy);
            if ((mid <= level) === (field[ids[0]] <= level)) { connect(cuts[0], cuts[1]); connect(cuts[2], cuts[3]); }
            else { connect(cuts[0], cuts[3]); connect(cuts[1], cuts[2]); }
          }
        }
        const used = new Set();
        const walk = (start, id) => {
          const pts = [start.pt], first = start.key; let at = start;
          while (id !== undefined && !used.has(id)) {
            used.add(id); const e = edges[id]; at = e[0].key === at.key ? e[1] : e[0];
            if (at.key === first) { push(pts, true); return; }
            pts.push(at.pt); id = (links.get(at.key) || []).find(k => !used.has(k));
          }
          push(pts);
        };
        for (const e of edges) for (const q of e) if (links.get(q.key).length === 1 && !used.has(links.get(q.key)[0])) walk(q, links.get(q.key)[0]);
        for (let i = 0; i < edges.length; i++) if (!used.has(i)) walk(edges[i][0], i);
      };
      contour(growth);
      if (p.rings) {
        const bands = Math.round(num(p.bands, 5, 1, 8));
        for (let k = 1; k < bands; k++) if (k / bands < growth - 0.025) contour(k / bands);
      }
      if (p.spores) {
        const density = num(p.density, 52, 0, 100) / 100, size = num(p.sporeSize, 0.65, 0.1, 2);
        const pitch = Math.max(2.2, Math.sqrt(w * h / 11000)), sx = Math.ceil(w / pitch), sy = Math.ceil(h / pitch);
        for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
          const px = margin + (x + 0.15 + rng() * 0.7) * pitch, py = margin + (y + 0.15 + rng() * 0.7) * pitch;
          const accept = rng(), variation = 0.35 + 0.65 * rng(), age = growth - arrival(px, py);
          if (accept > density || age <= 0) continue;
          const r = size * 0.5 * variation * Math.min(1, age / 0.13);
          if (r < 0.025 || !inside(px, py, r)) continue;
          push(Array.from({ length: 9 }, (_, k) => [px + r * Math.cos(k * Math.PI * 2 / 9), py + r * Math.sin(k * Math.PI * 2 / 9)]), true);
        }
      }
    } else {
      const spacing = num(p.spacing, 1.3, 0.5, 5), step = Math.max(0.5, spacing * 0.65);
      const steps = Math.min(420, Math.max(30, Math.ceil(radius * 1.8 / step)));
      const branch = num(p.branching, 7, 0, 25) / 100, meander = num(p.meander, 0.55, 0, 1);
      const grid = new Map(), strokes = [], tips = [], cell = spacing;
      const key = (x, y) => Math.floor(x / cell) + "," + Math.floor(y / cell);
      const mark = (x, y, id, index) => { const k = key(x, y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({ x, y, id, index }); };
      const crowded = (x, y, tip) => {
        const gx = Math.floor(x / cell), gy = Math.floor(y / cell), len = strokes[tip.id].pts.length;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of grid.get((gx + i) + "," + (gy + j)) || []) {
          if (q.id === tip.id && len - q.index < 5) continue;
          if (len < 6 && (q.id === tip.parent || Math.hypot(q.x - tip.start[0], q.y - tip.start[1]) < spacing * 2)) continue;
          if (Math.hypot(q.x - x, q.y - y) < spacing * 0.9) return true;
        }
        return false;
      };
      const spawn = (x, y, angle, time, site, parent = -1) => {
        const id = strokes.length; strokes.push({ pts: [[x, y]], times: [time] });
        tips.push({ id, angle, site, parent, start: [x, y] });
      };
      sites.forEach((s, site) => { for (let j = 0; j < 5; j++) spawn(s.x, s.y, s.a + j * Math.PI * 2 / 5, 0, site); });
      let segments = 0;
      for (let it = 1; it <= steps && tips.length && segments < 14000; it++) {
        const active = tips.splice(0), time = it / steps;
        for (const tip of active) {
          if (segments >= 14000) break;
          const st = strokes[tip.id], a = st.pts[st.pts.length - 1], s = sites[tip.site];
          const field = noise2(a[0] / 15, a[1] / 15, seed + 991) * 2 - 1;
          const radial = Math.atan2(a[1] - s.y, a[0] - s.x);
          const outward = Math.hypot(a[0] - s.x, a[1] - s.y) > step * 2 ? Math.atan2(Math.sin(radial - tip.angle), Math.cos(radial - tip.angle)) * 0.045 : 0;
          const angle = tip.angle + outward + meander * (field * 0.04 + (rng() - 0.5) * 0.4);
          let next = null, chosen = angle;
          for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) {
            const b = [a[0] + Math.cos(angle + turn) * step, a[1] + Math.sin(angle + turn) * step];
            if (inside(...b) && Math.hypot(b[0] - s.x, b[1] - s.y) <= s.r && !crowded(...b, tip)) { next = b; chosen = angle + turn; break; }
          }
          if (!next) continue;
          st.pts.push(next); st.times.push(time); mark(...next, tip.id, st.pts.length - 1); segments++;
          tip.angle = chosen; tips.push(tip);
          if (it > 4 && rng() < branch && tips.length < 500 && strokes.length < 2500) {
            const fork = (rng() < 0.5 ? -1 : 1) * (0.55 + rng() * 0.65);
            spawn(...next, chosen + fork, time, tip.site, tip.id);
            tip.angle -= fork * 0.24;
          }
        }
      }
      // Reveal the same fully grown tree in birth order, including partial tips.
      for (const st of strokes) {
        const pts = [];
        for (let i = 0; i < st.pts.length; i++) {
          if (st.times[i] <= growth) pts.push(st.pts[i].slice());
          else {
            if (i && st.times[i - 1] < growth) {
              const f = (growth - st.times[i - 1]) / (st.times[i] - st.times[i - 1]), a = st.pts[i - 1], b = st.pts[i];
              pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
            }
            break;
          }
        }
        push(pts);
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
