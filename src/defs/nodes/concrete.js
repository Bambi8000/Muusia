import { Pin, EMPTY, mulberry32, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "concrete",
    name: "Concrete Poetry", cat: "gen", group: "textimg",
    desc: "Living typography made from real pen strokes. Choose Columns for repeated phrases, then select one of fourteen Motion modes. Zoom builds a growing letter or phrase from more fixed-size copies of each letter. Zoom uses a centred text block (| starts a new line), not Layout; Size mm is always the small letter size. Max rows sets the largest letter grid, Cell spacing sets its pitch. The grid grows in whole-cell steps. In & out returns to its starting size; Zoom in/out restart at the loop boundary. Region limits stamp centres and centres the composition. Very large Zoom output stops at the point budget without enlarging the small letters. Shift keeps a filled field of fixed letter cells while their order changes: Rows and Columns wrap cyclically; Shuffle follows a seeded permutation. Use Fill region for a full text field. Shift skips spaces and unsupported characters and changes in whole-letter steps. Timeline follows Muusia’s ANIMATE controls automatically; Phase input uses Phase 0–1, which can be wired. Cycles sets whole motion repeats. Row lag and Letter lag send motion through the text. Word collapse removes letters toward Short text when it is a subsequence of the phrase; otherwise it condenses the whole phrase. Outer edges aligns alternate columns to opposite edges. Travel mm sets displacement; Amount sets effect strength. Clip to page clips animated strokes to the margin box. Other motions use Region for initial placement; moving letters can leave its outline. Motion Off preserves the four original layouts. Very dense animated text outside Zoom increases the effective font size and keeps a stable selection of complete glyphs under the point budget. Text is uppercase single-stroke geometry; export the current frame or an SVG frame set.",
    ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text (| = line, space = word)", type: "text", def: "WORD IS IMAGE" },
      { key: "mode", label: "Layout", type: "select", options: ["Fill region", "Spiral", "Wave", "Scatter words", "Columns"], def: "Fill region", showIf: p => p.motion !== "Zoom" },
      { key: "columns", label: "Columns", type: "slider", min: 1, max: 4, step: 1, def: 2, showIf: p => p.mode === "Columns" && p.motion !== "Zoom" },
      { key: "gutter", label: "Column gap mm", type: "slider", min: 0, max: 40, step: 1, def: 12, showIf: p => p.mode === "Columns" && p.motion !== "Zoom" },
      { key: "align", label: "Column alignment", type: "select", options: ["Outer edges", "Left", "Centre"], def: "Outer edges", showIf: p => p.mode === "Columns" && p.motion !== "Zoom" },
      { key: "motion", label: "Motion", type: "select", options: ["Off", "Row squeeze", "Word collapse", "Wave", "Breathing", "Accordion", "Row slide", "Ripple", "Orbit", "Vortex", "Swarm", "Letter flip", "Typewriter", "Shift", "Zoom"], def: "Off" },
      { key: "zoomRows", label: "Max rows", type: "slider", min: 2, max: 80, step: 1, def: 32, showIf: p => p.motion === "Zoom" },
      { key: "zoomSpacing", label: "Cell spacing ×", type: "slider", min: 1.05, max: 2.5, step: 0.05, def: 1.25, showIf: p => p.motion === "Zoom" },
      { key: "zoomCycle", label: "Zoom cycle", type: "select", options: ["In & out", "Zoom in", "Zoom out"], def: "In & out", showIf: p => p.motion === "Zoom" },
      { key: "shiftPattern", label: "Shift pattern", type: "select", options: ["Rows", "Columns", "Shuffle"], def: "Rows", showIf: p => p.motion === "Shift" },
      { key: "clock", label: "Motion clock", type: "select", options: ["Timeline", "Phase input"], def: "Timeline", showIf: p => p.motion && p.motion !== "Off" },
      { key: "phase", label: "Phase 0–1", type: "slider", min: 0, max: 1, step: 0.01, def: 0, showIf: p => p.motion && p.motion !== "Off" },
      { key: "cycles", label: "Cycles", type: "slider", min: 1, max: 8, step: 1, def: 1, showIf: p => p.motion && p.motion !== "Off" },
      { key: "amount", label: "Amount", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8, showIf: p => p.motion && !["Off", "Shift", "Zoom"].includes(p.motion) },
      { key: "distance", label: "Travel mm", type: "slider", min: 0, max: 50, step: 1, def: 12, showIf: p => ["Wave", "Row slide", "Ripple", "Orbit", "Swarm"].includes(p.motion) },
      { key: "rowLag", label: "Row lag", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.06, showIf: p => p.motion && !["Off", "Zoom"].includes(p.motion) && (p.motion !== "Shift" || !p.shiftPattern || p.shiftPattern === "Rows") },
      { key: "letterLag", label: "Letter lag", type: "slider", min: 0, max: 0.3, step: 0.01, def: 0.025, showIf: p => ["Wave", "Breathing", "Orbit", "Swarm", "Letter flip"].includes(p.motion) },
      { key: "shortText", label: "Short text (collapse)", type: "text", def: "WORD", showIf: p => p.motion === "Word collapse" },
      { key: "clip", label: "Clip to page", type: "check", def: true, showIf: p => p.motion && p.motion !== "Off" },
      { key: "size", label: "Size mm", type: "slider", min: 2, max: 40, step: 0.5, def: 7 },
      { key: "sizeVar", label: "Size variation (scatter)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5, showIf: p => p.mode === "Scatter words" && p.motion !== "Zoom" },
      { key: "track", label: "Tracking", type: "slider", min: 0.6, max: 2.5, step: 0.05, def: 1, showIf: p => p.motion !== "Zoom" },
      { key: "lineh", label: "Line height ×", type: "slider", min: 0.9, max: 3, step: 0.05, def: 1.35, showIf: p => p.motion !== "Zoom" },
      { key: "turns", label: "Turns (spiral)", type: "slider", min: 1, max: 14, step: 0.5, def: 5, showIf: p => p.mode === "Spiral" && p.motion !== "Zoom" },
      { key: "waveAmp", label: "Wave amp mm", type: "slider", min: 0, max: 60, step: 1, def: 16, showIf: p => p.mode === "Wave" && p.motion !== "Zoom" },
      { key: "waveLen", label: "Wave length mm", type: "slider", min: 20, max: 400, step: 5, def: 130, showIf: p => p.mode === "Wave" && p.motion !== "Zoom" },
      { key: "count", label: "Words (scatter)", type: "slider", min: 5, max: 400, step: 5, def: 80, showIf: p => p.mode === "Scatter words" && p.motion !== "Zoom" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 151, showIf: p => p.motion !== "Zoom" },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    _layout(ins, p, ctx, collect=false) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const text = String(p.text || "").toUpperCase();
      const shiftCell=collect&&p.motion==="Shift"?Math.max(0,...[...text].map(ch=>(SFONT[ch]||SFONT[" "]).w))+2:0;
      const paths = [], glyphs=[];
      /* alue: suljetut sisaantulopolut tai marginaalilaatikko */
      const regions = ins[0] && ins[0].paths ? ins[0].paths.filter((q) => q.closed && q.pts.length > 2) : [];
      const inside = (x, y) => {
        if (!regions.length) return x >= m && x <= W - m && y >= m && y <= H - m;
        let cnt = 0;
        for (const path of regions) {
          const pts = path.pts;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
                (x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0])) cnt++;
          }
        }
        return cnt % 2 === 1;
      };
      let bx0 = m, by0 = m, bx1 = W - m, by1 = H - m;
      if (regions.length) {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
        for (const path of regions) for (const [x, y] of path.pts) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      }
      if(collect){
        bx0=Math.max(m,bx0);by0=Math.max(m,by0);bx1=Math.min(W-m,bx1);by1=Math.min(H-m,by1);
        if(bx1<=bx0 || by1<=by0)return [];
      }
      /* glyyfin piirto: sijainti + rotaatio + skaala; palauttaa etenemismitan */
      const drawGlyph = (ch, x, y, size, ang, guard, meta={}) => {
        const g = SFONT[ch] || SFONT[" "];
        const sc = size / 10;
        const adv = (shiftCell || g.w + 2) * sc * p.track * (meta.baseSx || 1);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        /* guard: piirra vain jos glyyfin keskikohta on alueen sisalla */
        const gcx = x + (adv / 2) * ca - (size / 2) * -sa;
        const gcy = y + (adv / 2) * sa + (size / 2) * -ca;
        if (guard && !inside(x + (adv / 2) * ca, y + (adv / 2) * sa - (size * 0.4) * ca * 0)) return adv;
        if (guard && !inside(gcx, gcy)) return adv;
        if(collect){glyphs.push({ch,x,y,size,ang,adv,index:glyphs.length,row:0,col:0,slot:0,anchor:bx0,...meta});return adv;}
        for (const stroke of g.s) {
          if (stroke.length < 2) continue;
          paths.push({
            pts: stroke.map(([gx, gy]) => {
              const lx = gx * sc * (meta.baseSx || 1), ly = (gy - 10) * sc; /* baseline y=0 */
              return [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
            }),
            closed: false, layer: L,
          });
        }
        return adv;
      };
      const lineText = text.replace(/\|/g, " ");
      if(p.mode === "Columns"){
        const phrases=text.split("|").map(s=>s.trim()).filter(Boolean);
        if(!phrases.length)return collect?[]:EMPTY;
        const cols=Math.round(p.columns),gap=Math.min(p.gutter,(bx1-bx0)/Math.max(1,cols)*0.8);
        const cw=(bx1-bx0-gap*(cols-1))/cols;
        let row=0;
        for(let y=by0+p.size;y<=by1;y+=p.size*p.lineh,row++)for(let col=0;col<cols;col++){
          const phrase=phrases[row%phrases.length];
          const natural=[...phrase].reduce((sum,ch)=>sum+(shiftCell || (SFONT[ch]||SFONT[" "]).w+2)*p.size/10*p.track,0);
          const baseSx=Math.min(1,cw/Math.max(natural,0.01)),width=natural*baseSx;
          const left=bx0+col*(cw+gap),right=p.align==='Outer edges'&&col%2===1;
          let x=left+(right?cw-width:p.align==='Centre'?(cw-width)/2:0);
          const anchor=right?left+cw:p.align==='Centre'?left+cw/2:left;
          for(let slot=0;slot<phrase.length;slot++)x+=drawGlyph(phrase[slot],x,y,p.size,0,true,{row,col,slot,phrase,baseSx,anchor,right});
        }
      }else if (p.mode === "Fill region") {
        /* rivit toistuvaa tekstia; glyyfi piirtyy vain alueen sisalla */
        const src2 = lineText + (shiftCell ? "" : "  ");
        let row = 0;
        for (let y = by0 + p.size; y <= by1; y += p.size * p.lineh, row++) {
          /* rivioffset ettei sama sana pinoudu */
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, 0, true,{row,slot:ci-1,phrase:src2});
          }
        }
      } else if (p.mode === "Spiral") {
        /* arkhimedeen spiraali ulkoa sisaan, teksti toistuu */
        const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const maxR = Math.min(bx1 - bx0, by1 - by0) / 2 - p.size;
        const loopGap = Math.max(p.size * p.lineh, maxR / Math.max(1, p.turns));
        const rAt = (th) => maxR - (th / (Math.PI * 2)) * loopGap;
        let th = 0, ci = 0;
        const srcT = lineText + (shiftCell ? "" : " \u00B7 ");
        let guardCount = 0;
        while (rAt(th) > p.size && guardCount++ < 3000) {
          const r = rAt(th);
          const x = cx + Math.cos(th) * r;
          const y = cy + Math.sin(th) * r;
          const ch = srcT[ci % srcT.length];
          ci++;
          const g = SFONT[ch] || SFONT[" "];
          const adv = (shiftCell || g.w + 2) * (p.size / 10) * p.track;
          /* tangentin suunta + kaarevuuskorjattu kulma-askel */
          drawGlyph(ch, x, y, p.size, th + Math.PI / 2, false,{slot:ci-1,phrase:srcT});
          th += adv / Math.max(2, r);
        }
      } else if (p.mode === "Wave") {
        const src2 = lineText + (shiftCell ? "" : "  ");
        let row = 0;
        for (let y0 = by0 + p.size; y0 <= by1; y0 += p.size * p.lineh, row++) {
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ph = (x / p.waveLen) * Math.PI * 2 + row * 0.7;
            const y = y0 + Math.sin(ph) * p.waveAmp * 0.5;
            /* kulma seuraa aallon derivaattaa */
            const slope = Math.cos(ph) * p.waveAmp * 0.5 * (Math.PI * 2 / p.waveLen);
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, Math.atan(slope), true,{row,slot:ci-1,phrase:src2}) * Math.cos(Math.atan(slope) * 0.5);
          }
        }
      } else {
        /* Scatter: sanat hajallaan alueen sisalla */
        const words = lineText.split(/\s+/).filter(Boolean);
        if (!words.length) return collect ? [] : EMPTY;
        const rng = mulberry32(p.seed * 6689 + 127);
        let placed = 0, guard = 0;
        while (placed < Math.round(p.count) && guard++ < p.count * 25) {
          const word = words[Math.floor(rng() * words.length)];
          const size = p.size * (1 - p.sizeVar * rng());
          const ang = (rng() - 0.5) * 1.1;
          const x0 = bx0 + rng() * (bx1 - bx0);
          const y0 = by0 + rng() * (by1 - by0);
          if (!inside(x0, y0)) continue;
          let x = x0;
          for (let slot=0;slot<word.length;slot++) {
            x += drawGlyph(word[slot], x, y0 + (x - x0) * Math.tan(ang) * 0, size, ang, true,{row:placed,slot,phrase:word,anchor:x0});
          }
          placed++;
        }
      }
      return collect ? glyphs : applyStyle({ paths }, ins[1]);
    },
    // Keep the legacy layout's operation order intact when motion is disabled.
    compute(ins, p, ctx) {
      const num=(v,d,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));
      const motion=p.motion||"Off",amount=["Shift","Zoom"].includes(motion)?1:num(p.amount,0.8,0,1);
      if(p.mode!=="Columns"&&(motion==="Off"||amount===0))return this._layout(ins,p,ctx);
      const W=num(ctx.W,210,1,10000),H=num(ctx.H,297,1,10000);
      const q={...p,text:String(p.text||"").slice(0,2000),motion,amount,
        margin:num(p.margin,12,0,Math.min(W,H)/2),size:num(p.size,7,2,200),
        track:num(p.track,1,0.6,2.5),lineh:num(p.lineh,1.35,0.9,3),
        sizeVar:num(p.sizeVar,0.5,0,0.95),turns:num(p.turns,5,1,14),
        waveAmp:num(p.waveAmp,16,0,60),waveLen:num(p.waveLen,130,20,400),
        count:Math.round(num(p.count,80,0,400)),seed:num(p.seed,151,-1e9,1e9),
        columns:Math.round(num(p.columns,2,1,4)),gutter:num(p.gutter,12,0,40),
        align:p.align||"Outer edges",layer:Math.round(num(p.layer,0,0,11))};
      if(motion==="Shift")q.text=[...q.text.toUpperCase()].filter(ch=>!/[\s|]/.test(ch)&&SFONT[ch]?.s.some(s=>s.length>1)).join("");
      if(!q.text.trim()||W<=2*q.margin||H<=2*q.margin)return EMPTY;
      const tau=2*Math.PI,cycles=Math.round(num(p.cycles,1,1,8));
      const timeline=p.clock==="Phase input"?0:num(ctx.frameIdx,0,-1e6,1e6)/num(ctx.frameCount,1,1,1e6);
      const raw=num(p.phase,0,0,1)+timeline*cycles;
      // Canonicalise the seam, including negative frame indices, before sin/cos.
      const phase=Math.round(((raw%1+1)%1)*1e12)/1e12%1,theta=phase*tau;
      if(motion==="Zoom"){
        const paths=[];
        for(const g of this._zoomGlyphs(ins,q,{W,H},phase)){
          const font=SFONT[g.ch],sc=g.size/10;
          for(const stroke of font.s){
            if(stroke.length<2)continue;
            const pts=stroke.map(([x,y])=>[g.x+(x-g.mx)*sc,g.y+(y-g.my)*sc]);
            const parts=p.clip===false?[pts]:this._clip(pts,q.margin,W-q.margin,q.margin,H-q.margin);
            for(const part of parts)paths.push({pts:part,closed:false,layer:q.layer});
          }
        }
        return applyStyle({paths},ins[1]);
      }
      // Bound layout work on large sheets before collecting complete glyphs.
      q.size=Math.max(q.size,Math.sqrt((W-2*q.margin)*(H-2*q.margin)/18000));
      if(q.mode==="Columns"){
        const longest=Math.max(...q.text.split("|").map(s=>s.length));
        q.size=Math.max(q.size,(H-2*q.margin)*q.columns*longest/(18000*q.lineh));
      }
      let glyphs=this._layout(ins,q,{...ctx,W,H},true);
      if(!glyphs.length)return EMPTY;
      const rowLag=num(p.rowLag,0.06,0,0.5),letterLag=num(p.letterLag,0.025,0,0.3);
      const travel=num(p.distance,12,0,50)*amount;
      const active=motion!=="Off"&&amount>0;
      if(active&&motion==="Shift")glyphs=this._shiftGlyphs(glyphs,q,phase);
      const groups=new Map(),short=String(p.shortText??"WORD").toUpperCase();
      for(const g of glyphs){
        const key=g.row+":"+g.col;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(g);
      }
      for(const row of groups.values()){
        const ph=theta+row[0].row*rowLag*tau+row[0].col*Math.PI;
        const collapse=(1-Math.cos(ph))/2;
        const phrase=row[0].phrase||q.text.toUpperCase(),kept=new Set();
        let cursor=0,matched=true;
        for(const ch of short){const at=phrase.indexOf(ch,cursor);if(at<0){matched=false;break;}kept.add(at);cursor=at+1;}
        let removed=0;
        for(let i=0;i<row.length;i++){
          const g=row[i];g.rank=i;g.total=row.length;g.rowPhase=ph;
          g.weight=active&&motion==="Word collapse"&&matched
            ?(kept.has(g.slot%phrase.length)?1:1-amount*collapse):1;
          g.removed=removed;g.matched=matched;
          removed+=g.adv*(1-g.weight);
        }
        for(const g of row)g.realign=g.right?removed:q.align==="Centre"&&q.mode==="Columns"?removed/2:0;
      }
      // Clipping can turn each segment into its own two-point stroke. Reserve
      // that worst-case cost; the same complete glyphs survive in every frame.
      const cost=g=>Math.max(0,(SFONT[g.ch]||SFONT[" "]).s.reduce((n,s)=>n+Math.max(0,s.length-1)*2,0));
      const shiftCost=motion==="Shift"?Math.max(...glyphs.map(cost)):0;
      const total=glyphs.reduce((n,g)=>n+(shiftCost||cost(g)),0),stride=Math.max(1,Math.ceil(total/112000));
      const paths=[];let budget=112000;
      const cx=W/2,cy=H/2,radius=Math.max(1,Math.min(W,H)/2-q.margin);
      for(const g of glyphs){
        const reserve=shiftCost||cost(g);if(g.index%stride||reserve>budget)continue;budget-=reserve;
        const ca=Math.cos(g.ang),sa=Math.sin(g.ang),baseSx=g.baseSx||1;
        let x=g.x+g.adv/2*ca+g.size/2*sa,y=g.y+g.adv/2*sa-g.size/2*ca;
        let sx=1,sy=1,angle=g.ang;
        const ph=g.rowPhase,lp=ph+g.slot*letterLag*tau;
        const dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy),u=r/radius;
        if(active)switch(motion){
          case "Row squeeze": {
            sx=1-amount*0.8*(1-Math.cos(ph))/2;x=g.anchor+(x-g.anchor)*sx;break;
          }
          case "Word collapse": {
            if(g.matched){
              sx=g.weight;sy=Math.sqrt(g.weight);
              const shift=(q.mode==="Spiral"?0:g.realign-g.removed)-g.adv*(1-sx)/2;
              x+=shift*ca;y+=shift*sa;
            }else{sx=1-amount*0.8*(1-Math.cos(ph))/2;x=g.anchor+(x-g.anchor)*sx;}
            break;
          }
          case "Wave": y+=travel*Math.sin(lp);angle+=amount*0.35*Math.cos(lp);break;
          case "Breathing": {
            const scale=1+amount*0.22*Math.sin(ph);x=cx+dx*scale;y=cy+dy*scale;
            sx=sy=1+amount*0.35*Math.sin(lp);break;
          }
          case "Accordion": {
            const scale=1-amount*0.75*(1-Math.cos(theta))/2;
            y=cy+dy*scale;sy=scale;angle+=amount*0.15*Math.sin(ph);break;
          }
          case "Row slide": x+=travel*Math.sin(ph);break;
          case "Ripple": {
            const offset=travel*Math.sin(theta-u*tau+g.row*rowLag*tau);
            if(r>1e-8){x+=dx/r*offset;y+=dy/r*offset;}
            break;
          }
          case "Orbit": x+=travel*Math.cos(lp);y+=travel*Math.sin(lp);break;
          case "Vortex": {
            const a=amount*1.5*Math.sin(theta+g.row*rowLag*tau)*(1-Math.min(u,1)*0.65);
            x=cx+dx*Math.cos(a)-dy*Math.sin(a);y=cy+dx*Math.sin(a)+dy*Math.cos(a);angle+=a;break;
          }
          case "Swarm": {
            const rng=mulberry32(q.seed*6761+g.index*101),e=(1-Math.cos(lp))/2;
            x+=(rng()*2-1)*travel*2*e;y+=(rng()*2-1)*travel*2*e;angle+=(rng()*2-1)*amount*1.8*e;break;
          }
          case "Letter flip": sx=1-amount+amount*Math.cos(lp);break;
          case "Typewriter": {
            const reveal=(1-Math.cos(ph))/2*g.total;
            sx=sy=1-amount+amount*Math.max(0,Math.min(1,reveal-g.rank));break;
          }
        }
        if(Math.abs(sx)<1e-7||Math.abs(sy)<1e-7)continue;
        const c=Math.cos(angle),s=Math.sin(angle);
        for(const stroke of (SFONT[g.ch]||SFONT[" "]).s){
          if(stroke.length<2)continue;
          const pts=stroke.map(([gx,gy])=>{
            const lx=(gx*g.size/10*baseSx-g.adv/2+(g.shiftPad||0))*sx,ly=((gy-10)*g.size/10+g.size/2)*sy;
            return [x+lx*c-ly*s,y+lx*s+ly*c];
          });
          const pieces=p.clip===false?[pts]:this._clip(pts,q.margin,W-q.margin,q.margin,H-q.margin);
          for(const part of pieces)paths.push({pts:part,closed:false,layer:q.layer});
        }
      }
      return applyStyle({paths},ins[1]);
    },
    // Rasterise the enlarged stroke font into letter cells, then draw each cell
    // at the original size. A set merges joints/corners, avoiding double plotting.
    _zoomGlyphs(ins,p,ctx,phase){
      const num=(v,d,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));
      const size=num(p.size,7,2,200),pitch=size*num(p.zoomSpacing,1.25,1.05,2.5);
      const maxRows=Math.round(num(p.zoomRows,32,2,120));
      const t=Math.round(((phase%1+1)%1)*1e12)/1e12%1;
      const progress=p.zoomCycle==="Zoom in"?t:p.zoomCycle==="Zoom out"?1-t:(1-Math.cos(t*Math.PI*2))/2;
      const rows=1+Math.round((maxRows-1)*(Math.round(progress*1e12)/1e12));
      const lines=String(p.text||"").slice(0,2000).toUpperCase().split(/[|\n]/);
      const fonts=new Map();
      for(const ch of lines.join("")){
        if(fonts.has(ch)||!SFONT[ch]?.s.some(s=>s.length>1))continue;
        const font=SFONT[ch],pts=font.s.flat(),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
        const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
        fonts.set(ch,{ch,x0,y0,mx:(x0+x1)/2,my:(y0+y1)/2,w:x1-x0,h:y1-y0,
          cols:1+Math.round((rows-1)*(x1-x0)/10),
          cost:font.s.reduce((n,s)=>n+Math.max(0,s.length-1)*2,0)});
      }
      if(!fonts.size)return [];
      const regions=(ins[0]?.paths||[]).filter(r=>r.closed&&r.pts.length>2);
      let x0=p.margin,y0=p.margin,x1=ctx.W-p.margin,y1=ctx.H-p.margin;
      if(regions.length){
        let rx0=Infinity,ry0=Infinity,rx1=-Infinity,ry1=-Infinity;
        for(const r of regions)for(const [x,y] of r.pts){rx0=Math.min(rx0,x);ry0=Math.min(ry0,y);rx1=Math.max(rx1,x);ry1=Math.max(ry1,y);}
        x0=Math.max(x0,rx0);y0=Math.max(y0,ry0);x1=Math.min(x1,rx1);y1=Math.min(y1,ry1);
      }
      if(x1<=x0||y1<=y0)return [];
      const inside=(x,y)=>{
        if(!regions.length)return true;
        let hit=false;
        for(const r of regions)for(let i=0,j=r.pts.length-1;i<r.pts.length;j=i++){
          const a=r.pts[i],b=r.pts[j];
          if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
        }
        return hit;
      };
      const gap=Math.max(1,Math.round(rows*0.2)),space=Math.max(1,Math.round(rows*0.5));
      const height=(lines.length*rows+(lines.length-1)*gap)*pitch;
      const top=(y0+y1-height)/2+pitch/2,result=[];
      let budget=112000,work=0;
      for(let line=0;line<lines.length;line++){
        const chars=[...lines[line]],width=chars.reduce((n,ch)=>n+(fonts.get(ch)?.cols??space)+gap,0)-gap;
        let left=(x0+x1-width*pitch)/2+pitch/2;
        const y=top+line*(rows+gap)*pitch;
        for(let letter=0;letter<chars.length;letter++){
          const f=fonts.get(chars[letter]),x=left;
          left+=((f?.cols??space)+gap)*pitch;
          if(!f)continue;
          // Skip off-page macro letters before walking their stroke grid.
          if(p.clip!==false&&(x+(f.cols-1)*pitch+size<x0||x-size>x1||y+(rows-1)*pitch+size<y0||y-size>y1))continue;
          const cells=new Set();
          const add=(col,row)=>cells.add(Math.round(col)+":"+Math.round(row));
          if(rows===1)add(0,0);
          else for(const stroke of SFONT[f.ch].s)for(let k=1;k<stroke.length;k++){
            const ax=(stroke[k-1][0]-f.x0)/Math.max(1,f.w)*(f.cols-1),ay=(stroke[k-1][1]-f.y0)/Math.max(1,f.h)*(rows-1);
            const bx=(stroke[k][0]-f.x0)/Math.max(1,f.w)*(f.cols-1),by=(stroke[k][1]-f.y0)/Math.max(1,f.h)*(rows-1);
            const steps=Math.max(1,Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))*2));
            for(let k=0;k<=steps;k++){
              if(++work>200000)return result;
              add(ax+(bx-ax)*k/steps,ay+(by-ay)*k/steps);
            }
          }
          for(const cell of cells){
            const [col,row]=cell.split(":").map(Number),cx=x+col*pitch,cy=y+row*pitch;
            if(p.clip!==false&&(cx+size<x0||cx-size>x1||cy+size<y0||cy-size>y1))continue;
            if(!inside(cx,cy))continue;
            if(f.cost>budget)return result;
            budget-=f.cost;
            result.push({ch:f.ch,x:cx,y:cy,size,mx:f.mx,my:f.my,line,letter,col,row});
          }
        }
      }
      return result;
    },
    // Permute complete letters between fixed cells. Every destination has one
    // source, including at wraparound; no interpolation through empty cells.
    _shiftGlyphs(glyphs,p,phase){
      const result=glyphs.map(g=>({...g})),groups=new Map(),ranks=new Map();
      const pattern=p.shiftPattern||"Rows";
      for(let i=0;i<glyphs.length;i++){
        const g=glyphs[i],row=g.row+":"+g.col,rank=ranks.get(row)||0;
        ranks.set(row,rank+1);
        const key=pattern==="Shuffle"?"all":pattern==="Columns"?g.col+":"+rank:row;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(i);
      }
      // A spiral has no vertical columns: cycle its single continuous sequence.
      const cycles=[...groups.values()].every(g=>g.length===1)?[glyphs.map((_,i)=>i)]:[...groups.values()];
      for(const indices of cycles){
        const order=indices.slice();
        if(pattern==="Shuffle"){
          const rng=mulberry32(p.seed*7919+47);
          for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
        }
        const lag=pattern==="Rows"?glyphs[order[0]].row*(Number.isFinite(+p.rowLag)?Math.max(0,Math.min(0.5,+p.rowLag)):0.06):0;
        const t=Math.round((((phase+lag)%1+1)%1)*1e12)/1e12%1;
        const offset=Math.floor(t*order.length+1e-8)%order.length;
        for(let i=0;i<order.length;i++){
          const g=result[order[i]],ch=glyphs[order[(i+offset)%order.length]].ch;
          g.ch=ch;
          g.shiftPad=(g.adv-((SFONT[ch]||SFONT[" "]).w+2)*g.size/10*p.track*(g.baseSx||1))/2;
        }
      }
      return result;
    },
    // Segment clipping preserves pen lifts across excursions outside the page.
    _clip(pts,x0,x1,y0,y1){
      const out=[];let current=[];
      const flush=()=>{if(current.length>1)out.push(current);current=[];};
      for(let i=1;i<pts.length;i++){
        const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1];
        let lo=0,hi=1,ok=true;
        for(const [p,q] of [[-dx,a[0]-x0],[dx,x1-a[0]],[-dy,a[1]-y0],[dy,y1-a[1]]]){
          if(Math.abs(p)<1e-14){if(q<0){ok=false;break;}}
          else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);
        }
        if(!ok||lo>=hi){flush();continue;}
        const start=[a[0]+lo*dx,a[1]+lo*dy],end=[a[0]+hi*dx,a[1]+hi*dy];
        const last=current[current.length-1];
        if(!last||Math.hypot(last[0]-start[0],last[1]-start[1])>1e-8){flush();current.push(start);}
        current.push(end);if(hi<1)flush();
      }
      flush();return out;
    },
    overlay(p,ctx,ins){
      const m=Math.max(0,Math.min(Number(p.margin)||0,Math.min(ctx.W,ctx.H)/2));
      const guides=[{kind:"rect",x:m,y:m,w:ctx.W-2*m,h:ctx.H-2*m}];
      for(const region of (ins?.[0]?.paths||[]).filter(r=>r.closed).slice(0,32))guides.push({kind:"poly",pts:region.pts});
      return guides;
    },
};
