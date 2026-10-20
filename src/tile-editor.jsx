import React, {useRef, useState} from 'react';

const START=[0,.5],END=[.5,0];
export default function TileEditor({value,onChange,label,theme:T}){
 const safe=Array.isArray(value)?value.filter(q=>Array.isArray(q)&&q.length>=2&&q.slice(0,2).every(Number.isFinite)).slice(0,6):[];
 const [selected,setSelected]=useState(0),drag=useRef(null),svg=useRef(null),latest=useRef(safe);latest.current=safe;
 const index=Math.min(selected,Math.max(0,safe.length-1));
 const change=(i,x,y)=>{const next=latest.current.map(q=>q.slice());if(!next[i])return;next[i]=[Math.max(.01,Math.min(.99,x)),Math.max(.01,Math.min(.99,y)),next[i][2]===0?0:1];latest.current=next;onChange(next);};
 const move=e=>{if(drag.current===null)return;const r=svg.current.getBoundingClientRect();change(drag.current,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);};
 const control={background:T.panel2,color:T.text,border:'1px solid '+T.line,borderRadius:3,padding:'3px 5px',font:'inherit',fontSize:10};
 return <div style={{marginBottom:8}} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
  <div style={{fontSize:10,color:T.dim,marginBottom:4}}>{label} · drag points; double-click for a corner</div>
  <svg ref={svg} viewBox="0 0 160 160" role="group" aria-label={label+' corner control points'} style={{width:'100%',maxHeight:160,display:'block',background:T.paper,touchAction:'none',border:'1px solid '+T.line,borderRadius:3}}
   onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
   <path d="M0 80L80 0" fill="none" stroke={T.paperLine}/>
   <polyline points={[START,...safe,END].map(q=>q.slice(0,2).map(v=>v*160).join(',')).join(' ')} fill="none" stroke={T.dim} strokeDasharray="3 3"/>
   {[START,END].map((q,i)=><rect key={i} x={q[0]*160-3} y={q[1]*160-3} width="6" height="6" fill={T.dim}/>)}
   {safe.map((q,i)=><g key={i}>
    <circle cx={q[0]*160} cy={q[1]*160} r="11" fill="transparent" onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current=i;setSelected(i);}} onDoubleClick={()=>onChange(latest.current.map((v,k)=>k===i?[v[0],v[1],v[2]===0?1:0]:v.slice()))}/>
    {q[2]===0?<rect pointerEvents="none" x={q[0]*160-4} y={q[1]*160-4} width="8" height="8" fill={i===index?T.accent:T.style}/>:<circle pointerEvents="none" cx={q[0]*160} cy={q[1]*160} r="4" fill={i===index?T.accent:T.style}/>}
   </g>)}
  </svg>
  <div style={{display:'flex',gap:5,alignItems:'center',marginTop:4,flexWrap:'wrap'}}>
   <select aria-label={label+' selected point'} value={index} onChange={e=>setSelected(+e.target.value)} style={control}>{safe.map((_,i)=><option key={i} value={i}>Point {i+1}</option>)}</select>
   {['X','Y'].map((axis,k)=><label key={axis} style={{fontSize:10,color:T.dim}}>{axis} % <input aria-label={label+' '+axis+' percent'} type="number" min="1" max="99" step="1" value={Math.round((safe[index]?.[k]??.5)*100)} onChange={e=>{const v=+e.target.value;if(!Number.isFinite(v))return;change(index,k===0?v/100:(safe[index]?.[0]??.5),k===1?v/100:(safe[index]?.[1]??.5));}} style={{...control,width:43}}/></label>)}
   <button type="button" disabled={safe.length>=6} style={control} onClick={()=>{onChange([...safe,[.5,.5,1]]);setSelected(safe.length);}}>Add point</button>
   <button type="button" disabled={safe.length<=1} style={control} onClick={()=>{onChange(safe.filter((_,i)=>i!==index));setSelected(Math.max(0,index-1));}}>Remove</button>
   <label style={{fontSize:10,color:T.dim}}><input type="checkbox" aria-label={label+' square corner'} checked={safe[index]?.[2]===0} onChange={e=>onChange(safe.map((q,i)=>i===index?[q[0],q[1],e.target.checked?0:1]:q.slice()))}/> Square corner</label>
  </div>
 </div>;
}
