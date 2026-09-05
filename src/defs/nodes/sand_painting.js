import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "sand_painting",
  name: "Sand Painting",
  cat: "gen",
  group: "organic",
  desc: "Japanese dry-garden inspired raked sand. Open rake draws calm parallel furrows; Flow around stones bends them around seeded rocks; Island rings makes nested contours around each rock; Spiral rake draws one continuous basin; Mixed garden combines flowing furrows with cleared ring islands. Rake spacing controls the physical distance between grooves, Detail controls curve sampling, and the node automatically coarsens extreme settings to stay inside the plotter point budget. Sand and stones can use separate pens.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "pattern", label: "Pattern", type: "select", options: ["Open rake", "Flow around stones", "Island rings", "Spiral rake", "Mixed garden"], def: "Mixed garden" },
    { key: "spacing", label: "Rake spacing mm", type: "slider", min: 0.5, max: 10, step: 0.1, def: 2.2 },
    { key: "direction", label: "Direction°", type: "slider", min: 0, max: 180, step: 1, def: 0, showIf: (p) => p.pattern !== "Island rings" && p.pattern !== "Spiral rake" },
    { key: "wave", label: "Wave mm", type: "slider", min: 0, max: 15, step: 0.1, def: 1.4, showIf: (p) => p.pattern === "Open rake" || p.pattern === "Flow around stones" || p.pattern === "Mixed garden" },
    { key: "wavelength", label: "Wavelength mm", type: "slider", min: 8, max: 160, step: 1, def: 48, showIf: (p) => p.pattern === "Open rake" || p.pattern === "Flow around stones" || p.pattern === "Mixed garden" },
    { key: "flow", label: "Stone flow", type: "slider", min: 0, max: 2, step: 0.05, def: 0.9, showIf: (p) => p.pattern === "Flow around stones" || p.pattern === "Mixed garden" },
    { key: "jitter", label: "Hand rake mm", type: "slider", min: 0, max: 3, step: 0.05, def: 0.25 },
    { key: "detail", label: "Detail mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 },
    { key: "stoneCount", label: "Stones", type: "slider", min: 0, max: 12, step: 1, def: 5 },
    { key: "stoneSize", label: "Stone size mm", type: "slider", min: 3, max: 45, step: 1, def: 15 },
    { key: "stoneVariation", label: "Stone size variation %", type: "slider", min: 0, max: 100, step: 1, def: 45 },
    { key: "stoneIrregular", label: "Stone irregularity %", type: "slider", min: 0, max: 100, step: 1, def: 35 },
    { key: "stoneContours", label: "Stone contour lines", type: "slider", min: 0, max: 6, step: 1, def: 2 },
    { key: "rings", label: "Island rings", type: "slider", min: 1, max: 14, step: 1, def: 5, showIf: (p) => p.pattern === "Island rings" || p.pattern === "Mixed garden" },
    { key: "ringGap", label: "Ring gap mm", type: "slider", min: 0.5, max: 8, step: 0.1, def: 2.2, showIf: (p) => p.pattern === "Island rings" || p.pattern === "Mixed garden" },
    { key: "spiralCenterX", label: "Spiral center X %", type: "slider", min: 0, max: 100, step: 1, def: 50, showIf: (p) => p.pattern === "Spiral rake" },
    { key: "spiralCenterY", label: "Spiral center Y %", type: "slider", min: 0, max: 100, step: 1, def: 50, showIf: (p) => p.pattern === "Spiral rake" },
    { key: "seed", label: "Seed", type: "seed", def: 108 },
    { key: "sandPen", label: "Sand pen", type: "pen", def: 0 },
    { key: "stonePen", label: "Stone pen", type: "pen", def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
  ],
  compute(ins, p, ctx) {
    const W=Math.max(1,Number(ctx.W)||210),H=Math.max(1,Number(ctx.H)||297),paths=[];
    const sandPen=Math.max(0,Math.min(11,Math.round(Number(p.sandPen)||0))),stonePen=Math.max(0,Math.min(11,Math.round(Number(p.stonePen)||0)));
    const margin=Math.max(0,Math.min(Math.min(W,H)/2-.1,Number(p.margin)||0)),seed=Math.round(Number(p.seed)||0),rng=mulberry32(seed);
    const pattern=String(p.pattern||"Mixed garden"),spacing=Math.max(.2,Number(p.spacing)||2.2),detail=Math.max(.2,Number(p.detail)||1);
    const push=(pts,closed,layer)=>{if(pts&&pts.length>1&&pts.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])))paths.push({pts,closed:!!closed,layer});};
    const insidePage=(x,y)=>x>=margin&&x<=W-margin&&y>=margin&&y<=H-margin;
    const emitPage=(pts,closed,layer)=>{
      if(closed&&pts.length>2&&pts.every(q=>insidePage(q[0],q[1]))){push(pts,true,layer);return;}
      let seg=[];for(const q of pts){if(insidePage(q[0],q[1]))seg.push(q);else{if(seg.length>1)push(seg,false,layer);seg=[];}}if(seg.length>1)push(seg,false,layer);
    };
    const count=Math.max(0,Math.min(12,Math.round(Number(p.stoneCount)||0))),baseSize=Math.max(2,Number(p.stoneSize)||15),variation=Math.max(0,Math.min(100,Number(p.stoneVariation)||0))/100,irregular=Math.max(0,Math.min(100,Number(p.stoneIrregular)||0))/100;
    const stones=[],maxRx=Math.max(1,(W-2*margin)*.23),maxRy=Math.max(1,(H-2*margin)*.18);
    for(let attempt=0;attempt<700&&stones.length<count;attempt++){
      let rx=baseSize*(.72+rng()*.48)*(1+(rng()-.5)*variation),ry=rx*(.52+rng()*.32);rx=Math.max(1,Math.min(rx,maxRx));ry=Math.max(1,Math.min(ry,maxRy));
      const xmin=margin+rx,xmax=W-margin-rx,ymin=margin+ry,ymax=H-margin-ry;
      const x=xmax>xmin?xmin+rng()*(xmax-xmin):W/2,y=ymax>ymin?ymin+rng()*(ymax-ymin):H/2;
      let ok=true;for(const q of stones){const dx=x-q.x,dy=y-q.y,minD=rx+q.rx+spacing*1.5;if(dx*dx+dy*dy<minD*minD){ok=false;break;}}
      if(ok)stones.push({x,y,rx,ry,rot:(rng()-.5)*1.1,phase:rng()*Math.PI*2,phase2:rng()*Math.PI*2});
    }
    const stonePoint=(s,expand,a,shrink)=>{
      const k=shrink===undefined?1:shrink,rough=1+irregular*k*(.075*Math.sin(a*3+s.phase)+.045*Math.sin(a*5+s.phase2)+.025*Math.sin(a*7-s.phase));
      const ex=Math.max(.2,s.rx*k+expand),ey=Math.max(.2,s.ry*k+expand),lx=Math.cos(a)*ex*rough,ly=Math.sin(a)*ey*rough,c=Math.cos(s.rot),sn=Math.sin(s.rot);
      return[s.x+lx*c-ly*sn,s.y+lx*sn+ly*c];
    };
    const insideStone=(x,y,s,expand)=>{const dx=x-s.x,dy=y-s.y,c=Math.cos(s.rot),sn=Math.sin(s.rot),lx=dx*c+dy*sn,ly=-dx*sn+dy*c,rx=Math.max(.2,s.rx+expand),ry=Math.max(.2,s.ry+expand);return lx*lx/(rx*rx)+ly*ly/(ry*ry)<1;};
    const drawStone=(s)=>{
      const contours=Math.max(0,Math.min(6,Math.round(Number(p.stoneContours)||0))),n=Math.max(32,Math.min(130,Math.ceil(Math.PI*2*Math.max(s.rx,s.ry)/detail)));
      for(let k=0;k<contours;k++){const shrink=Math.max(.38,1-k*.13),pts=[];for(let i=0;i<n;i++)pts.push(stonePoint(s,0,Math.PI*2*i/n,shrink));emitPage(pts,true,stonePen);}
    };
    const ringCount=Math.max(1,Math.min(14,Math.round(Number(p.rings)||5))),ringGap=Math.max(.3,Number(p.ringGap)||2.2);
    const drawRings=(s)=>{
      for(let k=1;k<=ringCount;k++){const n=Math.max(42,Math.min(180,Math.ceil(Math.PI*2*(Math.max(s.rx,s.ry)+k*ringGap)/detail))),pts=[];for(let i=0;i<n;i++)pts.push(stonePoint(s,k*ringGap,Math.PI*2*i/n,1));emitPage(pts,true,sandPen);}
    };
    const dir=Math.max(0,Math.min(180,Number(p.direction)||0))*Math.PI/180,ca=Math.cos(dir),sa=Math.sin(dir),extent=Math.hypot(W,H)/2+spacing*3;
    const toPage=(u,v)=>[W/2+u*ca-v*sa,H/2+u*sa+v*ca],toLocal=(x,y)=>{const dx=x-W/2,dy=y-H/2;return[dx*ca+dy*sa,-dx*sa+dy*ca];};
    const localStones=stones.map(s=>{const q=toLocal(s.x,s.y);return{...s,u:q[0],v:q[1]};});
    const drawField=()=>{
      const lines=Math.max(1,Math.ceil(extent*2/spacing)),rawPer=Math.max(2,Math.ceil(extent*2/detail)),estimate=lines*rawPer,adaptive=estimate>82000?estimate/82000:1,step=detail*adaptive;
      const wave=Math.max(0,Number(p.wave)||0),wavelength=Math.max(1,Number(p.wavelength)||48),flow=Math.max(0,Math.min(2,Number(p.flow)||0)),jitter=Math.max(0,Number(p.jitter)||0);
      const deflect=pattern==="Flow around stones"||pattern==="Mixed garden",halo=pattern==="Mixed garden"?ringCount*ringGap+spacing*.45:0;
      for(let li=0;li<lines;li++){
        const v0=-extent+li*spacing,phase=(li%5)*.37;let pts=[];
        for(let u=-extent;u<=extent+1e-6;u+=step){
          let v=v0+wave*Math.sin((u/wavelength)*Math.PI*2+phase);
          v+=(noise2((u+2000)*.018,(v0+2000)*.018,seed)-.5)*jitter*2;
          if(deflect)for(const s of localStones){const du=(u-s.u)/(s.rx*1.8+spacing),dv=(v0-s.v)/(s.ry*1.9+spacing),fall=Math.exp(-(du*du*1.15+dv*dv*1.5));v+=(v0>=s.v?1:-1)*flow*s.ry*.92*fall;}
          const q=toPage(u,v);let blocked=!insidePage(q[0],q[1]);if(!blocked)for(const s of stones)if(insideStone(q[0],q[1],s,halo)){blocked=true;break;}
          if(blocked){if(pts.length>1)push(pts,false,sandPen);pts=[];}else pts.push(q);
        }
        if(pts.length>1)push(pts,false,sandPen);
      }
    };
    const drawSpiral=()=>{
      const cx=W*Math.max(0,Math.min(100,Number(p.spiralCenterX)||0))/100,cy=H*Math.max(0,Math.min(100,Number(p.spiralCenterY)||0))/100;
      const corners=[[margin,margin],[W-margin,margin],[W-margin,H-margin],[margin,H-margin]],rMax=Math.max(...corners.map(q=>Math.hypot(q[0]-cx,q[1]-cy)))+spacing;
      const turns=Math.max(1,rMax/spacing),approxLength=Math.PI*rMax*rMax/spacing,N=Math.max(80,Math.min(82000,Math.ceil(approxLength/detail))),jitter=Math.max(0,Number(p.jitter)||0);let seg=[];
      for(let i=0;i<=N;i++){const t=i/N,a=Math.PI*2*turns*t,r=rMax*t+(noise2(Math.cos(a)*.8+10,Math.sin(a)*.8+10,seed)-.5)*jitter,q=[cx+Math.cos(a)*r,cy+Math.sin(a)*r];let blocked=!insidePage(q[0],q[1]);if(!blocked)for(const s of stones)if(insideStone(q[0],q[1],s,0)){blocked=true;break;}if(blocked){if(seg.length>1)push(seg,false,sandPen);seg=[];}else seg.push(q);}
      if(seg.length>1)push(seg,false,sandPen);
    };
    if(pattern==="Open rake"||pattern==="Flow around stones"||pattern==="Mixed garden")drawField();
    if(pattern==="Spiral rake")drawSpiral();
    if(pattern==="Island rings"||pattern==="Mixed garden")for(const s of stones)drawRings(s);
    for(const s of stones)drawStone(s);
    return applyStyle({paths},ins[0]);
  },
  overlay(p,ctx){
    try{const W=Math.max(1,Number(ctx.W)||210),H=Math.max(1,Number(ctx.H)||297),m=Math.max(0,Math.min(Math.min(W,H)/2-.1,Number(p.margin)||0)),out=[{kind:"rect",x:m,y:m,w:Math.max(0,W-2*m),h:Math.max(0,H-2*m)}];if(p.pattern==="Spiral rake")out.push({kind:"point",x:W*Math.max(0,Math.min(100,Number(p.spiralCenterX)||0))/100,y:H*Math.max(0,Math.min(100,Number(p.spiralCenterY)||0))/100});return out;}catch(e){return[];}
  },
};
