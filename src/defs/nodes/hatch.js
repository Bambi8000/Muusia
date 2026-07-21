import { Pin, EMPTY, resample, signedArea } from "../helpers.js";

export default {
  key: "hatch",
    name: "Hatch Fill", cat: "mod", group: "fillstyle", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "region", label: "Region", type: "select", options: ["Inside shapes", "Outside (invert)"], def: "Inside shapes" },
      { key: "invMargin", label: "Invert margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8 },
      { key: "angle", label: "Angle °", type: "slider", min: 0, max: 180, step: 1, def: 45 },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.3, max: 15, step: 0.1, def: 2 },
      { key: "inset", label: "Inset from edge mm", type: "slider", min: 0, max: 10, step: 0.1, def: 0 },
      { key: "cross", label: "Cross hatch", type: "check", def: false },
      { key: "outlines", label: "Keep outlines", type: "check", def: true },
      { key: "keepCol", label: "Keep shape colors", type: "check", def: true },
      { key: "layer", label: "Hatch pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      let closedPaths = src.paths.filter((pa) => pa.closed && pa.pts.length > 2);
      /* invert: lisaa canvas-kehys uloimmaksi renkaaksi -> even-odd viivoittaa muotojen ULKOpuolen */
      if (p.region === "Outside (invert)") {
        const m = p.invMargin;
        closedPaths = [
          {
            pts: [[m, m], [ctx.W - m, m], [ctx.W - m, ctx.H - m], [m, ctx.H - m]],
            closed: true, layer: Math.round(p.layer),
          },
          ...closedPaths,
        ];
      }
      /* inset: siirrä reunaa täyttöalueen sisään — myös reikien reunat (parity) */
      if (p.inset > 0) {
        const ringContains = (ring, x, y) => {
          let ins = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
          }
          return ins;
        };
        closedPaths = closedPaths.map((pa, pi) => {
          const pts = resample(pa.pts, true, 1);
          const N = pts.length;
          /* montako MUUTA rengasta sisältää tämän? pariton = reiän reuna -> offset ulospäin */
          let cnt = 0;
          for (let k = 0; k < closedPaths.length; k++) {
            if (k === pi) continue;
            if (ringContains(closedPaths[k].pts, pts[0][0], pts[0][1])) cnt++;
          }
          const hole = cnt % 2 === 1;
          const inward = (signedArea(pts) > 0 ? 1 : -1) * (hole ? -1 : 1);
          return {
            ...pa,
            pts: pts.map((pt, i) => {
              const nI = (i + 1) % N, pI = (i - 1 + N) % N;
              const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
              const tl = Math.hypot(tx, ty) || 1;
              return [pt[0] + (-ty / tl) * p.inset * inward, pt[1] + (tx / tl) * p.inset * inward];
            }),
          };
        });
      }
      for (const path of src.paths) if (p.outlines || !path.closed) paths.push(path);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const angles = p.cross ? [p.angle, p.angle + 90] : [p.angle];
      for (const angDeg of angles) {
        const a = (angDeg * Math.PI) / 180;
        const ca = Math.cos(-a), sa = Math.sin(-a);
        const caB = Math.cos(a), saB = Math.sin(a);
        /* kierrä muodot viivoituskulman avaruuteen */
        const rot = closedPaths.map((pa) => ({
          layer: pa.layer,
          pts: pa.pts.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
          }),
        }));
        let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
        for (const pa of rot) for (const [x, y] of pa.pts) {
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
        }
        if (minY === Infinity) continue;
        let row = 0;
        for (let y = minY + p.spacing / 2; y < maxY; y += p.spacing, row++) {
          /* leikkauspisteet per muoto, even-odd */
          const xs = [];
          const xLayer = [];
          for (const pa of rot) {
            const pts = pa.pts;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const [xi, yi] = pts[i], [xj, yj] = pts[j];
              if ((yi > y) !== (yj > y)) {
                xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
                xLayer.push(pa.layer);
              }
            }
          }
          const order = xs.map((x, i) => i).sort((i, j) => xs[i] - xs[j]);
          for (let k = 0; k + 1 < order.length; k += 2) {
            let xA = xs[order[k]], xB = xs[order[k + 1]];
            if (xB - xA < 0.2) continue;
            if (row % 2 === 1) { const t = xA; xA = xB; xB = t; } // boustrophedon: suunta vuorotellen
            const back = ([x, yy]) => {
              const dx = x - cx, dy = yy - cy;
              return [cx + dx * caB - dy * saB, cy + dx * saB + dy * caB];
            };
            paths.push({
              pts: [back([xA, y]), back([xB, y])],
              closed: false,
              layer: p.keepCol ? xLayer[order[k]] : Math.round(p.layer),
            });
          }
        }
      }
      return { paths };
    },
  
};
