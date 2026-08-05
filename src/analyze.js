/* Muusia - face analysis engine (Portrait phase 2A). DRO mould: self-contained,
   the App.jsx seam is minimal (tools/era/patch-analyze.mjs, 3 anchored edits).

   Deliberately NO react import: the button is created via makeAnalyzeButton(React)
   so this module imports clean in plain Node - tools/validate-analyze.mjs tests
   the exact geometry code the app runs (the v2.45 verbatim-helpers lesson).

   Determinism principle: seed freezes randomness, ANALYZE FREEZES THE WORLD.
   The result is written once to node.data.analysis; compute reads only frozen
   data; the photo (node.data.src) + analysis + params travel inside the patch
   file, so a patch is fully self-contained and model updates never change old
   patches.

   Schema policy: ADDITIVE CHANGES FOREVER. Never rename a field, never change
   a meaning; bump ANALYSIS_V and accept all old versions. */

export const ANALYSIS_V = 1;

/* ------------------------------------------------------------------ */
/* Engine sources - pinned. VERIFY THE PARSING URL BEFORE FIRST RUN    */
/* (spec open question 1). Downloads are cached via the Cache API, so */
/* the second Analyze works offline; every file's SHA-256 is recorded */
/* in analysis.engine. If a CDN link dies, extend the fallback list - */
/* an operational change only, the schema does not move.              */
/* ------------------------------------------------------------------ */
export const SRC = {
  mediapipeVersion: "0.10.14",
  mediapipeLib: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
  mediapipeWasmRoot: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  landmarkerTask: [
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  ],
  ortVersion: "1.19.2",
  ortLib: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.mjs",
  ortWasmRoot: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/",
  /* Face parsing ONNX - VERIFIED 2026-08-05: jonathandinu/face-parsing
     (SegFormer mit-b5 fine-tuned on CelebAMask-HQ; ONNX export by Xenova),
     pinned to the commit that added the onnx weights. The quantized model is
     89.4 MB - the first Analyze downloads it once, the Cache API keeps it
     (NOTE: no Cache API on file:// - run Analyze from the dev server, LAN or
     Pages). The full-precision model.onnx (340 MB) exists at the same path
     without "_quantized" if quantization artifacts ever show. The LAST entry
     is the repo-local fallback (public/models/). */
  parsingOnnx: [
    "https://huggingface.co/jonathandinu/face-parsing/resolve/1f7e152e1efbfe03ce6c2637944a1f6a41bfcd0a/onnx/model_quantized.onnx",
    "models/face-parsing.onnx",
  ],
};

/* Class indices of jonathandinu/face-parsing - VERIFIED against the model's
   config.json id2label 2026-08-05. NOTE: this is NOT the classic BiSeNet
   CelebAMask order (there hair=17; here hair=13 and 17 is neck). If the
   parsing model is ever swapped, fix THIS TABLE only. */
export const CELEB = {
  background: 0, skin: 1, nose: 2, glasses: 3, eyeL: 4, eyeR: 5,
  browL: 6, browR: 7, earL: 8, earR: 9, mouth: 10, lipU: 11, lipL: 12,
  hair: 13, hat: 14, earring: 15, necklace: 16, neck: 17, cloth: 18,
};
const PARSE_SIZE = 512;
const PARSE_MEAN = [0.485, 0.456, 0.406];
const PARSE_STD = [0.229, 0.224, 0.225];

/* MediaPipe 468-mesh index chains the connection constants do not cover */
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4];
const NOSTRILS = [98, 97, 2, 326, 327];

/* ================================================================== */
/* Intake pipeline - one function, three classic traps (spec)          */
/* ================================================================== */
export async function intakeImage(dataUrl, name) {
  const low = String(name || "").toLowerCase();
  /* trap 1: HEIC fails with a message naming the reason */
  if (/\.hei[cf]$/.test(low) || /^data:image\/hei/i.test(dataUrl))
    throw new Error("HEIC/HEIF is not supported. Export the photo as JPEG or PNG (e.g. share it from Photos as JPEG) and upload again.");
  if (!/^data:image\/(jpeg|jpg|png)/i.test(dataUrl))
    throw new Error("Only JPEG and PNG images are supported.");
  const blob = await (await fetch(dataUrl)).blob();
  /* trap 2: EXIF orientation honored - a sideways portrait silently breaks
     the landmark model */
  let bmp;
  try { bmp = await createImageBitmap(blob, { imageOrientation: "from-image" }); }
  catch (e) { bmp = await createImageBitmap(blob); }
  /* trap 3: resize long side to 1280 px before anything is stored */
  const sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const w = Math.max(2, Math.round(bmp.width * sc));
  const h = Math.max(2, Math.round(bmp.height * sc));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); /* flatten alpha over white */
  cx.drawImage(bmp, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data;
  const g = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const lum = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    g[i] = Math.round((1 - lum) * 1000) / 1000; /* darkness 0..1, 1 = black */
  }
  const src = cv.toDataURL("image/jpeg", 0.85); /* re-encoded JPEG, ~200-400 kB */
  return { img: { w, h, g }, src };
}

/* ================================================================== */
/* Model fetching - Cache API + SHA-256                                */
/* ================================================================== */
async function sha256hex(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function fetchModel(urls, onProgress, label) {
  const errs = [];
  for (const raw of urls) {
    const url = /^https?:/.test(raw) ? raw : new URL(raw, document.baseURI).href;
    try {
      let resp = null;
      if (typeof caches !== "undefined") {
        const cache = await caches.open("muusia-models-v1");
        resp = await cache.match(url);
        if (!resp) {
          const net = await fetch(url);
          if (!net.ok) throw new Error("HTTP " + net.status);
          await cache.put(url, net.clone());
          resp = net;
        }
      } else {
        resp = await fetch(url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
      }
      /* stream with progress when Content-Length is known */
      const total = Number(resp.headers.get("content-length")) || 0;
      let buf;
      if (total && resp.body && resp.body.getReader) {
        const reader = resp.body.getReader();
        const chunks = []; let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); got += value.length;
          if (onProgress) onProgress(got / total, label);
        }
        buf = new Uint8Array(got);
        let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
        buf = buf.buffer;
      } else {
        buf = await resp.arrayBuffer();
        if (onProgress) onProgress(1, label);
      }
      return { buf, url, hash: await sha256hex(buf) };
    } catch (e) { errs.push(url.split("/").slice(-1)[0] + " @ " + url.split("/")[2] + ": " + e.message); }
  }
  throw new Error(label + " download failed. Tried: " + errs.join(" | ") + ". Check the network, or place the file under public/models/ - see SRC in src/analyze.js.");
}

/* ================================================================== */
/* Pure geometry - Node-importable, exercised by validate-analyze.mjs  */
/* ================================================================== */

/* Link MediaPipe connection pairs ({start,end}) into ordered index chains.
   Returns arrays of indices; closed loops end where they began (the duplicate
   is dropped, closed flag returned). */
export function orderConnections(pairs) {
  const adj = new Map();
  const add = (a, b) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); };
  for (const c of pairs) {
    const a = c.start != null ? c.start : c[0];
    const b = c.end != null ? c.end : c[1];
    add(a, b); add(b, a);
  }
  const used = new Set();
  const key = (a, b) => a < b ? a + "-" + b : b + "-" + a;
  const chains = [];
  /* open chains first (endpoints have degree 1), then loops */
  const starts = [...adj.keys()].filter((k) => adj.get(k).length === 1)
    .concat([...adj.keys()]);
  for (const s of starts) {
    let cur = s, prev = -1;
    const chain = [s];
    for (;;) {
      const nexts = (adj.get(cur) || []).filter((n) => n !== prev && !used.has(key(cur, n)));
      if (!nexts.length) break;
      const n = nexts[0];
      used.add(key(cur, n));
      prev = cur; cur = n;
      if (cur === s) { chains.push({ idx: chain.slice(), closed: true }); chain.length = 0; break; }
      chain.push(cur);
    }
    if (chain.length > 1) chains.push({ idx: chain, closed: false });
  }
  return chains;
}

export function polyArea(pts) { /* shoelace; y-down: positive = clockwise on screen */
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* Marching squares on a binary mask (Uint8Array w*h, 1 = inside).
   Returns closed loops as [[x,y],...] in mask pixel coordinates
   (no duplicated last point). The mask is virtually zero-padded so
   shapes touching the border still close. */
export function traceMask(mask, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : mask[y * w + x];
  const segs = [];
  /* cells over the padded grid: corner (cx,cy) samples at (cx-1+dx, cy-1+dy) */
  for (let cy = 0; cy <= h; cy++) {
    for (let cx = 0; cx <= w; cx++) {
      const a = at(cx - 1, cy - 1), b = at(cx, cy - 1), c = at(cx, cy), d = at(cx - 1, cy);
      const code = a | (b << 1) | (c << 2) | (d << 3);
      if (code === 0 || code === 15) continue;
      /* edge midpoints in half-integer coords (x2 to keep exact int keys) */
      const T = [2 * cx - 1, 2 * cy - 2], R = [2 * cx, 2 * cy - 1];
      const B = [2 * cx - 1, 2 * cy], L = [2 * cx - 2, 2 * cy - 1];
      const put = (p, q) => segs.push([p, q]);
      switch (code) {
        case 1: put(L, T); break;   case 2: put(T, R); break;
        case 3: put(L, R); break;   case 4: put(R, B); break;
        case 5: put(L, T); put(R, B); break;
        case 6: put(T, B); break;   case 7: put(L, B); break;
        case 8: put(B, L); break;   case 9: put(B, T); break;
        case 10: put(T, R); put(B, L); break;
        case 11: put(B, R); break;  case 12: put(R, L); break;
        case 13: put(R, T); break;  case 14: put(T, L); break;
      }
    }
  }
  /* link undirected segments into loops via endpoint hashing */
  const pk = (p) => p[0] + "," + p[1];
  const inc = new Map();
  segs.forEach((s, i) => {
    for (const p of s) { const k = pk(p); if (!inc.has(k)) inc.set(k, []); inc.get(k).push(i); }
  });
  const usedS = new Uint8Array(segs.length);
  const loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (usedS[i]) continue;
    usedS[i] = 1;
    const loop = [segs[i][0], segs[i][1]];
    for (;;) {
      const end = loop[loop.length - 1];
      const cand = (inc.get(pk(end)) || []).filter((j) => !usedS[j]);
      if (!cand.length) break;
      const j = cand[0];
      usedS[j] = 1;
      const [p, q] = segs[j];
      loop.push(pk(p) === pk(end) ? q : p);
      if (pk(loop[loop.length - 1]) === pk(loop[0])) { loop.pop(); break; }
    }
    if (loop.length >= 3) loops.push(loop.map(([x, y]) => [(x + 2) / 2 - 0.5, (y + 2) / 2 - 0.5]));
  }
  return loops;
}

/* Douglas-Peucker simplification, closed-aware. tol in the pts' own units. */
export function simplifyDP(pts, tol, closed) {
  if (pts.length <= 3) return pts.map((p) => p.slice());
  const seq = closed ? [...pts, pts[0]] : pts;
  const keep = new Uint8Array(seq.length);
  keep[0] = keep[seq.length - 1] = 1;
  const stack = [[0, seq.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [ax, ay] = seq[i0], [bx, by] = seq[i1];
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let mi = -1, md = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, py] = seq[i];
      let d;
      if (L2 < 1e-12) d = Math.hypot(px - ax, py - ay);
      else {
        const t = ((px - ax) * dx + (py - ay) * dy) / L2;
        const cxp = ax + Math.max(0, Math.min(1, t)) * dx;
        const cyp = ay + Math.max(0, Math.min(1, t)) * dy;
        d = Math.hypot(px - cxp, py - cyp);
      }
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol && mi > 0) { keep[mi] = 1; stack.push([i0, mi], [mi, i1]); }
  }
  const out = [];
  for (let i = 0; i < seq.length - (closed ? 1 : 0); i++) if (keep[i]) out.push(seq[i].slice());
  return out.length >= 2 ? out : pts.slice(0, 2).map((p) => p.slice());
}

/* light 3-point moving average; open-chain endpoints pinned */
export function smoothChain(pts, closed, passes) {
  let cur = pts.map((p) => p.slice());
  const n = cur.length;
  if (n < 3) return cur;
  for (let k = 0; k < (passes || 1); k++) {
    const nx = cur.map((p) => p.slice());
    const lo = closed ? 0 : 1, hi = closed ? n : n - 1;
    for (let i = lo; i < hi; i++) {
      const a = cur[(i - 1 + n) % n], b = cur[i], c = cur[(i + 1) % n];
      nx[i][0] = (a[0] + 2 * b[0] + c[0]) / 4;
      nx[i][1] = (a[1] + 2 * b[1] + c[1]) / 4;
    }
    cur = nx;
  }
  return cur;
}

/* Largest component of a class mask -> { outline, holes[], area, confidence }.
   confidence = kept area / total class area (fragmentation measure) - thin,
   scattered classes (glasses frames, reflections) score low and Line economy
   can drop them first. Coordinates in MASK pixels; caller scales. */
export function regionFromMask(mask, w, h) {
  const loops = traceMask(mask, w, h);
  if (!loops.length) return null;
  /* outers = positive area after normalization; pick largest |area| as THE outline */
  let best = -1, bestA = 0;
  loops.forEach((lp, i) => { const A = Math.abs(polyArea(lp)); if (A > bestA) { bestA = A; best = i; } });
  const outline = loops[best];
  if (polyArea(outline) < 0) outline.reverse(); /* normalize outline winding */
  const holes = [];
  let holeA = 0, otherA = 0;
  loops.forEach((lp, i) => {
    if (i === best) return;
    const [px, py] = lp[0];
    if (pointInPoly(px, py, outline)) {
      if (polyArea(lp) > 0) lp.reverse(); /* holes wind the other way */
      holes.push(lp); holeA += Math.abs(polyArea(lp));
    } else otherA += Math.abs(polyArea(lp));
  });
  const area = bestA - holeA;
  const conf = bestA / Math.max(1e-9, bestA + otherA);
  return { outline, holes, area, confidence: Math.round(conf * 1000) / 1000 };
}

/* Structure tensor flow field of img.g inside maskAt(x,y), sparse grid.
   ang = strand direction in radians [0, PI) (perpendicular to the dominant
   gradient), coh = (l1-l2)/(l1+l2) in [0,1]. cell in image pixels. */
export function structureTensorField(img, maskAt, cell) {
  const { w, h, g } = img;
  const gw = Math.max(1, Math.ceil(w / cell)), gh = Math.max(1, Math.ceil(h / cell));
  const ang = new Array(gw * gh).fill(0);
  const coh = new Array(gw * gh).fill(0);
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      let jxx = 0, jyy = 0, jxy = 0, n = 0;
      const x1 = Math.min(w - 2, (cx + 1) * cell), y1 = Math.min(h - 2, (cy + 1) * cell);
      for (let y = Math.max(1, cy * cell); y < y1; y++) {
        for (let x = Math.max(1, cx * cell); x < x1; x++) {
          if (!maskAt(x, y)) continue;
          const gx = (g[y * w + x + 1] - g[y * w + x - 1]) / 2;
          const gy = (g[(y + 1) * w + x] - g[(y - 1) * w + x]) / 2;
          jxx += gx * gx; jyy += gy * gy; jxy += gx * gy; n++;
        }
      }
      const i = cy * gw + cx;
      if (n < 4) continue;
      const tr = jxx + jyy;
      const df = Math.sqrt((jxx - jyy) * (jxx - jyy) + 4 * jxy * jxy);
      const l1 = (tr + df) / 2, l2 = (tr - df) / 2;
      /* dominant gradient orientation; strands run perpendicular to it */
      let a = 0.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2;
      a = ((a % Math.PI) + Math.PI) % Math.PI;
      ang[i] = Math.round(a * 1000) / 1000;
      coh[i] = Math.round((tr > 1e-12 ? (l1 - l2) / (l1 + l2) : 0) * 1000) / 1000;
    }
  }
  return { cell, w: gw, h: gh, ang, coh };
}

/* ================================================================== */
/* Schema v1 structural validator - shared by tools AND the app; an   */
/* imported patch may carry garbage in `analysis`, compute must live. */
/* ================================================================== */
export function validateAnalysis(a, imgW, imgH) {
  const errs = [];
  const isPt = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const isChain = (c) => Array.isArray(c) && c.length >= 2 && c.every(isPt);
  try {
    if (!a || typeof a !== "object") return { ok: false, errors: ["not an object"] };
    if (a.v !== 1) errs.push("unknown schema version " + a.v);
    if (!a.img || !Number.isFinite(a.img.w) || !Number.isFinite(a.img.h)) errs.push("img w/h missing");
    else if (imgW != null && (a.img.w !== imgW || a.img.h !== imgH)) errs.push("img size mismatch with node.data.img");
    if (!a.face || typeof a.face.found !== "boolean") errs.push("face.found missing");
    else if (a.face.found) {
      if (!a.face.chains || typeof a.face.chains !== "object") errs.push("face.chains missing");
      else for (const [k, c] of Object.entries(a.face.chains)) {
        if (c && !isChain(c.pts != null ? c.pts : c)) errs.push("chain " + k + " malformed");
      }
      if (a.face.pose && !["yaw", "pitch", "roll"].every((k) => Number.isFinite(a.face.pose[k]))) errs.push("pose malformed");
    }
    if (a.regions && typeof a.regions === "object") {
      for (const [k, r] of Object.entries(a.regions)) {
        if (!r) continue;
        if (!isChain(r.outline) || r.outline.length < 3) errs.push("region " + k + " outline malformed");
        if (!Array.isArray(r.holes) || r.holes.some((hh) => !isChain(hh))) errs.push("region " + k + " holes malformed");
        if (!Number.isFinite(r.area)) errs.push("region " + k + " area missing");
      }
    }
    if (a.hairFlow) {
      const f = a.hairFlow;
      if (!Number.isFinite(f.cell) || !Number.isFinite(f.w) || !Number.isFinite(f.h) ||
          !Array.isArray(f.ang) || !Array.isArray(f.coh) ||
          f.ang.length !== f.w * f.h || f.coh.length !== f.w * f.h) errs.push("hairFlow malformed");
    }
    if (a.warnings && (!Array.isArray(a.warnings) || a.warnings.some((s) => typeof s !== "string"))) errs.push("warnings malformed");
  } catch (e) { errs.push("validator exception: " + e.message); }
  return { ok: errs.length === 0, errors: errs };
}

/* ================================================================== */
/* Analysis run (browser only): landmarker + parsing -> schema v1      */
/* ================================================================== */
export async function analyzeFace(data, onProgress) {
  const prog = (p, m) => { if (onProgress) onProgress(Math.max(0, Math.min(1, p)), m || ""); };
  if (!data || !data.src || !data.img) throw new Error("No photo loaded - choose an image first.");
  prog(0.02, "loading libraries");

  /* --- lazy CDN imports: NEVER npm deps (singlefile would inline MBs) --- */
  const vision = await import(/* @vite-ignore */ SRC.mediapipeLib);
  prog(0.08, "downloading face landmarker");
  const task = await fetchModel(SRC.landmarkerTask, (f, l) => prog(0.08 + f * 0.22, l), "face landmarker model");
  const fileset = await vision.FilesetResolver.forVisionTasks(SRC.mediapipeWasmRoot);
  const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: new Uint8Array(task.buf) },
    runningMode: "IMAGE",
    numFaces: 4,
    outputFacialTransformationMatrixes: true,
  });

  prog(0.34, "loading onnxruntime");
  const ortMod = await import(/* @vite-ignore */ SRC.ortLib);
  const ort = ortMod.default || ortMod;
  ort.env.wasm.wasmPaths = SRC.ortWasmRoot;
  prog(0.4, "downloading face parsing model");
  const onnx = await fetchModel(SRC.parsingOnnx, (f, l) => prog(0.4 + f * 0.3, l), "face parsing model");
  const session = await ort.InferenceSession.create(onnx.buf, { executionProviders: ["wasm"] });

  /* --- decode the frozen JPEG --- */
  prog(0.72, "analyzing");
  const blob = await (await fetch(data.src)).blob();
  const bmp = await createImageBitmap(blob);
  const W = data.img.w, H = data.img.h;

  const warnings = [];
  const analysis = {
    v: ANALYSIS_V,
    engine: {
      landmarker: "mediapipe tasks-vision " + SRC.mediapipeVersion + " / " + task.url + " #" + task.hash,
      parsing: onnx.url,
      modelHash: onnx.hash,
    },
    img: { w: W, h: H },
    face: { found: false },
    regions: {},
    hairFlow: null,
    warnings,
  };

  /* --- landmarks -> named chains + pose --- */
  const res = landmarker.detect(bmp);
  const faces = (res && res.faceLandmarks) || [];
  if (faces.length === 0) {
    warnings.push("no face found");
  } else {
    if (faces.length > 1) warnings.push("multiple faces (" + faces.length + ") - using the largest");
    let fi = 0, fa = -1;
    faces.forEach((lm, i) => {
      let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (const q of lm) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
      const A = (x1 - x0) * (y1 - y0);
      if (A > fa) { fa = A; fi = i; }
    });
    const lm = faces[fi];
    const px = (i) => [Math.round(lm[i].x * W * 10) / 10, Math.round(lm[i].y * H * 10) / 10];
    const FL = vision.FaceLandmarker;
    const chainFromConn = (conn) => orderConnections(conn).map((c) => ({
      pts: c.idx.map(px), closed: c.closed, confidence: 1,
    }));
    const one = (conn) => { const cs = chainFromConn(conn); return cs.length ? cs[0] : null; };
    const lips = chainFromConn(FL.FACE_LANDMARKS_LIPS).sort((a, b) => b.pts.length - a.pts.length);
    analysis.face = {
      found: true,
      confidence: 0.9, /* tasks-vision exposes no per-face score; heuristic */
      pose: null,
      chains: {
        faceOval: one(FL.FACE_LANDMARKS_FACE_OVAL),
        browL: one(FL.FACE_LANDMARKS_LEFT_EYEBROW),
        browR: one(FL.FACE_LANDMARKS_RIGHT_EYEBROW),
        eyeL: one(FL.FACE_LANDMARKS_LEFT_EYE),
        eyeR: one(FL.FACE_LANDMARKS_RIGHT_EYE),
        irisL: one(FL.FACE_LANDMARKS_LEFT_IRIS),
        irisR: one(FL.FACE_LANDMARKS_RIGHT_IRIS),
        noseBridge: { pts: NOSE_BRIDGE.map(px), closed: false, confidence: 1 },
        nostrils: { pts: NOSTRILS.map(px), closed: false, confidence: 1 },
        lipsOuter: lips[0] || null,
        lipsInner: lips[1] || null,
      },
    };
    /* pose from the transformation matrix (column-major 4x4) */
    const mats = res.facialTransformationMatrixes;
    if (mats && mats[fi] && mats[fi].data) {
      const mm = mats[fi].data;
      const R00 = mm[0], R10 = mm[1], R20 = mm[2], R21 = mm[6], R22 = mm[10];
      const deg = (r) => Math.round((r * 180) / Math.PI * 10) / 10;
      analysis.face.pose = {
        yaw: deg(Math.atan2(R10, R00)),
        pitch: deg(Math.asin(Math.max(-1, Math.min(1, -R20)))),
        roll: deg(Math.atan2(R21, R22)),
      };
      if (Math.abs(analysis.face.pose.yaw) > 25) warnings.push("strong yaw - side chains may be unreliable");
      if (Math.abs(analysis.face.pose.pitch) > 25) warnings.push("strong pitch");
    }
  }

  /* --- face parsing: 512x512 class map --- */
  const pc = document.createElement("canvas");
  pc.width = PARSE_SIZE; pc.height = PARSE_SIZE;
  const pctx = pc.getContext("2d");
  pctx.fillStyle = "#fff"; pctx.fillRect(0, 0, PARSE_SIZE, PARSE_SIZE);
  pctx.drawImage(bmp, 0, 0, PARSE_SIZE, PARSE_SIZE); /* stretch; contours map back per-axis */
  const pd = pctx.getImageData(0, 0, PARSE_SIZE, PARSE_SIZE).data;
  const inp = new Float32Array(3 * PARSE_SIZE * PARSE_SIZE);
  for (let i = 0; i < PARSE_SIZE * PARSE_SIZE; i++) {
    for (let ch = 0; ch < 3; ch++)
      inp[ch * PARSE_SIZE * PARSE_SIZE + i] = (pd[i * 4 + ch] / 255 - PARSE_MEAN[ch]) / PARSE_STD[ch];
  }
  const tensor = new ort.Tensor("float32", inp, [1, 3, PARSE_SIZE, PARSE_SIZE]);
  const out = await session.run({ [session.inputNames[0]]: tensor });
  const logits = out[session.outputNames[0]];
  const [, C, oh, ow] = logits.dims;
  const ld = logits.data;
  /* argmax -> class map at output res, nearest-upsampled to PARSE_SIZE */
  const cls = new Uint8Array(PARSE_SIZE * PARSE_SIZE);
  for (let y = 0; y < PARSE_SIZE; y++) {
    const sy = Math.min(oh - 1, Math.floor((y * oh) / PARSE_SIZE));
    for (let x = 0; x < PARSE_SIZE; x++) {
      const sx = Math.min(ow - 1, Math.floor((x * ow) / PARSE_SIZE));
      let bi = 0, bv = -Infinity;
      for (let c = 0; c < C; c++) {
        const v = ld[c * oh * ow + sy * ow + sx];
        if (v > bv) { bv = v; bi = c; }
      }
      cls[y * PARSE_SIZE + x] = bi;
    }
  }

  prog(0.86, "vectorizing regions");
  const sx = W / PARSE_SIZE, sy = H / PARSE_SIZE;
  const toImg = (loops) => loops.map(([x, y]) => [Math.round(x * sx * 10) / 10, Math.round(y * sy * 10) / 10]);
  const vecClass = (ids) => {
    const mask = new Uint8Array(PARSE_SIZE * PARSE_SIZE);
    let n = 0;
    for (let i = 0; i < cls.length; i++) if (ids.includes(cls[i])) { mask[i] = 1; n++; }
    if (n < 40) return null; /* too small to matter */
    const reg = regionFromMask(mask, PARSE_SIZE, PARSE_SIZE);
    if (!reg) return null;
    const simp = (lp) => smoothChain(simplifyDP(lp, 1.5, true), true, 1); /* ~1-2 px tol + light smoothing */
    return {
      outline: toImg(simp(reg.outline)),
      holes: reg.holes.map((hh) => toImg(simp(hh))),
      area: Math.round(reg.area * sx * sy),
      confidence: reg.confidence,
    };
  };
  analysis.regions = {
    hair: vecClass([CELEB.hair]),
    earL: vecClass([CELEB.earL]),
    earR: vecClass([CELEB.earR]),
    glasses: vecClass([CELEB.glasses]),
    skin: vecClass([CELEB.skin]),
    neck: vecClass([CELEB.neck]),
  };
  if (analysis.regions.glasses && analysis.regions.glasses.confidence < 0.6)
    warnings.push("glasses low confidence - expect cleanup or switch the layer off");

  /* --- hair flow: structure tensor of the 1280 grayscale inside the hair mask --- */
  if (analysis.regions.hair) {
    prog(0.94, "hair flow field");
    const maskAt = (x, y) => {
      const mx = Math.min(PARSE_SIZE - 1, Math.floor(x / sx));
      const my = Math.min(PARSE_SIZE - 1, Math.floor(y / sy));
      return cls[my * PARSE_SIZE + mx] === CELEB.hair;
    };
    analysis.hairFlow = structureTensorField(data.img, maskAt, 16);
  }

  landmarker.close();
  prog(1, "done");
  return analysis;
}

/* ================================================================== */
/* Inspector button - factory so this module never imports React      */
/* ================================================================== */
export function makeAnalyzeButton(React) {
  return function AnalyzeButton({ data, onResult, T }) {
    const [st, setSt] = React.useState({ phase: "idle", pct: 0, msg: "" });
    const busy = st.phase === "work";
    const run = async () => {
      setSt({ phase: "work", pct: 0, msg: "starting" });
      try {
        const a = await analyzeFace(data, (pct, msg) => setSt({ phase: "work", pct, msg }));
        onResult(a);
        setSt({ phase: "done", pct: 1, msg: (a.face.found ? "face found" : "no face") + (a.warnings.length ? " - " + a.warnings.join("; ") : "") });
      } catch (e) {
        setSt({ phase: "error", pct: 0, msg: e.message });
      }
    };
    const col = st.phase === "error" ? "#C23A30" : st.phase === "done" ? "#1F7A48" : (T ? T.dim : "#888");
    return React.createElement("div", { style: { marginTop: 6 } },
      React.createElement("button", {
        onClick: busy ? undefined : run, disabled: busy,
        style: { fontSize: 10, padding: "3px 10px", cursor: busy ? "wait" : "pointer",
          background: T ? T.panel2 : "#eee", color: T ? T.text : "#222",
          border: "1px solid " + (T ? T.line : "#ccc"), borderRadius: 3, fontFamily: "inherit" },
      }, busy ? "Analyzing… " + Math.round(st.pct * 100) + "%" : (data && data.analysis ? "Re-analyze face" : "Analyze face")),
      st.msg ? React.createElement("div", { style: { fontSize: 9, color: col, marginTop: 3, lineHeight: 1.4 } },
        (st.phase === "done" ? "✓ " : "") + st.msg) : null
    );
  };
}
