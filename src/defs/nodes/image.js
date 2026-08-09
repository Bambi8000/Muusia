import { Pin, EMPTY, mulberry32, noise2, applyStyle, pathLength } from "../helpers.js";

export default {
  key: "image",
    name: "Image", cat: "gen", group: "textimg", fileImage: true,
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "mode", label: "Render", type: "select", options: ["Scanline wave", "Halftone dots", "Hatch levels", "Flow shade", "Contours (trace)"], def: "Scanline wave" },
      { key: "cell", label: "Cell / spacing mm", type: "slider", min: 0.8, max: 12, step: 0.1, def: 2.4 },
      { key: "strength", label: "Strength", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.8 },
      { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
      { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.06 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "levels", label: "Contour levels", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "low", label: "Lowest threshold", type: "slider", min: 0.05, max: 0.9, step: 0.05, def: 0.25 },
      { key: "high", label: "Highest threshold", type: "slider", min: 0.1, max: 0.95, step: 0.05, def: 0.75 },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 139 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx, node) {
      const img = node && node.data && node.data.img;
      if (!img) return EMPTY;
      if (p.mode === "Contours (trace)") {
        /* verbatim traceimg body — merged 2.51; traceimg is a hidden alias */
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const boxW = W - 2 * m, boxH = H - 2 * m;
      if (boxW < 10 || boxH < 10) return applyStyle({ paths: [] }, ins[0]);
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ox = (W - iw) / 2, oy = (H - ih) / 2;
      const darkAt = (x, y) => {
        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;
        const iu = Math.floor(u), iv = Math.floor(v);
        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];
        const fu = u - iu, fv = v - iv;
        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +
                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;
        return p.invert ? 1 - d : d;
      };
      const cell = Math.max(0.5, p.cell);
      const cols = Math.max(2, Math.round(iw / cell) + 1);
      const rows = Math.max(2, Math.round(ih / cell) + 1);
      const gx = (c) => ox + (c / (cols - 1)) * iw;
      const gy = (r) => oy + (r / (rows - 1)) * ih;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = darkAt(gx(c), gy(r));
      const NL = Math.max(1, Math.min(8, Math.round(p.levels)));
      const lo = Math.min(p.low, p.high), hi = Math.max(p.low, p.high);
      const segs = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let li = 0; li < NL; li++) {
        const lvl = NL === 1 ? (lo + hi) / 2 : lo + (li / (NL - 1)) * (hi - lo);
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segs.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
      }
      const { W, H } = ctx;
      const m = p.margin;
      /* sovita kuva marginaalilaatikkoon mittasuhteet sailyttaen */
      const boxW = W - 2 * m, boxH = H - 2 * m;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const x0 = (W - iw) / 2, y0 = (H - ih) / 2;
      const darkAt = (x, y) => {
        /* bilineaarinen naytteistys; kuvan ulkopuolella valkoista */
        const u = (x - x0) / sc, v = (y - y0) / sc;
        if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
        const ui = Math.floor(u), vi = Math.floor(v);
        const fu = u - ui, fv = v - vi;
        const g = img.g;
        const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
        const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
        let d = a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
        if (p.invert) d = 1 - d;
        return Math.pow(Math.max(0, d), p.gamma);
      };
      const L = Math.round(p.layer);
      const paths = [];
      if (p.mode === "Scanline wave") {
        /* klassikko: vaakarivit, tummuus kasvattaa amplitudia JA taajuutta */
        for (let y = y0; y <= y0 + ih; y += p.cell) {
          let run = [], phase = 0;
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (let x = x0; x <= x0 + iw; x += 0.35) {
            const d = darkAt(x, y);
            if (d < p.cutoff) { flush(); continue; }
            phase += 0.5 + d * 2.6;
            run.push([x, y + Math.sin(phase) * d * p.cell * 0.48 * p.strength]);
          }
          flush();
        }
      } else if (p.mode === "Halftone dots") {
        for (let y = y0 + p.cell / 2; y < y0 + ih; y += p.cell) {
          for (let x = x0 + p.cell / 2; x < x0 + iw; x += p.cell) {
            const d = darkAt(x, y);
            if (d < p.cutoff) continue;
            const r = d * p.cell * 0.46 * p.strength;
            if (r < 0.16) continue;
            const pts = [];
            const n = r < 0.8 ? 6 : 10;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
            }
            paths.push({ pts, closed: true, layer: L });
          }
        }
      } else if (p.mode === "Hatch levels") {
        /* 4 viivoitustasoa: tummempi alue saa useamman suunnan */
        const angles = [45, -45, 0, 90];
        const levels = [0.2, 0.42, 0.62, 0.82];
        const diag = Math.hypot(iw, ih);
        const cxm = x0 + iw / 2, cym = y0 + ih / 2;
        for (let k = 0; k < 4; k++) {
          const a = (angles[k] * Math.PI) / 180;
          const dx = Math.cos(a), dy = Math.sin(a);
          const px = -dy, py = dx;
          for (let o = -diag / 2; o <= diag / 2; o += p.cell) {
            let run = [];
            const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
            for (let t = -diag / 2; t <= diag / 2; t += 0.5) {
              const x = cxm + dx * t + px * o, y = cym + dy * t + py * o;
              if (darkAt(x, y) * p.strength >= levels[k]) run.push([x, y]);
              else flush();
            }
            flush();
          }
        }
      } else {
        /* Flow shade: virtausviivat joiden tiheys ja pituus seuraavat tummuutta */
        const rng = mulberry32(p.seed * 5479 + 101);
        const attempts = Math.round((iw * ih) / (p.cell * p.cell) * 1.6);
        let budget = 60000;
        for (let i = 0; i < attempts && budget > 0; i++) {
          const sx = x0 + rng() * iw, sy = y0 + rng() * ih;
          const d0 = darkAt(sx, sy);
          if (d0 < p.cutoff || rng() > d0) continue;
          const len = 2 + d0 * 14 * p.strength;
          let x = sx, y = sy;
          const pts = [[x, y]];
          const steps = Math.round(len / 0.8);
          for (let s = 0; s < steps; s++) {
            const a = noise2(x * 0.02, y * 0.02, p.seed + 9) * Math.PI * 4;
            x += Math.cos(a) * 0.8;
            y += Math.sin(a) * 0.8;
            pts.push([x, y]);
          }
          budget -= pts.length;
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
