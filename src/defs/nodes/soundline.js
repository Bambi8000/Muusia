import { Pin, EMPTY, resample, applyStyle } from "../helpers.js";

export default {
  key: "soundline",
  name: "Sound Line",
  cat: "gen",
  group: "textimg",
  fileBinary: true,
  fileLabel: "Choose WAV\u2026",
  fileAccept: ".wav,audio/wav,audio/x-wav,audio/wave",
  desc: "Turns sound into pen lines. Import a WAV (PCM or float; the clip is mixed to mono and peak-normalized) and draw it as Wave (the signal as one line) or Envelope (mirrored min/max outline, the classic waveform block). Unwired: straight rows inside the margin - set Rows for a stacked sound-poster where the clip runs row by row. Wire any paths into Anchor and the sound rides them instead, displacing each line along its normal, timeline continuing from path to path. Fit maps the whole clip onto the available length; Speed mm/s plays it at a fixed rate and Loop repeats a too-short clip (off: the line goes quiet when the sound ends). Start/Segment pick a slice of the clip; Smooth tames noisy material. Sample step is the plot resolution - it is also the bandwidth: a pen cannot draw 440 Hz, so what survives is the sound's shape.",
  ins: [Pin("paths", "Anchor"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "file", label: "WAV file", type: "file", def: "" },
    { key: "mode", label: "Draw", type: "select", options: ["Wave", "Envelope"], def: "Envelope" },
    { key: "rows", label: "Rows (unwired)", type: "slider", min: 1, max: 40, step: 1, def: 12 },
    { key: "amp", label: "Amplitude mm", type: "slider", min: 0.5, max: 40, step: 0.5, def: 5 },
    { key: "step", label: "Sample step mm", type: "slider", min: 0.2, max: 3, step: 0.1, def: 0.4 },
    { key: "fit", label: "Time", type: "select", options: ["Fit to length", "Speed mm/s"], def: "Fit to length" },
    { key: "speed", label: "Speed mm/s", type: "slider", min: 1, max: 200, step: 1, def: 30 },
    { key: "loop", label: "Loop if too short", type: "check", def: true },
    { key: "start", label: "Start %", type: "slider", min: 0, max: 100, step: 0.5, def: 0 },
    { key: "len", label: "Segment %", type: "slider", min: 1, max: 100, step: 0.5, def: 100 },
    { key: "smooth", label: "Smooth", type: "slider", min: 0, max: 1, step: 0.05, def: 0.1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  onFile(dataUrl) {
    const s = String(dataUrl);
    if (!s.startsWith("data:")) {
      throw new Error("binary intake missing - apply tools/era/patch-file-binary.mjs");
    }
    const b64 = s.slice(s.indexOf(",") + 1);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const dv = new DataView(u8.buffer);
    const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    if (u8.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
      throw new Error("not a WAV file (RIFF/WAVE header missing)");
    }
    /* walk chunks for fmt + data */
    let fmt = null, dataOff = -1, dataLen = 0, o = 12;
    while (o + 8 <= u8.length) {
      const id = tag(o);
      const sz = dv.getUint32(o + 4, true);
      if (id === "fmt ") {
        let code = dv.getUint16(o + 8, true);
        const ch = dv.getUint16(o + 10, true);
        const sr = dv.getUint32(o + 12, true);
        const bits = dv.getUint16(o + 22, true);
        if (code === 0xFFFE && sz >= 26) code = dv.getUint16(o + 32, true); /* WAVE_FORMAT_EXTENSIBLE */
        fmt = { code, ch, sr, bits };
      } else if (id === "data") {
        dataOff = o + 8;
        dataLen = Math.min(sz, u8.length - dataOff);
      }
      o += 8 + sz + (sz & 1);
    }
    if (!fmt || dataOff < 0) throw new Error("WAV fmt/data chunk missing");
    const { code, ch, sr, bits } = fmt;
    const bytes = bits / 8;
    const frames = Math.floor(dataLen / (bytes * ch));
    if (frames < 2) throw new Error("WAV has no audio frames");
    const read = (fi, c) => {
      const q = dataOff + (fi * ch + c) * bytes;
      if (code === 3) return bits === 32 ? dv.getFloat32(q, true) : dv.getFloat64(q, true);
      if (bits === 8) return (u8[q] - 128) / 128;               /* PCM8 is unsigned */
      if (bits === 16) return dv.getInt16(q, true) / 32768;
      if (bits === 24) {
        const v = u8[q] | (u8[q + 1] << 8) | (u8[q + 2] << 16);
        return (v & 0x800000 ? v - 0x1000000 : v) / 8388608;
      }
      if (bits === 32) return dv.getInt32(q, true) / 2147483648;
      throw new Error("unsupported WAV: " + bits + "-bit format " + code);
    };
    /* mix to mono + find peak */
    let peak = 1e-9;
    const mono = new Float64Array(frames);
    for (let i = 0; i < frames; i++) {
      let v = 0;
      for (let c = 0; c < ch; c++) v += read(i, c);
      v /= ch;
      mono[i] = v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    /* peak-normalize, downsample: block-mean signal + block-min/max envelope */
    const r4 = (v) => Math.round((v / peak) * 10000) / 10000;
    const N = Math.min(16384, frames);
    const smp = new Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.floor((i / N) * frames), b = Math.max(a + 1, Math.floor(((i + 1) / N) * frames));
      let s2 = 0;
      for (let j = a; j < b; j++) s2 += mono[j];
      smp[i] = r4(s2 / (b - a));
    }
    const NE = Math.min(2048, frames);
    const lo = new Array(NE), hi = new Array(NE);
    for (let i = 0; i < NE; i++) {
      const a = Math.floor((i / NE) * frames), b = Math.max(a + 1, Math.floor(((i + 1) / NE) * frames));
      let l = 1e9, h = -1e9;
      for (let j = a; j < b; j++) { if (mono[j] < l) l = mono[j]; if (mono[j] > h) h = mono[j]; }
      lo[i] = r4(l); hi[i] = r4(h);
    }
    return { v: 1, kind: "audio", sr, ch, dur: frames / sr, smp, lo, hi };
  },
  overlay(p, ctx, ins) {
    /* rows layout guide, only when nothing is wired into Anchor */
    if (ins && ins[0] && ins[0].paths && ins[0].paths.length) return [];
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
  },
  compute(ins, p, ctx, node) {
    const A = node && node.data && node.data.svg;
    if (!A || A.kind !== "audio" || !A.smp || A.smp.length < 2) return EMPTY;
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const L = Math.round(p.layer);
    const amp = Math.max(0, p.amp);
    const step = Math.max(0.1, p.step);
    const clampP = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];

    /* segment window as a fraction of the clip, wrapping past the end */
    const t0 = Math.min(0.999, Math.max(0, p.start / 100));
    const lenf = Math.max(0.005, Math.min(1, p.len / 100));
    const segDur = A.dur * lenf;
    const pick = (arr, u01) => {
      const x = ((t0 + u01 * lenf) % 1) * (arr.length - 1);
      const i = Math.floor(x), f = x - i;
      return arr[i] + (arr[Math.min(arr.length - 1, i + 1)] - arr[i]) * f;
    };
    /* arc position s (mm) -> clip position u in 0..1, or null past a non-looping end */
    const timeOf = (s, totalLen) => {
      let u = p.fit === "Fit to length" ? s / Math.max(1e-9, totalLen) : (s / Math.max(1e-9, p.speed)) / segDur;
      if (u >= 1 || u < 0) {
        if (!p.loop) return null;
        u = ((u % 1) + 1) % 1;
      }
      return u;
    };
    const smoothArr = (a) => {
      const k = Math.round(p.smooth * 12);
      if (k < 1) return a;
      const out = new Array(a.length);
      for (let i = 0; i < a.length; i++) {
        let s2 = 0, c = 0;
        for (let j = Math.max(0, i - k); j <= Math.min(a.length - 1, i + k); j++) {
          if (a[j] === null) continue;
          s2 += a[j]; c++;
        }
        out[i] = a[i] === null ? null : (c ? s2 / c : 0);
      }
      return out;
    };

    const paths = [];
    const BUDGET = 120000;
    let total = 0;
    const emit = (pts, closed) => {
      if (pts.length < 2 || total + pts.length > BUDGET) return;
      total += pts.length;
      paths.push({ pts: pts.map(clampP), closed, layer: L });
    };

    const src = ins[0];
    if (src && src.paths && src.paths.length) {
      /* ---- anchored: displace wired paths along their normals; time runs across paths ---- */
      let totalLen = 0;
      const rs = src.paths.map((path) => {
        const pts = resample(path.pts, path.closed, step);
        let l = 0;
        for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        totalLen += l;
        return { pts, closed: path.closed };
      });
      let s0 = 0;
      for (const q of rs) {
        const pts = q.pts;
        if (pts.length < 2) continue;
        const svals = [0];
        for (let i = 1; i < pts.length; i++) {
          svals.push(svals[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        }
        const nrm = (i) => {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const d = Math.hypot(dx, dy) || 1;
          return [-dy / d, dx / d];
        };
        const us = pts.map((_, i) => timeOf(s0 + svals[i], totalLen));
        if (p.mode === "Wave") {
          const disp = smoothArr(us.map((u) => u === null ? null : pick(A.smp, u)));
          emit(pts.map((q2, i) => {
            const n = nrm(i), d = disp[i] === null ? 0 : disp[i];
            return [q2[0] + n[0] * amp * d, q2[1] + n[1] * amp * d];
          }), q.closed);
        } else {
          const dHi = smoothArr(us.map((u) => u === null ? null : pick(A.hi, u)));
          const dLo = smoothArr(us.map((u) => u === null ? null : pick(A.lo, u)));
          const side = (disp) => pts.map((q2, i) => {
            const n = nrm(i), d = disp[i] === null ? 0 : disp[i];
            return [q2[0] + n[0] * amp * d, q2[1] + n[1] * amp * d];
          });
          if (q.closed) {
            emit(side(dHi), true);
            emit(side(dLo), true);
          } else {
            emit([...side(dHi), ...side(dLo).reverse()], true);
          }
        }
        s0 += svals[svals.length - 1];
      }
    } else {
      /* ---- unwired: stacked rows inside the margin box ---- */
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 5) return applyStyle({ paths: [] }, ins[1]);
      const R = Math.max(1, Math.min(40, Math.round(p.rows)));
      const nP = Math.max(2, Math.round(bw / step));
      const totalLen = R * bw;
      for (let r = 0; r < R; r++) {
        const base = m + ((r + 0.5) / R) * bh;
        const xs = [], us = [];
        for (let i = 0; i <= nP; i++) {
          xs.push(m + (i / nP) * bw);
          us.push(timeOf(r * bw + (i / nP) * bw, totalLen));
        }
        if (p.mode === "Wave") {
          const disp = smoothArr(us.map((u) => u === null ? null : pick(A.smp, u)));
          emit(xs.map((x, i) => [x, base - amp * (disp[i] === null ? 0 : disp[i])]), false);
        } else {
          const dHi = smoothArr(us.map((u) => u === null ? null : pick(A.hi, u)));
          const dLo = smoothArr(us.map((u) => u === null ? null : pick(A.lo, u)));
          const top = xs.map((x, i) => [x, base - amp * (dHi[i] === null ? 0 : dHi[i])]);
          const bot = xs.map((x, i) => [x, base - amp * (dLo[i] === null ? 0 : dLo[i])]);
          emit([...top, ...bot.reverse()], true);
        }
      }
    }
    return applyStyle({ paths }, ins[1]);
  }
};
