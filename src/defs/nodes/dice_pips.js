import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "dice_pips",
  name: "Dice Pips",
  cat: "gen",
  group: "geometric",
  desc: "Draws classic dice-pip numbers. Single makes one face; Sequence accepts values such as 1-6, 0 2 4 6 8, or 987 and lays them out as a centered grid that shrinks to fit the sheet. Values 1-6 use standard die faces; 0 and 7-9 use conventional domino-style extensions on the same 3×3 grid. Choose pips only or add a square, rounded-square, or circular frame. Rings and Spiral fill modes make solid-looking plotter dots; set Fill pitch to suit the pen.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Single", "Sequence"], def: "Sequence" },
    { key: "value", label: "Value", type: "slider", min: 0, max: 9, step: 1, def: 5, showIf: (p) => p.mode === "Single" },
    { key: "values", label: "Values", type: "text", def: "1-6", showIf: (p) => p.mode === "Sequence" },
    { key: "columns", label: "Columns", type: "slider", min: 1, max: 9, step: 1, def: 3, showIf: (p) => p.mode === "Sequence" },
    { key: "size", label: "Face size mm", type: "slider", min: 5, max: 180, step: 1, def: 38 },
    { key: "gap", label: "Grid gap mm", type: "slider", min: 0, max: 50, step: 1, def: 8, showIf: (p) => p.mode === "Sequence" },
    { key: "centerX", label: "Center X %", type: "slider", min: 0, max: 100, step: 1, def: 50, showIf: (p) => p.mode === "Single" },
    { key: "centerY", label: "Center Y %", type: "slider", min: 0, max: 100, step: 1, def: 50, showIf: (p) => p.mode === "Single" },
    { key: "frame", label: "Frame", type: "select", options: ["None", "Square", "Rounded square", "Circle"], def: "Rounded square" },
    { key: "roundness", label: "Corner radius %", type: "slider", min: 0, max: 45, step: 1, def: 18, showIf: (p) => p.frame === "Rounded square" },
    { key: "pipSize", label: "Pip diameter %", type: "slider", min: 4, max: 28, step: 1, def: 16 },
    { key: "fill", label: "Pip fill", type: "select", options: ["Outline", "Rings", "Spiral"], def: "Rings" },
    { key: "fillPitch", label: "Fill pitch mm", type: "slider", min: 0.15, max: 2, step: 0.05, def: 0.45, showIf: (p) => p.fill !== "Outline" },
    { key: "pen", label: "Pip pen", type: "pen", def: 0 },
    { key: "framePen", label: "Frame pen", type: "pen", def: 0, showIf: (p) => p.frame !== "None" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
  ],
  compute(ins, p, ctx) {
    const W=Math.max(1,Number(ctx.W)||210),H=Math.max(1,Number(ctx.H)||297);
    const pipPen=Math.max(0,Math.min(11,Math.round(Number(p.pen)||0)));
    const framePen=Math.max(0,Math.min(11,Math.round(Number(p.framePen)||0)));
    const margin=Math.max(0,Number(p.margin)||0),paths=[];
    const push=(pts,closed,layer)=>{if(pts&&pts.length>1&&pts.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])))paths.push({pts,closed:!!closed,layer});};
    const circle=(cx,cy,r,layer)=>{if(!(r>0))return;const n=Math.max(18,Math.min(120,Math.ceil(Math.PI*2*r/.7))),pts=[];for(let i=0;i<n;i++){const a=Math.PI*2*i/n;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}push(pts,true,layer);};
    const roundedRect=(cx,cy,s,r,layer)=>{const half=s/2,rr=Math.max(0,Math.min(half,r));if(rr<.01){push([[cx-half,cy-half],[cx+half,cy-half],[cx+half,cy+half],[cx-half,cy+half]],true,layer);return;}const pts=[],corners=[[cx+half-rr,cy-half+rr,-Math.PI/2,0],[cx+half-rr,cy+half-rr,0,Math.PI/2],[cx-half+rr,cy+half-rr,Math.PI/2,Math.PI],[cx-half+rr,cy-half+rr,Math.PI,Math.PI*1.5]];for(const [x,y,a0,a1] of corners)for(let i=0;i<=8;i++){const a=a0+(a1-a0)*i/8;pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}push(pts,true,layer);};
    const pip=(cx,cy,r)=>{
      const fill=String(p.fill||"Rings"),pitch=Math.max(.12,Number(p.fillPitch)||.45);
      if(fill==="Outline"){circle(cx,cy,r,pipPen);return;}
      if(fill==="Rings"){
        for(let rr=r;rr>pitch*.35;rr-=pitch)circle(cx,cy,rr,pipPen);
        const q=Math.min(r,pitch*.38);push([[cx-q,cy],[cx+q,cy]],false,pipPen);return;
      }
      const pts=[],turns=Math.max(1.25,r/Math.max(.12,pitch)),steps=Math.max(28,Math.min(400,Math.ceil(turns*28)));
      for(let i=0;i<=steps;i++){const t=i/steps,a=Math.PI*2*turns*t,rr=r*(1-t);pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}
      push(pts,false,pipPen);
    };
    const PATTERNS={
      0:[],1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],
      6:[0,2,3,5,6,8],7:[0,2,3,4,5,6,8],8:[0,1,2,3,5,6,7,8],9:[0,1,2,3,4,5,6,7,8]
    };
    const drawFace=(value,cx,cy,s)=>{
      const frame=String(p.frame||"Rounded square");
      if(frame==="Square")roundedRect(cx,cy,s,0,framePen);
      else if(frame==="Rounded square")roundedRect(cx,cy,s,s*Math.max(0,Math.min(45,Number(p.roundness)||0))/100,framePen);
      else if(frame==="Circle")circle(cx,cy,s/2,framePen);
      const positions=[[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]],off=s*.27,r=s*Math.max(4,Math.min(28,Number(p.pipSize)||16))/200;
      for(const index of PATTERNS[value]||[]){const q=positions[index];pip(cx+q[0]*off,cy+q[1]*off,r);}
    };
    const parseValues=(raw)=>{
      const src=String(raw||""),out=[],re=/([0-9])\s*-\s*([0-9])|([0-9])/g;let m;
      while((m=re.exec(src))&&out.length<81){if(m[3]!==undefined)out.push(Number(m[3]));else{const a=Number(m[1]),b=Number(m[2]),step=a<=b?1:-1;for(let v=a;;v+=step){out.push(v);if(v===b||out.length>=81)break;}}}
      return out.length?out:[1,2,3,4,5,6];
    };
    if(p.mode==="Single"){
      const maxS=Math.max(1,Math.min(W-2*margin,H-2*margin)),s=Math.max(1,Math.min(Number(p.size)||38,maxS));
      const half=s/2,xMin=margin+half,xMax=W-margin-half,yMin=margin+half,yMax=H-margin-half;
      const rawX=W*Math.max(0,Math.min(100,Number(p.centerX)||0))/100,rawY=H*Math.max(0,Math.min(100,Number(p.centerY)||0))/100;
      const cx=xMax>=xMin?Math.max(xMin,Math.min(xMax,rawX)):W/2,cy=yMax>=yMin?Math.max(yMin,Math.min(yMax,rawY)):H/2;
      drawFace(Math.max(0,Math.min(9,Math.round(Number(p.value)||0))),cx,cy,s);
    }else{
      const values=parseValues(p.values),cols=Math.max(1,Math.min(values.length,Math.round(Number(p.columns)||1))),rows=Math.ceil(values.length/cols);
      const requestedS=Math.max(1,Number(p.size)||38),requestedGap=Math.max(0,Number(p.gap)||0),gridW=cols*requestedS+(cols-1)*requestedGap,gridH=rows*requestedS+(rows-1)*requestedGap;
      const availW=Math.max(1,W-2*margin),availH=Math.max(1,H-2*margin),fit=Math.max(.001,Math.min(1,availW/gridW,availH/gridH)),s=requestedS*fit,gap=requestedGap*fit;
      const actualW=cols*s+(cols-1)*gap,actualH=rows*s+(rows-1)*gap,x0=(W-actualW)/2+s/2,y0=(H-actualH)/2+s/2;
      values.forEach((value,i)=>drawFace(value,x0+(i%cols)*(s+gap),y0+Math.floor(i/cols)*(s+gap),s));
    }
    return applyStyle({paths},ins[0]);
  },
  overlay(p,ctx){
    try{
      const W=Math.max(1,Number(ctx.W)||210),H=Math.max(1,Number(ctx.H)||297),margin=Math.max(0,Number(p.margin)||0);
      if(p.mode==="Single"){
        const s=Math.max(1,Math.min(Number(p.size)||38,W-2*margin,H-2*margin)),half=s/2,xMin=margin+half,xMax=W-margin-half,yMin=margin+half,yMax=H-margin-half;
        const rawX=W*Math.max(0,Math.min(100,Number(p.centerX)||0))/100,rawY=H*Math.max(0,Math.min(100,Number(p.centerY)||0))/100,cx=xMax>=xMin?Math.max(xMin,Math.min(xMax,rawX)):W/2,cy=yMax>=yMin?Math.max(yMin,Math.min(yMax,rawY)):H/2;
        return[{kind:"rect",x:cx-half,y:cy-half,w:s,h:s}];
      }
      const values=[],re=/([0-9])\s*-\s*([0-9])|([0-9])/g,src=String(p.values||"" );let match;
      while((match=re.exec(src))&&values.length<81){if(match[3]!==undefined)values.push(Number(match[3]));else{const a=Number(match[1]),b=Number(match[2]),step=a<=b?1:-1;for(let v=a;;v+=step){values.push(v);if(v===b||values.length>=81)break;}}}
      const count=values.length||6,cols=Math.max(1,Math.min(count,Math.round(Number(p.columns)||1))),rows=Math.ceil(count/cols),requestedS=Math.max(1,Number(p.size)||38),requestedGap=Math.max(0,Number(p.gap)||0);
      const gridW=cols*requestedS+(cols-1)*requestedGap,gridH=rows*requestedS+(rows-1)*requestedGap,availW=Math.max(1,W-2*margin),availH=Math.max(1,H-2*margin),fit=Math.max(.001,Math.min(1,availW/gridW,availH/gridH));
      const actualW=gridW*fit,actualH=gridH*fit;
      return[{kind:"rect",x:(W-actualW)/2,y:(H-actualH)/2,w:actualW,h:actualH}];
    }catch(e){return[];}
  },
};
