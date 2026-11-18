import { Pin, EMPTY, SFONT } from "../helpers.js";

export default {
  key: 'text_roll', name: 'Text Roll', cat: 'gen', group: 'textimg',
  desc: 'Thick outlined letters scroll around a three-dimensional Drum or Ring. Contour slices reveal the solid letter depth, while Hidden lines removes ink behind the actual letters, including their counters and side walls. There is no opaque background cylinder. Edit Text, Weight, Letter height, Radius, Arc and Repeats; Wave and Twist distort the travelling letters. Scroll makes full turns, Rock sways, Tumble turns the whole sculpture. Manual Phase freezes a pose; Timeline follows ANIMATE Play with whole Loops and an exact repeating endpoint. Hidden lines off shows the back contours too. Framing stays fixed through the loop. Uppercase plotter capitals include ÄÖÅ; unsupported characters become ?. Up to 64 input characters and four repeats; excessive density is reduced uniformly or refused whole. Output is ordinary XY ink for SVG, G-code and receipt animation exports. The apparent depth never becomes machine Z.',
  ins: [], outs: [Pin('paths', 'Text')],
  params: [
    {key:'text',label:'Text',type:'text',def:'MUUSIA'},
    {key:'surface',label:'Roll shape',type:'select',options:['Drum','Ring'],def:'Drum'},
    {key:'motion',label:'Movement',type:'select',options:['Scroll','Rock','Tumble'],def:'Scroll'},
    {key:'time',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual'},
    {key:'phase',label:'Phase °',type:'slider',min:0,max:360,step:1,def:30},
    {key:'cycles',label:'Loops per timeline',type:'slider',min:0,max:4,step:1,def:1,showIf:p=>p.time==='Timeline'},
    {key:'direction',label:'Direction',type:'select',options:['Forward','Reverse'],def:'Forward'},
    {key:'arc',label:'Arc °',type:'slider',min:90,max:360,step:1,def:330},
    {key:'repeat',label:'Repeats',type:'slider',min:1,max:4,step:1,def:1},
    {key:'font',label:'Letter shape',type:'select',options:['Round','Block'],def:'Round'},
    {key:'weight',label:'Weight %',type:'slider',min:8,max:42,step:1,def:24},
    {key:'tracking',label:'Tracking',type:'slider',min:.6,max:2,step:.05,def:1},
    {key:'height',label:'Letter height %',type:'slider',min:50,max:280,step:1,def:230},
    {key:'radius',label:'Radius %',type:'slider',min:60,max:200,step:1,def:85},
    {key:'depth',label:'Letter depth %',type:'slider',min:0,max:120,step:1,def:65},
    {key:'slices',label:'Contour slices',type:'slider',min:2,max:48,step:1,def:20,showIf:p=>+p.depth!==0},
    {key:'wave',label:'Wave %',type:'slider',min:0,max:45,step:1,def:12},
    {key:'waves',label:'Waves around roll',type:'slider',min:1,max:6,step:1,def:3,showIf:p=>+p.wave>0},
    {key:'twist',label:'Twist °',type:'slider',min:-180,max:180,step:1,def:-20},
    {key:'yaw',label:'View angle °',type:'slider',min:-180,max:180,step:1,def:-25},
    {key:'elevation',label:'View elevation °',type:'slider',min:-80,max:80,step:1,def:24},
    {key:'roll',label:'View roll °',type:'slider',min:-180,max:180,step:1,def:-10},
    {key:'perspective',label:'Perspective',type:'slider',min:0,max:1,step:.05,def:.25},
    {key:'hidden',label:'Hidden lines',type:'check',def:true},
    {key:'size',label:'Size %',type:'slider',min:10,max:100,step:1,def:95},
    {key:'margin',label:'Margin mm',type:'slider',min:0,max:40,step:1,def:5},
    {key:'layer',label:'Pen',type:'pen',def:0},
  ],
  _n(v,d,lo,hi){return Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));},
  _glyph(ch,p,cell){
    const weight=this._n(p.weight,24,8,42),square=p.font==='Block',key=[ch,weight,square,cell].join(':');
    if(!this._glyphCache)this._glyphCache=new Map();
    if(this._glyphCache.has(key))return this._glyphCache.get(key);
    const glyph=SFONT[ch]||SFONT['?'],r=weight/20,segs=[],points=glyph.s.flat();
    if(!points.length)return {width:glyph.w,triangles:[],loops:[],extentY:.5};
    for(const s of glyph.s)for(let j=1;j<s.length;j++)segs.push([s[j-1],s[j]]);
    const minX=Math.min(...points.map(q=>q[0])),maxX=Math.max(...points.map(q=>q[0])),minY=Math.min(...points.map(q=>q[1])),maxY=Math.max(...points.map(q=>q[1]));
    const x0=minX-r-cell-.000071,y0=minY-r-cell-.000071,cols=Math.ceil((maxX-minX+2*r+2*cell)/cell),rows=Math.ceil((maxY-minY+2*r+2*cell)/cell);
    const values=new Float32Array((cols+1)*(rows+1));
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
      const X=x0+x*cell,Y=y0+y*cell;let d=100;
      for(const [a,b]of segs){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((X-a[0])*dx+(Y-a[1])*dy)/(dx*dx+dy*dy||1)));const xx=X-a[0]-t*dx,yy=Y-a[1]-t*dy;d=Math.min(d,(square?Math.max(Math.abs(xx),Math.abs(yy)):Math.hypot(xx,yy))-r);}
      values[y*(cols+1)+x]=d;
    }
    const triangles=[],edges=[];
    const clip=tri=>{
      const poly=[],cross=[];
      for(let j=0;j<3;j++){
        const a=tri[j],b=tri[(j+1)%3];if(a[2]<0)poly.push(a.slice(0,2));
        if((a[2]<0)!==(b[2]<0)){const t=a[2]/(a[2]-b[2]),q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];poly.push(q);cross.push(q);}
      }
      for(let j=1;j<poly.length-1;j++)triangles.push([poly[0],poly[j],poly[j+1]]);
      if(cross.length===2&&Math.hypot(cross[0][0]-cross[1][0],cross[0][1]-cross[1][1])>1e-8)edges.push(cross);
    };
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const point=(a,b)=>[x0+a*cell,y0+b*cell,values[b*(cols+1)+a]],a=point(x,y),b=point(x+1,y),c=point(x+1,y+1),d=point(x,y+1);clip([a,b,c]);clip([a,c,d]);
    }
    const pointKey=q=>Math.round(q[0]*1e6)+','+Math.round(q[1]*1e6),ends=new Map(),used=new Uint8Array(edges.length),loops=[];
    edges.forEach((e,i)=>e.forEach(q=>{const k=pointKey(q);if(!ends.has(k))ends.set(k,[]);ends.get(k).push(i);}));
    for(let i=0;i<edges.length;i++)if(!used[i]){
      const pts=[...edges[i]];used[i]=1;let closed=false;
      for(let guard=0;guard<edges.length;guard++){
        const tip=pointKey(pts.at(-1));if(tip===pointKey(pts[0])){pts.pop();closed=true;break;}
        const next=(ends.get(tip)||[]).find(j=>!used[j]);if(next===undefined)break;used[next]=1;
        const e=edges[next];pts.push(pointKey(e[0])===tip?e[1]:e[0]);
      }
      if(!closed)return null;
      if(pts.length>=3)loops.push(pts);
    }
    if(segs.length&&!loops.length)return null;
    const extentY=Math.max(.5,...glyph.s.flat().map(q=>Math.abs(5-q[1])/10))+r/10;
    const result={width:glyph.w,triangles,loops,extentY};
    if(this._glyphCache.size>=96)this._glyphCache.clear();this._glyphCache.set(key,result);return result;
  },
  _scene(p,ctx,cell=.42,requestedSlices){
    const input=String(p.text??'MUUSIA');if(input.length>128)return null;
    const text=input.toUpperCase().replace(/[|\n\r\t]/g,' '),chars=Array.from(text);
    if(!chars.length||chars.length>64||!text.trim())return null;
    const copies=Math.round(this._n(p.repeat,1,1,4)),gap=2.5*this._n(p.tracking,1,.6,2),items=[];let width=0,verts=0,triCount=0;
    for(let k=0;k<copies;k++)for(const char of chars.concat(k<copies-1?[' ']:[])){
      const ch=SFONT[char]?char:'?',g=this._glyph(ch,p,cell);if(!g)return null;
      items.push({g,x:width});width+=g.width+gap;verts+=g.loops.reduce((n,q)=>n+q.length,0);triCount+=g.triangles.length*2+g.loops.reduce((n,q)=>n+q.length*2,0);
    }
    if(!verts||triCount>100000)return null;
    const depth=this._n(p.depth,65,0,120)/100,slices=depth===0?1:Math.max(2,Math.min(Math.round(this._n(requestedSlices??p.slices,20,2,48)),Math.floor(70000/verts)));
    if(slices*verts>90000)return null;
    const TAU=Math.PI*2,cycles=Math.round(this._n(p.cycles,1,0,4)),frame=p.time==='Timeline'&&Number.isFinite(ctx?.frameIdx)&&ctx.frameCount>1?ctx.frameIdx/ctx.frameCount*cycles:0;
    const turn=this._n(p.phase,30,-36000,36000)/360+frame,t=(Math.round(((turn%1+1)%1)*1e12)%1e12)/1e12,sign=p.direction==='Reverse'?-1:1;
    const angle=sign*TAU*(p.motion==='Rock'?.19*Math.sin(t*TAU):p.motion==='Tumble'?0:t),tumble=p.motion==='Tumble'?sign*t*TAU:0;
    const height=this._n(p.height,230,50,280)/100,wave=this._n(p.wave,12,0,45)/100,waves=Math.round(this._n(p.waves,3,1,6));
    const glyphExtent=Math.max(...items.map(q=>q.g.extentY));
    const radius=Math.max(this._n(p.radius,85,60,200)/100,p.surface==='Ring'?height*glyphExtent+.15:depth/2+.15);
    const arc=this._n(p.arc,330,90,360)*Math.PI/180,twist=this._n(p.twist,-20,-180,180)*Math.PI/180,pad=this._n(p.weight,24,8,42)/20;
    const transform=(item,q,d)=>{
      const v=(5-q[1])/10*height,a=((item.x+q[0]+pad)/(width-gap+pad*2)-.5)*arc+angle+twist*v/height;
      const w=wave*Math.sin(waves*a),r=p.surface==='Ring'?radius+v+wave*.2*Math.cos(waves*a):radius+d+wave*.15*Math.cos(waves*a);
      const x=r*Math.sin(a),y=p.surface==='Ring'?d+w*.4:v+w*.4,z=r*Math.cos(a);
      return [x,y*Math.cos(tumble)-z*Math.sin(tumble),y*Math.sin(tumble)+z*Math.cos(tumble)];
    };
    const paths=[],triangles=[];
    for(const item of items){
      for(const loop of item.g.loops){
        for(let s=0;s<slices;s++){const d=slices===1?0:(s/(slices-1)-.5)*depth;paths.push(loop.map(q=>transform(item,q,d)));}
        if(depth>0)for(let i=0;i<loop.length;i++){
          const q=loop[i],n=loop[(i+1)%loop.length],a=transform(item,q,-depth/2),b=transform(item,n,-depth/2),c=transform(item,n,depth/2),d=transform(item,q,depth/2);triangles.push([a,b,c],[a,c,d]);
        }
      }
      for(const tri of item.g.triangles){triangles.push(tri.map(q=>transform(item,q,depth/2)));if(depth>0)triangles.push(tri.map(q=>transform(item,q,-depth/2)));}
    }
    const radial=radius+(p.surface==='Ring'?height*glyphExtent:depth/2)+wave*.2;
    const vertical=(p.surface==='Ring'?depth/2:height*glyphExtent)+wave*.4;
    return {paths,triangles,slices,t,radial,vertical,bound:Math.hypot(radial,vertical)};
  },
  _camera(p,ctx,scene){
    const {bound,radial,vertical}=scene;
    const W=this._n(ctx?.W,0,0,100000),H=this._n(ctx?.H,0,0,100000),m=this._n(p.margin,5,0,100000);
    if(W-2*m<1||H-2*m<1)return null;
    const perspective=this._n(p.perspective,.25,0,1),focal=bound*(8-5*perspective);
    const yaw=this._n(p.yaw,-25,-180,180)*Math.PI/180,el=this._n(p.elevation,24,-80,80)*Math.PI/180,roll=this._n(p.roll,-10,-180,180)*Math.PI/180;
    const view=q=>{
      const x=q[0]*Math.cos(yaw)+q[2]*Math.sin(yaw),z=-q[0]*Math.sin(yaw)+q[2]*Math.cos(yaw),y=q[1]*Math.cos(el)-z*Math.sin(el),zz=q[1]*Math.sin(el)+z*Math.cos(el);
      const xx=x*Math.cos(roll)-y*Math.sin(roll),yy=x*Math.sin(roll)+y*Math.cos(roll),k=perspective?focal/(focal-zz):1;
      return [xx*k,-yy*k,perspective?1/(focal-zz):zz];
    };
    // This envelope covers every text angle, so empty glyph gaps never refit the
    // view. Tumble uses the full rotation sphere; the other modes use a cylinder.
    let lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
    if(p.motion==='Tumble'){const e=bound*(perspective?focal/(focal-bound):1);lo=[-e,-e];hi=[e,e];}
    else for(let i=0;i<192;i++)for(const y of [-vertical,vertical]){
      const a=i/192*Math.PI*2,q=view([Math.sin(a)*radial,y,Math.cos(a)*radial]);
      for(let k=0;k<2;k++){lo[k]=Math.min(lo[k],q[k]);hi[k]=Math.max(hi[k],q[k]);}
    }
    const mid=lo.map((v,k)=>(v+hi[k])/2),extent=hi.map((v,k)=>(v-lo[k])*.51);
    const scale=Math.min((W-2*m-.3)/(2*extent[0]),(H-2*m-.3)/(2*extent[1]))*this._n(p.size,95,10,100)/100;
    return {W,H,m,extent,scale,perspective,focal,project:q=>{const v=view(q);return [W/2+(v[0]-mid[0])*scale,H/2+(v[1]-mid[1])*scale,v[2]];}};
  },
  _render(p,scene,camera){
    const {W,H,scale,extent,perspective,focal}=camera,pen=Math.round(this._n(p.layer,0,0,11)),hidden=p.hidden!==false;
    const span=Math.max(...extent)*scale*2,pixel=span/420,ox=W/2-span/2,oy=H/2-span/2,res=420,buffer=hidden?new Float32Array(res*res).fill(-Infinity):null;
    const tris=hidden?scene.triangles.map(t=>t.map(camera.project)):[];
    let rasterWork=0;
    for(const [a,b,c]of tris){
      const x0=Math.max(0,Math.floor((Math.min(a[0],b[0],c[0])-ox)/pixel)),x1=Math.min(res-1,Math.ceil((Math.max(a[0],b[0],c[0])-ox)/pixel));
      const y0=Math.max(0,Math.floor((Math.min(a[1],b[1],c[1])-oy)/pixel)),y1=Math.min(res-1,Math.ceil((Math.max(a[1],b[1],c[1])-oy)/pixel));
      rasterWork+=(x1-x0+1)*(y1-y0+1);if(rasterWork>18000000)return null;
      const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)<1e-12)continue;
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const X=ox+(x+.5)*pixel,Y=oy+(y+.5)*pixel,u=((b[0]-X)*(c[1]-Y)-(b[1]-Y)*(c[0]-X))/area,v=((c[0]-X)*(a[1]-Y)-(c[1]-Y)*(a[0]-X))/area,w=1-u-v;
        if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8){const i=y*res+x;buffer[i]=Math.max(buffer[i],u*a[2]+v*b[2]+w*c[2]);}
      }
    }
    const projected=scene.paths.map(q=>q.map(camera.project));
    let samples=0;for(const q of projected)for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];samples+=hidden?Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/(pixel*.7))):1;}
    if(samples+projected.length*2>115000)return null;
    if(!hidden)return {paths:projected.map(pts=>({pts:pts.map(q=>q.slice(0,2)),closed:true,layer:pen}))};
    const tolerance=perspective?.012*scene.bound/(focal-scene.bound)**2:.012*scene.bound;
    const visible=q=>{const x=Math.floor((q[0]-ox)/pixel),y=Math.floor((q[1]-oy)/pixel);return x<0||y<0||x>=res||y>=res||q[2]>=buffer[y*res+x]-tolerance;};
    const paths=[];
    for(const q of projected){
      let run=[],all=true;const runs=[];
      const flush=()=>{if(run.length>=2)runs.push(run);run=[];};
      for(let i=0;i<q.length;i++){
        const a=q[i],b=q[(i+1)%q.length],steps=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/(pixel*.7)));
        for(let j=0;j<steps;j++){
          const t=j/steps,v=a.map((x,k)=>x+(b[k]-x)*t);
          if(visible(v)){const last=run.at(-1);if(!last||Math.hypot(last[0]-v[0],last[1]-v[1])>1e-9)run.push(v.slice(0,2));}else{all=false;flush();}
        }
      }
      flush();
      if(all&&runs.length===1){paths.push({pts:runs[0],closed:true,layer:pen});continue;}
      if(runs.length>1&&visible(q[0])){runs[0]=runs.at(-1).concat(runs[0]);runs.pop();}
      for(const pts of runs)paths.push({pts,closed:false,layer:pen});
    }
    return {paths};
  },
  compute(_ins,p,ctx){
    for(let attempt=0;attempt<5;attempt++){
      const scene=this._scene(p,ctx,.42*Math.pow(1.32,attempt),Math.max(2,this._n(p.slices,20,2,48)/Math.pow(1.7,attempt)));
      if(!scene)continue;const camera=this._camera(p,ctx,scene);if(!camera)return EMPTY;
      const result=this._render(p,scene,camera);if(result&&result.paths.reduce((n,q)=>n+q.pts.length,0)<=120000)return result;
    }
    return EMPTY;
  },
  overlay(p,ctx){
    const W=this._n(ctx?.W,0,0,100000),H=this._n(ctx?.H,0,0,100000),m=this._n(p?.margin,5,0,100000),size=this._n(p?.size,95,10,100)/100,w=Math.max(0,W-2*m-.3)*size,h=Math.max(0,H-2*m-.3)*size;
    return w>0&&h>0?[{kind:'rect',x:(W-w)/2,y:(H-h)/2,w,h},{kind:'point',x:W/2,y:H/2}]:[];
  },
};
