/* Physical-size SVG samples for Avatar 3D centerline drawings. */
const xml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const number=(value,fallback,min,max)=>Math.max(min,Math.min(max,Number.isFinite(+value)?+value:fallback));
const coordinate=value=>String(Math.round(value*1000)/1000);
export function avatarPlotSvg(drawing,context={},options={}){
  const W=number(context.W,210,10,5000),H=number(context.H,297,10,5000);
  const fallback=options.style==='Brush'?number(options.brushWidth,2.5,.1,30):number(options.penWidth,.35,.05,5);
  const groups=new Map();
  for(const path of drawing.paths||[]){
    if(path.pts.length<2||!path.pts.every(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])))continue;
    const layer=Math.round(number(path.layer,0,0,11)),width=number(path.strokeWidth,fallback,.01,30);
    if(!groups.has(layer))groups.set(layer,[]);
    const d='M'+path.pts.map(p=>coordinate(p[0])+','+coordinate(p[1])).join('L')+(path.closed?'Z':'');
    groups.get(layer).push(`    <path d="${d}" stroke-width="${coordinate(width)}"/>`);
  }
  const layers=[...groups].sort((a,b)=>a[0]-b[0]).map(([layer,paths])=>`  <g id="pen-${layer}" fill="none" stroke="${xml(options.colors?.[layer]||'#171717')}" stroke-linecap="round" stroke-linejoin="round">\n${paths.join('\n')}\n  </g>`);
  const title=options.title||'Avatar 3D · '+(options.style||drawing.stats?.style||'Drawing');
  const metadata={source:'MakeHuman HM08 assets CC0 1.0',style:options.style||drawing.stats?.style,anatomySeed:options.seed,styleSeed:options.styleSeed,body:options.preset,visibleBody:options.mode,strokeWidthMm:fallback,...options.metadata};
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n  <title>${xml(title)}</title>\n  <metadata>${xml(JSON.stringify(metadata))}</metadata>\n${layers.join('\n')}\n</svg>\n`;
}
