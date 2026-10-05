import { Pin, EMPTY, PENS, mulberry32, noise2, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "image",
    name: "Image", cat: "gen", group: "textimg", fileImage: true, imageMax: 640,
    desc: "Turn a photo or a wired drawing into real pen paths. Connect any blue Paths output to Drawing; Auto uses the connected drawing, otherwise the loaded image. Source can force Image (file) or Drawing (wired). Drawing stroke mm sets the width used to interpret source lines, not the output pen width. Fill closed shapes uses even-odd interiors per source pen, preserving nested holes. Open lines stay strokes. Drawing keeps its canvas position and is clipped to Margin; source pen colours supply the image colours. Empty wired drawings stay empty. Dense drawings reduce raster detail across the whole sheet. Organic dots turns tone into varied circles, with Outline, Spiral fill or Concentric rings. Short strokes follows image contours, a flow field or a fixed angle; Shadow passes adds ink in darker areas. Cross stitches makes a woven interpretation. Square weave converts tone into the area of staggered squares, with Outline, Hatch fill or alternating Woven fill. Set Jitter to 0 for regular rows; Square layout also offers an aligned Grid. These four modes support 1–6 selected pens: Source colours chooses the closest ink from your Pens palette, Tone bands assigns light-to-dark ranges (Main pen is lightest). Colours change pen assignments without changing geometry. Spacing, Strength, Gamma and White cutoff tune the image; Jitter loosens the rows. Fill / pen pitch should match your pen width. Very dense settings thin marks across the whole image to stay within the point budget. New images load at up to 640 px; reload an older photo for more detail. The five earlier render modes retain their original geometry and single-pen behavior. No image is uploaded to a server.",
    // Keep Style at port 0 so existing patches keep their connections.
    ins: [Pin("style", "Style"), Pin("paths", "Drawing")], outs: [Pin("paths")],
    params: [
      { key: "source", label: "Source", type: "select", options: ["Auto", "Image (file)", "Drawing (wired)"], def: "Auto" },
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "drawingWidth", label: "Drawing stroke mm", type: "slider", min: 0.2, max: 12, step: 0.1, def: 1.8, showIf: p => p.source !== "Image (file)" },
      { key: "drawingFill", label: "Fill closed shapes", type: "check", def: false, showIf: p => p.source !== "Image (file)" },
      { key: "mode", label: "Render", type: "select", options: ["Scanline wave", "Halftone dots", "Hatch levels", "Flow shade", "Contours (trace)", "Organic dots", "Short strokes", "Cross stitches", "Square weave"], def: "Scanline wave" },
      { key: "cell", label: "Cell / spacing mm", type: "slider", min: 0.8, max: 12, step: 0.1, def: 2.4 },
      { key: "strength", label: "Strength", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.8 },
      { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
      { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.06 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "levels", label: "Contour levels", type: "slider", min: 1, max: 6, step: 1, def: 3, showIf: p => p.mode === "Contours (trace)" },
      { key: "low", label: "Lowest threshold", type: "slider", min: 0.05, max: 0.9, step: 0.05, def: 0.25, showIf: p => p.mode === "Contours (trace)" },
      { key: "high", label: "Highest threshold", type: "slider", min: 0.1, max: 0.95, step: 0.05, def: 0.75, showIf: p => p.mode === "Contours (trace)" },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5, showIf: p => p.mode === "Contours (trace)" },
      { key: "dotfill", label: "Dot fill", type: "select", options: ["Spiral fill", "Outline", "Concentric rings"], def: "Spiral fill", showIf: p => p.mode === "Organic dots" },
      { key: "squarefill", label: "Square fill", type: "select", options: ["Hatch fill", "Outline", "Woven fill"], def: "Hatch fill", showIf: p => p.mode === "Square weave" },
      { key: "squarelayout", label: "Square layout", type: "select", options: ["Staggered", "Grid"], def: "Staggered", showIf: p => p.mode === "Square weave" },
      { key: "direction", label: "Stroke direction", type: "select", options: ["Image contours", "Flow field", "Fixed angle"], def: "Image contours", showIf: p => ["Short strokes", "Cross stitches"].includes(p.mode) },
      { key: "angle", label: "Base angle °", type: "slider", min: -180, max: 180, step: 1, def: 75, showIf: p => ["Short strokes", "Cross stitches"].includes(p.mode) },
      { key: "flow", label: "Follow / flow", type: "slider", min: 0, max: 1, step: 0.05, def: 0.75, showIf: p => ["Short strokes", "Cross stitches"].includes(p.mode) && p.direction !== "Fixed angle" },
      { key: "passes", label: "Shadow passes", type: "slider", min: 1, max: 4, step: 1, def: 3, showIf: p => ["Short strokes", "Cross stitches"].includes(p.mode) },
      { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 0.45, step: 0.05, def: 0.25, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) },
      { key: "pitch", label: "Fill / pen pitch mm", type: "slider", min: 0.15, max: 2, step: 0.05, def: 0.3, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) },
      { key: "colours", label: "Colours", type: "slider", min: 1, max: 6, step: 1, def: 1, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) },
      { key: "colourmap", label: "Colour mapping", type: "select", options: ["Source colours", "Tone bands"], def: "Source colours", showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) && p.colours > 1 },
      { key: "pen2", label: "Pen 2", type: "pen", def: 4, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) && p.colours >= 2 },
      { key: "pen3", label: "Pen 3", type: "pen", def: 6, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) && p.colours >= 3 },
      { key: "pen4", label: "Pen 4", type: "pen", def: 1, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) && p.colours >= 4 },
      { key: "pen5", label: "Pen 5", type: "pen", def: 5, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) && p.colours >= 5 },
      { key: "pen6", label: "Pen 6", type: "pen", def: 10, showIf: p => ["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode) && p.colours >= 6 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 139 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    _artNumber(v, fallback, lo, hi) {
      return Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : fallback));
    },
    _artFit(p, ctx, img) {
      const n = this._artNumber;
      const W = n(ctx.W, 297, 0, 100000), H = n(ctx.H, 210, 0, 100000);
      const m = n(p.margin, 12, 0, Math.min(W, H) / 2);
      if (!img || !Number.isInteger(img.w) || !Number.isInteger(img.h) || img.w < 1 || img.h < 1 || img.w * img.h > 2560000 || !img.g || img.g.length !== img.w * img.h || W - 2*m < 1 || H - 2*m < 1) return null;
      const sc = Math.min((W - 2*m) / img.w, (H - 2*m) / img.h);
      return { W, H, m, sc, w: img.w*sc, h: img.h*sc, x: (W-img.w*sc)/2, y: (H-img.h*sc)/2 };
    },
    _usesDrawing(p, ins) {
      return p.source === "Drawing (wired)" || (p.source !== "Image (file)" && ins?.[1] != null);
    },
    _drawingFrame(p, ctx, resolution=640) {
      const n=this._artNumber, W=n(ctx.W,297,0,100000), H=n(ctx.H,210,0,100000);
      const m=n(p.margin,12,0,Math.min(W,H)/2), w=W-2*m,h=H-2*m;
      if(w<1 || h<1)return null;
      const scale=resolution/Math.max(w,h);
      const dims={w:Math.max(1,Math.round(w*scale)),h:Math.max(1,Math.round(h*scale))};
      return { ...dims, fit:this._artFit({...p,margin:m},ctx,{...dims,g:{length:dims.w*dims.h}}) };
    },
    _drawingImage(p,ctx,src,frameOnly=false) {
      if(!src?.paths?.length)return null;
      const n=this._artNumber, initial=this._drawingFrame(p,ctx);
      if(!initial)return null;
      const width=n(p.drawingWidth,1.8,0.1,30), segments=[],polys=[];
      const {fit:f}=initial;
      // Clip before raster work: huge off-page coordinates must not expand loops.
      const clip=(a,b)=>{
        let t0=0,t1=1;const dx=b[0]-a[0],dy=b[1]-a[1];
        if(!Number.isFinite(dx)||!Number.isFinite(dy))return null;
        for(const [v,q] of [[-dx,a[0]-f.x+width],[dx,f.x+f.w+width-a[0]],[-dy,a[1]-f.y+width],[dy,f.y+f.h+width-a[1]]]){
          if(Math.abs(v)<1e-12){if(q<0)return null;}
          else{const t=q/v;if(v<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);if(t0>t1)return null;}
        }
        return [[a[0]+dx*t0,a[1]+dy*t0],[a[0]+dx*t1,a[1]+dy*t1]];
      };
      let length=0;
      for(const path of src.paths){
        if(!Array.isArray(path?.pts)||path.pts.length<2)continue;
        const pts=path.pts,valid=pt=>Array.isArray(pt)&&Number.isFinite(pt[0])&&Number.isFinite(pt[1]);
        const layer=Math.round(n(path.layer,0,0,11));
        if(p.drawingFill && path.closed && pts.length>=3 && pts.every(valid))polys.push({pts,layer});
        const count=pts.length-(path.closed?0:1);
        for(let i=0;i<count;i++){
          const a=pts[i],b=pts[(i+1)%pts.length];if(!valid(a)||!valid(b))continue;
          const s=clip(a,b);if(!s)continue;
          segments.push({a:s[0],b:s[1],layer});length+=Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1]);
        }
      }
      if(!segments.length&&!polys.length)return null;
      // Keep dense source drawings responsive by reducing the entire raster,
      // never dropping the final paths or one side of the composition.
      const estimate=(length*width+segments.length*width*width)*640*640/Math.max(f.w*f.h,1);
      const resolution=Math.max(96,Math.min(640,Math.floor(640*Math.sqrt(6000000/Math.max(estimate,1)))));
      const {w,h,fit}=this._drawingFrame(p,ctx,resolution), size=w*h;
      if(frameOnly)return {w,h,fit};
      const layers=new Map(), field=layer=>{if(!layers.has(layer))layers.set(layer,new Float32Array(size));return layers.get(layer);};
      const px=x=>(x-fit.x)/fit.sc,py=y=>(y-fit.y)/fit.sc;
      if(p.drawingFill){
        // Even-odd interiors per source pen preserve nested holes, independent
        // of winding. Open paths remain strokes; pen-up travel is never drawn.
        const rows=new Map();
        for(const {pts,layer} of polys){
          if(!rows.has(layer))rows.set(layer,Array.from({length:h},()=>[]));
          const scan=rows.get(layer);
          for(let i=0;i<pts.length;i++){
            const a=pts[i],b=pts[(i+1)%pts.length];if(a[1]===b[1])continue;
            const lo=Math.max(0,Math.ceil(py(Math.min(a[1],b[1]))-0.5)),hi=Math.min(h-1,Math.ceil(py(Math.max(a[1],b[1]))-0.5)-1);
            for(let y=lo;y<=hi;y++){
              const yy=fit.y+(y+0.5)*fit.sc,t=(yy-a[1])/(b[1]-a[1]);
              const x=px(a[0]*(1-t)+b[0]*t);if(Number.isFinite(x))scan[y].push(x);
            }
          }
        }
        for(const [layer,scan]of rows){const cov=field(layer);
          for(let y=0;y<h;y++){
            const xs=scan[y].sort((a,b)=>a-b);
            for(let i=0;i+1<xs.length;i+=2){
              const lo=Math.max(0,Math.floor(xs[i])),hi=Math.min(w-1,Math.ceil(xs[i+1])-1);
              for(let x=lo;x<=hi;x++)cov[y*w+x]=Math.max(cov[y*w+x],Math.min(x+1,xs[i+1])-Math.max(x,xs[i]));
            }
          }
        }
      }
      const radius=width/(2*fit.sc),reach=radius+0.5;
      for(const {a,b,layer}of segments){
        const ax=px(a[0]),ay=py(a[1]),bx=px(b[0]),by=py(b[1]),dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy,cov=field(layer);
        const lo=Math.max(0,Math.ceil(Math.min(ay,by)-reach-0.5)),hi=Math.min(h-1,Math.floor(Math.max(ay,by)+reach-0.5));
        for(let y=lo;y<=hi;y++){
          const cy=y+0.5;
          let t0=0,t1=1;
          if(Math.abs(dy)>1e-12){const u=(cy-reach-ay)/dy,v=(cy+reach-ay)/dy;t0=Math.max(0,Math.min(u,v));t1=Math.min(1,Math.max(u,v));if(t0>t1)continue;}
          const x0=ax+dx*t0,x1=ax+dx*t1;
          const left=Math.max(0,Math.ceil(Math.min(x0,x1)-reach-0.5)),right=Math.min(w-1,Math.floor(Math.max(x0,x1)+reach-0.5));
          for(let x=left;x<=right;x++){
            const cx=x+0.5,t=len2>1e-18?Math.max(0,Math.min(1,((cx-ax)*dx+(cy-ay)*dy)/len2)):0;
            const coverage=Math.max(0,Math.min(1,reach-Math.hypot(cx-ax-dx*t,cy-ay-dy*t)));
            const k=y*w+x;cov[k]=Math.max(cov[k],coverage);
          }
        }
      }
      const rgb=new Float32Array(size*3).fill(255),g=new Float32Array(size);
      for(const [layer,cov]of [...layers].sort((a,b)=>a[0]-b[0])){
        const colour=[1,3,5].map(k=>parseInt(PENS[layer].c.slice(k,k+2),16));
        for(let i=0;i<size;i++)if(cov[i])for(let k=0;k<3;k++)rgb[i*3+k]=rgb[i*3+k]*(1-cov[i])+colour[k]*cov[i];
      }
      for(let i=0;i<size;i++)g[i]=1-(0.299*rgb[i*3]+0.587*rgb[i*3+1]+0.114*rgb[i*3+2])/255;
      return {w,h,g,rgb};
    },
    overlay(p, ctx, ins, node) {
      const fit = this._usesDrawing(p,ins) ? this._drawingImage(p,ctx,ins?.[1],true)?.fit : this._artFit(p, ctx, node?.data?.img);
      return fit ? [{ kind: "rect", x: fit.x, y: fit.y, w: fit.w, h: fit.h }] : [];
    },
    _artSampler(img, fit) {
      const rgb = img.rgb?.length === img.w * img.h * 3;
      const sample = (x, y, channel = -1) => {
        const u = Math.max(0, Math.min(img.w-1, (x-fit.x)/fit.sc-0.5));
        const v = Math.max(0, Math.min(img.h-1, (y-fit.y)/fit.sc-0.5));
        const ix=Math.floor(u), iy=Math.floor(v), fx=u-ix, fy=v-iy;
        const at=(a,b)=>{
          const k=Math.min(img.h-1,b)*img.w+Math.min(img.w-1,a);
          const value=channel<0 ? img.g[k] : rgb ? img.rgb[k*3+channel]/255 : 1-img.g[k];
          return Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : channel<0 ? 0 : 1;
        };
        return at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy;
      };
      return { sample, rgb: Boolean(rgb) };
    },
    _artCompute(ins, p, ctx, img) {
      const fit=this._artFit(p,ctx,img);
      if(!fit)return EMPTY;
      const n=this._artNumber, {sample,rgb}=this._artSampler(img,fit);
      const seed=Math.round(n(p.seed,139,-2147483648,2147483647));
      const rng=mulberry32(seed*5479+101);
      const cell=n(p.cell,2.4,0.4,30), strength=n(p.strength,0.8,0.1,1);
      const gamma=n(p.gamma,1,0.3,3), cutoff=n(p.cutoff,0.06,0,0.98);
      const jitter=n(p.jitter,0.25,0,0.45), pitch=n(p.pitch,0.3,0.15,2);
      const colours=Math.round(n(p.colours,1,1,6));
      const pens=[['layer',0],['pen2',4],['pen3',6],['pen4',1],['pen5',5],['pen6',10]].slice(0,colours).map(([key,def])=>Math.round(n(p[key],def,0,11)));
      const palette=pens.map(i=>{const hex=PENS[i].c;return [1,3,5].map(k=>parseInt(hex.slice(k,k+2),16)/255);});
      const tone=(x,y)=>Math.pow(p.invert ? 1-sample(x,y) : sample(x,y),gamma);
      const ink=(x,y,d)=>{
        if(colours===1)return pens[0];
        if(p.colourmap!=='Source colours' || !rgb)return pens[Math.min(colours-1,Math.floor(d*colours))];
        const c=[0,1,2].map(k=>sample(x,y,k));
        let best=0,dist=Infinity;
        palette.forEach((q,i)=>{const e=0.299*(c[0]-q[0])**2+0.587*(c[1]-q[1])**2+0.114*(c[2]-q[2])**2;if(e<dist){dist=e;best=i;}});
        return pens[best];
      };
      const dots=p.mode==='Organic dots', cross=p.mode==='Cross stitches', squares=p.mode==='Square weave';
      // Cap candidate work across the WHOLE fitted image, never stop at a row.
      const step=Math.max(cell,Math.sqrt(fit.w*fit.h/14000));
      const dy=squares ? step : step*Math.sqrt(3)/2, marks=[];
      for(let row=0,y=fit.y+dy/2;y<fit.y+fit.h;y+=dy,row++) {
        const stagger=!(squares && p.squarelayout==='Grid');
        for(let col=0,x=fit.x+step*(stagger && row%2?1:0.5);x<fit.x+fit.w;x+=step,col++) {
          const xx=x+(rng()-0.5)*step*jitter, yy=y+(rng()-0.5)*dy*jitter;
          const d=tone(xx,yy), variation=0.8+0.2*rng();
          if(d<=cutoff)continue;
          const edge=Math.min(xx-fit.x,fit.x+fit.w-xx,yy-fit.y,fit.y+fit.h-yy);
          // Keep each mark inside the image; neighbour spacing is resolved below.
          const r=Math.min(edge,cell*0.46*strength*Math.sqrt(d)*(squares?1:variation),step*0.49);
          if(r<0.055)continue;
          marks.push({x:xx,y:yy,d,r,row,col,layer:ink(xx,yy,d),index:marks.length});
        }
      }
      if(dots || squares){
        const grid=new Map(),key=(x,y)=>x+","+y;
        for(const m of marks){const k=key(Math.floor(m.x/step),Math.floor(m.y/step));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(m);}
        for(const m of marks){
          const gx=Math.floor(m.x/step),gy=Math.floor(m.y/step);
          for(let y=gy-1;y<=gy+1;y++)for(let x=gx-1;x<=gx+1;x++)for(const q of grid.get(key(x,y))||[]){
            if(q!==m)m.r=Math.min(m.r,0.46*(squares ? Math.max(Math.abs(m.x-q.x),Math.abs(m.y-q.y)) : Math.hypot(m.x-q.x,m.y-q.y)));
          }
        }
      }
      // Random priority is seeded and independent of ink. If the point budget
      // is reached, marks thin across the whole sheet rather than cropping it.
      for(let i=marks.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[marks[i],marks[j]]=[marks[j],marks[i]];}
      const chosen=[];let budget=112000;
      const angle=n(p.angle,75,-36000,36000)*Math.PI/180;
      const flow=n(p.flow,0.75,0,1), passes=Math.round(n(p.passes,3,1,4));
      const direction=(x,y)=>{
        if(p.direction==='Fixed angle')return angle;
        const a=angle+(noise2(x*0.016,y*0.016,seed+41)-0.5)*flow*3;
        if(p.direction==='Flow field')return a;
        // A local structure tensor combines gradients as unoriented axes.
        // Double-angle blending avoids flips where the image tangent wraps pi.
        const e=Math.max(fit.sc,cell*0.55);let jxx=0,jyy=0,jxy=0;
        for(const [ox,oy] of [[0,0],[-e,0],[e,0],[0,-e],[0,e]]){
          const gx=sample(x+ox+e,y+oy)-sample(x+ox-e,y+oy);
          const gy=sample(x+ox,y+oy+e)-sample(x+ox,y+oy-e);
          jxx+=gx*gx;jyy+=gy*gy;jxy+=gx*gy;
        }
        const weight=Math.min(1,Math.hypot(jxx-jyy,2*jxy)*8)*flow;
        const tangent=0.5*Math.atan2(2*jxy,jxx-jyy)+Math.PI/2;
        return 0.5*Math.atan2((1-weight)*Math.sin(2*a)+weight*Math.sin(2*tangent),(1-weight)*Math.cos(2*a)+weight*Math.cos(2*tangent));
      };
      const segment=(x,y,a,len)=>{
        const vx=Math.cos(a),vy=Math.sin(a);let half=len/2;
        // Symmetric clipping preserves the direction, unlike XY clamping.
        if(Math.abs(vx)>1e-8)half=Math.min(half,(x-fit.x)/Math.abs(vx),(fit.x+fit.w-x)/Math.abs(vx));
        if(Math.abs(vy)>1e-8)half=Math.min(half,(y-fit.y)/Math.abs(vy),(fit.y+fit.h-y)/Math.abs(vy));
        return half>0.025 ? [[x-vx*half,y-vy*half],[x+vx*half,y+vy*half]] : null;
      };
      for(const m of marks){
        const paths=[];
        const add=(pts,closed=false)=>{if(pts?.length>=2)paths.push({pts,closed,layer:m.layer});};
        if(squares){
          const r=m.r, corners=[[-r,-r],[r,-r],[r,r],[-r,r]];
          const woven=p.squarefill==='Woven fill' && (m.row+m.col)%2===1;
          const place=pts=>pts.map(([x,y])=>woven ? [m.x-y,m.y+x] : [m.x+x,m.y+y]);
          if(p.squarefill==='Outline')add(place(corners),true);
          else{
            // Trace the boundary, then fill with one continuous serpentine.
            // Interior rows are no further apart than the physical pen pitch.
            const pts=[...corners,[-r,-r]], rows=Math.max(1,Math.ceil(2*r/pitch)-1);
            for(let j=1;j<=rows;j++){
              const y=-r+j*2*r/(rows+1), left=j%2? -r : r;
              pts.push([left,y],[-left,y]);
            }
            add(place(pts));
          }
        }else if(dots){
          const count=r=>Math.max(8,Math.min(64,Math.ceil(2*Math.PI*r/0.65)));
          const ring=r=>{const N=count(r);add(Array.from({length:N},(_,i)=>{const a=i/N*2*Math.PI;return [m.x+Math.cos(a)*r,m.y+Math.sin(a)*r];}),true);};
          if(p.dotfill==='Outline')ring(m.r);
          else if(p.dotfill==='Concentric rings'){
            ring(m.r);for(let r=m.r-pitch;r>pitch*0.3;r-=pitch)ring(r);
          }else{
            // One continuous Archimedean spiral, followed by its outside rim.
            // Pitch is in mm and should approximately match the physical pen.
            const turns=Math.max(0.65,m.r/pitch), steps=Math.min(900,Math.max(8,Math.ceil(Math.PI*m.r*turns/0.65)));
            const pts=Array.from({length:steps+1},(_,i)=>{const t=i/steps,r=m.r*t,a=t*turns*2*Math.PI;return [m.x+Math.cos(a)*r,m.y+Math.sin(a)*r];});
            const lastAngle=turns*2*Math.PI,N=count(m.r);
            for(let i=1;i<=N;i++){const a=lastAngle+i/N*2*Math.PI;pts.push([m.x+Math.cos(a)*m.r,m.y+Math.sin(a)*m.r]);}
            add(pts);
          }
        }else{
          const a=direction(m.x,m.y),len=cell*strength*(0.16+0.92*m.d);
          const N=1+Math.floor(m.d*(passes-0.001));
          for(let k=0;k<N;k++){
            const offset=(k-(N-1)/2)*Math.min(pitch,cell*0.2);
            const x=m.x-Math.sin(a)*offset,y=m.y+Math.cos(a)*offset;
            add(segment(x,y,a,len));
            if(cross)add(segment(x,y,a+Math.PI/2,len*(0.4+0.6*m.d)));
          }
        }
        const cost=paths.reduce((sum,q)=>sum+q.pts.length,0);
        if(cost<=budget){chosen.push({index:m.index,paths});budget-=cost;}
        if(budget<2)break;
      }
      chosen.sort((a,b)=>a.index-b.index);
      return applyStyle({paths:chosen.flatMap(m=>m.paths)},ins[0]);
    },
    compute(ins, p, ctx, node) {
      const img = this._usesDrawing(p,ins) ? this._drawingImage(p,ctx,ins?.[1]) : node?.data?.img;
      if (!img) return EMPTY;
      if (["Organic dots", "Short strokes", "Cross stitches", "Square weave"].includes(p.mode)) return this._artCompute(ins, p, ctx, img);
      if (p.mode === "Contours (trace)") {
        /* verbatim traceimg body — merged 2.51; traceimg is a hidden alias */
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const boxW = W - 2 * m, boxH = H - 2 * m;
      if (boxW < 10 || boxH < 10) return applyStyle({ paths: [] }, ins[0]);
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ox = (W - iw) / 2, oy = (H - ih) / 2;
      const darkAt = (x, y) => {
        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;
        const iu = Math.floor(u), iv = Math.floor(v);
        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];
        const fu = u - iu, fv = v - iv;
        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +
                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;
        return p.invert ? 1 - d : d;
      };
      const cell = Math.max(0.5, p.cell);
      const cols = Math.max(2, Math.round(iw / cell) + 1);
      const rows = Math.max(2, Math.round(ih / cell) + 1);
      const gx = (c) => ox + (c / (cols - 1)) * iw;
      const gy = (r) => oy + (r / (rows - 1)) * ih;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = darkAt(gx(c), gy(r));
      const NL = Math.max(1, Math.min(8, Math.round(p.levels)));
      const lo = Math.min(p.low, p.high), hi = Math.max(p.low, p.high);
      const segs = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let li = 0; li < NL; li++) {
        const lvl = NL === 1 ? (lo + hi) / 2 : lo + (li / (NL - 1)) * (hi - lo);
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segs.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
      }
      const { W, H } = ctx;
      const m = p.margin;
      /* sovita kuva marginaalilaatikkoon mittasuhteet sailyttaen */
      const boxW = W - 2 * m, boxH = H - 2 * m;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const x0 = (W - iw) / 2, y0 = (H - ih) / 2;
      const darkAt = (x, y) => {
        /* bilineaarinen naytteistys; kuvan ulkopuolella valkoista */
        const u = (x - x0) / sc, v = (y - y0) / sc;
        if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
        const ui = Math.floor(u), vi = Math.floor(v);
        const fu = u - ui, fv = v - vi;
        const g = img.g;
        const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
        const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
        let d = a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
        if (p.invert) d = 1 - d;
        return Math.pow(Math.max(0, d), p.gamma);
      };
      const L = Math.round(p.layer);
      const paths = [];
      if (p.mode === "Scanline wave") {
        /* klassikko: vaakarivit, tummuus kasvattaa amplitudia JA taajuutta */
        for (let y = y0; y <= y0 + ih; y += p.cell) {
          let run = [], phase = 0;
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (let x = x0; x <= x0 + iw; x += 0.35) {
            const d = darkAt(x, y);
            if (d < p.cutoff) { flush(); continue; }
            phase += 0.5 + d * 2.6;
            run.push([x, y + Math.sin(phase) * d * p.cell * 0.48 * p.strength]);
          }
          flush();
        }
      } else if (p.mode === "Halftone dots") {
        for (let y = y0 + p.cell / 2; y < y0 + ih; y += p.cell) {
          for (let x = x0 + p.cell / 2; x < x0 + iw; x += p.cell) {
            const d = darkAt(x, y);
            if (d < p.cutoff) continue;
            const r = d * p.cell * 0.46 * p.strength;
            if (r < 0.16) continue;
            const pts = [];
            const n = r < 0.8 ? 6 : 10;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
            }
            paths.push({ pts, closed: true, layer: L });
          }
        }
      } else if (p.mode === "Hatch levels") {
        /* 4 viivoitustasoa: tummempi alue saa useamman suunnan */
        const angles = [45, -45, 0, 90];
        const levels = [0.2, 0.42, 0.62, 0.82];
        const diag = Math.hypot(iw, ih);
        const cxm = x0 + iw / 2, cym = y0 + ih / 2;
        for (let k = 0; k < 4; k++) {
          const a = (angles[k] * Math.PI) / 180;
          const dx = Math.cos(a), dy = Math.sin(a);
          const px = -dy, py = dx;
          for (let o = -diag / 2; o <= diag / 2; o += p.cell) {
            let run = [];
            const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
            for (let t = -diag / 2; t <= diag / 2; t += 0.5) {
              const x = cxm + dx * t + px * o, y = cym + dy * t + py * o;
              if (darkAt(x, y) * p.strength >= levels[k]) run.push([x, y]);
              else flush();
            }
            flush();
          }
        }
      } else {
        /* Flow shade: virtausviivat joiden tiheys ja pituus seuraavat tummuutta */
        const rng = mulberry32(p.seed * 5479 + 101);
        const attempts = Math.round((iw * ih) / (p.cell * p.cell) * 1.6);
        let budget = 60000;
        for (let i = 0; i < attempts && budget > 0; i++) {
          const sx = x0 + rng() * iw, sy = y0 + rng() * ih;
          const d0 = darkAt(sx, sy);
          if (d0 < p.cutoff || rng() > d0) continue;
          const len = 2 + d0 * 14 * p.strength;
          let x = sx, y = sy;
          const pts = [[x, y]];
          const steps = Math.round(len / 0.8);
          for (let s = 0; s < steps; s++) {
            const a = noise2(x * 0.02, y * 0.02, p.seed + 9) * Math.PI * 4;
            x += Math.cos(a) * 0.8;
            y += Math.sin(a) * 0.8;
            pts.push([x, y]);
          }
          budget -= pts.length;
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
