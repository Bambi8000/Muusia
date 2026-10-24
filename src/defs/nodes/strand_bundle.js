import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "strand_bundle",
  name: "Strand Bundle",
  cat: "gen",
  group: "organic",
  desc: "Dense pen-line bundles that fray into individual threads or open and return as a ribbon. Fan and Flow keep a tidy ordered set; Wander drifts and Tangle adds looping, crossing paths. Fray end releases the tips; Split and return brings every strand back into the same packed stem. Stem can be Straight, Sine or seeded Meander, independently of thread motion. Pen width and Ink overlap plan centreline spacing: use your actual drawn line width for a solid dark stem. Preview and SVG use Muusia's standard display stroke, not the selected physical nib. Each strand is one continuous open pen stroke. Length accepts 30–2000 mm before paper fitting. Start cut and End cut tilt independent straight trimming planes in the stem frame; zero preserves the original ends and tip variation. Positive angles move the cutting plane toward the far end as you move across the bundle. Cuts protect the release/rejoin region; extreme angles are reduced when the available end length is too short. Curved or looping offcuts are discarded so each strand stays connected. Complete bundles only shrink to fit their cells, making the physical pitch denser rather than wider. Very dense jobs first reduce curve samples, then narrow all cores equally to preserve every bundle and physical pitch; numeric outputs show maximum core pitch and minimum core width used. A wired dashed Style deliberately breaks the solid stem. Keep Seed fixed for repeatable paths.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Drawing"),Pin("value", "Core pitch mm"),Pin("value", "Core width mm")],
  params: [
    {key:"behavior",label:"Behavior",type:"select",options:["Fray end","Split and return"],def:"Fray end"},
    {key:"style",label:"Threads",type:"select",options:["Fan","Flow","Wander","Tangle"],def:"Wander"},
    {key:"nib",label:"Pen width mm",type:"slider",min:0.05,max:3,step:0.05,def:0.5},
    {key:"overlap",label:"Ink overlap %",type:"slider",min:0,max:80,step:1,def:40},
    {key:"width",label:"Bundle width mm",type:"slider",min:1,max:60,step:0.5,def:12},
    {key:"length",label:"Length mm",type:"slider",min:30,max:2000,step:1,def:200},
    {key:"startCut",label:"Start cut °",type:"slider",min:-75,max:75,step:1,def:0},
    {key:"endCut",label:"End cut °",type:"slider",min:-75,max:75,step:1,def:0},
    {key:"release",label:"Release at %",type:"slider",min:10,max:80,step:1,def:48},
    {key:"rejoin",label:"Rejoin at %",type:"slider",min:25,max:95,step:1,def:85,showIf:p=>p.behavior==="Split and return"},
    {key:"spread",label:"Spread mm",type:"slider",min:0,max:180,step:1,def:90},
    {key:"chaos",label:"Chaos %",type:"slider",min:0,max:100,step:1,def:65,showIf:p=>["Wander","Tangle"].includes(p.style)},
    {key:"threadCycles",label:"Thread turns",type:"slider",min:0.5,max:6,step:0.1,def:2.2,showIf:p=>p.style!=="Fan"},
    {key:"tipVar",label:"Tip length variation %",type:"slider",min:0,max:65,step:1,def:25,showIf:p=>p.behavior!=="Split and return"},
    {key:"stem",label:"Stem",type:"select",options:["Straight","Sine","Meander"],def:"Sine"},
    {key:"bend",label:"Stem bend mm",type:"slider",min:0,max:80,step:1,def:12,showIf:p=>p.stem!=="Straight"},
    {key:"stemCycles",label:"Stem turns",type:"slider",min:0.25,max:3,step:0.05,def:1.1,showIf:p=>p.stem!=="Straight"},
    {key:"angle",label:"Angle °",type:"slider",min:-180,max:180,step:1,def:-90},
    {key:"count",label:"Bundles",type:"slider",min:1,max:6,step:1,def:1},
    {key:"layout",label:"Arrangement",type:"select",options:["Columns","Rows"],def:"Columns",showIf:p=>Math.round(p.count)>1},
    {key:"detail",label:"Curve detail",type:"slider",min:64,max:320,step:1,def:220},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:15},
    {key:"seed",label:"Seed",type:"seed",def:17},
    {key:"layer",label:"Pen",type:"pen",def:0},
  ],
  overlay(p,ctx) {
    const m=Number.isFinite(+p.margin)?Math.max(0,Math.min(60,+p.margin)):15;
    return Number.isFinite(ctx.W)&&Number.isFinite(ctx.H)&&ctx.W>2*m&&ctx.H>2*m
      ?[{kind:"rect",x:m,y:m,w:ctx.W-2*m,h:ctx.H-2*m}]:[];
  },
  _frame(p,ctx) {
    const num=(k,d,a,b)=>Number.isFinite(+p[k])?Math.max(a,Math.min(b,+p[k])):d;
    const W=ctx.W,H=ctx.H,m=num('margin',15,0,60),nib=num('nib',.5,.05,3);
    const count=Math.round(num('count',1,1,6)),rows=p.layout==='Rows'&&count>1;
    const cellW=(W-2*m)/(rows?1:count),cellH=(H-2*m)/(rows?count:1);
    if(!Number.isFinite(W)||!Number.isFinite(H)||cellW<=nib+.01||cellH<=nib+.01)return null;
    const requestedPitch=nib*(1-num('overlap',40,0,80)/100),requestedSpan=Math.max(0,num('width',12,1,60)-nib);
    const detail=Math.round(num('detail',220,64,320)),minSteps=Math.min(96,detail),budget=110000;
    const maxLines=Math.max(2,Math.floor(budget/(count*(minSteps+4))));
    const desired=requestedSpan>0?Math.ceil(requestedSpan/requestedPitch)+1:1;
    const lines=Math.min(desired,maxLines),span=Math.min(requestedSpan,(lines-1)*requestedPitch);
    const pitch=lines>1?span/(lines-1):0;
    const steps=Math.min(detail,Math.floor(budget/(count*lines))-4);
    const behavior=p.behavior==='Split and return'?'Split and return':'Fray end';
    const style=['Fan','Flow','Wander','Tangle'].includes(p.style)?p.style:'Wander';
    const stem=['Straight','Sine','Meander'].includes(p.stem)?p.stem:'Sine';
    return {W,H,m,nib,count,rows,cellW,cellH,lines,span,pitch,steps,behavior,style,stem,
      startCut:num('startCut',0,-75,75)*Math.PI/180,endCut:num('endCut',0,-75,75)*Math.PI/180,
      length:num('length',200,30,2000),release:num('release',48,10,80)/100,
      rejoin:Math.min(.95,Math.max(num('release',48,10,80)/100+.1,num('rejoin',85,25,95)/100)),
      spread:num('spread',90,0,180),chaos:['Wander','Tangle'].includes(style)?num('chaos',65,0,100)/100:0,
      threadCycles:style==='Fan'?0:num('threadCycles',2.2,.5,6),tipVar:behavior==='Fray end'?num('tipVar',25,0,65)/100:0,
      bend:stem==='Straight'?0:num('bend',12,0,80),stemCycles:stem==='Straight'?0:num('stemCycles',1.1,.25,3),
      angle:num('angle',-90,-180,180)*Math.PI/180,seed:num('seed',17,-2147483648,2147483647)|0,
      layer:Math.round(num('layer',0,0,11))};
  },
  compute(ins,p,ctx) {
    const f=this._frame(p,ctx);if(!f)return [EMPTY,0,0];
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
    const TAU=2*Math.PI,ca=Math.cos(f.angle),sa=Math.sin(f.angle),paths=[];
    let maxPitch=0,minWidth=Infinity;
    for(let b=0;b<f.count;b++){
      const rng=mulberry32((f.seed+Math.imul(b+1,104729))|0),ph1=rng()*TAU,ph2=rng()*TAU;
      const stemY=t=>f.stem==='Sine'?f.bend*Math.sin(TAU*f.stemCycles*t):f.stem==='Meander'?
        f.bend*(.65*(Math.sin(TAU*f.stemCycles*t+ph1)-Math.sin(ph1))+.35*(Math.sin(TAU*f.stemCycles*1.7*t+ph2)-Math.sin(ph2))):0;
      const bundle=[];let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(let i=0;i<f.lines;i++){
        const q=f.lines===1?0:i/(f.lines-1)-.5,offset=q*f.span;
        const a=rng()*TAU,c=rng()*TAU,rate=.7+rng()*.6;
        const end=f.behavior==='Fray end'?1-(1-f.release)*f.tipVar*rng():1;
        const point=t=>{
          let u,E;if(f.behavior==='Split and return'){
            u=Math.max(0,Math.min(1,(t-f.release)/(f.rejoin-f.release)));
            E=t<=f.release||t>=f.rejoin?0:16*u*u*(1-u)*(1-u);
          }else{u=Math.max(0,Math.min(1,(t-f.release)/(1-f.release)));E=smooth(u);}
          let x=f.length*t,y=stemY(t)+offset+q*f.spread*E;
          if(f.style==='Flow'){
            y+=f.spread*E*(.14*Math.sin(TAU*f.threadCycles*u)+q*.15*Math.sin(TAU*f.threadCycles*u));
          }else if(f.style==='Wander'){
            y+=f.spread*E*f.chaos*(.24*Math.sin(TAU*f.threadCycles*rate*u+a)+.11*Math.sin(TAU*f.threadCycles*1.7*u+c));
          }else if(f.style==='Tangle'){
            x+=f.spread*E*f.chaos*.36*Math.sin(TAU*f.threadCycles*rate*u+a);
            y+=f.spread*E*f.chaos*(.43*Math.cos(TAU*f.threadCycles*rate*u+a)+.17*Math.sin(TAU*f.threadCycles*1.7*u+c));
          }
          return [x,y];
        };
        // A shared longitudinal grid plus exact release/rejoin stations retains C1 joins.
        const ts=[];for(let k=0;k<=Math.floor(end*f.steps);k++)ts.push(k/f.steps);
        ts.push(end);if(f.release<end)ts.push(f.release);if(f.behavior==='Split and return')ts.push(f.rejoin);
        ts.sort((a,b)=>a-b);const pts=[];
        for(let k=0;k<ts.length;k++){if(k&&Math.abs(ts[k]-ts[k-1])<1e-10)continue;const v=point(ts[k]);pts.push(v);}
        bundle.push({pts,closed:false,layer:f.layer,
          startAnchor:point(f.release),endAnchor:point(f.behavior==='Split and return'?f.rejoin:f.release)});
      }
      // Cut in the unrotated stem frame. Protect release/rejoin stations so a
      // steep cut never erases the loose zone or splits a strand into fragments.
      for(const [angle,start] of [[f.startCut,true],[f.endCut,false]]){
        if(angle===0)continue; // Old patches retain their exact points and tip variation.
        const requested=Math.tan(angle),anchorKey=start?'startAnchor':'endAnchor';
        const projection=(v,slope)=>v[0]-slope*v[1];
        const limits=slope=>{
          let tip=start?-Infinity:Infinity,anchor=start?Infinity:-Infinity;
          for(const path of bundle){
            const a=projection(path[anchorKey],slope),e=projection(start?path.pts[0]:path.pts.at(-1),slope);
            tip=start?Math.max(tip,e):Math.min(tip,e);
            anchor=start?Math.min(anchor,a):Math.max(anchor,a);
          }
          return {tip,room:start?anchor-tip:tip-anchor};
        };
        // Limit the effective angle only if there is insufficient end length.
        let scale=1;
        if(limits(requested).room<1e-6){let lo=0,hi=1;for(let k=0;k<40;k++){const mid=(lo+hi)/2;if(limits(requested*mid).room>=1e-6)lo=mid;else hi=mid;}scale=lo;}
        const slope=requested*scale,cut=limits(slope).tip;
        for(const path of bundle){
          const ps=path.pts,anchor=path[anchorKey];
          const at=ps.findIndex(v=>Math.hypot(v[0]-anchor[0],v[1]-anchor[1])<1e-6);
          if(at<0)continue;
          const distance=v=>(projection(v,slope)-cut)*(start?1:-1);
          // Keep the connected stroke containing the protected station. Linear
          // interpolation places its new endpoint exactly on the cutting plane.
          for(let j=at;start?j>0:j<ps.length-1;start?j--:j++){
            const k=j+(start?-1:1),a=ps[j],z=ps[k],da=distance(a),dz=distance(z);
            if(dz < -1e-9){const t=Math.max(0,Math.min(1,da/(da-dz))),v=[a[0]+(z[0]-a[0])*t,a[1]+(z[1]-a[1])*t];
              path.pts=start?(t<1e-12?ps.slice(j):[v,...ps.slice(j)]):(t<1e-12?ps.slice(0,j+1):[...ps.slice(0,j+1),v]);break;}
          }
        }
      }
      for(const path of bundle){
        path.pts=path.pts.map(([x,y])=>[x*ca-y*sa,x*sa+y*ca]);
        delete path.startAnchor;delete path.endAnchor;
        for(const v of path.pts){x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1]);}
      }
      // Leave half a physical nib around every plotted centreline. Never enlarge pitch.
      const pad=f.nib/2,fit=Math.min(1,(f.cellW-2*pad)/Math.max(1e-9,x1-x0),(f.cellH-2*pad)/Math.max(1e-9,y1-y0));
      const cx=f.m+f.cellW*(f.rows ? 0.5 : b+0.5),cy=f.m+f.cellH*(f.rows ? b+0.5 : 0.5);
      const mx=(x0+x1)/2,my=(y0+y1)/2;
      for(const path of bundle)paths.push({...path,pts:path.pts.map(([x,y])=>[cx+(x-mx)*fit,cy+(y-my)*fit])});
      maxPitch=Math.max(maxPitch,f.pitch*fit);minWidth=Math.min(minWidth,f.span*fit+f.nib);
    }
    return [applyStyle({paths},ins[0]),maxPitch,minWidth];
  },
};
