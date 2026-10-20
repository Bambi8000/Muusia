import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "circpack", name: "Circle Packing", cat: "gen", group: "geometric",
  desc: "Pack non-overlapping circles, optionally inside a wired closed Region with even-odd holes. Fill chooses original Outline, one open Spiral per circle, or nested Rings. Pitch is the radial spacing in millimetres and stays the same in small and large circles. Clearance separates neighbouring circles and keeps them off the region boundary. Colour by Size puts small-to-large circles on the selected pens; Sequence cycles the circles. Dense fills reduce curve sampling detail uniformly while preserving physical pitch. If the minimum ring samples still exceed the budget, fewer seeded packing attempts are used across the whole page. Outline with no region and zero clearance preserves the original drawing. Very detailed regions above 4000 points are rejected; simplify them first.",
  ins: [Pin("style", "Style"), Pin("paths", "Region")], outs: [Pin("paths")],
  params: [
    {key:"fill",label:"Fill",type:"select",options:["Outline","Spiral","Rings"],def:"Outline"},
    {key:"pitch",label:"Pitch mm",type:"slider",min:.3,max:8,step:.1,def:1.2,showIf:p=>p.fill!=="Outline"},
    {key:"clearance",label:"Clearance mm",type:"slider",min:0,max:6,step:.1,def:0},
    {key:"attempts",label:"Attempts",type:"slider",min:50,max:3000,step:50,def:800},
    {key:"minR",label:"Min R mm",type:"slider",min:.5,max:15,step:.25,def:1.5},
    {key:"maxR",label:"Max R mm",type:"slider",min:2,max:60,step:.5,def:18},
    {key:"colours",label:"Colours",type:"slider",min:1,max:4,step:1,def:1},
    {key:"colourBy",label:"Colour by",type:"select",options:["Size","Sequence"],def:"Size",showIf:p=>p.colours>1},
    {key:"layer",label:"Pen 1",type:"pen",def:0},
    ...[2,3,4].map((n)=>({key:"pen"+n,label:"Pen "+n,type:"pen",def:n===2?1:n===3?2:6,showIf:p=>p.colours>=n})),
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:10},
    {key:"seed",label:"Seed",type:"seed",def:14}
  ],
  overlay(p,c,ins){const ps=ins?.[1]?.paths?.filter(q=>q.closed)||[];return ps.length?ps.slice(0,80).map(q=>({kind:"poly",pts:[...q.pts,q.pts[0]]})):[{kind:"rect",x:p.margin,y:p.margin,w:c.W-2*p.margin,h:c.H-2*p.margin}];},
  _pack(ins,p,c){
    const num=(v,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+v)?+v:d));
    const m=num(p.margin,10,0,Math.min(c.W,c.H)/2),min=num(p.minR,1.5,.25,300),max=Math.max(min,num(p.maxR,18,.25,600)),gap=num(p.clearance,0,0,100),count=Math.round(num(p.attempts,800,0,6000));
    if(c.W<=2*m||c.H<=2*m)return [];
    const region=(ins?.[1]?.paths||[]).filter(q=>q.closed&&q.pts?.length>=3);if(region.reduce((a,q)=>a+q.pts.length,0)>4000)return [];
    const edges=region.flatMap(q=>q.pts.map((a,i)=>[a,q.pts[(i+1)%q.pts.length]]));
    const inside=(x,y)=>{let b=false;for(const [a,d]of edges)if((a[1]>y)!==(d[1]>y)&&x<(d[0]-a[0])*(y-a[1])/(d[1]-a[1])+a[0])b=!b;return b;};
    const rng=mulberry32((Number.isFinite(+p.seed)?+p.seed:14)*271+91),circles=[];
    for(let a=0;a<count;a++){
      const x=m+rng()*(c.W-2*m),y=m+rng()*(c.H-2*m);if(edges.length&&!inside(x,y))continue;
      let r=Math.min(max,x-m,c.W-m-x,y-m,c.H-m-y);
      for(const [u,v]of edges){const dx=v[0]-u[0],dy=v[1]-u[1],t=Math.max(0,Math.min(1,((x-u[0])*dx+(y-u[1])*dy)/(dx*dx+dy*dy||1)));r=Math.min(r,Math.hypot(x-u[0]-t*dx,y-u[1]-t*dy)-gap);}
      for(const q of circles){r=Math.min(r,Math.hypot(x-q[0],y-q[1])-q[2]-gap);if(r<min)break;}
      if(r>=min)circles.push([x,y,r]);
    }return circles;
  },
  compute(ins,p,c){
    let circles=this._pack(ins,p,c);const pitch=Math.max(.3,Math.min(50,+p.pitch||1.2)),fill=p.fill||"Outline",nc=Math.max(1,Math.min(4,Math.round(+p.colours||1))),pens=[p.layer??0,p.pen2??1,p.pen3??2,p.pen4??6].map(v=>((Math.round(+v||0)%12)+12)%12),paths=[];
    let attempts=Math.max(0,Math.min(6000,Math.round(+p.attempts||0)));
    for(let pass=0;pass<8;pass++){
      const minimum=circles.reduce((n,q)=>n+(fill==='Rings'?12*Math.ceil(q[2]/pitch):fill==='Outline'?Math.min(64,Math.max(12,Math.ceil(q[2]*2.5))):13),0),limit=fill==='Rings'?42000:105000;
      if(minimum<=limit)break;attempts=Math.max(1,Math.floor(attempts*limit/minimum*.85));circles=this._pack(ins,{...p,attempts},c);
    }
    const radii=circles.map(q=>q[2]),lo=Math.min(...radii),hi=Math.max(...radii);
    const length=circles.reduce((a,q)=>a+(fill==="Outline"?2*Math.PI*q[2]:Math.PI*q[2]*q[2]/pitch+2*Math.PI*q[2]),0),step=Math.max(.55,length/42000);
    for(let i=0;i<circles.length;i++){
      const [x,y,r]=circles[i],idx=p.colourBy==="Sequence"?i%nc:Math.min(nc-1,Math.floor((r-lo)/(hi-lo||1)*nc)),layer=pens[idx];
      if(fill==="Spiral"){
        const turn=r/pitch*2*Math.PI,N=Math.max(12,Math.ceil((Math.PI*r*r/pitch)/step)),pts=[];
        for(let k=0;k<=N;k++){const a=turn*k/N,rr=r*k/N;pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}paths.push({pts,closed:false,layer});
      }else{
        const rings=fill==="Rings"?Math.max(1,Math.ceil(r/pitch)):1;
        for(let j=0;j<rings;j++){const rr=r-j*pitch;if(rr<.05)continue;
          const n=fill==="Outline"?Math.min(64,Math.max(12,Math.ceil(rr*2.5))):Math.max(12,Math.ceil(2*Math.PI*rr/step)),pts=[];
          for(let k=0;k<n;k++){const a=k/n*2*Math.PI;pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}paths.push({pts,closed:true,layer});
        }
      }
    }return applyStyle({paths},ins?.[0]);
  }
};
