import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFrameNumber } from '../src/number-detection.ts';
import { NUMBER_GLYPHS } from '../src/number-glyphs.ts';
import { fontStrokes, SFONT } from '../../src/defs/helpers.js';
import { project, solveHomography } from '../src/homography.ts';

const cw=84,ch=73+2/3;
function scene(number,{dark=false,rotation=0,dy=1.2,clipped=false,missing=false,scribble=false}={}) {
  const width=900,height=900,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const light=dark?28+10*x/width:235-22*y/height,grain=((x*31+y*73+x*y)%17)-8;
    data.set([light+grain,light+grain,light+grain,255],(y*width+x)*4);
  }
  const quad=[{x:150,y:140},{x:740,y:185},{x:705,y:705},{x:170,y:745}];
  const transform=solveHomography([{x:0,y:0},{x:cw,y:0},{x:cw,y:ch},{x:0,y:ch}],quad);
  const point=(x,y)=>{const p=project(transform,x,y),a=rotation*Math.PI/180;return{x:450+(p.x-450)*Math.cos(a)-(p.y-450)*Math.sin(a),y:450+(p.x-450)*Math.sin(a)+(p.y-450)*Math.cos(a)};};
  const line=(a,b)=>{
    const pa=point(...a),pb=point(...b),steps=Math.ceil(Math.hypot(pb.x-pa.x,pb.y-pa.y)*3);
    for(let i=0;i<=steps;i++){const xx=pa.x+(pb.x-pa.x)*i/steps,yy=pa.y+(pb.y-pa.y)*i/steps;
      for(let y=Math.floor(yy-1);y<=Math.ceil(yy+1);y++)for(let x=Math.floor(xx-1);x<=Math.ceil(xx+1);x++)if(x>=0&&y>=0&&x<width&&y<height&&Math.hypot(x+.5-xx,y+.5-yy)<=1)data.set(dark?[180,245,100,255]:[30,30,35,255],(y*width+x)*4);
    }
  };
  const label=(value,y)=>{const fs=fontStrokes(String(value),3);for(const stroke of fs.strokes)for(let i=1;i<stroke.length;i++)line([cw/2-fs.width/2+stroke[i-1][0],y+stroke[i-1][1]],[cw/2-fs.width/2+stroke[i][0],y+stroke[i][1]]);};
  line([0,ch],[cw,ch]);line([0,ch+8],[cw,ch+8]);
  label(99,-5); // A neighboring frame's number must never be selected.
  if(!missing)label(number,ch+dy);
  if(scribble){line([cw/2-1,ch+dy],[cw/2+1,ch+dy+3]);line([cw/2+1,ch+dy],[cw/2-1,ch+dy+3]);}
  if(clipped){const edge=point(cw/2,ch+dy+1.6).y;for(let y=Math.floor(edge);y<height;y++)for(let x=0;x<width;x++)data.set(dark?[25,25,25,255]:[235,235,235,255],(y*width+x)*4);}
  return {raster:{width,height,data},points:[point(0,0),point(cw,0),point(cw,ch),point(0,ch)]};
}

test('recognition templates match Muusia’s actual plotted digits',()=>{
  for(let i=0;i<=9;i++)assert.deepEqual(NUMBER_GLYPHS[i],SFONT[i]);
});
for(const dark of [false,true])test(`reads every number 1–24 and multi-digit labels on ${dark?'dark':'light'} paper`,()=>{
  for(const value of [...Array.from({length:24},(_,i)=>i+1),64,128,999999]) {
    const {raster,points}=scene(value,{dark});
    const result=detectFrameNumber(raster,points,{cw,ch,paperTone:dark?'dark':'light'});
    assert.equal(result.value,value,JSON.stringify({value,result}));
  }
});
for(const rotation of [90,180,270,31])test(`printed number follows registered orientation at ${rotation} degrees`,()=>{
  const {raster,points}=scene(15,{rotation});
  assert.equal(detectFrameNumber(raster,points,{cw,ch}).value,15);
});
for(const options of [{missing:true},{clipped:true},{scribble:true}])test(`uncertain label stays unset: ${JSON.stringify(options)}`,()=>{
  const {raster,points}=scene(5,options);
  assert.equal(detectFrameNumber(raster,points,{cw,ch}).status,'unreadable');
});
test('vertical plot drift below the frame is tolerated without including the next frame',()=>{
  for(const dy of [.5,2.3]){const{raster,points}=scene(21,{dy});assert.equal(detectFrameNumber(raster,points,{cw,ch}).value,21);}
});
test('numbers remain readable where the bottom frame outline crosses their strokes',()=>{
  for(const dark of [false,true])for(const value of [5,9,20,23]) {
    const {raster,points}=scene(value,{dy:-1.2,dark});
    assert.equal(detectFrameNumber(raster,points,{cw,ch,paperTone:dark?'dark':'light'}).value,value);
  }
});
