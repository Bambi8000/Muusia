import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "shade",
  name: "Shade",
  cat: "mod",
  group: "fillstyle",
  desc: "Charcoal-style tonal shading for closed shapes, driven by a MOVABLE light: ink gathers along edges that face away from the light and pools into corners — concave notches strongest — like graphite rubbed into a stealth-bomber silhouette. A darkness field is built inside each shape (edge band × light facing + corner kernels + ambient + body gradient away from the light), then rendered as stacked hatch levels: each level adds a rotated hatch pass only where the field is dark enough, so tone builds up like layered pencil. Light X/Y are % of canvas (beyond 0–100 puts the light off-canvas) and value-drivable — wire an LFO to orbit the sun. Directionality 0 shades all edges equally (pure ambient occlusion); Concave bias 1 pools ink only into notches. Shapes nested inside another act as holes; open paths pass through untouched.",
  ins: [Pin("paths", "Shapes")],
  outs: [Pin("paths")],
  params: [
    { key: "lx", label: "Light X %", type: "slider", min: -50, max: 150, step: 1, def: 20 },
    { key: "ly", label: "Light Y %", type: "slider", min: -50, max: 150, step: 1, def: 5 },
    { key: "lightAmt", label: "Directionality", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7 },
    { key: "band", label: "Edge band mm", type: "slider", min: 1, max: 40, step: 0.5, def: 10 },
    { key: "edgeAmt", label: "Edge shade", type: "slider", min: 0, max: 1, step: 0.01, def: 0.8 },
    { key: "cornerAmt", label: "Corner shade", type: "slider", min: 0, max: 1.5, step: 0.01, def: 0.9 },
    { key: "cornerRad", label: "Corner radius mm", type: "slider", min: 1, max: 30, step: 0.5, def: 8 },
    { key: "concave", label: "Concave bias", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "bodyGrad", label: "Body gradient", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "ambient", label: "Ambient", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.08 },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "levels", label: "Hatch levels", type: "slider", min: 1, max: 6, step: 1, def: 4 },
    { key: "pitch", label: "Hatch pitch mm", type: "slider", min: 0.4, max: 5, step: 0.05, def: 1.1 },
    { key: "angle", label: "Angle °", type: "slider", min: 0, max: 180, step: 1, def: 30 },
    { key: "crossAng", label: "Cross angle °", type: "slider", min: 0, max: 90, step: 1, def: 60 },
    { key: "hand", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "outlines", label: "Keep outlines", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 77 },
    { key: "layer", label: "Shade pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const lx = (ctx.W * p.lx) / 100, ly = (ctx.H * p.ly) / 100;
    return [
      { kind: "point", x: lx, y: ly },
      { kind: "circle", cx: lx, cy: ly, r: 5 },
    ];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const closed = src.paths.filter((pa) => pa.closed && pa.pts.length > 2);
    const open = src.paths.filter((pa) => !pa.closed || pa.pts.length <= 2);
    const out = [];
    if (p.outlines) for (const pa of closed) out.push(pa);
    for (const pa of open) out.push(pa);
    if (!closed.length) return { paths: out };

    const Lx = (ctx.W * p.lx) / 100, Ly = (ctx.H * p.ly) / 100;
    const L = Math.round(p.layer);
    const NL = Math.max(1, Math.min(6, Math.round(p.levels)));
    const pitch = Math.max(0.3, p.pitch);
    const hand = Math.max(0, Math.min(1, p.hand));
    const seed = Math.round(p.seed) || 1;
    let budget = 140000;

    const ringContains = (ring, x, y) => {
      let insd = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) insd = !insd;
      }
      return insd;
    };

    /* ---- ryhmittely: paataso omistaa sisallaan olevat renkaat (reiat) ---- */
    const tops = [];
    for (let i = 0; i < closed.length; i++) {
      const [x0g, y0g] = closed[i].pts[0];
      let insideAny = false;
      for (let k = 0; k < closed.length && !insideAny; k++)
        if (k !== i && ringContains(closed[k].pts, x0g, y0g)) insideAny = true;
      if (!insideAny) tops.push(i);
    }

    for (const ti of tops) {
      const rings = [closed[ti].pts];
      for (let k = 0; k < closed.length; k++)
        if (k !== ti && ringContains(closed[ti].pts, closed[k].pts[0][0], closed[k].pts[0][1]))
          rings.push(closed[k].pts);
      const inside = (x, y) => {
        let c = 0;
        for (const r of rings) if (ringContains(r, x, y)) c++;
        return c % 2 === 1;
      };
      let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
      for (const [x, y] of rings[0]) {
        bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x);
        by0 = Math.min(by0, y); by1 = Math.max(by1, y);
      }
      if (bx1 - bx0 < 2 || by1 - by0 < 2) continue;
      bx0 -= 1; by0 -= 1; bx1 += 1; by1 += 1;

      /* ---- tummuuskentan hila; solukoko sopeutuu ettei paisu ---- */
      let cs = Math.max(0.5, Math.min(1.3, pitch * 0.6));
      let cols = Math.ceil((bx1 - bx0) / cs) + 1;
      let rows = Math.ceil((by1 - by0) / cs) + 1;
      while (cols * rows > 90000) { cs *= 1.35; cols = Math.ceil((bx1 - bx0) / cs) + 1; rows = Math.ceil((by1 - by0) / cs) + 1; }
      const CX = (c) => bx0 + c * cs, CY = (r) => by0 + r * cs;
      const N = cols * rows;
      const mask = new Uint8Array(N);
      /* scanline-taytto: rivikohtaiset leikkauspisteet, even-odd-valit */
      for (let r = 0; r < rows; r++) {
        const y = CY(r);
        const xs = [];
        for (const ring of rings) {
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y)) xs.push(xi + ((xj - xi) * (y - yi)) / (yj - yi));
          }
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const c0 = Math.max(0, Math.ceil((xs[k] - bx0) / cs));
          const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - bx0) / cs));
          for (let c = c0; c <= c1; c++) mask[r * cols + c] = 1;
        }
      }

      /* ---- reunanaytteet normaalilla + valokertoimella ---- */
      const bs = Math.max(0.7, cs * 0.9);
      const sx = [], sy = [], slit = [];
      for (const ring of rings) {
        const rp = resample(ring, true, bs);
        const n = rp.length;
        /* kiintean puolen saanto: ulospain-normaali on samalla puolella kulkusuuntaa
           koko renkaan matkan -> yksi kaanto per rengas, aanestys 3 nayteella */
        const nxs = new Float64Array(n), nys = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const a = rp[(i - 1 + n) % n], b = rp[(i + 1) % n];
          const tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1;
          nxs[i] = ty / tl; nys[i] = -tx / tl;
        }
        let votes = 0;
        for (const i of [0, Math.floor(n / 3), Math.floor((2 * n) / 3)])
          if (inside(rp[i][0] + nxs[i] * 0.4, rp[i][1] + nys[i] * 0.4)) votes++;
        const flip = votes >= 2 ? -1 : 1;
        for (let i = 0; i < n; i++) {
          const nx = nxs[i] * flip, ny = nys[i] * flip;
          let ldx = Lx - rp[i][0], ldy = Ly - rp[i][1];
          const ll = Math.hypot(ldx, ldy) || 1;
          const lit = 0.5 - 0.5 * ((nx * ldx + ny * ldy) / ll); /* 0=valaistu, 1=varjo */
          sx.push(rp[i][0]); sy.push(rp[i][1]); slit.push(lit);
        }
      }

      /* ---- feature transform: lahin reunanayte per solu (chamfer, 2 pyyhkaisya) ---- */
      const fi = new Int32Array(N).fill(-1);
      const fd = new Float64Array(N).fill(1e18);
      for (let s = 0; s < sx.length; s++) {
        const c = Math.max(0, Math.min(cols - 1, Math.round((sx[s] - bx0) / cs)));
        const r = Math.max(0, Math.min(rows - 1, Math.round((sy[s] - by0) / cs)));
        const dx = CX(c) - sx[s], dy = CY(r) - sy[s];
        const d2 = dx * dx + dy * dy;
        if (d2 < fd[r * cols + c]) { fd[r * cols + c] = d2; fi[r * cols + c] = s; }
      }
      const relaxFrom = (i, j) => {
        const s = fi[j];
        if (s < 0) return;
        const r = Math.floor(i / cols), c = i - r * cols;
        const dx = CX(c) - sx[s], dy = CY(r) - sy[s];
        const d2 = dx * dx + dy * dy;
        if (d2 < fd[i]) { fd[i] = d2; fi[i] = s; }
      };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c > 0) relaxFrom(i, i - 1);
        if (r > 0) { relaxFrom(i, i - cols); if (c > 0) relaxFrom(i, i - cols - 1); if (c < cols - 1) relaxFrom(i, i - cols + 1); }
      }
      for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
        const i = r * cols + c;
        if (c < cols - 1) relaxFrom(i, i + 1);
        if (r < rows - 1) { relaxFrom(i, i + cols); if (c < cols - 1) relaxFrom(i, i + cols + 1); if (c > 0) relaxFrom(i, i + cols - 1); }
      }

      /* ---- nurkat alkuperaisista karjista: terävyys + kovera/kupera ---- */
      const corners = [];
      const MINA = (30 * Math.PI) / 180;
      for (const ring of rings) {
        const n = ring.length;
        for (let i = 0; i < n; i++) {
          const P0 = ring[(i - 1 + n) % n], P1 = ring[i], P2 = ring[(i + 1) % n];
          let ax = P1[0] - P0[0], ay = P1[1] - P0[1];
          let bx = P2[0] - P1[0], by = P2[1] - P1[1];
          const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
          if (al < 1e-6 || bl < 1e-6) continue;
          ax /= al; ay /= al; bx /= bl; by /= bl;
          const dot = Math.max(-1, Math.min(1, ax * bx + ay * by));
          const turn = Math.acos(dot);
          if (turn < MINA) continue;
          const sharp = (turn - MINA) / (Math.PI - MINA);
          let ux = bx - ax, uy = by - ay;
          const ul = Math.hypot(ux, uy) || 1;
          const convex = inside(P1[0] + (ux / ul) * 0.4, P1[1] + (uy / ul) * 0.4);
          const w = sharp * (convex ? 1 - 0.8 * p.concave : 1);
          if (w > 0.01) corners.push([P1[0], P1[1], w]);
        }
      }

      /* ---- tummuuskentta D ---- */
      const band = Math.max(0.5, p.band);
      const crad = Math.max(0.5, p.cornerRad);
      let dmin = 1e18, dmax = -1e18;
      for (const [cxk, cyk] of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) {
        const d = Math.hypot(cxk - Lx, cyk - Ly);
        dmin = Math.min(dmin, d); dmax = Math.max(dmax, d);
      }
      const D = new Float64Array(N);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!mask[i]) continue;
        const x = CX(c), y = CY(r);
        let v = p.ambient;
        const s = fi[i];
        if (s >= 0) {
          const db = Math.sqrt(fd[i]);
          const facing = 1 - p.lightAmt + p.lightAmt * slit[s];
          v += p.edgeAmt * facing * Math.exp(-db / band);
        }
        let ck = 0;
        for (const [qx, qy, w] of corners) {
          const dq = Math.hypot(x - qx, y - qy);
          if (dq < crad * 3.5) ck += w * Math.exp(-dq / crad);
        }
        v += p.cornerAmt * Math.min(1.6, ck);
        const dl = Math.hypot(x - Lx, y - Ly);
        v += p.bodyGrad * 0.6 * Math.max(0, Math.min(1, (dl - dmin) / Math.max(1, dmax - dmin)));
        D[i] = Math.pow(Math.max(0, Math.min(1, v)), p.gamma);
      }
      /* laajenna kentta yhdella solulla ulospain, jotta bilineaari ei vuoda nollaan reunalla */
      const Dx = Float64Array.from(D);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (mask[i]) continue;
        let best = 0, hit = false;
        for (let jr = Math.max(0, r - 1); jr <= Math.min(rows - 1, r + 1); jr++)
          for (let jc = Math.max(0, c - 1); jc <= Math.min(cols - 1, c + 1); jc++)
            if (mask[jr * cols + jc]) { best = Math.max(best, D[jr * cols + jc]); hit = true; }
        if (hit) Dx[i] = best;
      }
      const sampleD = (x, y) => {
        const u = (x - bx0) / cs, v = (y - by0) / cs;
        const c0 = Math.max(0, Math.min(cols - 2, Math.floor(u)));
        const r0 = Math.max(0, Math.min(rows - 2, Math.floor(v)));
        const fu = Math.max(0, Math.min(1, u - c0)), fv = Math.max(0, Math.min(1, v - r0));
        const a = Dx[r0 * cols + c0], b = Dx[r0 * cols + c0 + 1];
        const cc = Dx[(r0 + 1) * cols + c0], d = Dx[(r0 + 1) * cols + c0 + 1];
        return a + (b - a) * fu + (cc - a) * fv + (a - b - cc + d) * fu * fv;
      };
      const sampleIn = (x, y) => {
        const c = Math.round((x - bx0) / cs), r = Math.round((y - by0) / cs);
        if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
        return mask[r * cols + c] === 1;
      };

      /* ---- tasoportainen viivoitus ---- */
      const diag = Math.hypot(bx1 - bx0, by1 - by0);
      const mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2;
      const st = Math.min(0.7, pitch * 0.6);
      for (let lev = 0; lev < NL; lev++) {
        const T = (lev + 1) / (NL + 1);
        const A = ((p.angle + lev * p.crossAng) * Math.PI) / 180;
        const dx = Math.cos(A), dy = Math.sin(A);
        const qx = -dy, qy = dx;
        const off = p.crossAng < 0.5 ? (pitch * lev) / NL : 0;
        const nLines = Math.ceil(diag / pitch) + 1;
        for (let li = -nLines; li <= nLines; li++) {
          if (budget <= 0) break;
          const s0 = li * pitch + off;
          const ox = mx + qx * s0, oy = my + qy * s0;
          let run = [];
          const flush = () => {
            if (run.length >= 2 && budget > 0) {
              budget -= run.length;
              out.push({ pts: li % 2 ? run.reverse() : run, closed: false, layer: L });
            }
            run = [];
          };
          for (let t = -diag / 2; t <= diag / 2; t += st) {
            const wob = hand ? (noise2(t * 0.13, s0 * 0.13, seed + lev * 31) - 0.5) * 2 * hand * pitch * 0.7 : 0;
            const x = ox + dx * t + qx * wob, y = oy + dy * t + qy * wob;
            if (x < bx0 || x > bx1 || y < by0 || y > by1) { flush(); continue; }
            if (sampleIn(x, y) && sampleD(x, y) >= T) run.push([x, y]);
            else flush();
          }
          flush();
        }
      }
    }
    return { paths: out };
  },
};
