import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "lattice_type", name: "Lattice Type", cat: "gen", group: "textimg",
  desc: "Grid-built lettering with rounded stems, projecting crossbars and round junction dots. The authored alphabet includes capitals, lowercase, digits, basic punctuation and Ä/Ö/Å; unsupported characters become ?. Text keeps its case and | starts a new line, up to 128 characters. Letter height sets the six-cell cap height; Width stretches the letter skeleton. Round corners, Crossbar reach and Dot radius change the structure. Dots can be outlined or filled with real plotter hatch lines at Dot hatch gap. The complete composition shrinks uniformly to Margin, including accents and projecting marks. Tight Letter gap deliberately connects neighbouring letters. Separate pens assigns stems, crossbars and dots to different pens. Purple Style is applied last; exceptionally dense styles coarsen their dash pitch to retain the complete text within the point budget. Numeric controls accept Frame wires for animation.",
  ins: [Pin("style", "Style")], outs: [Pin("paths")],
  params: [
    { key: "text", label: "Text (| = new line; max 128)", type: "text", def: "TRANSIT|GOTHIC" },
    { key: "size", label: "Letter height mm", type: "slider", min: 8, max: 120, step: 1, def: 45 },
    { key: "width", label: "Letter width ×", type: "slider", min: .5, max: 2, step: .05, def: 1 },
    { key: "round", label: "Round corners", type: "slider", min: 0, max: 1, step: .05, def: 1 },
    { key: "bars", label: "Crossbar reach (cells)", type: "slider", min: 0, max: 1.25, step: .05, def: .8 },
    { key: "dots", label: "Dots", type: "select", options: ["None", "Outline", "Hatched"], def: "Hatched" },
    { key: "radius", label: "Dot radius (cells)", type: "slider", min: .03, max: .4, step: .01, def: .16, showIf: p => p.dots !== "None" },
    { key: "hatch", label: "Dot hatch gap mm", type: "slider", min: .15, max: 2, step: .05, def: .3, showIf: p => p.dots === "Hatched" },
    { key: "tracking", label: "Letter gap (cells)", type: "slider", min: 0, max: 5, step: .1, def: 1.8 },
    { key: "linegap", label: "Line gap (cells)", type: "slider", min: 1, max: 6, step: .1, def: 4 },
    { key: "align", label: "Align", type: "select", options: ["Left", "Center", "Right"], def: "Center" },
    { key: "vertical", label: "Vertical align", type: "select", options: ["Top", "Center", "Bottom"], def: "Center" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "separate", label: "Separate pens", type: "check", def: false },
    { key: "layer", label: "Stem pen", type: "pen", def: 0 },
    { key: "barPen", label: "Crossbar pen", type: "pen", def: 1, showIf: p => p.separate },
    { key: "dotPen", label: "Dot pen", type: "pen", def: 2, showIf: p => p.separate },
  ],
  _glyphs() {
    // Six-cell cap height, four-cell x-height. ! keeps a joining corner square.
    // These are original orthogonal skeletons, rather than raster font masks.
    const raw = {
      A: [4,"0,6 0,0 4,0 4,6","0,3 4,3"],
      B: [4,"0,0 0,6","0,0! 4,0 4,3 0,3!","3,3 4,3 4,6 0,6!"],
      C: [4,"4,1 4,0 0,0 0,6 4,6 4,5"],
      D: [4,"0,0! 4,0 4,6 0,6! 0,0!"],
      E: [4,"4,0 0,0! 0,6! 4,6","0,3 3,3"],
      F: [4,"0,6 0,0! 4,0","0,3 3,3"],
      G: [4,"4,1 4,0 0,0 0,6 4,6 4,3! 2,3"],
      H: [4,"0,0 0,6","4,0 4,6","0,3 4,3"],
      I: [2,"1,0 1,6"], J: [4,"4,0 4,6 0,6 0,4"],
      K: [4,"0,0 0,6","4,0 4,1! 3,1! 3,2! 2,2! 2,3! 0,3","2,3! 2,4! 3,4! 3,5! 4,5! 4,6"],
      L: [4,"0,0 0,6 4,6"],
      M: [6,"0,6 0,0 3,0 3,6","3,1 3,0 6,0 6,6"],
      N: [4,"0,0 0,6","4,0 4,6","0,0 1,0! 1,2! 2,2! 2,3! 3,3! 3,4! 4,4"],
      O: [4,"0,0 4,0 4,6 0,6 0,0"],
      P: [4,"0,6 0,0! 4,0 4,3 0,3!"],
      Q: [4,"0,0 4,0 4,6 0,6 0,0","2,4 2,5! 3,5! 3,7! 4,7"],
      R: [4,"0,6 0,0! 4,0 4,3 0,3!","2,3 2,4! 3,4! 3,5! 4,5! 4,6"],
      S: [4,"4,1 4,0 0,0 0,3 4,3 4,6 0,6 0,5"],
      T: [4,"0,0 4,0","2,0 2,6"],
      U: [4,"0,0 0,6 4,6 4,0"],
      V: [4,"0,0 0,4! 1,4! 1,5! 2,5! 2,6","4,0 4,4! 3,4! 3,5! 2,5"],
      W: [6,"0,0 0,6 3,6 3,3","3,5 3,6 6,6 6,0"],
      X: [4,"0,0 0,1! 1,1! 1,2! 2,2","4,0 4,1! 3,1! 3,2! 2,2","2,2 2,4","2,4 1,4! 1,5! 0,5! 0,6","2,4 3,4! 3,5! 4,5! 4,6"],
      Y: [4,"0,0 0,3 4,3 4,0","2,3 2,6"],
      Z: [4,"0,0 4,0! 4,1! 3,1! 3,2! 2,2! 2,4! 1,4! 1,5! 0,5! 0,6! 4,6"],
      a: [5,"4,2! 0,2 0,6 4,6! 4,2!","4,6 5,6"],
      b: [4,"0,0 0,6","0,2! 4,2 4,6 0,6!"],
      c: [4,"4,3 4,2 0,2 0,6 4,6 4,5"],
      d: [4,"4,0 4,6","4,2! 0,2 0,6 4,6!"],
      e: [4,"0,4! 4,4! 4,2 0,2 0,6 4,6 4,5"],
      f: [3,"1,6 1,0 3,0","0,2 3,2"],
      g: [4,"4,2! 0,2 0,6 4,6!","4,2 4,8 0,8 0,7"],
      h: [4,"0,0 0,6","0,2! 4,2 4,6"],
      i: [2,"1,2 1,6","1,0"],
      j: [3,"2,2 2,8 0,8 0,7","2,0"],
      k: [4,"0,0 0,6","4,2 4,3 2,3 2,4! 0,4","2,4 2,5 4,5 4,6"],
      l: [2,"1,0 1,6 2,6"],
      m: [6,"0,6 0,2 3,2 3,6","3,3 3,2 6,2 6,6"],
      n: [4,"0,6 0,2 4,2 4,6"], o: [4,"0,2 4,2 4,6 0,6 0,2"],
      p: [4,"0,2 0,8","0,2! 4,2 4,6 0,6!"],
      q: [4,"4,2! 0,2 0,6 4,6!","4,2 4,8"],
      r: [3,"0,6 0,2 3,2 3,3"],
      s: [4,"4,2! 0,2 0,4 4,4 4,6 0,6!"],
      t: [3,"1,0 1,6 3,6","0,2 3,2"],
      u: [5,"0,2 0,6 4,6! 4,2","4,6 5,6"],
      v: [4,"0,2 0,4 1,4 1,5 2,5 2,6","4,2 4,4 3,4 3,5 2,5"],
      w: [6,"0,2 0,6 3,6 3,4","3,5 3,6 6,6 6,2"],
      x: [4,"0,2 0,3 2,3","4,2 4,3 2,3","2,3 2,5","2,5 0,5 0,6","2,5 4,5 4,6"],
      y: [4,"0,2 0,6 4,6!","4,2 4,8 0,8 0,7"],
      z: [4,"0,2 4,2! 4,3 2,3 2,5 0,5 0,6! 4,6"],
      "0": [4,"0,0 4,0 4,6 0,6 0,0"], "1": [3,"0,1 1,1 1,0! 2,0! 2,6","0,6 3,6"],
      "2": [4,"0,1 0,0 4,0 4,3 0,3 0,6! 4,6"],
      "3": [4,"0,0! 4,0 4,3 1,3","3,3 4,3 4,6 0,6!"],
      "4": [4,"0,0 0,3! 4,3","4,0 4,6"],
      "5": [4,"4,0 0,0! 0,3! 4,3 4,6 0,6!"],
      "6": [4,"4,0! 0,0 0,6 4,6 4,3! 0,3"],
      "7": [4,"0,0 4,0! 4,2! 3,2! 3,3! 2,3! 2,6"],
      "8": [4,"0,0 4,0 4,6 0,6 0,0","0,3 4,3"],
      "9": [4,"4,3! 0,3 0,0 4,0 4,6 0,6!"],
      ".": [2,"1,6"], ",": [2,"1,6 1,7 0,7"], ":": [2,"1,2","1,5"],
      ";": [2,"1,2","1,5 1,7 0,7"], "!": [2,"1,0 1,4","1,6"],
      "?": [4,"0,1 0,0 4,0 4,3 2,3 2,4","2,6"],
      "-": [3,"0,3 3,3"], "+": [4,"0,3 4,3","2,1 2,5"],
      "/": [4,"0,6 0,5! 1,5! 1,4! 2,4! 2,2! 3,2! 3,1! 4,1! 4,0"],
      "(": [2,"2,0 0,0 0,6 2,6"], ")": [2,"0,0 2,0 2,6 0,6"],
      "'": [1,"0,0 0,1"], " ": [3],
    };
    return Object.fromEntries(Object.entries(raw).map(([ch, [w, ...s]]) => [ch, { w, s: s.map(line => line.split(" ").map(v => { const [x,y] = v.replace("!", "").split(",").map(Number); return { x, y, sharp: v.endsWith("!") }; })) }]));
  },
  _parameters(input) {
    const p = {};
    for (const d of this.params) {
      const v = input[d.key] ?? d.def;
      if (d.type === "text") p[d.key] = Array.from(String(v).normalize("NFC").replace(/\r\n?|\n/g,"|")).slice(0,128).join("");
      else if (d.options) p[d.key] = d.options.includes(v) ? v : d.def;
      else if (d.type === "check") p[d.key] = !!v;
      else { const n = Number.isFinite(Number(v)) ? Number(v) : d.def; p[d.key] = Math.max(d.min ?? 0, Math.min(d.max ?? 11,n)); if (d.type === "pen") p[d.key] = Math.round(p[d.key]); }
    }
    return p;
  },
  _round(stroke, radius) {
    const eq = (a,b) => a.x === b.x && a.y === b.y;
    const closed = stroke.length > 3 && eq(stroke[0],stroke.at(-1));
    const v = closed ? stroke.slice(0,-1) : stroke, n = v.length;
    if (n < 2) return { pts: v.map(q => [q.x,q.y]), closed: false };
    const corners = v.map((q,i) => {
      if (!radius || q.sharp || (!closed && (i===0 || i===n-1))) return null;
      const a=v[(i+n-1)%n], b=v[(i+1)%n], dx=a.x-q.x,dy=a.y-q.y,ex=b.x-q.x,ey=b.y-q.y;
      const l=Math.hypot(dx,dy),m=Math.hypot(ex,ey);
      if (!l || !m || Math.abs(dx*ex+dy*ey)>1e-8) return null;
      return { q, ux:dx/l,uy:dy/l,vx:ex/m,vy:ey/m,l,m };
    });
    const pts=[];
    const push=(x,y)=>{const a=pts.at(-1);if(!a||Math.hypot(x-a[0],y-a[1])>1e-9)pts.push([x,y]);};
    for(let i=0;i<n;i++) {
      const c=corners[i];if(!c){push(v[i].x,v[i].y);continue;}
      const r=Math.min(radius,c.l/(corners[(i+n-1)%n]?2:1),c.m/(corners[(i+1)%n]?2:1));
      const cx=c.q.x+r*(c.ux+c.vx),cy=c.q.y+r*(c.uy+c.vy);
      const a=Math.atan2(-c.vy,-c.vx),b=Math.atan2(-c.uy,-c.ux);let delta=b-a;
      while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;
      for(let k=0;k<=8;k++)push(cx+r*Math.cos(a+delta*k/8),cy+r*Math.sin(a+delta*k/8));
    }
    return {pts,closed};
  },
  _geometry(p) {
    const F=this._glyphs(),lines=p.text.split("|"),rows=[];
    const accents={"Ä":"A","Ö":"O","Å":"A","ä":"a","ö":"o","å":"a"};
    let letter=0;
    for(let row=0;row<lines.length;row++) {
      const core=[],nodes=[];let x=0;
      for(const ch of lines[row]) {
        const g=F[accents[ch] || ch] || F["?"],local=g.s.map(s=>this._round(s,p.round)), anchors=new Map();
        const edges=local.flatMap(q=>q.pts.length<2?[]:(q.closed?[...q.pts,q.pts[0]]:q.pts).slice(1).map((b,i)=>[q.pts[i],b]));
        const on=(xx,yy)=>edges.some(([a,b])=>{
          const dx=b[0]-a[0],dy=b[1]-a[1],t=((xx-a[0])*dx+(yy-a[1])*dy)/(dx*dx+dy*dy);
          return t>=-1e-8&&t<=1+1e-8&&Math.hypot(xx-a[0]-t*dx,yy-a[1]-t*dy)<1e-7;
        });
        for(let yy=0;yy<=8;yy++)for(let xx=0;xx<=g.w+1;xx++)if(on(xx,yy))anchors.set(`${xx},${yy}`,[xx,yy]);
        for(const s of g.s)if(s.length===1)anchors.set(`${s[0].x},${s[0].y}`,[s[0].x,s[0].y]);
        if(accents[ch]) {
          const ay=ch===ch.toUpperCase()?-1:1;
          if(ch==='Å'||ch==='å')anchors.set(`2,${ay}`,[2,ay]);
          else {anchors.set(`1,${ay}`,[1,ay]);anchors.set(`3,${ay}`,[3,ay]);}
        }
        for(const q of local)if(q.pts.length>1)core.push({...q,pts:q.pts.map(([a,b])=>[(x+a)*p.width,b+row*(6+p.linegap)])});
        for(const a of anchors.values())nodes.push({point:[(x+a[0])*p.width,a[1]+row*(6+p.linegap)],edges:edges.map(([b,c])=>[[b[0]*p.width,b[1]],[c[0]*p.width,c[1]]]),local:[a[0]*p.width,a[1]],letter});
        x+=g.w+p.tracking;letter++;
      }
      rows.push({core,nodes,width:Math.max(0,x-p.tracking)});
    }
    const width=Math.max(0,...rows.map(r=>r.width));
    const core=[],nodes=[];
    for(const row of rows){const shift=(width-row.width)*(p.align==='Left'?0:p.align==='Right'?1:.5)*p.width;core.push(...row.core.map(q=>({...q,pts:q.pts.map(([x,y])=>[x+shift,y])})));nodes.push(...row.nodes.map(n=>({...n,point:[n.point[0]+shift,n.point[1]]})));}
    return {core,nodes};
  },
  _layout(p,ctx) {
    const W=Number(ctx?.W),H=Number(ctx?.H);if(!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0)return null;
    const margin=Math.min(p.margin,Math.max(0,Math.min(W,H)/2-.01)),g=this._geometry(p);
    if(!g.core.length&&!g.nodes.length)return null;
    const reach=Math.max(p.bars,p.dots==='None'?0:p.radius),points=[...g.core.flatMap(q=>q.pts),...g.nodes.flatMap(n=>[[n.point[0]-reach,n.point[1]-reach],[n.point[0]+reach,n.point[1]+reach]])];
    if(!points.length)return null;
    const xs=points.map(q=>q[0]),ys=points.map(q=>q[1]),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0,h=Math.max(...ys)-y0;
    const cell=Math.min(p.size/6,(W-2*margin)/Math.max(w,1e-8),(H-2*margin)/Math.max(h,1e-8));
    const x=margin+(W-2*margin-w*cell)*(p.align==='Left'?0:p.align==='Right'?1:.5),y=margin+(H-2*margin-h*cell)*(p.vertical==='Top'?0:p.vertical==='Bottom'?1:.5);
    return {...g,margin,cell,x,y,x0,y0,w,h};
  },
  compute(ins,input,ctx) {
    const p=this._parameters(input||{}),L=this._layout(p,ctx);if(!L)return EMPTY;
    const map=([x,y])=>[L.x+(x-L.x0)*L.cell,L.y+(y-L.y0)*L.cell];
    const paths=L.core.map(q=>({...q,pts:q.pts.map(map),layer:p.layer})),bars=new Map();
    const barLayer=p.separate?p.barPen:p.layer,dotLayer=p.separate?p.dotPen:p.layer;
    for(const n of L.nodes)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]) {
      let cover=0;
      for(const [a,b]of n.edges){const cross=q=>(q[0]-n.local[0])*dy-(q[1]-n.local[1])*dx;
        if(Math.abs(cross(a))>1e-8||Math.abs(cross(b))>1e-8)continue;
        const t=q=>(q[0]-n.local[0])*dx+(q[1]-n.local[1])*dy,lo=Math.min(t(a),t(b)),hi=Math.max(t(a),t(b));
        if(lo<=1e-8&&hi>=0)cover=Math.max(cover,hi);
      }
      if(p.bars<=cover+1e-8)continue;
      const axis=dx?'h':'v',fixed=dx?n.point[1]:n.point[0],a=(dx?n.point[0]:n.point[1])+(dx||dy)*cover,b=(dx?n.point[0]:n.point[1])+(dx||dy)*p.bars,key=axis+':'+fixed;
      if(!bars.has(key))bars.set(key,{axis,fixed,spans:[]});bars.get(key).spans.push([Math.min(a,b),Math.max(a,b)]);
    }
    for(const {axis,fixed,spans}of bars.values()){
      spans.sort((a,b)=>a[0]-b[0]);const merged=[];for(const s of spans){const last=merged.at(-1);if(last&&s[0]<=last[1]+1e-8)last[1]=Math.max(last[1],s[1]);else merged.push(s.slice());}
      for(const [a,b]of merged)paths.push({pts:(axis==='h'?[[a,fixed],[b,fixed]]:[[fixed,a],[fixed,b]]).map(map),closed:false,layer:barLayer});
    }
    if(p.dots!=='None'&&L.nodes.length){
      const perDot=Math.floor((100000-paths.reduce((n,q)=>n+q.pts.length,0))/L.nodes.length),detail=Math.max(6,Math.min(32,Math.floor(perDot*.6))),maxHatches=Math.max(0,Math.floor((perDot-detail)/2)),r=p.radius*L.cell;
      for(const n of L.nodes){const [cx,cy]=map(n.point),pts=[];for(let i=0;i<detail;i++){const a=i/detail*Math.PI*2;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}paths.push({pts,closed:true,layer:dotLayer});
        if(p.dots==='Hatched'&&maxHatches){const gap=Math.max(p.hatch,2*r/(maxHatches+1)),count=Math.min(maxHatches,Math.max(1,Math.ceil(2*r/gap)-1));for(let i=1;i<=count;i++){const yy=-r+2*r*i/(count+1),xx=Math.sqrt(Math.max(0,r*r-yy*yy));paths.push({pts:[[cx-xx,cy+yy],[cx+xx,cy+yy]],closed:false,layer:dotLayer});}}
      }
    }
    let result=applyStyle({paths},ins?.[0]);
    // Preserve all letters: coarsen an unusually dense dash style uniformly.
    for(let i=0;i<4;i++){const count=result.paths.reduce((n,q)=>n+q.pts.length,0);if(count<=115000)break;const st=ins?.[0];if(!st||st.mode==='Solid')break;const factor=count/100000*Math.pow(2,i);result=applyStyle({paths},{...st,dash:Math.max(.1,st.dash||.1)*factor,gap:Math.max(.1,st.gap||.1)*factor});}
    return result;
  },
  overlay(input,ctx){try{const p=this._parameters(input||{}),L=this._layout(p,ctx);return L?[{kind:'rect',x:L.margin,y:L.margin,w:ctx.W-2*L.margin,h:ctx.H-2*L.margin},{kind:'rect',x:L.x,y:L.y,w:L.w*L.cell,h:L.h*L.cell}]:[];}catch{return[];}},
};
