import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "travelstop",
    name: "Travel Stop", cat: "mod", group: "penout",
    ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "every", label: "Distance mm", type: "slider", min: 100, max: 8000, step: 50, def: 2000 },
      { key: "mode", label: "Action", type: "select", options: ["Pause (M0)", "Pen change"], def: "Pause (M0)" },
      { key: "msg", label: "Message", type: "text", def: "Advance chalk / refill" },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* jaetaan polut peräkkäin ja lisataan stop-merkki kun kertyma ylittaa rajan.
         merkki kulkee polun kentassa __stop; G-code-generaattori lukee sen ja
         lisaa noston + M0/pen-change ennen ko. polkua. matka lasketaan piirretysta. */
      let acc = 0;
      const out = [];
      const plen = (pts, closed) => {
        let d = 0;
        for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (closed && pts.length > 1) d += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
        return d;
      };
      for (const path of src.paths) {
        const L = plen(path.pts, path.closed);
        if (acc + L > p.every && acc > 0) {
          out.push({ ...path, __stop: { mode: p.mode, msg: p.msg } });
          acc = L;
        } else {
          out.push({ ...path });
          acc += L;
        }
      }
      return { paths: out };
    },
  
};
