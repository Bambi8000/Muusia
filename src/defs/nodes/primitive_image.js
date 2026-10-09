import { Pin, EMPTY, PENS, mulberry32, applyStyle } from "../helpers.js";

export default {
  // Method inspired by Michael Fogleman's Primitive (MIT):
  // https://github.com/fogleman/primitive — independent JavaScript implementation.
  // Greedy geometric search + hill climbing, adapted to overprinted pen hatching.
  key: "primitive_image", name: "Primitive Image", cat: "gen", group: "textimg",
  fileImage: true, imageMax: 480,
  desc: "Rebuild a photo with geometric shapes chosen to reduce image error, one at a time. Choose image, then Triangles, Rectangles, Ellipses, Circles or Mixed. Shapes is a maximum: fitting stops if another shape cannot help. Search trades speed for detail; start with Balanced and 150 shapes. Each accepted shape is refined by seeded hill climbing. Tone hatch turns its fitted ink coverage into real parallel strokes; Cross hatch splits coverage between two directions. Outlines shows the fitted shapes as a graphic interpretation, without their tonal fill. Reveal % shows the first shapes without changing the fit and can be driven by Frame. Colours selects 1–6 actual pens from the Pens palette; their colours participate in fitting, so changing them can change the shapes. With one pen the source is fitted in grayscale. The paper starts white and overlapping ink can only darken it: the model cannot paint over a dark area with opaque white like a screen renderer. Pen width mm controls physical hatch pitch, not the preview's stroke width. Angle and Angle variation steer hatching only. A simple, well-lit crop works best. All calculations stay in the browser. Results approximate ink coverage; actual pen and paper affect tones. Dense output widens hatch spacing across all shapes to remain within the point budget. Inspired by fogleman/primitive; no Go installation or server required.",
  ins: [Pin("style", "Style")], outs: [Pin("paths")],
  params: [
    {key:"file",label:"Image (PNG/JPG)",type:"file",def:""},
    {key:"shape",label:"Shapes",type:"select",options:["Triangles","Rectangles","Ellipses","Circles","Mixed"],def:"Triangles"},
    {key:"count",label:"Max shapes",type:"slider",min:10,max:300,step:10,def:150},
    {key:"quality",label:"Search",type:"select",options:["Draft","Balanced","Fine"],def:"Balanced"},
    {key:"scale",label:"Shape scale %",type:"slider",min:10,max:100,step:5,def:65},
    {key:"coverage",label:"Max ink coverage",type:"slider",min:0.15,max:0.95,step:0.05,def:0.3},
    {key:"gamma",label:"Gamma",type:"slider",min:0.3,max:3,step:0.05,def:1},
    {key:"render",label:"Render",type:"select",options:["Tone hatch","Cross hatch","Outlines"],def:"Tone hatch"},
    {key:"penWidth",label:"Pen width mm",type:"slider",min:0.1,max:1.5,step:0.05,def:0.3,showIf:p=>p.render!=="Outlines"},
    {key:"angle",label:"Hatch angle °",type:"slider",min:-90,max:90,step:1,def:45,showIf:p=>p.render!=="Outlines"},
    {key:"angleVar",label:"Angle variation °",type:"slider",min:0,max:90,step:1,def:25,showIf:p=>p.render!=="Outlines"},
    {key:"reveal",label:"Reveal %",type:"slider",min:0,max:100,step:1,def:100},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:12},
    {key:"seed",label:"Seed",type:"seed",def:37},
    {key:"colours",label:"Colours",type:"slider",min:1,max:6,step:1,def:1},
    {key:"layer",label:"Pen 1",type:"pen",def:0},
    {key:"pen2",label:"Pen 2",type:"pen",def:6,showIf:p=>p.colours>=2},
    {key:"pen3",label:"Pen 3",type:"pen",def:7,showIf:p=>p.colours>=3},
    {key:"pen4",label:"Pen 4",type:"pen",def:10,showIf:p=>p.colours>=4},
    {key:"pen5",label:"Pen 5",type:"pen",def:1,showIf:p=>p.colours>=5},
    {key:"pen6",label:"Pen 6",type:"pen",def:4,showIf:p=>p.colours>=6},
  ],
  _cache: new WeakMap(),
  _n(v,d,lo,hi){return Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):d));},
  _fit(p,ctx,img){
    const n=this._n,W=n(ctx.W,297,0,100000),H=n(ctx.H,210,0,100000),m=n(p.margin,12,0,Math.min(W,H)/2);
    if(!img||!Number.isInteger(img.w)||!Number.isInteger(img.h)||img.w<1||img.h<1||img.w*img.h>2560000||img.g?.length!==img.w*img.h||W-2*m<1||H-2*m<1)return null;
    const sc=Math.min((W-2*m)/img.w,(H-2*m)/img.h),w=img.w*sc,h=img.h*sc;
    return {x:(W-w)/2,y:(H-h)/2,w,h};
  },
  overlay(p,ctx,ins,node){const f=this._fit(p,ctx,node?.data?.img);return f?[{kind:"rect",...f}]:[];},
  _polygon(s,w,h){
    const cs=Math.cos(s.a),sn=Math.sin(s.a),local=s.type===0?[[-1,-1],[1,-1],[s.tip,1]]:s.type===1?[[-1,-1],[1,-1],[1,1],[-1,1]]:Array.from({length:32},(_,i)=>[Math.cos(i*Math.PI/16),Math.sin(i*Math.PI/16)]);
    let pts=local.map(([x,y])=>[s.x+cs*x*s.rx-sn*y*s.ry,s.y+sn*x*s.rx+cs*y*s.ry]);
    for(const [axis,edge,sign]of [[0,0,1],[0,w,-1],[1,0,1],[1,h,-1]]){
      const out=[];for(let i=0;i<pts.length;i++){
        const a=pts[i],b=pts[(i+1)%pts.length],ia=sign*(a[axis]-edge)>=0,ib=sign*(b[axis]-edge)>=0;
        if(ia)out.push(a);
        if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
      }pts=out;if(!pts.length)break;
    }
    return pts.filter((a,i)=>Math.hypot(a[0]-pts[(i+pts.length-1)%pts.length][0],a[1]-pts[(i+pts.length-1)%pts.length][1])>1e-9);
  },
  _rows(poly,w,h){
    if(poly.length<3)return [];
    const rows=[],lo=Math.max(0,Math.ceil(Math.min(...poly.map(p=>p[1]))-.5)),hi=Math.min(h-1,Math.floor(Math.max(...poly.map(p=>p[1]))-.5));
    for(let y=lo;y<=hi;y++){
      const yy=y+.5,xs=[];
      for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))xs.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      if(xs.length<2)continue;
      const x0=Math.max(0,Math.ceil(Math.min(...xs)-.5)),x1=Math.min(w-1,Math.floor(Math.max(...xs)-.5));
      if(x0<=x1)rows.push([y*w+x0,y*w+x1]);
    }return rows;
  },
  _solve(p,img){
    const n=this._n,quality={Draft:[40,12,30],Balanced:[64,22,55],Fine:[88,36,85]}[p.quality]||[64,22,55];
    const count=Math.round(n(p.count,150,1,300)),gamma=n(p.gamma,1,.3,3),maxAlpha=n(p.coverage,.3,.1,.95),scale=n(p.scale,65,10,100)/100;
    const penIds=[['layer',0],['pen2',6],['pen3',7],['pen4',10],['pen5',1],['pen6',4]].slice(0,Math.round(n(p.colours,1,1,6))).map(([k,d])=>Math.round(n(p[k],d,0,11)));
    const palette=[...new Set(penIds)].map(layer=>({layer,rgb:[1,3,5].map(k=>parseInt(PENS[layer].c.slice(k,k+2),16)/255)}));
    const signature=JSON.stringify([p.shape,quality,count,gamma,maxAlpha,scale,n(p.seed,37,-2147483648,2147483647),palette]);
    const cached=this._cache.get(img);if(cached?.signature===signature)return cached.result;
    const size=quality[0],w=Math.max(2,Math.round(size*img.w/Math.max(img.w,img.h))),h=Math.max(2,Math.round(size*img.h/Math.max(img.w,img.h)));
    const target=new Float64Array(w*h*3),current=new Float64Array(w*h*3).fill(1),weights=[.299,.587,.114],rgb=img.rgb?.length===img.w*img.h*3;
    const at=(x,y,c)=>{
      const k=Math.max(0,Math.min(img.h-1,y))*img.w+Math.max(0,Math.min(img.w-1,x));
      const v=rgb&&palette.length>1?img.rgb[k*3+c]/255:1-img.g[k];return n(v,1,0,1);
    };
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++){
      // Area-like 2x2 supersampling before the low-resolution search.
      let sum=0;for(const dy of [.25,.75])for(const dx of [.25,.75]){
        const u=(x+dx)/w*img.w-.5,v=(y+dy)/h*img.h-.5,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
        sum+=at(ix,iy,c)*(1-fx)*(1-fy)+at(ix+1,iy,c)*fx*(1-fy)+at(ix,iy+1,c)*(1-fx)*fy+at(ix+1,iy+1,c)*fx*fy;
      }target[(y*w+x)*3+c]=1-Math.pow(1-sum/4,gamma);
    }
    let error=0;for(let i=0;i<target.length;i++)error+=weights[i%3]*(1-target[i])**2;
    const initialError=error,accepted=[],rng=mulberry32(Math.round(n(p.seed,37,-2147483648,2147483647))),scores=[error];
    const types={Triangles:[0],Rectangles:[1],Ellipses:[2],Circles:[3],Mixed:[0,1,2,3]}[p.shape]||[0];
    const clamp=s=>({...s,x:n(s.x,w/2,0,w),y:n(s.y,h/2,0,h),rx:n(s.rx,4,.6,w*.8),ry:n(s.type===3?s.rx:s.ry,4,.6,s.type===3?w*.8:h*.8),tip:n(s.tip,0,-1,1)});
    const evaluate=s=>{
      const polygon=this._polygon(s,w,h),rows=this._rows(polygon,w,h);if(!rows.length)return {gain:0};
      const numer=[0,0,0],denom=[0,0,0];
      for(const [a,b]of rows)for(let i=a;i<=b;i++)for(let c=0;c<3;c++){const k=i*3+c,old=current[k];numer[c]+=old*(old-target[k]);denom[c]+=old*old;}
      let best={gain:0};
      for(const pen of palette){
        let a=0,b=0;for(let c=0;c<3;c++){const ink=1-pen.rgb[c];a+=weights[c]*ink*numer[c];b+=weights[c]*ink*ink*denom[c];}
        if(b<1e-12||a<=0)continue;
        const alpha=Math.min(maxAlpha,a/b),gain=2*alpha*a-alpha*alpha*b;
        if(alpha>=.035&&gain>best.gain)best={gain,alpha,pen};
      }return {...best,shape:s,polygon,rows};
    };
    for(let index=0;index<count&&error>1e-8;index++){
      // Sample centres from remaining positive error, mixing in uniform starts
      // so isolated small details and the full sheet remain eligible.
      const residual=new Float64Array(w*h);let total=0;
      for(let i=0;i<w*h;i++){let e=0;for(let c=0;c<3;c++)e+=weights[c]*Math.max(0,current[i*3+c]-target[i*3+c])**2;total+=e;residual[i]=total;}
      if(total<1e-9)break;
      const centre=()=>{let lo=0,hi=residual.length-1,t=rng()*total;while(lo<hi){const mid=(lo+hi)>>1;if(residual[mid]<t)lo=mid+1;else hi=mid;}return [lo%w+rng(),Math.floor(lo/w)+rng()];};
      let best={gain:0};
      for(let k=0;k<quality[1];k++){
        const [x,y]=k%5===0?[rng()*w,rng()*h]:centre(),t=types[Math.floor(rng()*types.length)];
        const radius=.008+scale*.42*rng()**3,rx=w*radius,ry=t===3?rx:h*radius*(.25+.9*rng());
        const test=evaluate(clamp({x,y,rx,ry,a:rng()*Math.PI,type:t,tip:rng()*2-1}));if(test.gain>best.gain)best=test;
      }
      if(!best.shape)break;
      // Several restarts above choose the basin; keep only improving local
      // mutations. The trial count is deterministic, never wall-clock based.
      for(let k=0;k<quality[2];k++){
        const s={...best.shape},step=(.03+.15*(1-k/quality[2]))*Math.min(w,h),delta=()=> (rng()-.5)*2;
        const kind=Math.floor(rng()*6);
        if(kind===0)s.x+=delta()*step;else if(kind===1)s.y+=delta()*step;
        else if(kind===2)s.rx+=delta()*step;else if(kind===3)s.ry+=delta()*step;
        else if(kind===4)s.a+=delta()*.65;else s.tip+=delta()*.4;
        const test=evaluate(clamp(s));if(test.gain>best.gain)best=test;
      }
      if(best.gain<initialError*1e-7)break;
      for(const [a,b]of best.rows)for(let i=a;i<=b;i++)for(let c=0;c<3;c++)current[i*3+c]*=1-best.alpha*(1-best.pen.rgb[c]);
      error-=best.gain;scores.push(error);
      accepted.push({polygon:best.polygon,alpha:best.alpha,layer:best.pen.layer,type:best.shape.type,gain:best.gain});
    }
    const result={w,h,target,current,shapes:accepted,scores,initialError,finalError:error};
    this._cache.set(img,{signature,result});return result;
  },
  _hatch(poly,angle,pitch,phase){
    const cs=Math.cos(angle),sn=Math.sin(angle),uv=poly.map(([x,y])=>[cs*x+sn*y,-sn*x+cs*y]);
    const lo=Math.min(...uv.map(q=>q[1])),hi=Math.max(...uv.map(q=>q[1])),paths=[];
    // At least one centre stroke in tiny/light shapes; otherwise a fitted
    // primitive could silently disappear just because of hatch phase.
    let first=Math.ceil(lo/pitch-phase),last=Math.floor(hi/pitch-phase);
    const ys=first<=last?Array.from({length:last-first+1},(_,i)=>(first+i+phase)*pitch):[(lo+hi)/2];
    for(const y of ys){const xs=[];for(let i=0;i<uv.length;i++){const a=uv[i],b=uv[(i+1)%uv.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      if(xs.length>=2){const a=Math.min(...xs),b=Math.max(...xs);if(b-a>1e-7)paths.push([[cs*a-sn*y,sn*a+cs*y],[cs*b-sn*y,sn*b+cs*y]]);}
    }return paths;
  },
  compute(ins,p,ctx,node){
    const img=node?.data?.img,fit=this._fit(p,ctx,img);if(!fit)return EMPTY;
    const n=this._n,model=this._solve(p,img),show=Math.ceil(model.shapes.length*n(p.reveal,100,0,100)/100);
    const width=n(p.penWidth,.3,.08,3),angle=n(p.angle,45,-36000,36000)*Math.PI/180,variation=n(p.angleVar,25,0,180)*Math.PI/180;
    const cross=p.render==='Cross hatch',outline=p.render==='Outlines';
    const planned=model.shapes.map((s,i)=>{
      const polygon=s.polygon.map(([x,y])=>[fit.x+x/model.w*fit.w,fit.y+y/model.h*fit.h]);
      const alpha=cross?1-Math.sqrt(1-s.alpha):s.alpha,pitch=width/alpha;
      const rng=mulberry32(Math.round(n(p.seed,37,-2147483648,2147483647))+i*15485863+77),a=angle+(rng()-.5)*2*variation,phase=rng();
      const range=a=>{const values=polygon.map(([x,y])=>-Math.sin(a)*x+Math.cos(a)*y);return Math.max(...values)-Math.min(...values);};
      return {...s,polygon,pitch,a,phase,cost:2*(Math.ceil(range(a)/pitch)+2+(cross?Math.ceil(range(a+Math.PI/2)/pitch)+2:0))};
    });
    const total=planned.reduce((v,s)=>v+s.cost,0),factor=Math.max(1,total/96000),paths=[];
    for(const s of planned.slice(0,show)){
      if(outline){paths.push({pts:s.polygon,closed:true,layer:s.layer});continue;}
      for(const a of cross?[s.a,s.a+Math.PI/2]:[s.a])for(const pts of this._hatch(s.polygon,a,s.pitch*factor,s.phase))paths.push({pts,closed:false,layer:s.layer});
    }
    return applyStyle({paths},ins[0]);
  },
};
