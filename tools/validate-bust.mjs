/* Validator for the Bust node. Run from the repo root:
   node tools/validate-bust.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "bust";

const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href + "?v=" + Date.now())).default;
  mode = "[baked]";
} else if (existsSync(labPath)) {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
} else {
  console.error("FAIL: neither baked nor lab definition found");
  process.exit(1);
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const A4 = { W: 297, H: 210 };
const run = (p, ctx, ins) => def.compute(ins === undefined ? [undefined] : ins, p, ctx || A4, {});
const overlay = (p, ctx) => def.overlay(p, ctx || A4);
const countPts = (out) => out.paths.reduce((n, pa) => n + pa.pts.length, 0);
const bbox = (out) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pa of out.paths) for (const [x, y] of pa.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};
const finite = (out) => out.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
const inPaper = (out, W, H, eps = 0.5) =>
  out.paths.every((pa) => pa.pts.every(([x, y]) => x >= -eps && x <= W + eps && y >= -eps && y <= H + eps));
const coveredBy = (out, r) => out.paths.every((pa) => pa.pts.every(([x, y]) => x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2));

/* --- definition contract --- */
ok(/^[a-z][a-z0-9_]*$/.test(def.key), "key matches ^[a-z][a-z0-9_]*$");
ok(typeof def.name === "string" && def.name.length > 0, "name present");
ok(typeof def.desc === "string" && def.desc.length > 100, "desc present");
ok(def.cat === "gen", "cat is gen");
ok(["creatures"].includes(def.group), "group is creatures");
ok(def.ins.length === 1 && def.ins[0].type === "style", "single style input");
ok(def.outs.length === 1 && def.outs[0].type === "paths", "single paths output");
ok(def.params.length >= 20, "params populated (" + def.params.length + ")");
ok(def.params.every((pr) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(pr.key)), "param keys valid identifiers");
ok(new Set(def.params.map((pr) => pr.key)).size === def.params.length, "param keys unique");
ok(def.params.filter((pr) => pr.type === "pen").every((pr) => Number.isInteger(pr.def) && pr.def >= 0 && pr.def <= 11), "pen defaults 0..11");
ok(def.params.filter((pr) => pr.type === "slider").every((pr) => pr.def >= pr.min && pr.def <= pr.max), "slider defaults within min/max");
ok(def.params.filter((pr) => pr.type === "check").every((pr) => typeof pr.def === "boolean"), "check defaults boolean");
ok(!def.params.some((pr) => pr.showIf !== undefined && typeof pr.showIf !== "function"), "showIf predicates are functions");
const byKey = (k) => def.params.find((pr) => pr.key === k);
ok(byKey("form").options.length === 2 && byKey("style").options.length === 6 && byKey("layout").options.length === 3, "option lists sized 2/6/3");
ok(byKey("cLines").showIf({ style: "Contours" }) === true && byKey("cLines").showIf({ style: "Rosette" }) === false, "contour showIf follows style");
ok(byKey("hSpacing").showIf({ style: "Crosshatch" }) === true && byKey("hSpacing").showIf({ style: "Stipple" }) === false, "hatch showIf follows style");
ok(byKey("sDotR").showIf({ style: "Stipple" }) === true && byKey("rPetals").showIf({ style: "Stipple" }) === false, "stipple/rosette showIf disjoint");
ok(byKey("asym").showIf({ layout: "Pair" }) === true && byKey("asym").showIf({ layout: "Single" }) === false, "asym hidden for Single");
const cropP = byKey("crop");
ok(cropP && cropP.type === "slider" && !cropP.showIf && cropP.def >= cropP.min && cropP.def <= cropP.max, "crop slider present, always visible, sane default");

/* --- smoke: every style x form x layout --- */
const styles = ["Outline", "Contours", "Curved hatch", "Crosshatch", "Stipple", "Rosette"];
const forms = ["Female", "Male"];
const layouts = ["Single", "Pair", "Stacked"];
let smoke = 0;
for (const st of styles) for (const fo of forms) for (const la of layouts) {
  smoke++;
  const p = { ...defaults(), style: st, form: fo, layout: la };
  let out;
  try { out = run(p); } catch (e) { ok(false, `smoke ${fo}/${st}/${la} threw: ${e.message}`); continue; }
  const bb = bbox(out);
  const rv = overlay(p);
  ok(finite(out) && inPaper(out, A4.W, A4.H) && rv.length === 1 && coveredBy(out, rv[0]) && bb.w > 2 && bb.h > 2,
    `smoke ${fo}/${st}/${la}: ${countPts(out)} pts, ${out.paths.length} paths, in paper & guide`);
}
ok(smoke === 36, "smoke ran 36 combinations");

/* --- determinism --- */
{
  const p = { ...defaults() };
  const a = run(p), b = run(p);
  ok(countPts(a) === countPts(b) && JSON.stringify(a.paths) === JSON.stringify(b.paths), "deterministic for identical params");
}

/* --- seed sensitivity (wobbled outline, stipple dots) --- */
{
  const p1 = { ...defaults(), wobble: 20 };
  const p2 = { ...defaults(), wobble: 20, seed: 8 };
  const o1 = run(p1), o2 = run(p2);
  const s1 = { ...p1, style: "Stipple" }, s2 = { ...p2, style: "Stipple" };
  const d1 = run(s1), d2 = run(s2);
  ok(JSON.stringify(o1.paths) !== JSON.stringify(o2.paths), "seed changes the wobbled outline");
  ok(JSON.stringify(d1.paths) !== JSON.stringify(d2.paths), "seed changes the stipple");
  /* zero wobble must be glass-smooth regardless of seed */
  const g1 = run({ ...defaults(), wobble: 0 }), g2 = run({ ...defaults(), wobble: 0, seed: 99 });
  ok(JSON.stringify(g1.paths) === JSON.stringify(g2.paths), "wobble 0 is seed-invariant (glass smooth)");
}

/* --- size behaviour --- */
{
  const h90 = bbox(run(defaults())).h;
  const p200 = { ...defaults(), size: 200 };
  const h200 = bbox(run(p200)).h;
  ok(h90 >= 90 * 0.8 && h90 <= 90 * 1.2, `size 90 draws ~90 mm tall (${h90.toFixed(1)} mm)`);
  ok(Math.abs(h200 / h90 - 200 / 90) < 0.15, `size scales geometry (${(h200 / h90).toFixed(2)} for 200/90)`);
  ok(bbox(run(defaults())).w < 90, "figure is taller than wide");
}

/* --- margin fit: a huge figure must fit the sheet --- */
{
  const p = { ...defaults(), size: 400, margin: 12 };
  const out = run(p);
  ok(inPaper(out, A4.W, A4.H, 0.01), "oversized figure fits inside margin on A4 landscape");
  const bb = bbox(out);
  const availH = A4.H - 2 * p.margin;
  ok(bb.h > availH * 0.75 && bb.w > bb.h * 0.4, `and still fills the limiting dimension (w ${bb.w.toFixed(0)} / h ${bb.h.toFixed(0)} of ${availH} mm avail)`);
}

/* --- parameter influence --- */
{
  const nTight = run({ ...defaults(), style: "Curved hatch", hSpacing: 0.5 }).paths.length;
  const nLoose = run({ ...defaults(), style: "Curved hatch", hSpacing: 5 }).paths.length;
  ok(nTight > nLoose && nLoose > 0, `hatch pitch changes density (${nTight} vs ${nLoose} paths)`);
  const c4 = run({ ...defaults(), style: "Contours", cLines: 4 }).paths.length;
  const c80 = run({ ...defaults(), style: "Contours", cLines: 80 }).paths.length;
  ok(c80 > c4, `contour count responds (${c4} -> ${c80} paths)`);
  const a0 = bbox(run({ ...defaults(), layout: "Pair", asym: 0 }));
  const a100 = bbox(run({ ...defaults(), layout: "Pair", asym: 100, seed: 4 }));
  ok(Math.abs(a0.w - a100.w) > 1 || Math.abs(a0.h - a100.h) > 1, "asymmetry changes the pair geometry");
  const t0 = bbox(run(defaults()));
  const t25 = bbox(run({ ...defaults(), tilt: 25 }));
  ok(Math.abs(t0.w - t25.w) > 1, "tilt rotates the figure");
  const x50 = run({ ...defaults(), posX: 10, posY: 90 });
  ok(Math.abs(bbox(x50).x0 - 10 * A4.W / 100 * 2) < 120, "position moves the figure across the sheet");
}

/* --- outline-only composition --- */
{
  const f = run({ ...defaults(), style: "Outline" });
  ok(f.paths.length === 5 && f.paths.every((pa) => pa.closed), `female outline = silhouette + 2x(areola+nipple) (${f.paths.length} paths)`);
  ok(f.paths[0].pts.length >= 50, "silhouette is a closed ring");
  const ma = run({ ...defaults(), form: "Male", style: "Outline" });
  ok(ma.paths.length === 1 && ma.paths[0].closed, `male outline = silhouette only (${ma.paths.length} paths)`);
  ok(f.paths.filter((pa) => !pa.closed).length === 0 && ma.paths.filter((pa) => !pa.closed).length === 0, "no open strokes in Outline style");
}

/* --- crop: flat bust-plate bottom vs full round form --- */
{
  const flatFrac = (pts) => { let yM = -Infinity; for (const q of pts) yM = Math.max(yM, q[1]); return pts.filter((q) => yM - q[1] < 0.3).length / pts.length; };
  const fl0 = flatFrac(run({ ...defaults(), style: "Outline", crop: 0 }).paths[0].pts);
  const fl1 = flatFrac(run({ ...defaults(), style: "Outline", crop: 10 }).paths[0].pts);
  ok(fl1 > 0.08 && fl1 > fl0 * 3, `crop flattens the bottom edge (${(fl0 * 100).toFixed(0)}% -> ${(fl1 * 100).toFixed(0)}% flat)`);
}

/* --- star-convex guarantee: the wobbled outline must never fold on itself.
   Self-crossings are checked strictly; turn angles bound kinks from folds. */
{
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const selfCross = (pts) => {
    const n = pts.length; let c = 0;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = pts[i], b = pts[(i + 1) % n], d = pts[j], e = pts[(j + 1) % n];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9 || Math.hypot(e[0] - d[0], e[1] - d[1]) < 1e-9) continue;
      const d1 = orient(d, a, e), d2 = orient(d, b, e), d3 = orient(a, d, b), d4 = orient(a, e, b);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) c++;
    }
    return c;
  };
  const maxTurn = (pts) => {
    let mt = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
      const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      const cs = Math.min(1, Math.max(-1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)));
      mt = Math.max(mt, Math.acos(cs) * 180 / Math.PI);
    }
    return mt;
  };
  let worstTurn = 0, folds = 0;
  for (const fo of ["Female", "Male"]) for (const sd of [3, 7, 13, 21, 99]) {
    const o = run({ ...defaults(), form: fo, style: "Outline", wobble: 30, seed: sd });
    worstTurn = Math.max(worstTurn, maxTurn(o.paths[0].pts));
    folds += selfCross(o.paths[0].pts);
  }
  ok(folds === 0, "max wobble produces zero self-crossing outlines (10 runs)");
  ok(worstTurn < 100, `worst outline kink stays hand-drawn, not folded (${worstTurn.toFixed(0)} deg)`);
}

/* --- pen routing --- */
{
  const out = run({ ...defaults(), style: "Stipple", penMain: 3, penDetail: 8 });
  const layers = new Set(out.paths.map((pa) => pa.layer));
  ok(layers.has(3) && layers.has(8) && layers.size === 2, `pens route outline/detail (layers: ${[...layers].join(",")})`);
}

/* --- stipple shading bias: denser toward the lower hemisphere --- */
{
  const out = run({ ...defaults(), style: "Stipple", sDots: 1500, sGap: 1.2, sBias: 1 });
  const dots = out.paths.filter((pa) => pa.closed && pa.pts.length === 14);
  const mid = bbox(out);
  const yc = (mid.y0 + mid.y1) / 2;
  const below = dots.filter((pa) => (pa.pts[0][1] + pa.pts[12][1]) / 2 > yc).length;
  ok(dots.length > 100 && below / dots.length > 0.45, `shade bias packs dots low (${(100 * below / dots.length).toFixed(0)}% below centre)`);
}

/* --- point budget and worst case --- */
{
  const heavy = { ...defaults(), style: "Crosshatch", hSpacing: 0.4, size: 260, layout: "Pair", wobble: 30 };
  const t0 = Date.now();
  const out = run(heavy);
  const ms = Date.now() - t0;
  const total = countPts(out);
  ok(total <= 150000, `crosshatch worst case stays under budget (${total} pts)`);
  ok(ms < 6000, `worst case computes fast (${ms} ms)`);
  ok(out.paths.every((pa) => pa.pts.length >= 2), "no degenerate paths in worst case");
  const stip = run({ ...defaults(), style: "Stipple", sDots: 3000, sGap: 0.3, size: 260, layout: "Pair", wobble: 30 });
  ok(countPts(stip) <= 150000, `stipple max stays under budget (${countPts(stip)} pts)`);
  const cont = run({ ...defaults(), style: "Contours", cLines: 80, size: 260, layout: "Pair" });
  ok(countPts(cont) <= 150000, `contours max stays under budget (${countPts(cont)} pts)`);
}

/* --- small canvas --- */
{
  const out = run({ ...defaults(), size: 260, margin: 0 }, { W: 100, H: 100 });
  ok(inPaper(out, 100, 100, 0.01) && countPts(out) > 50, "small canvas fits and keeps detail");
}

/* --- style pass-through --- */
{
  const st = { kind: "style", mode: "Dashed", dash: 1.5, gap: 1, vary: 0, seed: 5 };
  const out = run({ ...defaults() }, A4, [st]);
  ok(finite(out) && inPaper(out, A4.W, A4.H) && out.paths.every((pa) => !pa.closed) && out.paths.length > 0, "dashed style pass-through works");
}

/* --- overlay robustness --- */
{
  ok(overlay({ ...defaults() }, { W: 2, H: 2 }).length === 0, "overlay degrades on degenerate canvas");
  const rv = overlay(defaults());
  ok(rv.length === 1 && rv[0].kind === "rect" && rv[0].w > 5 && rv[0].h > 5, "overlay returns one sane rect");
  const rvp = overlay({ ...defaults(), layout: "Pair" });
  ok(rvp.length === 1 && rvp[0].w > rvp[0].h * 0.5, "pair guide spans both figures");
}

console.log(`\n${fails ? "FAIL" : "PASS"}: ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
