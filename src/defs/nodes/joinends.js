import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "joinends",
    name: "Join Ends", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "gap", label: "Max gap mm", type: "slider", min: 0.1, max: 40, step: 0.1, def: 5 },
      { key: "arc", label: "Arc", type: "slider", min: 0, max: 1.5, step: 0.05, def: 0.5 },
      { key: "angTol", label: "Angle tolerance °", type: "slider", min: 5, max: 180, step: 1, def: 60 },
      { key: "samePen", label: "Same pen only", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const out = src.paths.filter((pa) => pa.closed || pa.pts.length < 2);
      let items = src.paths.filter((pa) => !pa.closed && pa.pts.length >= 2)
        .map((pa) => ({ pts: pa.pts.map((q) => q.slice()), layer: pa.layer }));
      const tol = (p.angTol * Math.PI) / 180;
      const outDir = (pts, end) => {
        const a = end === 1 ? pts[pts.length - 1] : pts[0];
        const b = end === 1 ? pts[pts.length - 2] : pts[1];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        return [(a[0] - b[0]) / d, (a[1] - b[1]) / d];
      };
      const endPt = (pts, end) => (end === 1 ? pts[pts.length - 1] : pts[0]);
      const angBetween = (ax, ay, bx, by) => Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by)));
      const bezier = (A, dA, B, dB, d) => {
        const h = d * p.arc;
        const c1 = [A[0] + dA[0] * h, A[1] + dA[1] * h];
        const c2 = [B[0] + dB[0] * h, B[1] + dB[1] * h];
        const n = Math.max(4, Math.min(24, Math.ceil(d / 1.2)));
        const pts = [];
        for (let i = 1; i < n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([
            u * u * u * A[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * B[0],
            u * u * u * A[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * B[1],
          ]);
        }
        return pts;
      };
      /* kierroksittain: pisteytä kaikki kelvolliset päät (etäisyys + kulmasakko),
         yhdistä paras joukko ristiriidattomasti, toista */
      for (let round = 0; round < 60 && items.length > 1; round++) {
        const ends = [];
        items.forEach((it, ii) => {
          for (const e of [0, 1]) {
            ends.push({ ii, e, pt: endPt(it.pts, e), dir: outDir(it.pts, e), layer: it.layer });
          }
        });
        const cands = [];
        for (let a = 0; a < ends.length; a++) {
          for (let b = a + 1; b < ends.length; b++) {
            const A = ends[a], B = ends[b];
            if (A.ii === B.ii) continue;
            if (p.samePen && A.layer !== B.layer) continue;
            const dx = B.pt[0] - A.pt[0], dy = B.pt[1] - A.pt[1];
            const d = Math.hypot(dx, dy);
            if (d > p.gap) continue;
            const L = d || 1;
            const angA = angBetween(A.dir[0], A.dir[1], dx / L, dy / L);
            const angB = angBetween(B.dir[0], B.dir[1], -dx / L, -dy / L);
            if (angA > tol || angB > tol) continue;
            /* pisteytys: etäisyys + kulmien sileyssakko */
            cands.push({ a, b, d, score: d * (1 + (angA + angB) / Math.max(0.15, tol)) });
          }
        }
        if (!cands.length) break;
        cands.sort((x, y) => x.score - y.score);
        const usedItem = new Set();
        const joins = [];
        for (const c of cands) {
          const A = ends[c.a], B = ends[c.b];
          if (usedItem.has(A.ii) || usedItem.has(B.ii)) continue;
          usedItem.add(A.ii); usedItem.add(B.ii);
          joins.push(c);
        }
        if (!joins.length) break;
        const remove = new Set();
        const added = [];
        for (const c of joins) {
          const A = ends[c.a], B = ends[c.b];
          let pi = items[A.ii].pts, pj = items[B.ii].pts;
          if (A.e === 0) pi = [...pi].reverse();
          if (B.e === 1) pj = [...pj].reverse();
          const Ap = pi[pi.length - 1], Bp = pj[0];
          const conn = bezier(Ap, outDir(pi, 1), Bp, outDir(pj, 0), c.d);
          added.push({ pts: [...pi, ...conn, ...pj], layer: items[A.ii].layer });
          remove.add(A.ii); remove.add(B.ii);
        }
        items = items.filter((_, k) => !remove.has(k)).concat(added);
      }
      /* sulje itsensä kohtaavat silmukat */
      for (const it of items) {
        const A = endPt(it.pts, 1), B = endPt(it.pts, 0);
        const d = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (d <= p.gap && it.pts.length > 3) {
          const dA = outDir(it.pts, 1), dB = outDir(it.pts, 0);
          const dx = B[0] - A[0], dy = B[1] - A[1];
          const L = d || 1;
          if (angBetween(dA[0], dA[1], dx / L, dy / L) <= tol &&
              angBetween(dB[0], dB[1], -dx / L, -dy / L) <= tol) {
            it.pts = [...it.pts, ...bezier(A, dA, B, dB, d)];
            it.closed = true;
          }
        }
        out.push({ pts: it.pts, closed: !!it.closed, layer: it.layer });
      }
      return { paths: out };
    },
  
};
