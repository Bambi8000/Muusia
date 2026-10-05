import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "ribbon",
  name: "Ribbon",
  cat: "gen",
  group: "geometric",
  desc: "A band of parallel filament lines following a noise-wandering spine, pinching and swelling with Width variation. Shape Line runs the spine left to right across the sheet; Shape Ring closes it into a loop around the canvas center (Ring radius sets the base size, Wander makes the loop breathe) with seamless periodic noise, every filament a closed pen stroke. Angular adds long straight spans and sharp offset corners: Free folds makes a seeded crossing path, Zigzag alternates across the sheet, and Star closes a polygonal star. No crossings grows an open seeded route with mixed left/right turns while checking the whole band and Clearance mm between separate spans; Turns is a maximum, so wide bands may make fewer turns. Clearance scales with width when fitting the page. Sharp joins use mitres, shortened to bevels past Corner limit. Crossings overprint; use Woven Ribbon for over/under gaps. Angular Fill Lines draws individual filaments; Stripes fills 1–6 pen bands with parallel strokes at Pen pitch. Stripe gap leaves white space between bands. Colours also assigns bands to Line and Ring filaments. Angular fits the whole band into Margin, shrinking width and pitch together only when necessary. Dense settings increase pitch to stay within the point budget. Use a pen matching the final pitch for solid-looking stripes; preview colours are opaque and real ink mixing depends on the pens and paper. Original one-pen Line and Ring geometry is unchanged.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "shape", label: "Shape", type: "select", options: ["Line", "Ring", "Angular"], def: "Line" },
    { key: "angularLayout", label: "Angular layout", type: "select", options: ["Free folds", "No crossings", "Zigzag", "Star"], def: "Free folds", showIf: p => p.shape === "Angular" },
    { key: "turns", label: "Turns", type: "slider", min: 1, max: 40, step: 1, def: 9, showIf: p => p.shape === "Angular" && p.angularLayout !== "Star" },
    { key: "clearance", label: "Clearance mm", type: "slider", min: 0, max: 40, step: 0.5, def: 6, showIf: p => p.shape === "Angular" && p.angularLayout === "No crossings" },
    { key: "starPoints", label: "Star points", type: "slider", min: 5, max: 21, step: 2, def: 7, showIf: p => p.shape === "Angular" && p.angularLayout === "Star" },
    { key: "join", label: "Corners", type: "select", options: ["Sharp", "Bevel"], def: "Sharp", showIf: p => p.shape === "Angular" },
    { key: "miterLimit", label: "Corner limit", type: "slider", min: 1, max: 8, step: 0.25, def: 3, showIf: p => p.shape === "Angular" && p.join !== "Bevel" },
    { key: "angularFill", label: "Angular fill", type: "select", options: ["Stripes", "Lines"], def: "Stripes", showIf: p => p.shape === "Angular" },
    { key: "pitch", label: "Pen pitch mm", type: "slider", min: 0.15, max: 2, step: 0.05, def: 0.35, showIf: p => p.shape === "Angular" && p.angularFill !== "Lines" },
    { key: "stripeGap", label: "Stripe gap mm", type: "slider", min: 0, max: 5, step: 0.1, def: 0.4, showIf: p => p.shape === "Angular" && p.angularFill !== "Lines" && p.colours > 1 },
    { key: "rotate", label: "Rotate °", type: "slider", min: -180, max: 180, step: 1, def: 0, showIf: p => p.shape === "Angular" },
    { key: "ringR", label: "Ring radius %", type: "slider", min: 20, max: 100, step: 1, def: 70, showIf: p => p.shape === "Ring" },
    { key: "wander", label: "Wander mm", type: "slider", min: 0, max: 120, step: 1, def: 45, showIf: p => p.shape !== "Angular" },
    { key: "wscale", label: "Wander scale", type: "slider", min: 0.2, max: 4, step: 0.1, def: 1, showIf: p => p.shape !== "Angular" },
    { key: "width", label: "Width mm", type: "slider", min: 2, max: 80, step: 0.5, def: 28 },
    { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8, showIf: p => p.shape !== "Angular" },
    { key: "lines", label: "Lines", type: "slider", min: 1, max: 60, step: 1, def: 24, showIf: p => p.shape !== "Angular" || p.angularFill === "Lines" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 27, showIf: p => p.shape !== "Angular" || !p.angularLayout || ["Free folds", "No crossings"].includes(p.angularLayout) },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "colours", label: "Colours", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "pen2", label: "Pen 2", type: "pen", def: 5, showIf: p => p.colours >= 2 },
    { key: "pen3", label: "Pen 3", type: "pen", def: 7, showIf: p => p.colours >= 3 },
    { key: "pen4", label: "Pen 4", type: "pen", def: 9, showIf: p => p.colours >= 4 },
    { key: "pen5", label: "Pen 5", type: "pen", def: 6, showIf: p => p.colours >= 5 },
    { key: "pen6", label: "Pen 6", type: "pen", def: 3, showIf: p => p.colours >= 6 },
  ],
  _pens(p) {
    const n=Math.round(Math.max(1,Math.min(6,Number.isFinite(+p.colours)?+p.colours:1)));
    return [p.layer,p.pen2,p.pen3,p.pen4,p.pen5,p.pen6].slice(0,n).map((v,i)=>Math.round(Math.max(0,Math.min(11,Number.isFinite(+v)?+v:i))));
  },
  overlay(p, ctx) {
    if(p.shape!=="Angular")return [];
    const W=Number.isFinite(+ctx.W)?Math.max(1,+ctx.W):210,H=Number.isFinite(+ctx.H)?Math.max(1,+ctx.H):297;
    const m=Math.max(0,Math.min(Number.isFinite(+p.margin)?+p.margin:12,Math.min(W,H)/2));
    return [{kind:"rect",x:m,y:m,w:W-2*m,h:H-2*m}];
  },
  // Offset a polyline by signed normal distance. Mitre intersections preserve
  // parallel spacing on both adjoining spans; capped corners become bevels.
  _offset(spine,d,closed,join,limit,safe=false) {
    const count=spine.length,normals=[];
    for(let i=0;i<(closed?count:count-1);i++){
      const a=spine[i],b=spine[(i+1)%count],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
      normals.push([-dy/len,dx/len]);
    }
    const out=[];
    const add=(p,n)=>{const q=[p[0]+n[0]*d,p[1]+n[1]*d],last=out[out.length-1];if(!last||Math.hypot(q[0]-last[0],q[1]-last[1])>1e-10)out.push(q);};
    for(let i=0;i<count;i++){
      const p=spine[i];
      if(!closed&&(i===0||i===count-1)){add(p,normals[i===0?0:normals.length-1]);continue;}
      const a=normals[(i-1+normals.length)%normals.length],b=normals[i%normals.length];
      const den=1+a[0]*b[0]+a[1]*b[1];
      const mitre=den>1e-9?[(a[0]+b[0])/den,(a[1]+b[1])/den]:null;
      // Inside joins must meet at the mitre in the non-crossing layout:
      // beveling both sides would loop back across the incoming stroke.
      const inside=safe&&d*(a[0]*b[1]-a[1]*b[0])>0;
      if(mitre&&(inside||join!=="Bevel"&&Math.hypot(...mitre)<=limit))add(p,mitre);
      else{add(p,a);add(p,b);}
    }
    return out;
  },
  // The padded strip is a chain of convex quads. Non-adjacent quads must
  // be disjoint; adjacent ones share only their transverse join edge.
  _clearStrip(spine,radius) {
    // Reserve each corner's full tangent reach on both adjoining spans.
    // Opposite turns can cancel in a sharp envelope but still let a bevel
    // run past the next inside join; absolute reaches prevent that fold-back.
    const reach=spine.map((p,i)=>{
      if(i===0||i===spine.length-1)return 0;
      const a=spine[i-1],b=spine[i+1],ux=p[0]-a[0],uy=p[1]-a[1],vx=b[0]-p[0],vy=b[1]-p[1];
      const dot=Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy))));
      return radius*Math.sqrt((1-dot)/Math.max(1e-12,1+dot));
    });
    for(let i=1;i<spine.length;i++)if(Math.hypot(spine[i][0]-spine[i-1][0],spine[i][1]-spine[i-1][1])<=reach[i-1]+reach[i]+1e-7)return false;
    const left=this._offset(spine,radius,false,"Sharp",1e9);
    const right=this._offset(spine,-radius,false,"Sharp",1e9);
    const quads=[];
    for(let i=0;i<spine.length-1;i++){
      const q=[left[i],right[i],right[i+1],left[i+1]];
      for(let k=0;k<4;k++){
        const a=q[k],b=q[(k+1)%4],c=q[(k+2)%4];
        if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<=1e-7)return false;
      }
      quads.push(q);
    }
    const separate=(a,b)=>{
      for(const poly of [a,b])for(let k=0;k<4;k++){
        const v=poly[k],w=poly[(k+1)%4],nx=v[1]-w[1],ny=w[0]-v[0];
        let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
        for(const p of a){const t=p[0]*nx+p[1]*ny;amin=Math.min(amin,t);amax=Math.max(amax,t);}
        for(const p of b){const t=p[0]*nx+p[1]*ny;bmin=Math.min(bmin,t);bmax=Math.max(bmax,t);}
        if(amax<bmin-1e-7||bmax<amin-1e-7)return true;
      }
      return false;
    };
    // Only the final two quads change when a point is appended. The prefix
    // was accepted on the previous iteration, so do not recheck its pairs.
    for(let i=Math.max(0,quads.length-2);i<quads.length;i++)for(let j=0;j<i-1;j++){
      if(!separate(quads[i],quads[j]))return false;
    }
    return true;
  },
  _clearRoute(aw,ah,width,gap,turns,rng) {
    const radius=(width+gap)/2,point=()=>[(rng()-0.5)*aw*0.9,(rng()-0.5)*ah*0.9];
    let best=[[-aw*0.4,0],[aw*0.4,0]],bestScore=0;
    const minLength=Math.min(aw,ah)*0.16,maxLength=Math.min(aw,ah)*0.55;
    for(let trial=0;trial<12;trial++){
      const start=point(),side=Math.floor(rng()*4);
      // Start at an edge and seek open space, rather than trapping both ends
      // near the middle of an inward coil.
      start[side%2]=(side<2?-1:1)*(side%2?ah:aw)*0.44;
      const route=[start];let length=0,heading=0,lastTurn=0,sameTurns=0;
      for(let step=0;step<turns+1;step++){
        const a=route[route.length-1],prev=route[route.length-2];let chosen=null,score=-Infinity;
        for(let attempt=0;attempt<80;attempt++){
          const b=point(),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
          if(len<Math.max(1e-5,minLength)||len>maxLength)continue;
          let angle=0,turn=0;
          if(prev){
            const px=a[0]-prev[0],py=a[1]-prev[1],dot=(px*dx+py*dy)/(Math.hypot(px,py)*len);
            if(dot< -0.8||dot>0.92)continue;
            angle=Math.atan2(px*dy-py*dx,px*dx+py*dy);turn=Math.sign(angle);
            // Keep the heading within an open fan. Limit repeated same-side
            // bends, but allow two in succession so it is not a rigid zigzag.
            if(Math.abs(heading+angle)>Math.PI*0.85||turn===lastTurn&&sameTurns>=2)continue;
          }
          if(!this._clearStrip([...route,b],radius))continue;
          let room=Math.min(aw,ah);
          for(let i=0;i<route.length-1;i++){
            const u=route[i],v=route[i+1],vx=v[0]-u[0],vy=v[1]-u[1];
            const t=Math.max(0,Math.min(1,((b[0]-u[0])*vx+(b[1]-u[1])*vy)/(vx*vx+vy*vy)));
            room=Math.min(room,Math.hypot(b[0]-u[0]-t*vx,b[1]-u[1]-t*vy));
          }
          const rank=room/Math.min(aw,ah)+(turn&&turn!==lastTurn?0.6:0)+rng()*0.45;
          if(rank>score){chosen={b,len,angle,turn};score=rank;}
        }
        if(!chosen)break;
        route.push(chosen.b);length+=chosen.len;heading+=chosen.angle;
        sameTurns=chosen.turn===lastTurn?sameTurns+1:1;lastTurn=chosen.turn;
      }
      const score=route.length+length/(100*(aw+ah));
      if(route.length>=2&&score>bestScore){best=route;bestScore=score;}
      if(best.length===turns+2)break;
    }
    return best;
  },
  _angular(p,ctx) {
    const num=(v,d,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));
    const W=num(ctx.W,210,1,10000),H=num(ctx.H,297,1,10000),m=num(p.margin,12,0,Math.min(W,H)/2);
    const aw=W-2*m,ah=H-2*m;
    if(aw<=0||ah<=0)return EMPTY;
    const turns=Math.round(num(p.turns,9,1,80)),width=num(p.width,28,0.1,400);
    const limit=num(p.miterLimit,3,1,8),palette=this._pens(p),rng=mulberry32(num(p.seed,27,-1e9,1e9)*7919+317);
    const safe=p.angularLayout==="No crossings";
    const spine=[];let closed=false;
    if(safe){
      spine.push(...this._clearRoute(aw,ah,width,num(p.clearance,6,0,200),turns,rng));
    }else if(p.angularLayout==="Star"){
      const n=2*Math.round((num(p.starPoints,7,5,41)-1)/2)+1,skip=(n-1)/2;
      const r=Math.min(aw,ah)*0.45;
      for(let i=0;i<n;i++){const a=-Math.PI/2+i*skip*2*Math.PI/n;spine.push([Math.cos(a)*r,Math.sin(a)*r]);}
      closed=true;
    }else if(p.angularLayout==="Zigzag"){
      for(let i=0;i<turns+2;i++)spine.push([(i%2?1:-1)*aw*0.4,(i/(turns+1)-0.5)*ah*0.9]);
    }else{
      const point=()=>[(rng()-0.5)*aw*0.9,(rng()-0.5)*ah*0.9];
      spine.push(point());
      for(let i=0;i<turns+1;i++){
        const a=spine[spine.length-1],prev=spine[spine.length-2];let best=null,score=-Infinity;
        for(let attempt=0;attempt<64;attempt++){
          const b=point(),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
          if(len<1e-6)continue;
          let dot=0;
          if(prev){const px=a[0]-prev[0],py=a[1]-prev[1];dot=(px*dx+py*dy)/(Math.hypot(px,py)*len);}
          const valid=(!prev||dot>-0.85&&dot<0.85)&&len>Math.min(aw,ah)*0.32;
          const rank=(valid?10000:0)+len-Math.max(0,Math.abs(dot)-0.85)*1000;
          if(rank>score){best=b;score=rank;}
          if(valid)break;
        }
        if(best)spine.push(best);
      }
    }
    const angle=num(p.rotate,0,-36000,36000)*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle);
    const rotated=spine.map(([x,y])=>[x*ca-y*sa,x*sa+y*ca]);
    if(rotated.length<2)return EMPTY;
    // Reserve the two outer rails for fitting, even in the one-line case.
    const rails=[this._offset(rotated,-width/2,closed,p.join,limit,safe),this._offset(rotated,width/2,closed,p.join,limit,safe)];
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const pts of rails)for(const [x,y] of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    const scale=Math.min(1,aw/Math.max(1e-9,x1-x0),ah/Math.max(1e-9,y1-y0)),cx=(x0+x1)/2,cy=(y0+y1)/2;
    const paths=[],maxTracks=Math.max(1,Math.min(2048,Math.floor(110000/(rotated.length*2))));
    const emit=(d,layer)=>{
      const pts=this._offset(rotated,d,closed,p.join,limit,safe).map(([x,y])=>[W/2+(x-cx)*scale,H/2+(y-cy)*scale]);
      if(pts.length>=2)paths.push({pts,closed,layer});
    };
    if(p.angularFill==="Lines"){
      const count=Math.round(num(p.lines,24,1,Math.min(400,maxTracks)));
      for(let k=0;k<count;k++)emit(count===1?0:(k/(count-1)-0.5)*width,palette[Math.min(palette.length-1,Math.floor(k*palette.length/count))]);
    }else{
      const bandWidth=width/palette.length,gap=num(p.stripeGap,0.4,0,bandWidth*0.9);
      const perBand=Math.max(2,Math.floor(maxTracks/palette.length));
      const pitch=Math.max(num(p.pitch,0.35,0.1,20),bandWidth/(perBand-1));
      for(let band=0;band<palette.length;band++){
        const start=-width/2+band*bandWidth+(band?gap/2:0),end=-width/2+(band+1)*bandWidth-(band<palette.length-1?gap/2:0);
        const n=Math.max(1,Math.ceil((end-start)/pitch));
        for(let j=0;j<=n;j++){
          // Adjacent zero-gap bands share an edge: assign it once, to the latter.
          if(j===n&&band<palette.length-1&&gap===0)continue;
          emit(start+(end-start)*j/n,palette[band]);
        }
      }
    }
    return {paths};
  },
  compute(ins, p, ctx) {
    if (p.shape === "Angular") return applyStyle(this._angular(p, ctx), ins[0]);
    const { W, H } = ctx;
    const K = Math.round(p.lines);
    const L = Math.round(p.layer);
    const paths = [];
    const palette = this._pens(p);
    const penAt = k => palette.length === 1 ? L : palette[Math.min(palette.length - 1, Math.floor(k * palette.length / K))];

    if (p.shape === "Ring") {
      /* ---- suljettu lenkki: periodinen kohina, ei saumaa ---- */
      const cx = W / 2, cy = H / 2;
      const Rmax = Math.min(W, H) / 2 - p.margin;
      const R = Math.max(2, Rmax * (Math.max(1, p.ringR) / 100));
      const N = 240;
      const TAU = Math.PI * 2;
      const radiusAt = (a) => {
        const v = noise2(Math.cos(a) * 2 * p.wscale + 7.7, Math.sin(a) * 2 * p.wscale + 3.3, p.seed);
        let r = R + (v - 0.5) * 2 * p.wander;
        return Math.max(1, Math.min(Math.min(W, H) / 2 - p.margin, r));
      };
      const widthAt = (a) => {
        const v = noise2(Math.cos(a) * 2.5 * p.wscale + 40, Math.sin(a) * 2.5 * p.wscale + 8.8, p.seed + 9);
        const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
        return Math.max(0.3, w);
      };
      const bb = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        const r = radiusAt(a);
        bb.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      /* normaalit: sykliset keskeisdifferenssit */
      const normals = bb.map((pt, i) => {
        const nI = (i + 1) % N, pI = (i - 1 + N) % N;
        const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        return [-ty / tl, tx / tl];
      });
      for (let k = 0; k < K; k++) {
        const f = K === 1 ? 0 : k / (K - 1) - 0.5;
        const pts = bb.map((pt, i) => {
          const w = widthAt((i / N) * TAU);
          return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
        });
        paths.push({ pts, closed: true, layer: penAt(k) });
      }
      return applyStyle({ paths }, ins[0]);
    }

    /* ---- Line: byte-identical to the baked ribbon ---- */
    const N = 160;
    const bb = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = p.margin + (W - 2 * p.margin) * t;
      const y = H / 2 + (noise2(t * 4 * p.wscale, 3.3, p.seed) - 0.5) * 2 * p.wander;
      bb.push([x, Math.max(p.margin, Math.min(H - p.margin, y))]);
    }
    const widthAt = (t) => {
      const v = noise2(t * 5 * p.wscale + 40, 8.8, p.seed + 9);
      const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
      return Math.max(0.3, w);
    };
    const normals = bb.map((pt, i) => {
      const nI = Math.min(i + 1, bb.length - 1), pI = Math.max(i - 1, 0);
      const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
      const tl = Math.hypot(tx, ty) || 1;
      return [-ty / tl, tx / tl];
    });
    for (let k = 0; k < K; k++) {
      const f = K === 1 ? 0 : k / (K - 1) - 0.5;
      const pts = bb.map((pt, i) => {
        const w = widthAt(i / N);
        return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
      });
      paths.push({ pts, closed: false, layer: penAt(k) });
    }
    return applyStyle({ paths }, ins[0]);
  },
};
