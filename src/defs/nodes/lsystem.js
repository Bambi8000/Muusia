import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "lsystem",
    name: "L-System", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "preset", label: "Preset", type: "select", options: ["Koch", "Dragon", "Plant", "Sierpinski", "Hilbert", "Lightning", "Custom"], def: "Plant" },
      { key: "axiom", label: "Axiom (custom)", type: "text", def: "F" },
      { key: "rules", label: "Rules (custom)", type: "text", def: "F=F+F--F+F" },
      { key: "iter", label: "Iterations / detail", type: "slider", min: 1, max: 8, step: 1, def: 4 },
      { key: "angle", label: "Angle ° (custom/branch)", type: "slider", min: 1, max: 120, step: 0.5, def: 60 },
      { key: "jitter", label: "Jitter / roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "branches", label: "Branches (lightning)", type: "slider", min: 0, max: 15, step: 1, def: 6 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 37 },
      { key: "layer", label: "Pen", type: "pen", def: 3 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1889 + 7);

      /* ---- Lightning: keskipiste-siirto + haarautuva salama ---- */
      if (p.preset === "Lightning") {
        const rough = Math.max(0.05, p.jitter || 0.35);
        const bolt = (x0, y0, x1, y1, detail) => {
          let pts = [[x0, y0], [x1, y1]];
          for (let d = 0; d < detail; d++) {
            const next = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
              const dx = b[0] - a[0], dy = b[1] - a[1];
              const len = Math.hypot(dx, dy) || 1;
              const off = (rng() - 0.5) * 2 * len * rough * 0.55;
              next.push([mx + (-dy / len) * off, my + (dx / len) * off]);
              next.push(b);
            }
            pts = next;
          }
          return pts;
        };
        const detail = Math.min(8, Math.max(3, Math.round(p.iter) + 2));
        const topX = W * (0.35 + rng() * 0.3);
        const botX = W * (0.25 + rng() * 0.5);
        const main = bolt(topX, p.margin, botX, H - p.margin, detail);
        const paths = [{ pts: main, closed: false, layer: Math.round(p.layer) }];
        const nBr = Math.round(p.branches);
        for (let b = 0; b < nBr; b++) {
          /* haara ylemmästä 2/3:sta, suunta paakolarin mukaan +- kulma */
          const i = 2 + Math.floor(rng() * (main.length * 0.66));
          if (i >= main.length - 1) continue;
          const S = main[i];
          const dx = main[i + 1][0] - main[i - 1][0], dy = main[i + 1][1] - main[i - 1][1];
          const base = Math.atan2(dy, dx);
          const sign = rng() > 0.5 ? 1 : -1;
          const a = base + sign * ((p.angle + (rng() - 0.5) * 20) * Math.PI) / 180;
          const len = (H - p.margin - S[1]) * (0.2 + rng() * 0.35);
          if (len < 5) continue;
          const E = [S[0] + Math.cos(a) * len, S[1] + Math.sin(a) * Math.abs(len)];
          const br = bolt(S[0], S[1], E[0], E[1], Math.max(2, detail - 2));
          paths.push({ pts: br, closed: false, layer: Math.round(p.layer) });
          /* pieni ala-haara puolella todennakoisyydella */
          if (rng() > 0.5 && br.length > 4) {
            const j = 1 + Math.floor(rng() * (br.length - 2));
            const S2 = br[j];
            const a2 = a + (rng() > 0.5 ? 1 : -1) * ((p.angle * 0.7) * Math.PI) / 180;
            const len2 = len * (0.25 + rng() * 0.3);
            if (len2 > 4) {
              const E2 = [S2[0] + Math.cos(a2) * len2, S2[1] + Math.sin(a2) * Math.abs(len2)];
              paths.push({ pts: bolt(S2[0], S2[1], E2[0], E2[1], Math.max(2, detail - 3)), closed: false, layer: Math.round(p.layer) });
            }
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---- tavalliset L-systeemit (jitter = stokastinen turtle) ---- */
      const PRESETS = {
        Koch: { axiom: "F", rules: "F=F+F--F+F", angle: 60 },
        Dragon: { axiom: "FX", rules: "X=X+YF+;Y=-FX-Y", angle: 90 },
        Plant: { axiom: "X", rules: "X=F+[[X]-X]-F[-FX]+X;F=FF", angle: 25 },
        Sierpinski: { axiom: "F-G-G", rules: "F=F-G+F+G-F;G=GG", angle: 120 },
        Hilbert: { axiom: "A", rules: "A=-BF+AFA+FB-;B=+AF-BFB-FA+", angle: 90 },
      };
      const cfg = p.preset === "Custom"
        ? { axiom: p.axiom || "F", rules: p.rules || "", angle: p.angle }
        : PRESETS[p.preset];
      const ruleMap = {};
      for (const r of String(cfg.rules).split(";")) {
        const [k, v] = r.split("=");
        if (k && v !== undefined) ruleMap[k.trim()] = v.trim();
      }
      let s = cfg.axiom;
      for (let i = 0; i < Math.round(p.iter); i++) {
        let next = "";
        for (const ch of s) next += ruleMap[ch] !== undefined ? ruleMap[ch] : ch;
        if (next.length > 200000) break;
        s = next;
      }
      const rad0 = (cfg.angle * Math.PI) / 180;
      let x = 0, y = 0, a = -Math.PI / 2;
      const stack = [];
      const rawPaths = [];
      let cur = [[0, 0]];
      for (const ch of s) {
        if (ch === "F" || ch === "G") {
          const step = 1 + (p.jitter ? (rng() - 0.5) * p.jitter * 0.7 : 0);
          x += Math.cos(a) * step; y += Math.sin(a) * step;
          cur.push([x, y]);
        } else if (ch === "f") {
          if (cur.length > 1) rawPaths.push(cur);
          x += Math.cos(a); y += Math.sin(a);
          cur = [[x, y]];
        } else if (ch === "+" || ch === "-") {
          const jit = p.jitter ? 1 + (rng() - 0.5) * 2 * p.jitter : 1;
          a += (ch === "+" ? 1 : -1) * rad0 * jit;
        } else if (ch === "[") stack.push([x, y, a]);
        else if (ch === "]") {
          if (cur.length > 1) rawPaths.push(cur);
          const st = stack.pop();
          if (st) { x = st[0]; y = st[1]; a = st[2]; }
          cur = [[x, y]];
        }
      }
      if (cur.length > 1) rawPaths.push(cur);
      if (!rawPaths.length) return EMPTY;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pa of rawPaths) for (const [px, py] of pa) {
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const paths = rawPaths.map((pa) => ({
        pts: pa.map(([px, py]) => [px * sc + ox, py * sc + oy]),
        closed: false, layer: Math.round(p.layer),
      }));
      return applyStyle({ paths }, ins[0]);
    },
  
};
