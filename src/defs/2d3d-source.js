// Path intake for surface builders. Typography is already real vector data;
// preserve every stroke, including small closed glyph loops, rather than
// treating a dense drawing as invalid or keeping only its first few letters.
export function surfaceSource(input) {
  if(!Array.isArray(input?.paths))return null;
  const paths=[];
  let count=0,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const q of input?.paths||[]) {
    if(!Array.isArray(q.pts)||q.pts.length<2)continue;
    if(paths.length>=30000)return null;
    const pts=[];
    for(const pt of q.pts){
      if(!Array.isArray(pt)||pt.length<2||!pt.slice(0,2).every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e9))return null;
      if(++count>120000)return null;
      if(!pts.length||pt[0]!==pts.at(-1)[0]||pt[1]!==pts.at(-1)[1])pts.push(pt.slice(0,2));
    }
    if(q.closed&&pts.length>2&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();
    if(pts.length<2)continue;
    paths.push({pts,closed:!!q.closed&&pts.length>2});
    for(const [x,y] of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  }
  const span=Math.max(x1-x0,y1-y0);
  if(!paths.length||!(span>1e-8))return null;
  const cx=(x0+x1)/2,cy=(y0+y1)/2;
  for(const q of paths)q.pts=q.pts.map(([x,y])=>[(x-cx)/span,(y-cy)/span]);
  return {paths,span,width:(x1-x0)/span,height:(y1-y0)/span};
}

export function surfaceTrack(q) {
  // Sub-quantization curve samples need not consume whole tube rings. Keep
  // actual letter corners, and remove only deviations below 0.00002 of span.
  const raw=q.closed?[...q.pts,q.pts[0]]:q.pts,keep=new Set([0,raw.length-1]),stack=[[0,raw.length-1]];
  while(stack.length){
    const [a,b]=stack.pop(),A=raw[a],B=raw[b],dx=B[0]-A[0],dy=B[1]-A[1],len=dx*dx+dy*dy;
    let best=4e-10,index=-1;
    for(let i=a+1;i<b;i++){
      const v=raw[i],f=len?Math.max(0,Math.min(1,((v[0]-A[0])*dx+(v[1]-A[1])*dy)/len)):0,d=(v[0]-A[0]-dx*f)**2+(v[1]-A[1]-dy*f)**2;
      if(d>best){best=d;index=i;}
    }
    if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
  }
  const pts=raw.filter((_,i)=>keep.has(i)),knots=[0];
  for(let i=1;i<pts.length;i++)knots.push(knots.at(-1)+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  let j=1;
  return {closed:q.closed,knots,length:knots.at(-1),at(t){while(j<knots.length-1&&knots[j]<t)j++;const a=pts[j-1],b=pts[j],f=(t-knots[j-1])/(knots[j]-knots[j-1]||1);return a.map((v,k)=>v+(b[k]-v)*f);}};
}

// Allocate tessellation to the complete source. Minimum rings and caps must
// be reserved before distributing extra samples to long strokes.
export function surfaceSamples(tracks, step, sides, caps) {
  const minima=tracks.map(t=>Math.max(t.closed?3:1,t.knots?t.knots.length-1:1)),wanted=tracks.map((t,i)=>Math.max(minima[i],Math.ceil(t.length/step)));
  const capCount=caps?tracks.filter(t=>!t.closed).length:0;
  const budget=Math.floor(118000/(2*sides))-capCount;
  const minimum=minima.reduce((a,b)=>a+b,0);
  if(minimum>budget)return null;
  const total=wanted.reduce((a,b)=>a+b,0);
  if(total<=budget)return wanted;
  const extra=budget-minimum,requested=total-minimum;
  return minima.map((n,i)=>n+Math.floor((wanted[i]-n)*extra/requested));
}

export function surfaceCenters(t, segments) {
  if(!t.knots)return Array.from({length:segments+(t.closed?0:1)},(_,j)=>t.at(t.length*j/segments));
  const extra=segments-(t.knots.length-1),counts=[];
  for(let i=1;i<t.knots.length;i++)counts.push(1+Math.floor(extra*(t.knots[i]-t.knots[i-1])/t.length));
  // Fractions may leave some budget unused; do not overshoot the shared cap.
  const out=[];
  for(let i=0;i<counts.length;i++)for(let j=0;j<counts[i];j++)out.push(t.at(t.knots[i]+(t.knots[i+1]-t.knots[i])*j/counts[i]));
  if(!t.closed)out.push(t.at(t.length));
  return out;
}

// A stroked font is not a filled polygon. Sweep its actual pen trajectories
// into independent rounded/rectangular strips, keeping closed loops hollow.
// Overlapping strips remain separate solids, just like intersecting Tubes.
export function strokeSurface(src, mode, width, depth, back, roundness=1, detail=44) {
  const radius=width/src.span/2,round=mode==='Inflate',sides=round?8:4;
  if(radius<.0003)return null;
  const tracks=src.paths.map(surfaceTrack);
  // Preserve existing curve vertices and add samples along long straight runs.
  const step=Math.max(radius*.8*44/detail,.0004),counts=surfaceSamples(tracks,step,sides,true);
  if(!counts)return null;
  const vertices=[],faces=[],gridEdges=[];
  tracks.forEach((t,ti)=>{
    const centers=surfaceCenters(t,counts[ti]),count=centers.length,segments=count-(t.closed?0:1),start=vertices.length;
    for(let j=0;j<count;j++){
      const a=centers[j===0?(t.closed?count-1:0):j-1],b=centers[j===count-1?(t.closed?0:count-1):j+1];
      let dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(len<1e-10){const b=centers[(j+1)%count];dx=b[0]-centers[j][0];dy=b[1]-centers[j][1];len=Math.hypot(dx,dy)||1;}
      if(depth===0){for(const u of [1,-1])vertices.push([centers[j][0]-dy/len*radius*u,centers[j][1]+dx/len*radius*u,0]);continue;}
      for(let k=0;k<sides;k++){
        const [u,v]=round?[Math.cos(k/sides*Math.PI*2),Math.sin(k/sides*Math.PI*2)]:[[1,1],[-1,1],[-1,-1],[1,-1]][k];
        const height=Math.sign(v)*Math.pow(Math.abs(v),1/roundness);
        const z=round&&back==='Flat'?Math.max(0,height)*depth:(round?height:v)*depth/2;
        vertices.push([centers[j][0]-dy/len*radius*u,centers[j][1]+dx/len*radius*u,z]);
      }
    }
    if(depth===0){
      const id=(j,k)=>start+(j%count)*2+k;
      for(let j=0;j<segments;j++){const a=id(j,0),b=id(j+1,0),c=id(j+1,1),d=id(j,1);faces.push([a,c,b],[a,d,c]);gridEdges.push([a,b,'stroke:'+ti+':rail:0',0],[d,c,'stroke:'+ti+':rail:1',1]);}
      return;
    }
    const id=(j,k)=>start+(j%count)*sides+(k%sides);
    for(let j=0;j<segments;j++)for(let k=0;k<sides;k++){
      const a=id(j,k),b=id(j+1,k),c=id(j+1,k+1),d=id(j,k+1);faces.push([a,c,b],[a,d,c]);gridEdges.push([a,b,'stroke:'+ti+':rail:'+k,k]);
    }
    for(let j=0;j<count;j++)for(let k=0;k<sides;k++)gridEdges.push([id(j,k),id(j,k+1),'stroke:'+ti+':ring:'+j,j]);
    if(!t.closed){
      const a=vertices.length,b=a+1;vertices.push([...centers[0],round&&back==='Flat'?depth/3:0],[...centers.at(-1),round&&back==='Flat'?depth/3:0]);
      for(let k=0;k<sides;k++)faces.push([a,id(0,k+1),id(0,k)],[b,id(count-1,k),id(count-1,k+1)]);
    }
  });
  return {vertices,faces,gridEdges};
}
