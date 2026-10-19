import { Pin, EMPTY, mulberry32, applyStyle, pathLength } from "../helpers.js";

// Original paths remain byte-for-byte identical while new controls are neutral.
function legacy(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1889 + 7);

      /* ---- Lightning: keskipiste-siirto + haarautuva salama ---- */
      if (p.preset === "Lightning") {
        const rough = Math.max(0.05, p.jitter || 0.35);
        const bolt = (x0, y0, x1, y1, detail) => {
          let pts = [[x0, y0], [x1, y1]];
          for (let d = 0; d < detail; d++) {
            const next = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
              const dx = b[0] - a[0], dy = b[1] - a[1];
              const len = Math.hypot(dx, dy) || 1;
              const off = (rng() - 0.5) * 2 * len * rough * 0.55;
              next.push([mx + (-dy / len) * off, my + (dx / len) * off]);
              next.push(b);
            }
            pts = next;
          }
          return pts;
        };
        const detail = Math.min(8, Math.max(3, Math.round(p.iter) + 2));
        const topX = W * (0.35 + rng() * 0.3);
        const botX = W * (0.25 + rng() * 0.5);
        const main = bolt(topX, p.margin, botX, H - p.margin, detail);
        const paths = [{ pts: main, closed: false, layer: Math.round(p.layer) }];
        const nBr = Math.round(p.branches);
        for (let b = 0; b < nBr; b++) {
          /* haara ylemmästä 2/3:sta, suunta paakolarin mukaan +- kulma */
          const i = 2 + Math.floor(rng() * (main.length * 0.66));
          if (i >= main.length - 1) continue;
          const S = main[i];
          const dx = main[i + 1][0] - main[i - 1][0], dy = main[i + 1][1] - main[i - 1][1];
          const base = Math.atan2(dy, dx);
          const sign = rng() > 0.5 ? 1 : -1;
          const a = base + sign * ((p.angle + (rng() - 0.5) * 20) * Math.PI) / 180;
          const len = (H - p.margin - S[1]) * (0.2 + rng() * 0.35);
          if (len < 5) continue;
          const E = [S[0] + Math.cos(a) * len, S[1] + Math.sin(a) * Math.abs(len)];
          const br = bolt(S[0], S[1], E[0], E[1], Math.max(2, detail - 2));
          paths.push({ pts: br, closed: false, layer: Math.round(p.layer) });
          /* pieni ala-haara puolella todennakoisyydella */
          if (rng() > 0.5 && br.length > 4) {
            const j = 1 + Math.floor(rng() * (br.length - 2));
            const S2 = br[j];
            const a2 = a + (rng() > 0.5 ? 1 : -1) * ((p.angle * 0.7) * Math.PI) / 180;
            const len2 = len * (0.25 + rng() * 0.3);
            if (len2 > 4) {
              const E2 = [S2[0] + Math.cos(a2) * len2, S2[1] + Math.sin(a2) * Math.abs(len2)];
              paths.push({ pts: bolt(S2[0], S2[1], E2[0], E2[1], Math.max(2, detail - 3)), closed: false, layer: Math.round(p.layer) });
            }
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---- tavalliset L-systeemit (jitter = stokastinen turtle) ---- */
      const PRESETS = {
        Koch: { axiom: "F", rules: "F=F+F--F+F", angle: 60 },
        Dragon: { axiom: "FX", rules: "X=X+YF+;Y=-FX-Y", angle: 90 },
        Plant: { axiom: "X", rules: "X=F+[[X]-X]-F[-FX]+X;F=FF", angle: 25 },
        Sierpinski: { axiom: "F-G-G", rules: "F=F-G+F+G-F;G=GG", angle: 120 },
        Hilbert: { axiom: "A", rules: "A=-BF+AFA+FB-;B=+AF-BFB-FA+", angle: 90 },
      };
      const cfg = p.preset === "Custom"
        ? { axiom: p.axiom || "F", rules: p.rules || "", angle: p.angle }
        : PRESETS[p.preset];
      const ruleMap = {};
      for (const r of String(cfg.rules).split(";")) {
        const [k, v] = r.split("=");
        if (k && v !== undefined) ruleMap[k.trim()] = v.trim();
      }
      let s = cfg.axiom;
      for (let i = 0; i < Math.round(p.iter); i++) {
        let next = "";
        for (const ch of s) {
          next += ruleMap[ch] !== undefined ? ruleMap[ch] : ch;
          if (next.length > 200000) break;
        }
        if (next.length > 200000) break;
        s = next;
      }
      const rad0 = (cfg.angle * Math.PI) / 180;
      let x = 0, y = 0, a = -Math.PI / 2;
      const stack = [];
      const rawPaths = [];
      let cur = [[0, 0]];
      for (const ch of s) {
        if (ch === "F" || ch === "G") {
          const step = 1 + (p.jitter ? (rng() - 0.5) * p.jitter * 0.7 : 0);
          x += Math.cos(a) * step; y += Math.sin(a) * step;
          cur.push([x, y]);
        } else if (ch === "f") {
          if (cur.length > 1) rawPaths.push(cur);
          x += Math.cos(a); y += Math.sin(a);
          cur = [[x, y]];
        } else if (ch === "+" || ch === "-") {
          const jit = p.jitter ? 1 + (rng() - 0.5) * 2 * p.jitter : 1;
          a += (ch === "+" ? 1 : -1) * rad0 * jit;
        } else if (ch === "[") stack.push([x, y, a]);
        else if (ch === "]") {
          if (cur.length > 1) rawPaths.push(cur);
          const st = stack.pop();
          if (st) { x = st[0]; y = st[1]; a = st[2]; }
          cur = [[x, y]];
        }
      }
      if (cur.length > 1) rawPaths.push(cur);
      if (!rawPaths.length) return EMPTY;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pa of rawPaths) for (const [px, py] of pa) {
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const paths = rawPaths.map((pa) => ({
        pts: pa.map(([px, py]) => [px * sc + ox, py * sc + oy]),
        closed: false, layer: Math.round(p.layer),
      }));
      return applyStyle({ paths }, ins[0]);

}

const ORGANIC = ['Plant','Sparse tree','Bush','Fern'];
const nonLightning = p => p.preset !== 'Lightning';
const organic = p => ORGANIC.includes(p.preset);
const advanced = p => organic(p) || p.preset === 'Custom';
const num = (p,k,d,lo,hi) => Math.max(lo,Math.min(hi,Number.isFinite(+p[k])?+p[k]:d));
function layout(p,ctx) {
  const m=num(p,'margin',15,0,Math.min(ctx.W,ctx.H)/2),forest=p.mode==='Forest'&&nonLightning(p);
  const count=forest?Math.round(num(p,'count',7,1,36)):1,cols=forest?Math.min(count,Math.round(num(p,'columns',7,1,12))):1,rows=Math.ceil(count/cols);
  const gap=forest?num(p,'spacing',8,0,40):0,w=(ctx.W-2*m-gap*(cols-1))/cols,h=(ctx.H-2*m-gap*(rows-1))/rows;
  return {m,forest,count,cols,rows,gap,w,h};
}
function reveal(ps,percentage) {
  if(percentage>=100)return ps;if(percentage<=0)return EMPTY;
  let left=ps.paths.reduce((n,p)=>n+pathLength(p.pts,p.closed),0)*percentage/100;const paths=[];
  for(const path of ps.paths){const length=pathLength(path.pts,path.closed);if(left>=length){paths.push(path);left-=length;continue;}if(left<=0)break;
    const pts=[path.pts[0]];for(let i=1;i<path.pts.length;i++){const a=path.pts[i-1],b=path.pts[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left>=d){pts.push(b);left-=d;}else{const t=d?left/d:0;pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);left=0;break;}}
    if(pts.length>1)paths.push({...path,pts,closed:false});break;
  }return {paths};
}
const PRESETS={
 Koch:{axiom:'F',rules:'F=F+F--F+F',angle:60},Dragon:{axiom:'FX',rules:'X=X+YF+;Y=-FX-Y',angle:90},
 Plant:{axiom:'X',rules:'X=F+[[X]-X]-F[-FX]+X;F=FF',angle:25},
 Sierpinski:{axiom:'F-G-G',rules:'F=F-G+F+G-F;G=GG',angle:120},Hilbert:{axiom:'A',rules:'A=-BF+AFA+FB-;B=+AF-BFB-FA+',angle:90},
 'Sparse tree':{axiom:'X',rules:'X=FF[+X]F[-X]FX;F=FF',fork:'FF[+X]F[-X]FX'},
 Bush:{axiom:'X',rules:'X=F[+X][-X][++X][--X];F=FF',fork:'F[+X][-X][++X][--X]'},
 Fern:{axiom:'X',rules:'X=F[+X]F[-X]+X;F=FF',fork:'F[+X]F[-X]+X'}
};
function generate(p,rng,limit) {
  const cfg=p.preset==='Custom'?{axiom:String(p.axiom||'F').slice(0,2000),rules:String(p.rules||'').slice(0,64000),angle:num(p,'angle',60,1,120)}:(PRESETS[p.preset]||PRESETS.Plant);
  const stochastic=!!p.stochastic&&advanced(p),map={};
  for(const rule of cfg.rules.split(';')){const i=rule.indexOf('='),key=rule.slice(0,i).trim(),value=rule.slice(i+1).trim();if(i<0||key.length!==1)continue;
    const parts=value.split('|'),weighted=parts.every(s=>/^\s*\d+(?:\.\d+)?\s*:/.test(s));
    const alternatives=weighted?parts.map(s=>{const j=s.indexOf(':');return {weight:Math.max(0,+s.slice(0,j)),text:s.slice(j+1).trim()};}):[{weight:1,text:value}];
    if(stochastic&&map[key])map[key].push(...alternatives);else map[key]=alternatives;
  }
  if(stochastic&&organic(p))map.X=[
    {weight:num(p,'continueWeight',50,0,100),text:'FX'},
    {weight:num(p,'branchWeight',35,0,100),text:cfg.fork||cfg.rules.split(';')[0].slice(2)},
    {weight:num(p,'endWeight',15,0,100),text:'F'}
  ];
  let text=cfg.axiom;
  for(let it=0;it<Math.round(num(p,'iter',4,1,8));it++){
    let next='',overflow=false;
    for(const c of text){const choices=map[c];let part=c;
      if(choices){let selected=choices[0];if(stochastic&&choices.length>1){const total=choices.reduce((n,q)=>n+q.weight,0);if(total<=0)selected={text:'F'};else{let t=rng()*total;for(const q of choices){if(t<q.weight){selected=q;break;}t-=q.weight;}}}part=selected.text;}
      if(next.length+part.length>limit){overflow=true;break;}next+=part;
    }
    if(overflow)break;text=next;
  }
  const angle=(organic(p)?num(p,'branchAngle',25,1,120):cfg.angle)*Math.PI/180,scale=advanced(p)?num(p,'branchScale',100,20,100)/100:1;
  const av=advanced(p)?num(p,'angleVariation',0,0,100)/100:0,lv=advanced(p)?num(p,'lengthVariation',0,0,90)/100:0,jitter=num(p,'jitter',0,0,1);
  let x=0,y=0,a=-Math.PI/2,length=1;const stack=[],paths=[];let cur=[[0,0]];
  const flush=()=>{if(cur.length>1)paths.push(cur);cur=[[x,y]];};
  for(const c of text){
    if(c==='F'||c==='G'||c==='f'){const step=length*(1+(jitter?(rng()-.5)*jitter*.7:0))*(1+(lv?(rng()-.5)*2*lv:0));if(c==='f')flush();x+=Math.cos(a)*step;y+=Math.sin(a)*step;if(c==='f')cur=[[x,y]];else cur.push([x,y]);}
    else if(c==='+'||c==='-')a+=(c==='+'?1:-1)*angle*(1+(jitter?(rng()-.5)*2*jitter:0))*(1+(av?(rng()-.5)*2*av:0));
    else if(c==='['){flush();stack.push([x,y,a,length]);length*=scale;}
    else if(c===']'){flush();const st=stack.pop();if(st)[x,y,a,length]=st;cur=[[x,y]];}
  }flush();return paths;
}
export default {
 key:'lsystem',name:'L-System',cat:'gen',group:'machines',
 desc:'Rewrite turtle instructions into curves or branching plants. Original presets remain unchanged when new controls are neutral. Plant, Sparse tree, Bush and Fern can use Stochastic rules: Continue / Branch / End weights select the next X production with a repeatable Seed. Weights are relative, need not total 100; all zero ends tips. Branch scale shortens each nested branch and restores its parent length on return. Angle variation and Length variation are independent, additional to legacy Jitter. Custom accepts weighted alternatives, e.g. X=50:FX|35:F[+X][-X]|15:F;F=FF; enable Stochastic rules to choose by weight (Off uses the first alternative). Plain Custom rules keep their old syntax. Forest arranges independently seeded plants in cells: Count, Columns and Spacing set the layout; Height variation scales trees down from their cell fit and keeps roots on its baseline. Single fits the complete plant to the sheet. Growth reveals the final drawing in turtle order, per plant in Forest, with fixed full-growth framing; wire Frame through Math to map 0–1 into 0–100. It is a drawing reveal, not a biological growth simulation. Lightning keeps its original generator and can also use Growth. Dense enhanced systems reduce whole rewrite iterations per plant instead of dropping later trees; Style density may coarsen to fit 118k points. Margin guides show cells. Numeric and checkbox controls accept wires.',
 ins:[Pin('style','Style')],outs:[Pin('paths')],
 params:[
  {key:'preset',label:'Preset',type:'select',options:['Koch','Dragon','Plant','Sierpinski','Hilbert','Lightning','Sparse tree','Bush','Fern','Custom'],def:'Plant'},
  {key:'mode',label:'Composition',type:'select',options:['Single','Forest'],def:'Single',showIf:nonLightning},
  {key:'axiom',label:'Axiom (custom)',type:'text',def:'F',showIf:p=>p.preset==='Custom'},
  {key:'rules',label:'Rules (custom)',type:'text',def:'F=F+F--F+F',showIf:p=>p.preset==='Custom'},
  {key:'iter',label:'Iterations / detail',type:'slider',min:1,max:8,step:1,def:4},
  {key:'angle',label:'Angle ° (custom/branch)',type:'slider',min:1,max:120,step:.5,def:60,showIf:p=>p.preset==='Custom'||p.preset==='Lightning'},
  {key:'branchAngle',label:'Branch angle °',type:'slider',min:1,max:120,step:.5,def:25,showIf:organic},
  {key:'stochastic',label:'Stochastic rules',type:'check',def:false,showIf:advanced},
  {key:'continueWeight',label:'Continue weight',type:'slider',min:0,max:100,step:1,def:50,showIf:p=>organic(p)&&p.stochastic},
  {key:'branchWeight',label:'Branch weight',type:'slider',min:0,max:100,step:1,def:35,showIf:p=>organic(p)&&p.stochastic},
  {key:'endWeight',label:'End weight',type:'slider',min:0,max:100,step:1,def:15,showIf:p=>organic(p)&&p.stochastic},
  {key:'branchScale',label:'Branch scale %',type:'slider',min:20,max:100,step:1,def:100,showIf:advanced},
  {key:'angleVariation',label:'Angle variation %',type:'slider',min:0,max:100,step:1,def:0,showIf:advanced},
  {key:'lengthVariation',label:'Length variation %',type:'slider',min:0,max:90,step:1,def:0,showIf:advanced},
  {key:'jitter',label:'Jitter / roughness',type:'slider',min:0,max:1,step:.05,def:0},
  {key:'branches',label:'Branches (lightning)',type:'slider',min:0,max:15,step:1,def:6,showIf:p=>p.preset==='Lightning'},
  {key:'count',label:'Plants',type:'slider',min:1,max:36,step:1,def:7,showIf:p=>nonLightning(p)&&p.mode==='Forest'},
  {key:'columns',label:'Columns',type:'slider',min:1,max:12,step:1,def:7,showIf:p=>nonLightning(p)&&p.mode==='Forest'},
  {key:'spacing',label:'Spacing mm',type:'slider',min:0,max:40,step:1,def:8,showIf:p=>nonLightning(p)&&p.mode==='Forest'},
  {key:'heightVariation',label:'Height variation %',type:'slider',min:0,max:80,step:1,def:35,showIf:p=>nonLightning(p)&&p.mode==='Forest'},
  {key:'growth',label:'Growth %',type:'slider',min:0,max:100,step:1,def:100},
  {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:15},
  {key:'seed',label:'Seed',type:'seed',def:37},
  {key:'layer',label:'Pen',type:'pen',def:3}
 ],
 overlay(p,ctx){if(!(ctx?.W>0&&ctx?.H>0))return [];const f=layout(p,ctx);if(f.w<=0||f.h<=0)return [];const guides=[{kind:'rect',x:f.m,y:f.m,w:ctx.W-2*f.m,h:ctx.H-2*f.m}];if(f.forest)for(let i=0;i<f.count;i++)guides.push({kind:'rect',x:f.m+i%f.cols*(f.w+f.gap),y:f.m+Math.floor(i/f.cols)*(f.h+f.gap),w:f.w,h:f.h});return guides;},
 compute(ins,p,ctx){
  const W=Number(ctx?.W),H=Number(ctx?.H);if(!(W>0&&H>0&&Number.isFinite(W)&&Number.isFinite(H)))return EMPTY;
  const growth=num(p,'growth',100,0,100),f=layout(p,ctx);if(f.w<=0||f.h<=0)return EMPTY;
  const plain=Object.hasOwn(PRESETS,p.preset)&&!['Sparse tree','Bush','Fern'].includes(p.preset)||p.preset==='Custom'||p.preset==='Lightning';
  const weightedCustom=p.preset==='Custom'&&/(?:^|[=|])\s*\d+(?:\.\d+)?\s*:/.test(String(p.rules||''));
  const enhanced=weightedCustom||p.stochastic&&advanced(p)||num(p,'branchScale',100,20,100)!==100&&advanced(p)||num(p,'angleVariation',0,0,100)>0&&advanced(p)||num(p,'lengthVariation',0,0,90)>0&&advanced(p)||organic(p)&&num(p,'branchAngle',25,1,120)!==25;
  if(p.preset==='Lightning'||plain&&!f.forest&&!enhanced){
    const safe={...p,iter:Math.round(num(p,'iter',4,1,8)),angle:num(p,'angle',60,1,120),
      jitter:num(p,'jitter',0,0,1),branches:Math.round(num(p,'branches',6,0,15)),
      margin:f.m,seed:Math.round(num(p,'seed',37,-2147483648,2147483647)),layer:Math.round(num(p,'layer',3,0,11)),
      axiom:String(p.axiom||'F').slice(0,2000),rules:String(p.rules||'').slice(0,64000)};
    return reveal(legacy(ins,safe,{W,H}),growth);
  }
  const all=[],layer=Math.round(num(p,'layer',3,0,11)),seed=Math.round(num(p,'seed',37,-2147483648,2147483647)),limit=Math.max(512,Math.floor(50000/f.count));
  for(let i=0;i<f.count;i++){
    const raw=generate(p,mulberry32(seed*1889+7+i*104729),limit);if(!raw.length)continue;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const path of raw)for(const [x,y] of path){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    const scale=Math.min(f.w/Math.max(.01,x1-x0),f.h/Math.max(.01,y1-y0))*(f.forest?1-num(p,'heightVariation',35,0,80)/100*mulberry32(seed*529+41+i*313)():1);
    const ox=f.m+i%f.cols*(f.w+f.gap)+f.w/2-(x0+x1)/2*scale;
    const oy=f.forest?f.m+Math.floor(i/f.cols)*(f.h+f.gap)+f.h-y1*scale:H/2-(y0+y1)/2*scale;
    const placed={paths:raw.map(pts=>({pts:pts.map(([x,y])=>[ox+x*scale,oy+y*scale]),closed:false,layer}))};all.push(...reveal(placed,growth).paths);
  }
  const ps={paths:all};let style=ins?.[0],result=applyStyle(ps,style);
  for(let n=0;n<12&&result.paths.reduce((n,p)=>n+p.pts.length,0)>118000;n++){
    style={...style,dash:Math.max(.1,+style?.dash||4)*1.8,gap:Math.max(.1,+style?.gap||3)*1.8};result=applyStyle(ps,style);
  }
  return result.paths.reduce((n,p)=>n+p.pts.length,0)<=118000?result:EMPTY;
 }
};
