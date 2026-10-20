import {surfaceDrawing} from '../plotter-utilities.js';
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
key:'automata_3d',name:'3D Automata',cat:'gen',group:'structural',
 desc:'A bounded 3D cellular automaton: each generation counts live neighbours in the selected 6-, 18- or 26-cell neighbourhood. Birth and Survival are comma-separated counts or ranges (for example 4-6,9); blank Survival means none. Finite boundaries remain dead; there is no wrap. Single seed or seeded noise initializes the volume. Manual Generation or Timeline reconstructs exactly that generation, not a cumulative union: cells may die. Only exposed voxel faces are emitted. Drawing uses a shared approximate depth raster; thin distant edges can disappear. Mesh is a normalized closed voxel boundary for Mesh Render / Slice / Spikes. Simulation max 22³ cells and 24 generations; mesh max 120k triangles, with volume resolution lowered uniformly when needed. Nothing moves machine Z.',
 ins:[Pin('style','Style')],outs:[Pin('paths','Drawing'),Pin('mesh','Mesh'),Pin('value','Live cells')],
 params:[{key:'volume',label:'Volume side',type:'slider',min:5,max:22,step:1,def:15},{key:'neighbours',label:'Neighbourhood',type:'select',options:['6 faces','18 faces + edges','26 all'],def:'6 faces'},
 {key:'birth',label:'Birth counts',type:'text',def:'1-3'},{key:'survival',label:'Survival counts',type:'text',def:'1-6'},
 {key:'initial',label:'Initial state',type:'select',options:['Single seed','Noise'],def:'Single seed'},
 {key:'density',label:'Initial live %',type:'slider',min:1,max:50,step:1,def:8,showIf:p=>p.initial==='Noise'},
 {key:'motion',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual'},
 {key:'generations',label:'Mature generation',type:'slider',min:0,max:24,step:1,def:7,showIf:p=>p.motion==='Timeline'},
 {key:'generation',label:'Generation',type:'slider',min:0,max:24,step:1,def:7,showIf:p=>p.motion!=='Timeline'},
 {key:'seed',label:'Seed',type:'seed',def:19,showIf:p=>p.initial==='Noise'}, {key:'yaw',label:'View angle °',type:'slider',min:-180,max:180,step:1,def:25},
 {key:'elevation',label:'View elevation °',type:'slider',min:5,max:85,step:1,def:30},
 {key:'persp',label:'Perspective',type:'slider',min:0,max:.7,step:.05,def:0},
 {key:'hidden',label:'Hidden-line removal',type:'check',def:true},
 {key:'size',label:'Size mm',type:'slider',min:20,max:400,step:1,def:155},
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
 {key:'layer',label:'Pen',type:'pen',def:0}],
 overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
 _box(a,b){const v=Array.from({length:8},(_,i)=>[i&1?b[0]:a[0],i&2?b[1]:a[1],i&4?b[2]:a[2]]);return [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]].map(f=>f.map(i=>v[i]));},
 _state(p,c){const n=Math.max(5,Math.min(22,Math.round(+p.volume||15))),N=n*n*n,rng=mulberry32(+p.seed||0),parse=s=>{const a=new Set();for(const part of String(s??'').split(',')){const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(m){const x=+m[1],y=m[2]===undefined?x:+m[2];for(let k=x;k<=Math.min(26,y);k++)a.add(k);}}return a;},B=parse(p.birth),S=parse(p.survival),ds=[],kind=parseInt(p.neighbours)||6;for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const d=Math.abs(x)+Math.abs(y)+Math.abs(z);if(d&&d<=(kind===6?1:kind===18?2:3))ds.push([x,y,z]);}
 let a=new Uint8Array(N),b=new Uint8Array(N);if(p.initial==='Noise')for(let k=0;k<N;k++)a[k]=+(rng()<Math.max(.01,Math.min(.5,(+p.density||8)/100)));else {const k=Math.floor(n/2);a[(k*n+k)*n+k]=1;}
 const gen=p.motion==='Timeline'?Math.round(Math.max(0,Math.min(1,c.frameCount>1?c.frameIdx/(c.frameCount-1):0))*Math.max(0,Math.min(24,+p.generations||0))):Math.max(0,Math.min(24,Math.round(+p.generation||0)));
 for(let g=0;g<gen;g++){for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){let count=0;for(const [dx,dy,dz]of ds){const X=x+dx,Y=y+dy,Z=z+dz;if(X>=0&&X<n&&Y>=0&&Y<n&&Z>=0&&Z<n)count+=a[(Z*n+Y)*n+X];}const k=(z*n+y)*n+x;b[k]=+(a[k]?S.has(count):B.has(count));}[a,b]=[b,a];}return {a,n,ds};
 },
 compute(ins,p,c){const {a,n,ds}=this._state(p,c),faces=[],directions=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];let live=0;for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){if(!a[(z*n+y)*n+x])continue;live++;const box=this._box([x,y,z],[x+1,y+1,z+1]);for(let f=0;f<6;f++){const [dx,dy,dz]=directions[f],X=x+dx,Y=y+dy,Z=z+dz;if(X<0||X>=n||Y<0||Y>=n||Z<0||Z>=n||!a[(Z*n+Y)*n+X])faces.push(box[f]);}}
 if(faces.length>60000)return this.compute(ins,{...p,volume:Math.max(5,n-2)},c);const result=surfaceDrawing(faces,p,c,ins[0]);return [...result,live];}

};
