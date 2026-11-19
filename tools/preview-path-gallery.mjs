import * as H from '../src/defs/helpers.js';

export function raster(items,width,height){
 const pixels=new Uint8Array(width*height),cols=2,cellW=width/cols,cellH=height/Math.ceil(items.length/cols);
 const line=(a,b,r=.5)=>{const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*1.4));for(let i=0;i<=steps;i++){const x=a[0]+(b[0]-a[0])*i/steps,y=a[1]+(b[1]-a[1])*i/steps;for(let yy=Math.floor(y-r);yy<=Math.ceil(y+r);yy++)for(let xx=Math.floor(x-r);xx<=Math.ceil(x+r);xx++)if(xx>=0&&yy>=0&&xx<width&&yy<height&&(xx-x)**2+(yy-y)**2<=r*r+.12)pixels[yy*width+xx]=1;}};
 for(const [i,{name,result,ctx}]of items.entries()){
  const ox=i%cols*cellW,oy=Math.floor(i/cols)*cellH,scale=Math.min((cellW-24)/ctx.W,(cellH-36)/ctx.H),dx=(cellW-ctx.W*scale)/2,dy=30+(cellH-36-ctx.H*scale)/2;
  for(const s of H.fontStrokes(name,8,1).strokes)for(let j=1;j<s.length;j++)line([ox+12+s[j-1][0],oy+9+s[j-1][1]],[ox+12+s[j][0],oy+9+s[j][1]]);
  for(const q of result.paths)for(let j=0;j<q.pts.length-(q.closed?0:1);j++){const a=q.pts[j],b=q.pts[(j+1)%q.pts.length];line([ox+dx+a[0]*scale,oy+dy+a[1]*scale],[ox+dx+b[0]*scale,oy+dy+b[1]*scale],Math.max(.35,.15*scale));}
 }return pixels;
}
