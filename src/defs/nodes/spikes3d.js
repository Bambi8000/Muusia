import { Pin, EMPTY, mulberry32, noise2, applyStyle, isStyle } from "../helpers.js";

export default {
  key: "spikes3d",
  name: "3D Spikes",
  cat: "gen",
  group: "structural",
  desc: "Grow seeded spikes or straws from a real 3D surface. Choose Capsule, Sphere, Torus or Cube, set Body to Wired mesh and connect Blob Mesh's Mesh output (port 2), or choose Imported STL and load an ASCII/binary STL (up to 120k triangles). Count samples triangles by area, avoiding denser growth on more finely tessellated regions. Length, Length variation and Spread shape the coat. Length modulation Off preserves old patches; Wave, Noise or Pulse varies each spike by its surface position. Modulation depth % blends down from its original length; Modulation size mm sets the spatial period/scale along Modulation axis (object X/Y/Z). Modulation phase degrees moves the pattern: wire Frame rot degrees here with Modulation motion Manual, or choose Timeline and press Play in ANIMATE; Modulation cycles sets whole cycles per loop. Pulse width % sets the raised band width in Pulse. Noise is smooth and seeded, with a seamless phase cycle. Keep Seed, Count, body, length and camera fixed for stable roots and fixed framing: active modulation fits the full unmodulated coat, not each changing frame. Modulation depth 0 equals Off. Lines draws thin centre strokes, Spikes pointed fins, Straws parallel edges with an open end ring. Normal direction can reverse growth; Smooth normals softens a wired mesh. Rotate the view with View angle/elevation. Body occlusion clips strokes hidden by the host surface (raster depth; straws do not hide each other). Body drawing adds its silhouette or a reduced wireframe. Body size and Length are requested millimetres; the whole composition shrinks uniformly if needed to fit Margin. All outputs are ordinary 2D pen paths, not machine Z moves. Wire numeric controls to Frame for animation. Keep Seed and Count fixed when rotating.",
  fileBinary: true,
  fileAccept: ".stl,model/stl,application/sla,application/octet-stream",
  fileLabel: "Load STL…",
  ins: [Pin("mesh", "Surface"), Pin("style", "Style")],
  outs: [Pin("paths", "Drawing")],
  params: [
    { key: "body", label: "Body", type: "select", options: ["Capsule", "Sphere", "Torus", "Cube", "Wired mesh", "Imported STL"], def: "Capsule" },
    { key: "file", label: "Surface file", type: "file", def: "", showIf: p => p.body === "Imported STL" },
    { key: "width", label: "Capsule width %", type: "slider", min: 10, max: 95, step: 1, def: 34, showIf: p => p.body === "Capsule" },
    { key: "tube", label: "Torus tube %", type: "slider", min: 10, max: 75, step: 1, def: 35, showIf: p => p.body === "Torus" },
    { key: "size", label: "Body size mm", type: "slider", min: 10, max: 400, step: 1, def: 145 },
    { key: "count", label: "Count", type: "slider", min: 0, max: 3000, step: 10, def: 1400 },
    { key: "mode", label: "Marks", type: "select", options: ["Lines", "Spikes", "Straws"], def: "Lines", showIf: p => Math.round(p.count) > 0 },
    { key: "length", label: "Length mm", type: "slider", min: 0, max: 100, step: 0.5, def: 34, showIf: p => Math.round(p.count) > 0 },
    { key: "variation", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.01, def: 0.75, showIf: p => Math.round(p.count) > 0 && p.length > 0 },
    { key: "modulation", label: "Length modulation", type: "select", options: ["Off", "Wave", "Noise", "Pulse"], def: "Off", showIf: p => Math.round(p.count) > 0 && p.length > 0 },
    { key: "modDepth", label: "Modulation depth %", type: "slider", min: 0, max: 100, step: 1, def: 80, showIf: p => Math.round(p.count) > 0 && p.length > 0 && ["Wave", "Noise", "Pulse"].includes(p.modulation) },
    { key: "modAxis", label: "Modulation axis", type: "select", options: ["X", "Y", "Z"], def: "Z", showIf: p => Math.round(p.count) > 0 && p.length > 0 && ["Wave", "Noise", "Pulse"].includes(p.modulation) && p.modDepth > 0 },
    { key: "modSize", label: "Modulation size mm", type: "slider", min: 5, max: 200, step: 1, def: 65, showIf: p => Math.round(p.count) > 0 && p.length > 0 && ["Wave", "Noise", "Pulse"].includes(p.modulation) && p.modDepth > 0 },
    { key: "modPhase", label: "Modulation phase °", type: "slider", min: 0, max: 360, step: 1, def: 0, showIf: p => Math.round(p.count) > 0 && p.length > 0 && ["Wave", "Noise", "Pulse"].includes(p.modulation) && p.modDepth > 0 },
    { key: "modMotion", label: "Modulation motion", type: "select", options: ["Manual", "Timeline"], def: "Manual", showIf: p => Math.round(p.count) > 0 && p.length > 0 && ["Wave", "Noise", "Pulse"].includes(p.modulation) && p.modDepth > 0 },
    { key: "modCycles", label: "Modulation cycles", type: "slider", min: 1, max: 8, step: 1, def: 1, showIf: p => Math.round(p.count) > 0 && p.length > 0 && ["Wave", "Noise", "Pulse"].includes(p.modulation) && p.modDepth > 0 && p.modMotion === "Timeline" },
    { key: "pulseWidth", label: "Pulse width %", type: "slider", min: 5, max: 100, step: 1, def: 35, showIf: p => Math.round(p.count) > 0 && p.length > 0 && p.modulation === "Pulse" && p.modDepth > 0 },
    { key: "spread", label: "Spread °", type: "slider", min: 0, max: 85, step: 1, def: 16, showIf: p => Math.round(p.count) > 0 && p.length > 0 },
    { key: "diameter", label: "Diameter mm", type: "slider", min: 0.2, max: 8, step: 0.1, def: 1.2, showIf: p => Math.round(p.count) > 0 && p.length > 0 && p.mode !== "Lines" },
    { key: "normals", label: "Normal direction", type: "select", options: ["Outward (closed mesh)", "As mesh", "Flip"], def: "Outward (closed mesh)", showIf: p => Math.round(p.count) > 0 && p.length > 0 },
    { key: "smooth", label: "Smooth normals", type: "check", def: true, showIf: p => ["Wired mesh", "Imported STL"].includes(p.body) && Math.round(p.count) > 0 && p.length > 0 },
    { key: "viewAz", label: "View angle °", type: "slider", min: -180, max: 180, step: 1, def: 25 },
    { key: "viewEl", label: "View elevation °", type: "slider", min: -85, max: 85, step: 1, def: 12 },
    { key: "occlusion", label: "Body occlusion", type: "check", def: true },
    { key: "detail", label: "Occlusion detail", type: "slider", min: 128, max: 640, step: 32, def: 384, showIf: p => p.occlusion },
    { key: "host", label: "Body drawing", type: "select", options: ["None", "Silhouette", "Wireframe"], def: "None" },
    { key: "hostPen", label: "Body pen", type: "pen", def: 1, showIf: p => p.host !== "None" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 41, showIf: p => Math.round(p.count) > 0 && p.length > 0 },
    { key: "layer", label: "Spike pen", type: "pen", def: 0, showIf: p => Math.round(p.count) > 0 && p.length > 0 },
  ],
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
  overlay(p,ctx) {
    const W=Number(ctx?.W),H=Number(ctx?.H);
    if (!(W>0&&H>0&&Number.isFinite(W)&&Number.isFinite(H))) return [];
    const m=Math.min(Math.max(0,Number(p.margin)||0),60,Math.max(0,Math.min(W,H)/2-.001));
    return [{kind:"rect",x:m,y:m,w:W-2*m,h:H-2*m}];
  },
  compute(ins,p,ctx,node) {
    const W=Number(ctx?.W),H=Number(ctx?.H);
    if (!(W>0&&H>0&&Number.isFinite(W)&&Number.isFinite(H))) return EMPTY;
    const num=(key,lo,hi,fallback)=>Number.isFinite(Number(p[key]))?Math.max(lo,Math.min(hi,Number(p[key]))):fallback;
    const unit=a=>{const d=Math.hypot(...a);return d>1e-12?a.map(v=>v/d):[0,0,1];};
    const sub=(a,b)=>a.map((v,i)=>v-b[i]);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
    const add=(a,b,t=1)=>a.map((v,i)=>v+b[i]*t);
    const pen=k=>Math.round(num(k,0,11,0));
    const size=num("size",.01,2000,145),count=Math.round(num("count",0,5000,1400));
    const len=num("length",0,1000,34),vary=num("variation",0,1,.75),spread=num("spread",0,89,16)*Math.PI/180;
    const radius=num("diameter",.05,100,1.2)/2,margin=Math.min(num("margin",0,60,12),Math.max(0,Math.min(W,H)/2-.001));
    const rng=mulberry32(Math.round(num("seed",-2147483648,2147483647,41)));
    const modulated=["Wave","Noise","Pulse"].includes(p.modulation)&&num("modDepth",0,100,80)>0&&count>0&&len>0;
    const modDepth=num("modDepth",0,100,80)/100,modSize=num("modSize",.01,10000,65);
    const modAxis=p.modAxis==="X"?0:p.modAxis==="Y"?1:2;
    const frameCount=Number.isFinite(+ctx.frameCount)?Math.max(1,Math.floor(+ctx.frameCount)):1;
    const frame=Number.isFinite(+ctx.frameIdx)?Math.max(0,Math.min(frameCount-1,+ctx.frameIdx)):0;
    const turns=num("modPhase",-3600000,3600000,0)/360+(p.modMotion==="Timeline"?frame/frameCount*Math.round(num("modCycles",1,8,1)):0);
    const phase=((turns%1)+1)%1,tau=Math.PI*2,modSeed=Math.round(num("seed",-2147483648,2147483647,41))^5361758;
    const modFactor=root=>{
      const u=root[modAxis]/modSize;
      let field;
      if(p.modulation==="Noise")field=noise2(u+2*Math.cos(phase*tau),root[(modAxis+1)%3]/modSize+2*Math.sin(phase*tau),modSeed);
      else if(p.modulation==="Pulse"){
        const distance=Math.abs((((u-phase+.5)%1)+1)%1-.5),t=Math.max(0,1-distance/(num("pulseWidth",5,100,35)/200));
        field=t*t*(3-2*t);
      }else field=.5+.5*Math.cos((u-phase)*tau);
      return 1-modDepth+modDepth*Math.max(0,Math.min(1,field));
    };
    const vertices=[],faces=[];
    const vertex=a=>{vertices.push(a);return vertices.length-1;};
    const face=(a,b,c)=>faces.push([a,b,c]);
    if(p.body==="Wired mesh"||p.body==="Imported STL") {
      const mesh=p.body==="Imported STL"?node?.data?.svg:ins?.[0];
      if(!mesh||mesh.kind!=="mesh"||!Number.isInteger(mesh.tri)||mesh.tri<1||mesh.tri>120000||!mesh.v||mesh.v.length!==mesh.tri*9) return EMPTY;
      const weld=new Map();
      for(let t=0;t<mesh.tri;t++) {
        const ids=[];
        for(let c=0;c<3;c++) {
          const a=Array.from(mesh.v.slice(t*9+c*3,t*9+c*3+3));
          if(!a.every(v=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<1e9)) return EMPTY;
          const key=a.map(v=>Math.round(v*1e7)).join(",");
          if(!weld.has(key))weld.set(key,vertex(a));
          ids.push(weld.get(key));
        }
        face(...ids);
      }
    } else if(p.body==="Cube") {
      for(const z of [-.5,.5])for(const y of [-.5,.5])for(const x of [-.5,.5])vertex([x,y,z]);
      for(const q of [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]]){face(q[0],q[1],q[2]);face(q[0],q[2],q[3]);}
    } else {
      const S=48,rows=[];
      if(p.body==="Torus") {
        const r=num("tube",5,90,35)/200,R=.5-r;
        for(let i=0;i<32;i++) {
          const a=i/32*Math.PI*2,row=[];
          for(let j=0;j<S;j++){const b=j/S*Math.PI*2;row.push(vertex([(R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a),r*Math.sin(b)]));}
          rows.push(row);
        }
        for(let i=0;i<32;i++)for(let j=0;j<S;j++){const a=rows[i][j],b=rows[(i+1)%32][j],c=rows[(i+1)%32][(j+1)%S],d=rows[i][(j+1)%S];face(a,b,c);face(a,c,d);}
      } else {
        const r=p.body==="Sphere"?.5:num("width",2,99,34)/200;
        for(let i=0;i<=25;i++) {
          const upper=i<=12,ph=(upper?i/12:(i-13)/12+1)*Math.PI/2;
          const offset=p.body==="Sphere"?0:(upper?.5-r:-(.5-r));
          const row=[];
          for(let j=0;j<S;j++){const a=j/S*Math.PI*2;row.push(vertex([r*Math.sin(ph)*Math.cos(a),r*Math.sin(ph)*Math.sin(a),r*Math.cos(ph)+offset]));}
          rows.push(row);
        }
        for(let i=0;i<rows.length-1;i++)for(let j=0;j<S;j++){const a=rows[i][j],b=rows[i+1][j],c=rows[i+1][(j+1)%S],d=rows[i][(j+1)%S];face(a,b,c);face(a,c,d);}
      }
    }
    // Centre and normalise the source before assigning requested millimetres.
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const a of vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],a[k]);hi[k]=Math.max(hi[k],a[k]);}
    const span=Math.max(...hi.map((v,k)=>v-lo[k]));if(!(span>1e-10))return EMPTY;
    for(const a of vertices)for(let k=0;k<3;k++)a[k]=(a[k]-(lo[k]+hi[k])/2)*size/span;
    let volume=0;for(const f of faces)volume+=dot(vertices[f[0]],cross(vertices[f[1]],vertices[f[2]]));
    const flip=p.normals==="Flip"?-1:p.normals==="As mesh"?1:volume<0?-1:1;
    const vn=vertices.map(()=>[0,0,0]),triangles=[];let area=0;
    for(const f of faces) {
      const a=vertices[f[0]],b=vertices[f[1]],c=vertices[f[2]],n=cross(sub(b,a),sub(c,a)),weight=Math.hypot(...n)/2;
      if(weight<=1e-12)continue;
      area+=weight;triangles.push({f,n:unit(n).map(v=>v*flip),end:area});
      for(const k of f)for(let d=0;d<3;d++)vn[k][d]+=n[d]*flip;
    }
    if(!triangles.length)return EMPTY;
    const smooth=p.body!=="Cube"&&(!["Wired mesh","Imported STL"].includes(p.body)||p.smooth);
    for(let i=0;i<vn.length;i++)vn[i]=unit(vn[i]);
    const az=num("viewAz",-3600,3600,25)*Math.PI/180,el=num("viewEl",-89.9,89.9,12)*Math.PI/180;
    const ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
    const project=a=>{const q=a[0]*sa+a[1]*ca;return [a[0]*ca-a[1]*sa,q*se-a[2]*ce,q*ce+a[2]*se];};
    const pv=vertices.map(project),segments=[],fitPoints=[];
    const push=(a,b,layer)=>{if(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])>1e-9)segments.push({a:project(a),b:project(b),layer});};
    for(let i=0;i<count;i++) {
      const target=rng()*area;let l=0,h=triangles.length-1;
      while(l<h){const mid=(l+h)>>1;if(triangles[mid].end<target)l=mid+1;else h=mid;}
      const t=triangles[l],u=Math.sqrt(rng()),v=rng(),w=[1-u,u*(1-v),u*v];
      const root=[0,0,0],normal=[0,0,0];
      for(let c=0;c<3;c++)for(let k=0;k<3;k++){root[k]+=vertices[t.f[c]][k]*w[c];normal[k]+=(smooth?vn[t.f[c]][k]:t.n[k])*w[c];}
      const n=unit(normal),basis=unit(cross(n,Math.abs(n[2])<.9?[0,0,1]:[0,1,0])),side=cross(n,basis);
      const theta=rng()*Math.PI*2,cos=1-rng()*(1-Math.cos(spread)),sin=Math.sqrt(Math.max(0,1-cos*cos));
      const direction=unit(n.map((x,k)=>x*cos+(basis[k]*Math.cos(theta)+side[k]*Math.sin(theta))*sin));
      const fullLength=len*(1-vary*rng()),length=fullLength*(modulated?modFactor(root):1),tip=add(root,direction,length);
      // Fit the unmodulated coat on every frame, including spikes currently
      // at zero length. Phase must never translate/rescale the whole drawing.
      if(modulated){
        const fullTip=add(root,direction,fullLength);
        if(p.mode!=="Spikes"&&p.mode!=="Straws")fitPoints.push(project(root),project(fullTip));
        else{
          const ax=unit(cross(direction,Math.abs(direction[2])<.9?[0,0,1]:[0,1,0])),ay=cross(direction,ax);
          for(let j=0;j<6;j++){const a=j/6*tau,offset=ax.map((x,k)=>radius*(x*Math.cos(a)+ay[k]*Math.sin(a)));fitPoints.push(project(add(root,offset)));if(p.mode==="Straws")fitPoints.push(project(add(fullTip,offset)));}
          if(p.mode==="Spikes")fitPoints.push(project(fullTip));
        }
      }
      if(length<=1e-9)continue;
      if(p.mode!=="Spikes"&&p.mode!=="Straws"){push(root,tip,pen("layer"));continue;}
      const ax=unit(cross(direction,Math.abs(direction[2])<.9?[0,0,1]:[0,1,0])),ay=cross(direction,ax),base=[],top=[];
      for(let j=0;j<6;j++){const angle=j/6*Math.PI*2,offset=ax.map((x,k)=>radius*(x*Math.cos(angle)+ay[k]*Math.sin(angle)));base.push(add(root,offset));top.push(add(tip,offset));}
      for(let j=0;j<6;j++){push(base[j],base[(j+1)%6],pen("layer"));push(base[j],p.mode==="Spikes"?tip:top[j],pen("layer"));if(p.mode==="Straws")push(top[j],top[(j+1)%6],pen("layer"));}
    }
    // Projected face depth controls host edges and host-only occlusion.
    const edges=new Map();
    if(p.host!=="None")for(const t of triangles) {
      const [a,b,c]=t.f.map(i=>pv[i]);const front=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      for(let j=0;j<3;j++){const k=t.f[j],q=t.f[(j+1)%3],key=k<q?k+":"+q:q+":"+k;const e=edges.get(key);if(e)e.signs.push(front);else edges.set(key,{k,q,signs:[front]});}
    }
    const wireEvery=Math.max(1,Math.ceil(edges.size/4000));let ei=0;
    for(const e of edges.values()) {
      const silhouette=e.signs.length===1||e.signs.some(s=>s>1e-9)&&e.signs.some(s=>s<-1e-9);
      if(p.host==="Silhouette"&&!silhouette||p.host==="Wireframe"&&ei++%wireEvery)continue;
      segments.push({a:pv[e.k],b:pv[e.q],layer:pen("hostPen")});
    }
    if(!segments.length)return EMPTY;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const s of segments)for(const a of [s.a,s.b]){x0=Math.min(x0,a[0]);x1=Math.max(x1,a[0]);y0=Math.min(y0,a[1]);y1=Math.max(y1,a[1]);}
    for(const a of fitPoints){x0=Math.min(x0,a[0]);x1=Math.max(x1,a[0]);y0=Math.min(y0,a[1]);y1=Math.max(y1,a[1]);}
    const scale=Math.min(1,(W-2*margin)/Math.max(1e-9,x1-x0),(H-2*margin)/Math.max(1e-9,y1-y0));
    const ox=W/2-(x0+x1)/2*scale,oy=H/2-(y0+y1)/2*scale;
    const res=Math.round(num("detail",64,640,384));
    const box=vertices.map(project).reduce((b,a)=>[Math.min(b[0],a[0]),Math.min(b[1],a[1]),Math.max(b[2],a[0]),Math.max(b[3],a[1])],[Infinity,Infinity,-Infinity,-Infinity]);
    const cell=Math.max(box[2]-box[0],box[3]-box[1],1e-6)/(res-2),bx=box[0]-cell,by=box[1]-cell;
    let depth;
    if(p.occlusion) {
      depth=new Float64Array(res*res);depth.fill(-Infinity);
      for(const t of triangles) {
        const [a,b,c]=t.f.map(i=>[(pv[i][0]-bx)/cell,(pv[i][1]-by)/cell,pv[i][2]]);
        const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-9)continue;
        const xl=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xr=Math.min(res-1,Math.ceil(Math.max(a[0],b[0],c[0])));
        const yl=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),yr=Math.min(res-1,Math.ceil(Math.max(a[1],b[1],c[1])));
        for(let y=yl;y<=yr;y++)for(let x=xl;x<=xr;x++) {
          const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/det;
          const v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/det,w=1-u-v;
          if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8){const d=u*a[2]+v*b[2]+w*c[2],idx=y*res+x;if(d>depth[idx])depth[idx]=d;}
        }
      }
    }
    const visible=a=>{if(!depth)return true;const x=Math.floor((a[0]-bx)/cell),y=Math.floor((a[1]-by)/cell);return x<0||x>=res||y<0||y>=res||a[2]>=depth[y*res+x]-cell*.7;};
    const paths=[],orders=[];let emitted=0;const budgetRng=mulberry32(72853);
    const emit=(a,b,layer)=>{const aa=[ox+a[0]*scale,oy+a[1]*scale],bb=[ox+b[0]*scale,oy+b[1]*scale];if(Math.hypot(aa[0]-bb[0],aa[1]-bb[1])>1e-7){const q={pts:[aa,bb],closed:false,layer},order=emitted++;if(paths.length<55000){paths.push(q);orders.push(order);}else{const k=Math.floor(budgetRng()*emitted);if(k<55000){paths[k]=q;orders[k]=order;}}}};
    // Visit every segment: a fixed stride can select only base rings and lose
    // every spike axis. The bounded reservoir above thins whole strokes uniformly.
    for(let i=0;i<segments.length;i++) {
      const s=segments[i];if(!depth){emit(s.a,s.b,s.layer);continue;}
      const samples=Math.max(1,Math.min(1400,Math.ceil(Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1])/cell*2)));
      let start=null,previous=s.a,prevVisible=visible(s.a);if(prevVisible)start=s.a;
      for(let j=1;j<=samples;j++) {
        const a=s.a.map((v,k)=>v+(s.b[k]-v)*j/samples),v=visible(a);
        if(v!==prevVisible) {
          let lo=previous,hi=a;
          for(let it=0;it<5;it++){const mid=lo.map((v,k)=>(v+hi[k])/2);if(visible(mid)===prevVisible)lo=mid;else hi=mid;}
          const boundary=lo.map((v,k)=>(v+hi[k])/2);
          if(prevVisible&&start)emit(start,boundary,s.layer);else start=boundary;
        }
        if(v&&j===samples&&start)emit(start,a,s.layer);
        previous=a;prevVisible=v;
      }
    }
    const ordered=paths.map((q,i)=>({q,order:orders[i]})).sort((a,b)=>a.order-b.order).map(a=>a.q);
    const style=ins?.[1];
    if(!isStyle(style)||style.mode==="Solid")return {paths:ordered};
    // Every source stroke is straight. Stream style chunks, retaining their
    // exact endpoints rather than redundant collinear interpolation points.
    // Coarsen gap on dense jobs before applyStyle can allocate millions of dashes.
    const totalLength=ordered.reduce((s,q)=>s+Math.hypot(q.pts[1][0]-q.pts[0][0],q.pts[1][1]-q.pts[0][1]),0);
    const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
    const st={...style,dash:Math.max(.1,finite(style.dash,4)),gap:Math.max(.1,finite(style.gap,3),totalLength/10000),vary:Math.max(0,Math.min(1,finite(style.vary,0))),phase:Math.max(0,finite(style.phase,0)),seed:finite(style.seed,4)};
    const result=[],sequence=[];let seen=0;const styleRng=mulberry32(91217);
    for(let i=0;i<ordered.length;i+=64) {
      const chunk=applyStyle({paths:ordered.slice(i,i+64)},{...st,seed:(st.seed*131+i*977)/131});
      for(const q of chunk.paths) {
        const path={...q,pts:[q.pts[0],q.pts[q.pts.length-1]]},order=seen++;
        if(result.length<55000){result.push(path);sequence.push(order);}
        else{const k=Math.floor(styleRng()*seen);if(k<55000){result[k]=path;sequence[k]=order;}}
      }
    }
    return {paths:result.map((q,i)=>({q,order:sequence[i]})).sort((a,b)=>a.order-b.order).map(a=>a.q)};
  },
};
