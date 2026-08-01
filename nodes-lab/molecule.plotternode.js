({
  key: "molecule",
  name: "Molecule",
  cat: "gen",
  group: "scientific",
  desc: "2D skeletal diagrams of known organic molecules, drawn to chemistry convention: zigzag chains, polygon rings, heteroatoms as stroke-font letters with bonds trimmed around them, double bonds as a shortened inner parallel (symmetric pair on open chains), triple bonds as three lines. Library: alkanes ethane-octane, branched isomers, unsaturated (ethylene, acetylene, butadiene, isoprene), cycloalkanes, aromatics (benzene, toluene, p-xylene, styrene), fused rings (naphthalene, anthracene, pyrene), caffeine, the sugars glucose / fructose / sucrose, betulin (birch-bark lupane triterpenoid), and Gasoline (blend) - the isooctane / heptane / toluene / p-xylene set with the octane-rating reference pair. Aromatic rings render as an inner Circle or a valid Kekule structure (perfect matching, every aromatic carbon gets exactly one double bond). Sheet (all) is a labelled grid poster of the whole library.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "molecule", label: "Molecule", type: "select", options: [
      "Sheet (all)", "Ethane", "Propane", "Butane", "Pentane", "Hexane", "Octane",
      "Isobutane", "Neopentane", "Isooctane",
      "Ethylene", "Acetylene", "1,3-Butadiene", "Isoprene",
      "Cyclopropane", "Cyclobutane", "Cyclopentane", "Cyclohexane",
      "Benzene", "Toluene", "p-Xylene", "Styrene",
      "Naphthalene", "Anthracene", "Pyrene",
      "Heptane", "Gasoline (blend)",
      "Caffeine", "Glucose", "Fructose", "Sucrose", "Betulin",
    ], def: "Benzene" },
    { key: "bond", label: "Bond length mm", type: "slider", min: 3, max: 40, step: 0.5, def: 14 },
    { key: "aromatic", label: "Aromatic style", type: "select", options: ["Circle", "Kekul\u00e9"], def: "Circle" },
    { key: "dgap", label: "Double bond gap mm", type: "slider", min: 0.4, max: 4, step: 0.1, def: 1.4 },
    { key: "dots", label: "Carbon dots", type: "check", def: false },
    { key: "dotR", label: "Dot radius mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.9 },
    { key: "names", label: "Name label", type: "check", def: true },
    { key: "lsize", label: "Label size mm", type: "slider", min: 2, max: 12, step: 0.5, def: 4 },
    { key: "rot", label: "Rotate \u00b0", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Bond pen", type: "pen", def: 0 },
    { key: "labelPen", label: "Label pen", type: "pen", def: 1 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const bx0 = m, by0 = m, bx1 = W - m, by1 = H - m;
    if (bx1 - bx0 < 10 || by1 - by0 < 10) return applyStyle({ paths: [] }, ins[0]);

    /* ================= molecule construction (unit bond length) ============ */
    const EPS = 1e-6;
    const mk = () => ({ atoms: [], bonds: [], rings: [], aromRings: [], els: [] }); /* bonds: [i, j, order, aromatic] */
    const addAtom = (mol, x, y, el) => {
      for (let i = 0; i < mol.atoms.length; i++) {
        if (Math.abs(mol.atoms[i][0] - x) < 1e-4 && Math.abs(mol.atoms[i][1] - y) < 1e-4) {
          if (el) mol.els[i] = el;
          return i;
        }
      }
      mol.atoms.push([x, y]);
      mol.els.push(el || "C");
      return mol.atoms.length - 1;
    };
    const addBond = (mol, i, j, order, arom) => {
      for (const b of mol.bonds) {
        if ((b[0] === i && b[1] === j) || (b[0] === j && b[1] === i)) return;
      }
      mol.bonds.push([i, j, order || 1, !!arom]);
    };
    const chain = (n) => {
      const mol = mk();
      for (let i = 0; i < n; i++) addAtom(mol, i * Math.cos(Math.PI / 6), (i % 2) * Math.sin(Math.PI / 6));
      for (let i = 0; i < n - 1; i++) addBond(mol, i, i + 1, 1);
      return mol;
    };
    const sub = (mol, at, angDeg, order, el, len) => {
      const a = (angDeg * Math.PI) / 180;
      const d = len || 1;
      const j = addAtom(mol, mol.atoms[at][0] + Math.cos(a) * d, mol.atoms[at][1] + Math.sin(a) * d, el);
      addBond(mol, at, j, order || 1);
      return j;
    };
    /* fuse a regular n-gon onto the bond i-j, opening away from ref point */
    const fusePoly = (mol, i, j, n, refx, refy, arom) => {
      const A = mol.atoms[i], B = mol.atoms[j];
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      let nx = -(B[1] - A[1]), ny = B[0] - A[0];
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      if ((refx - mx) * nx + (refy - my) * ny > 0) { nx = -nx; ny = -ny; }
      const R = 0.5 / Math.sin(Math.PI / n);
      const apo = 0.5 / Math.tan(Math.PI / n);
      const cx = mx + nx * apo, cy = my + ny * apo;
      const a0 = Math.atan2(A[1] - cy, A[0] - cx);
      const a1 = Math.atan2(B[1] - cy, B[0] - cx);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const stepDir = -(da >= 0 ? 1 : -1); /* long way around */
      const ids = [i];
      for (let k = 1; k <= n - 2; k++) {
        const a = a0 + stepDir * ((2 * Math.PI) / n) * k;
        ids.push(addAtom(mol, cx + Math.cos(a) * R, cy + Math.sin(a) * R));
      }
      ids.push(j);
      for (let k = 0; k < ids.length - 1; k++) addBond(mol, ids[k], ids[k + 1], 1, arom);
      mol.rings.push(ids);
      if (arom) mol.aromRings.push(ids);
      return ids;
    };
    const ring = (n, arom) => {
      const mol = mk();
      const R = 0.5 / Math.sin(Math.PI / n);
      const ids = [];
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
        ids.push(addAtom(mol, Math.cos(a) * R, Math.sin(a) * R));
      }
      for (let k = 0; k < n; k++) addBond(mol, ids[k], ids[(k + 1) % n], 1, arom);
      mol.rings.push(ids);
      if (arom) mol.aromRings.push(ids);
      return mol;
    };
    /* fused benzenoids on a hex grid: hexes with vertices at 60k degrees have
       edge-sharing neighbors sqrt(3) away along 30/90/150 degrees, so the
       axial basis is e_q = (1.5, sqrt3/2), e_r = (0, sqrt3). The result is
       rotated -30 deg so acenes lie horizontal. */
    const fused = (centers) => {
      const mol = mk();
      const S3 = Math.sqrt(3);
      for (const [q, r] of centers) {
        const cx = 1.5 * q, cy = (S3 / 2) * q + S3 * r;
        const ids = [];
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 180) * (60 * k);
          ids.push(addAtom(mol, cx + Math.cos(a), cy + Math.sin(a)));
        }
        for (let k = 0; k < 6; k++) addBond(mol, ids[k], ids[(k + 1) % 6], 1, true);
        mol.rings.push(ids);
        mol.aromRings.push(ids);
      }
      const cr = Math.cos(-Math.PI / 6), sr = Math.sin(-Math.PI / 6);
      mol.atoms = mol.atoms.map(([x, y]) => [x * cr - y * sr, x * sr + y * cr]);
      return mol;
    };

    const LIB = {};
    LIB["Ethane"] = () => chain(2);
    LIB["Propane"] = () => chain(3);
    LIB["Butane"] = () => chain(4);
    LIB["Pentane"] = () => chain(5);
    LIB["Hexane"] = () => chain(6);
    LIB["Octane"] = () => chain(8);
    LIB["Isobutane"] = () => {
      const mol = mk();
      addAtom(mol, 0, 0);
      sub(mol, 0, 90); sub(mol, 0, 210); sub(mol, 0, 330);
      return mol;
    };
    LIB["Neopentane"] = () => {
      const mol = mk();
      addAtom(mol, 0, 0);
      sub(mol, 0, 45); sub(mol, 0, 135); sub(mol, 0, 225); sub(mol, 0, 315);
      return mol;
    };
    LIB["Isooctane"] = () => {
      const mol = chain(5);
      sub(mol, 1, 90); sub(mol, 1, -90); /* 2,2-dimethyl */
      sub(mol, 3, -90);                   /* 4-methyl */
      return mol;
    };
    LIB["Ethylene"] = () => { const mol = chain(2); mol.bonds[0][2] = 2; return mol; };
    LIB["Acetylene"] = () => {
      const mol = mk();
      addAtom(mol, 0, 0); addAtom(mol, 1, 0);
      addBond(mol, 0, 1, 3);
      return mol;
    };
    LIB["1,3-Butadiene"] = () => {
      const mol = chain(4);
      mol.bonds[0][2] = 2; mol.bonds[2][2] = 2;
      return mol;
    };
    LIB["Isoprene"] = () => {
      const mol = LIB["1,3-Butadiene"]();
      sub(mol, 1, 90);
      return mol;
    };
    LIB["Cyclopropane"] = () => ring(3, false);
    LIB["Cyclobutane"] = () => ring(4, false);
    LIB["Cyclopentane"] = () => ring(5, false);
    LIB["Cyclohexane"] = () => ring(6, false);
    LIB["Benzene"] = () => ring(6, true);
    LIB["Toluene"] = () => { const mol = ring(6, true); sub(mol, 0, -90); return mol; };
    LIB["p-Xylene"] = () => { const mol = ring(6, true); sub(mol, 0, -90); sub(mol, 3, 90); return mol; };
    LIB["Styrene"] = () => {
      const mol = ring(6, true);
      const v1 = sub(mol, 0, -90);
      const v2 = sub(mol, v1, -30, 2);
      return mol;
    };
    LIB["Naphthalene"] = () => fused([[0, 0], [1, 0]]);
    LIB["Anthracene"] = () => fused([[0, 0], [1, 0], [2, 0]]);
    LIB["Pyrene"] = () => fused([[0, 0], [1, 0], [0, 1], [1, 1]]);
    LIB["Heptane"] = () => chain(7);
    LIB["Caffeine"] = () => {
      /* purine-2,6-dione, 1,3,7-trimethyl: pyrimidinedione hexagon fused with
         an imidazole pentagon. Hexagon vertices at 60k deg: h0=C4 (0 deg),
         h1=N3, h2=C2, h3=N1, h4=C6, h5=C5 (300 deg). */
      const mol = ring(6, false);
      /* ring(): vertex k at angle -90+60k -> k0 top; remap by index instead */
      const [t, ur, lr, b, ll, ul] = [0, 1, 2, 3, 4, 5]; /* top, upper-right, lower-right, bottom, lower-left, upper-left */
      /* assign: C5=upper-right, C4=lower-right (fusion edge on the right),
         N3=bottom, C2=lower-left, N1=upper-left, C6=top */
      mol.els[b] = "N"; mol.els[ul] = "N";
      /* carbonyls */
      sub(mol, ll, 180, 2, "O", 0.85);
      sub(mol, t, -90, 2, "O", 0.85);
      /* N-methyls on N1 (upper-left) and N3 (bottom) */
      sub(mol, ul, 150 + 60, 1); /* up-left stub */
      sub(mol, b, 90, 1);
      /* imidazole fused on the right edge ur-lr, opening right (ref = ring center 0,0) */
      const ids = fusePoly(mol, ur, lr, 5, 0, 0, false);
      /* ids = [ur, p1, p2, p3, lr]: N7 = p1 (adjacent to C5), C8 = p2, N9 = p3 */
      mol.els[ids[1]] = "N"; mol.els[ids[3]] = "N";
      /* N7-methyl */
      const c5a = mol.atoms[ids[1]];
      sub(mol, ids[1], (Math.atan2(c5a[1], c5a[0]) * 180) / Math.PI, 1);
      /* double bonds: C4=C5 (shared edge) and C8=N9 */
      for (const bd of mol.bonds) {
        if ((bd[0] === ur && bd[1] === lr) || (bd[0] === lr && bd[1] === ur)) bd[2] = 2;
        if ((bd[0] === ids[2] && bd[1] === ids[3]) || (bd[0] === ids[3] && bd[1] === ids[2])) bd[2] = 2;
      }
      return mol;
    };
    LIB["Glucose"] = () => {
      /* beta-D-glucopyranose, flat skeletal: hexagon with ring O top-right */
      const mol = ring(6, false);
      const [t, ur, lr, b, ll, ul] = [0, 1, 2, 3, 4, 5];
      mol.els[ur] = "O";
      sub(mol, lr, 0, 1, "OH", 0.8);      /* C1 anomeric OH */
      sub(mol, b, 90, 1, "OH", 0.8);      /* C2 */
      sub(mol, ll, 180, 1, "OH", 0.8);    /* C3 */
      sub(mol, ul, 180, 1, "OH", 0.8);    /* C4 */
      const c6 = sub(mol, t, -90, 1);     /* C5 -> CH2 */
      sub(mol, c6, -30, 1, "OH", 0.8);    /* C6 OH */
      return mol;
    };
    LIB["Fructose"] = () => {
      /* beta-D-fructofuranose: pentagon, ring O at top */
      const mol = ring(5, false);
      /* ring(5): vertex 0 at -90 deg = top */
      mol.els[0] = "O";
      sub(mol, 1, 0, 1, "OH", 0.8);
      sub(mol, 2, 120, 1, "OH", 0.8);
      sub(mol, 3, 180, 1, "OH", 0.8);
      const cA = sub(mol, 1, -60, 1);
      sub(mol, cA, 0, 1, "OH", 0.8);
      const cB = sub(mol, 4, -120, 1);
      sub(mol, cB, 180, 1, "OH", 0.8);
      return mol;
    };
    LIB["Sucrose"] = () => {
      /* glucose pyranose + glycosidic O + fructose furanose */
      const mol = ring(6, false);
      const [t, ur, lr, b, ll, ul] = [0, 1, 2, 3, 4, 5];
      mol.els[ur] = "O";
      sub(mol, b, 90, 1, "OH", 0.8);
      sub(mol, ll, 180, 1, "OH", 0.8);
      sub(mol, ul, 180, 1, "OH", 0.8);
      const g6 = sub(mol, t, -90, 1);
      sub(mol, g6, -150, 1, "OH", 0.8);
      /* glycosidic bridge from C1 (lr) rightward */
      const gO = sub(mol, lr, 30, 1, "O", 0.85);
      /* fructose ring along the bridge direction: nearest vertex 0.85 from O */
      const ox = mol.atoms[gO][0], oy = mol.atoms[gO][1];
      const R5 = 0.5 / Math.sin(Math.PI / 5);
      const bax = Math.cos((30 * Math.PI) / 180), bay = Math.sin((30 * Math.PI) / 180);
      const fcx = ox + bax * (0.85 + R5), fcy = oy + bay * (0.85 + R5);
      const back = Math.atan2(oy - fcy, ox - fcx);
      const fids = [];
      for (let k = 0; k < 5; k++) {
        const a = back + (k / 5) * Math.PI * 2;
        fids.push(addAtom(mol, fcx + Math.cos(a) * R5, fcy + Math.sin(a) * R5, k === 1 ? "O" : "C"));
      }
      for (let k = 0; k < 5; k++) addBond(mol, fids[k], fids[(k + 1) % 5], 1);
      addBond(mol, gO, fids[0], 1);
      /* substituents point outward from the fructose ring center */
      const outw = (i) => (Math.atan2(mol.atoms[i][1] - fcy, mol.atoms[i][0] - fcx) * 180) / Math.PI;
      sub(mol, fids[2], outw(fids[2]), 1, "OH", 0.8);
      sub(mol, fids[3], outw(fids[3]), 1, "OH", 0.8);
      const fA = sub(mol, fids[4], outw(fids[4]), 1);
      sub(mol, fA, outw(fids[4]) + 55, 1, "OH", 0.8);
      const fB = sub(mol, fids[0], outw(fids[0]) - 60, 1);
      sub(mol, fB, outw(fids[0]), 1, "OH", 0.8);
      return mol;
    };
    LIB["Betulin"] = () => {
      /* lupane triterpenoid: staircase of four fused cyclohexanes (rings A-D)
         + cyclopentane E fused on D, canonical steroid-style depiction */
      const mol = fused([[0, 0], [1, 0], [1, 1], [2, 1]]);
      mol.aromRings.length = 0; /* lupane is saturated: no aromatic circles */
      for (const bd of mol.bonds) bd[3] = false;
      /* angular methyls FIRST, from the pristine ring skeleton: the six
         fusion carbons are exactly the degree-3 atoms; stub every second one */
      const deg = mol.atoms.map(() => 0);
      for (const bd of mol.bonds) { deg[bd[0]]++; deg[bd[1]]++; }
      const junctions = mol.atoms.map((a, i) => [i, a]).filter(([i]) => deg[i] === 3).map(([i, a]) => [a[0], i]).sort((u, v) => u[0] - v[0]);
      for (let k = 0; k < junctions.length; k += 2) {
        sub(mol, junctions[k][1], -90, 1, undefined, 0.8);
      }
      /* C3-OH: leftmost atom of ring A */
      const byX = mol.atoms.map((a, i) => [a[0], a[1], i]).sort((u, v) => u[0] - v[0]);
      const leftmost = byX[0][2];
      sub(mol, leftmost, 160, 1, "OH", 0.8);
      /* gem-dimethyl at C4: the ring neighbor of C3 */
      const A0 = mol.atoms[leftmost];
      let c4 = -1, best = 1e9;
      mol.atoms.forEach((a, i) => {
        if (i === leftmost) return;
        const d = Math.hypot(a[0] - A0[0], a[1] - A0[1]);
        if (Math.abs(d - 1) < 0.05 && a[1] > A0[1] - 0.2 && d < best) { best = d; c4 = i; }
      });
      if (c4 >= 0) { sub(mol, c4, 90, 1, undefined, 0.8); sub(mol, c4, 150, 1, undefined, 0.8); }
      /* ring E cyclopentane on ring D's top-right edge */
      const byXr = mol.atoms.map((a, i) => [a[0], a[1], i]).sort((u, v) => v[0] - u[0]);
      /* find the rightmost bond of the ring system (both ends degree>=2, len 1) */
      let ei = -1, ej = -1, bx = -1e9;
      for (const bd of mol.bonds) {
        const A2 = mol.atoms[bd[0]], B2 = mol.atoms[bd[1]];
        if (Math.abs(Math.hypot(A2[0] - B2[0], A2[1] - B2[1]) - 1) > 0.05) continue;
        const mx2 = (A2[0] + B2[0]) / 2;
        if (mx2 > bx && A2[1] < 0.5 && B2[1] < 0.5) { bx = mx2; ei = bd[0]; ej = bd[1]; }
      }
      let cx0 = 0, cy0 = 0;
      for (const a of mol.atoms) { cx0 += a[0]; cy0 += a[1]; }
      cx0 /= mol.atoms.length; cy0 /= mol.atoms.length;
      const eids = fusePoly(mol, ei, ej, 5, cx0, cy0, false);
      /* isopropenyl on E: from the middle E vertex a C with =CH2 and CH3 */
      const tip = eids[2];
      const ta = mol.atoms[tip];
      const outA = (Math.atan2(ta[1] - cy0, ta[0] - cx0) * 180) / Math.PI;
      const ip = sub(mol, tip, outA, 1);
      sub(mol, ip, outA - 55, 2, undefined, 0.9);  /* =CH2 */
      sub(mol, ip, outA + 55, 1, undefined, 0.8);  /* CH3 */
      /* C28 CH2OH on the adjacent E vertex */
      const c17 = eids[1];
      const ca2 = mol.atoms[c17];
      const outB = (Math.atan2(ca2[1] - cy0, ca2[0] - cx0) * 180) / Math.PI;
      const ch2 = sub(mol, c17, outB, 1, undefined, 0.85);
      sub(mol, ch2, outB + 50, 1, "OH", 0.8);
      return mol;
    };

    /* ============ Kekule: perfect matching on the aromatic subgraph ========= */
    const kekulize = (mol) => {
      const aromAtoms = new Set();
      const aromBondIdx = [];
      mol.bonds.forEach((b, i) => { if (b[3]) { aromBondIdx.push(i); aromAtoms.add(b[0]); aromAtoms.add(b[1]); } });
      if (!aromBondIdx.length) return true;
      const atoms = [...aromAtoms];
      const need = new Set(atoms);
      const chosen = new Set();
      const bondsOf = {};
      for (const a of atoms) bondsOf[a] = [];
      for (const bi of aromBondIdx) { bondsOf[mol.bonds[bi][0]].push(bi); bondsOf[mol.bonds[bi][1]].push(bi); }
      const bt = () => {
        if (need.size === 0) return true;
        const a = need.values().next().value;
        for (const bi of bondsOf[a]) {
          const [u, v] = mol.bonds[bi];
          if (!need.has(u) || !need.has(v)) continue;
          need.delete(u); need.delete(v); chosen.add(bi);
          if (bt()) return true;
          need.add(u); need.add(v); chosen.delete(bi);
        }
        return false;
      };
      if (!bt()) return false;
      for (const bi of chosen) mol.bonds[bi][2] = 2;
      return true;
    };

    /* ==================== rendering one molecule =========================== */
    const rot = (p.rot * Math.PI) / 180;
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const L = Math.round(p.layer);
    const LP = Math.round(p.labelPen);

    const renderMol = (name, cx, cy, maxW, maxH, bondMM, withName, out) => {
      if (name === "Gasoline (blend)") {
        const parts = ["Isooctane", "Heptane", "Toluene", "p-Xylene"];
        parts.forEach((pn, k) => {
          const px2 = cx + ((k % 2) - 0.5) * (maxW / 2);
          const py2 = cy + (Math.floor(k / 2) - 0.5) * (maxH / 2);
          renderMol(pn, px2, py2, maxW * 0.46, maxH * 0.46, bondMM, withName, out);
        });
        return;
      }
      const mol = LIB[name]();
      const kek = p.aromatic === "Kekul\u00e9";
      if (kek) kekulize(mol);
      /* rotate + measure */
      const pts = mol.atoms.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      const labelH = withName ? p.lsize * 2.0 : 0;
      const w = Math.max(0.6, x1 - x0), h = Math.max(0.6, y1 - y0);
      const s = Math.min(bondMM, (maxW - 2) / w, (maxH - 2 - labelH) / h);
      const ox = cx - ((x0 + x1) / 2) * s;
      const oy = cy - labelH / 2 - ((y0 + y1) / 2) * s;
      const P = (i) => [pts[i][0] * s + ox, pts[i][1] * s + oy];
      const gap = Math.min(p.dgap, s * 0.28);

      /* ---- atom labels (heteroatoms / OH groups) + bond trim radii ---- */
      const clearance = mol.atoms.map(() => 0);
      const labelJobs = [];
      mol.els.forEach((el, i) => {
        if (el === "C") return;
        clearance[i] = (el.length > 1 ? 0.46 : 0.3) * s;
        labelJobs.push(i);
      });
      const drawLabel = (i) => {
        let el = mol.els[i];
        const [x, y] = P(i);
        /* orient OH so the O faces its bond */
        if (el === "OH") {
          const nb = mol.bonds.find((b2) => b2[0] === i || b2[1] === i);
          if (nb) {
            const o = nb[0] === i ? nb[1] : nb[0];
            if (P(o)[0] > x + 0.1) el = "HO";
          }
        }
        const fh = Math.max(2, 0.52 * s);
        const fss = fontStrokes(el, fh, 1);
        const lx = x - fss.width / 2 + fh * 0.1;
        const lyy = y - fh / 2;
        for (const st of fss.strokes) {
          const spts = st.map(([gx, gy]) => [lx + gx, lyy + gy]);
          const loop = spts.length > 3 &&
            Math.abs(spts[0][0] - spts[spts.length - 1][0]) < EPS &&
            Math.abs(spts[0][1] - spts[spts.length - 1][1]) < EPS;
          if (loop) spts.pop();
          out.push({ pts: spts, closed: loop, layer: L });
        }
      };
      /* trim a bond endpoint away from a labelled atom */
      const trim = (A, B, cA, cB) => {
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy) || 1;
        const ux2 = dx / len, uy2 = dy / len;
        return [
          [A[0] + ux2 * cA, A[1] + uy2 * cA],
          [B[0] - ux2 * cB, B[1] - uy2 * cB],
        ];
      };

      /* ring centroids for double-bond inner side + aromatic circles */
      const ringC = mol.rings.map((ids) => {
        let rx = 0, ry = 0;
        for (const i of ids) { rx += P(i)[0]; ry += P(i)[1]; }
        return [rx / ids.length, ry / ids.length, ids];
      });
      const ringOfBond = (i, j) => {
        for (const [rx, ry, ids] of ringC) {
          if (ids.includes(i) && ids.includes(j)) return [rx, ry];
        }
        return null;
      };

      for (const [i, j, order, arom] of mol.bonds) {
        const [A, B] = trim(P(i), P(j), clearance[i], clearance[j]);
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        let nx = -uy, ny = ux;
        const kekDouble = order === 2 && arom;
        const showOrder = arom && p.aromatic === "Circle" ? 1 : order;
        if (showOrder === 1) {
          out.push({ pts: [A, B], closed: false, layer: L });
        } else if (showOrder === 2) {
          const rc = ringOfBond(i, j);
          if (rc || kekDouble) {
            /* main line + shortened inner line toward the ring */
            out.push({ pts: [A, B], closed: false, layer: L });
            let sx = nx, sy = ny;
            if (rc) {
              const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
              if ((rc[0] - mx) * nx + (rc[1] - my) * ny < 0) { sx = -nx; sy = -ny; }
            }
            const t = 0.18 * len;
            out.push({
              pts: [
                [A[0] + ux * t + sx * gap, A[1] + uy * t + sy * gap],
                [B[0] - ux * t + sx * gap, B[1] - uy * t + sy * gap],
              ],
              closed: false, layer: L,
            });
          } else {
            /* open-chain double: symmetric pair */
            out.push({ pts: [[A[0] + nx * gap / 2, A[1] + ny * gap / 2], [B[0] + nx * gap / 2, B[1] + ny * gap / 2]], closed: false, layer: L });
            out.push({ pts: [[A[0] - nx * gap / 2, A[1] - ny * gap / 2], [B[0] - nx * gap / 2, B[1] - ny * gap / 2]], closed: false, layer: L });
          }
        } else { /* triple */
          out.push({ pts: [A, B], closed: false, layer: L });
          out.push({ pts: [[A[0] + nx * gap, A[1] + ny * gap], [B[0] + nx * gap, B[1] + ny * gap]], closed: false, layer: L });
          out.push({ pts: [[A[0] - nx * gap, A[1] - ny * gap], [B[0] - nx * gap, B[1] - ny * gap]], closed: false, layer: L });
        }
      }
      for (const i of labelJobs) drawLabel(i);
      /* aromatic circles */
      if (p.aromatic === "Circle") {
        for (const [rx, ry, ids] of ringC) {
          if (!mol.aromRings.some((ar) => ar.length === ids.length && ar.every((v) => ids.includes(v)))) continue;
          const rr = 0.52 * s * (0.5 / Math.sin(Math.PI / ids.length)) / (0.5 / Math.sin(Math.PI / 6));
          const n = Math.max(20, Math.ceil((Math.PI * 2 * rr) / 0.7));
          const cpts = [];
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            cpts.push([rx + Math.cos(a) * rr, ry + Math.sin(a) * rr]);
          }
          out.push({ pts: cpts, closed: true, layer: L });
        }
      }
      /* carbon dots */
      if (p.dots) {
        const r = Math.min(p.dotR, s * 0.2);
        for (let i = 0; i < pts.length; i++) {
          if (mol.els[i] !== "C") continue;
          const [x, y] = P(i);
          const cpts = [];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            cpts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
          }
          out.push({ pts: cpts, closed: true, layer: L });
        }
      }
      /* name label */
      if (withName) {
        const fs = fontStrokes(name.toUpperCase(), p.lsize, 1);
        const lx = cx - fs.width / 2;
        const ly = oy + y1 * s + p.lsize * 0.9;
        for (const st of fs.strokes) {
          const spts = st.map(([gx, gy]) => [lx + gx, ly + gy]);
          const loop = spts.length > 3 &&
            Math.abs(spts[0][0] - spts[spts.length - 1][0]) < EPS &&
            Math.abs(spts[0][1] - spts[spts.length - 1][1]) < EPS;
          if (loop) spts.pop();
          out.push({ pts: spts, closed: loop, layer: LP });
        }
      }
    };

    const paths = [];
    const NAMES = Object.keys(LIB);
    if (p.molecule === "Sheet (all)") {
      const n = NAMES.length;
      const cols = Math.max(1, Math.round(Math.sqrt((n * (bx1 - bx0)) / (by1 - by0))));
      const rows = Math.ceil(n / cols);
      const cw = (bx1 - bx0) / cols, chh = (by1 - by0) / rows;
      NAMES.forEach((name, i) => {
        const cx = bx0 + ((i % cols) + 0.5) * cw;
        const cy = by0 + (Math.floor(i / cols) + 0.5) * chh;
        renderMol(name, cx, cy, cw * 0.9, chh * 0.92, p.bond, p.names, paths);
      });
    } else {
      renderMol(p.molecule, (bx0 + bx1) / 2, (by0 + by1) / 2, bx1 - bx0, by1 - by0, p.bond, p.names, paths);
    }
    return applyStyle({ paths }, ins[0]);
  },
})
