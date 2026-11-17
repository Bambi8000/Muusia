import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "slice_raster", name: "Slice Raster", cat: "gen", group: "textimg",
  fileImage: true, imageMax: 640,
  desc: "One image, different halftones in each slice. Choose Strips, Grid or seeded Collage rectangles; up to eight slices each keep their own Raster, Size share, Angle, Raster pitch, Ink strength and Pen. Advanced settings exposes these per-slice controls. Lines lengthens hatch marks with tone, Crosshatch adds a second shadow screen, Waves bends broken hatch lines, and Dots/Squares/Diamonds use real filled spiral strokes. All rasters sample one shared image fit: changing a slice never refits the picture inside it. Auto shows an original Tone study until a PNG/JPG is loaded; Image file explicitly requires a loaded picture. Contain preserves the complete image; Cover crops it to the page margin. Gap leaves blank seams. Phase moves the region masks across a stationary image and raster field; Timeline follows ANIMATE in a seamless cycle. Collage seed changes only the partition. Dot fill pitch is physical spiral spacing; match it to your nib. Dense requests uniformly coarsen sampling, pitch and spiral fill for every slice; later slices are never dropped. Style is applied last. Search: slicer, raster, halftone, collage, image, viipale, rasteri.",
  ins: [Pin("style", "Style")], outs: [Pin("paths", "Drawing")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "source", label: "Source", type: "select", options: ["Auto", "Image file", "Tone study"], def: "Auto" },
    { key: "layout", label: "Layout", type: "select", options: ["Strips", "Grid", "Collage"], def: "Strips" },
    { key: "count", label: "Slices", type: "slider", min: 1, max: 8, step: 1, def: 4 },
    { key: "sliceAngle", label: "Slice angle °", type: "slider", min: 0, max: 180, step: 1, def: 0, showIf: p => p.layout === "Strips" },
    { key: "columns", label: "Grid columns", type: "slider", min: 1, max: 8, step: 1, def: 2, showIf: p => p.layout === "Grid" },
    { key: "seed", label: "Collage seed", type: "seed", def: 42, showIf: p => p.layout === "Collage" },
    { key: "gap", label: "Slice gap mm", type: "slider", min: 0, max: 10, step: 0.25, def: 0.75 },
    { key: "fit", label: "Image fit", type: "select", options: ["Contain", "Cover"], def: "Contain" },
    { key: "motion", label: "Motion", type: "select", options: ["Manual", "Timeline"], def: "Manual" },
    { key: "phase", label: "Mask phase °", type: "slider", min: 0, max: 360, step: 1, def: 0, showIf: p => p.motion !== "Timeline" },
    { key: "cycles", label: "Cycles", type: "slider", min: 1, max: 8, step: 1, def: 1, showIf: p => p.motion === "Timeline" },
    { key: "contrast", label: "Contrast", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1.4 },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.08 },
    { key: "invert", label: "Invert image", type: "check", def: false },
    { key: "fillPitch", label: "Dot fill pitch mm", type: "slider", min: 0.15, max: 1, step: 0.05, def: 0.3, showIf: p => Array.from({length:8},(_,i)=>i).some(i => i < Math.max(1,Math.min(8,Math.round(Number.isFinite(+p.count)?+p.count:4))) && ["Dots","Squares","Diamonds"].includes(p["raster"+(i+1)])) },
    { key: "waveHeight", label: "Wave height × pitch", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.42, showIf: p => Array.from({length:8},(_,i)=>i).some(i => i < Math.max(1,Math.min(8,Math.round(Number.isFinite(+p.count)?+p.count:4))) && p["raster"+(i+1)] === "Waves") },
    { key: "waveLength", label: "Wavelength mm", type: "slider", min: 1, max: 20, step: 0.5, def: 5, showIf: p => Array.from({length:8},(_,i)=>i).some(i => i < Math.max(1,Math.min(8,Math.round(Number.isFinite(+p.count)?+p.count:4))) && p["raster"+(i+1)] === "Waves") },
    { key: "advanced", label: "Advanced slice settings", type: "check", def: false },
    ...Array.from({ length: 8 }, (_, i) => {
      const k = i + 1, visible = p => Math.max(1,Math.min(8,Math.round(Number.isFinite(+p.count)?+p.count:4))) >= k;
      const advanced = p => visible(p) && !!p.advanced;
      const ink = p => advanced(p) && p["raster"+k] !== "Off";
      return [
        { key: "raster"+k, label: "Slice "+k+" raster", type: "select", options: ["Lines", "Dots", "Crosshatch", "Waves", "Squares", "Diamonds", "Off"], def: ["Lines", "Dots", "Crosshatch", "Waves", "Squares", "Diamonds", "Lines", "Dots"][i], showIf: visible },
        { key: "share"+k, label: "Slice "+k+" size share", type: "slider", min: 0.2, max: 4, step: 0.1, def: 1, showIf: advanced },
        { key: "angle"+k, label: "Slice "+k+" raster angle °", type: "slider", min: 0, max: 180, step: 1, def: [0,15,45,0,0,0,90,45][i], showIf: ink },
        { key: "pitch"+k, label: "Slice "+k+" raster pitch mm", type: "slider", min: 0.6, max: 8, step: 0.1, def: [1.5,3.2,1.8,2,3.8,2.8,1.5,3][i], showIf: ink },
        { key: "strength"+k, label: "Slice "+k+" ink strength", type: "slider", min: 0, max: 2, step: 0.05, def: 1, showIf: ink },
        { key: "pen"+k, label: "Slice "+k+" pen", type: "pen", def: 0, showIf: ink },
      ];
    }).flat(),
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
  ],
  _layout(p, ctx, node) {
    const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : d));
    const W = num(ctx?.W, 0, 0, 100000), H = num(ctx?.H, 0, 0, 100000), m = num(p.margin, 12, 0, 100000);
    if (W - 2*m < 4 || H - 2*m < 4) return null;
    const loaded = node?.data?.img;
    const valid = loaded && Number.isInteger(loaded.w) && Number.isInteger(loaded.h) && loaded.w >= 2 && loaded.h >= 2 && loaded.w*loaded.h <= 2560000 && loaded.g?.length === loaded.w*loaded.h;
    const img = p.source === "Tone study" ? null : valid ? loaded : null;
    if (!img && p.source === "Image file") return null;
    const iw = img?.w || 128, ih = img?.h || 90;
    const scale = (p.fit === "Cover" ? Math.max : Math.min)((W-2*m)/iw, (H-2*m)/ih);
    const ox = (W-iw*scale)/2, oy = (H-ih*scale)/2;
    const box = p.fit === "Cover" ? {x0:m,y0:m,x1:W-m,y1:H-m} : {x0:ox,y0:oy,x1:W-ox,y1:H-oy};
    const {x0,y0,x1,y1} = box, w=x1-x0, h=y1-y0;
    const n = Math.round(num(p.count,4,1,8)), gap=num(p.gap,.75,0,100);
    const configs=Array.from({length:n},(_,i)=>({id:i+1,type:["Lines","Dots","Crosshatch","Waves","Squares","Diamonds","Off"].includes(p["raster"+(i+1)])?p["raster"+(i+1)]:["Lines","Dots","Crosshatch","Waves"][i%4],share:num(p["share"+(i+1)],1,.2,10),angle:num(p["angle"+(i+1)],0,-360,360)*Math.PI/180,pitch:num(p["pitch"+(i+1)],2,.4,20),strength:num(p["strength"+(i+1)],1,0,3),pen:Math.round(num(p["pen"+(i+1)],0,0,11))}));
    const tau=Math.PI*2, frameCount=Math.max(1,Math.round(num(ctx?.frameCount,24,1,100000)));
    const phase=p.motion==="Timeline"?num(ctx?.frameIdx,0,-1e9,1e9)/frameCount*Math.round(num(p.cycles,1,1,16)):num(p.phase,0,-1e12,1e12)/360;
    const shift=n===1?0:((phase%1)+1)%1, regions=[];
    const half=(poly,ax,ay,v,side)=>{
      const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=side*(a[0]*ax+a[1]*ay-v),db=side*(b[0]*ax+b[1]*ay-v);if(da>=-1e-9)out.push(a);if((da>0&&db<0)||(da<0&&db>0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;
    };
    const add=(poly,id)=>{
      if(poly.length<3)return;let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-b[0]*a[1];}if(Math.abs(area)<1e-6)return;
      if(area<0)poly.reverse();
      const clean=poly.filter((q,i)=>!i||Math.hypot(q[0]-poly[i-1][0],q[1]-poly[i-1][1])>1e-8);
      if(clean.length>2&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-8)clean.pop();
      if(clean.length<3)return;
      const constraints=[];for(let i=0;i<clean.length;i++){const a=clean[i],b=clean[(i+1)%clean.length],dx=b[0]-a[0],dy=b[1]-a[1];constraints.push([-dy,dx,dy*a[0]-dx*a[1]]);}
      regions.push({id,poly:clean,constraints,minX:Math.min(...clean.map(q=>q[0])),maxX:Math.max(...clean.map(q=>q[0])),minY:Math.min(...clean.map(q=>q[1])),maxY:Math.max(...clean.map(q=>q[1]))});
    };
    if(p.layout!=="Grid"&&p.layout!=="Collage") {
      const a=num(p.sliceAngle,0,-360,360)*Math.PI/180, ax=Math.cos(a),ay=Math.sin(a), corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
      const u=corners.map(q=>q[0]*ax+q[1]*ay),lo=Math.min(...u),hi=Math.max(...u),span=hi-lo,total=configs.reduce((s,c)=>s+c.share,0);let at=lo+shift*span;
      for(const c of configs){const end=at+span*c.share/total;for(const tile of [-1,0,1]){const a=at+tile*span,b=end+tile*span,left=a+(a>lo+1e-7?gap/2:0),right=b-(b<hi-1e-7?gap/2:0);if(right<=left||right<=lo||left>=hi)continue;add(half(half(corners,ax,ay,left,1),ax,ay,right,-1),c.id);}at=end;}
    } else {
      const rects=[];
      if(p.layout==="Grid") {
        const cols=Math.round(num(p.columns,2,1,n)),rows=Math.ceil(n/cols);let id=0;
        for(let r=0;r<rows;r++){const k=Math.min(cols,n-id),sum=configs.slice(id,id+k).reduce((s,c)=>s+c.share,0);let at=x0;for(let j=0;j<k;j++){const c=configs[id++],end=at+w*c.share/sum;rects.push({id:c.id,x0:at,y0:y0+h*r/rows,x1:end,y1:y0+h*(r+1)/rows});at=end;}}
      } else {
        const rng=mulberry32(num(p.seed,42,-1e9,1e9));
        const divide=(list,r)=>{if(list.length===1){rects.push({...r,id:list[0].id});return;}const cut=1+Math.floor(rng()*(list.length-1)),left=list.slice(0,cut),right=list.slice(cut),fraction=left.reduce((s,c)=>s+c.share,0)/list.reduce((s,c)=>s+c.share,0);const vertical=(r.x1-r.x0)/(r.y1-r.y0)>(.7+rng()*.6);if(vertical){const x=r.x0+(r.x1-r.x0)*fraction;divide(left,{...r,x1:x});divide(right,{...r,x0:x});}else{const y=r.y0+(r.y1-r.y0)*fraction;divide(left,{...r,y1:y});divide(right,{...r,y0:y});}};
        divide(configs,box);
      }
      for(const r of rects)for(const tile of [-1,0,1]) {
        const dx=(shift+tile)*w,rx0=r.x0+dx,rx1=r.x1+dx;
        const a=Math.max(x0,rx0+(rx0>x0+1e-7?gap/2:0)),b=Math.min(x1,rx1-(rx1<x1-1e-7?gap/2:0));
        const c=Math.max(y0,r.y0+(r.y0>y0+1e-7?gap/2:0)),d=Math.min(y1,r.y1-(r.y1<y1-1e-7?gap/2:0));
        if(b>a&&d>c)add([[a,c],[b,c],[b,d],[a,d]],r.id);
      }
    }
    const contrast=num(p.contrast,1.4,.1,5),gamma=num(p.gamma,1,.1,5),cutoff=num(p.cutoff,.08,0,.95);
    const rawSample=(x,y)=>{
      if(x<x0-1e-8||x>x1+1e-8||y<y0-1e-8||y>y1+1e-8)return 0;
      let d;
      if(!img){const nx=(x-ox)/(iw*scale),ny=(y-oy)/(ih*scale),r=Math.hypot((nx-.34)/.24,(ny-.43)/.34);d=r<1?.2+.72*(1-r*.65):0;if(nx>.59&&nx<.87&&ny>.17&&ny<.71)d=Math.max(d,.18+.72*(ny-.17)/.54);if(ny>.77&&ny<.85&&nx>.12&&nx<.87)d=Math.max(d,.22+.7*(nx-.12)/.75);}
      else {const u=Math.max(0,Math.min(iw-1,(x-ox)/scale-.5)),v=Math.max(0,Math.min(ih-1,(y-oy)/scale-.5)),a=Math.floor(u),b=Math.floor(v),fx=u-a,fy=v-b;const at=(ix,iy)=>num(img.g[Math.min(ih-1,iy)*iw+Math.min(iw-1,ix)],0,0,1);d=at(a,b)*(1-fx)*(1-fy)+at(a+1,b)*fx*(1-fy)+at(a,b+1)*(1-fx)*fy+at(a+1,b+1)*fx*fy;}
      if(p.invert)d=1-d;return Math.max(0,Math.min(1,((d-.5)*contrast+.5-cutoff)/(1-cutoff)))**gamma;
    };
    return {W,H,m,box,w,h,scale,ox,oy,iw,ih,img,configs,regions,rawSample,num,tau};
  },
  _clip(pts, region) {
    const output=[];let run=[];
    const flush=()=>{if(run.length>1)output.push(run);run=[];};
    for(let i=1;i<pts.length;i++) {
      const a=pts[i-1],b=pts[i];let lo=0,hi=1,ok=true;
      for(const [nx,ny,c]of region.constraints){const da=nx*a[0]+ny*a[1]+c,db=nx*b[0]+ny*b[1]+c,d=db-da;if(Math.abs(d)<1e-12){if(da< -1e-8){ok=false;break;}}else if(d>0)lo=Math.max(lo,-da/d);else hi=Math.min(hi,-da/d);if(lo>hi+1e-10){ok=false;break;}}
      if(!ok||hi-lo<1e-9){flush();continue;}
      const start=[a[0]+(b[0]-a[0])*lo,a[1]+(b[1]-a[1])*lo],end=[a[0]+(b[0]-a[0])*hi,a[1]+(b[1]-a[1])*hi];
      if(Math.hypot(end[0]-start[0],end[1]-start[1])<1e-8){flush();continue;}
      if(run.length&&Math.hypot(run.at(-1)[0]-start[0],run.at(-1)[1]-start[1])>1e-7)flush();
      if(!run.length)run.push(start);run.push(end);if(hi<1-1e-9)flush();
    }
    flush();return output;
  },
  overlay(p,ctx,ins,node) {
    const G=this._layout(p,ctx,node);if(!G)return [];
    return G.regions.map(r=>({kind:"poly",pts:[...r.poly,r.poly[0]]}));
  },
  compute(ins,p,ctx,node) {
    const G=this._layout(p,ctx,node);if(!G)return EMPTY;
    const {configs,num,rawSample,tau}=G,area=G.w*G.h;
    let estimate=0,candidates=0;
    for(const c of configs)if(c.type!=="Off"&&c.strength>0){const cells=area/(c.pitch*c.pitch);estimate+=cells*(c.type==="Dots"||c.type==="Squares"||c.type==="Diamonds"?85:c.type==="Waves"?15:5)/configs.length;candidates+=cells;}
    let quality=Math.max(1,Math.sqrt(estimate/260000),Math.sqrt(candidates/180000));
    const render=q=>{
      const paths=[];let points=0,work=0,full=false;
      const append=(pts,reg,c)=>{
        for(const run of this._clip(pts,reg)){points+=run.length;if(points>110000){full=true;return;}paths.push({pts:run,closed:false,layer:c.pen,slice:c.id});}
      };
      for(const reg of G.regions) {
        const c=configs[reg.id-1];if(c.type==="Off"||!c.strength)continue;
        const pitch=c.pitch*q,fill=num(p.fillPitch,.3,.1,2)*q;
        const sample=(x,y)=>Math.min(1,rawSample(x,y)*c.strength);
        const families=c.type==="Crosshatch"?2:1;
        for(let family=0;family<families;family++) {
          const angle=c.angle+family*Math.PI/2,ca=Math.cos(angle),sa=Math.sin(angle),toXY=(u,v)=>[u*ca-v*sa,u*sa+v*ca];
          const corners=[[reg.minX,reg.minY],[reg.maxX,reg.minY],[reg.maxX,reg.maxY],[reg.minX,reg.maxY]];
          const us=corners.map(([x,y])=>x*ca+y*sa),vs=corners.map(([x,y])=>-x*sa+y*ca);
          const pad=pitch*1.5,u0=Math.min(...us)-pad,u1=Math.max(...us)+pad,v0=Math.min(...vs)-pad,v1=Math.max(...vs)+pad;
          const dots=["Dots","Squares","Diamonds"].includes(c.type),period=dots?pitch:pitch*1.5;
          for(let j=Math.floor(v0/pitch);j<=Math.ceil(v1/pitch);j++) {
            const v=(j+.5)*pitch;
            if(c.type==="Waves") {
              const step=Math.max(.25*q,pitch*.15),wave=Math.max(num(p.waveLength,5,1,100),step*10),amplitude=num(p.waveHeight,.42,0,1)*pitch,N=Math.max(1,Math.ceil((u1-u0)/step));let run=[];
              const flush=()=>{if(run.length>1)append(run,reg,c);run=[];};
              for(let k=0;k<=N;k++){
                if(++work>700000)return null;
                const u=u0+(u1-u0)*k/N,base=toXY(u,v),d=sample(...base),point=toXY(u,v+Math.sin(u/wave*tau)*amplitude*d);
                const duty=((u/period)%1+1)%1;
                if(d>.015&&duty<d){run.push(point);}else flush();
                if(full)return null;
              }flush();
              continue;
            }
            let joined=[];
            const flush=()=>{if(joined.length>1)append(joined,reg,c);joined=[];};
            for(let i=Math.floor(u0/period);i<=Math.ceil(u1/period);i++) {
              if(++work>700000)return null;
              const u=(i+.5)*period,centre=toXY(u,v),x=centre[0],y=centre[1];
              if(x<reg.minX-pitch||x>reg.maxX+pitch||y<reg.minY-pitch||y>reg.maxY+pitch){flush();continue;}
              let d=sample(x,y);if(family)d=Math.max(0,(d-.35)/.65);
              if(d<=.015){flush();continue;}
              if(dots) {
                const radius=pitch*.46*Math.sqrt(d),turns=Math.max(.2,radius/fill),N=Math.max(10,Math.ceil(turns*12),Math.ceil(Math.PI*radius*turns/Math.max(.25*q,.15)));
                const pts=[];
                for(let k=0;k<=N;k++) {
                  const t=k/N,a=t*turns*tau,r=radius*t,xx=Math.cos(a),yy=Math.sin(a);
                  const factor=c.type==="Squares"?1/Math.max(Math.abs(xx),Math.abs(yy)):c.type==="Diamonds"?1.35/(Math.abs(xx)+Math.abs(yy)):1;
                  const pt=toXY(u+r*xx*factor,v+r*yy*factor);pts.push(pt);
                }
                append(pts,reg,c);
              } else {
                const len=period*d,a=toXY(u-len/2,v),b=toXY(u+len/2,v);
                if(joined.length&&Math.hypot(joined.at(-1)[0]-a[0],joined.at(-1)[1]-a[1])<1e-7)joined.push(b);else{flush();joined=[a,b];}
              }
              if(full)return null;
            }flush();if(full)return null;
          }
        }
      }
      return full?null:{paths};
    };
    for(let attempt=0;attempt<6;attempt++) {const result=render(quality);if(result)return applyStyle(result,ins?.[0]);quality*=1.6;}
    return EMPTY;
  },
};
