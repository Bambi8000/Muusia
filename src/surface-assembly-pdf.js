import { surfaceEdgeAngles, edgeAngleArc, formatEdgeAngle } from "./surface-angles.js";
import { assemblyModel, assemblyPieces, paperRelation, endLabelPaths, labelExtraMm } from "./surface-assembly.js";
import { stripTransform } from "./surface-composer.js";
import { paperBudget } from "./surface-production.js";
import { prepareSurfaceSource } from "./surface-source.js";
import { paperLocalPaths, resolveSurfaceContent } from "./surface-content.js";
import { createStripRasterizer } from "./surface-render.js";

const f = n => Number(n.toFixed(2)).toString();
const safe = s => String(s).normalize("NFKD").replace(/[^\x20-\x7e\u00b0]/g, "");
const pause = () => new Promise(r => setTimeout(r, 0));

/** Assembly overview is scaled; coordinate tables remain exact millimetres.
 * Pair rows describe every visible pair once, in print-order direction. */
export async function exportAssemblyPdf(session, { evaluateGraph, pens = [], projectName = "surface", cancelled = () => false, onProgress = () => {} } = {}) {
  const model = assemblyModel(session), options = model.settings;
  if (!model.papers.length) throw new Error("Show at least one paper for Assembly PDF.");
  if (model.papers.length > 128) throw new Error("Assembly PDF supports up to 128 visible papers. Hide a group and export it separately.");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), M = 72 / 25.4;
  pdf.setTitle(`${projectName} - Assembly`); pdf.setAuthor("Muusia Surface Composer");
  pdf.setSubject("Physical paper positions, registration and assembly relationships in millimetres");
  const ink = rgb(.12,.17,.2), muted = rgb(.36,.42,.45), blue = rgb(.04,.44,.55), accent = rgb(.9,.39,.13), light = rgb(.92,.94,.94);
  const check = () => { if (cancelled()) throw new Error("PDF export cancelled."); };
  const page = (W = 297, H = 210, title = "") => {
    const p = pdf.addPage([W*M,H*M]);
    text(p, "MUUSIA / ASSEMBLY", 12, 12, 9, blue, bold);
    text(p, title, 12, 23, 18, ink, bold);
    text(p, safe(projectName).slice(0,70), W-12, 12, 9, muted, font, "right");
    return p;
  };
  function text(p, value, x, y, size = 9, color = ink, face = font, align = "left") {
    value = safe(value); const width = face.widthOfTextAtSize(value,size);
    p.drawText(value, { x: x*M - (align === "right" ? width : align === "center" ? width/2 : 0), y: p.getHeight()-y*M-size*.78, size, font: face, color });
  }
  function line(p,a,b,color = muted,width = .25,dash = false) {
    p.drawLine({ start:{x:a[0]*M,y:p.getHeight()-a[1]*M},end:{x:b[0]*M,y:p.getHeight()-b[1]*M},color,thickness:width*M,...(dash ? {dashArray:[2,2]}:{}) });
  }
  function rect(p,x,y,w,h,fill = light) { p.drawRectangle({x:x*M,y:p.getHeight()-(y+h)*M,width:w*M,height:h*M,color:fill}); }
  function cross(p,point,r = 1.2) { line(p,[point[0]-r,point[1]],[point[0]+r,point[1]],blue,.2);line(p,[point[0],point[1]-r],[point[0],point[1]+r],blue,.2); }
  function stroke(p,points,closed,color,width) {
    if (points.length < 2) return;
    const commands = points.map((q,i) => `${i ? "L" : "M"}${q[0]*M} ${q[1]*M}`).join(" ") + (closed ? " Z" : "");
    p.drawSvgPath(commands, {x:0,y:p.getHeight(),borderColor:color,borderWidth:width*M});
  }
  const edgeAngles = options.edgeAngles ? surfaceEdgeAngles(session.strips) : [];
  const source = options.artwork ? await prepareSurfaceSource(session,evaluateGraph) : null;
  const overview = page(420,297,"Assembly overview");
  const points = model.papers.flatMap(p=>p.corners), minX = Math.min(0,...points.map(p=>p[0])), minY = Math.min(0,...points.map(p=>p[1])), maxX = Math.max(session.widthMm,...points.map(p=>p[0])), maxY = Math.max(session.heightMm,...points.map(p=>p[1]));
  const scale = Math.min(290/(maxX-minX || 1),224/(maxY-minY || 1)), x0 = 12+(290-(maxX-minX)*scale)/2, y0 = 43+(224-(maxY-minY)*scale)/2;
  const map = q => [x0+(q[0]-minX)*scale,y0+(q[1]-minY)*scale];
  const frame = [[0,0],[session.widthMm,0],[session.widthMm,session.heightMm],[0,session.heightMm]];
  stroke(overview,frame.map(map),true,muted,.25);
  text(overview,`Surface ${f(session.widthMm)} x ${f(session.heightMm)} mm | diagram scale 1:${f(1/scale)}`,12,33,9,muted);
  let vertices = 0;
  for (const paper of [...model.papers].sort((a,b)=>a.zIndex-b.zIndex || session.strips.findIndex(p=>p.id===a.id)-session.strips.findIndex(p=>p.id===b.id))) {
    check(); const corners=paper.corners.map(map), t=stripTransform(paper), localMap=q=>map(t.toGlobal(q));
    const d=corners.map((q,i)=>`${i?'L':'M'}${q[0]*M} ${q[1]*M}`).join(' ')+' Z';
    overview.drawSvgPath(d,{x:0,y:overview.getHeight(),color:rgb(1,1,.99),borderColor:muted,borderWidth:.3});
    if (source?.paths) {
      const paths=paperLocalPaths(source,session,paper).paths;
      vertices+=paths.reduce((n,p)=>n+p.pts.length,0);
      if(vertices>1000000) throw new Error("Artwork exceeds the PDF drawing budget. Turn off Artwork in PDF or export fewer papers.");
      for(const path of paths){
        const color=pens[path.layer % pens.length]?.c || '#222222';
        const parsed=/^#([0-9a-f]{6})$/i.exec(color), n=parsed ? parseInt(parsed[1],16) : 0x222222;
        stroke(overview,path.pts.map(localMap),path.closed,rgb((n>>16)/255,((n>>8)&255)/255,(n&255)/255),Math.max(.07,.3*scale));
      }
    } else if(source?.image){
      const resolved=resolveSurfaceContent(source,session,paper), density=Math.min(2,1200/Math.max(paper.physicalWidthMm,paper.lengthMm));
      const renderer=createStripRasterizer(resolved.source.image,resolved.source.placement,resolved.frame,resolved.strip,{dotsPerMmX:density,area:'paper'});
      const canvas=document.createElement('canvas');canvas.width=renderer.plan.width;canvas.height=renderer.plan.height;
      const ctx=canvas.getContext('2d'); if(!ctx)throw new Error('PDF image rendering unavailable.');
      for(let r=0;r<canvas.height;r+=256){const block=renderer.renderBlock(r,Math.min(256,canvas.height-r));ctx.putImageData(new ImageData(block.data,block.width,block.height),0,r);}
      const image=await pdf.embedPng(canvas.toDataURL('image/png'));
      const bottomLeft=localMap([0,paper.lengthMm]);
      const {degrees}=await import('pdf-lib');
      overview.drawImage(image,{x:bottomLeft[0]*M,y:overview.getHeight()-bottomLeft[1]*M,width:paper.physicalWidthMm*scale*M,height:paper.lengthMm*scale*M,rotate:degrees(-paper.rotationDeg)});
    }
    onProgress(`Drawing paper ${paper.rank}/${model.papers.length}`);await pause();
  }
  for (const paper of model.papers) {
    const corners = paper.corners.map(map);
    if(options.registration){cross(overview,corners[0]);cross(overview,corners[1]);text(overview,'A',corners[0][0]+1.8,corners[0][1]-1.8,6,blue);text(overview,'B',corners[1][0]+1.8,corners[1][1]-1.8,6,blue);}
    if(options.numbers){const c=map([paper.centerXmm,paper.centerYmm]);overview.drawCircle({x:c[0]*M,y:overview.getHeight()-c[1]*M,size:3*M,color:accent});text(overview,paper.number,c[0],c[1]-1.1,9,rgb(1,1,1),bold,'center');}
  }
  if (options.edgeAngles) {
    const purple=rgb(.68,.08,.57), boxes=[];
    for (const angle of edgeAngles) {
      const centre=map(angle.vertex), radius=4, arc=edgeAngleArc(angle,centre,radius), mid=angle.startRad+angle.sweepRad/2;
      stroke(overview,arc,false,purple,.35);
      for(const a of [angle.startRad,angle.startRad+angle.sweepRad])line(overview,centre,[centre[0]+6*Math.cos(a),centre[1]+6*Math.sin(a)],purple,.18);
      const title=formatEdgeAngle(angle.angleDeg), caption=`${angle.id}  P${angle.from.number}/P${angle.to.number}`;
      const width=Math.max(bold.widthOfTextAtSize(title,10),font.widthOfTextAtSize(caption,7))/M+2.4,height=8;
      let chosen=null,best=-Infinity;
      for(const distance of [10,14,18,23])for(const offset of [0,.25,-.25,.5,-.5]) {
        const x=centre[0]+distance*Math.cos(mid+offset),y=centre[1]+distance*Math.sin(mid+offset),box={x:x-width/2,y:y-height/2,w:width,h:height};
        const collisions=boxes.filter(b=>box.x<b.x+b.w+1&&box.x+box.w+1>b.x&&box.y<b.y+b.h+1&&box.y+box.h+1>b.y).length;
        const outside=box.x<10||box.x+box.w>303||box.y<39||box.y+box.h>275;
        const score=-collisions*1000-(outside?10000:0)-distance-Math.abs(offset)*4;
        if(score>best){best=score;chosen={x,y,box};}
      }
      boxes.push(chosen.box);
      const arcMiddle=arc[Math.floor(arc.length/2)];
      line(overview,arcMiddle,[chosen.x,chosen.y],purple,.15);
      rect(overview,chosen.box.x,chosen.box.y,chosen.box.w,chosen.box.h,rgb(1,1,1));
      text(overview,title,chosen.x,chosen.y-1.4,10,purple,bold,'center');
      text(overview,caption,chosen.x,chosen.y+2,7,purple,font,'center');
    }
    text(overview,'Edge angles / measured opening',314,231,11,purple,bold);
    text(overview,'Arc identifies the two physical edges.',314,238,8,muted);
    edgeAngles.slice(0,6).forEach((a,i)=>text(overview,`${a.id}  P${a.from.number}.${a.from.edge} / P${a.to.number}.${a.to.edge}  ${formatEdgeAngle(a.angleDeg)}`,314,245+i*5,8,purple));
    if(!edgeAngles.length)text(overview,'No visible edge junctions; see rotation table.',314,245,8,muted);
    if(edgeAngles.length>6)text(overview,`${edgeAngles.length} junctions; full list follows.`,314,278,8,muted);
  }
  const isSheets = session.composition?.family === "Sheets";
  const budget=paperBudget(session.strips,session.production,session.assembly);
  if (isSheets) { budget.allowanceM = 0; budget.totalM = budget.artworkM + budget.labelsM; }
  text(overview,`${model.papers.length} visible papers`,314,44,14,ink,bold);
  const notes=[`Body: ${f(budget.artworkM)} m`,`Labels: ${f(budget.labelsM)} m`,`Feed / cut estimate: ${f(budget.allowanceM)} m`,`Total: ${f(budget.totalM)} m`,isSheets ? "Sheet material / combined length" : `Available on roll: ${f(budget.availableM)} m`,isSheets ? "No roll feed allowance for sheet files" : budget.fits?'Fits current roll':`Short by ${f(budget.shortfallM)} m`,'','X right / Y down','Clockwise angles from unrotated paper','A = start-left; B = start-right','C = end-right; D = end-left','Place A, then align start edge A to B.','Layer order: lower first; higher on top.','','Diagrams are scaled.','Use the numeric dimensions to assemble.','Remove temporary end labels after placement.'];
  notes.forEach((value,i)=>text(overview,value,314,55+i*5,8.5,i===3?blue:muted,i===3?bold:font));
  text(overview,'End labels',314,158,12,ink,bold);
  const labelNotes=options.labelMode==='off'?['Off - paper files contain body only.']:options.labelMode==='attached'?[`${f(options.labelLengthMm)} mm attached panel.`,'Cut or remove after assembly.']:[`${f(options.labelLengthMm)} mm tear-off panel.`,`Guide bridge: ${f(options.bridgeMm)} mm at left.`,'Epson uses its fixed hardware bridge.',`Extra cutter feed estimate: ${f(options.cutterFeedMm)} mm.`,'Blank paper can precede label printing.'];
  labelNotes.forEach((v,i)=>text(overview,v,314,168+i*5,8.5,muted));
  text(overview,'Registration crosses are on the label.',314,201,8.5,muted);
  text(overview,'A/B in this guide identify the body corners.',314,207,8.5,muted);
  text(overview,'Roll piece index is listed on each paper page.',314,219,8.5,muted);
  cross(overview,map([0,0]),2);text(overview,'0,0',map([0,0])[0]+3,map([0,0])[1]+3,7,blue);

  if(edgeAngles.length>6)for(let start=0;start<edgeAngles.length;start+=24){
    const p=page(297,210,'Edge junction angles / measured openings');
    text(p,'J marks match the overview. These are edge openings; paper rotation differences remain in the pair table.',12,34,8.5,muted);
    [[12,'Junction'],[38,'Physical edges'],[118,'Opening'],[163,'Vertex X mm'],[225,'Vertex Y mm']].forEach(([x,v])=>text(p,v,x,43,9,blue,bold));
    edgeAngles.slice(start,start+24).forEach((a,i)=>{const y=51+i*5.7;if(i%2===0)rect(p,10,y-1.5,277,5.6);[[12,a.id],[38,`P${a.from.number}.${a.from.edge} / P${a.to.number}.${a.to.edge}`],[118,formatEdgeAngle(a.angleDeg)],[163,f(a.vertex[0])],[225,f(a.vertex[1])]].forEach(([x,v])=>text(p,v,x,y,8));});
  }
  if(options.dimensions) for(let start=0;start<model.papers.length;start+=20){
    const p=page(297,210,'Paper positions / millimetres');
    [[12,'Paper'],[28,'Order'],[43,'Body W x L'],[87,'Centre X / Y'],[139,'Angle'],[170,'Start A X / Y'],[231,'Start B X / Y']].forEach(([x,v])=>text(p,v,x,36,9,blue,bold));
    model.papers.slice(start,start+20).forEach((s,i)=>{
      const y=45+i*7;if(i%2===0)rect(p,10,y-2,277,6.6);
      const columns=[[12,`P${s.number}`],[28,s.rank],[43,`${f(s.physicalWidthMm)} x ${f(s.lengthMm)}`],[87,`${f(s.centerXmm)} / ${f(s.centerYmm)}`],[139,`${f(s.rotationDeg)} deg`],[170,`${f(s.A[0])} / ${f(s.A[1])}`],[231,`${f(s.B[0])} / ${f(s.B[1])}`]];
      columns.forEach(([x,v])=>text(p,v,x,y,8));
    });text(p,'Body dimensions exclude temporary labels and mechanical feed. IDs/numbers remain stable when print order changes.',12,192,8,muted);
  }
  for(const paper of model.papers){
    check();const p=page(297,210,`Paper ${paper.number} / placement and registration`);
    text(p,`${paper.id} | print rank ${paper.rank} | layer ${paper.zIndex} | ${paper.contentMode}`,12,34,9,muted);
    const sketchScale=Math.min(95/paper.physicalWidthMm,105/paper.lengthMm), sx=18+(95-paper.physicalWidthMm*sketchScale)/2, sy=48;
    const q=([x,y])=>[sx+x*sketchScale,sy+y*sketchScale];
    const corners=[[0,0],[paper.physicalWidthMm,0],[paper.physicalWidthMm,paper.lengthMm],[0,paper.lengthMm]];
    stroke(p,corners.map(q),true,muted,.4);
    if(options.registration)corners.forEach((pt,i)=>{cross(p,q(pt),1.5);text(p,'ABCD'[i],q(pt)[0]+2,q(pt)[1]+2,9,blue,bold);});
    text(p,'START / leading edge',sx+paper.physicalWidthMm*sketchScale/2,42,8,blue,bold,'center');
    if(options.dimensions){
      text(p,`${f(paper.physicalWidthMm)} mm`,sx+paper.physicalWidthMm*sketchScale/2,158,10,ink,bold,'center');
      text(p,`Body length ${f(paper.lengthMm)} mm`,18,166,10,ink,bold);
      text(p,`Centre ${f(paper.centerXmm)}, ${f(paper.centerYmm)} mm`,125,49,11,ink,bold);
      text(p,`Clockwise rotation ${f(paper.rotationDeg)} deg`,125,58,11,ink,bold);
      paper.corners.forEach((c,i)=>text(p,`${'ABCD'[i]}   X ${f(c[0])}   Y ${f(c[1])} mm`,125,71+i*7,10));
      text(p,`Printable X ${f(paper.printableOffsetMm)} to ${f(paper.printableOffsetMm+paper.printableWidthMm)} mm`,125,104,9,muted);
    }
    if(options.relations && paper.rank>1){const prev=model.papers[paper.rank-2],r=paperRelation(prev,paper);text(p,`From P${prev.number} centre to P${paper.number} centre`,125,119,10,blue,bold);text(p,`dX ${f(r.dxMm)} / dY ${f(r.dyMm)} / distance ${f(r.distanceMm)} mm`,125,127,9);text(p,`Bearing ${f(r.bearingDeg)} deg / relative rotation ${f(r.relativeAngleDeg)} deg`,125,134,9);text(p,`Nearest edge gap ${f(r.edgeGapMm)} mm${r.overlap ? " / overlap" : ""}`,125,141,9);}
    const pieceMm=session.composition?.family==='Roll'?session.composition.settings.pieceLengthMm:null;
    if(pieceMm){const pieces=assemblyPieces(session,paper);text(p,`Machine pieces: ${pieces.length}; ${f(pieceMm)} mm segments`,125,149,9,muted);text(p,`Last ${f(pieces.at(-1).lengthMm)} mm; includes optional end label once.`,125,156,8,muted);}
    if(labelExtraMm(options)){
      text(p,`Temporary end label: +${f(options.labelLengthMm)} mm after body`,12,179,10,blue,bold);
      if(options.labelMode==='tear'){line(p,[125,178],[282,178],accent,.5);line(p,[125,178],[130,178],blue,1.4);text(p,`Leave ${f(Math.min(options.bridgeMm,paper.physicalWidthMm))} mm at local LEFT; cut the rest across.`,125,184,9);text(p,'Use the separate SVG cut guide at 100%. Epson bridge width is fixed.',125,191,8,muted);}else text(p,'Attached panel; cut off after assembly. Artwork body dimensions stay unchanged.',12,186,9,muted);
      // Validate label generation for this paper even when PDF artwork is hidden.
      endLabelPaths(session,paper);
    }
    onProgress(`Paper guide ${paper.rank}/${model.papers.length}`);await pause();
  }
  if (session.composition?.family === 'Roll' && options.dimensions) {
    const pieces = model.papers.flatMap(p => assemblyPieces(session,p).map(piece => ({...piece,paper:p})));
    if (pieces.length > 8192) throw new Error('Too many machine pieces for PDF. Increase piece length or hide some papers.');
    for (let start=0;start<pieces.length;start+=24) {
      check();const p=page(297,210,'Roll machine pieces / local and surface coordinates');
      text(p,'One continuous physical paper per P number. Piece boundaries are machine work segments; end labels occur once.',12,34,8.5,muted);
      [[12,'Paper / piece'],[48,'From - to mm'],[96,'Length mm'],[126,'Start A X / Y mm'],[196,'Start B X / Y mm'],[264,'Angle']].forEach(([x,v])=>text(p,v,x,43,9,blue,bold));
      pieces.slice(start,start+24).forEach((q,i)=>{const y=51+i*5.7;if(i%2===0)rect(p,10,y-1.5,277,5.6);[[12,`P${q.paper.number} / ${q.index}`],[48,`${f(q.fromMm)} - ${f(q.toMm)}`],[96,f(q.lengthMm)],[126,`${f(q.A[0])} / ${f(q.A[1])}`],[196,`${f(q.B[0])} / ${f(q.B[1])}`],[264,f(q.paper.rotationDeg)]].forEach(([x,v])=>text(p,v,x,y,8));});await pause();
    }
  }
  if(options.relations){
    let rows=[];for(let i=0;i<model.papers.length;i++)for(let j=i+1;j<model.papers.length;j++)rows.push({a:model.papers[i],b:model.papers[j],r:paperRelation(model.papers[i],model.papers[j])});
    for(let start=0;start<rows.length;start+=26){
      check();const p=page(297,210,'Relationships / every paper pair');
      text(p,'Direction: first paper centre -> second paper centre. Bearing is clockwise from +X. Rotation difference is signed.',12,34,8.5,muted);
      [[12,'From -> To'],[52,'dX mm'],[84,'dY mm'],[116,'Centre mm'],[160,'Edge gap mm'],[202,'Bearing deg'],[242,'Rotation delta deg']].forEach(([x,v])=>text(p,v,x,43,9,blue,bold));
      rows.slice(start,start+26).forEach(({a,b,r},i)=>{const y=51+i*5.2;if(i%2===0)rect(p,10,y-1.5,277,5.1);[[12,`P${a.number} -> P${b.number}`],[52,f(r.dxMm)],[84,f(r.dyMm)],[116,f(r.distanceMm)],[160,r.overlap ? '0 (overlap)' : f(r.edgeGapMm)],[202,f(r.bearingDeg)],[242,f(r.relativeAngleDeg)]].forEach(([x,v])=>text(p,v,x,y,8));});await pause();
    }
  }
  const pages=pdf.getPages();pages.forEach((p,i)=>{line(p,[12,p.getHeight()/M-13],[p.getWidth()/M-12,p.getHeight()/M-13],light,.3);text(p,'Millimetres | top-left origin | body corners A/B/C/D | diagrams scaled',12,p.getHeight()/M-8,7,muted);text(p,`${i+1} / ${pages.length}`,p.getWidth()/M-12,p.getHeight()/M-8,8,muted,font,'right');});
  check();const bytes=await pdf.save();
  if(bytes.length>128*1024*1024)throw new Error('PDF exceeds 128 MiB. Export fewer papers or turn off Artwork.');
  return {blob:new Blob([bytes],{type:'application/pdf'}),filename:`${safe(projectName).replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,70)||'surface'}-assembly.pdf`,pages:pages.length,model};
}
