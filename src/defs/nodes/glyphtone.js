import { Pin, EMPTY, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "glyphtone",
  name: "Glyph Halftone",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  desc: "A designer's halftone: a grid where each cell renders its darkness as a glyph — a filled dot, a donut ring, a cluster of mini dots, a stack of stripes, or a stacked chevron. Source is either a seeded noise field (create from nothing) or an imported image (PNG/JPG, fitted to the margin box). Type by Value assigns glyphs by darkness band (clusters in light areas through to filled dots in dark ones, like classic poster halftones); Random picks freely per cell. Big cells merges some cells into 2×2 giants for scale contrast, Size jitter loosens the grid, Pens used sprays glyphs across several pens starting from the base pen. Select Motifs: Wired motif and connect any drawing to the second input to replace the built-in marks. Size maps darkness to motif area; Occupancy keeps fixed-size motifs and varies their count. Tone gradient aligns to tonal contours. Keep motif pens preserves every source pen, or Cell pen assigns the whole motif to one pen. Each cell is one explicit group. Complex motifs enlarge the cell spacing over the whole page; a motif above 108,000 points is refused rather than truncated. Fill pitch is the concentric-fill line spacing — match it to your pen width for solid blacks.",
  ins: [Pin("style", "Style"), Pin("paths", "Motif")],
  outs: [Pin("paths")],
  params: [
    { key: "motifMode", label: "Motifs", type: "select", options: ["Built-in glyphs", "Wired motif"], def: "Built-in glyphs" },
    { key: "motifTone", label: "Tone changes", type: "select", options: ["Size", "Occupancy"], def: "Size", showIf: p => p.motifMode === "Wired motif" },
    { key: "motifOrientation", label: "Motif orientation", type: "select", options: ["Fixed", "Tone gradient"], def: "Fixed", showIf: p => p.motifMode === "Wired motif" },
    { key: "motifAngle", label: "Motif angle °", type: "slider", min: -180, max: 180, step: 1, def: 0, showIf: p => p.motifMode === "Wired motif" },
    { key: "motifPens", label: "Motif pens", type: "select", options: ["Cell pen", "Keep motif pens"], def: "Cell pen", showIf: p => p.motifMode === "Wired motif" },
    { key: "source", label: "Source", type: "select", options: ["Noise", "Image"], def: "Noise" },
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "", showIf: p => p.source === "Image" },
    { key: "cell", label: "Cell mm", type: "slider", min: 3, max: 20, step: 0.5, def: 6 },
    { key: "gDot", label: "Dots", type: "check", def: true, showIf: p => p.motifMode !== "Wired motif" },
    { key: "gRing", label: "Rings", type: "check", def: true, showIf: p => p.motifMode !== "Wired motif" },
    { key: "gClu", label: "Clusters", type: "check", def: true, showIf: p => p.motifMode !== "Wired motif" },
    { key: "gStr", label: "Stripes", type: "check", def: true, showIf: p => p.motifMode !== "Wired motif" },
    { key: "gChe", label: "Chevrons", type: "check", def: false, showIf: p => p.motifMode !== "Wired motif" },
    { key: "typeby", label: "Type by", type: "select", options: ["Value", "Random"], def: "Value", showIf: p => p.motifMode !== "Wired motif" },
    { key: "big", label: "Big cells", type: "slider", min: 0, max: 1, step: 0.01, def: 0.25, showIf: p => p.motifMode !== "Wired motif" },
    { key: "jitter", label: "Size jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.6, step: 0.01, def: 0.08 },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "invert", label: "Invert", type: "check", def: false },
    { key: "nscale", label: "Field scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
    { key: "pitch", label: "Fill pitch mm", type: "slider", min: 0.3, max: 2, step: 0.05, def: 0.6, showIf: p => p.motifMode !== "Wired motif" },
    { key: "pens", label: "Pens used", type: "slider", min: 1, max: 12, step: 1, def: 1, showIf: p => p.motifMode !== "Wired motif" || p.motifPens !== "Keep motif pens" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 29, showIf: p => p.motifMode !== "Wired motif" || p.source === "Noise" || p.jitter > 0 || p.motifTone === "Occupancy" || p.motifPens !== "Keep motif pens" },
    { key: "layer", label: "Pen", type: "pen", def: 0, showIf: p => p.motifMode !== "Wired motif" || p.motifPens !== "Keep motif pens" },
  ],
  _motifCompute(ins,p,ctx,node) {
    const number=(v,d,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));
    const W=number(ctx.W,297,1,100000),H=number(ctx.H,210,1,100000),margin=number(p.margin,12,0,Math.min(W,H)/2);
    const w=W-2*margin,h=H-2*margin;if(w<=0||h<=0)return EMPTY;
    const source=ins?.[1]?.paths||[],motif=source.filter(q=>Array.isArray(q?.pts)&&q.pts.length>=2&&q.pts.every(a=>Array.isArray(a)&&Number.isFinite(a[0])&&Number.isFinite(a[1])));
    if(!motif.length)return EMPTY;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const q of motif)for(const [x,y]of q.pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    const cx=(x0+x1)/2,cy=(y0+y1)/2;let radius=0;
    for(const q of motif)for(const [x,y]of q.pts)radius=Math.max(radius,Math.hypot(x-cx,y-cy));
    if(!(radius>1e-9&&Number.isFinite(radius)))return EMPTY;
    const cost=motif.reduce((s,q)=>s+q.pts.length,0),stamps=Math.floor(108000/cost);if(!stamps)return EMPTY;
    const cell=Math.max(number(p.cell,6,2,1000),Math.sqrt(w*h/stamps));
    const cols=Math.floor(w/cell),rows=Math.floor(h/cell);if(!cols||!rows)return EMPTY;
    const ox=margin+(w-cols*cell)/2,oy=margin+(h-rows*cell)/2;
    const seed=Math.round(number(p.seed,29,-2147483648,2147483647)),gamma=number(p.gamma,1,.1,8),cutoff=number(p.cutoff,.08,0,1),jitter=number(p.jitter,.3,0,1);
    const img=node?.data?.img,usesImage=p.source==='Image';
    if(usesImage&&(!img||!Number.isInteger(img.w)||!Number.isInteger(img.h)||img.w<1||img.h<1||img.w*img.h>2560000||img.g?.length!==img.w*img.h))return EMPTY;
    const scale=usesImage?Math.min(w/img.w,h/img.h):1,ix=usesImage?(W-img.w*scale)/2:0,iy=usesImage?(H-img.h*scale)/2:0;
    const dark=(x,y)=>{
      let v=0;
      if(usesImage){
        const u=(x-ix)/scale-.5,t=(y-iy)/scale-.5;if(u<-.5||t<-.5||u>img.w-.5||t>img.h-.5)return 0;
        const a=Math.floor(u),b=Math.floor(t),fx=u-a,fy=t-b;
        const at=(c,r)=>number(img.g[Math.max(0,Math.min(img.h-1,r))*img.w+Math.max(0,Math.min(img.w-1,c))],0,0,1);
        v=at(a,b)*(1-fx)*(1-fy)+at(a+1,b)*fx*(1-fy)+at(a,b+1)*(1-fx)*fy+at(a+1,b+1)*fx*fy;
      }else{let amp=1,tot=0,fq=1;const ns=number(p.nscale,.012,.00001,1);for(let o=0;o<3;o++){v+=amp*noise2(x*ns*fq,y*ns*fq,seed+o*7);tot+=amp;amp*=.5;fq*=2;}v/=tot;}
      return Math.pow(p.invert?1-v:v,gamma);
    };
    const pens=Math.round(number(p.pens,1,1,12)),base=Math.round(number(p.layer,0,0,11)),paths=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x=ox+(c+.5)*cell,y=oy+(r+.5)*cell,d=dark(x,y);if(d<=cutoff)continue;
      const h1=hash2(c*7+1,r*13+5,seed*3+11);
      if(p.motifTone==='Occupancy'&&h1>=d)continue;
      const magnify=(p.motifTone==='Occupancy'?1:Math.sqrt(d))*(1-jitter*hash2(c+19,r+3,seed));
      let angle=number(p.motifAngle,0,-36000,36000)*Math.PI/180;
      if(p.motifOrientation==='Tone gradient'){const e=cell*.5,gx=dark(x+e,y)-dark(x-e,y),gy=dark(x,y+e)-dark(x,y-e);if(Math.hypot(gx,gy)>1e-7)angle+=Math.atan2(gy,gx)+Math.PI/2;}
      const co=Math.cos(angle),si=Math.sin(angle),sc=cell*.45/radius*magnify,pen=(base+Math.min(pens-1,Math.floor(hash2(c+37,r+23,seed+17)*pens)))%12;
      for(const q of motif)paths.push({...q,group:'motif:'+r+':'+c,closed:!!q.closed,layer:p.motifPens==='Keep motif pens'?Math.round(number(q.layer,0,0,11)):pen,pts:q.pts.map(a=>{const u=(a[0]-cx)*sc,v=(a[1]-cy)*sc;return [x+u*co-v*si,y+u*si+v*co,...a.slice(2)];})});
    }
    return applyStyle({paths},ins[0]);
  },
  overlay(p,ctx) {if(p.motifMode!=="Wired motif")return [];const m=Math.max(0,Math.min(+p.margin||0,Math.min(ctx.W,ctx.H)/2));return [{kind:"rect",x:m,y:m,w:ctx.W-2*m,h:ctx.H-2*m}];},
  compute(ins, p, ctx, node) {
    if(p.motifMode === "Wired motif")return this._motifCompute(ins,p,ctx,node);
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const cell = Math.max(2, p.cell);
    const margin = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 5));
    const cutoff = Math.max(0, p.cutoff);
    const gam = Math.max(0.1, p.gamma);
    const jit = Math.max(0, Math.min(1.5, p.jitter));
    const bigP = Math.max(0, Math.min(1, p.big));
    const pensN = Math.max(1, Math.min(12, Math.round(p.pens)));
    const baseL = Math.round(p.layer);

    // enabled glyphs in light→dark canonical order
    const order = [];
    if (p.gClu) order.push("clu");
    if (p.gChe) order.push("che");
    if (p.gStr) order.push("str");
    if (p.gRing) order.push("ring");
    if (p.gDot) order.push("dot");
    if (!order.length) return applyStyle(EMPTY, ins[0]);

    // ---- darkness field ----
    const img = node && node.data && node.data.img;
    if (p.source === "Image" && !img) return applyStyle(EMPTY, ins[0]);
    let darkAt;
    if (p.source === "Image") {
      const boxW = W - 2 * margin, boxH = H - 2 * margin;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ix0 = (W - iw) / 2, iy0 = (H - ih) / 2;
      darkAt = (x, y) => {
        const u = (x - ix0) / sc, v = (y - iy0) / sc;
        if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
        const ui = Math.floor(u), vi = Math.floor(v);
        const fu = u - ui, fv = v - vi, g = img.g;
        const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
        const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
        return a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
      };
    } else {
      const sc = Math.max(0.0005, p.nscale);
      darkAt = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < 3; o++) { v += amp * noise2(x * sc * fq, y * sc * fq, seed + o * 7); tot += amp; amp *= 0.5; fq *= 2; }
        return v / tot;
      };
    }
    const value = (x, y) => {
      let v = darkAt(x, y);
      if (p.invert) v = 1 - v;
      return Math.pow(Math.max(0, Math.min(1, v)), gam);
    };

    // ---- grid + 2x2 big-cell occupancy ----
    const cols = Math.floor((W - 2 * margin) / cell);
    const rows = Math.floor((H - 2 * margin) / cell);
    if (cols < 1 || rows < 1) return applyStyle(EMPTY, ins[0]);
    const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
    const used = new Uint8Array(cols * rows);
    const glyphs = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (used[r * cols + c]) continue;
      const canBig = c + 1 < cols && r + 1 < rows && !used[r * cols + c + 1] && !used[(r + 1) * cols + c] && !used[(r + 1) * cols + c + 1];
      const isBig = canBig && hash2(c * 7 + 1, r * 13 + 5, seed * 3 + 11) < bigP * 0.4;
      const span = isBig ? 2 : 1;
      for (let j = 0; j < span; j++) for (let i = 0; i < span; i++) used[(r + j) * cols + c + i] = 1;
      const cx = ox + c * cell + (span * cell) / 2, cy = oy + r * cell + (span * cell) / 2;
      const v = value(cx, cy);
      if (v < cutoff) continue;
      glyphs.push({ cx, cy, span, v, c, r });
    }
    if (!glyphs.length) return applyStyle(EMPTY, ins[0]);

    // ---- budget-aware fill pitch ----
    let pitch = Math.max(0.25, p.pitch);
    const estR = (cell * 0.45);
    const estPts = glyphs.length * ((estR / pitch) * ((2 * Math.PI * estR * 0.6) / 0.7)) * 0.6;
    if (estPts > 110000) pitch *= estPts / 110000;

    // ---- glyph painters (local coords around cx,cy; h = half size) ----
    const paths = [];
    const circle = (cx, cy, r, layer) => {
      const n = Math.max(8, Math.ceil((2 * Math.PI * r) / 0.7));
      const pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      paths.push({ pts, closed: true, layer });
    };
    const fillDisc = (cx, cy, R, rIn, layer) => {
      for (let r = R; r > rIn + 1e-6; r -= pitch) circle(cx, cy, r, layer);
      if (rIn > 0) circle(cx, cy, rIn, layer);
      else if (R % pitch > pitch * 0.4) circle(cx, cy, Math.max(0.15, (R % pitch) / 2), layer);
    };
    const draw = {
      dot: (g, h, L) => fillDisc(g.cx, g.cy, h * 0.9, 0, L),
      ring: (g, h, L) => fillDisc(g.cx, g.cy, h * 0.9, h * 0.9 * 0.45, L),
      clu: (g, h, L, rng) => {
        const k = 2 + Math.round(g.v * 2);
        const sp = (2 * h) / k;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++)
          fillDisc(g.cx - h + sp * (i + 0.5), g.cy - h + sp * (j + 0.5), Math.max(0.25, sp * 0.28), 0, L);
      },
      str: (g, h, L) => {
        const n = 2 + Math.round(g.v * 4);
        const w = h * 0.95, hh = h * 0.8;
        for (let j = 0; j < n; j++) {
          const y = g.cy - hh + (n === 1 ? hh : (j / (n - 1)) * 2 * hh);
          paths.push({ pts: [[g.cx - w, y], [g.cx + w, y]], closed: false, layer: L });
        }
      },
      che: (g, h, L) => {
        const n = 1 + Math.round(g.v * 2);
        const w = h * 0.9, k = h * 0.55, step = (h * 1.4) / Math.max(1, n);
        for (let j = 0; j < n; j++) {
          const y = g.cy - h * 0.35 + j * step;
          paths.push({ pts: [[g.cx - w, y + k], [g.cx, y - k], [g.cx + w, y + k]], closed: false, layer: L });
        }
      },
    };

    for (const g of glyphs) {
      const rng = mulberry32(seed * 7919 + (g.r * 4096 + g.c) * 613 + 29);
      const type = p.typeby === "Random"
        ? order[Math.floor(rng() * order.length)]
        : order[Math.min(order.length - 1, Math.floor(g.v * order.length * 0.9999))];
      const sizef = (0.35 + 0.65 * g.v) * (1 + (rng() - 0.5) * jit * 0.8);
      const h = Math.max(0.4, (g.span * cell) / 2 * 0.92 * Math.min(1.15, sizef));
      const L = ((baseL + Math.floor(rng() * pensN)) % 12 + 12) % 12;
      draw[type](g, h, L, rng);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
