import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "microbes",
  name: "Microbes",
  cat: "gen",
  group: "creatures",
  desc: "Individual cells and bacteria drawn with real pen outlines: Cell, Coccus, Rod, Spiral, Amoeba and Ciliate, or a mixed microscope field. Count 1 centres a single specimen. Size mm is the longest body dimension before fitting; crowded fields shrink specimens to keep their membranes and filaments apart and inside Margin throughout the loop. Scattered uses seeded, spaced positions; Grid makes a specimen collection. Double membrane adds an inset contour; Interior adds nuclei or coiled material and granules. Filaments controls cilia and bacterial tails. These are stylised forms, not anatomical models. Colours 1–6 assigns selectable pens to whole organisms without changing geometry. Still freezes the field; Drift moves specimens, Breathe changes their bodies, and Swimming combines drift, turning and moving filaments. Time source Timeline follows ANIMATE directly: use 24–48 frames with a fixed Seed for a seamless loop. Manual Time 0–1 accepts value wires. All marks are paths, never bitmap fills. Style is applied last.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "organism", label: "Organism", type: "select", options: ["Mixed", "Cell", "Coccus", "Rod", "Spiral", "Amoeba", "Ciliate"], def: "Mixed" },
    { key: "count", label: "Count", type: "slider", min: 1, max: 120, step: 1, def: 18 },
    { key: "size", label: "Size mm", type: "slider", min: 4, max: 200, step: 1, def: 38 },
    { key: "variation", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
    { key: "layout", label: "Layout", type: "select", options: ["Scattered", "Grid"], def: "Scattered" },
    { key: "membrane", label: "Membrane", type: "select", options: ["Single", "Double"], def: "Double" },
    { key: "interior", label: "Interior", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "filaments", label: "Filaments", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65 },
    { key: "motion", label: "Motion", type: "select", options: ["Still", "Drift", "Breathe", "Swimming"], def: "Swimming" },
    { key: "amount", label: "Motion amount", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65, showIf: p => p.motion !== "Still" },
    { key: "clock", label: "Time source", type: "select", options: ["Timeline", "Manual"], def: "Timeline", showIf: p => p.motion !== "Still" },
    { key: "time", label: "Time 0–1", type: "slider", min: 0, max: 1, step: 0.001, def: 0, showIf: p => p.motion !== "Still" && p.clock === "Manual" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 42 },
    { key: "colours", label: "Colours", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "layer", label: "Pen 1", type: "pen", def: 0 },
    { key: "pen2", label: "Pen 2", type: "pen", def: 6, showIf: p => p.colours >= 2 },
    { key: "pen3", label: "Pen 3", type: "pen", def: 4, showIf: p => p.colours >= 3 },
    { key: "pen4", label: "Pen 4", type: "pen", def: 5, showIf: p => p.colours >= 4 },
    { key: "pen5", label: "Pen 5", type: "pen", def: 7, showIf: p => p.colours >= 5 },
    { key: "pen6", label: "Pen 6", type: "pen", def: 10, showIf: p => p.colours >= 6 },
  ],
  _num(v, fallback, lo, hi) { return Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback)); },
  _region(p, ctx) {
    const W = this._num(ctx.W, 297, 0, 10000), H = this._num(ctx.H, 210, 0, 10000);
    const m = this._num(p.margin, 12, 0, Math.min(W, H)/2);
    return { x: m, y: m, w: W-2*m, h: H-2*m };
  },
  overlay(p, ctx) {
    const g = this._region(p, ctx);
    return g.w > 0 && g.h > 0 ? [{ kind: "rect", ...g }] : [];
  },
  _centres(p, ctx, n, seed) {
    const g = this._region(p, ctx), rng = mulberry32(seed), centres = [];
    if (n === 1) return [{ x:g.x+g.w/2, y:g.y+g.h/2, room:Math.min(g.w,g.h)/2 }];
    if (p.layout === "Grid") {
      const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n*g.w/g.h)))), rows = Math.ceil(n/cols);
      const cw = g.w/cols, ch = g.h/rows;
      for (let i=0; i<n; i++) {
        const row=Math.floor(i/cols), inRow=Math.min(cols,n-row*cols);
        centres.push({ x:g.x+(g.w-inRow*cw)/2+(i%cols+0.5)*cw, y:g.y+(row+0.5)*ch, room:Math.min(cw,ch)/2 });
      }
      return centres;
    }
    // Best-candidate placement is deterministic and independent of animation,
    // size and colour. Reserve a disk around each specimen for its whole loop.
    for (let i=0; i<n; i++) {
      let best, score=-1;
      for (let j=0; j<48; j++) {
        const x=g.x+g.w*(0.06+0.88*rng()), y=g.y+g.h*(0.06+0.88*rng());
        let d=2*Math.min(x-g.x,y-g.y,g.x+g.w-x,g.y+g.h-y);
        for (const q of centres) d=Math.min(d,Math.hypot(x-q.x,y-q.y));
        if (d>score) { best={x,y}; score=d; }
      }
      centres.push(best);
    }
    for (const q of centres) {
      q.room=Math.min(q.x-g.x,q.y-g.y,g.x+g.w-q.x,g.y+g.h-q.y);
      for (const other of centres) if (other!==q) q.room=Math.min(q.room,Math.hypot(q.x-other.x,q.y-other.y)/2);
    }
    return centres;
  },
  compute(ins, p, ctx) {
    const g=this._region(p,ctx); if (Math.min(g.w,g.h)<0.1) return {paths:[]};
    const num=(key,f,lo,hi)=>this._num(p[key],f,lo,hi), TAU=Math.PI*2;
    const n=Math.round(num("count",18,1,120)), seed=Math.round(num("seed",42,-2147483648,2147483647));
    const size=num("size",38,1,2000), variation=num("variation",0.45,0,1), detail=num("interior",0.6,0,1), hair=num("filaments",0.65,0,1);
    const amount=p.motion==="Still"?0:num("amount",0.65,0,1);
    const drift=(p.motion==="Drift"||p.motion==="Swimming")?amount:0;
    const living=(p.motion==="Breathe"||p.motion==="Swimming")?amount:0;
    const frame=this._num(ctx.frameIdx,0,0,1e6), frames=Math.round(this._num(ctx.frameCount,1,1,10000));
    const raw=p.clock==="Manual"?num("time",0,-1e6,1e6):frame/frames;
    const phase=amount ? TAU*((raw%1+1)%1) : 0;
    const colours=Math.round(num("colours",1,1,6));
    const pens=["layer","pen2","pen3","pen4","pen5","pen6"].map((k,i)=>Math.round(num(k,[0,6,4,5,7,10][i],0,11)));
    const kinds=["Cell","Coccus","Rod","Spiral","Amoeba","Ciliate"];
    const centres=this._centres(p,ctx,n,seed), paths=[];
    for (let i=0; i<n; i++) {
      const rng=mulberry32(seed^Math.imul(i+1,73856093));
      const kind=kinds.includes(p.organism)?p.organism:kinds[i%kinds.length];
      const phi=rng()*TAU, turn=rng()*TAU, localSize=size/2*(1-variation*rng()*0.72);
      const lobes=4+Math.floor(rng()*3), handed=rng()<0.5?-1:1;
      const q=centres[i], layer=pens[i%colours];
      const theta=turn+(p.motion==="Swimming"?amount*0.55*Math.sin(phase+phi):0), co=Math.cos(theta), si=Math.sin(theta);
      // These envelopes cover body, details and the longest animated flagellum.
      const extent=kind==="Rod"?1+1.15*hair:kind==="Spiral"?1.1:kind==="Ciliate"?1+0.26*hair:kind==="Amoeba"?1.05:1;
      const r=Math.min(localSize,q.room*0.94/(extent*(1+0.055*living)+0.48*drift));
      const breathe=1+0.055*living*Math.sin(phase+phi);
      const cx=q.x+drift*r*0.32*Math.cos(phase+phi), cy=q.y+drift*r*0.32*Math.sin(phase*2+phi);
      const world=([x,y])=>[cx+r*breathe*(x*co-y*si),cy+r*breathe*(x*si+y*co)];
      const push=(pts,closed=false)=>paths.push({pts:pts.map(world),closed,layer});
      const ring=(x,y,rx,ry=rx,segments=20)=>Array.from({length:segments},(_,j)=>{
        const a=TAU*j/segments;return [x+rx*Math.cos(a),y+ry*Math.sin(a)];
      });
      const steps=Math.min(160,Math.max(48,Math.ceil(r*TAU/0.8)));
      const wave=kind==="Amoeba"?living*0.12*Math.sin(phase+phi):0;
      const radial=a=>kind==="Amoeba"?0.79+0.15*Math.cos(lobes*a+phi+wave)+0.07*Math.sin(3*a-phi):0.96+0.025*Math.sin(3*a+phi);
      let body, inset;
      if (kind==="Rod") {
        body=Array.from({length:steps},(_,j)=>{const a=TAU*j/steps;return [(Math.cos(a)>=0?0.62:-0.62)+0.38*Math.cos(a),0.38*Math.sin(a)];});
      } else if (kind==="Spiral") {
        const centre=t=>[-0.85+1.7*t,0.24*Math.sin(t*TAU*1.5+living*0.35*Math.sin(phase+phi))];
        const side=(t,s,width=0.11)=>{
          const v=centre(t), dy=0.24*TAU*1.5*Math.cos(t*TAU*1.5+living*0.35*Math.sin(phase+phi)),len=Math.hypot(1.7,dy);
          return [v[0]-s*width*dy/len,v[1]+s*width*1.7/len];
        };
        const half=Math.ceil(steps/2);
        body=[...Array.from({length:half+1},(_,j)=>side(j/half,1)),...Array.from({length:half+1},(_,j)=>side(1-j/half,-1))];
        inset=[...Array.from({length:half+1},(_,j)=>side(0.025+0.95*j/half,1,0.065)),...Array.from({length:half+1},(_,j)=>side(0.975-0.95*j/half,-1,0.065))];
      } else if (kind==="Ciliate") {
        body=Array.from({length:steps},(_,j)=>{const a=TAU*j/steps;return [0.57*Math.cos(a)*(1+0.18*Math.sin(a)),Math.sin(a)];});
      } else {
        body=Array.from({length:steps},(_,j)=>{const a=TAU*j/steps,rho=radial(a);return [rho*Math.cos(a),rho*Math.sin(a)];});
      }
      push(body,true);
      if(p.membrane!=="Single")push(inset||body.map(([x,y])=>[x*0.87,y*0.87]),true);

      if (detail>0) {
        if(kind==="Rod"||kind==="Spiral") {
          // One continuous coiled stroke; bacteria do not get a cell nucleus.
          const pts=Array.from({length:65},(_,j)=>{const t=j/64;
            return kind==="Rod"?[-0.64+t*1.28,0.14*Math.sin(t*TAU*3+phi)]:[-0.72+t*1.44,0.24*Math.sin((0.13+t*1.44)/1.7*TAU*1.5+living*0.35*Math.sin(phase+phi))];
          });push(pts);
        }else if(kind!=="Coccus") {
          push(ring(-0.13,0.06,0.27,0.22,40),true);
          push(ring(-0.15,0.07,0.055,0.055,14),true);
          if(detail>0.4)push(ring(0.23,-0.37,0.09,0.12,20),true);
        }
        const granules=Math.round(detail*(kind==="Ciliate"?16:kind==="Spiral"?0:10));
        for(let k=0;k<granules;k++) {
          const a=rng()*TAU,dist=0.38+rng()*0.26;
          let x=dist*Math.cos(a),y=dist*Math.sin(a),gr=0.026+rng()*0.025;
          if(kind==="Rod"){x*=1.07;y*=0.36;}
          if(kind==="Ciliate")x*=0.48;
          // Keep granules outside the large nucleus while retaining a fixed
          // count and point topology at every animation frame.
          if(!["Rod","Coccus"].includes(kind)&&Math.hypot((x+0.13)/0.33,(y-0.06)/0.28)<1)y+=y<0?-0.24:0.24;
          push(ring(x,y,gr,gr,10),true);
        }
      }
      if(kind==="Ciliate"&&hair>0) {
        const cilia=Math.round(18+hair*34);
        for(let k=0;k<cilia;k++) {
          const a=TAU*k/cilia,x=0.57*Math.cos(a)*(1+0.18*Math.sin(a)),y=Math.sin(a);
          const len=0.23*hair*(0.7+0.3*rng()),sway=living*0.3*Math.sin(phase*2-k*0.55+phi);
          const pts=Array.from({length:5},(_,j)=>{const t=j/4;return [x+len*t*Math.cos(a+sway*t),y+len*t*Math.sin(a+sway*t)];});push(pts);
        }
      }
      if(kind==="Rod"&&hair>0) {
        const tails=1+Math.floor(hair*2.99);
        for(let k=0;k<tails;k++) {
          const pts=Array.from({length:40},(_,j)=>{const t=j/39;
            const a=t*TAU*1.4+phi, wave=(1-living)*Math.sin(a)+living*Math.sin(a-phase);
            return [-1-hair*t,handed*hair*(0.2*wave*t+(k-(tails-1)/2)*0.22*t)];
          });push(pts);
        }
      }
    }
    return applyStyle({paths},ins[0]);
  },
};
