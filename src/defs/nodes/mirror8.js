import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "mirror8",
      name: "Mirror",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Left-right (2)", "Up-down (2)", "Quad (4)", "8-way (8)"], def: "Left-right (2)" },
      { key: "cx", label: "Mirror X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Mirror Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    overlay(p, ctx) {
      const LEN = (ctx.W + ctx.H);
      const axis = (aDeg) => {
        const a = (aDeg * Math.PI) / 180;
        const dx = Math.cos(a) * LEN, dy = Math.sin(a) * LEN;
        return { kind: "poly", pts: [[p.cx - dx, p.cy - dy], [p.cx + dx, p.cy + dy]] };
      };
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.mode === "Left-right (2)") g.push(axis(90));
      else if (p.mode === "Up-down (2)") g.push(axis(0));
      else if (p.mode === "Quad (4)") g.push(axis(0), axis(90));
      else g.push(axis(0), axis(45), axis(90), axis(135));
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* muunnokset keskipisteen ymparilla:
         heijastus suoran (kulma a) yli: M = [[cos2a, sin2a],[sin2a,-cos2a]] */
      const refl = (aDeg) => {
        const a2 = (2 * aDeg * Math.PI) / 180;
        const c = Math.cos(a2), s = Math.sin(a2);
        return ([x, y]) => [c * x + s * y, s * x - c * y];
      };
      const rot = (aDeg) => {
        const a = (aDeg * Math.PI) / 180;
        const c = Math.cos(a), s = Math.sin(a);
        return ([x, y]) => [c * x - s * y, s * x + c * y];
      };
      const I = ([x, y]) => [x, y];
      let T;
      if (p.mode === "Left-right (2)") T = [I, refl(90)];
      else if (p.mode === "Up-down (2)") T = [I, refl(0)];
      else if (p.mode === "Quad (4)") T = [I, refl(0), refl(90), rot(180)];
      else T = [I, rot(90), rot(180), rot(270), refl(0), refl(45), refl(90), refl(135)];
      const paths = [];
      for (const f of T) {
        for (const path of src.paths) {
          paths.push({
            ...path,
            pts: path.pts.map(([x, y]) => {
              const [nx, ny] = f([x - p.cx, y - p.cy]);
              return [nx + p.cx, ny + p.cy];
            }),
          });
        }
      }
      return { paths };
    }
  
};
