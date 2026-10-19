import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "flow",
    name: "Flow Field", cat: "gen", group: "organic", ins: [Pin("style", "Style"), Pin("paths", "Poles")], outs: [Pin("paths")],
    desc: "Trace a noise field, or choose Vortex, Sinks or Mixed poles. Even spacing grows lines forwards and backwards, stopping them near existing traces. Separation mm controls density; Steps and Trails remain upper limits. Wire closed marker centres or open path starts to Poles; otherwise a ring supplies them. Poles phase turns the fallback ring. Dots marks each trace with real tiny circles. Seed and phase are repeatable; wire Frame rot degrees to Poles phase for motion.",
    params: [
      {key:'field',label:'Field',type:'select',options:['Noise','Vortex','Sinks','Mixed poles'],def:'Noise'},
      {key:'placement',label:'Line placement',type:'select',options:['Random starts','Even spacing'],def:'Random starts'},
      {key:'separation',label:'Separation mm',type:'slider',min:1,max:12,step:.25,def:3,showIf:p=>p.placement==='Even spacing'},
      {key:'poles',label:'Fallback poles',type:'slider',min:1,max:12,step:1,def:4,showIf:p=>p.field&&p.field!=='Noise'},
      {key:'ring',label:'Pole ring mm',type:'slider',min:0,max:120,step:1,def:45,showIf:p=>p.field&&p.field!=='Noise'},
      {key:'core',label:'Pole core mm',type:'slider',min:1,max:30,step:.5,def:8,showIf:p=>p.field&&p.field!=='Noise'},
      {key:'phase',label:'Poles phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.field&&p.field!=='Noise'},
      {key:'marks',label:'Marks',type:'select',options:['Lines','Dots'],def:'Lines'},
      {key:'dotPitch',label:'Dot pitch mm',type:'slider',min:1,max:12,step:.25,def:3,showIf:p=>p.marks==='Dots'},
      {key:'dotSize',label:'Dot diameter mm',type:'slider',min:.1,max:2,step:.05,def:.35,showIf:p=>p.marks==='Dots'},
      { key: "count", label: "Trails", type: "slider", min: 5, max: 300, step: 5, def: 80 },
      { key: "steps", label: "Length", type: "slider", min: 10, max: 300, step: 5, def: 90 },
      { key: "scale", label: "Field scale", type: "slider", min: 0.005, max: 0.08, step: 0.005, def: 0.02 },
      { key: "curl", label: "Curl", type: "slider", min: 0.5, max: 4, step: 0.25, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 2 },
    ],
    _poles(ins,p,c) {
      const src=ins?.[1]?.paths||[],centres=src.slice(0,24).filter(q=>q.pts?.length).map(q=>q.closed?q.pts.reduce((a,b)=>[a[0]+b[0]/q.pts.length,a[1]+b[1]/q.pts.length],[0,0]):q.pts[0].slice(0,2));
      if(src.length)return centres;
      const N=Math.max(1,Math.min(12,Math.round(+p.poles||4))),r=Math.max(0,Math.min(+p.ring||0,Math.min(c.W,c.H)*.4)),a=(+p.phase||0)*Math.PI/180;
      return Array.from({length:N},(_,i)=>[c.W/2+r*Math.cos(a+i*2*Math.PI/N),c.H/2+r*Math.sin(a+i*2*Math.PI/N)]);
    },
    overlay(p,c,ins){const m=Math.max(0,+p.margin||0),g=[{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];if(p.field&&p.field!=='Noise')g.push(...this._poles(ins,p,c).map(q=>({kind:'circle',cx:q[0],cy:q[1],r:Math.max(1,+p.core||8)})));return g;},
    _fieldDrawing(ins,p,c){
      const num=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),m=num('margin',12,0,Math.min(c.W,c.H)/2),even=p.placement==='Even spacing',sep=num('separation',3,1,30),step=even?Math.min(.8,sep*.22):1.2,N=Math.round(num('count',80,1,300)),steps=Math.round(num('steps',90,10,600)),maxLength=steps*1.6,core=num('core',8,1,100),rng=mulberry32(num('seed',3,-2e9,2e9)*1013+77),poles=this._poles(ins,p,c),inside=q=>q[0]>=m&&q[0]<=c.W-m&&q[1]>=m&&q[1]<=c.H-m;
      if(c.W<=2*m||c.H<=2*m)return {paths:[]};
      const vector=q=>{let x=0,y=0;if(!p.field||p.field==='Noise'){const a=noise2(q[0]*num('scale',.02,.001,1),q[1]*num('scale',.02,.001,1),p.seed)*Math.PI*2*num('curl',2,.1,10);return [Math.cos(a),Math.sin(a)];}for(let i=0;i<poles.length;i++){const dx=q[0]-poles[i][0],dy=q[1]-poles[i][1],f=1/(dx*dx+dy*dy+core*core);if(p.field==='Sinks'||p.field==='Mixed poles'&&i%2){x-=dx*f;y-=dy*f;}else{const sign=i%2?-1:1;x-=dy*f*sign;y+=dx*f*sign;}}const l=Math.hypot(x,y);return l>1e-10?[x/l,y/l]:[0,0];};
      const hash=new Map(),cell=sep,key=(x,y)=>x+','+y,near=(q,limit)=>{const ix=Math.floor(q[0]/cell),iy=Math.floor(q[1]/cell);for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(const a of hash.get(key(x,y))||[])if(Math.hypot(q[0]-a[0],q[1]-a[1])<limit)return true;return false;},insert=q=>{const k=key(Math.floor(q[0]/cell),Math.floor(q[1]/cell));if(!hash.has(k))hash.set(k,[]);hash.get(k).push(q);};
      const queue=[[c.W/2,c.H/2]],traces=[];let used=0,tries=0;
      while(traces.length<N&&tries++<N*100){const start=queue.length&&tries%5!==0?queue.shift():[m+rng()*(c.W-2*m),m+rng()*(c.H-2*m)];if(!inside(start)||even&&near(start,sep))continue;
       const local=new Map(),localCell=sep*.5,localNear=(q,idx)=>{const ix=Math.floor(q[0]/localCell),iy=Math.floor(q[1]/localCell);for(let x=ix-2;x<=ix+2;x++)for(let y=iy-2;y<=iy+2;y++)for(const a of local.get(key(x,y))||[])if(Math.abs(idx-a.i)>Math.ceil(sep/step)*3&&Math.hypot(q[0]-a.q[0],q[1]-a.q[1])<sep*.7)return true;return false;};
       const trace=sign=>{let q=start.slice(),pts=[];for(let j=0;j<Math.min(Math.ceil(maxLength/step),Math.max(10,Math.floor(40000/(2*N))));j++){const v=vector(q),mid=[q[0]+v[0]*step*sign/2,q[1]+v[1]*step*sign/2],w=vector(mid),next=[q[0]+w[0]*step*sign,q[1]+w[1]*step*sign],idx=sign*(j+1);if(!inside(next)||Math.hypot(...w)<.5||even&&(near(next,sep)||localNear(next,idx)))break;const k=key(Math.floor(next[0]/localCell),Math.floor(next[1]/localCell));if(!local.has(k))local.set(k,[]);local.get(k).push({q:next,i:idx});pts.push(next);q=next;used++;}return pts;};
       const back=trace(-1).reverse(),front=trace(1),pts=[...back,start,...front];if(pts.length<Math.max(5,Math.ceil(even?sep*6/step:5)))continue;traces.push(pts);if(even){pts.forEach(insert);const stride=Math.max(1,Math.floor(sep*2/step));for(let i=1;i<pts.length-1;i+=stride){const a=pts[i-1],b=pts[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;for(const s of [-1,1])queue.push([pts[i][0]-(b[1]-a[1])/l*sep*1.05*s,pts[i][1]+(b[0]-a[0])/l*sep*1.05*s]);}if(queue.length>6000)queue.splice(6000);}
      }
      const layer=Math.round(num('layer',2,0,11));let paths=traces.map(pts=>({pts,closed:false,layer}));
      if(p.marks==='Dots'){const total=traces.reduce((n,q)=>n+q.length*step,0),pitch=Math.max(num('dotPitch',3,.4,50),total/10000),r=num('dotSize',.35,.1,4)/2;paths=[];for(const trace of traces){let d=pitch;for(let i=1;i<trace.length;i++){const a=trace[i-1],b=trace[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);while(d<=l){const t=d/l,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;if(x-r>=m&&x+r<=c.W-m&&y-r>=m&&y+r<=c.H-m)paths.push({pts:Array.from({length:8},(_,k)=>[x+r*Math.cos(k*Math.PI/4),y+r*Math.sin(k*Math.PI/4)]),closed:true,layer});d+=pitch;}d-=l;}}}
      let style=ins[0],out=applyStyle({paths},style);for(let k=0;k<10&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;k++){style={...style,dash:Math.max(.1,+style?.dash||4)*2,gap:Math.max(.1,+style?.gap||3)*2};out=applyStyle({paths},style);}return out;
    },
    compute(ins, p, ctx) {
      if(p.field&&p.field!=='Noise'||p.placement==='Even spacing'||p.marks==='Dots')return this._fieldDrawing(ins,p,ctx);
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1013 + 77);
      const paths = [];
      for (let k = 0; k < p.count; k++) {
        let x = p.margin + rng() * (W - 2 * p.margin);
        let y = p.margin + rng() * (H - 2 * p.margin);
        const pts = [[x, y]];
        for (let s = 0; s < p.steps; s++) {
          const a = noise2(x * p.scale, y * p.scale, p.seed) * Math.PI * 2 * p.curl;
          x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6;
          if (x < p.margin || x > W - p.margin || y < p.margin || y > H - p.margin) break;
          pts.push([x, y]);
        }
        if (pts.length > 3) paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
