/* Validator for soundline — run from repo root:
   node tools/validate-soundline.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js.
   Synthesizes WAV files in memory and pushes them through onFile,
   then feeds the frozen result to compute via the node argument. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/soundline.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/soundline.js")).default;
  mode = "baked";
}
console.log("mode:", mode);

/* ---- WAV synthesis ---- */
const wav16 = (channels, sr) => {
  const frames = channels[0].length, nCh = channels.length;
  const buf = Buffer.alloc(44 + frames * nCh * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + frames * nCh * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(nCh, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * nCh * 2, 28); buf.writeUInt16LE(nCh * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(frames * nCh * 2, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < nCh; c++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(channels[c][i] * 32767))), 44 + (i * nCh + c) * 2);
  }
  return "data:audio/wav;base64," + buf.toString("base64");
};
const wavF32 = (mono, sr) => {
  const frames = mono.length;
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + frames * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16 * 2, 34);
  buf.write("data", 36); buf.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) buf.writeFloatLE(mono[i], 44 + i * 4);
  return "data:audio/wav;base64," + buf.toString("base64");
};
const sine = (hz, sec, sr, gain = 0.5) =>
  Array.from({ length: Math.round(sec * sr) }, (_, i) => gain * Math.sin(2 * Math.PI * hz * i / sr));

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  file: "t.wav", mode: "Envelope", rows: 12, amp: 5, step: 0.4,
  fit: "Fit to length", speed: 30, loop: true, start: 0, len: 100,
  smooth: 0.1, margin: 15, layer: 0, ...over
});
const NODE = (svg) => ({ data: { svg } });
const run = (svg, over, anchor) => def.compute([anchor, undefined], P(over), ctx, NODE(svg));

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 WAV parse oracle: 1 s 440 Hz sine, 16-bit mono, half gain -> peak-normalized to 1 */
const A1 = def.onFile(wav16([sine(440, 1, 8000, 0.5)], 8000));
{
  const pk = Math.max(...A1.smp.map(Math.abs));
  const hiMax = Math.max(...A1.hi), loMin = Math.min(...A1.lo);
  check("T1 WAV16 parse + normalize",
    A1.kind === "audio" && Math.abs(A1.dur - 1) < 1e-3 && A1.sr === 8000 &&
    A1.smp.length <= 16384 && A1.hi.length <= 2048 &&
    hiMax > 0.95 && hiMax <= 1 && loMin < -0.95 && pk <= 1,
    "dur=" + A1.dur + " pk=" + pk + " hi=" + hiMax + " lo=" + loMin);
}

/* T2 stereo mix + float32: L = -R cancels to silence; float mono parses */
{
  const s = sine(200, 0.5, 8000, 0.8);
  const Ast = def.onFile(wav16([s, s.map((v) => -v)], 8000));
  const stereoQuiet = Math.max(...Ast.hi) < 0.05 || Math.max(...Ast.smp.map(Math.abs)) < 0.05;
  const Af = def.onFile(wavF32(sine(100, 0.25, 4000, 0.3), 4000));
  check("T2 stereo mix + float32",
    stereoQuiet && Af.kind === "audio" && Math.abs(Af.dur - 0.25) < 1e-3,
    "stereoHi=" + Math.max(...Ast.hi) + " fdur=" + Af.dur);
}

/* T3 garbage and unpatched-engine rejection */
{
  let a = false, b = false;
  try { def.onFile("data:text/plain;base64," + Buffer.from("hello world hello world hello world hello world").toString("base64")); }
  catch (e) { a = /WAV/i.test(e.message); }
  try { def.onFile("<svg></svg>"); } catch (e) { b = /patch-file-binary/.test(e.message); }
  check("T3 rejects garbage + names the era patch", a && b);
}

/* T4 determinism + no file -> EMPTY */
{
  const x = JSON.stringify(run(A1, {}));
  const y = JSON.stringify(run(A1, {}));
  const e = def.compute([undefined, undefined], P(), ctx, { data: {} });
  check("T4 determinism + EMPTY", x === y && e.paths.length === 0);
}

/* T5 rows: Wave -> R open paths, Envelope -> R closed paths, inside margin box */
{
  const w = run(A1, { mode: "Wave", rows: 5 }).paths;
  const env = run(A1, { mode: "Envelope", rows: 3 }).paths;
  const inBox = (ps) => ps.every((q) => q.pts.every(([x, y]) =>
    x >= 15 - 1e-6 && x <= 285 + 1e-6 && y >= 15 - 5 - 1e-6 && y <= 185 + 5 + 1e-6));
  check("T5 row counts + layout",
    w.length === 5 && w.every((q) => !q.closed) &&
    env.length === 3 && env.every((q) => q.closed) && inBox(w) && inBox(env),
    "wave=" + w.length + " env=" + env.length);
}

/* T6 silence stays flat, amplitude bounded by amp */
{
  const Asil = def.onFile(wav16([sine(440, 0.5, 8000, 0).map(() => 0)], 8000));
  const flat = run(Asil, { mode: "Wave", rows: 2, amp: 10 }).paths;
  const bases = [15 + (0.5 / 2) * 170, 15 + (1.5 / 2) * 170];
  const flatOK = flat.every((q, i) => q.pts.every(([, y]) => Math.abs(y - bases[i]) < 1e-6));
  const loud = run(A1, { mode: "Wave", rows: 1, amp: 8 }).paths[0];
  const base = 15 + 0.5 * 170;
  const ampOK = loud.pts.every(([, y]) => Math.abs(y - base) <= 8 + 1e-6);
  check("T6 silence flat + amp bound", flatOK && ampOK);
}

/* T7 anchored: straight horizontal anchor displaces in y only; path count per mode */
{
  const anchor = { paths: [{ pts: [[20, 100], [280, 100]], closed: false, layer: 3 }] };
  const w = run(A1, { mode: "Wave", amp: 6 }, anchor).paths;
  const env = run(A1, { mode: "Envelope", amp: 6 }, anchor).paths;
  const yDev = Math.max(...w[0].pts.map(([, y]) => Math.abs(y - 100)));
  const xMono = w[0].pts.every((q, i) => i === 0 || q[0] >= w[0].pts[i - 1][0] - 1e-9);
  check("T7 anchored displace",
    w.length === 1 && !w[0].closed && env.length === 1 && env[0].closed &&
    yDev > 1 && yDev <= 6 + 1e-6 && xMono,
    "paths=" + w.length + "/" + env.length + " yDev=" + yDev);
}

/* T8 anchored closed ring -> Envelope gives two closed rings */
{
  const ring = [];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    ring.push([150 + Math.cos(a) * 60, 100 + Math.sin(a) * 60]);
  }
  const env = run(A1, { mode: "Envelope", amp: 4 }, { paths: [{ pts: ring, closed: true, layer: 0 }] }).paths;
  check("T8 closed anchor -> two rings", env.length === 2 && env.every((q) => q.closed),
    "n=" + env.length);
}

/* T9 loop vs no-loop with a too-short clip at fixed speed:
   loop keeps wiggling to the end, no-loop goes flat after the clip runs out */
{
  const Ashort = def.onFile(wav16([sine(300, 0.2, 8000, 0.9)], 8000)); /* 0.2 s */
  const anchor = { paths: [{ pts: [[20, 100], [280, 100]], closed: false, layer: 0 }] };
  const over = { mode: "Wave", fit: "Speed mm/s", speed: 100, amp: 6, smooth: 0 }; /* clip covers 20 mm of 260 */
  const lp = run(Ashort, { ...over, loop: true }, anchor).paths[0].pts;
  const nl = run(Ashort, { ...over, loop: false }, anchor).paths[0].pts;
  const tail = (pts) => pts.filter(([x]) => x > 200);
  const lpDev = Math.max(...tail(lp).map(([, y]) => Math.abs(y - 100)));
  const nlDev = Math.max(...tail(nl).map(([, y]) => Math.abs(y - 100)));
  check("T9 loop wraps, no-loop goes flat", lpDev > 0.5 && nlDev < 1e-6,
    "loopTail=" + lpDev + " noloopTail=" + nlDev);
}

/* T10 Start/Segment select different material */
{
  const half1 = JSON.stringify(run(A1, { start: 0, len: 50, seed: 0 }));
  const half2 = JSON.stringify(run(A1, { start: 50, len: 50, seed: 0 }));
  check("T10 segment window", half1 !== half2);
}

/* T11 budget: dense settings stay under the point budget and never throw */
{
  let ok = true, total = 0, detail = "";
  try {
    const out = run(A1, { rows: 40, step: 0.2, mode: "Envelope" });
    total = out.paths.reduce((s, q) => s + q.pts.length, 0);
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T11 budget", ok && total <= 120000, detail || ("pts=" + total));
}

/* T12 overlay: margin rect when unwired, nothing when anchored, never throws */
{
  let ok = true, detail = "";
  try {
    const g1 = def.overlay(P(), ctx, [undefined, undefined]);
    const g2 = def.overlay(P(), ctx, [{ paths: [{ pts: [[0, 0], [1, 1]], closed: false, layer: 0 }] }, undefined]);
    const g3 = def.overlay(P(), ctx);
    ok = g1.length === 1 && g1[0].kind === "rect" && g1[0].x === 15 && g2.length === 0 && g3.length === 1;
    detail = "g1=" + g1.length + " g2=" + g2.length;
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T12 overlay", ok, detail);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
