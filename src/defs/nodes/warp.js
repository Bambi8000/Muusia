import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "warp",
    name: "Warp", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    desc: "Warp a drawing with four corner offsets, a smooth Grid lattice or piecewise bilinear Cell interpolation. Cell interpolation keeps horizontal and vertical runs straight inside each coarse cell and bends them at the shared edges. Prevent folds uniformly reduces displacement until every cell has positive corner Jacobians. Cell phase drives repeatable continuous lattice motion; edges stay fixed. The two original modes keep their original output.",
    params: [
      {key:'safeCells',label:'Prevent folds',type:'check',def:true,showIf:p=>p.mode==='Cell interpolation'},
      {key:'cellPhase',label:'Cell phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.mode==='Cell interpolation'},
      { key: "mode", label: "Mode", type: "select", options: ["4 corners", "Grid lattice", "Cell interpolation"], def: "4 corners" },
      { key: "tlx", label: "TL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "tly", label: "TL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trx", label: "TR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trY", label: "TR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "brx", label: "BR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bry", label: "BR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "blx", label: "BL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bly", label: "BL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "cells", label: "Grid cells", type: "slider", min: 2, max: 12, step: 1, def: 4 },
      { key: "amp", label: "Grid amp mm", type: "slider", min: 0, max: 60, step: 0.5, def: 15 },
      { key: "seed", label: "Grid seed", type: "seed", def: 21 },
    ],
    overlay(p,c){if(p.mode!=='Cell interpolation')return [];const n=Math.max(2,Math.min(24,Math.round(+p.cells||4)));return Array.from({length:(n+1)*2},(_,k)=>({kind:'poly',pts:k<=n?[[k*c.W/n,0],[k*c.W/n,c.H]]:[ [0,(k-n-1)*c.H/n],[c.W,(k-n-1)*c.H/n] ]}));},
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      let disp;
      if (p.mode === "4 corners") {
        disp = (x, y) => {
          const u = Math.max(0, Math.min(1, x / W)), v = Math.max(0, Math.min(1, y / H));
          const topX = p.tlx + (p.trx - p.tlx) * u, botX = p.blx + (p.brx - p.blx) * u;
          const topY = p.tly + (p.trY - p.tly) * u, botY = p.bly + (p.bry - p.bly) * u;
          return [topX + (botX - topX) * v, topY + (botY - topY) * v];
        };
      } else {
        const cellMode=p.mode==='Cell interpolation';
        const n = cellMode?Math.max(2,Math.min(24,Math.round(+p.cells||4))):Math.round(p.cells);
        const rng = mulberry32(p.seed * 359 + 41);
        const lat = [];
        for (let j = 0; j <= n; j++) {
          const row = [];
          for (let i = 0; i <= n; i++) {
            /* reunat paikoillaan, sisäpisteet satunnaisesti */
            const edge = i === 0 || j === 0 || i === n || j === n;
            if(!cellMode)row.push(edge?[0,0]:[(rng()-.5)*2*p.amp,(rng()-.5)*2*p.amp]);
            else{const a=(rng()-.5)*2*Math.max(0,Math.min(1000,+p.amp||0)),b=(rng()-.5)*2*Math.max(0,Math.min(1000,+p.amp||0)),phase=(+p.cellPhase||0)*Math.PI/180;row.push(edge?[0,0]:[a*Math.cos(phase)-b*Math.sin(phase),b*Math.cos(phase)+a*Math.sin(phase)]);}
          }
          lat.push(row);
        }
        if(cellMode&&p.safeCells!==false){
          const good=f=>{for(let j=0;j<n;j++)for(let i=0;i<n;i++){const A=lat[j][i],B=lat[j][i+1],C=lat[j+1][i],D=lat[j+1][i+1];for(const u of [0,1])for(const v of [0,1]){const dx=[W/n+f*((B[0]-A[0])*(1-v)+(D[0]-C[0])*v),f*((B[1]-A[1])*(1-v)+(D[1]-C[1])*v)],dy=[f*((C[0]-A[0])*(1-u)+(D[0]-B[0])*u),H/n+f*((C[1]-A[1])*(1-u)+(D[1]-B[1])*u)];if(dx[0]*dy[1]-dx[1]*dy[0]<W*H/n/n*.05)return false;}}return true;};let f=1;while(!good(f)&&f>1e-6)f*=.8;for(const row of lat)for(const q of row){q[0]*=f;q[1]*=f;}
        }
        const sm = cellMode?(t=>t):((t) => t * t * (3 - 2 * t));
        disp = (x, y) => {
          const fx = Math.max(0, Math.min(n - 0.0001, (x / W) * n));
          const fy = Math.max(0, Math.min(n - 0.0001, (y / H) * n));
          const i = Math.floor(fx), j = Math.floor(fy);
          const tx = sm(fx - i), ty = sm(fy - j);
          const a = lat[j][i], b = lat[j][i + 1], c = lat[j + 1][i], d = lat[j + 1][i + 1];
          return [
            (a[0] + (b[0] - a[0]) * tx) * (1 - ty) + (c[0] + (d[0] - c[0]) * tx) * ty,
            (a[1] + (b[1] - a[1]) * tx) * (1 - ty) + (c[1] + (d[1] - c[1]) * tx) * ty,
          ];
        };
      }
      const paths = src.paths.map((path) => ({
        ...path,
        pts: (p.mode==='Cell interpolation'?(()=>{const out=[],n=Math.max(2,Math.min(24,Math.round(+p.cells||4))),V=path.pts;for(let i=0;i<V.length-(path.closed?0:1);i++){const A=V[i],B=V[(i+1)%V.length],ts=[0];for(let k=1;k<n;k++)for(let axis=0;axis<2;axis++){const line=(axis?H:W)*k/n,d=B[axis]-A[axis],t=(line-A[axis])/d;if(t>1e-9&&t<1-1e-9)ts.push(t);}ts.sort((a,b)=>a-b);for(const t of [...new Set(ts)])out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}if(!path.closed&&V.length)out.push(V.at(-1).slice());return out;})():resample(path.pts, path.closed, 1.2)).map(([x, y]) => {
          const [dx, dy] = disp(x, y);
          return [x + dx, y + dy];
        }),
      }));
      return { paths };
    },
  
};
