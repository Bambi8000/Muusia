import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "aaltoilu",
    name: "Wave", cat: "mod", group: "deform", ins: [Pin("paths"),Pin("paths","Wave sources")], outs: [Pin("paths")],
    desc: "Deform incoming paths with Along path waves, circular Radial waves or multi-source Interference. The original mode follows each path independently. The new modes share a canvas-space field: wire marker centres to Wave sources or use the fallback centre/pair. Wavelength is in paper mm; Phase degrees moves the field, Decay attenuates distance, and Displacement angle controls the common direction. No automatic fit or crop: leave room for the amplitude.",
    params: [
      {key:'mode',label:'Wave field',type:'select',options:['Along path','Radial','Interference'],def:'Along path'},
      {key:'phaseDeg',label:'Phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.mode&&p.mode!=='Along path'},
      {key:'angle',label:'Displacement angle °',type:'slider',min:-180,max:180,step:1,def:90,showIf:p=>p.mode&&p.mode!=='Along path'},
      {key:'decay',label:'Decay / 100 mm',type:'slider',min:0,max:4,step:.05,def:.15,showIf:p=>p.mode&&p.mode!=='Along path'},
      {key:'sourceX',label:'Source X mm',type:'slider',min:0,max:594,step:1,def:148.5,showIf:p=>p.mode&&p.mode!=='Along path'},
      {key:'sourceY',label:'Source Y mm',type:'slider',min:0,max:594,step:1,def:105,showIf:p=>p.mode&&p.mode!=='Along path'},
      {key:'separation',label:'Source separation mm',type:'slider',min:0,max:180,step:1,def:65,showIf:p=>p.mode==='Interference'},
      { key: "amp", label: "Amplitude mm", type: "slider", min: 0, max: 20, step: 0.25, def: 3 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 2, max: 120, step: 1, def: 30 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.05, def: 0, showIf:p=>!p.mode||p.mode==='Along path' },
    ],
    _sources(ins,p){const paths=ins?.[1]?.paths||[];if(paths.length)return paths.slice(0,24).filter(q=>q.pts?.length).map(q=>q.closed?q.pts.reduce((a,b)=>[a[0]+b[0]/q.pts.length,a[1]+b[1]/q.pts.length],[0,0]):q.pts[0]);const x=+p.sourceX||0,y=+p.sourceY||0,d=Math.max(0,+p.separation||0)/2;return p.mode==='Interference'?[[x-d,y],[x+d,y]]:[[x,y]];},
    overlay(p,c,ins){return p.mode&&p.mode!=='Along path'?this._sources(ins,p).map(q=>({kind:'point',x:q[0],y:q[1]})):[];},
    compute(ins, p) {
      if(p.mode&&p.mode!=='Along path'){
       const src=ins[0]||EMPTY,amp=Math.max(-200,Math.min(200,+p.amp||0));if(!amp)return src;
       const wl=Math.max(.5,Math.abs(+p.wl||30)),phase=(+p.phaseDeg||0)*Math.PI/180,angle=(+p.angle||0)*Math.PI/180,decay=Math.max(0,Math.min(20,+p.decay||0)),sources=this._sources(ins,p),length=src.paths.reduce((s,q)=>s+q.pts.reduce((n,v,i)=>n+(i?Math.hypot(v[0]-q.pts[i-1][0],v[1]-q.pts[i-1][1]):0),0),0),step=Math.max(.3,wl/18,length/105000);
       return {paths:src.paths.map(path=>({...path,pts:resample(path.pts,path.closed,step).map(([x,y])=>{let v=0;for(const q of sources){const d=Math.hypot(x-q[0],y-q[1]);v+=Math.sin(d/wl*Math.PI*2-phase)*Math.exp(-d*decay/100);}v*=amp/Math.max(1,sources.length);return [x+Math.cos(angle)*v,y+Math.sin(angle)*v];})}))};
      }
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.8, p.wl / 14));
        let d = 0;
        const out = pts.map((pt, i) => {
          if (i > 0) d += Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]);
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          const off = Math.sin((d / Math.max(0.5, p.wl)) * Math.PI * 2 + p.phase) * p.amp;
          return [pt[0] + (-ty / tl) * off, pt[1] + (tx / tl) * off];
        });
        return { ...path, pts: out };
      });
      return { paths };
    },
  
};
