/* Export a surface point cloud from the authored human avatar mesh. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {buildAvatarMesh} from '../src/avatar-geometry.js';
const preset=String(process.argv[2]||'Male').toLowerCase()==='female'?'Female':'Male';
const destination=resolve(process.argv[3]||'output/'+preset.toLowerCase()+'-avatar.ply');
const count=Math.max(100,Math.min(200000,Math.round(+process.argv[4]||20000)));
const mesh=buildAvatarMesh({preset,variation:0},{quality:'review'});
const cumulative=new Float64Array(mesh.tri);
let total=0;
for(let t=0;t<mesh.tri;t++){
 const i=t*9,v=mesh.v,ab=[v[i+3]-v[i],v[i+4]-v[i+1],v[i+5]-v[i+2]],ac=[v[i+6]-v[i],v[i+7]-v[i+1],v[i+8]-v[i+2]];
 total+=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])/2;cumulative[t]=total;
}
let seed=1733;
const random=()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const rows=['ply','format ascii 1.0','comment MakeHuman HM08 derived adult '+preset+' surface points; source assets CC0 1.0','comment X across; negative Y front; Z up; body height normalized to one','element vertex '+count,'property float x','property float y','property float z','property float nx','property float ny','property float nz','end_header'];
for(let p=0;p<count;p++){
 const target=random()*total;let lo=0,hi=mesh.tri-1;while(lo<hi){const mid=(lo+hi)>>>1;if(cumulative[mid]<target)lo=mid+1;else hi=mid;}
 const i=lo*9,v=mesh.v,a=[v[i],v[i+1],v[i+2]],b=[v[i+3],v[i+4],v[i+5]],c=[v[i+6],v[i+7],v[i+8]];
 const s=Math.sqrt(random()),t=random(),weights=[1-s,s*(1-t),s*t];
 const q=a.map((value,k)=>value*weights[0]+b[k]*weights[1]+c[k]*weights[2]);
 const ab=b.map((value,k)=>value-a[k]),ac=c.map((value,k)=>value-a[k]);
 const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal)||1;
 rows.push([...q,...normal.map(value=>value/length)].map(value=>value.toFixed(6)).join(' '));
}
await mkdir(dirname(destination),{recursive:true});await writeFile(destination,rows.join('\n')+'\n');console.log(destination+' ('+count+' points)');
