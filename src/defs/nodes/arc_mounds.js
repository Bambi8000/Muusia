import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "arc_mounds",
  name: "Arc Mounds",
  cat: "gen",
  group: "organic",
  desc: "A field of rounded, overlapping mounds drawn entirely with curved pen strokes. The arcs wrap around each mound like ribs on a shell. Foreground mounds hide the lines behind them without plotting a solid fill. Field covers the page; Single isolates one form. Mound width sets the scale, Fullness changes the plumpness, Overlap packs the rows, and Variation breaks up their rhythm. Size contrast mixes small and large bodies; Body curves and Curve scale add soft asymmetry, fuller lobes and narrower waists. Arc pitch sets the spacing across the facing part of each mound; the lines curve closer together at the ends. Arc flow turns the rib pattern, Tilt varies the mound angles, and Seed rebuilds the composition. Silhouette adds the visible outside rims. One to six pens colour whole mounds while preserving geometry. Everything is clipped to Margin. Very dense settings coarsen the arcs evenly to respect the point budget.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "layout", label: "Layout", type: "select", options: ["Field", "Single"], def: "Field" },
    { key: "size", label: "Mound width mm", type: "slider", min: 30, max: 350, step: 1, def: 145 },
    { key: "fullness", label: "Fullness", type: "slider", min: 0.25, max: 1.3, step: 0.05, def: 0.7 },
    { key: "overlap", label: "Overlap", type: "slider", min: 0.1, max: 0.8, step: 0.05, def: 0.5, showIf: p => p.layout !== "Single" },
    { key: "variation", label: "Variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    { key: "sizeContrast", label: "Size contrast", type: "slider", min: 0, max: 1, step: 0.05, def: 0.85 },
    { key: "bodyCurves", label: "Body curves", type: "slider", min: 0, max: 1, step: 0.05, def: 0.75 },
    { key: "curveScale", label: "Curve scale mm", type: "slider", min: 60, max: 400, step: 1, def: 180, showIf: p => p.bodyCurves > 0 },
    { key: "pitch", label: "Arc pitch mm", type: "slider", min: 0.6, max: 6, step: 0.1, def: 2 },
    { key: "flow", label: "Arc flow °", type: "slider", min: 5, max: 80, step: 1, def: 42 },
    { key: "tilt", label: "Tilt °", type: "slider", min: 0, max: 60, step: 1, def: 24 },
    { key: "outline", label: "Silhouette", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 50, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 17 },
    { key: "colours", label: "Colours", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "pen2", label: "Pen 2", type: "pen", def: 5, showIf: p => p.colours >= 2 },
    { key: "pen3", label: "Pen 3", type: "pen", def: 7, showIf: p => p.colours >= 3 },
    { key: "pen4", label: "Pen 4", type: "pen", def: 6, showIf: p => p.colours >= 4 },
    { key: "pen5", label: "Pen 5", type: "pen", def: 3, showIf: p => p.colours >= 5 },
    { key: "pen6", label: "Pen 6", type: "pen", def: 9, showIf: p => p.colours >= 6 },
  ],
  _num(v,d,lo,hi) { return Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d)); },
  _region(p,ctx) {
    const W=this._num(ctx.W,210,1,10000),H=this._num(ctx.H,297,1,10000),m=this._num(p.margin,10,0,Math.min(W,H)/2);
    return {W,H,m,x0:m,y0:m,x1:W-m,y1:H-m};
  },
  overlay(p,ctx) {
    const r=this._region(p,ctx);return [{kind:"rect",x:r.x0,y:r.y0,w:r.x1-r.x0,h:r.y1-r.y0}];
  },
  _bodies(p,r) {
    const rng=mulberry32(this._num(p.seed,17,-1e9,1e9)*7919+431),bodies=[];
    const full=this._num(p.fullness,0.7,0.2,1.5),variation=this._num(p.variation,0.4,0,1);
    const overlap=this._num(p.overlap,0.5,0.05,0.85),tilt=this._num(p.tilt,24,0,80)*Math.PI/180;
    const contrast=this._num(p.sizeContrast,0.85,0,1);
    let size=this._num(p.size,145,10,1200);
    const add=(cx,cy,w,index,single=false)=>{
      let rx=w/2,ry=rx*full*(1+(rng()-0.5)*variation*0.5);
      const a=single?tilt:(rng()-0.5)*2*tilt,c=Math.cos(a),s=Math.sin(a);
      if(single){const scale=Math.min(1,(r.x1-r.x0)/(2*Math.hypot(rx*c,ry*s)),(r.y1-r.y0)/(2*Math.hypot(rx*s,ry*c)));rx*=scale;ry*=scale;}
      const flow=this._num(p.flow,42,5,80)+(single?0:(rng()-0.5)*variation*36);
      const ex=Math.hypot(rx*c,ry*s),ey=Math.hypot(rx*s,ry*c);
      if(cx+ex<r.x0||cx-ex>r.x1||cy+ey<r.y0||cy-ey>r.y1)return;
      bodies.push({cx,cy,rx,ry,c,s,flow:Math.max(5,Math.min(80,flow))*Math.PI/180,index,box:[cx-ex,cy-ey,cx+ex,cy+ey]});
    };
    if(p.layout==="Single"){add(r.W/2,r.H/2,size,0,true);return bodies;}
    // Increase the physical scale on extreme inputs instead of dropping a
    // corner of the composition when the body count grows too large.
    for(let i=0;i<12;i++){
      const cols=Math.ceil((r.x1-r.x0)/(size*0.82))+4,rows=Math.ceil((r.y1-r.y0)/(size*full*(1-overlap)))+4;
      if(cols*rows<=160)break;size*=1.3;
    }
    const dx=size*0.82,dy=size*full*(1-overlap),cols=Math.ceil((r.x1-r.x0)/dx)+2,rows=Math.ceil((r.y1-r.y0)/dy)+2;
    let index=0;
    for(let row=-1;row<=rows;row++)for(let col=-1;col<=cols;col++){
      const cx=r.x0+(col+(row%2?0.5:0))*dx+(rng()-0.5)*dx*0.5*variation;
      const cy=r.y0+row*dy+(rng()-0.5)*dy*0.5*variation;
      add(cx,cy,size*Math.exp((rng()-0.5)*2.6*contrast),index++);
    }
    return bodies;
  },
  _point(b,x,y) {return [b.cx+b.c*x-b.s*y,b.cy+b.s*x+b.c*y];},
  // Exact segment/ellipse interval in the body's local coordinates.
  _insideInterval(a,z,b) {
    const ax=((a[0]-b.cx)*b.c+(a[1]-b.cy)*b.s)/b.rx,ay=(-(a[0]-b.cx)*b.s+(a[1]-b.cy)*b.c)/b.ry;
    const dx=((z[0]-a[0])*b.c+(z[1]-a[1])*b.s)/b.rx,dy=(-(z[0]-a[0])*b.s+(z[1]-a[1])*b.c)/b.ry;
    const A=dx*dx+dy*dy,B=2*(ax*dx+ay*dy),C=ax*ax+ay*ay-1;
    if(A<1e-20)return C<0?[0,1]:null;
    const D=B*B-4*A*C;if(D<=0)return null;
    const root=Math.sqrt(D),lo=Math.max(0,(-B-root)/(2*A)),hi=Math.min(1,(-B+root)/(2*A));
    return hi>lo+1e-10?[lo,hi]:null;
  },
  _clip(pts,closed,blockers,r) {
    const paths=[];let run=[];
    const near=(a,b)=>a&&b&&Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7;
    const flush=()=>{if(run.length>=2)paths.push(run);run=[];};
    for(let i=0;i<pts.length-(closed?0:1);i++){
      const a=pts[i],b=pts[(i+1)%pts.length],dx=b[0]-a[0],dy=b[1]-a[1];
      let lo=0,hi=1,valid=true;
      for(const [v,d,min,max] of [[a[0],dx,r.x0,r.x1],[a[1],dy,r.y0,r.y1]]){
        if(Math.abs(d)<1e-15){if(v<min||v>max)valid=false;}
        else{let t0=(min-v)/d,t1=(max-v)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
      }
      if(!valid||hi-lo<1e-10){flush();continue;}
      const cuts=[];
      for(const o of blockers){
        if(Math.max(a[0],b[0])<o.box[0]||Math.min(a[0],b[0])>o.box[2]||Math.max(a[1],b[1])<o.box[1]||Math.min(a[1],b[1])>o.box[3])continue;
        const iv=this._insideInterval(a,b,o);if(iv&&iv[1]>lo&&iv[0]<hi)cuts.push([Math.max(lo,iv[0]),Math.min(hi,iv[1])]);
      }
      cuts.sort((a,b)=>a[0]-b[0]);let cursor=lo;
      const emit=(start,end)=>{
        if(end-start<1e-10)return;
        const p=[a[0]+dx*start,a[1]+dy*start],q=[a[0]+dx*end,a[1]+dy*end];
        if(!near(run[run.length-1],p)){flush();run.push(p);}if(!near(run[run.length-1],q))run.push(q);
      };
      for(const [start,end] of cuts){if(start>cursor)emit(cursor,start);flush();cursor=Math.max(cursor,end);}
      if(cursor<hi)emit(cursor,hi);if(hi<1-1e-10)flush();
    }
    flush();
    if(closed&&paths.length>1&&near(paths[paths.length-1].at(-1),paths[0][0])){
      const tail=paths.pop();paths[0]=tail.concat(paths[0].slice(1));
    }
    return paths.map(pts=>{const loop=near(pts[0],pts.at(-1));if(loop)pts.pop();return {pts,closed:loop};}).filter(p=>p.pts.length>=2);
  },
  _draw(p,r,bodies,pitch,step) {
    const paths=[];let points=0;
    const n=Math.round(this._num(p.colours,1,1,6)),pens=[p.layer,p.pen2,p.pen3,p.pen4,p.pen5,p.pen6].slice(0,n).map((v,i)=>Math.round(this._num(v,[0,5,7,6,3,9][i],0,11)));
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i],blockers=bodies.slice(i+1).filter(o=>o.box[0]<=b.box[2]&&o.box[2]>=b.box[0]&&o.box[1]<=b.box[3]&&o.box[3]>=b.box[1]);
      const push=(pts,closed)=>{for(const path of this._clip(pts,closed,blockers,r)){paths.push({...path,layer:pens[b.index%n]});points+=path.pts.length;}};
      const sy=Math.sin(b.flow),cy=Math.cos(b.flow),count=Math.max(4,Math.min(240,Math.ceil((1+cy)*b.rx/pitch)));
      for(let j=1;j<count;j++){
        // Even projected spacing on the facing equator avoids a black rim
        // caused by uniformly spaced sphere slices crowding at the silhouette.
        const x=-cy+(1+cy)*j/count,u=x*cy-Math.sqrt(Math.max(0,1-x*x))*sy;
        const v=Math.sqrt(Math.max(0,1-u*u)),q=u*sy/(v*cy);
        if(q>=1)continue;
        const closed=q<=-1,angle=closed?Math.PI:Math.acos(q),segments=Math.max(12,Math.min(240,Math.ceil(2*angle*Math.max(b.rx,b.ry)*v/step)));
        const pts=[];
        for(let k=0;k<=segments-(closed?1:0);k++){
          const t=-angle+2*angle*k/segments;
          pts.push(this._point(b,b.rx*(u*cy+v*Math.cos(t)*sy),b.ry*v*Math.sin(t)));
        }
        push(pts,closed);
      }
      if(p.outline!==false){
        const count=Math.max(32,Math.min(320,Math.ceil(2*Math.PI*Math.max(b.rx,b.ry)/step)));
        push(Array.from({length:count},(_,k)=>this._point(b,b.rx*Math.cos(k*2*Math.PI/count),b.ry*Math.sin(k*2*Math.PI/count))),true);
      }
      if(points>110000)return {paths,points,overflow:true};
    }
    return {paths,points,overflow:false};
  },
  _warp(paths,p,r) {
    const amount=this._num(p.bodyCurves,0.75,0,1);if(amount===0)return paths;
    const W=r.x1-r.x0,H=r.y1-r.y0,size=this._num(p.size,145,10,1200);
    const scale=this._num(p.curveScale,180,30,1200),seed=this._num(p.seed,17,-1e9,1e9);
    const phase=(seed*0.754877666)%6.283185307,ax=Math.min(W*0.24,size*0.32)*amount,ay=Math.min(H*0.2,size*0.22)*amount;
    // Two smooth boundary-pinned shears. Each stage is strictly monotone
    // along its own axis (amplitude < extent/pi), so it cannot fold the
    // surface or invalidate the hidden-line ordering calculated beforehand.
    return paths.map(path=>({...path,pts:path.pts.map(([x,y])=>{
      const u=(x-r.x0)/W,v=(y-r.y0)/H;
      const xx=x+ax*Math.sin(Math.PI*u)*Math.sin((y-r.y0)*2*Math.PI/scale+phase);
      const yy=y+ay*Math.sin(Math.PI*v)*Math.sin((xx-r.x0)*2*Math.PI/(scale*1.2)+phase*1.73);
      return [xx,yy];
    })}));
  },
  compute(ins,p,ctx) {
    const r=this._region(p,ctx);if(r.x1-r.x0<1||r.y1-r.y0<1)return EMPTY;
    const bodies=this._bodies(p,r);let pitch=this._num(p.pitch,2,0.35,20),step=0.9,result;
    for(let attempt=0;attempt<12;attempt++){
      result=this._draw(p,r,bodies,pitch,step);
      if(!result.overflow)return applyStyle({paths:this._warp(result.paths,p,r)},ins[0]);
      pitch*=1.5;step*=1.2;
    }
    return EMPTY;
  },
};
