import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
  key: "lens",
    name: "Lens", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    desc: "Bulge preserves the original radial lens. Twist turns the interior with a smooth radial falloff; Vortex winds more tightly near its centre. Twist angle accepts Frame wires. New modes densify paths uniformly before deformation and preserve geometry outside Radius. No fit or crop is applied. Bulge keeps legacy output at default settings.",
    params: [
      {key:'mode',label:'Mode',type:'select',options:['Bulge','Twist','Vortex'],def:'Bulge'},
      {key:'twist',label:'Twist angle °',type:'slider',min:-720,max:720,step:1,def:180,showIf:p=>p.mode==='Twist'||p.mode==='Vortex'},
      {key:'falloff',label:'Falloff',type:'slider',min:.5,max:4,step:.1,def:2,showIf:p=>p.mode==='Twist'||p.mode==='Vortex'},
      {key:'step',label:'Sample mm',type:'slider',min:.3,max:4,step:.1,def:1,showIf:p=>p.mode==='Twist'||p.mode==='Vortex'},
      { key: "useCenter", label: "Use canvas center", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150, showIf:p=>!p.useCenter },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100, showIf:p=>!p.useCenter },
      { key: "radius", label: "Radius mm", type: "slider", min: 10, max: 300, step: 1, def: 90 },
      { key: "strength", label: "Strength (− pinch, + bulge)", type: "slider", min: -0.9, max: 0.9, step: 0.05, def: 0.4, showIf:p=>!p.mode||p.mode==='Bulge' },
    ],
    overlay(p, ctx) {
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      return [{ kind: "circle", cx, cy, r: p.radius }, { kind: "point", x: cx, y: cy }];
    },
    compute(ins, p, ctx) {

      if(p.mode==='Twist'||p.mode==='Vortex'){
        const src=ins[0]||EMPTY,n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d));if(src.paths.length>20000||src.paths.reduce((n,q)=>n+q.pts.length,0)>120000)return EMPTY;const angle=n('twist',180,-1e5,1e5)*Math.PI/180;if(!angle)return src;
        const cx=p.useCenter?ctx.W/2:n('cx',150,-1e4,1e4),cy=p.useCenter?ctx.H/2:n('cy',100,-1e4,1e4),r=n('radius',90,1,1000),power=n('falloff',2,.5,8),L=src.paths.reduce((n,q)=>n+pathLength(q.pts,q.closed),0),step=Math.max(n('step',1,.3,20),L/Math.max(1,110000-src.paths.length*2));
        return {paths:src.paths.map(q=>({...q,pts:resample(q.pts,q.closed,step).map(([x,y])=>{const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);if(d>=r||d<1e-9)return [x,y];const t=Math.pow(1-d/r,power),a=angle*t*(p.mode==='Vortex'?1/(.15+d/r):1),co=Math.cos(a),si=Math.sin(a);return [cx+dx*co-dy*si,cy+dx*si+dy*co];})}))};
      }
      const src = ins[0] || EMPTY;
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d >= p.radius || d < 0.001) return [x, y];
          const t = 1 - d / p.radius;
          const f = 1 + p.strength * t * t;
          return [cx + dx * f, cy + dy * f];
        }),
      }));
      return { paths };
    },
  
};
