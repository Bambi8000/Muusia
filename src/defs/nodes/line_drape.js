import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "line_drape", name: "Line Drape", cat: "mod", group: "deform",
  desc: "A parallel line field bends through your text or drawing. Connect vector text, outlines or any pen paths to Shape. Filled closed shapes use even-odd holes per pen; open paths always use Stroke width. Turn Fill closed shapes off to treat every path as a stroke. Orientation rotates the background lines; Bend angle sets the direction inside the shape, relative to Orientation. Strength blends the two fields, Softness rounds the transition, and Shift slides the inside field across the outside field. The source defines a mask and is not drawn. Pitch is measured perpendicular to straight background lines; curved transition bands can be closer together. Phase shifts the contour levels and accepts animation wires. Pens cycles complete levels from the base pen. Detail is the requested raster cell size, so very thin features may disappear. Dense jobs uniformly coarsen Detail or Pitch instead of dropping part of the page. At most 120k source points / 30k paths are accepted. All output stays inside Margin. Empty input gives the straight field. Try Type Studio Contour type or Hershey Text with a wider Stroke width.",
  ins: [Pin("paths", "Shape"), Pin("style", "Style")], outs: [Pin("paths")],
  params: [
    {key:"angle",label:"Orientation °",type:"slider",min:-180,max:180,step:1,def:0},
    {key:"bend",label:"Bend angle °",type:"slider",min:-80,max:80,step:1,def:-42},
    {key:"strength",label:"Strength %",type:"slider",min:0,max:100,step:1,def:100},
    {key:"soft",label:"Softness mm",type:"slider",min:0,max:25,step:.5,def:4},
    {key:"shift",label:"Shift mm",type:"slider",min:-100,max:100,step:.5,def:0},
    {key:"pitch",label:"Line pitch mm",type:"slider",min:.5,max:12,step:.1,def:1.8},
    {key:"phase",label:"Phase mm",type:"slider",min:0,max:12,step:.1,def:0},
    {key:"fill",label:"Fill closed shapes",type:"check",def:true},
    {key:"stroke",label:"Stroke width mm",type:"slider",min:.5,max:30,step:.5,def:6},
    {key:"cell",label:"Detail mm",type:"slider",min:.4,max:3,step:.1,def:.8},
    {key:"pens",label:"Pens",type:"slider",min:1,max:6,step:1,def:1},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:12},
    {key:"layer",label:"Pen",type:"pen",def:0}
  ],
  overlay(p,ctx) {
    if(!(ctx?.W>0&&ctx?.H>0))return [];
    const m=Math.max(0,Math.min(Number(p.margin)||0,Math.min(ctx.W,ctx.H)/2)),a=(Number(p.angle)||0)*Math.PI/180,L=Math.min(25,(Math.min(ctx.W,ctx.H)-2*m)/3);
    return [{kind:"rect",x:m,y:m,w:ctx.W-2*m,h:ctx.H-2*m},{kind:"arrow",x1:ctx.W/2,y1:ctx.H/2,x2:ctx.W/2+Math.cos(a)*L,y2:ctx.H/2+Math.sin(a)*L}];
  },
  compute(ins,p,ctx) {
    const W=Number(ctx?.W),H=Number(ctx?.H);if(!(W>0&&H>0&&isFinite(W)&&isFinite(H)))return EMPTY;
    const num=(k,d,a,b)=>Math.max(a,Math.min(b,Number.isFinite(+p[k])?+p[k]:d));
    const m=num("margin",12,0,Math.min(W,H)/2),fw=W-2*m,fh=H-2*m;if(fw<1||fh<1)return EMPTY;
    const paths=ins?.[0]?.paths||[];if(paths.length>30000||paths.reduce((n,q)=>n+(q.pts?.length||0),0)>120000)return EMPTY;
    // Uniformly bounded raster; every source component contributes to the mask.
    const cell=Math.max(num("cell",.8,.4,3),Math.sqrt(fw*fh/100000));
    const nx=Math.max(2,Math.ceil(fw/cell)),ny=Math.max(2,Math.ceil(fh/cell)),sx=fw/nx,sy=fh/ny,stride=nx+1;
    let mask=new Float64Array(stride*(ny+1));
    const stroke=num("stroke",6,.5,30)/2,segments=[],polys=new Map();
    for(const q of paths){
      const pts=(q.pts||[]).filter(v=>Array.isArray(v)&&Number.isFinite(v[0])&&Number.isFinite(v[1]));if(pts.length<2)continue;
      const filled=p.fill!==false&&q.closed&&pts.length>=3;
      if(filled){const L=Number.isFinite(q.layer)?q.layer:0;if(!polys.has(L))polys.set(L,[]);polys.get(L).push(pts);}
      else for(let j=1;j<pts.length+(q.closed?1:0);j++)segments.push([pts[j-1],pts[j%pts.length]]);
    }
    // Scan-convert closed polygons with parity, separately per pen, then union.
    for(const list of polys.values()){
      const hits=Array.from({length:ny+1},()=>[]);
      for(const pts of list)for(let j=0;j<pts.length;j++){
        const a=pts[j],b=pts[(j+1)%pts.length];if(a[1]===b[1])continue;
        const lo=Math.max(0,Math.ceil((Math.min(a[1],b[1])-m)/sy)),hi=Math.min(ny,Math.ceil((Math.max(a[1],b[1])-m)/sy)-1);
        for(let y=lo;y<=hi;y++){const yy=m+y*sy;hits[y].push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      }
      for(let y=0;y<=ny;y++){const row=hits[y].sort((a,b)=>a-b);for(let j=0;j+1<row.length;j+=2){const a=Math.max(0,Math.ceil((row[j]-m)/sx)),b=Math.min(nx,Math.floor((row[j+1]-m)/sx));for(let x=a;x<=b;x++)mask[y*stride+x]=1;}}
    }
    // Stroke capsules are rasterized directly, keeping arbitrary open paths.
    for(const [a,b] of segments){
      const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
      const yl=Math.max(0,Math.ceil((Math.min(a[1],b[1])-stroke-m)/sy)),yr=Math.min(ny,Math.floor((Math.max(a[1],b[1])+stroke-m)/sy));
      const xl=Math.max(0,Math.ceil((Math.min(a[0],b[0])-stroke-m)/sx)),xr=Math.min(nx,Math.floor((Math.max(a[0],b[0])+stroke-m)/sx));
      for(let y=yl;y<=yr;y++){const yy=m+y*sy,centre=Math.abs(dy)>1e-10?a[0]+(yy-a[1])*dx/dy:0,half=Math.abs(dy)>1e-10?stroke*Math.sqrt(len)/Math.abs(dy):Infinity;
      const left=Math.max(xl,Math.ceil((centre-half-m)/sx)),right=Math.min(xr,Math.floor((centre+half-m)/sx));
      for(let x=left;x<=right;x++){const xx=m+x*sx,yy=m+y*sy,t=len?Math.max(0,Math.min(1,((xx-a[0])*dx+(yy-a[1])*dy)/len)):0;if((xx-a[0]-t*dx)**2+(yy-a[1]-t*dy)**2<=stroke*stroke)mask[y*stride+x]=1;}}
    }
    // Three separable box filters approximate a smooth Gaussian edge, O(cells).
    const soft=num("soft",4,0,25);
    const blur=(data,r,horizontal)=>{
      if(r<1)return data;const out=new Float64Array(data.length),N=horizontal?nx:ny,rows=horizontal?ny:nx,at=(x,y)=>horizontal?y*stride+x:x*stride+y;
      for(let y=0;y<=rows;y++){let sum=0;for(let k=-r;k<=r;k++)sum+=data[at(Math.max(0,Math.min(N,k)),y)];for(let x=0;x<=N;x++){out[at(x,y)]=sum/(2*r+1);sum+=data[at(Math.min(N,x+r+1),y)]-data[at(Math.max(0,x-r),y)];}}return out;
    };
    if(soft>0)for(let i=0;i<3;i++){mask=blur(mask,Math.max(1,Math.round(soft/sx)),true);mask=blur(mask,Math.max(1,Math.round(soft/sy)),false);}
    const a=num("angle",0,-3600,3600)*Math.PI/180,b=num("bend",-42,-80,80)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),strength=num("strength",100,0,100)/100,shift=num("shift",0,-100,100);
    const field=new Float64Array(mask.length);
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const X=m+x*sx-W/2,Y=m+y*sy-H/2,u=X*ca+Y*sa,v=-X*sa+Y*ca,w=mask[y*stride+x]*strength;field[y*stride+x]=v+w*(v*cb-u*sb+shift-v);}
    const basePen=Math.round(num("layer",0,0,11)),pens=Math.round(num("pens",1,1,6));
    // March all intersecting levels in each cell, not the whole page per level.
    for(let attempt=0;attempt<10;attempt++){
      const pitch=num("pitch",1.8,.5,12)*Math.pow(1.6,attempt),phase=((num("phase",0,-1e6,1e6)%pitch)+pitch)%pitch,levels=new Map();let count=0,over=false;
      scan:for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
        const v=[field[y*stride+x],field[y*stride+x+1],field[(y+1)*stride+x+1],field[(y+1)*stride+x]],lo=Math.min(...v),hi=Math.max(...v);
        for(let k=Math.ceil((lo-phase)/pitch);k<=Math.floor((hi-phase)/pitch);k++){
          const h=phase+k*pitch,index=(v[0]>h?8:0)+(v[1]>h?4:0)+(v[2]>h?2:0)+(v[3]>h?1:0);if(!index||index===15)continue;
          const edge=(id)=>{const pairs=[[0,1],[1,2],[3,2],[0,3]],coords=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],i=pairs[id][0],j=pairs[id][1],t=(h-v[i])/(v[j]-v[i]);return [m+(coords[i][0]+(coords[j][0]-coords[i][0])*t)*sx,m+(coords[i][1]+(coords[j][1]-coords[i][1])*t)*sy];};
          let pairs;
          if(index===1||index===14)pairs=[[3,2]];else if(index===2||index===13)pairs=[[2,1]];else if(index===3||index===12)pairs=[[3,1]];else if(index===4||index===11)pairs=[[0,1]];else if(index===6||index===9)pairs=[[0,2]];else if(index===7||index===8)pairs=[[0,3]];
          else{const q=(v[0]-h)*(v[2]-h)-(v[1]-h)*(v[3]-h);pairs=q>0?[[0,1],[2,3]]:[[0,3],[2,1]];}
          if(!levels.has(k))levels.set(k,[]);for(const [i,j] of pairs){const A=edge(i),B=edge(j);if(Math.hypot(A[0]-B[0],A[1]-B[1])<1e-9)continue;levels.get(k).push([A,B]);if(++count>85000){over=true;break scan;}}
        }
      }
      if(over)continue;
      const result=[];
      for(const [k,segs] of [...levels].sort((a,b)=>a[0]-b[0])){
        const key=q=>q.map(v=>Math.round(v*1e6)).join(','),adj=new Map(),used=new Uint8Array(segs.length),layer=(basePen+((k%pens)+pens)%pens)%12;
        segs.forEach((s,i)=>s.forEach(q=>{const id=key(q);if(!adj.has(id))adj.set(id,[]);adj.get(id).push(i);}));
        const walk=(i,start)=>{const pts=[start],first=key(start);let tail=first;while(!used[i]){used[i]=1;const q=segs[i],next=key(q[0])===tail?q[1]:q[0];pts.push(next);tail=key(next);const j=(adj.get(tail)||[]).find(j=>!used[j]);if(j===undefined)break;i=j;}const closed=tail===first;if(closed)pts.pop();if(pts.length>=(closed?3:2)){
          const compact=[];for(const q of pts){while(compact.length>=2){const a=compact[compact.length-2],b=compact[compact.length-1],dx=q[0]-a[0],dy=q[1]-a[1];if(Math.abs((b[0]-a[0])*dy-(b[1]-a[1])*dx)>1e-9*Math.max(1,Math.hypot(dx,dy))||(b[0]-a[0])*(q[0]-b[0])+(b[1]-a[1])*(q[1]-b[1])<0)break;compact.pop();}compact.push(q);}result.push({pts:compact,closed,layer});}};
        for(const [id,ids] of adj)if(ids.length!==2)for(const i of ids)if(!used[i])walk(i,segs[i].find(q=>key(q)===id));for(let i=0;i<segs.length;i++)if(!used[i])walk(i,segs[i][0]);
      }
      const styled=applyStyle({paths:result},ins?.[1]);if(styled.paths.reduce((n,q)=>n+q.pts.length,0)<=118000)return styled;
    }
    return EMPTY;
  }
};
