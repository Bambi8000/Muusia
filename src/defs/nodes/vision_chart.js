import { Pin, mulberry32, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "vision_chart",
  name: "Vision Chart",
  cat: "gen",
  group: "scientific",
  desc: "Plotter-native vision chart studio: geometrically scaled Landolt C and equal-arm Tumbling E logMAR charts, Chinese 5-mark and Golovin-Sivtsev inspired layouts, and a seeded two-pen pseudoisochromatic artwork whose hidden number is packed with its own finer dots so it reads as a figure rather than a smudge. Distance, logMAR and Scale set physical optotype size and every row is geometrically scaled by the logMAR step; the default 2.5 m suits an A4 sheet, and 5 m fills it with the largest rows only. Ink pitch should match the pen. Artistic/educational output only — not a certified medical test.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "chart", label: "Chart", type: "select", options: ["Landolt C — ISO/logMAR", "Tumbling E — logMAR", "China GB/T E — 5-mark", "Golovin–Sivtsev", "Pseudoisochromatic art"], def: "Landolt C — ISO/logMAR" },
    { key: "rows", label: "Rows", type: "slider", min: 2, max: 14, step: 1, def: 11, showIf: (p) => p.chart !== "Pseudoisochromatic art" },
    { key: "distance", label: "Distance m", type: "slider", min: 0.3, max: 8, step: 0.1, def: 2.5, showIf: (p) => p.chart !== "Pseudoisochromatic art" },
    { key: "topLogmar", label: "Top logMAR", type: "slider", min: 0, max: 1.5, step: 0.1, def: 0.7, showIf: (p) => p.chart === "Landolt C — ISO/logMAR" || p.chart === "Tumbling E — logMAR" },
    { key: "scale", label: "Scale %", type: "slider", min: 10, max: 200, step: 1, def: 100 },
    { key: "spacing", label: "Spacing × size", type: "slider", min: 0.2, max: 2, step: 0.05, def: 1, showIf: (p) => p.chart !== "Pseudoisochromatic art" },
    { key: "inkPitch", label: "Ink pitch mm", type: "slider", min: 0.15, max: 2, step: 0.05, def: 0.45, showIf: (p) => ["Tumbling E — logMAR","China GB/T E — 5-mark","Golovin–Sivtsev"].includes(p.chart) },
    { key: "labels", label: "Scale labels", type: "check", def: true, showIf: (p) => p.chart !== "Pseudoisochromatic art" },
    { key: "size", label: "Figure size mm", type: "slider", min: 30, max: 260, step: 1, def: 140, showIf: (p) => p.chart === "Pseudoisochromatic art" },
    { key: "target", label: "Hidden number", type: "text", def: "26", showIf: (p) => p.chart === "Pseudoisochromatic art" },
    { key: "dots", label: "Ground dots", type: "slider", min: 40, max: 700, step: 10, def: 300, showIf: (p) => p.chart === "Pseudoisochromatic art" },
    { key: "dotMin", label: "Min dot mm", type: "slider", min: 0.5, max: 5, step: 0.1, def: 1.2, showIf: (p) => p.chart === "Pseudoisochromatic art" },
    { key: "dotMax", label: "Max dot mm", type: "slider", min: 1, max: 9, step: 0.1, def: 3.4, showIf: (p) => p.chart === "Pseudoisochromatic art" },
    { key: "seed", label: "Seed", type: "seed", def: 1843 },
    { key: "pen", label: "Main pen", type: "pen", def: 0 },
    { key: "secondPen", label: "Second pen", type: "pen", def: 1, showIf: (p) => p.chart === "Pseudoisochromatic art" || p.chart === "Golovin–Sivtsev" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 50, step: 1, def: 12 },
  ],
  compute(ins, p, ctx) {
    const W=Math.max(1,Number(ctx.W)||210), H=Math.max(1,Number(ctx.H)||297);
    const main=Math.max(0,Math.min(11,Math.round(Number(p.pen)||0))), second=Math.max(0,Math.min(11,Math.round(Number(p.secondPen)||0)));
    const margin=Math.max(0,Number(p.margin)||0), scale=Math.max(.01,Number(p.scale)||100)/100;
    const paths=[], rng=mulberry32(Math.round(Number(p.seed)||0));
    const push=(pts,closed,layer)=>{if(pts&&pts.length>1&&pts.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])))paths.push({pts,closed:!!closed,layer:layer===undefined?main:layer});};
    const line=(x1,y1,x2,y2,layer)=>push([[x1,y1],[x2,y2]],false,layer);
    const circle=(cx,cy,r,layer,n)=>{if(!(r>0))return;const pts=[],N=Math.max(16,Math.min(180,n||Math.ceil(r*3)));for(let i=0;i<N;i++){const a=Math.PI*2*i/N;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}push(pts,true,layer);};
    const arc=(cx,cy,r,a0,a1,layer)=>{const N=Math.max(8,Math.min(160,Math.ceil(r*Math.abs(a1-a0)/.8))),pts=[];for(let i=0;i<=N;i++){const a=a0+(a1-a0)*i/N;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}push(pts,false,layer);};
    const FONT={"0":"111101101101111","1":"010110010010111","2":"111001111100111","3":"111001111001111","4":"101101111001001","5":"111100111001111","6":"111100111101111","7":"111001010010010","8":"111101111101111","9":"111101111001111","-":"000000111000000",".":"000000000000010"};
    const text=(str,x,y,h,layer)=>{const fs=fontStrokes(String(str),Math.max(1.8,h),1);for(const st of fs.strokes){if(st.length<2)continue;push(st.map(([sx,sy])=>[x+sx,y+sy]),false,layer);}};
    const drawLandolt=(cx,cy,d,dir,layer)=>{const outer=d/2,inner=outer*.6,mid=dir*Math.PI/4,pitch=Math.max(.18,Math.min(d/10,Number(p.inkPitch)||.45));const steps=Math.max(1,Math.round((outer-inner)/pitch));for(let i=0;i<=steps;i++){const r=inner+(outer-inner)*i/steps,hg=Math.asin(Math.min(.99,(d/10)/Math.max(r,d/10)));arc(cx,cy,r,mid+hg,mid+Math.PI*2-hg,layer);}};
    const drawE=(cx,cy,d,turns,layer)=>{
      /* Viisi täsmällistä moduuliriviä: 0/2/4 ovat koko leveät sakarat,
         1/3 pelkkä varsi. Jokainen moduuli saa aina vähintään yhden vedon,
         joten skaala tai hatch-väli ei voi pudottaa sakaraa pois. */
      const a=turns*Math.PI/2,ca=Math.cos(a),sa=Math.sin(a),cell=d/5;
      const pitch=Math.max(.15,Math.min(cell*.8,Number(p.inkPitch)||.45));
      for(let row=0;row<5;row++){
        const y0=-d/2+row*cell,y1=y0+cell,ys=[];
        const nY=Math.max(1,Math.round(cell/pitch));
        for(let i=row===0?0:1;i<=nY;i++)ys.push(y0+cell*i/nY);
        if(!ys.length)ys.push((y0+y1)/2);
        const x1=-d/2,x2=row%2===0?d/2:x1+cell;
        for(const yy of ys)push([[cx+x1*ca-yy*sa,cy+x1*sa+yy*ca],[cx+x2*ca-yy*sa,cy+x2*sa+yy*ca]],false,layer);
      }
    };
    const CYR={"Ш":["10101","10101","10101","10101","11111"],"Б":["11111","10000","11110","10001","11110"],"М":["10001","11011","10101","10001","10001"],"Н":["10001","10001","11111","10001","10001"],"К":["10001","10010","11100","10010","10001"],"Ы":["10001","10001","11101","10101","11101"],"И":["10001","10011","10101","11001","10001"]};
    const drawBitmap=(glyph,cx,cy,d,layer)=>{const rows=CYR[glyph]||CYR["Ш"],cell=d/5,pitch=Math.max(.15,Math.min(cell,Number(p.inkPitch)||.45));const nB=Math.max(1,Math.round(cell/pitch));for(let r=0;r<5;r++)for(let bi=r===0?0:1;bi<=nB;bi++){const sy=cell*bi/nB;let c=0;while(c<5){while(c<5&&rows[r][c]!=="1")c++;const c0=c;while(c<5&&rows[r][c]==="1")c++;if(c>c0)line(cx-d/2+c0*cell,cy-d/2+r*cell+sy,cx-d/2+c*cell,cy-d/2+r*cell+sy,layer);}}};
    const requestedChart=String(p.chart||"Landolt C — ISO/logMAR");
    const chart=["Landolt C — ISO/logMAR","Tumbling E — logMAR","China GB/T E — 5-mark","Golovin–Sivtsev","Pseudoisochromatic art"].includes(requestedChart)?requestedChart:"Landolt C — ISO/logMAR";
    if(chart==="Pseudoisochromatic art"){
      const d=Math.max(20,Math.min((Number(p.size)||140)*scale,W-2*margin,H-2*margin)),R=d/2,wanted=Math.max(10,Math.min(900,Math.round(Number(p.dots)||260))),rMin=Math.max(.25,Number(p.dotMin)||1.2)*scale,rMax=Math.max(rMin,Number(p.dotMax)||3.4)*scale;
      const raw=String(p.target||"26").replace(/[^0-9]/g,"").slice(0,3)||"26",digitW=d*.21,digitH=d*.42,totalW=raw.length*digitW,dx0=W/2-totalW/2;
      const bear=.11;const inTarget=(x,y)=>{const q=Math.floor((x-dx0)/digitW);if(q<0||q>=raw.length)return false;const bits=FONT[raw[q]],u0=(x-(dx0+q*digitW))/digitW,v=(y-(H/2-digitH/2))/digitH;if(!bits||u0<bear||u0>1-bear||v<0||v>=1)return false;const u=(u0-bear)/(1-2*bear);return bits[Math.min(4,Math.floor(v*5))*3+Math.min(2,Math.floor(u*3))]==="1";};
      const dots=[];
      const fits=(x,y,rad)=>{for(const q of dots){const gx=x-q.x,gy=y-q.y;if(gx*gx+gy*gy<(rad+q.r+.35)*(rad+q.r+.35))return false;}return true;};
      /* An Ishihara plate reads because the figure is PACKED, not because random
         ground dots happen to land on it. Phase 1 saturates the numeral with its
         own smaller dots; phase 2 fills the rest of the disc around them. */
      const figMax=rMin+(rMax-rMin)*.45,fy0=H/2-digitH/2,fy1=H/2+digitH/2;
      for(let tries=0;tries<wanted*120&&dots.length<wanted*2;tries++){
        const x=dx0+rng()*totalW,y=fy0+rng()*(fy1-fy0),rad=rMin+(figMax-rMin)*rng();
        if(!inTarget(x,y))continue;
        if(Math.hypot(x-W/2,y-H/2)>R-rad-.4)continue;
        if(fits(x,y,rad))dots.push({x,y,r:rad});
      }
      const figCount=dots.length,groundTarget=figCount+wanted;
      for(let tries=0;tries<wanted*90&&dots.length<groundTarget;tries++){
        const a=rng()*Math.PI*2,rr=Math.sqrt(rng())*(R-rMax),x=W/2+Math.cos(a)*rr,y=H/2+Math.sin(a)*rr,rad=rMin+(rMax-rMin)*rng();
        if(fits(x,y,rad))dots.push({x,y,r:rad});
      }
      for(const q of dots){const ly=inTarget(q.x,q.y)?second:main;circle(q.x,q.y,q.r,ly);if(q.r>2.2*rMin)circle(q.x,q.y,q.r*.55,ly);}
      circle(W/2,H/2,R);
    }else{
      const rows=Math.max(2,Math.min(14,Math.round(Number(p.rows)||11))),distance=Math.max(.1,Number(p.distance)||5),unit=2*distance*1000*Math.tan((2.5/60)*Math.PI/180)*scale,gapK=Math.max(.1,Number(p.spacing)||1),labelW=p.labels?22:2,availW=Math.max(5,W-2*margin-labelW*2);
      const specs=[];if(chart==="Golovin–Sivtsev"){const V=[.1,.2,.3,.4,.5,.6,.7,.8,.9,1,1.5,2];for(let i=0;i<Math.min(rows,V.length);i++)specs.push({v:V[i],log:-Math.log10(V[i])});}else if(chart==="China GB/T E — 5-mark"){for(let i=0;i<rows;i++){const mark=4+i*.1;specs.push({mark,log:5-mark,v:Math.pow(10,mark-5)});}}else{const top=Math.max(-.3,Math.min(2,Number(p.topLogmar)||0));for(let i=0;i<rows;i++){const log=top-i*.1;specs.push({log,v:Math.pow(10,-log)});}}
      const sizes=specs.map(s=>unit*Math.pow(10,s.log)),rowGaps=sizes.map(s=>Math.max(3,s*.28)),totalH=sizes.reduce((a,b)=>a+b,0)+rowGaps.slice(0,-1).reduce((a,b)=>a+b,0);let y=Math.max(margin,(H-totalH)/2),seq=0;
      for(let ri=0;ri<specs.length;ri++){const sp=specs[ri],d=sizes[ri],cell=d*(1+gapK),count=Math.max(1,Math.min(5,Math.floor((availW+d*gapK)/cell)));if(d>availW)continue;if(y+d>H-margin)break;const rowW=count*d+(count-1)*d*gapK,xStart=W/2-rowW/2;
        if(p.labels){const lab=chart==="China GB/T E — 5-mark"?Number(sp.mark).toFixed(1):sp.log.toFixed(1);text(lab,margin,y+d*.34,Math.min(4.5,d*.28),main);text(Number(sp.v).toFixed(sp.v<1?2:1),W-margin-18,y+d*.34,Math.min(4.5,d*.28),main);}
        for(let j=0;j<count;j++){const cx=xStart+j*cell+d/2,cy=y+d/2;if(chart==="Landolt C — ISO/logMAR")drawLandolt(cx,cy,d,(Math.floor(rng()*8)+seq)%8,main);else if(chart==="Tumbling E — logMAR"||chart==="China GB/T E — 5-mark")drawE(cx,cy,d,(Math.floor(rng()*4)+seq)%4,main);else if(chart==="Golovin–Sivtsev"){if(j%2===0)drawBitmap(["Ш","Б","М","Н","К","Ы","И"][(ri+j)%7],cx,cy,d,main);else drawLandolt(cx,cy,d,(ri+j*2)%8,second);}seq++;}y+=d+(rowGaps[ri]||0);
      }
    }
    return applyStyle({paths},ins[0]);
  },
  overlay(p,ctx){try{const m=Math.max(0,Number(p.margin)||0),W=Math.max(1,Number(ctx.W)||210),H=Math.max(1,Number(ctx.H)||297);if(p.chart==="Pseudoisochromatic art"){const d=Math.max(10,Math.min((Number(p.size)||140)*Math.max(.01,Number(p.scale)||100)/100,W-2*m,H-2*m));return[{kind:"circle",cx:W/2,cy:H/2,r:d/2}];}return[{kind:"rect",x:m,y:m,w:Math.max(0,W-2*m),h:Math.max(0,H-2*m)}];}catch(e){return[];}},
};
