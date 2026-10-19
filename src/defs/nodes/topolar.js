import { Pin, EMPTY, resample, noise2 } from "../helpers.js";

export default {
  key: "topolar",
    name: "To Polar",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    desc: "Wrap a drawing into polar rings or a continuous spiral. Morph blends from the original paper coordinates into the target; local noise varies the blend spatially. In Spiral, each horizontal revolution also increases radius by Spiral rise. The default Rings / Morph 100 preserves the original mapper. At Morph 0 the source passes through exactly. Wire Frame t through Math times 100 to Morph, or animate Start angle.",
    params: [
      {key:'mode',label:'Wrap',type:'select',options:['Rings','Spiral'],def:'Rings'},
      {key:'morph',label:'Morph %',type:'slider',min:0,max:100,step:1,def:100},
      {key:'rise',label:'Spiral rise %',type:'slider',min:0,max:100,step:1,def:65,showIf:p=>p.mode==='Spiral'},
      {key:'noise',label:'Morph variation %',type:'slider',min:0,max:100,step:1,def:0},
      {key:'noiseSize',label:'Variation size mm',type:'slider',min:5,max:160,step:1,def:65,showIf:p=>p.noise>0},
      {key:'seed',label:'Seed',type:'seed',def:17,showIf:p=>p.noise>0},
      { key: "rin", label: "Inner radius mm", type: "slider", min: 0, max: 80, step: 1, def: 15 },
      { key: "turns", label: "Turns", type: "slider", min: 0.25, max: 3, step: 0.05, def: 1 },
      { key: "start", label: "Start angle deg", type: "slider", min: 0, max: 360, step: 1, def: 270 },
      { key: "flip", label: "Top of canvas", type: "select", options: ["Outer edge", "Inner edge"], def: "Outer edge" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const morph=p.morph===undefined?1:Math.max(0,Math.min(1,+p.morph/100));if(morph===0)return src;
      const m = Math.max(0, p.margin);
      const rOut = Math.min(W, H) / 2 - m;
      const rIn = Math.max(0, Math.min(p.rin, rOut - 2));
      if (rOut - rIn < 2) return { paths: [] };
      const cx = W / 2, cy = H / 2;
      const a0 = (p.start * Math.PI) / 180;
      const TWO = Math.PI * 2;
      const outerTop = p.flip === "Outer edge";
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      /* cartesian canvas wrapped onto a ring: x -> angle, y -> radius */
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.25, p.res)).map(([x, y]) => {
          const u = x / W;
          const v = y / H;
          const ang = a0 + u * p.turns * TWO;
          const frac = outerTop ? 1 - v : v;
          const rise=p.mode==='Spiral'?Math.max(0,Math.min(1,+p.rise/100||0)):0;
          const rr = rIn + (frac*(1-rise)+u*rise) * (rOut-rIn);
          const target=clamp([cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr]);
          if(morph===1&&!p.noise)return target;
          const vary=Math.max(0,Math.min(1,+p.noise/100||0)),ns=Math.max(1,+p.noiseSize||65),t=morph*(1-vary*noise2(x/ns,y/ns,p.seed||17));
          return [x+(target[0]-x)*t,y+(target[1]-y)*t];
        })
      }));
      return { paths };
    }
  
};
