import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Pin, EMPTY, applyStyle } from "../src/defs/helpers.js";

const built = new URL("../src/defs/nodes/pattern_tile.js", import.meta.url);
const lab = new URL("../nodes-lab/pattern_tile.plotternode.js", import.meta.url);
const def = fs.existsSync(built)
  ? (await import(built.href + `?t=${Date.now()}`)).default
  : vm.runInNewContext(fs.readFileSync(lab, "utf8"), { Pin, EMPTY, applyStyle, Math, Number, Array, Map });
const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const context = { W: 210, H: 297 };
const run = (p = {}, c = context, style) => def.compute([style], { ...defaults, ...p }, c);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const valid = result => result.paths.every(path => path.layer >= 0 && path.layer <= 11 &&
  path.pts.length >= (path.closed ? 3 : 2) && path.pts.every(([x,y]) => Number.isFinite(x) && Number.isFinite(y)));
const signature = value => JSON.stringify(value);

check(def.key === "pattern_tile" && def.ins[0].type === "style" && def.outs.length === 2, "pin contract");
check(def.params.find(p => p.key === "cells")?.type === "patterngrid", "editable grid parameter");
const [pattern, tile] = run();
check(pattern.paths.length > tile.paths.length && tile.paths.length > 0, "both outputs draw, page repeats motif");
check(valid(pattern) && valid(tile), "finite vector paths and valid pens");
check(signature(run()) === signature([pattern, tile]), "deterministic output");
check(pattern.paths.every(q => q.pts.every(([x,y]) => x >= 12 && x <= 198 && y >= 12 && y <= 285)), "page output fits margin");
check(tile.paths.every(q => q.pts.every(([x,y]) => x >= 12 && x <= 198 && y >= 12 && y <= 285)), "tile output fits paper");
check(pattern.paths.some(q => q.closed), "outline produces closed contours");
check(signature(run({ mark: "Slash" })) !== signature(run()), "slash mode changes geometry");
check(run({ mark: "Cross" })[0].paths.length === run({ mark: "Slash" })[0].paths.length * 2, "cross adds second mark");
const lines = run({ grid: 3, cells: ["110","010","000"], mark: "Line" });
check(lines[1].paths.length === 2 && lines[1].paths.every(q => q.pts.length === 2 && !q.closed), "line makes one open stroke per painted run");
check(lines[1].paths[0].pts[1][0] - lines[1].paths[0].pts[0][0] === 14, "horizontal neighbours join into one 2-cell stroke");
check(lines[1].paths.every(q => q.pts[0][1] === q.pts[1][1]), "line strokes stay horizontal");
const splitLines = run({ grid: 3, cells: ["101","000","000"], mark: "Line" });
check(splitLines[1].paths.length === 2, "unpainted cell separates line strokes");
check(run({ grid: 3, cells: ["100","000","000"], mark: "Line" })[1].paths[0].pts[1][0] - run({ grid: 3, cells: ["100","000","000"], mark: "Line" })[1].paths[0].pts[0][0] === 7, "single painted cell remains visible");
check(signature(run({ shiftX: 1 })) !== signature(run()), "horizontal shift moves repeat");
check(signature(run({ shiftY: 1 })) !== signature(run()), "vertical shift moves repeat");
check(signature(run({ cell: 12 })) !== signature(run()), "cell size changes repeat");
check(signature(run({ grid: 12 })) !== signature(run()), "grid density changes repeat");
check(run({ cells: Array(8).fill("00000000") })[0].paths.length === 0, "empty painted motif");
const one = run({ grid: 3, cells: ["100","000","000"], mark: "Outline" });
check(one[1].paths.length === 1 && one[1].paths[0].closed && one[1].paths[0].pts.length === 4, "one pixel creates a closed square");
const joined = run({ grid: 3, cells: ["110","000","000"], mark: "Outline" });
check(joined[1].paths.length === 1 && joined[1].paths[0].pts.length === 4, "touching pixels merge without internal seam");
check(run({ layer: 9 })[0].paths.every(q => q.layer === 9), "pen parameter reaches output");
check(run({ layer: 99 })[0].paths.every(q => q.layer === 11), "pen clamps");
check(run({}, { W: Infinity, H: 200 })[0].paths.length === 0, "invalid paper is empty");
check(run({ margin: 100 }, { W: 100, H: 100 })[0].paths.length === 0, "collapsed paper is empty");
check(def.overlay(defaults, context)[0].kind === "rect", "margin overlay");
check(def.overlay(defaults, {}).length === 0, "overlay tolerates invalid context");
const many = run({ grid: 16, cell: 3, cells: Array(16).fill("1010101010101010"), mark: "Cross" }, { W: 594, H: 841 });
check(many[0].paths.length === 0 || many[0].paths.reduce((s,q) => s + q.pts.length, 0) <= 120000, "large drawing never truncates");
const styled = run({}, context, {kind:"style",mode:"Dashed",dash:3,gap:2,vary:0,phase:0,seed:1});
check(styled[0].paths.length > pattern.paths.length && valid(styled[0]), "Style applies to page output");
console.log(`${checks} Pattern Tile checks passed`);
