import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "tiles",
  name: "Tiles",
  cat: "gen",
  group: "geometric",
  desc: "Disarray envelope modulates Field variation from Start to End across Vertical, Horizontal, Radial or a closed even-odd Mask. Off preserves the original field. The mask only affects cell centres; use Clip to own cell to keep motifs within the page. Grid of tiles, each a separate closed path: parametric Superellipse, Circle, Triangle, Hexagon, Star, Reuleaux or Cross, with per-tile rotation and jitter. Layout: Grid, Brick (odd rows offset half a cell) or Hex pack (offset rows at 0.866 pitch - circles and hexagons at Size 100 touch their neighbours). Alternate flip rotates every other tile 180 degrees so triangles tessellate. Field variation shares a coherent noise field across tiles, driving scale, angle and shift; Phase loops the field. Clip to own cell keeps the transformed motif inside its original cell. Arc is an open circular sweep. The natural Explosion input.",
  ins: [Pin("style", "Style"),Pin("paths","Mask")],
  outs: [Pin("paths")],
  params: [
    {key:"envelope",label:"Disarray envelope",type:"select",options:["Off","Vertical","Horizontal","Radial","Mask"],def:"Off"},
    {key:"start",label:"Envelope start %",type:"slider",min:0,max:100,step:1,def:0,showIf:p=>p.envelope!=="Off"},
    {key:"end",label:"Envelope end %",type:"slider",min:0,max:100,step:1,def:100,showIf:p=>p.envelope!=="Off"},
    {key:'field',label:'Field variation %',type:'slider',min:0,max:100,step:1,def:0},
    {key:'fieldScale',label:'Field size mm',type:'slider',min:5,max:200,step:1,def:60,showIf:p=>p.field>0},
    {key:'fieldMove',label:'Field shift %',type:'slider',min:0,max:100,step:1,def:45,showIf:p=>p.field>0},
    {key:'fieldRotate',label:'Field rotation °',type:'slider',min:0,max:180,step:1,def:90,showIf:p=>p.field>0},
    {key:'fieldShrink',label:'Field shrink %',type:'slider',min:0,max:100,step:1,def:60,showIf:p=>p.field>0},
    {key:'phase',label:'Field phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.field>0},
    {key:'clipCell',label:'Clip to own cell',type:'check',def:false,showIf:p=>p.field>0},
    {key:'arcSweep',label:'Arc sweep °',type:'slider',min:10,max:350,step:1,def:270,showIf:p=>p.shape==='Arc'},
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 40, step: 1, def: 10 },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 40, step: 1, def: 7 },
    { key: "layout", label: "Layout", type: "select", options: ["Grid", "Brick (offset rows)", "Hex pack"], def: "Grid" },
    { key: "flipAlt", label: "Alternate flip (triangles)", type: "check", def: false },
    { key: "shape", label: "Shape", type: "select", options: ["Superellipse", "Circle", "Triangle", "Hexagon", "Star", "Reuleaux", "Cross", "Arc"], def: "Superellipse" },
    { key: "superN", label: "Superellipse N", type: "slider", min: 0.4, max: 8, step: 0.05, def: 2.5 },
    { key: "sizeX", label: "Size X %", type: "slider", min: 10, max: 100, step: 1, def: 78 },
    { key: "sizeY", label: "Size Y % (0 = same)", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "starPts", label: "Star points", type: "slider", min: 3, max: 12, step: 1, def: 5 },
    { key: "starIn", label: "Star inner %", type: "slider", min: 10, max: 90, step: 1, def: 45 },
    { key: "rot", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "rotJit", label: "Rotation jitter °", type: "slider", min: 0, max: 180, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 101 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const m = p.margin;
    const cols = Math.round(p.cols), rows = Math.round(p.rows);
    const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
    const rng = mulberry32(p.seed * 3169 + 61);
    const a = (cw / 2) * (p.sizeX / 100);
    const b = (ch / 2) * ((p.sizeY > 0 ? p.sizeY : p.sizeX) / 100);
    /* muodon pisteet yksikkokoossa (a,b sisaan skaalattuna) */
    const shapePts = () => {
      const pts = [];
      if (p.shape === "Superellipse") {
        /* |x/a|^n + |y/b|^n = 1 : N 1 = timantti, 2 = ellipsi, iso = suorakulmio, <1 = astroidi */
        const e = 2 / Math.max(0.05, p.superN);
        for (let k = 0; k < 64; k++) {
          const t = (k / 64) * Math.PI * 2;
          const c = Math.cos(t), s = Math.sin(t);
          pts.push([
            a * Math.sign(c) * Math.pow(Math.abs(c), e),
            b * Math.sign(s) * Math.pow(Math.abs(s), e),
          ]);
        }
      } else if (p.shape === "Circle") {
        for (let k = 0; k < 48; k++) {
          const t = (k / 48) * Math.PI * 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if(p.shape==='Arc'){
        const sweep=Math.max(10,Math.min(350,+p.arcSweep||270))*Math.PI/180;for(let k=0;k<=40;k++){const t=sweep*k/40;pts.push([a*Math.cos(t),b*Math.sin(t)]);}
      } else if (p.shape === "Triangle") {
        for (let k = 0; k < 3; k++) {
          const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Hexagon") {
        for (let k = 0; k < 6; k++) {
          const t = (k / 6) * Math.PI * 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Star") {
        const n = Math.round(p.starPts);
        for (let k = 0; k < n * 2; k++) {
          const t = (k / (n * 2)) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? 1 : p.starIn / 100;
          pts.push([a * rr * Math.cos(t), b * rr * Math.sin(t)]);
        }
      } else if (p.shape === "Reuleaux") {
        /* kolme kaarta, keskukset kolmion vastakkaisissa karjissa */
        const V = [0, 1, 2].map((k) => {
          const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
          return [Math.cos(t), Math.sin(t)];
        });
        const R = Math.hypot(V[1][0] - V[0][0], V[1][1] - V[0][1]);
        for (let k = 0; k < 3; k++) {
          const c = V[k];
          const a1 = Math.atan2(V[(k + 1) % 3][1] - c[1], V[(k + 1) % 3][0] - c[0]);
          const a2 = Math.atan2(V[(k + 2) % 3][1] - c[1], V[(k + 2) % 3][0] - c[0]);
          let d = a2 - a1;
          while (d < 0) d += Math.PI * 2;
          for (let q = 0; q < 12; q++) {
            const t = a1 + (q / 12) * d;
            pts.push([(c[0] + Math.cos(t) * R) * a * 0.62, (c[1] + Math.sin(t) * R) * b * 0.62]);
          }
        }
      } else {
        /* Cross: risti */
        const t = 0.36;
        const cr = [
          [-t, -1], [t, -1], [t, -t], [1, -t], [1, t], [t, t],
          [t, 1], [-t, 1], [-t, t], [-1, t], [-1, -t], [-t, -t],
        ];
        for (const [x, y] of cr) pts.push([x * a, y * b]);
      }
      return pts;
    };
    const base = shapePts();
    const hexPack = p.layout === "Hex pack";
    const brick = p.layout === "Brick (offset rows)";
    const pitch = hexPack ? ch * 0.866 : ch;
    const totalH = (rows - 1) * pitch + ch;
    const oy0 = hexPack ? m + Math.max(0, (H - 2 * m - totalH) / 2) : m;
    const paths = [];
    for (let r = 0; r < rows; r++) {
      const off = (brick || hexPack) && r % 2 === 1;
      const nC = off ? Math.max(1, cols - 1) : cols;
      for (let c = 0; c < nC; c++) {
        const cx = m + (c + 0.5) * cw + (off ? cw / 2 : 0);
        const cy = oy0 + (hexPack ? r * pitch + ch / 2 : (r + 0.5) * ch);
        let ang = ((p.rot + (rng() - 0.5) * 2 * p.rotJit) * Math.PI) / 180;
        if (p.flipAlt && (r + c) % 2 === 1) ang += Math.PI;
        let ev=1;if(p.envelope&&p.envelope!=="Off"){let v=p.envelope==="Horizontal"?(cx-m)/(W-2*m):p.envelope==="Radial"?Math.min(1,Math.hypot((cx-W/2)/((W-2*m)/2),(cy-H/2)/((H-2*m)/2))):(cy-m)/(H-2*m);if(p.envelope==="Mask"){v=0;for(const q of ins[1]?.paths||[]){if(!q.closed)continue;let hit=false;for(let i=0,j=q.pts.length-1;i<q.pts.length;j=i++){const a=q.pts[i],b=q.pts[j];if((a[1]>cy)!==(b[1]>cy)&&cx<(b[0]-a[0])*(cy-a[1])/(b[1]-a[1])+a[0])hit=!hit;}if(hit)v=1-v;}}ev=((+p.start||0)+(Number.isFinite(+p.end)?+p.end:100)*v-(+p.start||0)*v)/100; }
        const field=ev*Math.max(0,Math.min(1,+p.field/100||0)),size=Math.max(1,+p.fieldScale||60),phase=(+p.phase||0)*Math.PI/180,f=field*noise2(cx/size+Math.cos(phase),cy/size+Math.sin(phase),p.seed),shrink=1-f*Math.max(0,Math.min(1,+p.fieldShrink/100||0));
        ang+=f*(+p.fieldRotate||0)*Math.PI/180;
        const ca = Math.cos(ang), sa = Math.sin(ang),dx=f*(+p.fieldMove||0)/100*cw*.5,dy=f*(+p.fieldMove||0)/100*ch*.35;
        const item={
          pts: base.map(([x, y]) => [cx+dx+shrink*(x*ca-y*sa),cy+dy+shrink*(x*sa+y*ca)]),
          closed: p.shape!=='Arc',layer:L,
        };
        if(field&&p.clipCell){
          const box=[cx-cw/2,cy-ch/2,cx+cw/2,cy+ch/2];
          if(item.closed){let poly=item.pts;for(let k=0;k<4;k++){const axis=k%2,bound=box[k],greater=k<2,inside=q=>greater?q[axis]>=bound:q[axis]<=bound,out=[];for(let i=0;i<poly.length;i++){const A=poly[i],B=poly[(i+1)%poly.length],a=inside(A),b=inside(B);if(a)out.push(A);if(a!==b){const t=(bound-A[axis])/(B[axis]-A[axis]);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}}poly=out;}if(poly.length>2)paths.push({...item,pts:poly});}
          else{let run=[];const flush=()=>{if(run.length>1)paths.push({...item,pts:run});run=[];};for(let i=1;i<item.pts.length;i++){const A=item.pts[i-1],B=item.pts[i];let lo=0,hi=1;for(let axis=0;axis<2;axis++){const d=B[axis]-A[axis];if(Math.abs(d)<1e-12){if(A[axis]<box[axis]||A[axis]>box[axis+2]){lo=1;hi=0;}}else{const a=(box[axis]-A[axis])/d,b=(box[axis+2]-A[axis])/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}}if(lo<=hi){const a=[A[0]+(B[0]-A[0])*lo,A[1]+(B[1]-A[1])*lo],b=[A[0]+(B[0]-A[0])*hi,A[1]+(B[1]-A[1])*hi];if(run.length&&Math.hypot(run.at(-1)[0]-a[0],run.at(-1)[1]-a[1])>1e-7)flush();if(!run.length)run.push(a);run.push(b);if(hi<1)flush();}else flush();}flush();}
        }else paths.push(item);
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};