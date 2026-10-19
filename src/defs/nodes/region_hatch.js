import { Pin, EMPTY, PENS, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "region_hatch", name: "Region Hatch", cat: "gen", group: "textimg",
  fileImage: true, imageMax: 480,
  desc: "Turn an image into separate tonal regions filled with pen lines. Posterize groups adjacent pixels into tone bands; SLIC builds compact, image-following superpixels, then splits disconnected pieces. Resolution is the working grid's long side; Cell size and Compactness affect SLIC only. Smooth removes fine detail; Min region cells absorbs small islands into the closest-tone neighbour. Output 1 is Hatching; output 2 is Region outlines, including holes, as closed paths for other nodes. Regions are cell-grid contours, not smooth vector tracing. Angle mode Region shape follows each region's main axis within the Angle min/max range; Fixed uses Angle min. Spacing follows mean darkness, Pen width and Ink strength, bounded by Min/Max spacing. Ink threshold skips faint regions. Colours selects 1–4 pens; Tone bands assigns light-to-dark bands, Source colours picks the closest selected pen to each region's mean colour. This is one pen per region, not CMYK overprinting. Grey-only older images use tone bands. Hand wobble keeps endpoints fixed and stays inside the original hatch interval. Outlines use each region's pen unless Outline pen is selected. Shared edges belong to both region loops and can be retraced; merging both outputs also draws the outlines. Dense settings widen spacing and coarsen wobble sampling uniformly across all regions to keep work bounded. All processing is local; no image means no output.",
  ins: [Pin("style", "Style")], outs: [Pin("paths", "Hatching"), Pin("paths", "Region outlines")],
  params: [
    {key:"file",label:"Image (PNG/JPG)",type:"file",def:""},
    {key:"method",label:"Segmentation",type:"select",options:["Posterize","SLIC"],def:"SLIC"},
    {key:"resolution",label:"Resolution",type:"slider",min:32,max:144,step:4,def:96},
    {key:"levels",label:"Tone bands",type:"slider",min:2,max:12,step:1,def:5,showIf:p=>p.method==='Posterize'},
    {key:"cell",label:"Cell size",type:"slider",min:3,max:30,step:1,def:12,showIf:p=>p.method==='SLIC'},
    {key:"compact",label:"Compactness",type:"slider",min:0.02,max:1,step:0.02,def:0.2,showIf:p=>p.method==='SLIC'},
    {key:"smooth",label:"Smooth passes",type:"slider",min:0,max:4,step:1,def:1},
    {key:"minRegion",label:"Min region cells",type:"slider",min:1,max:100,step:1,def:12},
    {key:"angleMode",label:"Angle mode",type:"select",options:["Region shape","Fixed"],def:"Region shape"},
    {key:"angleMin",label:"Angle min °",type:"slider",min:0,max:180,step:1,def:15},
    {key:"angleMax",label:"Angle max °",type:"slider",min:0,max:180,step:1,def:165,showIf:p=>p.angleMode==='Region shape'},
    {key:"penWidth",label:"Pen width mm",type:"slider",min:0.1,max:1.5,step:0.05,def:0.35},
    {key:"strength",label:"Ink strength",type:"slider",min:0.2,max:2,step:0.05,def:1},
    {key:"gamma",label:"Ink gamma",type:"slider",min:0.3,max:3,step:0.1,def:1},
    {key:"minSpacing",label:"Min spacing mm",type:"slider",min:0.2,max:3,step:0.1,def:0.5},
    {key:"maxSpacing",label:"Max spacing mm",type:"slider",min:1,max:10,step:0.1,def:4},
    {key:"cutoff",label:"Ink threshold",type:"slider",min:0,max:0.5,step:0.01,def:0.06},
    {key:"wobble",label:"Hand wobble mm",type:"slider",min:0,max:2,step:0.05,def:0},
    {key:"wave",label:"Wobble wave mm",type:"slider",min:1,max:30,step:0.5,def:8,showIf:p=>p.wobble>0},
    {key:"seed",label:"Wobble seed",type:"seed",def:19,showIf:p=>p.wobble>0},
    {key:"colours",label:"Colours",type:"slider",min:1,max:4,step:1,def:1},
    {key:"mapping",label:"Colour mapping",type:"select",options:["Tone bands","Source colours"],def:"Source colours",showIf:p=>p.colours>1},
    {key:"layer",label:"Pen 1 (lightest)",type:"pen",def:0},
    {key:"pen2",label:"Pen 2",type:"pen",def:4,showIf:p=>p.colours>=2},
    {key:"pen3",label:"Pen 3",type:"pen",def:1,showIf:p=>p.colours>=3},
    {key:"pen4",label:"Pen 4 (darkest)",type:"pen",def:5,showIf:p=>p.colours>=4},
    {key:"outlines",label:"Outline colours",type:"select",options:["Region pens","Outline pen"],def:"Region pens"},
    {key:"outlinePen",label:"Outline pen",type:"pen",def:0,showIf:p=>p.outlines==='Outline pen'},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:12}
  ],
  _n(v,d,lo,hi){return Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):d));},
  _fit(p,ctx,img){
    const n=this._n,W=n(ctx?.W,297,0,100000),H=n(ctx?.H,210,0,100000),m=n(p.margin,12,0,Math.min(W,H)/2);
    if(!img||!Number.isInteger(img.w)||!Number.isInteger(img.h)||img.w<1||img.h<1||img.w*img.h>230400||!img.g||img.g.length!==img.w*img.h||W-2*m<=0||H-2*m<=0)return null;
    const scale=Math.min((W-2*m)/img.w,(H-2*m)/img.h);return {x:(W-img.w*scale)/2,y:(H-img.h*scale)/2,w:img.w*scale,h:img.h*scale};
  },
  _segment(p,img){
    const n=this._n,res=Math.round(n(p.resolution,96,32,144)),scale=res/Math.max(img.w,img.h),w=Math.max(1,Math.round(img.w*scale)),h=Math.max(1,Math.round(img.h*scale)),N=w*h;
    const rgb=img.rgb?.length===img.w*img.h*3?new Float64Array(N*3):null;let g=new Float64Array(N);
    // Area resampling prevents aliasing away thin high-contrast features.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const x0=x*img.w/w,x1=(x+1)*img.w/w,y0=y*img.h/h,y1=(y+1)*img.h/h;let sum=0,dark=0,c=[0,0,0];
      for(let iy=Math.floor(y0);iy<Math.ceil(y1);iy++)for(let ix=Math.floor(x0);ix<Math.ceil(x1);ix++){
        const a=(Math.min(ix+1,x1)-Math.max(ix,x0))*(Math.min(iy+1,y1)-Math.max(iy,y0)),j=iy*img.w+ix;sum+=a;dark+=a*n(img.g[j],0,0,1);
        if(rgb)for(let k=0;k<3;k++)c[k]+=a*n(img.rgb[j*3+k],255,0,255)/255;
      }
      const i=y*w+x;g[i]=dark/sum;if(rgb)for(let k=0;k<3;k++)rgb[i*3+k]=c[k]/sum;
    }
    for(let pass=0;pass<Math.round(n(p.smooth,1,0,4));pass++){
      const next=new Float64Array(N);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0,b=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const z=(dx===0?2:1)*(dy===0?2:1);a+=g[yy*w+xx]*z;b+=z;}next[y*w+x]=a/b;}g=next;
    }
    const labels=new Int32Array(N);
    if(p.method==='Posterize'){
      const levels=Math.round(n(p.levels,5,2,12));for(let i=0;i<N;i++)labels[i]=Math.min(levels-1,Math.floor(g[i]*levels));
    }else{
      const S=Math.round(n(p.cell,12,3,30)),m=n(p.compact,.2,.02,1),centres=[];
      for(let y=Math.min(h-1,S/2);y<h;y+=S)for(let x=Math.min(w-1,S/2);x<w;x+=S){const i=Math.floor(y)*w+Math.floor(x);centres.push([x,y,g[i]]);}
      // Bounded local SLIC distance: tonal error plus normalized spatial error.
      for(let iter=0;iter<6;iter++){
        const dist=new Float64Array(N).fill(Infinity);labels.fill(-1);
        for(let k=0;k<centres.length;k++){
          const [cx,cy,cg]=centres[k];for(let y=Math.max(0,Math.floor(cy-2*S));y<=Math.min(h-1,Math.ceil(cy+2*S));y++)for(let x=Math.max(0,Math.floor(cx-2*S));x<=Math.min(w-1,Math.ceil(cx+2*S));x++){
            const i=y*w+x,d=(g[i]-cg)**2+m*m*((x+.5-cx)**2+(y+.5-cy)**2)/(S*S);if(d<dist[i]){dist[i]=d;labels[i]=k;}
          }
        }
        const sums=centres.map(()=>[0,0,0,0]);for(let i=0;i<N;i++){if(labels[i]<0){let best=Infinity;for(let k=0;k<centres.length;k++){const d=(i%w+.5-centres[k][0])**2+(Math.floor(i/w)+.5-centres[k][1])**2;if(d<best){best=d;labels[i]=k;}}}const a=sums[labels[i]];a[0]+=i%w+.5;a[1]+=Math.floor(i/w)+.5;a[2]+=g[i];a[3]++;}for(let k=0;k<centres.length;k++)if(sums[k][3])centres[k]=sums[k].slice(0,3).map(v=>v/sums[k][3]);
      }
    }
    // A label can contain multiple islands. Split first, then absorb small ones.
    const cc=new Int32Array(N).fill(-1),components=[],queue=new Int32Array(N);
    for(let i=0;i<N;i++)if(cc[i]<0){const k=components.length,a={count:0,tone:0,adj:new Set()},label=labels[i];let head=0,tail=1;queue[0]=i;cc[i]=k;while(head<tail){const j=queue[head++],x=j%w,y=Math.floor(j/w);a.count++;a.tone+=g[j];for(const q of [x?j-1:-1,x<w-1?j+1:-1,y?j-w:-1,y<h-1?j+w:-1])if(q>=0&&cc[q]<0&&labels[q]===label){cc[q]=k;queue[tail++]=q;}}components.push(a);}
    for(let i=0;i<N;i++){const x=i%w,y=Math.floor(i/w),a=cc[i];for(const j of [x<w-1?i+1:-1,y<h-1?i+w:-1])if(j>=0&&a!==cc[j]){components[a].adj.add(cc[j]);components[cc[j]].adj.add(a);}}
    const parent=components.map((_,i)=>i),find=i=>{let k=i;while(parent[k]!==k)k=parent[k];while(parent[i]!==i){const j=parent[i];parent[i]=k;i=j;}return k;};
    const minimum=Math.round(n(p.minRegion,12,1,100));
    for(const id of components.map((_,i)=>i).sort((a,b)=>components[a].count-components[b].count||a-b)){
      const a=find(id),v=components[a];if(a!==id||v.count>=minimum)continue;let best=-1,err=Infinity;
      for(const neighbour of v.adj){const b=find(neighbour);if(b===a)continue;const diff=Math.abs(v.tone/v.count-components[b].tone/components[b].count);if(diff<err||(diff===err&&b<best)){best=b;err=diff;}}
      if(best>=0){parent[a]=best;components[best].count+=v.count;components[best].tone+=v.tone;for(const j of v.adj)components[best].adj.add(j);}
    }
    const ids=new Map(),regions=[];
    for(let i=0;i<N;i++){
      const id=find(cc[i]);if(!ids.has(id)){ids.set(id,regions.length);regions.push({count:0,tone:0,rgb:[0,0,0],sx:0,sy:0,sxx:0,syy:0,sxy:0,edges:[]});}
      const k=ids.get(id);labels[i]=k;const a=regions[k],x=i%w+.5,y=Math.floor(i/w)+.5;a.count++;a.tone+=g[i];a.sx+=x;a.sy+=y;a.sxx+=x*x;a.syy+=y*y;a.sxy+=x*y;if(rgb)for(let c=0;c<3;c++)a.rgb[c]+=rgb[i*3+c];
    }
    // Clockwise cell edges keep material on the right, holes counter-clockwise.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=labels[y*w+x],e=regions[k].edges;if(y===0||labels[(y-1)*w+x]!==k)e.push([[x,y],[x+1,y]]);if(x===w-1||labels[y*w+x+1]!==k)e.push([[x+1,y],[x+1,y+1]]);if(y===h-1||labels[(y+1)*w+x]!==k)e.push([[x+1,y+1],[x,y+1]]);if(x===0||labels[y*w+x-1]!==k)e.push([[x,y+1],[x,y]]);}
    for(const a of regions){a.tone/=a.count;a.rgb=a.rgb.map(c=>c/a.count);}
    return {w,h,labels,regions,hasRGB:!!rgb};
  },
  _loops(edges){
    const key=p=>p[0]+','+p[1],outgoing=new Map(),used=new Set(),loops=[];
    edges.forEach((e,i)=>{const k=key(e[0]);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(i);});
    for(let i=0;i<edges.length;i++)if(!used.has(i)){
      let j=i;const pts=[],start=key(edges[i][0]);
      while(!used.has(j)){used.add(j);const [a,b]=edges[j];pts.push(a);if(key(b)===start)break;
        const choices=(outgoing.get(key(b))||[]).filter(k=>!used.has(k));if(!choices.length)break;
        // At a diagonal touch, right turns keep each material component on right.
        const dx=b[0]-a[0],dy=b[1]-a[1];choices.sort((u,v)=>{const turn=k=>{const q=edges[k][1],xx=q[0]-b[0],yy=q[1]-b[1];return Math.atan2(dx*yy-dy*xx,dx*xx+dy*yy);};return turn(v)-turn(u)||u-v;});j=choices[0];
      }
      // Remove only collinear grid vertices. Corners and winding are exact.
      const simple=pts.filter((b,k)=>{const a=pts[(k+pts.length-1)%pts.length],c=pts[(k+1)%pts.length];return (b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]);});if(simple.length>=3)loops.push(simple);
    }return loops;
  },
  _angle(a,p,dx,dy){
    const lo=this._n(p.angleMin,15,0,180);if(p.angleMode==='Fixed')return lo*Math.PI/180;
    const hi=this._n(p.angleMax,165,0,180),min=Math.min(lo,hi),max=Math.max(lo,hi),mx=a.sx/a.count,my=a.sy/a.count;
    const xx=(a.sxx/a.count-mx*mx)*dx*dx,yy=(a.syy/a.count-my*my)*dy*dy,xy=(a.sxy/a.count-mx*my)*dx*dy;
    let v=(Math.atan2(2*xy,xx-yy)*90/Math.PI+180)%180;if(Math.abs(xx-yy)+Math.abs(xy)<1e-8)v=(min+max)/2;
    if(v<min||v>max){const distance=(a,b)=>Math.min(Math.abs(a-b),180-Math.abs(a-b));v=distance(v,min)<=distance(v,max)?min:max;}return v*Math.PI/180;
  },
  compute(ins,p,ctx,node){
    const img=node?.data?.img,fit=this._fit(p,ctx,img);if(!fit)return [EMPTY,EMPTY];
    const n=this._n,{w,h,regions,hasRGB}=this._segment(p,img),dx=fit.w/w,dy=fit.h/h;
    const count=Math.round(n(p.colours,1,1,4)),pens=[p.layer,p.pen2,p.pen3,p.pen4].slice(0,count).map(v=>Math.round(n(v,0,0,11)));
    const palette=(ctx.pens||PENS).map(q=>{const s=q?.c||'#000000',c=/^#[0-9a-f]{6}$/i.test(s)?s:'#000000';return [1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);});
    const width=n(p.penWidth,.35,.1,1.5),low=n(p.minSpacing,.5,.2,3),high=Math.max(low,n(p.maxSpacing,4,1,10)),gamma=n(p.gamma,1,.3,3),strength=n(p.strength,1,.2,2),cut=n(p.cutoff,.06,0,.5),wobble=n(p.wobble,0,0,2),wave=n(p.wave,8,1,30),outlinePen=Math.round(n(p.outlinePen,0,0,11));
    const outlines=[],jobs=[];let estimate=0,edgeCount=0;
    for(const [id,a]of regions.entries()){
      if(a.tone<=cut)continue;
      let pi=Math.min(count-1,Math.floor(a.tone*count));if(count>1&&hasRGB&&p.mapping==='Source colours'){
        let best=Infinity;for(let j=0;j<count;j++){const c=palette[pens[j]],d=c.reduce((s,v,k)=>s+[.299,.587,.114][k]*(v-a.rgb[k])**2,0);if(d<best){best=d;pi=j;}}
      }
      const layer=pens[pi],loops=this._loops(a.edges).map(loop=>loop.map(([x,y])=>[fit.x+x*dx,fit.y+y*dy]));
      for(const pts of loops)outlines.push({pts,closed:true,layer:p.outlines==='Outline pen'?outlinePen:layer});
      const angle=this._angle(a,p,dx,dy),ca=Math.cos(angle),sa=Math.sin(angle),edges=a.edges.map(e=>e.map(([x,y])=>{x=fit.x+x*dx;y=fit.y+y*dy;return [x*ca+y*sa,-x*sa+y*ca];}));
      let min=Infinity,max=-Infinity;for(const e of edges)for(const pt of e){min=Math.min(min,pt[1]);max=Math.max(max,pt[1]);}
      const pitch=Math.max(low,Math.min(high,width/Math.max(.001,strength*a.tone**gamma))),area=a.count*dx*dy;
      const samples=wobble>0?Math.max(.4,wave/6):Infinity;
      estimate+=2*(max-min)/pitch+(Number.isFinite(samples)?area/pitch/samples:0);edgeCount+=edges.length*(max-min)/pitch;
      jobs.push({id,layer,edges,ca,sa,min,max,pitch});
    }
    // Uniform coarsening keeps every region/pen. No prefix is silently discarded.
    let factor=Math.max(1,estimate/85000,edgeCount/(wobble>0?350000:3500000));
    const render=()=>{const rng=mulberry32(Math.round(n(p.seed,19,-1e9,1e9)));
    const paths=[];
    for(const j of jobs){
      const step=j.pitch*factor,phase=rng()*Math.PI*2;
      // Centre the rows in each region; even a small region gets a sample row.
      const rows=Math.max(1,Math.floor((j.max-j.min)/step)),start=(j.min+j.max-(rows-1)*step)/2;
      for(let row=0;row<rows;row++){
        const y=start+row*step,xs=[];for(const [a,b]of j.edges)if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));xs.sort((a,b)=>a-b);
        for(let i=0;i+1<xs.length;i+=2){const x0=xs[i],x1=xs[i+1],len=x1-x0;if(len<.03)continue;
          const parts=wobble>0?Math.max(2,Math.ceil(len/(Math.max(.4,wave/6)*factor))):1,pts=[];
          // Vary speed along the exact clipped interval. The geometric line
          // remains inside its region, while perpendicular wobble is clipped
          // against that region below using its exact rotated boundary.
          for(let k=0;k<=parts;k++){
            const t=k/parts,x=x0+len*t,amp=Math.min(wobble,len*.08)*Math.sin(Math.PI*t),yy=y+amp*Math.sin((x-x0)*Math.PI*2/wave+phase+row*.71);
            pts.push([x,yy]);
          }
          const clipped=[];
          for(let k=0;k<pts.length-1;k++){
            const a=pts[k],b=pts[k+1],cuts=[0,1],vx=b[0]-a[0],vy=b[1]-a[1];
            if(wobble>0)for(const [c,d]of j.edges){const ex=d[0]-c[0],ey=d[1]-c[1],den=vx*ey-vy*ex;if(Math.abs(den)<1e-12)continue;const qx=c[0]-a[0],qy=c[1]-a[1],t=(qx*ey-qy*ex)/den,u=(qx*vy-qy*vx)/den;if(t>1e-9&&t<1-1e-9&&u>=0&&u<=1)cuts.push(t);}
            cuts.sort((a,b)=>a-b);
            for(let q=0;q<cuts.length-1;q++){
              const t0=cuts[q],t1=cuts[q+1];if(t1-t0<1e-9)continue;const t=(t0+t1)/2,x=a[0]+vx*t,y0=a[1]+vy*t;
              let inside=wobble===0;if(!inside){let hit=false;for(const [c,d]of j.edges)if((c[1]>y0)!==(d[1]>y0)&&x<(d[0]-c[0])*(y0-c[1])/(d[1]-c[1])+c[0])hit=!hit;inside=hit;}
              if(inside){const point=t=>{const xx=a[0]+vx*t,yy=a[1]+vy*t;return [xx*j.ca-yy*j.sa,xx*j.sa+yy*j.ca];};clipped.push([point(t0),point(t1)]);}
            }
          }
          let run=[];for(const [a,b]of clipped){if(run.length&&Math.hypot(run.at(-1)[0]-a[0],run.at(-1)[1]-a[1])>1e-7){paths.push({pts:run,closed:false,layer:j.layer});run=[];}if(!run.length)run.push(a);run.push(b);}if(run.length>1)paths.push({pts:run,closed:false,layer:j.layer});
        }
      }
    }
    return paths;};
    let paths=render();for(let pass=0;pass<8;pass++){const points=paths.reduce((s,a)=>s+a.pts.length,0);if(points<=110000)break;factor*=Math.max(1.3,points/90000);paths=render();}
    return [applyStyle({paths},ins[0]),applyStyle({paths:outlines},ins[0])];
  },
  overlay(p,ctx,ins,node){try{const f=this._fit(p,ctx,node?.data?.img);return f?[{kind:'rect',x:f.x,y:f.y,w:f.w,h:f.h}]:[];}catch{return [];}}
};
