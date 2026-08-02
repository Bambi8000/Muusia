/* Validator for the Scribble Type node. Auto-switches to the baked version
   when it exists (src/defs/nodes/scribbletype.js); otherwise evaluates the lab
   file with injected helpers. Run: node tools/validate-scribbletype.mjs */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as H from "../src/defs/helpers.js";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BAKED = path.join(ROOT, "src/defs/nodes/scribbletype.js");
const LAB = path.join(ROOT, "nodes-lab/scribbletype.plotternode.js");

let def;
if (fs.existsSync(BAKED)) {
  def = (await import(url.pathToFileURL(BAKED).href)).default;
  console.log("using BAKED src/defs/nodes/scribbletype.js");
} else {
  const code = fs.readFileSync(LAB, "utf8");
  const names = Object.keys(H);
  const fn = new Function(...names, `"use strict"; return (${code});`);
  def = fn(...names.map((n) => H[n]));
  console.log("using LAB nodes-lab/scribbletype.plotternode.js");
}

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; process.exitCode = 1; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
};

const CTX = { W: 210, H: 148 };
const P = {};
for (const pd of def.params) P[pd.key] = pd.def;
const run = (over) => def.compute([null], { ...P, ...over }, CTX, {});

/* oraakkeli: merkkien luurankosegmentit samalla ladonnalla */
const layoutSegs = (p) => {
  const lines = String(p.text).split("|");
  let bw0 = 0;
  for (const ln of lines) bw0 = Math.max(bw0, H.fontStrokes(ln, p.size, p.track).width);
  const bh0 = lines.length * p.size + (lines.length - 1) * p.size * 0.5;
  const m = Math.max(0, p.margin);
  const pad = p.size * 0.4;
  const f = Math.min(1,
    bw0 > 0 ? (CTX.W - 2 * m - pad) / bw0 : 1,
    bh0 > 0 ? (CTX.H - 2 * m - pad) / bh0 : 1);
  const size = p.size * Math.max(0.05, f);
  const cx = (CTX.W * p.tx) / 100, cy = (CTX.H * p.ty) / 100;
  const bh = lines.length * size + (lines.length - 1) * size * 0.5;
  const sc0 = size / 10, tr = p.track || 1;
  const perChar = []; /* {segs, ccx, ccy} */
  lines.forEach((ln, k) => {
    const fsw = H.fontStrokes(ln, size, p.track).width;
    const ox = cx - fsw / 2;
    const oy = cy - bh / 2 + k * size * 1.5;
    let xcur = 0;
    for (const ch of String(ln).toUpperCase()) {
      const g = H.SFONT[ch] || H.SFONT[" "];
      if (g.s.length) {
        const segs = [];
        for (const st of g.s) for (let i = 1; i < st.length; i++)
          segs.push([ox + xcur + st[i - 1][0] * sc0, oy + st[i - 1][1] * sc0,
                     ox + xcur + st[i][0] * sc0, oy + st[i][1] * sc0]);
        perChar.push({ segs, ccx: ox + xcur + (g.w * sc0) / 2, ccy: oy + size / 2, R: Math.max(g.w * sc0, size * 0.55) * 0.45 });
      }
      xcur += (g.w + 2) * sc0 * tr;
    }
  });
  return perChar;
};
const distToSegs = (segs, x, y) => {
  let bd = 1e18;
  for (const [ax, ay, qx, qy] of segs) {
    const dx = qx - ax, dy = qy - ay, L2 = dx * dx + dy * dy;
    let t = L2 > 1e-12 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    bd = Math.min(bd, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return bd;
};

/* 1) determinismi + perusgeometria */
const A = run({});
check("deterministic (double run equal)", JSON.stringify(A) === JSON.stringify(run({})));
let finite = true, inb = true;
for (const pa of A.paths) for (const q of pa.pts) {
  if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
  if (q[0] < P.margin - 1e-6 || q[0] > CTX.W - P.margin + 1e-6 ||
      q[1] < P.margin - 1e-6 || q[1] > CTX.H - P.margin + 1e-6) inb = false;
}
check("all coords finite", finite);
check("inside margin box", inb);

/* 2) yksi yhtenainen veto per merkki (valilyonnit ohitetaan) */
const NT = run({ tails: 0 });
const chars = layoutSegs(P);
check("one continuous stroke per character", NT.paths.length === chars.length,
  NT.paths.length + " vs " + chars.length);

/* 3) kerat keskittyvat omiin merkkisoluihinsa */
let centered = true;
NT.paths.forEach((pa, i) => {
  let mx = 0, my = 0;
  for (const q of pa.pts) { mx += q[0]; my += q[1]; }
  mx /= pa.pts.length; my /= pa.pts.length;
  const c = chars[i];
  if (Math.hypot(mx - c.ccx, my - c.ccy) > c.R) centered = false;
});
check("tangles centered in their char cells", centered);

/* 4) LEGIBILITY-MONOTONIA: keskietaisyys luurankoon pienenee 0 -> 0.5 -> 1 */
const meanDist = (res) => {
  let s = 0, n = 0;
  res.paths.forEach((pa, i) => {
    const c = chars[i];
    if (!c) return;
    for (const q of pa.pts) { s += distToSegs(c.segs, q[0], q[1]); n++; }
  });
  return s / Math.max(1, n);
};
const d0 = meanDist(run({ legibility: 0, tails: 0 }));
const d5 = meanDist(run({ legibility: 0.5, tails: 0 }));
const d1 = meanDist(run({ legibility: 1, tails: 0 }));
check("legibility pulls tangles onto letterforms (monotone)", d0 > d5 * 1.5 && d5 > d1 * 1.5,
  d0.toFixed(2) + " > " + d5.toFixed(2) + " > " + d1.toFixed(2));
check("legibility 1 hugs the skeleton (<0.4mm)", d1 < 0.4, d1.toFixed(3));

/* 4b) kattavuus: legibility 1 piirtaa KOKO luurangon (ei vain osaa siita) */
const CV = run({ legibility: 1, mess: 0, tails: 0 });
let covered = true;
CV.paths.forEach((pa, i) => {
  const c = chars[i];
  if (!c) return;
  for (const [ax, ay, qx, qy] of c.segs) {
    const mx2 = (ax + qx) / 2, my2 = (ay + qy) / 2;
    let bd = 1e9;
    for (const q of pa.pts) bd = Math.min(bd, Math.hypot(q[0] - mx2, q[1] - my2));
    if (bd > 0.8) covered = false;
  }
});
check("legibility 1 covers the whole skeleton", covered);

/* 5) sama kirjain eri paikassa -> eri kera */
const AA = run({ text: "AA", tails: 0 });
check("same letter, different position -> different tangle",
  AA.paths.length === 2 && JSON.stringify(AA.paths[0].pts.map((q) => [q[0] - (AA.paths[0].pts[0][0]), q[1]])) !==
  JSON.stringify(AA.paths[1].pts.map((q) => [q[0] - (AA.paths[1].pts[0][0]), q[1]])));

/* 6) tails lisaa pisteita */
const t0len = run({ tails: 0 }).paths.reduce((s, pa) => s + pa.pts.length, 0);
const t1len = run({ tails: 1 }).paths.reduce((s, pa) => s + pa.pts.length, 0);
check("tails add flicks", t1len > t0len);

/* 7) tyhja teksti / pelkat valilyonnit -> tyhja */
check("empty text -> empty", run({ text: "" }).paths.length === 0);
check("spaces only -> empty", run({ text: "   " }).paths.length === 0);


/* 9) aakkostot: jokainen setti eroaa Latinista ja toisistaan */
const setOut = {};
for (const al of ["Latin", "Runes", "Hieroglyphs", "Cuneiform", "Alchemy", "Asemic"])
  setOut[al] = JSON.stringify(run({ alphabet: al, legibility: 1, mess: 0, tails: 0 }));
const setKeys = Object.keys(setOut);
let setsDistinct = true;
for (let i = 0; i < setKeys.length; i++) for (let j = i + 1; j < setKeys.length; j++)
  if (setOut[setKeys[i]] === setOut[setKeys[j]]) setsDistinct = false;
check("all six alphabets distinct", setsDistinct);

/* 10) glyyfin muoto on paikkainvariantti: sama merkki eri tx -> puhdas translaatio */
for (const al of ["Latin", "Hieroglyphs", "Asemic"]) {
  const A1 = run({ text: "K", alphabet: al, tx: 30, tails: 0 });
  const A2 = run({ text: "K", alphabet: al, tx: 70, tails: 0 });
  const d = (CTX.W * 40) / 100;
  let same = A1.paths.length === 1 && A2.paths.length === 1 &&
    A1.paths[0].pts.length === A2.paths[0].pts.length;
  if (same) for (let i = 0; i < A1.paths[0].pts.length; i++) {
    if (Math.abs(A1.paths[0].pts[i][0] + d - A2.paths[0].pts[i][0]) > 1e-6 ||
        Math.abs(A1.paths[0].pts[i][1] - A2.paths[0].pts[i][1]) > 1e-6) same = false;
  }
  check("glyph shape position-invariant (" + al + ")", same);
}

/* 11) Asemic: seed vaihtaa koko aakkoston, sama seed on johdonmukainen */
check("Asemic: seed regenerates the alphabet",
  JSON.stringify(run({ alphabet: "Asemic", seed: 1 })) !== JSON.stringify(run({ alphabet: "Asemic", seed: 2 })));

/* 12) negatiivinen tracking kaventaa lohkoa */
const bboxW = (res) => {
  let x0 = 1e9, x1 = -1e9;
  for (const pa of res.paths) for (const q of pa.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
  return x1 - x0;
};
const wNeg = bboxW(run({ text: "MUUSIA", track: -0.2, tails: 0 }));
const wPos = bboxW(run({ text: "MUUSIA", track: 1.5, tails: 0 }));
check("negative tracking piles glyphs together", wNeg < wPos * 0.55,
  wNeg.toFixed(1) + " vs " + wPos.toFixed(1));

/* 13) Coil vs Glitch: moodit eroavat, ja Coilissa muoto sailyy keskitasollakin -
      keskietaisyys luurankoon selvasti pienempi kuin Glitchissa samalla legibilityllä */
check("param live: smode",
  JSON.stringify(run({ smode: "Coil" })) !== JSON.stringify(run({ smode: "Glitch orbit" })));
const dCoil = meanDist(run({ smode: "Coil", legibility: 0.3, tails: 0 }));
const dGlitch = meanDist(run({ smode: "Glitch orbit", legibility: 0.3, tails: 0 }));
check("Coil keeps the form at mid legibility", dGlitch > dCoil * 1.6,
  "coil=" + dCoil.toFixed(2) + " glitch=" + dGlitch.toFixed(2));

/* 14) None: puhdas jaljitys legibilitysta riippumatta */
const dNone = meanDist(run({ smode: "None", legibility: 0, tails: 0 }));
check("None traces clean regardless of legibility", dNone < 0.4, dNone.toFixed(3));

/* 15) Sine pystyvedolla ("I"): y etenee monotonisesti (ei silmukoita), x aaltoilee */
const SI = run({ text: "I", smode: "Sine", legibility: 0, mess: 0, tails: 0 });
const sip = SI.paths[0].pts;
let mono = true, crossings = 0;
const mx3 = sip.reduce((a, q) => a + q[0], 0) / sip.length;
for (let i = 1; i < sip.length; i++) {
  if (sip[i][1] < sip[i - 1][1] - 1e-9) mono = false;
  if ((sip[i][0] - mx3) * (sip[i - 1][0] - mx3) < 0) crossings++;
}
check("Sine: monotone advance, no loops", mono);
check("Sine: perpendicular oscillation", crossings >= 4, "crossings=" + crossings);

/* 16) Seismic: purskeisuus - kaaribinien RMS-suhde suuri */
const SE = run({ text: "I", smode: "Seismic", legibility: 0, tails: 0 });
const sep = SE.paths[0].pts;
const med = [...sep].sort((a, b) => a[0] - b[0])[Math.floor(sep.length / 2)][0];
const bins = Array.from({ length: 8 }, () => []);
sep.forEach((q, i) => bins[Math.min(7, Math.floor((i / sep.length) * 8))].push(Math.abs(q[0] - med)));
const rms = bins.map((b) => Math.sqrt(b.reduce((a, v) => a + v * v, 0) / Math.max(1, b.length)));
const rMax = Math.max(...rms), rMin = Math.min(...rms);
check("Seismic: bursty (RMS ratio >= 2.5)", rMax > rMin * 2.5, (rMax / Math.max(1e-9, rMin)).toFixed(1));

/* 17) kaikki viisi moodia keskenaan erilaisia */
const modeOut = {};
for (const sm of ["None", "Coil", "Sine", "Seismic", "Glitch orbit"])
  modeOut[sm] = JSON.stringify(run({ smode: sm }));
const mk2 = Object.keys(modeOut);
let modesDistinct = true;
for (let i = 0; i < mk2.length; i++) for (let j = i + 1; j < mk2.length; j++)
  if (modeOut[mk2[i]] === modeOut[mk2[j]]) modesDistinct = false;
check("all five scribble modes distinct", modesDistinct);

/* 8) parametrien liveness */
const base = JSON.stringify(A);
for (const [k, v] of [
  ["text", "XYZ"], ["size", 60], ["loops", 7], ["mess", 0.1], ["legibility", 0.9],
  ["tails", 0], ["track", -0.2], ["alphabet", "Runes"], ["tx", 20], ["ty", 20], ["margin", 30],
  ["seed", 999], ["layer", 5],
]) {
  check("param live: " + k, JSON.stringify(run({ [k]: v })) !== base);
}

console.log(fail === 0 ? "\nALL " + pass + " CHECKS PASSED" : "\n" + fail + " FAILURES / " + (pass + fail));
