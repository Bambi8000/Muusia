import { Pin, mulberry32, applyStyle } from "../helpers.js";

import { boundedVoronoi, voronoiRegion, VORONOI_LICENSES } from "../voronoi-bounded.js";

export default {
  key: "voronoi",
    license: VORONOI_LICENSES,
    name: "Voronoi",
    cat: "gen",
    group: "geometric",
    desc: "Classic keeps the original Voronoi. Bounded fills the canvas, a circle or closed Boundary paths, including even-odd holes. Choose Random, Even or Hex placement; Relax smooths the layout. Linear/Radial density makes smaller cells toward the dense end or centre. Holes inset cells by half the Web width and round the corners; tiny holes stay solid. Edges draws each shared edge once. Include outline adds the region contour. Cells outputs separated closed regions and Seeds a small closed loop in EACH piece: wire these to Differential Growth Boundary and Start, use Mode Bounded and keep the result under its 64-strand limit. Several cells mean several pen lifts. Style affects Drawing only. Shapes wrapping around a boundary hole receive material bridges. Dimensions describe vector geometry, without kerf compensation. Degenerate or excessive geometry returns empty.",
    ins: [Pin("style", "Style"), Pin("paths", "Boundary")],
    outs: node => node?.params?.mode === "Bounded" ? [Pin("paths", "Drawing"), Pin("paths", "Cells"), Pin("paths", "Seeds")] : [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Classic", "Bounded"], def: "Classic" },
      { key: "boundary", label: "Boundary", type: "select", options: ["Auto", "Canvas", "Circle", "Wired"], def: "Auto", showIf: p => p.mode === "Bounded" },
      { key: "output", label: "Drawing", type: "select", options: ["Holes", "Edges"], def: "Holes", showIf: p => p.mode === "Bounded" },
      { key: "count", label: "Cell count", type: "slider", min: 3, max: 2000, step: 1, def: 80, showIf: p => p.mode === "Bounded" },
      { key: "placement", label: "Placement", type: "select", options: ["Random", "Even", "Hex"], def: "Even", showIf: p => p.mode === "Bounded" },
      { key: "iterations", label: "Relax passes", type: "slider", min: 0, max: 8, step: 1, def: 2, showIf: p => p.mode === "Bounded" },
      { key: "density", label: "Density", type: "select", options: ["Uniform", "Linear", "Radial"], def: "Uniform", showIf: p => p.mode === "Bounded" },
      { key: "densityStrength", label: "Density strength %", type: "slider", min: 0, max: 95, step: 1, def: 75, showIf: p => p.mode === "Bounded" && p.density !== "Uniform" },
      { key: "densityAngle", label: "Density angle °", type: "slider", min: -180, max: 180, step: 1, def: 0, showIf: p => p.mode === "Bounded" && p.density === "Linear" },
      { key: "web", label: "Web width mm", type: "slider", min: .2, max: 20, step: .1, def: 2, showIf: p => p.mode === "Bounded" },
      { key: "radius", label: "Corner radius mm", type: "slider", min: 0, max: 20, step: .1, def: 2, showIf: p => p.mode === "Bounded" },
      { key: "minHole", label: "Min hole size mm", type: "slider", min: .1, max: 20, step: .1, def: 1, showIf: p => p.mode === "Bounded" },
      { key: "outline", label: "Include outline", type: "check", def: false, showIf: p => p.mode === "Bounded" },
      { key: "cells", label: "Cells", type: "slider", min: 3, max: 300, step: 1, def: 40, showIf: p => p.mode !== "Bounded" },
      { key: "relax", label: "Relax (Lloyd)", type: "slider", min: 0, max: 3, step: 1, def: 1, showIf: p => p.mode !== "Bounded" },
      { key: "sites", label: "Draw sites", type: "check", def: false, showIf: p => p.mode !== "Bounded" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 13 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    overlay(p,ctx,ins) {
      if(p.mode !== "Bounded") return [];
      return (voronoiRegion(p,ctx,ins?.[1]) || []).map(pts=>({kind:"poly",pts:[...pts,pts[0]]}));
    },
    compute(ins, p, ctx) {
      if(p.mode === "Bounded") { const out=boundedVoronoi(ins,p,ctx);out[0]=applyStyle(out[0],ins[0]);return out; }
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const N = Math.max(2, Math.min(400, Math.round(p.cells)));
      const rng = mulberry32(p.seed * 6151 + 17);
      let sites = [];
      for (let i = 0; i < N; i++) {
        sites.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
      }
      /* cell of site i = margin rect clipped by bisector half-planes vs all others */
      const cellOf = (i) => {
        let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        const [sx, sy] = sites[i];
        for (let j = 0; j < sites.length && poly.length >= 3; j++) {
          if (j === i) continue;
          const [ox, oy] = sites[j];
          /* keep side of the bisector closer to site i */
          const nx = ox - sx, ny = oy - sy;
          const d = (nx * (sx + ox) + ny * (sy + oy)) / 2;
          const out = [];
          for (let k = 0; k < poly.length; k++) {
            const A = poly[k], B = poly[(k + 1) % poly.length];
            const da = nx * A[0] + ny * A[1] - d;
            const db = nx * B[0] + ny * B[1] - d;
            if (da <= 0) out.push(A);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
              const t = da / (da - db);
              out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
            }
          }
          poly = out;
        }
        return poly;
      };
      const relaxN = Math.max(0, Math.min(3, Math.round(p.relax)));
      for (let r = 0; r < relaxN; r++) {
        sites = sites.map((_, i) => {
          const poly = cellOf(i);
          if (poly.length < 3) return sites[i];
          let cx = 0, cy = 0;
          for (const [x, y] of poly) { cx += x; cy += y; }
          return [cx / poly.length, cy / poly.length];
        });
      }
      /* emit shared edges once (each edge belongs to two cells) */
      const L = Math.round(p.layer);
      const paths = [];
      const seen = new Set();
      const q = (v) => Math.round(v * 20) / 20;
      for (let i = 0; i < sites.length; i++) {
        const poly = cellOf(i);
        for (let k = 0; k < poly.length; k++) {
          const A = poly[k], B = poly[(k + 1) % poly.length];
          if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 0.05) continue;
          const ka = q(A[0]) + "," + q(A[1]), kb = q(B[0]) + "," + q(B[1]);
          const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
          if (seen.has(key)) continue;
          seen.add(key);
          paths.push({ pts: [[A[0], A[1]], [B[0], B[1]]], closed: false, layer: L });
        }
        if (p.sites) {
          const [sx, sy] = sites[i];
          paths.push({ pts: [[sx - 1, sy], [sx + 1, sy]], closed: false, layer: L });
          paths.push({ pts: [[sx, sy - 1], [sx, sy + 1]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
