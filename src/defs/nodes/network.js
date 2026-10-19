import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "network",
    name: "Network",
    cat: "gen",
    group: "structural",
    desc: "A seeded graph laid out by force simulation (nodes repel, edges pull), replayed deterministically for N iterations - wire a value into Iterations to watch it untangle. Drift instead moves a seeded population through looping noise and rebuilds radius-limited nearest connections each frame. Use Timeline and ANIMATE or wire Drift phase. Nearest-neighbour links plus a few long-range ones give constellation diagrams; node circles can scale by connection count.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      {key:'motion',label:'Layout',type:'select',options:['Force layout','Drift'],def:'Force layout'},
      {key:'radius',label:'Connection radius mm',type:'slider',min:5,max:100,step:1,def:35,showIf:p=>p.motion==='Drift'},
      {key:'drift',label:'Drift mm',type:'slider',min:0,max:50,step:1,def:16,showIf:p=>p.motion==='Drift'},
      {key:'phase',label:'Drift phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.motion==='Drift'},
      {key:'timeSource',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual',showIf:p=>p.motion==='Drift'},
      {key:'cycles',label:'Cycles',type:'slider',min:1,max:8,step:1,def:1,showIf:p=>p.motion==='Drift'&&p.timeSource==='Timeline'},
      { key: "nodes", label: "Nodes", type: "slider", min: 5, max: 120, step: 1, def: 40 },
      { key: "links", label: "Links per node", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "longp", label: "Long links", type: "slider", min: 0, max: 0.3, step: 0.01, def: 0.06 },
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 300, step: 5, def: 120 },
      { key: "dots", label: "Draw nodes", type: "check", def: true },
      { key: "degsize", label: "Size by connections", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
    _drift(ins,p,c){
      const m=Math.max(0,+p.margin||0),w=c.W-2*m,h=c.H-2*m;if(w<=2||h<=2)return {paths:[]};
      const N=Math.max(3,Math.min(180,Math.round(+p.nodes||40))),rng=mulberry32((+p.seed||0)*9013+3),amp=Math.max(0,Math.min(+p.drift||0,Math.min(w,h)/4)),phase=(p.timeSource==='Timeline'?0:(+p.phase||0)*Math.PI/180)+(p.timeSource==='Timeline'&&c.frameCount>1?c.frameIdx/c.frameCount*2*Math.PI*Math.max(1,Math.min(8,Math.round(+p.cycles||1))):0),positions=[];
      for(let i=0;i<N;i++){const x=m+amp+rng()*Math.max(0,w-2*amp),y=m+amp+rng()*Math.max(0,h-2*amp),z=rng()*40;positions.push([x+amp*(2*noise2(z+Math.cos(phase),Math.sin(phase),p.seed)-1),y+amp*(2*noise2(z+11+Math.cos(phase),Math.sin(phase),p.seed+7)-1)]);}
      const maxLinks=Math.max(1,Math.min(12,Math.round(+p.links||2))),radius=Math.max(1,Math.min(300,+p.radius||35)),edges=new Set(),degree=Array(N).fill(0),layer=Math.max(0,Math.min(11,Math.round(+p.layer||0))),paths=[];
      for(let i=0;i<N;i++){const candidates=positions.map((q,j)=>({j,d:Math.hypot(q[0]-positions[i][0],q[1]-positions[i][1])})).filter(q=>q.j!==i&&q.d<radius).sort((a,b)=>a.d-b.d||a.j-b.j).slice(0,maxLinks);for(const {j}of candidates){const key=i<j?i+','+j:j+','+i;if(!edges.has(key)){edges.add(key);degree[i]++;degree[j]++;}}}
      const rad=i=>p.dots?(p.degsize?.4+Math.sqrt(degree[i])*.2:.65):0;
      for(const edge of edges){const [i,j]=edge.split(',').map(Number),a=positions[i],b=positions[j],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);if(d>rad(i)+rad(j)+.01)paths.push({pts:[[a[0]+dx/d*rad(i),a[1]+dy/d*rad(i)],[b[0]-dx/d*rad(j),b[1]-dy/d*rad(j)]],closed:false,layer});}
      if(p.dots)for(let i=0;i<N;i++){const q=positions[i],r=rad(i);paths.push({pts:Array.from({length:12},(_,k)=>[q[0]+r*Math.cos(k*Math.PI/6),q[1]+r*Math.sin(k*Math.PI/6)]),closed:true,layer});}
      return applyStyle({paths},ins[0]);
    },
    compute(ins, p, ctx) {
      if(p.motion==='Drift')return this._drift(ins,p,ctx);
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const N2 = Math.max(3, Math.min(150, Math.round(p.nodes)));
      const rng = mulberry32(p.seed * 9013 + 3);
      const pos = [];
      for (let i = 0; i < N2; i++) {
        pos.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
      }
      /* edges: k nearest at start + seeded long-range links */
      const edges = new Set();
      const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
      const kNear = Math.max(1, Math.min(6, Math.round(p.links)));
      for (let i = 0; i < N2; i++) {
        const d = pos.map((q, j) => [Math.hypot(q[0] - pos[i][0], q[1] - pos[i][1]), j])
          .sort((a, b) => a[0] - b[0]);
        for (let k = 1; k <= kNear && k < d.length; k++) edges.add(ek(i, d[k][1]));
        if (rng() < p.longp * 3) {
          const j = Math.floor(rng() * N2);
          if (j !== i) edges.add(ek(i, j));
        }
      }
      const E = [...edges].map((k) => k.split("_").map(Number));
      const deg = new Array(N2).fill(0);
      for (const [a, b] of E) { deg[a]++; deg[b]++; }
      /* force layout: repulsion all pairs, springs on edges, deterministic */
      const gens = Math.max(0, Math.min(400, Math.floor(p.iters)));
      const ideal = Math.sqrt(((x1 - x0) * (y1 - y0)) / N2) * 0.9;
      for (let g = 0; g < gens; g++) {
        const fx = new Float64Array(N2), fy = new Float64Array(N2);
        for (let i = 0; i < N2; i++) {
          for (let j = i + 1; j < N2; j++) {
            let ox = pos[i][0] - pos[j][0], oy = pos[i][1] - pos[j][1];
            let d = Math.hypot(ox, oy);
            if (d < 0.01) { ox = 0.01 * ((i % 3) - 1); oy = 0.01; d = 0.014; }
            const f = (ideal * ideal) / (d * d) * 0.5;
            fx[i] += (ox / d) * f; fy[i] += (oy / d) * f;
            fx[j] -= (ox / d) * f; fy[j] -= (oy / d) * f;
          }
        }
        for (const [a, b] of E) {
          const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
          const d = Math.hypot(ox, oy) || 0.01;
          const f = (d - ideal) * 0.05;
          fx[a] += (ox / d) * f; fy[a] += (oy / d) * f;
          fx[b] -= (ox / d) * f; fy[b] -= (oy / d) * f;
        }
        const cool = 1 - g / (gens + 1);
        for (let i = 0; i < N2; i++) {
          const fl = Math.hypot(fx[i], fy[i]) || 1;
          const s = Math.min(3 * cool + 0.2, fl) / fl;
          pos[i][0] = Math.max(x0, Math.min(x1, pos[i][0] + fx[i] * s));
          pos[i][1] = Math.max(y0, Math.min(y1, pos[i][1] + fy[i] * s));
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      const rOf = (i) => p.degsize ? 1 + Math.min(4, deg[i] * 0.5) : 1.6;
      for (const [a, b] of E) {
        /* trim edge lines so they stop at the node circles */
        const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
        const d = Math.hypot(ox, oy);
        if (d < 0.5) continue;
        const ra = p.dots ? rOf(a) + 0.4 : 0, rb = p.dots ? rOf(b) + 0.4 : 0;
        if (ra + rb >= d) continue;
        paths.push({
          pts: [
            [pos[a][0] + (ox / d) * ra, pos[a][1] + (oy / d) * ra],
            [pos[b][0] - (ox / d) * rb, pos[b][1] - (oy / d) * rb]
          ],
          closed: false, layer: L
        });
      }
      if (p.dots) {
        for (let i = 0; i < N2; i++) {
          const r = rOf(i);
          const c = [];
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            c.push([pos[i][0] + Math.cos(a) * r, pos[i][1] + Math.sin(a) * r]);
          }
          paths.push({ pts: c, closed: true, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
