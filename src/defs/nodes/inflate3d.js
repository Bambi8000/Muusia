import { Pin, pathLength, applyStyle, isStyle } from "../helpers.js";

export default {
  key: "inflate3d", name: "2D to 3D", cat: "mod", group: "deform", fileImage: true,
  desc: "Turn paths or an image into a real 3D surface. Inflate swells closed outlines; Extrude makes flat caps and vertical walls. Both use even-odd fill (nested paths cut holes, overlaps alternate), ignore open strokes and sample the boundary at Surface detail. Tubes wraps open/closed strokes in round tubes; Diameter and Tube step are in source millimetres before normalization. Cap open ends closes each tube; intersecting tubes remain separate surfaces, without a Boolean union; tight bends and crossings may self-intersect. Ink height deposits a soft ink footprint along strokes: overlapping/dense strokes build a higher relief; Ink width is in source millimetres. Depth map loads an image (no path input needed): light is high by default, Dark is high reverses it; Wave study is a built-in test surface. Image pixels are frozen into saved patches; no external service. Ink height and Depth map have a flat base, Height curve and smoothing. Depth % and Base % are relative to source XY size. Drawing and Silhouette are projected pen paths; orange Mesh output 3 feeds 3D Spikes (Body: Wired mesh) or Mesh Slice. Camera, size, margin and Style never change the Mesh. Inflate/Extrude at depth 0 produce an open flat sheet; reliefs keep their base. All geometry is deterministic. Limits: 256 paths / 6000 source points, 120000 triangles. Complex paths lower effective detail; narrow features and very thin ink need more detail. Tube sampling and ink footprints adapt to a fixed work budget. Old Inflate patches keep their original behavior.",
  ins: [Pin("paths", "2D paths"), Pin("style", "Style")],
  outs: [Pin("paths", "Drawing"), Pin("paths", "Silhouette"), Pin("mesh", "Mesh")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Inflate", "Extrude", "Tubes", "Ink height", "Depth map"], def: "Inflate" },
    { key: "depth", label: "Depth %", type: "slider", min: 0, max: 150, step: 1, def: 42, showIf: p => p.mode !== "Tubes" },
    { key: "roundness", label: "Roundness", type: "slider", min: .2, max: 2, step: .05, def: 1, showIf: p => (!p.mode || p.mode === "Inflate") && p.depth > 0 },
    { key: "back", label: "Back surface", type: "select", options: ["Inflated", "Flat"], def: "Inflated", showIf: p => (!p.mode || p.mode === "Inflate") && p.depth > 0 },
    { key: "diameter", label: "Diameter mm", type: "slider", min: .5, max: 30, step: .5, def: 6, showIf: p => p.mode === "Tubes" },
    { key: "tubeStep", label: "Tube step mm", type: "slider", min: .5, max: 12, step: .5, def: 3, showIf: p => p.mode === "Tubes" },
    { key: "sides", label: "Tube sides", type: "slider", min: 6, max: 16, step: 2, def: 8, showIf: p => p.mode === "Tubes" },
    { key: "caps", label: "Cap open ends", type: "check", def: true, showIf: p => p.mode === "Tubes" },
    { key: "inkWidth", label: "Ink width mm", type: "slider", min: .5, max: 20, step: .5, def: 4, showIf: p => p.mode === "Ink height" },
    { key: "inkGain", label: "Ink buildup", type: "slider", min: .1, max: 4, step: .1, def: 1, showIf: p => p.mode === "Ink height" && p.depth > 0 },
    { key: "mapSource", label: "Depth source", type: "select", options: ["Image file", "Wave study"], def: "Image file", showIf: p => p.mode === "Depth map" },
    { key: "image", label: "Depth image", type: "file", def: "", showIf: p => p.mode === "Depth map" && p.mapSource !== "Wave study" },
    { key: "darkHigh", label: "Dark is high", type: "check", def: false, showIf: p => p.mode === "Depth map" && p.depth > 0 },
    { key: "base", label: "Base %", type: "slider", min: 1, max: 25, step: 1, def: 3, showIf: p => ["Ink height", "Depth map"].includes(p.mode) },
    { key: "curve", label: "Height curve", type: "slider", min: .25, max: 4, step: .05, def: 1, showIf: p => ["Ink height", "Depth map"].includes(p.mode) && p.depth > 0 },
    { key: "smooth", label: "Smooth passes", type: "slider", min: 0, max: 12, step: 1, def: 2, showIf: p => ["Ink height", "Depth map"].includes(p.mode) && p.depth > 0 },
    { key: "detail", label: "Surface detail", type: "slider", min: 20, max: 72, step: 2, def: 44, showIf: p => p.mode !== "Tubes" },
    { key: "drawing", label: "Drawing", type: "select", options: ["Surface grid", "Mesh edges", "Silhouette"], def: "Surface grid" },
    { key: "every", label: "Grid every Nth", type: "slider", min: 1, max: 6, step: 1, def: 2, showIf: p => p.drawing === "Surface grid" },
    { key: "outline", label: "Draw silhouette", type: "check", def: true, showIf: p => p.drawing !== "Silhouette" },
    { key: "hidden", label: "Hidden-line removal", type: "check", def: true },
    { key: "viewAz", label: "View angle °", type: "slider", min: -180, max: 180, step: 1, def: 25 },
    { key: "viewEl", label: "View elevation °", type: "slider", min: -85, max: 90, step: 1, def: 50 },
    { key: "size", label: "Preview size mm", type: "slider", min: 20, max: 400, step: 1, def: 155 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const W=Number(ctx?.W),H=Number(ctx?.H);
    if (!(W>0&&H>0&&Number.isFinite(W)&&Number.isFinite(H))) return [];
    const m=Math.min(Math.max(0,Number(p.margin)||0),60,Math.max(0,Math.min(W,H)/2-.001));
    return [{kind:"rect",x:m,y:m,w:W-2*m,h:H-2*m}];
  },
  compute(ins,p,ctx,node) {
    const empty=()=>[{paths:[]},{paths:[]},null];
    const W=Number(ctx?.W),H=Number(ctx?.H);
    if (!(W>0&&H>0&&Number.isFinite(W)&&Number.isFinite(H))) return empty();
    const num=(k,lo,hi,f)=>Number.isFinite(Number(p[k]))?Math.max(lo,Math.min(hi,Number(p[k]))):f;
    const mode=p.mode || "Inflate";
    const buildRegion=()=>{
      const polys=[];let points=0,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for (const path of ins?.[0]?.paths||[]) {
        if (!path.closed||!Array.isArray(path.pts)||path.pts.length<3) continue;
        if (polys.length>=256) return null;
        const poly=[];
        for (const pt of path.pts) {
          if (!Array.isArray(pt)||pt.length<2||!pt.slice(0,2).every(v=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=1e9)) return null;
          if (poly.length&&pt[0]===poly[poly.length-1][0]&&pt[1]===poly[poly.length-1][1]) continue;
          poly.push([pt[0],pt[1]]);if (++points>6000) return null;
        }
        if (poly.length>2&&poly[0][0]===poly[poly.length-1][0]&&poly[0][1]===poly[poly.length-1][1]) poly.pop();
        if (poly.length<3) continue;
        polys.push(poly);
        for (const [x,y] of poly){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
      }
      const span=Math.max(x1-x0,y1-y0);
      if (!polys.length||!(span>1e-8)||x1-x0<span*1e-7||y1-y0<span*1e-7) return null;
      const cx=(x0+x1)/2,cy=(y0+y1)/2,segs=[];
      for (const poly of polys) {
        for (const q of poly){q[0]=(q[0]-cx)/span;q[1]=(q[1]-cy)/span;}
        for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
          const a=poly[j],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;
          if(l>1e-20)segs.push([a[0],a[1],dx,dy,l]);
        }
      }
      if (!segs.length) return null;
      // Exact point/segment distance and even-odd sign. Adapt the grid to a
      // fixed query-work budget instead of silently truncating the outlines.
      const n=Math.max(12,Math.min(Math.round(num("detail",12,72,44)),Math.floor(Math.sqrt(3000000/segs.length))));
      const cell=1/n,nx=Math.ceil((x1-x0)/span*n)+3,ny=Math.ceil((y1-y0)/span*n)+3;
      const ox=(x0-cx)/span-cell,oy=(y0-cy)/span-cell;
      const field=(x,y)=>{
        let best=Infinity,inside=false;
        for(const [ax,ay,dx,dy,l] of segs){
          const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l));
          const qx=x-ax-t*dx,qy=y-ay-t*dy;best=Math.min(best,qx*qx+qy*qy);
          if((ay>y)!==(ay+dy>y)&&x<ax+(y-ay)*dx/dy)inside=!inside;
        }
        return (inside?1:-1)*Math.sqrt(best);
      };
      const F=new Float64Array(nx*ny),U=new Float64Array(nx*ny);let maxD=0;
      for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const d=field(ox+x*cell,oy+y*cell);F[y*nx+x]=d;maxD=Math.max(maxD,d);}
      for(let i=0;i<F.length;i++)if(F[i]>1e-10)U[i]=F[i]*(2*maxD-F[i])/4;
      // Relax -Laplacian(u)=1 with zero rim. sqrt(u) gives a rounded membrane,
      // rather than the medial-axis crease of a raw distance extrusion.
      for(let it=0;it<(mode==="Extrude"?0:n*6);it++)for(let parity=0;parity<2;parity++) {
        for(let y=1;y<ny-1;y++)for(let x=1+((y+parity+1)%2);x<nx-1;x+=2){
          const i=y*nx+x;if(F[i]<=1e-10)continue;
          const target=(U[i-1]+U[i+1]+U[i-nx]+U[i+nx]+cell*cell)/4;
          U[i]=Math.max(0,U[i]+1.6*(target-U[i]));
        }
      }
      const nodes=[];
      for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)nodes.push({x:ox+x*cell,y:oy+y*cell,d:F[y*nx+x],u:U[y*nx+x]});
      const top=[],surface=[],weld=new Map();
      const vertex=q=>{
        const key=Math.round(q.x*1e9)+","+Math.round(q.y*1e9);
        if(weld.has(key))return weld.get(key);
        const id=surface.length;surface.push({x:q.x,y:q.y,u:q.u});weld.set(key,id);return id;
      };
      const clip=tri=>{
        const out=[];
        for(let i=0;i<3;i++){
          const a=tri[i],b=tri[(i+1)%3],ia=a.d>1e-10,ib=b.d>1e-10;
          if(ia)out.push(a);
          if(ia!==ib){const t=a.d/(a.d-b.d);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,u:0});}
        }
        if(out.length<3)return;
        const ids=out.map(vertex);
        for(let i=1;i<ids.length-1;i++){
          const a=surface[ids[0]],b=surface[ids[i]],c=surface[ids[i+1]];
          if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>1e-14)top.push([ids[0],ids[i],ids[i+1]]);
        }
      };
      for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
        const a=nodes[y*nx+x],b=nodes[y*nx+x+1],c=nodes[(y+1)*nx+x+1],d=nodes[(y+1)*nx+x];
        const mx=(a.x+c.x)/2,my=(a.y+c.y)/2,dist=field(mx,my);
        const mid={x:mx,y:my,d:dist,u:dist>1e-10?Math.max((a.u+b.u+c.u+d.u)/4,dist*dist/4):0};
        clip([a,b,mid]);clip([b,c,mid]);clip([c,d,mid]);clip([d,a,mid]);
      }
      if(!top.length)return null;
      const requestedDepth=num("depth",0,200,42)/100,depth=requestedDepth<.0004?0:requestedDepth,exponent=1/(1+num("roundness",.2,2,1));
      let peak=0;for(const q of surface)peak=Math.max(peak,q.u);
      if(mode!=="Extrude"&&!(peak>0))return null;
      const vertices=[],faces=[],join=new Map(),front=[],back=[];
      const add=(q,z)=>{const a=[q.x,q.y,z],key=a.map(v=>Math.round(v*1e9)).join(",");if(join.has(key))return join.get(key);const id=vertices.length;vertices.push(a);join.set(key,id);return id;};
      for(const q of surface){
        const h=q.u>0&&depth>0?Math.min(depth,Math.max(depth*Math.pow(q.u/peak,exponent),.0004*Math.max(1,depth))):0,flat=p.back==="Flat";
        front.push(add(q,mode==="Extrude"?depth/2:flat?h:h/2));back.push(add(q,mode==="Extrude"?-depth/2:flat?0:-h/2));
      }
      for(const f of top){faces.push(f.map(i=>front[i]));if(depth>0)faces.push([back[f[2]],back[f[1]],back[f[0]]]);}
      if(mode === "Extrude" && depth > 0) {
        const rim=new Map();
        for(const f of top)for(let j=0;j<3;j++) {const a=f[j],b=f[(j+1)%3],key=a<b?a+":"+b:b+":"+a;if(rim.has(key))rim.delete(key);else rim.set(key,[a,b]);}
        for(const [a,b] of rim.values())faces.push([front[a],back[a],back[b]],[front[a],back[b],front[b]]);
      }
      return {vertices,faces,grid:{ox,oy,cell}};
    };
    // Sanitized source in original millimetres. Open strokes are meaningful
    // for tubes and ink; never mutate the caller's points or frozen image.
    const strokes=()=>{
      const paths=[];let count=0,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(const q of ins?.[0]?.paths||[]) {
        if(!Array.isArray(q.pts)||q.pts.length<2)continue;
        if(paths.length>=256)return null;
        const pts=[];
        for(const pt of q.pts){
          if(!Array.isArray(pt)||pt.length<2||!pt.slice(0,2).every(v=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=1e9))return null;
          if(++count>6000)return null;
          if(!pts.length||pt[0]!==pts.at(-1)[0]||pt[1]!==pts.at(-1)[1])pts.push(pt.slice(0,2));
        }
        if(q.closed&&pts.length>2&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();
        if(pts.length<2)continue;
        paths.push({pts,closed:!!q.closed&&pts.length>2});
        for(const [x,y] of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
      }
      const span=Math.max(x1-x0,y1-y0);if(!paths.length||!(span>1e-8))return null;
      const cx=(x0+x1)/2,cy=(y0+y1)/2;
      for(const q of paths)q.pts=q.pts.map(([x,y])=>[(x-cx)/span,(y-cy)/span]);
      return {paths,span,width:(x1-x0)/span,height:(y1-y0)/span};
    };
    // Arc-length lookup makes both tube and ink density independent of the
    // source's point spacing. Include the closing segment exactly once.
    const track=q=>{
      const cumulative=[0],pts=q.closed?[...q.pts,q.pts[0]]:q.pts;
      for(let i=1;i<pts.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
      let j=1;
      return {length:cumulative.at(-1),at(t){while(j<cumulative.length-1&&cumulative[j]<t)j++;const a=pts[j-1],b=pts[j],f=(t-cumulative[j-1])/(cumulative[j]-cumulative[j-1]||1);return a.map((v,k)=>v+(b[k]-v)*f);}};
    };
    const buildTubes=()=>{
      const src=strokes();if(!src)return null;
      const sides=Math.round(num("sides",6,16,8)),radius=num("diameter",.5,100,6)/src.span/2;
      // A tiny tube cannot survive 1e-4 mesh quantization; refuse it instead
      // of silently making a different diameter or returning broken caps.
      if(radius<.0003)return null;
      const tracks=src.paths.map(q=>({...track(q),closed:q.closed})),total=tracks.reduce((n,t)=>n+t.length,0);
      const budget=Math.floor(95000/(2*sides))-src.paths.length*4;
      const step=Math.max(num("tubeStep",.1,100,3)/src.span,total/Math.max(1,budget));
      const vertices=[],faces=[],gridEdges=[];
      tracks.forEach((t,ti)=>{
        const segments=Math.max(t.closed?3:1,Math.ceil(t.length/step)),count=segments+(t.closed?0:1);
        const centers=Array.from({length:count},(_,j)=>t.at(t.length*j/segments)),start=vertices.length;
        for(let j=0;j<count;j++){
          const before=centers[j===0?(t.closed?count-1:0):j-1],after=centers[j===count-1?(t.closed?0:count-1):j+1];
          let dx=after[0]-before[0],dy=after[1]-before[1],len=Math.hypot(dx,dy);
          if(len<1e-10){const next=centers[(j+1)%count];dx=next[0]-centers[j][0];dy=next[1]-centers[j][1];len=Math.hypot(dx,dy)||1;}
          for(let k=0;k<sides;k++){const th=k/sides*Math.PI*2;vertices.push([centers[j][0]-dy/len*radius*Math.cos(th),centers[j][1]+dx/len*radius*Math.cos(th),radius*Math.sin(th)]);}
        }
        const id=(j,k)=>start+(j%count)*sides+(k%sides);
        for(let j=0;j<segments;j++)for(let k=0;k<sides;k++){
          const a=id(j,k),b=id(j+1,k),c=id(j+1,k+1),d=id(j,k+1);faces.push([a,c,b],[a,d,c]);
          gridEdges.push([a,b,"tube:"+ti+":rail:"+k,k]);
        }
        for(let j=0;j<count;j++)for(let k=0;k<sides;k++)gridEdges.push([id(j,k),id(j,k+1),"tube:"+ti+":ring:"+j,j]);
        if(!t.closed&&p.caps!==false){
          const a=vertices.length,b=a+1;vertices.push([...centers[0],0],[...centers.at(-1),0]);
          for(let k=0;k<sides;k++)faces.push([a,id(0,k+1),id(0,k)],[b,id(count-1,k),id(count-1,k+1)]);
        }
      });
      return {vertices,faces,gridEdges};
    };
    const buildRelief=()=>{
      let width,height,source,sigma,tracks;
      if(mode==="Ink height"){
        const src=strokes();if(!src)return null;
        sigma=num("inkWidth",.5,100,4)/src.span/2;
        width=src.width+6*sigma;height=src.height+6*sigma;
        tracks=src.paths.map(track);
      }else{
        const img=node?.data?.img;
        if(p.mapSource==="Wave study"){
          width=1;height=.72;
          source=(u,v)=>.12+.58*Math.exp(-((u-.35)**2/.035+(v-.4)**2/.07))+.25*(.5+.5*Math.cos(u*15+v*9))*Math.sin(Math.PI*v)**2;
        }else{
          if(!img||!Number.isInteger(img.w)||!Number.isInteger(img.h)||img.w<1||img.h<1||img.w>2048||img.h>2048||!Array.isArray(img.g)||img.g.length!==img.w*img.h||!img.g.every(v=>typeof v==="number"&&Number.isFinite(v)))return null;
          const span=Math.max(img.w,img.h);width=img.w/span;height=img.h/span;
          source=(u,v)=>{
            const x=u*(img.w-1),y=v*(img.h-1),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(img.w-1,x0+1),y1=Math.min(img.h-1,y0+1),a=x-x0,b=y-y0;
            const g=img.g[y0*img.w+x0]*(1-a)*(1-b)+img.g[y0*img.w+x1]*a*(1-b)+img.g[y1*img.w+x0]*(1-a)*b+img.g[y1*img.w+x1]*a*b;
            return Math.max(0,Math.min(1,1-g));
          };
        }
      }
      const n=Math.round(num("detail",12,72,44)),span=Math.max(width,height),nx=Math.max(2,Math.ceil(n*width/span)),ny=Math.max(2,Math.ceil(n*height/span));
      const sx=width/nx,sy=height/ny,ox=-width/2,oy=-height/2;
      let values=new Float64Array((nx+1)*(ny+1));
      if(mode==="Ink height"){
        // Integrate a Gaussian along arc length, rather than counting source
        // vertices. Broaden sub-cell ink only for stable antialiased sampling.
        sigma=Math.max(sigma,Math.max(sx,sy)*.6);
        const total=tracks.reduce((n,t)=>n+t.length,0),step=Math.max(sigma*.5,total/12000),gain=num("inkGain",.1,4,1);
        for(const t of tracks){
          const count=Math.max(1,Math.ceil(t.length/step)),weight=t.length/count/(Math.sqrt(2*Math.PI)*sigma);
          for(let i=0;i<count;i++){
            const [x,y]=t.at(t.length*(i+.5)/count),xl=Math.max(0,Math.ceil((x-4*sigma-ox)/sx)),xr=Math.min(nx,Math.floor((x+4*sigma-ox)/sx)),yl=Math.max(0,Math.ceil((y-4*sigma-oy)/sy)),yr=Math.min(ny,Math.floor((y+4*sigma-oy)/sy));
            for(let j=yl;j<=yr;j++)for(let k=xl;k<=xr;k++)values[j*(nx+1)+k]+=weight*Math.exp(-((ox+k*sx-x)**2+(oy+j*sy-y)**2)/(2*sigma*sigma));
          }
        }
        values=values.map(v=>1-Math.exp(-gain*v));
      }else for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const h=source(x/nx,y/ny);values[y*(nx+1)+x]=p.darkHigh?1-h:h;}
      const depth=num("depth",0,200,42)/100,base=num("base",1,25,3)/100,curve=num("curve",.25,4,1);
      if(depth>0)for(let pass=0;pass<Math.round(num("smooth",0,12,2));pass++){
        const next=new Float64Array(values.length);
        for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
          let sum=0,w=0;
          for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const weight=(i===0?2:1)*(j===0?2:1);sum+=values[Math.max(0,Math.min(ny,y+j))*(nx+1)+Math.max(0,Math.min(nx,x+i))]*weight;w+=weight;}
          next[y*(nx+1)+x]=sum/w;
        }
        values=next;
      }
      const vertices=[],faces=[],stride=nx+1,total=values.length;
      for(let side=0;side<2;side++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)vertices.push([ox+x*sx,oy+y*sy,side?0:base+depth*Math.pow(values[y*stride+x],curve)]);
      for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
        const a=y*stride+x,b=a+1,c=a+stride+1,d=a+stride;
        faces.push([a,b,c],[a,c,d],[a+total,c+total,b+total],[a+total,d+total,c+total]);
      }
      const rim=[];for(let x=0;x<nx;x++)rim.push([x,x+1]);for(let y=0;y<ny;y++)rim.push([y*stride+nx,(y+1)*stride+nx]);for(let x=nx;x>0;x--)rim.push([ny*stride+x,ny*stride+x-1]);for(let y=ny;y>0;y--)rim.push([y*stride,(y-1)*stride]);
      for(const [a,b] of rim)faces.push([a,a+total,b+total],[a,b+total,b]);
      return {vertices,faces,grid:{ox,oy,stepX:sx,stepY:sy}};
    };
    const geometry=mode==="Tubes"?buildTubes():["Ink height","Depth map"].includes(mode)?buildRelief():["Inflate","Extrude"].includes(mode)?buildRegion():null;
    if(!geometry||!geometry.vertices.length||!geometry.faces.length||geometry.faces.length>120000)return empty();
    const {vertices,faces}=geometry;
    // Normalize and quantize exactly like the other mesh producers. Re-weld
    // quantized vertices so the exported mesh and displayed edge topology agree.
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const a of vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],a[k]);hi[k]=Math.max(hi[k],a[k]);}
    const dim=Math.max(...hi.map((v,k)=>v-lo[k])),nv=[],remap=[],qmap=new Map();
    for(const a of vertices){const q=a.map((v,k)=>Math.round((v-(lo[k]+hi[k])/2)/dim*10000)/10000||0),key=q.join(",");if(!qmap.has(key)){qmap.set(key,nv.length);nv.push(q);}remap.push(qmap.get(key));}
    const normal=(a,b,c)=>{const u=b.map((v,k)=>v-a[k]),v=c.map((z,k)=>z-a[k]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
    const nf=[],normals=[],incident=nv.map(()=>[]);
    for(const f of faces){const ids=f.map(i=>remap[i]);if(new Set(ids).size<3)continue;const raw=normal(...f.map(i=>vertices[i])),len=Math.hypot(...raw);if(len<=1e-16)continue;const id=nf.length;nf.push(ids);normals.push(raw.map(v=>v/len));for(const i of ids)incident[i].push(id);}
    const valid=id=>{const norm=normal(...nf[id].map(i=>nv[i]));return norm.reduce((n,v,k)=>n+v*normals[id][k],0)>1e-12;};
    // Quantization may put a very thin rim triangle exactly on a straight
    // line. Keep the closed topology: nudge a shared XY vertex by the smallest
    // available lattice step, only if every incident face keeps its winding.
    // Z never changes, so both a flat back and total depth remain exact.
    const occupied=new Set(nv.map(a=>a.join(",")));
    for(let pass=0;pass<3;pass++)for(let f=0;f<nf.length;f++)if(!valid(f)){
      let repaired=false;
      for(let r=1;r<=3&&!repaired;r++)for(const id of nf[f]){
        if(repaired)break;
        const old=nv[id];
        for(let y=-r;y<=r&&!repaired;y++)for(let x=-r;x<=r&&!repaired;x++){
          if(Math.max(Math.abs(x),Math.abs(y))!==r)continue;
          const q=[Math.round((old[0]+x*.0001)*10000)/10000,Math.round((old[1]+y*.0001)*10000)/10000,old[2]];
          if(Math.abs(q[0])>.5||Math.abs(q[1])>.5||occupied.has(q.join(",")))continue;
          nv[id]=q;
          if(incident[id].every(valid)){occupied.delete(old.join(","));occupied.add(q.join(","));repaired=true;}else nv[id]=old;
        }
      }
    }
    if(nf.some((_,i)=>!valid(i)))return empty();
    if(!nf.length||nf.length>120000)return empty();
    const mesh={kind:"mesh",tri:nf.length,v:nf.flatMap(f=>f.flatMap(i=>nv[i])),dims:hi.map((v,k)=>Math.round((v-lo[k])/dim*10000)/10000)};
    const az=num("viewAz",-3600,3600,25)*Math.PI/180,el=num("viewEl",-90,90,50)*Math.PI/180;
    const ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
    const pv=nv.map(a=>{const y=a[0]*sa+a[1]*ca;return [a[0]*ca-a[1]*sa,y*se-a[2]*ce,y*ce+a[2]*se];});
    let bx=Infinity,by=Infinity,ex=-Infinity,ey=-Infinity;
    for(const a of pv){bx=Math.min(bx,a[0]);by=Math.min(by,a[1]);ex=Math.max(ex,a[0]);ey=Math.max(ey,a[1]);}
    const margin=Math.min(num("margin",0,60,12),Math.max(0,Math.min(W,H)/2-.001));
    const scale=Math.min(num("size",.001,2000,155),(W-2*margin)/Math.max(1e-10,ex-bx),(H-2*margin)/Math.max(1e-10,ey-by));
    const dx=W/2-(bx+ex)/2*scale,dy=H/2-(by+ey)/2*scale,pen=Math.round(num("layer",0,11,0));
    const edges=new Map();
    for(const f of nf){const [a,b,c]=f.map(i=>pv[i]),sign=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);for(let j=0;j<3;j++){const a=f[j],b=f[(j+1)%3],key=a<b?a+":"+b:b+":"+a;const e=edges.get(key);if(e)e.signs.push(sign);else edges.set(key,{a,b,signs:[sign]});}}
    const res=256,px=Math.max(ex-bx,ey-by,1e-6)/(res-2),xx=bx-px,yy=by-px;
    let zbuf;
    if(p.hidden!==false){
      zbuf=new Float64Array(res*res);zbuf.fill(-Infinity);
      for(const f of nf){const [a,b,c]=f.map(i=>[(pv[i][0]-xx)/px,(pv[i][1]-yy)/px,pv[i][2]]),det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-10)continue;
        const xl=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xr=Math.min(res-1,Math.ceil(Math.max(a[0],b[0],c[0]))),yl=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),yr=Math.min(res-1,Math.ceil(Math.max(a[1],b[1],c[1])));
        for(let y=yl;y<=yr;y++)for(let x=xl;x<=xr;x++){const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/det,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/det,w=1-u-v;if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8)zbuf[y*res+x]=Math.max(zbuf[y*res+x],u*a[2]+v*b[2]+w*c[2]);}
      }
    }
    const visible=a=>{
      if(!zbuf)return true;const x=Math.floor((a[0]-xx)/px),y=Math.floor((a[1]-yy)/px);
      if(x<1||x>=res-1||y<1||y>=res-1)return true;
      // A conservative neighbourhood avoids false cuts on steep visible rims
      // caused by comparing an edge to the centre of an adjacent depth pixel.
      let depth=Infinity;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)depth=Math.min(depth,zbuf[(y+j)*res+x+i]);
      return a[2]>=depth-px*.7;
    };
    const gridEvery=Math.round(num("every",1,12,2)),drawing=[],silhouette=[];
    const gridCoord=(v,axis)=>{if(!geometry.grid)return false;const {ox,oy,cell,stepX,stepY}=geometry.grid,raw=v*dim+(lo[axis]+hi[axis])/2,origin=axis===0?ox:oy,t=(raw-origin)/(axis===0?(stepX||cell):(stepY||cell));return Math.abs(t-Math.round(t))<.02&&Math.round(t)%gridEvery===0;};
    const tubeGrid=new Map();
    for(const [a,b,group,ordinal] of geometry.gridEdges||[])if(ordinal%gridEvery===0){const A=remap[a],B=remap[b];tubeGrid.set(A<B?A+":"+B:B+":"+A,group);}
    const selected=[];
    for(const e of edges.values()){
      const a=nv[e.a],b=nv[e.b],sil=e.signs.length===1||e.signs.some(s=>s>1e-10)&&e.signs.some(s=>s<-1e-10);
      const vertical=Math.abs(a[0]-b[0])<1e-8&&gridCoord(a[0],0),horizontal=Math.abs(a[1]-b[1])<1e-8&&gridCoord(a[1],1),grid=mode==="Tubes"?tubeGrid.has(e.a<e.b?e.a+":"+e.b:e.b+":"+e.a):vertical||horizontal;
      if(sil||p.drawing==="Mesh edges"||p.drawing!=="Silhouette"&&grid)selected.push({...e,sil,group:p.drawing!=="Mesh edges"&&grid?(mode==="Tubes"?tubeGrid.get(e.a<e.b?e.a+":"+e.b:e.b+":"+e.a):vertical?"x:"+a[0]:"y:"+a[1]):sil?"sil":null,draw:p.drawing==="Silhouette"?sil:p.drawing==="Mesh edges"||grid||sil&&p.outline!==false});
    }
    const stride=Math.max(1,Math.ceil(selected.length/18000));
    const emit=(a,b,list,group)=>{const A=[dx+a[0]*scale,dy+a[1]*scale],B=[dx+b[0]*scale,dy+b[1]*scale];if(Math.hypot(A[0]-B[0],A[1]-B[1])>1e-7&&list.length<45000)list.push({pts:[A,B],closed:false,layer:pen,group});};
    for(let i=0;i<selected.length;i++){
      const e=selected[i];if((i%stride&&!e.sil)||(zbuf&&e.signs.every(s=>s<=1e-10)))continue;
      const a=pv[e.a],b=pv[e.b],count=zbuf?Math.min(300,Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/px*2))):1;
      let start=visible(a)?a:null,was=!!start,previous=a;
      const output=(u,v)=>{if(e.draw)emit(u,v,drawing,e.group);if(e.sil)emit(u,v,silhouette,"sil");};
      for(let j=1;j<=count;j++){
        const q=a.map((v,k)=>v+(b[k]-v)*j/count),on=visible(q);
        if(on!==was){let l=previous,r=q;for(let k=0;k<5;k++){const m=l.map((v,k)=>(v+r[k])/2);if(visible(m)===was)l=m;else r=m;}const mid=l.map((v,k)=>(v+r[k])/2);if(was&&start)output(start,mid);else start=mid;}
        if(on&&j===count&&start)output(start,q);previous=q;was=on;
      }
    }
    // Join each lattice line independently, so crossing grid lines never turn
    // into each other. This avoids a pen lift at every mesh cell.
    const chains=paths=>{
      const out=[],groups=new Map(),key=pt=>pt.map(v=>Math.round(v*1e6)).join(",");
      for(const q of paths){if(!q.group){out.push({pts:q.pts,closed:false,layer:q.layer});continue;}if(!groups.has(q.group))groups.set(q.group,[]);groups.get(q.group).push(q);}
      for(const list of groups.values()){
        const adj=new Map(),used=new Set();
        list.forEach((q,i)=>q.pts.forEach(pt=>{const k=key(pt);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}));
        const grow=(i,start)=>{
          const pts=[start],first=key(start);let tail=first;
          while(!used.has(i)){used.add(i);const q=list[i],next=key(q.pts[0])===tail?q.pts[1]:q.pts[0];pts.push(next);tail=key(next);const candidate=(adj.get(tail)||[]).find(j=>!used.has(j));if(candidate===undefined)break;i=candidate;}
          const closed=tail===first;if(closed)pts.pop();if(pts.length>=2)out.push({pts,closed,layer:pen});
        };
        for(const [k,ids] of adj)if(ids.length!==2)for(const i of ids)if(!used.has(i))grow(i,list[i].pts.find(pt=>key(pt)===k));
        for(let i=0;i<list.length;i++)if(!used.has(i))grow(i,list[i].pts[0]);
      }
      return out;
    };
    const simplify=(pts,tolerance)=>{
      if(pts.length<3)return pts;
      const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const stack=[[0,pts.length-1]];
      while(stack.length){const [l,r]=stack.pop(),a=pts[l],b=pts[r],vx=b[0]-a[0],vy=b[1]-a[1],len=vx*vx+vy*vy;let best=tolerance*tolerance,id=-1;
        for(let i=l+1;i<r;i++){const p=pts[i],t=len?Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/len)):0,d=(p[0]-a[0]-t*vx)**2+(p[1]-a[1]-t*vy)**2;if(d>best){best=d;id=i;}}
        if(id>=0){keep[id]=1;stack.push([l,id],[id,r]);}
      }
      return pts.filter((_,i)=>keep[i]);
    };
    const style=ins?.[1];
    const styled=paths=>{
      paths=chains(paths);
      if(!isStyle(style)||style.mode==="Solid")return {paths};
      const length=paths.reduce((n,q)=>n+pathLength(q.pts,q.closed),0),out=[];
      const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
      const st={...style,dash:Math.max(.1,finite(style.dash,4)),gap:Math.max(.1,finite(style.gap,3),length/4000),vary:Math.max(0,Math.min(1,finite(style.vary,0))),phase:Math.max(0,finite(style.phase,0)),seed:finite(style.seed,4)};
      for(let i=0;i<paths.length;i+=32)for(const q of applyStyle({paths:paths.slice(i,i+32)},st).paths)out.push({...q,pts:simplify(q.pts,.005)});
      let tolerance=.01;while(out.reduce((n,q)=>n+q.pts.length,0)>90000&&tolerance<=10){for(const q of out)q.pts=simplify(q.pts,tolerance);tolerance*=2;}
      return {paths:out};
    };
    return [styled(drawing),styled(silhouette),mesh];
  },
};
