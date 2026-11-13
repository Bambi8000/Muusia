// Dedicated thermal waste areas keep crop marks outside the finished artwork.
export const TRIM_DOTS_PER_MM = 400 / 56.6;
export const TRIM_GUARD_ROWS = Math.ceil(3 * TRIM_DOTS_PER_MM);
export const trimAllowanceMm = enabled => enabled ? 2 * TRIM_GUARD_ROWS / TRIM_DOTS_PER_MM : 0;
export function thermalTrimLayout(lengthMm, enabled = false) {
  const bodyRows = Math.max(1, Math.ceil(lengthMm * TRIM_DOTS_PER_MM - 1e-9));
  const leadingRows = enabled ? TRIM_GUARD_ROWS : 0, trailingRows = leadingRows;
  return { leadingRows, trailingRows, bodyRows, bodyStartRow: leadingRows, bodyEndRow: leadingRows + bodyRows, rows: leadingRows + bodyRows + trailingRows };
}
// Pixel-aligned L marks lie wholly in waste. Cut along their INNER edge.
export function addThermalTrimMarks(bytes, layout, strip, profile) {
  if (!layout.leadingRows) return;
  const d = profile.dotsPerMm;
  const left = Math.max(profile.firstColumn, Math.ceil((strip.printableOffsetMm - profile.headOffsetMm) * d - .5));
  const right = Math.min(profile.lastColumn, Math.ceil((strip.printableOffsetMm + strip.printableWidthMm - profile.headOffsetMm) * d - .5) - 1);
  const tick = Math.min(Math.floor(3*d), Math.max(0, Math.floor((right-left)/3))), stem = Math.floor(1.5*d);
  const dot = (x,y) => { if(x>=left&&x<=right)bytes[y*64+(x>>3)]|=0x80>>(x&7); };
  for (const [y,direction] of [[layout.bodyStartRow-1,-1],[layout.bodyEndRow,1]]) {
    for(let x=left;x<=left+tick;x++)dot(x,y);
    for(let x=right-tick;x<=right;x++)dot(x,y);
    for(let i=0;i<=stem;i++){dot(left,y+direction*i);dot(right,y+direction*i);}
  }
}
