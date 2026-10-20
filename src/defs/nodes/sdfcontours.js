import { Pin, EMPTY, pathLength } from "../helpers.js";

export default {
  key: "sdfcontours",
    name: "SDF Contours",
    cat: "mod",
    group: "deform",
    desc: "Distance-field isolines around ALL input geometry: unlike per-path Offset, nearby shapes merge into one smooth halo, like metaballs. Start/step/count set the contour distances; Inside adds negative offsets within closed shapes. Cell controls field resolution. Soft union rasterizes filled regions or thickened strokes, builds a signed-distance field, then Gaussian-blends that field before tracing. Blend radius softens and joins nearby forms independently of Contour offset, which may be zero or negative. Even-odd preserves counters and cancels overlapping fills; Union treats each closed outline as solid. Open paths use Stroke width in either interpretation. Source interiors remain present at offset zero; large blends can close small holes. Negative offset erodes the result. Resolution adapts across the whole sheet, never truncating the last contours. Keep source retains the original paths as well.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Field mode", type: "select", options: ["Distance contours", "Soft union"], def: "Distance contours" },
      { key: "blend", label: "Blend radius mm", type: "slider", min: 0, max: 20, step: .5, def: 4, showIf: p => p.mode === "Soft union" },
      { key: "softOffset", label: "Contour offset mm", type: "slider", min: -20, max: 20, step: .5, def: 0, showIf: p => p.mode === "Soft union" },
      { key: "interpretation", label: "Interpretation", type: "select", options: ["Closed fills", "Stroked paths"], def: "Closed fills", showIf: p => p.mode === "Soft union" },
      { key: "fillRule", label: "Fill rule", type: "select", options: ["Even-odd", "Union"], def: "Even-odd", showIf: p => p.mode === "Soft union" && p.interpretation !== "Stroked paths" },
      { key: "softStroke", label: "Stroke width mm", type: "slider", min: .2, max: 12, step: .1, def: 1, showIf: p => p.mode === "Soft union" },
      { key: "softCell", label: "Soft field cell mm", type: "slider", min: .2, max: 2, step: .1, def: .6, showIf: p => p.mode === "Soft union" },
      { key: "start", label: "First contour mm", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3, showIf: p => p.mode !== "Soft union" },
      { key: "step", label: "Contour step mm", type: "slider", min: 0.5, max: 15, step: 0.5, def: 3, showIf: p => p.mode !== "Soft union" || p.count > 1 },
      { key: "count", label: "Contours", type: "slider", min: 1, max: 8, step: 1, def: 3 },
      { key: "inside", label: "Inside contours too", type: "check", def: false, showIf: p => p.mode !== "Soft union" || p.softOffset > 0 || p.count > 1 && p.softOffset + p.step * (p.count - 1) > 0 },
      { key: "cell", label: "Field cell mm", type: "slider", min: 1, max: 4, step: 0.25, def: 1.8, showIf: p => p.mode !== "Soft union" },
      { key: "keep", label: "Keep source", type: "check", def: true },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
      { key: "layer", label: "Contour pen", type: "pen", def: 0 }
    ],
    _softNumber(v,d,lo,hi) { return Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d)); },
    _softDistance(mask,w,h,target) {
      // Exact squared Euclidean distance transform, separable lower envelopes.
      const large=1e12,field=new Float64Array(w*h),max=Math.max(w,h);
      const f=new Float64Array(max),d=new Float64Array(max),v=new Int32Array(max),z=new Float64Array(max+1);
      const line=n=>{let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
        for(let q=1;q<n;q++){let s;do{s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*(q-v[k]));if(s<=z[k])k--;else break;}while(k>=0);if(k<0){k=0;v[0]=q;z[0]=-Infinity;z[1]=Infinity;}else{k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}}
        k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])**2+f[v[k]];}
      };
      for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=mask[y*w+x]===target?0:large;line(h);for(let y=0;y<h;y++)field[y*w+x]=d[y];}
      for(let y=0;y<h;y++){for(let x=0;x<w;x++)f[x]=field[y*w+x];line(w);for(let x=0;x<w;x++)field[y*w+x]=d[x];}
      return field;
    },
    _softTrace(field,nx,ny,cell,origin,levels,minLength,layer) {
      const paths=[];
      for(const level of levels){
        const nodes=new Map(),edges=[];
        const add=(a,b)=>{edges.push([a,b]);};
        for(let r=0;r<ny-1;r++)for(let c=0;c<nx-1;c++){
          const tl=field[r*nx+c],tr=field[r*nx+c+1],br=field[(r+1)*nx+c+1],bl=field[(r+1)*nx+c];
          const idx=(tl>level?8:0)|(tr>level?4:0)|(br>level?2:0)|(bl>level?1:0);if(idx===0||idx===15)continue;
          const edge=(side)=>{
            const horizontal=side==='T'||side==='B',rr=r+(side==='B'?1:0),cc=c+(side==='R'?1:0);
            const key=(horizontal?'h':'v')+(rr*nx+cc);
            if(!nodes.has(key)){
              const a=horizontal?(side==='T'?tl:bl):(side==='L'?tl:tr),b=horizontal?(side==='T'?tr:br):(side==='L'?bl:br);
              const t=Math.abs(b-a)>1e-12?Math.max(0,Math.min(1,(level-a)/(b-a))):.5;
              nodes.set(key,{pt:[origin+(cc+(horizontal?t:0))*cell,origin+(rr+(horizontal?0:t))*cell],links:[]});
            }return key;
          };
          const join=(a,b)=>add(edge(a),edge(b));
          switch(idx){
            case 1:case 14:join('L','B');break;case 2:case 13:join('B','R');break;
            case 3:case 12:join('L','R');break;case 4:case 11:join('T','R');break;
            case 6:case 9:join('T','B');break;case 7:case 8:join('L','T');break;
            case 5:case 10:{const centre=(tl+tr+br+bl)/4;const a=idx===5?centre>level:centre<=level;
              if(a){join('L','T');join('B','R');}else{join('L','B');join('T','R');}break;}
          }
        }
        edges.forEach(([a,b],i)=>{nodes.get(a).links.push(i);nodes.get(b).links.push(i);});
        const used=new Uint8Array(edges.length);
        const walk=start=>{let current=start;const chain=[nodes.get(start).pt];let closed=false;
          while(true){const i=nodes.get(current).links.find(i=>!used[i]);if(i===undefined)break;used[i]=1;const [a,b]=edges[i];current=current===a?b:a;if(current===start){closed=true;break;}chain.push(nodes.get(current).pt);}
          // Drop only collinear samples; small rounded corners remain intact.
          const simple=[];for(const pt of chain){while(simple.length>=2){const a=simple.at(-2),b=simple.at(-1),cross=(b[0]-a[0])*(pt[1]-b[1])-(b[1]-a[1])*(pt[0]-b[0]);if(Math.abs(cross)>cell*cell*.001)break;simple.pop();}simple.push(pt);}
          if(simple.length>=(closed?3:2)&&pathLength(simple,closed)>=minLength)paths.push({pts:simple,closed,layer});
        };
        for(const [key,node]of nodes)if(node.links.length===1&&!used[node.links[0]])walk(key);
        for(const [key,node]of nodes)if(node.links.some(i=>!used[i]))walk(key);
      }return paths;
    },
    _softCompute(ins,p,ctx,coarsen=1) {
      const src=ins?.[0]||EMPTY,n=this._softNumber,W=n(ctx.W,297,1,100000),H=n(ctx.H,210,1,100000);
      const blend=n(p.blend,4,0,60),offset=n(p.softOffset,0,-60,60),step=n(p.step,3,.1,30),count=Math.round(n(p.count,3,1,8));
      const padding=Math.abs(offset)+step*(count-1)+blend*3+5;
      const segments=[],polys=[];let totalLength=0;
      for(const path of src.paths||[]){const pts=path?.pts;if(!Array.isArray(pts)||pts.length<2||!pts.every(q=>Array.isArray(q)&&Number.isFinite(q[0])&&Number.isFinite(q[1])))continue;
        if(p.interpretation!=='Stroked paths'&&path.closed&&pts.length>=3)polys.push(pts);
        if(p.interpretation==='Stroked paths'||!path.closed){for(let i=0;i<pts.length-(path.closed?0:1);i++){const a=pts[i],b=pts[(i+1)%pts.length];segments.push([a,b]);totalLength+=Math.min(W+H,Math.hypot(b[0]-a[0],b[1]-a[1]));}}
      }
      if(!segments.length&&!polys.length)return EMPTY;
      const stroke=n(p.softStroke,1,.1,30);
      const cell=Math.max(n(p.softCell,.6,.15,4),blend/50,Math.sqrt((W+padding*2)*(H+padding*2)/200000),Math.sqrt(totalLength*stroke/6000000))*coarsen;
      const nx=Math.ceil((W+2*padding)/cell)+1,ny=Math.ceil((H+2*padding)/cell)+1,origin=-padding,mask=new Uint8Array(nx*ny);
      const px=x=>(x-origin)/cell,py=y=>(y-origin)/cell;
      if(polys.length){
        if(p.fillRule==='Union'){
          for(const pts of polys){const scan=new Map();for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length];if(a[1]===b[1])continue;
              const lo=Math.max(0,Math.ceil(py(Math.min(a[1],b[1])))),hi=Math.min(ny-1,Math.ceil(py(Math.max(a[1],b[1])))-1);
              for(let r=lo;r<=hi;r++){if(!scan.has(r))scan.set(r,[]);scan.get(r).push(px(a[0]+(b[0]-a[0])*(origin+r*cell-a[1])/(b[1]-a[1])));}}
            for(const [r,xs]of scan){xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)for(let c=Math.max(0,Math.ceil(xs[k]));c<=Math.min(nx-1,Math.floor(xs[k+1]));c++)mask[r*nx+c]=1;}
          }
        }else{
          const scan=Array.from({length:ny},()=>[]);
          for(const pts of polys)for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length];if(a[1]===b[1])continue;
            const lo=Math.max(0,Math.ceil(py(Math.min(a[1],b[1])))),hi=Math.min(ny-1,Math.ceil(py(Math.max(a[1],b[1])))-1);
            for(let r=lo;r<=hi;r++)scan[r].push(px(a[0]+(b[0]-a[0])*(origin+r*cell-a[1])/(b[1]-a[1])));}
          for(let r=0;r<ny;r++){const xs=scan[r].sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)for(let c=Math.max(0,Math.ceil(xs[k]));c<=Math.min(nx-1,Math.floor(xs[k+1]));c++)mask[r*nx+c]=1;}
        }
      }
      const radius=stroke/(2*cell),reach=Math.max(radius,.51);
      for(const [a,b]of segments){
        const ax=px(a[0]),ay=py(a[1]),bx=px(b[0]),by=py(b[1]),dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
        const lo=Math.max(0,Math.ceil(Math.min(ay,by)-reach)),hi=Math.min(ny-1,Math.floor(Math.max(ay,by)+reach));
        for(let r=lo;r<=hi;r++){let t0=0,t1=1;if(Math.abs(dy)>1e-12){const u=(r-reach-ay)/dy,v=(r+reach-ay)/dy;t0=Math.max(0,Math.min(u,v));t1=Math.min(1,Math.max(u,v));if(t0>t1)continue;}
          const left=Math.max(0,Math.ceil(Math.min(ax+dx*t0,ax+dx*t1)-reach)),right=Math.min(nx-1,Math.floor(Math.max(ax+dx*t0,ax+dx*t1)+reach));
          for(let c=left;c<=right;c++){const t=len2>1e-18?Math.max(0,Math.min(1,((c-ax)*dx+(r-ay)*dy)/len2)):0;if(Math.hypot(c-ax-dx*t,r-ay-dy*t)<=reach)mask[r*nx+c]=1;}
        }
      }
      if(!mask.some(v=>v))return EMPTY;
      const toInk=this._softDistance(mask,nx,ny,1),toPaper=this._softDistance(mask,nx,ny,0);let field=new Float64Array(mask.length);
      for(let i=0;i<field.length;i++)field[i]=(mask[i]?-1:1)*Math.max(0,Math.sqrt(mask[i]?toPaper[i]:toInk[i])-.5)*cell;
      const originalField=field.slice(),sigma=blend/(2*cell);
      if(sigma>.08){const R=Math.ceil(3*sigma),kernel=[];let sum=0;for(let i=-R;i<=R;i++){const w=Math.exp(-i*i/(2*sigma*sigma));kernel.push(w);sum+=w;}
        for(const horizontal of [true,false]){const out=new Float64Array(field.length);
          for(let r=0;r<ny;r++)for(let c=0;c<nx;c++){let value=0;for(let i=-R;i<=R;i++){const x=horizontal?Math.max(0,Math.min(nx-1,c+i)):c,y=horizontal?r:Math.max(0,Math.min(ny-1,r+i));value+=field[y*nx+x]*kernel[i+R];}out[r*nx+c]=value/sum;}field=out;}
      }
      // Preserve the source interior: smoothing can bridge a concave gap,
      // but must not erase a narrow original stroke. Negative offset erodes.
      for(let i=0;i<field.length;i++)field[i]=Math.min(field[i],originalField[i]);
      const levels=[];for(let i=0;i<count;i++){const d=offset+i*step;levels.push(d);if(p.inside&&d>0)levels.push(-d);}
      let paths=this._softTrace(field,nx,ny,cell,origin,[...new Set(levels)],n(p.minlen,5,0,1000),Math.round(n(p.layer,0,0,11)));
      const cost=paths.reduce((s,q)=>s+q.pts.length,0);if(cost>108000&&coarsen<8)return this._softCompute(ins,p,ctx,coarsen*Math.max(1.4,Math.sqrt(cost/100000)));
      // Clip contour segments, not coordinates: a contour crossing the sheet
      // boundary stays open instead of acquiring a fictitious border edge.
      const clipped=[];
      const clip=(a,b)=>{let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const [v,q]of [[-dx,a[0]],[dx,W-a[0]],[-dy,a[1]],[dy,H-a[1]]]){if(Math.abs(v)<1e-12){if(q<0)return null;}else{const t=q/v;if(v<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return [[a[0]+lo*dx,a[1]+lo*dy],[a[0]+hi*dx,a[1]+hi*dy]];};
      for(const path of paths){if(path.pts.every(([x,y])=>x>=0&&x<=W&&y>=0&&y<=H)){clipped.push(path);continue;}let run=[];const flush=()=>{if(run.length>1)clipped.push({...path,pts:run,closed:false});run=[];};for(let i=0;i<path.pts.length-(path.closed?0:1);i++){const s=clip(path.pts[i],path.pts[(i+1)%path.pts.length]);if(!s){flush();continue;}if(run.length&&Math.hypot(run.at(-1)[0]-s[0][0],run.at(-1)[1]-s[0][1])>1e-7)flush();if(!run.length)run.push(s[0]);run.push(s[1]);}flush();}
      if(p.keep)clipped.unshift(...src.paths.map(q=>({...q,pts:q.pts.map(a=>a.slice())})));
      return {paths:clipped};
    },
    compute(ins, p, ctx) {
      if(p.mode === "Soft union")return this._softCompute(ins,p,ctx);
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const maxD = p.start + p.step * Math.max(0, p.count - 1) + p.cell * 2;
      /* segments of all paths, bucketed for nearest-distance queries */
      const segs = [];
      for (const pa of src.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
        }
      }
      if (!segs.length) return EMPTY;
      const bs = Math.max(4, p.cell * 3);
      const bkey = (x, y) => Math.floor(x / bs) + "," + Math.floor(y / bs);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]);
        const y0 = Math.min(s[1], s[3]), y1 = Math.max(s[1], s[3]);
        for (let by = Math.floor(y0 / bs); by <= Math.floor(y1 / bs); by++) {
          for (let bx = Math.floor(x0 / bs); bx <= Math.floor(x1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k);
            if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
        }
      });
      const segDist = (x, y, s) => {
        const dx = s[2] - s[0], dy = s[3] - s[1];
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
      };
      const distAt = (x, y) => {
        /* expanding ring search over buckets, bounded by maxD */
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        let best = maxD + 1;
        const maxR = Math.ceil(maxD / bs) + 1;
        for (let r = 0; r <= maxR; r++) {
          if ((r - 1) * bs > best) break;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const a = buckets.get((bx + dx) + "," + (by + dy));
              if (!a) continue;
              for (const i of a) {
                const d = segDist(x, y, segs[i]);
                if (d < best) best = d;
              }
            }
          }
        }
        return best;
      };
      /* sign: inside any closed path -> negative, ALWAYS (so default contours
         are outside-only; the Inside option merely adds negative levels) */
      const closedPolys = src.paths.filter((pa) => pa.closed && pa.pts.length >= 3).map((pa) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of pa.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        return { poly: pa.pts, x0, y0, x1, y1 };
      });
      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const signAt = (x, y) => {
        for (const cp of closedPolys) {
          if (x < cp.x0 || x > cp.x1 || y < cp.y0 || y > cp.y1) continue;
          if (pip(x, y, cp.poly)) return -1;
        }
        return 1;
      };
      const cell = Math.max(0.8, p.cell);
      const cols = Math.min(260, Math.max(4, Math.round(W / cell) + 1));
      const rows = Math.min(380, Math.max(4, Math.round(H / cell) + 1));
      const gx = (c) => (c / (cols - 1)) * W;
      const gy = (r) => (r / (rows - 1)) * H;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gx(c), y = gy(r);
          F[r * cols + c] = distAt(x, y) * (closedPolys.length ? signAt(x, y) : 1);
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      if (p.keep) src.paths.forEach((pa) => paths.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }));
      const segsOut = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      const levels = [];
      for (let k = 0; k < Math.max(1, Math.round(p.count)); k++) {
        const d = p.start + p.step * k;
        levels.push(d);
        if (p.inside) levels.push(-d);
      }
      for (const lvl of levels) {
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
            const S = (A, B) => segsOut.push([A, B]);
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
      const items = segsOut.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
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
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return { paths };
    }
  
};
