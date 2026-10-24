import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "strand_bundle",
  name: "Strand Bundle",
  cat: "gen",
  group: "organic",
  desc: "Dense pen-line bundles that fray into individual threads or open and return as a ribbon. Fan and Flow keep a tidy ordered set; Wander drifts and Tangle adds looping, crossing paths. Fray end releases the tips; Split and return brings every strand back into the same packed stem. Stem can be Straight, Sine or seeded Meander, independently of thread motion. Pen width and Ink overlap plan centreline spacing: use your actual drawn line width for a solid dark stem. Preview and SVG use Muusia's standard display stroke, not the selected physical nib. Each strand is one continuous open pen stroke. Length accepts 30–2000 mm before paper fitting. Start cut and End cut tilt independent straight trimming planes in the stem frame; zero preserves the original ends and tip variation. Positive angles move the cutting plane toward the far end as you move across the bundle. Cuts protect the release/rejoin region; extreme angles are reduced when the available end length is too short. Curved or looping offcuts are discarded so each strand stays connected. Complete bundles only shrink to fit their cells, making the physical pitch denser rather than wider. Very dense jobs first reduce curve samples, then narrow all cores equally to preserve every bundle and physical pitch; numeric outputs show maximum core pitch and minimum core width used. A wired dashed Style deliberately breaks the solid stem. Keep Seed fixed for repeatable paths. Colour selection assigns complete strands to an Accent pen, replacing their Base pen without adding duplicate paths. By number accepts 1-based numbers and inclusive ranges (1, 5, 10-12). Spaced uses First coloured strand, Coloured strands and Strand interval. Random selects a unique repeatable set using a separate Colour seed; increasing the count adds to the same set. Numbers follow the order across the unrotated core, repeat for every bundle, and ignore out-of-range indices. Selecting colours never changes path geometry. Use pens of the same drawn width to retain the planned density. Off preserves old monochrome patches. Space 2D preserves all old geometry. Space 3D builds a circular core and sends fibres into real Y/Z depth around it. Axis rotation rolls the entire object around its longitudinal X axis; View angle/elevation move the orthographic camera, while Angle rotates the page. Fan opens radially; Flow twists an ordered circular set; Wander and Tangle move independently in all three dimensions. The circular core uses more strands to retain the planned circumferential pitch. 3D strand numbers run around the core. Roll uses a fixed cylindrical framing envelope, so it does not zoom or recenter while spinning; wire Frame rot degrees to Axis rotation for animation. Cuts rotate with the object. The drawing is a transparent wire view: all strands remain visible. Outputs are projected XY pen paths, never machine Z moves. Exact end-on fibres use tiny XY end marks. In 3D, Start turn/lift and End turn/lift bend the two end sections independently: turn moves sideways and lift moves through depth. Each cross-section rotates rigidly about an interior pivot with a smooth blend to zero at the loose-zone join. Start bends the packed stem up to Release at. End bends the packed tail after Rejoin at, or the last 30% of each free tail in Fray end. Cuts are applied before end bending, so the cut follows the bent end. Zero end angles leave the 3D geometry unchanged. Whole bend optionally deforms the entire 3D bundle, including the loose middle: Arc makes one continuous circular bend; S-curve reverses the curvature at the midpoint. Bend angle controls curvature and its sign; Bend plane rotates the bending direction around object X. Cross-sections rotate with the curved centreline. Existing Start/End turn/lift remain independent and are applied before whole bending. Off or a zero Bend angle preserves the previous geometry exactly. Whole bending happens before Axis rotation and the camera, so it can be animated with the same stable roll framing.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Drawing"),Pin("value", "Core pitch mm"),Pin("value", "Core width mm")],
  params: [
    {key:"dimension",label:"Space",type:"select",options:["2D","3D"],def:"2D"},
    {key:"behavior",label:"Behavior",type:"select",options:["Fray end","Split and return"],def:"Fray end"},
    {key:"style",label:"Threads",type:"select",options:["Fan","Flow","Wander","Tangle"],def:"Wander"},
    {key:"wholeBend",label:"Whole bend",type:"select",options:["Off","Arc","S-curve"],def:"Off",showIf:p=>p.dimension==="3D"},
    {key:"wholeAngle",label:"Bend angle °",type:"slider",min:-180,max:180,step:1,def:90,showIf:p=>p.dimension==="3D"&&["Arc","S-curve"].includes(p.wholeBend)},
    {key:"wholePlane",label:"Bend plane °",type:"slider",min:0,max:360,step:1,def:0,showIf:p=>p.dimension==="3D"&&["Arc","S-curve"].includes(p.wholeBend)&&+p.wholeAngle!==0},
    {key:"axisRotation",label:"Axis rotation °",type:"slider",min:0,max:360,step:1,def:0,showIf:p=>p.dimension==="3D"},
    {key:"viewAz",label:"View angle °",type:"slider",min:-180,max:180,step:1,def:70,showIf:p=>p.dimension==="3D"},
    {key:"viewEl",label:"View elevation °",type:"slider",min:-90,max:90,step:1,def:20,showIf:p=>p.dimension==="3D"},
    {key:"startTurn",label:"Start turn °",type:"slider",min:-180,max:180,step:1,def:0,showIf:p=>p.dimension==="3D"},
    {key:"startLift",label:"Start lift °",type:"slider",min:-90,max:90,step:1,def:0,showIf:p=>p.dimension==="3D"},
    {key:"endTurn",label:"End turn °",type:"slider",min:-180,max:180,step:1,def:0,showIf:p=>p.dimension==="3D"},
    {key:"endLift",label:"End lift °",type:"slider",min:-90,max:90,step:1,def:0,showIf:p=>p.dimension==="3D"},
    {key:"layer",label:"Base pen",type:"pen",def:0},
    {key:"colourMode",label:"Colour selection",type:"select",options:["Off","By number","Spaced","Random"],def:"Off"},
    {key:"strandNumbers",label:"Strand numbers (1, 5, 10-12)",type:"text",def:"1",showIf:p=>p.colourMode==="By number"},
    {key:"colourFirst",label:"First coloured strand",type:"slider",min:1,max:1200,step:1,def:1,showIf:p=>p.colourMode==="Spaced"},
    {key:"colourCount",label:"Coloured strands",type:"slider",min:1,max:1200,step:1,def:1,showIf:p=>["Spaced","Random"].includes(p.colourMode)},
    {key:"colourStep",label:"Strand interval",type:"slider",min:1,max:1200,step:1,def:5,showIf:p=>p.colourMode==="Spaced"},
    {key:"colourSeed",label:"Colour seed",type:"seed",def:7,showIf:p=>p.colourMode==="Random"},
    {key:"accentPen",label:"Accent pen",type:"pen",def:2,showIf:p=>["By number","Spaced","Random"].includes(p.colourMode)},
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
    const is3D=p.dimension==='3D',minimum=nib+(is3D?2*Math.max(.006,nib*.01):.01);
    if(!Number.isFinite(W)||!Number.isFinite(H)||cellW<=minimum||cellH<=minimum)return null;
    const requestedPitch=nib*(1-num('overlap',40,0,80)/100),requestedSpan=Math.max(0,num('width',12,1,60)-nib);
    const detail=Math.round(num('detail',220,64,320)),minSteps=Math.min(96,detail),budget=110000;
    const maxLines=Math.max(2,Math.floor(budget/(count*(minSteps+4))));
    const desired=requestedSpan>0?(is3D?Math.max(8,Math.ceil(Math.PI*requestedSpan/requestedPitch)):Math.ceil(requestedSpan/requestedPitch)+1):1;
    const lines=Math.min(desired,maxLines),span=Math.min(requestedSpan,is3D?lines*requestedPitch/Math.PI:(lines-1)*requestedPitch);
    const pitch=lines>1?(is3D?Math.PI*span/lines:span/(lines-1)):0;
    const steps=Math.min(detail,Math.floor(budget/(count*lines))-4);
    const behavior=p.behavior==='Split and return'?'Split and return':'Fray end';
    const style=['Fan','Flow','Wander','Tangle'].includes(p.style)?p.style:'Wander';
    const stem=['Straight','Sine','Meander'].includes(p.stem)?p.stem:'Sine';
    return {W,H,m,nib,count,rows,cellW,cellH,lines,span,pitch,steps,behavior,style,stem,is3D,
      wholeBend:is3D&&['Arc','S-curve'].includes(p.wholeBend)?p.wholeBend:'Off',
      wholeAngle:is3D?num('wholeAngle',90,-180,180)*Math.PI/180:0,wholePlane:is3D?num('wholePlane',0,0,360)*Math.PI/180:0,
      axisRotation:is3D?num('axisRotation',0,0,360)*Math.PI/180:0,
      startTurn:is3D?num('startTurn',0,-180,180)*Math.PI/180:0,startLift:is3D?num('startLift',0,-90,90)*Math.PI/180:0,
      endTurn:is3D?num('endTurn',0,-180,180)*Math.PI/180:0,endLift:is3D?num('endLift',0,-90,90)*Math.PI/180:0,
      viewAz:is3D?num('viewAz',70,-180,180)*Math.PI/180:0,viewEl:is3D?num('viewEl',20,-90,90)*Math.PI/180:0,
      startCut:num('startCut',0,-75,75)*Math.PI/180,endCut:num('endCut',0,-75,75)*Math.PI/180,
      length:num('length',200,30,2000),release:num('release',48,10,80)/100,
      rejoin:Math.min(.95,Math.max(num('release',48,10,80)/100+.1,num('rejoin',85,25,95)/100)),
      spread:num('spread',90,0,180),chaos:['Wander','Tangle'].includes(style)?num('chaos',65,0,100)/100:0,
      threadCycles:style==='Fan'?0:num('threadCycles',2.2,.5,6),tipVar:behavior==='Fray end'?num('tipVar',25,0,65)/100:0,
      bend:stem==='Straight'?0:num('bend',12,0,80),stemCycles:stem==='Straight'?0:num('stemCycles',1.1,.25,3),
      angle:num('angle',-90,-180,180)*Math.PI/180,seed:num('seed',17,-2147483648,2147483647)|0,
      layer:Math.round(num('layer',0,0,11))};
  },
  _colourSelection(p,lines) {
    const num=(key,def,min,max)=>Number.isFinite(+p[key])?Math.round(Math.max(min,Math.min(max,+p[key]))):def;
    const selected=new Set();
    if(p.colourMode==='By number'){
      // Bound both parsing and range expansion; indices outside this bundle are ignored.
      const text=String(p.strandNumbers??'1').slice(0,1024).replace(/(\d)\s*[-–—]\s*(?=\d)/g,'$1-');
      for(const token of text.split(/[,;\s]+/).slice(0,128)){
        const m=token.match(/^(\d+)(?:-(\d+))?$/);if(!m)continue;
        const a=Number(m[1]),b=Number(m[2]??m[1]);if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<1||b<1)continue;
        for(let n=Math.max(1,Math.min(a,b));n<=Math.min(lines,Math.max(a,b));n++)selected.add(n-1);
      }
    }else if(p.colourMode==='Spaced'){
      const first=num('colourFirst',1,1,1200)-1,step=num('colourStep',5,1,1200),count=num('colourCount',1,1,1200);
      for(let k=0;k<count&&first+k*step<lines;k++)selected.add(first+k*step);
    }else if(p.colourMode==='Random'){
      // A separate stream leaves every geometry random draw unchanged. Increasing
      // count extends the same shuffled prefix; all bundles use the same indices.
      const rng=mulberry32((num('colourSeed',7,-2147483648,2147483647)^0x51ed270b)|0),order=Array.from({length:lines},(_,i)=>i);
      const count=Math.min(lines,num('colourCount',1,1,1200));
      for(let k=0;k<count;k++){const j=k+Math.floor(rng()*(lines-k));[order[k],order[j]]=[order[j],order[k]];selected.add(order[k]);}
    }
    return {selected,pen:num('accentPen',2,0,11)};
  },
  _cutEnds(bundle,startCut,endCut) {
      // Cut in the unrotated stem frame. Protect release/rejoin stations so a
      // steep cut never erases the loose zone or splits a strand into fragments.
      for(const [angle,start] of [[startCut,true],[endCut,false]]){
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
          const at=ps.findIndex(v=>Math.hypot(...v.map((x,k)=>x-anchor[k]))<1e-6);
          if(at<0)continue;
          const distance=v=>(projection(v,slope)-cut)*(start?1:-1);
          // Keep the connected stroke containing the protected station. Linear
          // interpolation places its new endpoint exactly on the cutting plane.
          for(let j=at;start?j>0:j<ps.length-1;start?j--:j++){
            const k=j+(start?-1:1),a=ps[j],z=ps[k],da=distance(a),dz=distance(z);
            if(dz < -1e-9){const t=Math.max(0,Math.min(1,da/(da-dz))),v=a.map((x,k)=>x+(z[k]-x)*t);
              path.pts=start?(t<1e-12?ps.slice(j):[v,...ps.slice(j)]):(t<1e-12?ps.slice(0,j+1):[...ps.slice(0,j+1),v]);
              if(path.ts){const ts=path.ts,at=ts[j]+(ts[k]-ts[j])*t;path.ts=start?(t<1e-12?ts.slice(j):[at,...ts.slice(j)]):(t<1e-12?ts.slice(0,j+1):[...ts.slice(0,j+1),at]);}break;}
          }
        }
      }
  },
  _bundle3D(f,b) {
    const TAU=2*Math.PI,rng=mulberry32((f.seed+Math.imul(b+1,104729))|0),ph1=rng()*TAU,ph2=rng()*TAU;
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
    const centre=t=>{
      const w=TAU*f.stemCycles*t;
      if(f.stem==='Straight')return [0,0];
      if(f.stem==='Sine')return [f.bend*Math.sin(w),f.bend*(1-Math.cos(w))];
      return [f.bend*(.65*(Math.sin(w+ph1)-Math.sin(ph1))+.35*(Math.sin(w*1.7+ph2)-Math.sin(ph2))),
        f.bend*(.65*(Math.sin(w+ph2)-Math.sin(ph2))+.35*(Math.sin(w*1.7+ph1)-Math.sin(ph1)))];
    };
    const bundle=[];
    for(let i=0;i<f.lines;i++){
      const theta=TAU*i/f.lines,a=rng()*TAU,c=rng()*TAU,rate=.7+rng()*.6;
      const end=f.behavior==='Fray end'?1-(1-f.release)*f.tipVar*rng():1;
      const point=t=>{
        const u=Math.max(0,Math.min(1,(t-f.release)/(f.behavior==='Split and return'?f.rejoin-f.release:1-f.release)));
        const E=f.behavior==='Split and return'?(t<=f.release||t>=f.rejoin?0:16*u*u*(1-u)*(1-u)):smooth(u);
        const angle=theta+(f.style==='Flow'?TAU*f.threadCycles*(f.behavior==='Split and return'?E:smooth(u)):0);
        const radius=f.span/2+f.spread/2*E,[cy,cz]=centre(t);
        let x=f.length*t,y=cy+radius*Math.cos(angle),z=cz+radius*Math.sin(angle);
        if(f.style==='Wander'){
          y+=f.spread*E*f.chaos*(.24*Math.sin(TAU*f.threadCycles*rate*u+a)+.11*Math.sin(TAU*f.threadCycles*1.7*u+c));
          z+=f.spread*E*f.chaos*(.24*Math.cos(TAU*f.threadCycles*rate*u+c)+.11*Math.sin(TAU*f.threadCycles*1.7*u+a));
        }else if(f.style==='Tangle'){
          x+=f.spread*E*f.chaos*.36*Math.sin(TAU*f.threadCycles*rate*u+a);
          y+=f.spread*E*f.chaos*(.43*Math.cos(TAU*f.threadCycles*rate*u+a)+.17*Math.sin(TAU*f.threadCycles*1.7*u+c));
          z+=f.spread*E*f.chaos*(.43*Math.sin(TAU*f.threadCycles*rate*u+c)+.17*Math.cos(TAU*f.threadCycles*1.7*u+a));
        }
        return [x,y,z];
      };
      const ts=[];for(let k=0;k<=Math.floor(end*f.steps);k++)ts.push(k/f.steps);
      ts.push(end);if(f.release<end)ts.push(f.release);if(f.behavior==='Split and return')ts.push(f.rejoin);
      ts.sort((a,b)=>a-b);const times=ts.filter((t,k)=>!k||Math.abs(t-ts[k-1])>=1e-10),pts=times.map(point);
      const endZone=f.behavior==='Split and return'?f.rejoin:end-(end-f.release)*.3;
      bundle.push({pts,ts:times,endT:end,endZone,startPivot:[f.length*f.release,...centre(f.release)],endPivot:[f.length*endZone,...centre(endZone)],
        closed:false,layer:f.layer,startAnchor:point(f.release),endAnchor:point(f.behavior==='Split and return'?f.rejoin:f.release)});
    }
    return bundle;
  },
  _steer3D(bundle,f) {
    if(!f.startTurn&&!f.startLift&&!f.endTurn&&!f.endLift)return bundle;
    const smooth=t=>t*t*t*(t*(t*6-15)+10);
    return bundle.map(path=>({...path,pts:path.pts.map((v,k)=>{
      const t=path.ts[k],start=t<f.release,end=t>path.endZone;
      if(!start&&!end)return v;
      const turn=start?f.startTurn:f.endTurn,lift=start?f.startLift:f.endLift;if(!turn&&!lift)return v;
      const w=smooth(start?(f.release-t)/f.release:(t-path.endZone)/(path.endT-path.endZone)),pivot=start?path.startPivot:path.endPivot;
      const [x,y,z]=v.map((x,k)=>x-pivot[k]),cy=Math.cos(turn*w),sy=Math.sin(turn*w),cp=Math.cos(lift*w),sp=Math.sin(lift*w);
      const a=x*cp-z*sp,b=z*cp+x*sp;
      return [pivot[0]+a*cy-y*sy,pivot[1]+a*sy+y*cy,pivot[2]+b];
    })}));
  },
  _bendWhole3D(bundle,f) {
    if(f.wholeBend==='Off'||!f.wholeAngle)return bundle;
    const k=f.wholeAngle/f.length,half=f.length/2,cp=Math.cos(f.wholePlane),sp=Math.sin(f.wholePlane);
    // Stable circular mapping even near zero curvature: avoid subtracting two
    // huge radii. Every station rotates its full cross-section rigidly.
    const sinc=a=>Math.abs(a)<1e-4?1-a*a/6+a*a*a*a/120:Math.sin(a)/a;
    const sag=s=>k*s*s/2*sinc(k*s/2)**2;
    const arc=f.wholeBend==='Arc',offset=arc?sag(half)/2:0;
    return bundle.map(path=>({...path,pts:path.pts.map(([x,y,z])=>{
      const s=x-half,a=k*s,alpha=arc?a:k*Math.abs(s),n=y*cp+z*sp,b=-y*sp+z*cp;
      const X=half+s*sinc(a)-n*Math.sin(alpha);
      const N=(arc?sag(s)-offset:Math.sign(s)*sag(s))+n*Math.cos(alpha);
      return [X,N*cp-b*sp,N*sp+b*cp];
    })}));
  },
  _project3D(bundle,f,b) {
    const ca=Math.cos(f.angle),sa=Math.sin(f.angle),az=f.viewAz,el=f.viewEl;
    const right=[Math.sin(az),-Math.cos(az),0],down=[Math.sin(el)*Math.cos(az),Math.sin(el)*Math.sin(az),-Math.cos(el)];
    const ax=right.map((x,k)=>ca*x-sa*down[k]),ay=right.map((x,k)=>sa*x+ca*down[k]);
    const envelope=this._bendWhole3D(this._steer3D(bundle.map(path=>({...path})),f),f);
    this._cutEnds(bundle,f.startCut,f.endCut);bundle=this._bendWhole3D(this._steer3D(bundle,f),f);
    let x0=Infinity,x1=-Infinity,radius=0;
    for(const path of [...envelope,...bundle])for(const [x,y,z] of path.pts){x0=Math.min(x0,x);x1=Math.max(x1,x);radius=Math.max(radius,Math.hypot(y,z));}
    // An untrimmed cylinder bounds every roll angle. It keeps both scale and
    // centre fixed when Axis rotation is animated, without fitting a huge sphere.
    const mid=(x0+x1)/2,half=(x1-x0)/2;
    const extent=axis=>Math.abs(axis[0])*half+Math.hypot(axis[1],axis[2])*radius;
    const dotHalf=Math.max(.006,f.nib*.01),pad=f.nib/2+dotHalf;
    const fit=Math.min(1,(f.cellW-2*pad)/Math.max(1e-9,2*extent(ax)),(f.cellH-2*pad)/Math.max(1e-9,2*extent(ay)));
    const cx=f.m+f.cellW*(f.rows ? 0.5 : b+0.5),cy=f.m+f.cellH*(f.rows ? b+0.5 : 0.5),cr=Math.cos(f.axisRotation),sr=Math.sin(f.axisRotation);
    const paths=bundle.map(path=>{
      let pts=path.pts.map(([x,y,z])=>{const v=[x-mid,y*cr-z*sr,y*sr+z*cr];return [cx+v.reduce((s,x,k)=>s+x*ax[k],0)*fit,cy+v.reduce((s,x,k)=>s+x*ay[k],0)*fit];});
      // A fibre seen exactly end-on is a tiny ordinary XY end mark, never a Z tap.
      if(pts.every(v=>Math.hypot(v[0]-pts[0][0],v[1]-pts[0][1])<1e-8))pts=[[pts[0][0]-dotHalf,pts[0][1]],[pts[0][0]+dotHalf,pts[0][1]]];
      return {pts,closed:false,layer:path.layer};
    });
    return {paths,fit};
  },
  _compute3D(ins,p,f) {
    const colour=this._colourSelection(p,f.lines),paths=[];let maxPitch=0,minWidth=Infinity;
    for(let b=0;b<f.count;b++){
      const bundle=this._bundle3D(f,b);bundle.forEach((path,i)=>{path.layer=colour.selected.has(i)?colour.pen:f.layer;});
      const out=this._project3D(bundle,f,b);paths.push(...out.paths);
      maxPitch=Math.max(maxPitch,f.pitch*out.fit);minWidth=Math.min(minWidth,f.span*out.fit+f.nib);
    }
    return [applyStyle({paths},ins[0]),maxPitch,minWidth];
  },
  compute(ins,p,ctx) {
    const f=this._frame(p,ctx);if(!f)return [EMPTY,0,0];
    if(f.is3D)return this._compute3D(ins,p,f);
    const colour=this._colourSelection(p,f.lines);
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
        bundle.push({pts,closed:false,layer:colour.selected.has(i)?colour.pen:f.layer,
          startAnchor:point(f.release),endAnchor:point(f.behavior==='Split and return'?f.rejoin:f.release)});
      }
      this._cutEnds(bundle,f.startCut,f.endCut);
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
