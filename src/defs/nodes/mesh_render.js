import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
 key:'mesh_render',name:'Mesh Render',cat:'mod',group:'deform',
 fileBinary:true,fileLabel:'Load STL…',fileAccept:'.stl,model/stl,application/sla',
 desc:'Draw a 3D surface with visible height contours, lit cross-hatching, silhouettes and projected floor shadows. A wired Mesh wins over the local STL; otherwise Sphere or Cube provides a starting object. Mesh output passes the normalized source onward. View angle / Elevation / Perspective share one camera for all drawing layers. Light azimuth and elevation control both face tone and a light-space self-shadow test. Floor shadow projects the mesh onto its base plane and hides it behind visible object pixels. Contour axis chooses the sampled world coordinate. Creases adds strong normal changes, not every triangle edge. Raster detail bounds the approximation and automatically coarsens uniformly for dense meshes; thin features may disappear. Size uses a fixed bounding sphere and shadows clip to Margin, so moving the light does not refit the object. All outputs are ordinary 2D pen strokes; no machine Z motion. STL limit 120k triangles. Very dense output coarsens the whole raster or Style rather than dropping later components.',
 ins:[Pin('mesh','Mesh'),Pin('style','Style')],outs:[Pin('paths','Drawing'),Pin('mesh','Mesh')],
 params:[
  {key:'file',label:'STL file',type:'file',def:''},
  {key:'source',label:'Fallback object',type:'select',options:['Sphere','Cube'],def:'Sphere'},
  {key:'drawing',label:'Drawing',type:'select',options:['Illustration','Contours','Hatch','Edges'],def:'Illustration'},
  {key:'contours',label:'Contour count',type:'slider',min:3,max:60,step:1,def:22,showIf:p=>p.drawing==='Illustration'||p.drawing==='Contours'},
  {key:'axis',label:'Contour axis',type:'select',options:['Z','Y','X'],def:'Z',showIf:p=>p.drawing==='Illustration'||p.drawing==='Contours'},
  {key:'silhouette',label:'Silhouette',type:'check',def:true,showIf:p=>p.drawing!=='Edges'},
  {key:'creases',label:'Creases',type:'check',def:false},
  {key:'crease',label:'Crease angle °',type:'slider',min:5,max:100,step:1,def:35,showIf:p=>p.creases},
  {key:'pitch',label:'Hatch pitch mm',type:'slider',min:.7,max:6,step:.1,def:2,showIf:p=>p.drawing==='Illustration'||p.drawing==='Hatch'||p.shadow},
  {key:'angle',label:'Hatch angle °',type:'slider',min:-180,max:180,step:1,def:45,showIf:p=>p.drawing==='Illustration'||p.drawing==='Hatch'||p.shadow},
  {key:'lightAz',label:'Light azimuth °',type:'slider',min:-180,max:180,step:1,def:-50,showIf:p=>p.drawing==='Illustration'||p.drawing==='Hatch'||p.shadow},
  {key:'lightEl',label:'Light elevation °',type:'slider',min:10,max:90,step:1,def:55,showIf:p=>p.drawing==='Illustration'||p.drawing==='Hatch'||p.shadow},
  {key:'ambient',label:'Ambient light %',type:'slider',min:0,max:80,step:1,def:18,showIf:p=>p.drawing==='Illustration'||p.drawing==='Hatch'},
  {key:'selfShadow',label:'Self shadow',type:'check',def:true,showIf:p=>p.drawing==='Illustration'||p.drawing==='Hatch'},
  {key:'shadow',label:'Floor shadow',type:'check',def:true},
  {key:'shadowPen',label:'Shadow pen',type:'pen',def:0,showIf:p=>p.shadow},
  {key:'yaw',label:'View angle °',type:'slider',min:-180,max:180,step:1,def:25},
  {key:'elevation',label:'View elevation °',type:'slider',min:5,max:90,step:1,def:30},
  {key:'persp',label:'Perspective',type:'slider',min:0,max:.8,step:.05,def:0},
  {key:'size',label:'Size mm',type:'slider',min:20,max:350,step:1,def:155},
  {key:'detail',label:'Raster detail',type:'slider',min:40,max:240,step:10,def:180},
  {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
  {key:'layer',label:'Object pen',type:'pen',def:0}
 ],
 overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
  onFile(dataUrl) {
    const s = String(dataUrl);
    if (!s.startsWith("data:")) throw new Error("binary intake missing - update the app");
    const b64 = s.slice(s.indexOf(",") + 1);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const CAP = 120000;
    let tris = null;
    if (u8.length >= 84) {
      const dv = new DataView(u8.buffer);
      const nT = dv.getUint32(80, true);
      if (nT > 0 && 84 + 50 * nT === u8.length) {
        if (nT > CAP) throw new Error("STL has " + nT + " triangles - decimate below " + CAP + " (Blender: Decimate modifier) and re-export");
        tris = new Array(nT * 9);
        for (let t = 0; t < nT; t++) {
          const o = 84 + t * 50 + 12;
          for (let k = 0; k < 9; k++) tris[t * 9 + k] = dv.getFloat32(o + k * 4, true);
        }
      }
    }
    if (!tris) {
      /* ASCII STL: bin already is the text */
      if (!/^\s*solid/.test(bin)) throw new Error("not an STL file (no binary header match, no 'solid' keyword)");
      const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
      tris = [];
      let m;
      while ((m = re.exec(bin))) {
        tris.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
        if (tris.length > CAP * 9) throw new Error("STL exceeds " + CAP + " triangles - decimate and re-export");
      }
      if (tris.length < 9 || tris.length % 9 !== 0) throw new Error("ASCII STL parse failed (" + tris.length / 3 + " vertices, not a multiple of 3)");
    }
    const n = tris.length / 9;
    /* normalize: center at origin, longest dimension = 1, round for compact patches */
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < tris.length; i += 3) {
      const x = tris[i], y = tris[i + 1], z = tris[i + 2];
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) throw new Error("STL contains non-finite coordinates");
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const dim = Math.max(x1 - x0, y1 - y0, z1 - z0);
    if (!(dim > 0)) throw new Error("STL is degenerate (zero size)");
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const v = new Array(tris.length);
    for (let i = 0; i < tris.length; i += 3) {
      v[i] = Math.round(((tris[i] - cx) / dim) * 10000) / 10000;
      v[i + 1] = Math.round(((tris[i + 1] - cy) / dim) * 10000) / 10000;
      v[i + 2] = Math.round(((tris[i + 2] - cz) / dim) * 10000) / 10000;
    }
    return { kind: "mesh", tri: n, v, dims: [Math.round(((x1 - x0) / dim) * 10000) / 10000, Math.round(((y1 - y0) / dim) * 10000) / 10000, Math.round(((z1 - z0) / dim) * 10000) / 10000] };
  },

 compute(ins,p,c,node){
  const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),m=n('margin',12,0,Math.min(c.W,c.H)/2),W=c.W-2*m,H=c.H-2*m;if(!(W>0&&H>0))return [EMPTY,null];
  let mesh=ins[0]?.kind==='mesh'?ins[0]:node?.data?.svg?.kind==='mesh'?node.data.svg:null;
  if(!mesh){const v=[],tri=(a,b,d)=>v.push(...a,...b,...d);if(p.source==='Cube'){const vs=Array.from({length:8},(_,i)=>[(i&1)?.5:-.5,(i&2)?.5:-.5,(i&4)?.5:-.5]);for(const [a,b,d,e]of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]){tri(vs[a],vs[b],vs[d]);tri(vs[a],vs[d],vs[e]);}}else{const at=(i,j)=>{const a=i/32*Math.PI*2,b=j/20*Math.PI;return [.5*Math.sin(b)*Math.cos(a),.5*Math.sin(b)*Math.sin(a),.5*Math.cos(b)];};for(let j=0;j<20;j++)for(let i=0;i<32;i++){if(j>0)tri(at(i,j),at(i+1,j),at(i,j+1));if(j<19)tri(at(i+1,j),at(i+1,j+1),at(i,j+1));}}mesh={kind:'mesh',v,tri:v.length/9,dims:[1,1,1]};}
  if(!mesh.v?.length||mesh.v.length%9||mesh.v.length>1080000||mesh.v.some(v=>!Number.isFinite(v)))return [EMPTY,null];
  const vs=mesh.v,triangles=[];let R=0,zmin=Infinity,zmax=-Infinity;for(let i=0;i<vs.length;i+=3){R=Math.max(R,Math.hypot(vs[i],vs[i+1],vs[i+2]));zmin=Math.min(zmin,vs[i+2]);zmax=Math.max(zmax,vs[i+2]);}if(!(R>0))return [EMPTY,mesh];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const L=Math.hypot(...a)||1;return a.map(v=>v/L);},rad=Math.PI/180,az=n('yaw',25,-3600,3600)*rad,el=n('elevation',30,5,90)*rad,eye=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)],right=[-Math.sin(az),Math.cos(az),0],up=cross(eye,right),persp=n('persp',0,0,.8),radius=R/Math.max(.2,1-persp*.8*R),scale=Math.min(n('size',155,10,1000),W/(2*radius*1.05),H/(2*radius*1.05));
  const camera=q=>{const z=dot(q,eye),f=1/Math.max(.2,1-persp*.8*z);return [c.W/2+dot(q,right)*f*scale,c.H/2-dot(q,up)*f*scale,z,f];};
  for(let i=0;i<vs.length;i+=9){const a=vs.slice(i,i+3),b=vs.slice(i+3,i+6),d=vs.slice(i+6,i+9),normal=norm(cross(b.map((v,k)=>v-a[k]),d.map((v,k)=>v-a[k])));triangles.push({p:[a,b,d],normal:dot(normal,eye)<0?normal.map(v=>-v):normal});}
  // Raster all triangles. Uniform detail adapts to total projected box work.
  const raster=(tris,project,box,requested)=>{
   const projected=tris.map(t=>t.p.map(project));let nx,ny,estimate,detail=requested;do{nx=Math.max(8,Math.round(detail*Math.min(1,box.w/box.h)));ny=Math.max(8,Math.round(detail*Math.min(1,box.h/box.w)));estimate=0;for(const ps of projected){const xx=ps.map(q=>(q[0]-box.x)/box.w*nx),yy=ps.map(q=>(q[1]-box.y)/box.h*ny);estimate+=(Math.max(0,Math.min(nx,Math.max(...xx))-Math.max(0,Math.min(...xx)))+2)*(Math.max(0,Math.min(ny,Math.max(...yy))-Math.max(0,Math.min(...yy)))+2);}detail*=.7;}while(estimate>4000000&&detail>8);
   const N=nx*ny,z=new Float64Array(N).fill(-Infinity),owner=new Int32Array(N).fill(-1),world=new Float64Array(N*3);
   for(let t=0;t<tris.length;t++){const ps=projected[t].map(q=>[(q[0]-box.x)/box.w*nx-.5,(q[1]-box.y)/box.h*ny-.5,q[2],q[3]??1]),[A,B,D]=ps,det=(B[0]-A[0])*(D[1]-A[1])-(D[0]-A[0])*(B[1]-A[1]);if(Math.abs(det)<1e-12)continue;const xl=Math.max(0,Math.ceil(Math.min(A[0],B[0],D[0]))),xr=Math.min(nx-1,Math.floor(Math.max(A[0],B[0],D[0]))),yl=Math.max(0,Math.ceil(Math.min(A[1],B[1],D[1]))),yr=Math.min(ny-1,Math.floor(Math.max(A[1],B[1],D[1])));
    for(let j=yl;j<=yr;j++)for(let i=xl;i<=xr;i++){const a=((B[0]-i)*(D[1]-j)-(D[0]-i)*(B[1]-j))/det,b=((D[0]-i)*(A[1]-j)-(A[0]-i)*(D[1]-j))/det,d=1-a-b;if(a< -1e-8||b< -1e-8||d< -1e-8)continue;const wa=a*A[3],wb=b*B[3],wd=d*D[3],sum=wa+wb+wd,depth=(wa*A[2]+wb*B[2]+wd*D[2])/sum,k=j*nx+i;if(depth>z[k]+1e-9){z[k]=depth;owner[k]=t;for(let h=0;h<3;h++)world[k*3+h]=(wa*tris[t].p[0][h]+wb*tris[t].p[1][h]+wd*tris[t].p[2][h])/sum;}}
   }return {nx,ny,z,owner,world,box};
  };
  const detail=n('detail',180,40,240),image=raster(triangles,camera,{x:m,y:m,w:W,h:H},detail),{nx,ny,owner,world}=image,N=nx*ny,point=(i,j)=>[m+(i+.5)/nx*W,m+(j+.5)/ny*H],la=n('lightAz',-50,-3600,3600)*rad,le=n('lightEl',55,10,90)*rad,L=[Math.cos(la)*Math.cos(le),Math.sin(la)*Math.cos(le),Math.sin(le)],lr=[-Math.sin(la),Math.cos(la),0],lu=cross(L,lr),lightProject=q=>[dot(q,lr),dot(q,lu),dot(q,L),1],lbox={x:-R*1.05,y:-R*1.05,w:R*2.1,h:R*2.1};
  const shaded=p.drawing==='Illustration'||p.drawing==='Hatch',light=shaded&&p.selfShadow?raster(triangles,lightProject,lbox,detail):null,ambient=n('ambient',18,0,80)/100,dark=new Float64Array(N),mask=new Float64Array(N),height=new Float64Array(N).fill(NaN),axis=p.axis==='X'?0:p.axis==='Y'?1:2;let hmin=Infinity,hmax=-Infinity;for(let i=axis;i<vs.length;i+=3){hmin=Math.min(hmin,vs[i]);hmax=Math.max(hmax,vs[i]);}
  for(let k=0;k<N;k++)if(owner[k]>=0){mask[k]=1;const q=Array.from(world.slice(k*3,k*3+3)),normal=triangles[owner[k]].normal;let brightness=ambient+(1-ambient)*Math.max(0,dot(normal,L));if(light){const v=lightProject(q),i=Math.floor((v[0]-lbox.x)/lbox.w*light.nx),j=Math.floor((v[1]-lbox.y)/lbox.h*light.ny);if(i>=0&&i<light.nx&&j>=0&&j<light.ny&&light.z[j*light.nx+i]>v[2]+lbox.w/light.nx*1.7)brightness=ambient;}dark[k]=1-brightness;height[k]=(world[k*3+axis]-hmin)/Math.max(1e-9,hmax-hmin);}
  let shadow=null;if(p.shadow){const floor=zmin-.015,st=triangles.map(t=>({normal:[0,0,1],p:t.p.map(q=>{const d=(q[2]-floor)/L[2];return [q[0]-L[0]*d,q[1]-L[1]*d,floor];})}));shadow=raster(st,camera,{x:m,y:m,w:W,h:H},detail);}
  const shadowAt=(x,y)=>{if(!shadow)return false;const i=Math.floor((x-m)/W*shadow.nx),j=Math.floor((y-m)/H*shadow.ny);if(i<0||j<0||i>=shadow.nx||j>=shadow.ny)return false;const k=j*shadow.nx+i,ii=Math.max(0,Math.min(nx-1,Math.floor((x-m)/W*nx))),jj=Math.max(0,Math.min(ny-1,Math.floor((y-m)/H*ny)));return shadow.owner[k]>=0&&shadow.z[k]>image.z[jj*nx+ii]+1e-5;};
  const pen=Math.round(n('layer',0,0,11)),shadowPen=Math.round(n('shadowPen',0,0,11)),paths=[];
  const chain=(segs,layer)=>{const key=q=>q.map(v=>Math.round(v*1e6)).join(','),adj=new Map(),used=new Uint8Array(segs.length);segs.forEach((s,i)=>s.forEach(q=>{const k=key(q);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}));const walk=(i,start)=>{const pts=[start],first=key(start);let tail=first;while(!used[i]){used[i]=1;const q=segs[i],next=key(q[0])===tail?q[1]:q[0];pts.push(next);tail=key(next);const z=(adj.get(tail)||[]).find(z=>!used[z]);if(z===undefined)break;i=z;}const closed=tail===first;if(closed)pts.pop();if(pts.length>=(closed?3:2))paths.push({pts,closed,layer});};for(const [k,ids]of adj)if(ids.length!==2)for(const i of ids)if(!used[i])walk(i,segs[i].find(q=>key(q)===k));for(let i=0;i<segs.length;i++)if(!used[i])walk(i,segs[i][0]);};
  const march=(field,iso)=>{const segs=[];for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const k=j*nx+i,v=[field[k],field[k+1],field[k+nx+1],field[k+nx]],pos=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)],hits=[];if(v.some(x=>!Number.isFinite(x)))continue;for(let e=0;e<4;e++){const f=(e+1)%4;if((v[e]>iso)!==(v[f]>iso)){const t=(iso-v[e])/(v[f]-v[e]);hits.push(pos[e].map((x,k)=>x+(pos[f][k]-x)*t));}}if(hits.length===2)segs.push(hits);else if(hits.length===4)segs.push([hits[0],hits[1]],[hits[2],hits[3]]);}chain(segs,pen);};
  if(p.silhouette||p.drawing==='Edges')march(mask,.5);
  if(p.drawing==='Illustration'||p.drawing==='Contours')for(let i=1,count=Math.round(n('contours',22,3,60));i<count;i++)march(height,i/count);
  if(p.creases){const segs=[],co=Math.cos(n('crease',35,5,100)*rad);for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const k=j*nx+i,a=owner[k];if(a<0)continue;for(const [other,A,B]of [[k+1,point(i+.5,j-.5),point(i+.5,j+.5)],[k+nx,point(i-.5,j+.5),point(i+.5,j+.5)]])if(owner[other]>=0&&dot(triangles[a].normal,triangles[owner[other]].normal)<co)segs.push([A,B]);}chain(segs,pen);}
  const hatch=(angle,pitch,condition,layer)=>{const ca=Math.cos(angle),sa=Math.sin(angle),u=[],v=[];for(const [x,y]of [[m,m],[c.W-m,m],[c.W-m,c.H-m],[m,c.H-m]]){u.push(x*ca+y*sa);v.push(-x*sa+y*ca);}const step=Math.max(.3,Math.min(W/nx,H/ny)*.6),umin=Math.min(...u),umax=Math.max(...u),vmin=Math.min(...v),vmax=Math.max(...v);let row=0;for(let vv=Math.ceil(vmin/pitch)*pitch;vv<=vmax;vv+=pitch,row++){let first=null,last=null;for(let uu=umin;uu<=umax+step;uu+=step){const x=uu*ca-vv*sa,y=uu*sa+vv*ca,on=x>=m&&x<=c.W-m&&y>=m&&y<=c.H-m&&condition(x,y,row);if(on){if(!first)first=[x,y];last=[x,y];}else if(first){if(Math.hypot(last[0]-first[0],last[1]-first[1])>.1)paths.push({pts:[first,last],closed:false,layer});first=null;}}}};
  const pitch=n('pitch',2,.7,20),angle=n('angle',45,-3600,3600)*rad,body=(x,y,threshold)=>{const i=Math.min(nx-1,Math.max(0,Math.floor((x-m)/W*nx))),j=Math.min(ny-1,Math.max(0,Math.floor((y-m)/H*ny))),k=j*nx+i;return owner[k]>=0&&dark[k]>threshold;};
  if(shaded){hatch(angle,pitch,(x,y,r)=>body(x,y,.14+(r%3)*.2),pen);hatch(angle+Math.PI/2,pitch*1.4,(x,y)=>body(x,y,.64),pen);}if(shadow)hatch(angle,pitch,(x,y)=>shadowAt(x,y),shadowPen);
  let style=ins[1],out=applyStyle({paths},style);for(let i=0;i<10&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;i++){style={...style,dash:Math.max(.1,+style?.dash||4)*1.8,gap:Math.max(.1,+style?.gap||3)*1.8};out=applyStyle({paths},style);}if(out.paths.reduce((n,q)=>n+q.pts.length,0)>118000){if(detail>40)return this.compute(ins,{...p,detail:Math.max(40,Math.floor(detail*.7))},c,node);return [EMPTY,mesh];}return [out,mesh];
 }
};
