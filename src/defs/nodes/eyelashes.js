import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key:"eyelashes",name:"Eyelashes",cat:"gen",group:"organic",
  desc:"Clumped, uneven lashes inspired by an accidental wet-ink plot. Long curved hairs, tapered bundles and little root tangles are real pen strokes. Lash form Tapered spikes makes each lash a wide base, two curved flanks and a sharp shared tip, with real parallel fill strokes; Spike base width controls thickness. Hairs keeps the fine strands. Lower lid adds a second lash row. Shape chooses Almond, Oval or Swept. Openness chooses the eye opening; Timeline blinks with an open hold, Phase and whole Loops, using the same seeded hairs and fixed framing throughout. Eye contents offers four iris drawings or a blue Eye artwork input. Auto uses a connected drawing, including an empty one, otherwise the selected iris. Artwork maps the whole source canvas into the fully open eye and stays still while the lids mask it; Contain, Cover or Canvas choose the mapping. Nothing behind a closed lid is drawn. Source pens are retained. Draw lid can leave only the lashes. Length is the longest hair before fitting; Length variation shortens some hairs, Clumping gathers roots, Curl and Lean bend them, and Root ink adds tapered parallel strokes and small tangles. Change Seed for another accident. Dense requests coarsen all lash sampling/fill together or return empty, never a prefix. Search: eyelash, eye, blink, mascara, silma, ripsi.",
  ins:[Pin("style","Style"),Pin("paths","Eye artwork")],outs:[Pin("paths","Drawing")],
  params:[
    {key:"shape",label:"Eye shape",type:"select",options:["Almond","Oval","Swept"],def:"Almond"},
    {key:"lower",label:"Lower lid",type:"check",def:true},
    {key:"drawLid",label:"Draw lid",type:"check",def:true},
    {key:"content",label:"Eye contents",type:"select",options:["Auto","Iris","Artwork","Artwork + iris","None"],def:"Auto"},
    {key:"iris",label:"Iris",type:"select",options:["Round","Radiant","Slit","Spiral"],def:"Radiant",showIf:p=>!["Artwork","None"].includes(p.content)},
    {key:"artFit",label:"Artwork fit",type:"select",options:["Cover","Contain","Canvas"],def:"Cover",showIf:p=>!["Iris","None"].includes(p.content)},
    {key:"open",label:"Openness %",type:"slider",min:0,max:100,step:1,def:100},
    {key:"time",label:"Time source",type:"select",options:["Manual","Timeline"],def:"Timeline"},
    {key:"phase",label:"Blink phase °",type:"slider",min:0,max:360,step:1,def:0,showIf:p=>p.time==="Timeline"},
    {key:"loops",label:"Blinks per timeline",type:"slider",min:0,max:8,step:1,def:1,showIf:p=>p.time==="Timeline"},
    {key:"hold",label:"Open hold %",type:"slider",min:0,max:80,step:1,def:50,showIf:p=>p.time==="Timeline"},
    {key:"width",label:"Eye width mm",type:"slider",min:12,max:350,step:1,def:180},
    {key:"height",label:"Eye height mm",type:"slider",min:4,max:180,step:1,def:72},
    {key:"angle",label:"Rotation °",type:"slider",min:-180,max:180,step:1,def:0},
    {key:"form",label:"Lash form",type:"select",options:["Hairs","Tapered spikes"],def:"Hairs"},
    {key:"spikeWidth",label:"Spike base width mm",type:"slider",min:.3,max:6,step:.1,def:2.2,showIf:p=>p.form==="Tapered spikes"},
    {key:"count",label:"Upper lashes",type:"slider",min:0,max:1200,step:1,def:330},
    {key:"length",label:"Lash length mm",type:"slider",min:0,max:70,step:.5,def:25},
    {key:"variation",label:"Length variation %",type:"slider",min:0,max:100,step:1,def:82},
    {key:"clumping",label:"Clumping %",type:"slider",min:0,max:100,step:1,def:85},
    {key:"clumps",label:"Clumps",type:"slider",min:2,max:180,step:1,def:43},
    {key:"curl",label:"Curl %",type:"slider",min:-100,max:100,step:1,def:24},
    {key:"lean",label:"Lean °",type:"slider",min:-65,max:65,step:1,def:16},
    {key:"disorder",label:"Disorder %",type:"slider",min:0,max:100,step:1,def:60},
    {key:"ink",label:"Root ink %",type:"slider",min:0,max:100,step:1,def:65},
    {key:"rootWidth",label:"Root width mm",type:"slider",min:.1,max:3,step:.1,def:.8,showIf:p=>+p.ink>0},
    {key:"pitch",label:"Root fill pitch mm",type:"slider",min:.15,max:1,step:.05,def:.3,showIf:p=>+p.ink>0||p.form==="Tapered spikes"},
    {key:"lowerCount",label:"Lower lashes %",type:"slider",min:0,max:100,step:1,def:48,showIf:p=>!!p.lower},
    {key:"lowerLength",label:"Lower length %",type:"slider",min:0,max:100,step:1,def:58,showIf:p=>!!p.lower},
    {key:"irisSize",label:"Iris size %",type:"slider",min:10,max:140,step:1,def:82,showIf:p=>!["Artwork","None"].includes(p.content)},
    {key:"pupil",label:"Pupil size %",type:"slider",min:5,max:70,step:1,def:32,showIf:p=>!["Artwork","None"].includes(p.content)&&p.iris!=="Spiral"},
    {key:"lookX",label:"Look X %",type:"slider",min:-80,max:80,step:1,def:0,showIf:p=>!["Artwork","None"].includes(p.content)},
    {key:"lookY",label:"Look Y %",type:"slider",min:-80,max:80,step:1,def:0,showIf:p=>!["Artwork","None"].includes(p.content)},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:12},
    {key:"seed",label:"Seed",type:"seed",def:72},
    {key:"layer",label:"Pen",type:"pen",def:0}
  ],
  _n(v,d,lo,hi){return Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));},
  _frame(p,ctx){
    const W=Number(ctx?.W),H=Number(ctx?.H);if(!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0||W>100000||H>100000)return null;
    const n=this._n,m=n(p.margin,12,0,100000);if(W-2*m<2||H-2*m<2)return null;
    const w=n(p.width,180,4,4000),h=n(p.height,72,2,4000),L=n(p.length,25,0,300),root=n(p.ink,65,0,100)>0?n(p.rootWidth,.8,0,6):0,spike=p.form==="Tapered spikes"?n(p.spikeWidth,2.2,.2,12):0,pad=2.2*L+Math.max(2*root,spike)+2;
    const a=n(p.angle,0,-1e9,1e9)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),bx=(w/2+pad)*Math.abs(c)+(h/2+pad)*Math.abs(s),by=(w/2+pad)*Math.abs(s)+(h/2+pad)*Math.abs(c);
    const scale=Math.min(1,(W/2-m)/bx,(H/2-m)/by);
    return {W,H,m,w,h,L,root,spike,scale,c,s,map:q=>[W/2+scale*(q[0]*c-q[1]*s),H/2+scale*(q[0]*s+q[1]*c)]};
  },
  _opening(p,ctx){
    const n=this._n,open=n(p.open,100,0,100)/100;if(p.time!=="Timeline")return open;
    const frames=Math.max(1,Math.round(n(ctx?.frameCount,24,1,100000))),loops=Math.round(n(p.loops,1,0,32));
    let t=n(ctx?.frameIdx,0,-1e9,1e9)/frames*loops+n(p.phase,0,-1e12,1e12)/360;t=((t%1)+1)%1;
    const hold=n(p.hold,50,0,90)/100;if(t<=hold)return open;
    const q=(t-hold)/(1-hold);return open*(.5+.5*Math.cos(q*Math.PI*2));
  },
  _pose(p,F,opening){
    const upper=[],lower=[],openUpper=[],openLower=[],N=64;
    for(let i=0;i<=N;i++){
      const u=i/N,x=(u-.5)*F.w,base=Math.sin(Math.PI*u);
      const f=p.shape==="Oval"?Math.sqrt(Math.max(0,1-(2*u-1)**2)):p.shape==="Swept"?base**1.1*(.82+.18*(2*u-1)):base**.78;
      const seam=F.h*.11*(1-opening)*base;
      upper.push([x,seam-F.h*.5*opening*f]);lower.push([x,seam+F.h*.5*opening*f]);
      openUpper.push([x,-F.h*.5*f]);openLower.push([x,F.h*.5*f]);
    }
    return {upper,lower,openUpper,openLower,mask:opening>1e-6?[...upper,...lower.slice(1,-1).reverse()]:[]};
  },
  _track(open,current){
    const cumulative=[0];for(let i=1;i<open.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(open[i][0]-open[i-1][0],open[i][1]-open[i-1][1]));
    return t=>{
      const d=Math.max(0,Math.min(1,t))*cumulative.at(-1);let lo=0,hi=cumulative.length-1;
      while(lo+1<hi){const mid=(lo+hi)>>1;if(cumulative[mid]<d)lo=mid;else hi=mid;}
      const f=(d-cumulative[lo])/(cumulative[hi]-cumulative[lo]||1),a=current[lo],b=current[hi],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;
      return {r:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],t:[dx/l,dy/l]};
    };
  },
  _inside(q,poly){
    let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[j],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1],cross=dx*(q[1]-a[1])-dy*(q[0]-a[0]);
      if(Math.abs(cross)<=1e-8*Math.max(1,Math.hypot(dx,dy))&&(q[0]-a[0])*(q[0]-b[0])+(q[1]-a[1])*(q[1]-b[1])<=1e-8)return true;
      if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<a[0]+(q[1]-a[1])*dx/dy)inside=!inside;
    }return inside;
  },
  _clip(source,mask){
    if(mask.length<3)return {paths:[]};
    const out=[];let work=0,points=0;
    for(const original of source){
      const pts=original.pts;let run=[],all=true;const runs=[];
      const flush=()=>{if(run.length>=2)runs.push(run);run=[];};
      const add=(a,b)=>{if(run.length&&Math.hypot(run.at(-1)[0]-a[0],run.at(-1)[1]-a[1])>1e-7)flush();if(!run.length)run.push(a);if(Math.hypot(run.at(-1)[0]-b[0],run.at(-1)[1]-b[1])>1e-9)run.push(b);};
      for(let i=1;i<pts.length+(original.closed?1:0);i++){
        const a=pts[i-1],b=pts[i%pts.length],dx=b[0]-a[0],dy=b[1]-a[1],cuts=[0,1];
        if(Math.hypot(dx,dy)<1e-10)continue;
        for(let j=0;j<mask.length;j++){
          if(++work>10000000)return null;
          const c=mask[j],d=mask[(j+1)%mask.length],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;
          if(Math.abs(den)<1e-12)continue;
          const qx=c[0]-a[0],qy=c[1]-a[1],t=(qx*ey-qy*ex)/den,u=(qx*dy-qy*dx)/den;
          if(t>1e-10&&t<1-1e-10&&u>=-1e-9&&u<=1+1e-9)cuts.push(t);
        }
        cuts.sort((a,b)=>a-b);let kept=false;
        for(let j=1;j<cuts.length;j++){
          const lo=cuts[j-1],hi=cuts[j];if(hi-lo<1e-10)continue;
          work+=mask.length;if(work>10000000)return null;
          const mid=(lo+hi)/2;
          if(this._inside([a[0]+dx*mid,a[1]+dy*mid],mask)){
            if(lo>1e-9){all=false;flush();}add([a[0]+dx*lo,a[1]+dy*lo],[a[0]+dx*hi,a[1]+dy*hi]);kept=true;
            if(hi<1-1e-9){all=false;flush();}
          }else{all=false;flush();}
        }
        if(!kept){all=false;flush();}
      }
      flush();
      for(const pts of runs){
        const closed=!!original.closed&&all&&runs.length===1&&pts.length>3&&Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<1e-7;
        if(closed)pts.pop();points+=pts.length;if(points>110000)return null;
        out.push({...original,pts,closed,role:"eye"});
      }
    }
    return {paths:out};
  },
  _artwork(src,p,F){
    if(!Array.isArray(src?.paths)||src.paths.length>30000)return null;
    let count=0;const paths=[];
    const fit=p.artFit,scale=fit==="Canvas"?1:(fit==="Contain"?Math.min:Math.max)(F.w/F.W,F.h/F.H);
    for(const path of src.paths){
      if(!Array.isArray(path?.pts)||(count+=path.pts.length)>120000)return null;
      if(!path.pts.every(q=>Array.isArray(q)&&q.length>=2&&q.slice(0,2).every(v=>Number.isFinite(v)&&Math.abs(v)<=1e9)))return null;
      if(path.pts.length<2)continue;
      paths.push({...path,pts:path.pts.map(q=>{
        const x=q[0]-F.W/2,y=q[1]-F.H/2;
        return fit==="Canvas"?[(x*F.c+y*F.s)/F.scale,(-x*F.s+y*F.c)/F.scale]:[x*scale,y*scale];
      }),layer:Math.round(this._n(path.layer,0,0,11)),role:"eye"});
    }return paths;
  },
  _iris(p,F,pen){
    const n=this._n,r=F.h*.5*n(p.irisSize,82,5,160)/100,cx=n(p.lookX,0,-100,100)/100*F.w*.35,cy=n(p.lookY,0,-100,100)/100*F.h*.35,pr=r*n(p.pupil,32,3,80)/100,paths=[];
    const ring=(rx,ry=rx)=>paths.push({pts:Array.from({length:80},(_,i)=>{const a=i/80*Math.PI*2;return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];}),closed:true,layer:pen});
    ring(r);ring(r*.94);
    if(p.iris==="Spiral"){
      const turns=Math.max(1,r/.8),N=Math.min(3500,Math.max(80,Math.ceil(turns*32))),pts=[];
      for(let i=0;i<=N;i++){const t=i/N,a=t*turns*Math.PI*2;pts.push([cx+Math.cos(a)*r*t,cy+Math.sin(a)*r*t]);}paths.push({pts,closed:false,layer:pen});
    }else{
      if(p.iris==="Radiant")for(let i=0;i<100;i++){
        const rng=mulberry32(n(p.seed,72,-2147483648,2147483647)+i*7919),a=i/100*Math.PI*2,lo=pr+(r-pr)*(.06+.16*rng()),hi=r*(.85+.08*rng());
        paths.push({pts:[[cx+Math.cos(a)*lo,cy+Math.sin(a)*lo],[cx+Math.cos(a+.012)*hi,cy+Math.sin(a+.012)*hi]],closed:false,layer:pen});
      }
      if(p.iris==="Round")ring(r*.66);
      const rx=p.iris==="Slit"?pr*.23:pr,ry=p.iris==="Slit"?r*.8:pr;
      const turns=Math.min(160,Math.max(1,Math.ceil(Math.max(rx,ry)/.32)));
      for(let j=1;j<=turns;j++)ring(rx*j/turns,ry*j/turns);
    }return paths;
  },
  _lashes(p,F,P,quality,pen){
    const n=this._n,result=[],count=Math.round(n(p.count,330,0,1800)),seed=Math.round(n(p.seed,72,-2147483648,2147483647)),clumps=Math.round(n(p.clumps,43,2,250)),clumping=n(p.clumping,85,0,100)/100,disorder=n(p.disorder,60,0,100)/100,variation=n(p.variation,82,0,100)/100,curl=n(p.curl,24,-100,100)/100,ink=n(p.ink,65,0,100)/100;
    const spiked=p.form==="Tapered spikes",pitch=n(p.pitch,.3,.12,2)*quality**2,steps=Math.max(5,Math.round(16/quality));
    for(const side of [-1,1]){
      if(side===1&&!p.lower)continue;
      const lower=side===1,N=lower?Math.round(count*n(p.lowerCount,48,0,100)/100):count,L=F.L*(lower?n(p.lowerLength,58,0,100)/100:1),track=this._track(lower?P.openLower:P.openUpper,lower?P.lower:P.upper);
      if(!N||!L)continue;
      for(let i=0;i<N;i++){
        const rng=mulberry32(seed+Math.imul(i+1,7919)+(lower?104729:0)),u=(i+.5)/N,cluster=Math.floor(u*clumps),groupRng=mulberry32(seed+cluster*613+(lower?3469:0)),groupLean=(groupRng()-.5)*1.1*disorder;
        const centre=(cluster+.5+(groupRng()-.5)*.45)/clumps,t=u*(1-clumping)+(centre+(rng()-.5)*.32/clumps)*clumping;
        const {r,t:T}=track(t),normal=[-T[1]*side,T[0]*side],len=L*(1-.86*variation*rng()),lean=Math.max(-1,Math.min(1,n(p.lean,16,-70,70)/90+groupLean+(rng()-.5)*.65*disorder)),bend=curl*(.45+.55*rng()),jitter=(rng()-.5)*disorder*.06*len,phase=rng()*Math.PI*2;
        const width=spiked?F.spike*(.6+.4*rng()):F.root*ink*(.3+.7*rng());
        const stroke=offset=>{
          const pts=[];
          for(let j=0;j<=steps;j++){
            const v=j/steps,along=len*(lean*v+bend*.6*v*v)+jitter*Math.sin(v*Math.PI*2+phase)*Math.sin(v*Math.PI),out=len*v;
            const taper=offset*(1-v)**(spiked?1.3:2);
            pts.push([r[0]+normal[0]*out+T[0]*(along+taper),r[1]+normal[1]*out+T[1]*(along+taper)]);
          }
          return pts;
        };
        const meta={layer:pen,role:"lash",lid:lower?"lower":"upper",hair:i,group:(lower?"lower-":"upper-")+cluster,spike:spiked};
        if(spiked){
          const left=stroke(-width/2),right=stroke(width/2);
          result.push({...meta,pts:left.concat(right.slice(0,-1).reverse()),closed:true,outline:true});
          const passes=Math.max(0,Math.min(32,Math.ceil(width/pitch)-1));
          for(let lane=0;lane<passes;lane++)result.push({...meta,pts:stroke(((lane+1)/(passes+1)-.5)*width),closed:false,outline:false});
        }else{
          const passes=Math.max(1,Math.min(8,Math.ceil(width/pitch)+1));
          for(let lane=0;lane<passes;lane++)result.push({...meta,pts:stroke(passes===1?0:(lane/(passes-1)-.5)*width),closed:false});
        }
      }
      if(ink>0)for(let j=0;j<clumps;j++){
        const rng=mulberry32(seed+j*1013+(lower?1553:0));if(rng()>ink)continue;
        const {r,t:T}=track((j+.3+.4*rng())/clumps),normal=[-T[1]*side,T[0]*side],size=F.root*(.4+ink*rng()),pts=[];
        for(let k=0;k<=12;k++){const a=k/12*Math.PI*3;pts.push([r[0]+T[0]*Math.sin(a)*size+normal[0]*Math.sin(a*2)*size*.7,r[1]+T[1]*Math.sin(a)*size+normal[1]*Math.sin(a*2)*size*.7]);}
        result.push({pts,closed:false,layer:pen,role:"root",lid:lower?"lower":"upper"});
      }
    }return result;
  },
  overlay(p,ctx){const F=this._frame(p,ctx);if(!F)return [];const P=this._pose(p,F,this._opening(p,ctx));return [{kind:"poly",pts:(P.mask.length?[...P.mask,P.mask[0]]:P.upper).map(F.map)}];},
  compute(ins,p,ctx){
    const F=this._frame(p,ctx);if(!F)return EMPTY;
    const opening=this._opening(p,ctx),P=this._pose(p,F,opening),pen=Math.round(this._n(p.layer,0,0,11)),wired=ins?.[1]!=null,content=p.content||"Auto";
    const useArt=content==="Artwork"||content==="Artwork + iris"||(content==="Auto"&&wired),useIris=content==="Iris"||content==="Artwork + iris"||(content==="Auto"&&!wired);
    let inside=[];
    if(useIris)inside.push(...this._iris(p,F,pen));
    if(useArt&&wired){const art=this._artwork(ins[1],p,F);if(!art)return EMPTY;inside.push(...art);}
    const clipped=this._clip(inside,P.mask);if(!clipped)return EMPTY;
    const eye=clipped.paths.map(q=>({...q,pts:q.pts.map(F.map)})),lids=[];
    if(p.drawLid!==false){lids.push({pts:P.upper.map(F.map),closed:false,layer:pen,role:"lid",lid:"upper"});if(p.lower&&opening>1e-6)lids.push({pts:P.lower.map(F.map),closed:false,layer:pen,role:"lid",lid:"lower"});}
    for(let attempt=0;attempt<6;attempt++){
      const lashes=this._lashes(p,F,P,1.5**attempt,pen).map(q=>({...q,pts:q.pts.map(F.map)}));
      const paths=[...lids,...lashes,...eye];if(paths.reduce((n,q)=>n+q.pts.length,0)>110000)continue;
      const result=applyStyle({paths},ins?.[0]);if(result.paths.reduce((n,q)=>n+q.pts.length,0)>120000)continue;
      if(!result.paths.every(q=>q.pts.length>=2&&q.pts.every(v=>v.length===2&&v.every(Number.isFinite)&&v[0]>=F.m-1e-6&&v[0]<=F.W-F.m+1e-6&&v[1]>=F.m-1e-6&&v[1]<=F.H-F.m+1e-6)))return EMPTY;
      return result;
    }return EMPTY;
  }
};
