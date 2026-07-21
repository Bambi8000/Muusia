import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "regmarks",
      name: "Reg Marks",
    cat: "gen", group: "structural",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "style", label: "Style", type: "select", options: ["Cross +", "Registration (circle + cross)", "Corner L"], def: "Cross +" },
      { key: "size", label: "Size mm", type: "slider", min: 2, max: 30, step: 0.5, def: 8 },
      { key: "insetX", label: "Inset X mm", type: "slider", min: 0, max: 100, step: 0.5, def: 10 },
      { key: "insetY", label: "Inset Y mm", type: "slider", min: 0, max: 100, step: 0.5, def: 10 },
      { key: "tl", label: "Top left", type: "check", def: true },
      { key: "tr", label: "Top right", type: "check", def: true },
      { key: "bl", label: "Bottom left", type: "check", def: true },
      { key: "br", label: "Bottom right", type: "check", def: true },
      { key: "center", label: "Center mark", type: "check", def: false },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const r = p.size / 2;
      const paths = [];
      const cross = (x, y) => {
        paths.push({ pts: [[x - r, y], [x + r, y]], closed: false, layer: L });
        paths.push({ pts: [[x, y - r], [x, y + r]], closed: false, layer: L });
      };
      const circle = (x, y, cr) => {
        const pts = [];
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * Math.PI * 2;
          pts.push([x + Math.cos(a) * cr, y + Math.sin(a) * cr]);
        }
        paths.push({ pts, closed: true, layer: L });
      };
      /* L-merkki: kulman suuntainen — sx/sy kertovat mihin suuntaan viivat osoittavat */
      const cornerL = (x, y, sx, sy) => {
        paths.push({ pts: [[x, y], [x + sx * p.size, y]], closed: false, layer: L });
        paths.push({ pts: [[x, y], [x, y + sy * p.size]], closed: false, layer: L });
      };
      const mark = (x, y, sx, sy) => {
        if (p.style === "Cross +") cross(x, y);
        else if (p.style === "Registration (circle + cross)") {
          cross(x, y);
          circle(x, y, r * 0.62);
        } else cornerL(x, y, sx, sy);
      };
      if (p.tl) mark(p.insetX, p.insetY, 1, 1);
      if (p.tr) mark(W - p.insetX, p.insetY, -1, 1);
      if (p.bl) mark(p.insetX, H - p.insetY, 1, -1);
      if (p.br) mark(W - p.insetX, H - p.insetY, -1, -1);
      if (p.center) mark(W / 2, H / 2, 1, 1);
      return applyStyle({ paths }, ins[0]);
    }
  
};
