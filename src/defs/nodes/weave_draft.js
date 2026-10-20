import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "weave_draft", name: "Weave Draft", cat: "gen", group: "geometric",
  desc: "Draw a textile from a repeatable over/under draft. Warp runs vertically, weft horizontally. Plain, 2/2 Twill, 2/2 Basket and 5-end Satin are built in; Custom rows uses 1 for warp over and 0 for weft over, with | between equal-length rows (up to 16×16). Warp and weft colour sequences use pen-slot:thread-count entries, for example 1:8,2:4,3:8. Pen slots refer to the selected Pen 1–4 controls, not machine pen numbers. Repeat repeats bands, Mirror doubles the end bands, Point turns back without repeating either end band. Underpass clearance removes the lower thread beneath the full crossing band. Parallel lines gives each thread physical width; dense requests reduce parallel lines uniformly, retaining all requested warp and weft threads. Fit to margin only shrinks an oversized cloth; Keep pitch clips it to the margin. Pitch used and Lines used report the actual drawing values. This is drawn textile structure, not loom instructions.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Drawing"), Pin("value", "Pitch used mm"), Pin("value", "Lines used")],
  params: [
    {key:"pattern",label:"Weave",type:"select",options:["Plain","2/2 Twill","2/2 Basket","5-end Satin","Custom"],def:"2/2 Twill"},
    {key:"draft",label:"Draft rows (1 = warp over)",type:"text",def:"10|01",showIf:p=>p.pattern==="Custom"},
    {key:"warp",label:"Warp threads",type:"slider",min:4,max:160,step:1,def:60},
    {key:"weft",label:"Weft threads",type:"slider",min:4,max:160,step:1,def:40},
    {key:"pitch",label:"Thread pitch mm",type:"slider",min:1,max:12,step:.25,def:4},
    {key:"width",label:"Thread width %",type:"slider",min:5,max:85,step:1,def:45},
    {key:"tracks",label:"Parallel lines",type:"slider",min:1,max:7,step:1,def:3},
    {key:"clearance",label:"Underpass clearance mm",type:"slider",min:.1,max:4,step:.1,def:.5},
    {key:"colours",label:"Pen slots",type:"slider",min:2,max:4,step:1,def:2},
    {key:"pen1",label:"Pen 1",type:"pen",def:0},
    {key:"pen2",label:"Pen 2",type:"pen",def:1},
    {key:"pen3",label:"Pen 3",type:"pen",def:7,showIf:p=>p.colours>=3},
    {key:"pen4",label:"Pen 4",type:"pen",def:10,showIf:p=>p.colours>=4},
    {key:"warpColours",label:"Warp colours (slot:count)",type:"text",def:"1:8,2:4"},
    {key:"weftColours",label:"Weft colours (slot:count)",type:"text",def:"2:8,1:4"},
    {key:"warpRepeat",label:"Warp repeat",type:"select",options:["Repeat","Mirror","Point"],def:"Repeat"},
    {key:"weftRepeat",label:"Weft repeat",type:"select",options:["Repeat","Mirror","Point"],def:"Point"},
    {key:"sizing",label:"Oversize cloth",type:"select",options:["Fit to margin","Keep pitch (crop)"],def:"Fit to margin"},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:15}
  ],
  _number(v,d,lo,hi){return Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));},
  _layout(p,c){const n=this._number,W=n(c.W,297,1,100000),H=n(c.H,210,1,100000),m=n(p.margin,15,0,Math.min(W,H)/2),cols=Math.round(n(p.warp,60,1,160)),rows=Math.round(n(p.weft,40,1,160));
    let pitch=n(p.pitch,4,.2,1000);if(p.sizing!=='Keep pitch (crop)')pitch=Math.min(pitch,(W-2*m)/cols,(H-2*m)/rows);
    const tracks=Math.min(Math.round(n(p.tracks,3,1,7)),Math.max(1,Math.floor(100000/(4*cols*rows+4*cols+4*rows))));
    return {W,H,m,cols,rows,pitch,tracks,x:(W-cols*pitch)/2,y:(H-rows*pitch)/2,w:cols*pitch,h:rows*pitch};
  },
  _sequence(text,repeat,colours){
    const words=String(text??'').trim().split(/[,\s]+/).filter(Boolean);if(!words.length||words.length>32)return null;
    const bands=[];for(const word of words){const m=/^([1-4])(?::(\d{1,3}))?$/.exec(word);if(!m||+m[1]>colours||+(m[2]||1)<1||+(m[2]||1)>128)return null;bands.push([+m[1]-1,+(m[2]||1)]);}
    const turn=repeat==='Mirror'?bands.slice().reverse():repeat==='Point'?bands.slice(1,-1).reverse():[];
    return [...bands,...turn].flatMap(([pen,count])=>Array(count).fill(pen));
  },
  _draft(p){
    if(p.pattern==='Custom'){
      const rows=String(p.draft??'').replace(/\s/g,'').split('|');if(!rows.length||rows.length>16||!rows[0].length||rows[0].length>16||rows.some(r=>r.length!==rows[0].length||!/^[01]+$/.test(r)))return null;
      return rows.map(r=>[...r].map(Number));
    }
    const size=p.pattern==='Plain'?2:p.pattern==='5-end Satin'?5:4;
    return Array.from({length:size},(_,r)=>Array.from({length:size},(_,c)=>p.pattern==='Plain'?(r+c)%2===0?1:0:p.pattern==='5-end Satin'?(c-2*r+size*2)%size===0?1:0:p.pattern==='2/2 Basket'?(Math.floor(r/2)+Math.floor(c/2))%2===0?1:0:(c-r+size)%size<2?1:0));
  },
  overlay(p,c){const g=this._layout(p,c);return g.W-2*g.m>0&&g.H-2*g.m>0?[{kind:"rect",x:Math.max(g.m,g.x),y:Math.max(g.m,g.y),w:Math.min(g.W-g.m,g.x+g.w)-Math.max(g.m,g.x),h:Math.min(g.H-g.m,g.y+g.h)-Math.max(g.m,g.y)}]:[];},
  compute(ins,p,c){
    const g=this._layout(p,c),n=this._number,empty=[EMPTY,0,0];if(!(g.pitch>0&&g.W-2*g.m>0&&g.H-2*g.m>0))return empty;
    const colours=Math.round(n(p.colours,2,2,4)),warp=this._sequence(p.warpColours??'1:8,2:4',p.warpRepeat,colours),weft=this._sequence(p.weftColours??'2:8,1:4',p.weftRepeat,colours),draft=this._draft(p);
    if(!warp||!weft||!draft)return empty;
    const pens=[p.pen1,p.pen2,p.pen3,p.pen4].map((v,i)=>Math.round(n(v,[0,1,7,10][i],0,11))),width=g.pitch*n(p.width,45,0,95)/100,cut=width/2+n(p.clearance,.5,0,1000),paths=[];
    const over=(col,row)=>draft[row%draft.length][col%draft[0].length]===1;
    for(const vertical of [true,false]){
      const count=vertical?g.cols:g.rows,crossings=vertical?g.rows:g.cols,along0=vertical?g.y:g.x,along1=along0+(vertical?g.h:g.w),across0=vertical?g.x:g.y,sequence=vertical?warp:weft;
      for(let thread=0;thread<count;thread++)for(let track=0;track<g.tracks;track++){
        const across=across0+(thread+.5)*g.pitch+(g.tracks===1?0:(track/(g.tracks-1)-.5)*width);
        const min=vertical?g.m:g.m,max=vertical?g.W-g.m:g.H-g.m;if(across<min||across>max)continue;
        const layer=pens[sequence[thread%sequence.length]],group=(vertical?'warp:':'weft:')+thread;
        const emit=(a,b)=>{a=Math.max(a,g.m);b=Math.min(b,vertical?g.H-g.m:g.W-g.m);if(b-a<=1e-8)return;paths.push({pts:vertical?[[across,a],[across,b]]:[[a,across],[b,across]],closed:false,layer,group});};
        let cursor=along0;
        for(let j=0;j<crossings;j++){
          const above=vertical?over(thread,j):!over(j,thread);if(above)continue;
          const centre=along0+(j+.5)*g.pitch,a=Math.max(along0,centre-cut),b=Math.min(along1,centre+cut);
          if(a>cursor)emit(cursor,a);cursor=Math.max(cursor,b);
        }
        if(cursor<along1)emit(cursor,along1);
      }
    }
    return [applyStyle({paths},ins?.[0]),g.pitch,g.tracks];
  }
};
