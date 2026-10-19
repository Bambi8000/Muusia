import { Pin, EMPTY, PENS, mulberry32 } from "../helpers.js";

export default {
  key: "array",
    name: "Array", cat: "duo", ins: [Pin("paths")], outs: [Pin("paths")],
    desc: "Repeat a drawing as one motif. Linear preserves the original per-copy transform. Grid, Radial and Spiral arrange centred motifs at a controlled Size. Follow layout turns each copy with its trajectory. Helix 3D and Sphere 3D place flat motifs on tangent planes, then project them with one camera; these modes draw all copies, without solid-surface occlusion. New layouts bound the complete output to 118k points and reject oversized requests instead of omitting later copies. No fit or crop is applied. Pens can cycle per copy.",
    params: [
      {key:'layout',label:'Layout',type:'select',options:['Linear','Grid','Radial','Spiral','Helix 3D','Sphere 3D'],def:'Linear'},
      {key:'columns',label:'Columns',type:'slider',min:1,max:20,step:1,def:5,showIf:p=>p.layout==='Grid'},
      {key:'pitchX',label:'Grid pitch X mm',type:'slider',min:1,max:100,step:1,def:35,showIf:p=>p.layout==='Grid'},
      {key:'pitchY',label:'Grid pitch Y mm',type:'slider',min:1,max:100,step:1,def:35,showIf:p=>p.layout==='Grid'},
      {key:'radius',label:'Radius mm',type:'slider',min:1,max:150,step:1,def:65,showIf:p=>['Radial','Spiral','Helix 3D','Sphere 3D'].includes(p.layout)},
      {key:'turns',label:'Turns',type:'slider',min:.1,max:8,step:.1,def:2,showIf:p=>p.layout==='Spiral'||p.layout==='Helix 3D'},
      {key:'height',label:'Helix height mm',type:'slider',min:5,max:250,step:1,def:130,showIf:p=>p.layout==='Helix 3D'},
      {key:'start',label:'Start angle °',type:'slider',min:-180,max:180,step:1,def:0,showIf:p=>['Radial','Spiral','Helix 3D','Sphere 3D'].includes(p.layout)},
      {key:'motifSize',label:'Motif size mm',type:'slider',min:1,max:80,step:1,def:18,showIf:p=>p.layout&&p.layout!=='Linear'},
      {key:'follow',label:'Follow layout',type:'check',def:true,showIf:p=>p.layout==='Radial'||p.layout==='Spiral'},
      {key:'yaw',label:'View angle °',type:'slider',min:-180,max:180,step:1,def:25,showIf:p=>p.layout==='Helix 3D'||p.layout==='Sphere 3D'},
      {key:'elevation',label:'View elevation °',type:'slider',min:0,max:90,step:1,def:25,showIf:p=>p.layout==='Helix 3D'||p.layout==='Sphere 3D'},
      {key:'persp',label:'Perspective',type:'slider',min:0,max:.8,step:.05,def:0,showIf:p=>p.layout==='Helix 3D'||p.layout==='Sphere 3D'},
      { key: "count", label: "Copies", type: "slider", min: 2, max: 160, step: 1, def: 3 },
      { key: "dx", label: "Δ X mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 2, showIf:p=>!p.layout||p.layout==='Linear' },
      { key: "dy", label: "Δ Y mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 0, showIf:p=>!p.layout||p.layout==='Linear' },
      { key: "drot", label: "Δ Rotate ° / copy", type: "slider", min: -45, max: 45, step: 0.5, def: 0 },
      { key: "dscale", label: "Δ Scale % / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 0 },
      { key: "penPer", label: "Pen change per copy", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 16 },
    ],
    overlay(p,c){if(!p.layout||p.layout==='Linear')return [];if(['Radial','Spiral'].includes(p.layout))return [{kind:'circle',cx:c.W/2,cy:c.H/2,r:Math.max(1,+p.radius||65)}];return [{kind:'point',x:c.W/2,y:c.H/2}];},
    compute(ins, p, ctx) {

      if(p.layout&&p.layout!=='Linear'){
        const src=ins[0]||EMPTY,n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),count=Math.round(n('count',3,1,160)),total=src.paths.reduce((s,q)=>s+q.pts.length,0);if(!total||total*count>118000)return EMPTY;
        let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const q of src.paths)for(const [x,y]of q.pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}const sx=(x0+x1)/2,sy=(y0+y1)/2,sc=n('motifSize',18,1,200)/Math.max(.001,x1-x0,y1-y0),rad=Math.PI/180,az=n('yaw',25,-3600,3600)*rad,el=n('elevation',25,0,90)*rad,eye=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)],right=[-Math.sin(az),Math.cos(az),0],up=[-Math.cos(az)*Math.sin(el),-Math.sin(az)*Math.sin(el),Math.cos(el)],R=n('radius',65,1,1000),paths=[],columns=Math.round(n('columns',5,1,20)),rows=Math.ceil(count/columns);
        for(let i=0;i<count;i++){
          const rng=mulberry32(n('seed',16,-2e9,2e9)*77+i*991+3),jit=n('jit',0,0,100),jx=(rng()-.5)*2*jit,jy=(rng()-.5)*2*jit,t=count>1?i/(count-1):0,a=n('start',0,-3600,3600)*rad+(p.layout==='Radial'?i/count: t*n('turns',2,.1,20))*Math.PI*2;let center=[0,0,0],U=[1,0,0],V=[0,1,0],turn=n('drot',0,-3600,3600)*i*rad;
          if(p.layout==='Grid')center=[(i%columns-(columns-1)/2)*n('pitchX',35,1,500),(Math.floor(i/columns)-(rows-1)/2)*n('pitchY',35,1,500),0];
          if(p.layout==='Radial'||p.layout==='Spiral'){const r=p.layout==='Spiral'?R*(.1+.9*t):R;center=[r*Math.cos(a),r*Math.sin(a),0];if(p.follow)turn+=a+Math.PI/2;}
          if(p.layout==='Helix 3D'){center=[R*Math.cos(a),R*Math.sin(a),(t-.5)*n('height',130,5,1000)];U=[-Math.sin(a),Math.cos(a),0];V=[0,0,1];}
          if(p.layout==='Sphere 3D'){const z=1-2*(i+.5)/count,rr=Math.sqrt(1-z*z),aa=i*Math.PI*(3-Math.sqrt(5))+n('start',0,-3600,3600)*rad;center=[R*rr*Math.cos(aa),R*rr*Math.sin(aa),R*z];U=[-Math.sin(aa),Math.cos(aa),0];V=[-z*Math.cos(aa),-z*Math.sin(aa),rr];}
          const cc=Math.cos(turn),ss=Math.sin(turn),size=sc*Math.max(.02,1+n('dscale',0,-90,100)*i/100),is3=p.layout==='Helix 3D'||p.layout==='Sphere 3D';
          for(const q of src.paths)paths.push({...q,layer:p.penPer?i%PENS.length:q.layer,pts:q.pts.map(([x,y])=>{const u=(x-sx)*size,v=(y-sy)*size,xx=u*cc-v*ss,yy=u*ss+v*cc;if(!is3)return [ctx.W/2+center[0]+xx+jx,ctx.H/2+center[1]+yy+jy];const pt=center.map((z,k)=>z+U[k]*xx+V[k]*yy),depth=pt.reduce((s,v,k)=>s+v*eye[k],0),f=1/Math.max(.2,1-n('persp',0,0,.8)*depth/Math.max(ctx.W,ctx.H));return [ctx.W/2+pt.reduce((s,v,k)=>s+v*right[k],0)*f+jx,ctx.H/2-pt.reduce((s,v,k)=>s+v*up[k],0)*f+jy];})});
        }return {paths};
      }

      const src = ins[0] || EMPTY;
      const n = Math.round(p.count);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const paths = [];
      for (let i = 0; i < n; i++) {
        const rng = mulberry32(p.seed * 77 + i * 991 + 3);
        const jx = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const jy = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const tx = p.dx * i + jx, ty = p.dy * i + jy;
        const rad = ((p.drot * i) * Math.PI) / 180;
        const sc = 1 + (p.dscale * i) / 100;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        for (const path of src.paths) {
          paths.push({
            pts: path.pts.map(([x, y]) => {
              const dx0 = (x - cx) * sc, dy0 = (y - cy) * sc;
              return [cx + dx0 * ca - dy0 * sa + tx, cy + dx0 * sa + dy0 * ca + ty];
            }),
            closed: path.closed,
            layer: p.penPer ? i % PENS.length : path.layer,
          });
        }
      }
      return { paths };
    },
  
};
