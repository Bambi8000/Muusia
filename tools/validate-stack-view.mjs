/* validate-stack-view.mjs — checks src/stack-view.jsx.
 *
 * The module is UI (React/JSX), so plain import is impossible in Node;
 * instead the pure functions are extracted VERBATIM between their
 * @pure-begin/@pure-end markers and executed — the era-validator pattern.
 * Also sentinel-checks the module contract and reports App.jsx wiring.
 * Run from the repo root: node tools/validate-stack-view.mjs
 */
import { readFileSync, existsSync } from "node:fs";

let checks = 0, fails = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.log(`FAIL  ${msg}`); }
};

const MOD = "src/stack-view.jsx";
if (!existsSync(MOD)) { console.log(`FAIL  ${MOD} missing`); process.exit(1); }
const src = readFileSync(MOD, "utf8");

/* --- verbatim extraction of pure functions --- */
const extract = (name) => {
  const m = src.split(`/* @pure-begin ${name} */`)[1];
  ok(!!m, `marker @pure-begin ${name} present`);
  if (!m) return null;
  const body = m.split("/* @pure-end */")[0];
  return new Function(`${body}; return ${name};`)();
};

const splitByPens = extract("splitByPens");
const sheetZ = extract("sheetZ");
const mirrorX = extract("mirrorX");
const translatePS = extract("translatePS");
const drillMarks = extract("drillMarks");

/* --- splitByPens --- */
if (splitByPens) {
  const mk = (layers) => ({ paths: layers.map((L, i) => ({ pts: [[i, 0], [i, 1]], closed: false, layer: L })) });
  const inPs = mk([2, 0, 2, 5, 0]);
  const frozen = JSON.stringify(inPs);
  const r = splitByPens(inPs);
  ok(JSON.stringify(inPs) === frozen, "splitByPens does not mutate its input");
  ok(r.length === 3, `groups by used pens (got ${r.length}, want 3)`);
  ok(r.map((s) => s.pen).join(",") === "0,2,5", "pens sorted ascending");
  ok(r[1].ps.paths.length === 2 && r[1].ps.paths[0].pts[0][0] === 0 && r[1].ps.paths[1].pts[0][0] === 2,
    "path order preserved within a pen");
  ok(splitByPens({ paths: [] }).length === 0, "empty input -> empty result");
  ok(splitByPens(null).length === 0, "null input -> empty result");
  ok(splitByPens(mk([13]))[0].pen === 1, "layer wraps mod 12");
  ok(splitByPens(mk([-1]))[0].pen === 11, "negative layer wraps positive");
  const twice = JSON.stringify(splitByPens(mk([3, 1, 3]))) === JSON.stringify(splitByPens(mk([3, 1, 3])));
  ok(twice, "deterministic (double run equal)");
}

/* --- sheetZ --- */
if (sheetZ) {
  const n = 4, gap = 10;
  const zs = [0, 1, 2, 3].map((i) => sheetZ(i, n, gap, false));
  ok(Math.abs(zs.reduce((a, b) => a + b, 0)) < 1e-9, "stack centered on origin");
  ok(zs.every((z, i) => i === 0 || Math.abs(z - zs[i - 1] - gap) < 1e-9), "spacing exact");
  const rz = [0, 1, 2, 3].map((i) => sheetZ(i, n, gap, true));
  ok(JSON.stringify(rz) === JSON.stringify(zs.slice().reverse()), "reverse mirrors the order");
  ok(sheetZ(0, 1, 25, false) === 0, "single sheet sits at z=0");
  ok(zs.every(Number.isFinite), "finite z values");
}

/* --- mirrorX --- */
if (mirrorX) {
  const inPs = { paths: [{ pts: [[10, 5, 1.5], [40, 7]], closed: false, layer: 3 }] };
  const frozen = JSON.stringify(inPs);
  const m = mirrorX(inPs, 100);
  ok(JSON.stringify(inPs) === frozen, "mirrorX does not mutate its input");
  ok(m.paths[0].pts[0][0] === 90 && m.paths[0].pts[1][0] === 60, "x mirrored across sheet width");
  ok(m.paths[0].pts[0][1] === 5 && m.paths[0].pts[0][2] === 1.5, "y and optional z preserved");
  ok(m.paths[0].pts[1].length === 2, "2-component points stay 2-component");
  ok(m.paths[0].layer === 3 && m.paths[0].closed === false, "layer and closed preserved");
  const rt = mirrorX(mirrorX(inPs, 100), 100);
  ok(JSON.stringify(rt) === frozen, "double mirror is identity");
}

/* --- translatePS --- */
if (translatePS) {
  const inPs = { paths: [{ pts: [[1, 2, 0.7], [3, 4]], closed: true, layer: 5 }] };
  const frozen = JSON.stringify(inPs);
  const t2 = translatePS(inPs, 10, 20);
  ok(JSON.stringify(inPs) === frozen, "translatePS does not mutate its input");
  ok(t2.paths[0].pts[0][0] === 11 && t2.paths[0].pts[0][1] === 22, "offset exact");
  ok(t2.paths[0].pts[0][2] === 0.7 && t2.paths[0].pts[1].length === 2, "optional z preserved, arity kept");
  ok(t2.paths[0].closed === true && t2.paths[0].layer === 5, "flags preserved");
}

/* --- drillMarks --- */
if (drillMarks) {
  const d = drillMarks(220, 320, 8, 4.3, 8);
  ok(d.length === 4, "four corner marks");
  ok(d.every((p) => p.closed && p.layer === 8), "closed circles on the mark pen");
  ok(d.every((p) => p.pts.length === 25), "25-point circles (closed ring)");
  const centers = d.map((p) => {
    const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  });
  const want = [[8, 8], [212, 8], [212, 312], [8, 312]];
  ok(centers.every((c, i) => Math.abs(c[0] - want[i][0]) < 1e-6 && Math.abs(c[1] - want[i][1]) < 1e-6),
    "centers at the corner insets");
  const r = Math.max(...d[0].pts.map((q) => Math.hypot(q[0] - 8, q[1] - 8)));
  ok(Math.abs(r - 2.15) < 1e-6, "radius = clearance dia / 2");
  ok(d.every((p) => p.pts.every((q) => q.every(Number.isFinite))), "finite coordinates");
}

/* --- module contract sentinels --- */
ok(src.includes("export default function StackView"), "default export StackView");
ok(src.includes("DRAW_BUDGET"), "point budget constant present");
ok(/budget\s*<=\s*0/.test(src), "budget guard breaks the draw loop");
ok(src.includes("MAX_SHEETS = 12"), "sheet cap is 12");
ok(src.includes("preserve-3d") || src.includes("preserve3d") || src.includes('transformStyle: "preserve-3d"'), "CSS 3D stack (preserve-3d)");
ok(src.includes("translateZ("), "per-sheet translateZ");
ok(!src.includes("Math.random("), "no Math.random anywhere");
ok(!/\blocalStorage\b/.test(src), "no localStorage in the module");
ok(src.includes("evalFrame"), "frames mode uses the injected evalFrame");
ok(src.includes('"Escape"'), "Esc closes the overlay");
ok(src.includes("DRILL_DIA"), "drill clearance table present");
ok(src.includes("M3: 3.2") && src.includes("M4: 4.3") && src.includes("M5: 5.3"), "M3/M4/M5 clearance sizes correct");
ok(src.includes("Physical export"), "physical export section present");
ok(src.includes("buildZip(files)"), "per-sheet export goes through buildZip (one ZIP)");
ok(src.includes("forExport && mirror"), "mirror applies to export only, preview stays front view");
ok(src.includes("padStart(2"), "sheet files numbered sheetNN");
ok(/fontStrokes\([^)]*\)\.strokes/.test(src), "fontStrokes result accessed via .strokes ({strokes,width} object, not iterable)");
ok(!/for \(const \w+ of fontStrokes\([^)]*\)\)/.test(src), "fontStrokes return value never iterated directly (regression: white-screen crash)");

/* --- App.jsx wiring report (informative: OK after the era patches) --- */
const APP = "src/App.jsx";
if (existsSync(APP)) {
  const app = readFileSync(APP, "utf8");
  const wired = app.includes('import StackView from "./stack-view.jsx"')
    && app.includes("stackOpen") && app.includes("<StackView");
  console.log(wired ? "wired  App.jsx integration present" : "note   App.jsx not yet wired (run tools/era/patch-stack-view.mjs)");
  if (wired) {
    ok(app.includes('e.key.toLowerCase() === "s"'), "S key toggle wired");
    ok(app.includes(">Stack</button>"), "toolbar Stack button wired");
    ok(app.includes('["S", "3D layer stack view"]'), "Keys popover row wired");
    const exp = app.includes("buildZip={buildZip}");
    console.log(exp ? "wired  export props present" : "note   export props not yet wired (run tools/era/patch-stack-export.mjs)");
    if (exp) {
      ok(app.includes("fontStrokes={fontStrokes}"), "fontStrokes injected");
      ok(app.includes("exportText={(kind, ps, ctxE)"), "exportText closure injected");
    }
  }
}

console.log(fails === 0 ? `stack-view: ALL OK (${checks} checks)` : `stack-view: ${fails}/${checks} FAILED`);
process.exit(fails === 0 ? 0 : 1);
