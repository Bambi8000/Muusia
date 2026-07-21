import { Pin, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "hersheytext",
    name: "Text", cat: "gen", group: "textimg", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text (| = new line)", type: "text", def: "MUUSIA" },
      { key: "size", label: "Size mm (cap height)", type: "slider", min: 2, max: 80, step: 0.5, def: 20 },
      { key: "track", label: "Tracking %", type: "slider", min: 50, max: 250, step: 1, def: 100 },
      { key: "lineh", label: "Line height %", type: "slider", min: 90, max: 300, step: 1, def: 150 },
      { key: "align", label: "Align", type: "select", options: ["Left", "Center", "Right"], def: "Center" },
      { key: "centerC", label: "Center on canvas", type: "check", def: true },
      { key: "px", label: "Pos X mm", type: "slider", min: 0, max: 400, step: 1, def: 20 },
      { key: "py", label: "Pos Y mm", type: "slider", min: 0, max: 400, step: 1, def: 40 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* Oma yksiviivafontti: ruudukko x 0..~9, y 0 = versaalin ylareuna, 10 = peruslinja */
      const F = SFONT;
      const sc = p.size / 10;
      const tr = p.track / 100;
      const lines = String(p.text || "").toUpperCase().split("|");
      const lineWidth = (line) => {
        let w = 0;
        for (const ch of line) w += ((F[ch] || F[" "]).w + 2) * sc * tr;
        return w;
      };
      const totalH = p.size + (lines.length - 1) * p.size * (p.lineh / 100);
      const maxW = Math.max(...lines.map(lineWidth), 1);
      let ox, oy;
      if (p.centerC) {
        ox = (ctx.W - maxW) / 2;
        oy = (ctx.H - totalH) / 2;
      } else { ox = p.px; oy = p.py; }
      const paths = [];
      lines.forEach((line, li) => {
        const lw = lineWidth(line);
        let x = ox + (p.align === "Center" ? (maxW - lw) / 2 : p.align === "Right" ? maxW - lw : 0);
        const y = oy + li * p.size * (p.lineh / 100);
        for (const ch of line) {
          const g = F[ch] || F[" "];
          for (const stroke of g.s) {
            if (stroke.length < 2) continue;
            paths.push({
              pts: stroke.map(([gx, gy]) => [x + gx * sc, y + gy * sc]),
              closed: false, layer: Math.round(p.layer),
            });
          }
          x += (g.w + 2) * sc * tr;
        }
      });
      return applyStyle({ paths }, ins[0]);
    },
  
};
