import { Pin, EMPTY, noise2 } from "../helpers.js";

export default {
  key: 'pixel_blast', name: 'Pixel Blast', cat: 'gen', group: 'textimg',
  desc: 'Animated black pixel explosions for receipts and plotters. Firework, Willow, Volley, Mushroom cloud, Ground blast, Shockwave, Collision and Fountain have different growth and debris motion. Choose Manual Phase for a still, or Timeline and Play; integer loops repeat with a short empty interval between events. Each frame is reconstructed from Seed, so scrubbing never accumulates ink. Pixel size is physical millimetres on a fixed grid; Pixel fill controls the gaps. Filled pixels use real tightly spaced serpentine strokes, not SVG-only fills; Pixel outlines is lighter. Trails, Gravity, Wind, Smoke and Rings appear where used. Use a 72 × 100 mm canvas for receipts, then ANIMATE → Receipt × N for numbered frames with registration marks in one ZIP. This downloads files; printing is separate. Dense or long canvases uniformly increase pixel size to retain the whole image within work/point limits. Plotting output is ordinary XY paths. This is a graphic particle effect, not a physical blast simulation.',
  ins: [], outs: [Pin('paths', 'Pixels')],
  params: [
    { key: 'effect', label: 'Explosion', type: 'select', options: ['Firework', 'Willow', 'Volley', 'Mushroom cloud', 'Ground blast', 'Shockwave', 'Collision', 'Fountain'], def: 'Firework' },
    { key: 'motion', label: 'Time source', type: 'select', options: ['Manual', 'Timeline'], def: 'Manual' },
    { key: 'phase', label: 'Phase %', type: 'slider', min: 0, max: 100, step: 1, def: 45 },
    { key: 'cycles', label: 'Loops per timeline', type: 'slider', min: 1, max: 6, step: 1, def: 1, showIf: p => p.motion === 'Timeline' },
    { key: 'pixel', label: 'Pixel size mm', type: 'slider', min: .5, max: 4, step: .05, def: .7 },
    { key: 'fill', label: 'Pixel fill %', type: 'slider', min: 70, max: 100, step: 1, def: 92 },
    { key: 'draw', label: 'Draw as', type: 'select', options: ['Filled pixels', 'Pixel outlines'], def: 'Filled pixels' },
    { key: 'amount', label: 'Particles', type: 'slider', min: 80, max: 1600, step: 20, def: 640, showIf: p => !['Mushroom cloud', 'Shockwave'].includes(p.effect) },
    { key: 'size', label: 'Blast size %', type: 'slider', min: 15, max: 120, step: 1, def: 90 },
    { key: 'trails', label: 'Trails %', type: 'slider', min: 0, max: 100, step: 1, def: 60, showIf: p => !['Mushroom cloud', 'Shockwave'].includes(p.effect) },
    { key: 'gravity', label: 'Gravity %', type: 'slider', min: 0, max: 100, step: 1, def: 45, showIf: p => !['Mushroom cloud', 'Shockwave'].includes(p.effect) },
    { key: 'wind', label: 'Wind %', type: 'slider', min: -100, max: 100, step: 1, def: 0, showIf: p => p.effect !== 'Shockwave' },
    { key: 'smoke', label: 'Smoke %', type: 'slider', min: 0, max: 100, step: 1, def: 65, showIf: p => ['Mushroom cloud', 'Ground blast'].includes(p.effect) },
    { key: 'rings', label: 'Rings', type: 'slider', min: 1, max: 6, step: 1, def: 3, showIf: p => p.effect === 'Shockwave' },
    { key: 'grain', label: 'Grain %', type: 'slider', min: 0, max: 100, step: 1, def: 22 },
    { key: 'cx', label: 'Centre X %', type: 'slider', min: 0, max: 100, step: 1, def: 50 },
    { key: 'cy', label: 'Centre Y %', type: 'slider', min: 0, max: 100, step: 1, def: 56 },
    { key: 'margin', label: 'Margin mm', type: 'slider', min: 0, max: 40, step: 1, def: 3 },
    { key: 'seed', label: 'Seed', type: 'seed', def: 17 },
    { key: 'layer', label: 'Pen', type: 'pen', def: 0 },
  ],
  _layout(p, ctx, requested) {
    const n = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : d));
    const W = n(ctx?.W, 0, 0, 100000), H = n(ctx?.H, 0, 0, 100000), m = n(p.margin, 3, 0, 100000);
    const iw = W - 2*m, ih = H - 2*m;
    if (iw < .5 || ih < .5 || Math.max(iw,ih)/Math.min(iw,ih)>45000) return null;
    const pitch = Math.min(Math.min(iw, ih), Math.max(n(requested ?? p.pixel, .7, .5, 100000), Math.sqrt(iw*ih/45000)));
    const cols = Math.max(1, Math.floor(iw/pitch)), rows = Math.max(1, Math.floor(ih/pitch));
    const x = m + (iw-cols*pitch)/2, y = m + (ih-rows*pitch)/2;
    return { W, H, m, pitch, cols, rows, x, y, cx: m+iw*n(p.cx,50,0,100)/100, cy: m+ih*n(p.cy,56,0,100)/100, scale: Math.min(iw,ih)*.44*n(p.size,90,15,120)/100 };
  },
  _pixels(p, ctx, L) {
    const n = (v,d,lo,hi) => Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));
    const choices = this.params[0].options, effect = choices.includes(p.effect) ? p.effect : 'Firework';
    const cycles = Math.round(n(p.cycles,1,1,6));
    const frame = p.motion === 'Timeline' && Number.isFinite(ctx?.frameIdx) && ctx.frameCount > 1 ? ctx.frameIdx/ctx.frameCount*cycles : 0;
    const turns = n(p.phase,45,0,100)/100 + frame;
    const t = (Math.round(((turns%1+1)%1)*1e12)%1e12)/1e12;
    const { cols, rows, pitch, x:x0, y:y0, cx, cy, scale:S } = L;
    const field = new Float32Array(cols*rows), bits = new Uint8Array(cols*rows);
    if (t < .015 || t > .985) return { bits, t };
    const seed = Math.round(n(p.seed,17,-2147483648,2147483647));
    const random = (id,channel=0) => { let h = Math.imul((id|0)^seed,0x45d9f3b)^Math.imul(channel+1,0x27d4eb2d); h = Math.imul(h^(h>>>16),0x45d9f3b); return ((h^(h>>>16))>>>0)/4294967296; };
    const smooth = v => { v=Math.max(0,Math.min(1,v)); return v*v*(3-2*v); };
    const fade = smooth(t/.055)*smooth((1-t)/.18);
    const grain = n(p.grain,22,0,100)/100, wind = n(p.wind,0,-100,100)/100;
    const gravity = n(p.gravity,45,0,100)/100, smoke = n(p.smoke,65,0,100)/100;
    const count = Math.round(n(p.amount,640,80,1600)), trails = n(p.trails,60,0,100)/100;
    const put = (x,y,v=1) => { const c=Math.floor((x-x0)/pitch),r=Math.floor((y-y0)/pitch); if(c>=0&&c<cols&&r>=0&&r<rows) { const k=r*cols+c;field[k]=Math.max(field[k],v*fade); } };
    const dot = (x,y,radius=0,v=1) => {
      const X=cx+x*S,Y=cy+y*S,R=Math.max(pitch*.55,radius*S);
      put(X,Y,v);
      const c0=Math.max(0,Math.floor((X-R-x0)/pitch)),c1=Math.min(cols-1,Math.floor((X+R-x0)/pitch));
      const r0=Math.max(0,Math.floor((Y-R-y0)/pitch)),r1=Math.min(rows-1,Math.floor((Y+R-y0)/pitch));
      for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)if(Math.hypot(x0+(c+.5)*pitch-X,y0+(r+.5)*pitch-Y)<=R)put(x0+(c+.5)*pitch,y0+(r+.5)*pitch,v);
    };
    const puff = (x,y,rx,ry,strength=1,hollow=0) => {
      const X=cx+x*S,Y=cy+y*S,RX=Math.max(pitch,rx*S),RY=Math.max(pitch,ry*S);
      for(let r=Math.max(0,Math.floor((Y-RY-y0)/pitch));r<=Math.min(rows-1,Math.floor((Y+RY-y0)/pitch));r++)for(let c=Math.max(0,Math.floor((X-RX-x0)/pitch));c<=Math.min(cols-1,Math.floor((X+RX-x0)/pitch));c++) {
        const d=Math.hypot((x0+(c+.5)*pitch-X)/RX,(y0+(r+.5)*pitch-Y)/RY);
        if(d<=1) { const mottled=.22+.78*noise2(c*.19+t*1.2,r*.19-t*.6,seed+31); const edge=hollow?Math.max(.1,1-Math.abs(d-.7)/.65):Math.pow(1-d*d,.18);put(x0+(c+.5)*pitch,y0+(r+.5)*pitch,strength*edge*mottled); }
      }
    };
    const ring = (x,y,rx,ry,v=1,breaks=0) => {
      const steps=Math.max(24,Math.min(900,Math.ceil(Math.max(rx,ry)*S/pitch*8)));
      for(let i=0;i<steps;i++) { const a=i/steps*Math.PI*2; if(random(Math.floor(i/3),79)<breaks)continue;dot(x+Math.cos(a)*rx,y+Math.sin(a)*ry,0,v); }
    };
    const particle = (fn,age,id,strength=1) => {
      if(age<0||age>1||random(id,19)>smooth((1-age)/.3))return;
      const steps=Math.round(trails*14),duration=trails*.23;
      for(let k=steps;k>=0;k--) { const u=Math.max(0,age-duration*k/Math.max(1,steps)); const q=fn(u); const power=strength*(1-.7*k/Math.max(1,steps));dot(q[0],q[1],0,power); }
    };
    const firework = (time,ox=0,oy=0,shrink=1,group=0,total=count,willow=false) => {
      if(time<=0||time>=1)return;
      if(time<.2) { const u=time/.2; for(let k=0;k<10;k++) { const y=oy+(1-u)*1.1+k*.025*trails;dot(ox+wind*.08*u,y,.012,1-k*.06); } return; }
      const age=(time-.2)/.8,rays=Math.max(12,Math.round(Math.sqrt(total)*1.65));
      if(age<.2)puff(ox,oy,.18*(1-age/.2),.18*(1-age/.2),1.3);
      for(let i=0;i<total;i++) { const id=i+group*2003,angle=(i%rays)/rays*Math.PI*2+(random(id,1)-.5)*.08,speed=.32+random(id,2)*.9;
        particle(u=>{const radius=(1-Math.exp(-3.3*u))*speed*shrink;return [ox+Math.cos(angle)*radius+wind*u*u*.4,oy+Math.sin(angle)*radius+(willow?2.4: .65)*gravity*u*u];},age,id,willow?.95:1);
      }
    };
    if(effect==='Firework'||effect==='Willow')firework(t,0,0,1,0,count,effect==='Willow');
    else if(effect==='Volley')for(let j=0;j<3;j++) { const delay=j*.12;firework((t-delay)/(1-delay),[-.55,.48,0][j],[-.28,-.12,.38][j],.58,j+1,Math.ceil(count/3)); }
    else if(effect==='Mushroom cloud') {
      const u=smooth((t-.04)/.72),h=1.55*u,w=.15+.78*Math.sqrt(u),drift=wind*u*.4;
      if(t<.14)puff(0,0,.38*smooth(t/.1),.2,1.2);
      if(u>0) {
        for(let j=0;j<12;j++) { const v=j/11; puff(drift*v+.045*Math.sin(v*15-t*6)*u,-h*v,.10+.10*(1-v)*u,.13+.045*u,(.65+.4*smoke)*Math.min(1,u*5)); }
        puff(drift,-h,w*.88,.18+.07*u,(.55+.6*smoke)*Math.min(1,u*5));
        for(let j=0;j<9;j++) { const a=j/8*Math.PI,rx=Math.cos(a)*w*.78,ry=-Math.sin(a)*.18*u; puff(drift+rx,-h+ry,w*(.25+.1*random(j,2)),(.19+.12*random(j,3))*Math.sqrt(u),(.65+.55*smoke)*Math.min(1,u*5),.3); }
        puff(drift-w*.51,-h+.11,w*.43,.17+.05*u,.7+.35*smoke,.8);puff(drift+w*.51,-h+.11,w*.43,.17+.05*u,.7+.35*smoke,.8);
        ring(0,.03,Math.min(1.2,t*2),.12*u,.4+smoke*.3,.2);
      }
    } else if(effect==='Shockwave') {
      const rings=Math.round(n(p.rings,3,1,6));
      for(let j=0;j<rings;j++) { const u=(t-j*.085)/(1-j*.06); if(u>0&&u<1)ring(0,0,.06+u*1.3,.06+u*1.3,(1-u*.65),grain*.42); }
      if(t<.32)puff(0,0,.5*t,.5*t,1.4);
      for(let i=0;i<70;i++) { const a=random(i,2)*Math.PI*2,r=t*(.2+random(i,3));dot(Math.cos(a)*r,Math.sin(a)*r,0,.8*(1-t)); }
    } else if(effect==='Ground blast') {
      const u=smooth(t/.18);if(t<.25)puff(0,0,.3*u,.17*u,1.4);
      ring(0,.04,t*1.6,.04+t*.16,.9*(1-t*.7),.12);
      for(let j=0;j<9;j++)puff((j/8-.5)*t*2.3+wind*t*t*.4,-.1-t*.15,(.15+.12*random(j,3))*u,.12+.16*t,smoke*.95);
      for(let i=0;i<count;i++){const a=-Math.PI+random(i,2)*Math.PI,speed=.4+random(i,3)*1.35;particle(v=>[Math.cos(a)*speed*v*1.6+wind*v*v*.4,Math.sin(a)*speed*v*1.6+gravity*2.2*v*v],t,i);}
    } else if(effect==='Collision') {
      if(t<.3) { const u=t/.3;for(let i=0;i<count;i++){const side=i%2?1:-1,d=(1-u)*1.4+random(i,2)*.5;dot(side*d,(random(i,3)-.5)*(.06+.2*d),0,.9);} }
      else { const u=(t-.3)/.7;if(u<.2)puff(0,0,.2,.25,1.3);for(let i=0;i<count;i++){const ray=i%24,angle=(ray%2?Math.PI/2:-Math.PI/2)+(Math.floor(ray/2)/11-.5)*1.5+(random(ray,12)-.5)*.08,speed=.2+random(i,3)*1.1;particle(v=>[Math.cos(angle)*speed*v*1.6+wind*v*v*.4,Math.sin(angle)*speed*v*1.6+gravity*.5*v*v],u,i);} }
    } else if(effect==='Fountain') {
      for(let i=0;i<count;i++){const jet=i%13,birth=random(i,1)*.42,age=(t-birth)*1.5,speed=.85+random(jet+380,2)*.5,dx=(jet/12-.5)*2;particle(v=>[dx*v+wind*v*v*.4,-speed*3.2*v+(1+gravity*3.2)*v*v],age,i);}
    }
    for(let k=0;k<bits.length;k++) { const threshold=.2+grain*.43*random(k,61)+(1-grain)*.16*random(k,62);bits[k]=field[k]>threshold?1:0; }
    return { bits, t };
  },
  _paths(p,L,bits) {
    const fill=Math.max(.7,Math.min(1,(Number.isFinite(+p.fill)?+p.fill:92)/100)),pen=Math.max(0,Math.min(11,Math.round(Number.isFinite(+p.layer)?+p.layer:0)));
    const size=L.pitch*fill, inset=(L.pitch-size)/2, paths=[];
    for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++)if(bits[r*L.cols+c]) {
      let end=c+1;if(fill===1&&p.draw!=='Pixel outlines')while(end<L.cols&&bits[r*L.cols+end])end++;
      const x=L.x+c*L.pitch+inset+.15,y=L.y+r*L.pitch+inset+.15,w=(end-c-1)*L.pitch+size-.3,h=size-.3;
      if(p.draw==='Pixel outlines')paths.push({pts:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],closed:true,layer:pen});
      else { const rows=Math.max(2,Math.ceil(h/.22)+1),pts=[];for(let j=0;j<rows;j++){const yy=y+h*j/(rows-1);if(j%2)pts.push([x+w,yy],[x,yy]);else pts.push([x,yy],[x+w,yy]);}paths.push({pts,closed:false,layer:pen}); }
      c=end-1;
    }
    return {paths};
  },
  compute(_ins,p,ctx) {
    let pitch;
    for(let attempt=0;attempt<9;attempt++) {
      const L=this._layout(p,ctx,pitch);if(!L)return EMPTY;
      const {bits}=this._pixels(p,ctx,L);
      const fill=Math.max(.7,Math.min(1,(Number.isFinite(+p.fill)?+p.fill:92)/100));
      let runs=0;
      for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++)if(bits[r*L.cols+c]&&(fill!==1||p.draw==='Pixel outlines'||c===0||!bits[r*L.cols+c-1]))runs++;
      const perRun=p.draw==='Pixel outlines'?4:2*Math.max(2,Math.ceil((L.pitch*fill-.3)/.22)+1);
      if(runs*perRun>110000){pitch=L.pitch*1.45;continue;}
      const out=this._paths(p,L,bits);
      if(out.paths.reduce((n,q)=>n+q.pts.length,0)<=110000)return out;
      pitch=L.pitch*1.45;
    }
    return EMPTY;
  },
  overlay(p,ctx) { const L=this._layout(p||{},ctx);return L?[{kind:'rect',x:L.m,y:L.m,w:L.W-2*L.m,h:L.H-2*L.m},{kind:'point',x:L.cx,y:L.cy}]:[]; },
};
