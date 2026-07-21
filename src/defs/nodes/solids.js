import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "solids",
    name: "Solids", cat: "gen", group: "space", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Shape", type: "select", options: ["Sphere", "Cube", "Tetrahedron", "Octahedron", "Icosahedron", "Dodecahedron"], def: "Sphere" },
      { key: "size", label: "Size mm", type: "slider", min: 10, max: 250, step: 1, def: 120 },
      { key: "rx", label: "Rotate X °", type: "slider", min: -180, max: 180, step: 1, def: -20 },
      { key: "ry", label: "Rotate Y °", type: "slider", min: -180, max: 180, step: 1, def: 30 },
      { key: "rz", label: "Rotate Z °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "lat", label: "Latitudes (sphere)", type: "slider", min: 3, max: 24, step: 1, def: 9 },
      { key: "lon", label: "Longitudes (sphere)", type: "slider", min: 4, max: 24, step: 1, def: 12 },
      { key: "sstyle", label: "Sphere style", type: "select", options: ["Solid (hide back)", "Transparent"], def: "Solid (hide back)" },
      { key: "px", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const r = p.size / 2;
      const cx = p.px, cy = p.py;
      /* rotaatio ZYX */
      const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180, az = (p.rz * Math.PI) / 180;
      const cX = Math.cos(ax), sX = Math.sin(ax);
      const cY = Math.cos(ay), sY = Math.sin(ay);
      const cZ = Math.cos(az), sZ = Math.sin(az);
      const rot = ([x, y, z]) => {
        let y1 = y * cX - z * sX, z1 = y * sX + z * cX;                 /* X */
        let x2 = x * cY + z1 * sY, z2 = -x * sY + z1 * cY;             /* Y */
        return [x2 * cZ - y1 * sZ, x2 * sZ + y1 * cZ, z2];             /* Z */
      };
      const camD = r * (6 - 4.8 * p.persp);
      const proj = ([x, y, z]) => {
        const f = p.persp > 0 ? camD / Math.max(camD * 0.2, camD + z) : 1;
        return [cx + x * f, cy + y * f];
      };
      const L = Math.round(p.layer);
      const paths = [];
      const PHI = (1 + Math.sqrt(5)) / 2;
      if (p.shape === "Sphere") {
        const emit = (ring3d) => {
          /* jaa nakyviin kaariin (takapinta piiloon) */
          let run = [];
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (const v of ring3d) {
            const R = rot(v);
            const visible = p.sstyle === "Transparent" || R[2] <= r * 0.02;
            if (visible) run.push(proj(R));
            else flush();
          }
          if (run.length === ring3d.length) paths.push({ pts: run, closed: true, layer: L });
          else flush();
        };
        const N = 72;
        for (let la = 1; la < Math.round(p.lat); la++) {
          const phi = (la / Math.round(p.lat)) * Math.PI;
          const rr = Math.sin(phi) * r, zz = Math.cos(phi) * r;
          const ring = [];
          for (let i = 0; i < N; i++) {
            const th = (i / N) * Math.PI * 2;
            ring.push([Math.cos(th) * rr, zz, Math.sin(th) * rr]);
          }
          emit(ring);
        }
        for (let lo = 0; lo < Math.round(p.lon); lo++) {
          const th = (lo / Math.round(p.lon)) * Math.PI;
          const ring = [];
          for (let i = 0; i < N; i++) {
            const phi = (i / N) * Math.PI * 2;
            ring.push([Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(th) * r]);
          }
          emit(ring);
        }
      } else {
        let V;
        if (p.shape === "Cube") {
          V = [];
          for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
        } else if (p.shape === "Tetrahedron") {
          V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
        } else if (p.shape === "Octahedron") {
          V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        } else if (p.shape === "Icosahedron") {
          V = [];
          for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
            V.push([0, s1, s2 * PHI]);
            V.push([s1, s2 * PHI, 0]);
            V.push([s2 * PHI, 0, s1]);
          }
        } else {
          V = [];
          for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
          for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
            V.push([0, s1 / PHI, s2 * PHI]);
            V.push([s1 / PHI, s2 * PHI, 0]);
            V.push([s2 * PHI, 0, s1 / PHI]);
          }
        }
        /* normalisoi sateeseen r */
        const maxL = Math.max(...V.map((v) => Math.hypot(v[0], v[1], v[2])));
        V = V.map((v) => [v[0] / maxL * r, v[1] / maxL * r, v[2] / maxL * r]);
        /* sarmat = lyhimman etaisyyden parit */
        let minD = Infinity;
        for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
          const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
          if (d < minD - 0.001) minD = d;
        }
        for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
          const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
          if (d < minD * 1.08) {
            paths.push({ pts: [proj(rot(V[i])), proj(rot(V[j]))], closed: false, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
