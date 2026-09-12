export type Order = 'Row-major' | 'Column-major' | 'Boustrophedon';
export type Crop = 'Frame window' | 'Full cell';
export type Rect = { x: number; y: number; w: number; h: number };
export type SheetSettings = {
  W: number; H: number; cols: number; rows: number; margin: number;
  gap: number; markSize: number; order: Order; total: number; crop: Crop; pad: number;
};

export const LAYOUTS = [[3, 2], [4, 3], [2, 2], [3, 3], [4, 4]] as const;
export const ORDERS: readonly Order[] = ['Row-major', 'Column-major', 'Boustrophedon'];
export const DEFAULTS: Readonly<SheetSettings> = Object.freeze({
  W: 420, H: 297, cols: 4, rows: 3, margin: 30, gap: 8, markSize: 15,
  order: 'Row-major', total: 12, crop: 'Frame window', pad: 0,
});

export function validateSettings(p: SheetSettings): string[] {
  const issues: string[] = [];
  const numeric: (keyof SheetSettings)[] = ['W', 'H', 'cols', 'rows', 'margin', 'gap', 'markSize', 'total', 'pad'];
  if (numeric.some(key => typeof p[key] !== 'number' || !Number.isFinite(p[key]))) {
    return ['Enter a number in every numeric field.'];
  }
  if (p.W <= 40 || p.H <= 40) issues.push('Sheet dimensions must exceed 40 mm for the fixed corner markers.');
  if (![p.cols, p.rows].every(n => Number.isInteger(n) && n >= 1 && n <= 6)) issues.push('Use 1–6 whole columns and rows.');
  if (p.margin < 0 || p.gap < 0) issues.push('Margin and gap cannot be negative.');
  if (p.markSize < 8 || p.markSize > 15) issues.push('Marker size must be between 8 and 15 mm.');
  if (p.W - 40 <= p.markSize || p.H - 40 <= p.markSize) issues.push('Increase the sheet size so corner markers do not overlap.');
  if (!Number.isSafeInteger(p.total) || p.total < 1) issues.push('Total frames must be a positive whole number.');
  if (p.pad < 0 || p.pad > 100) issues.push('Padding must be between 0 and 100%.');
  if (!ORDERS.includes(p.order)) issues.push('Choose a supported frame order.');
  if (!['Frame window', 'Full cell'].includes(p.crop)) issues.push('Choose a supported crop.');
  // Muusia emits no cells when either dimension is <= 1 mm.
  if ((p.W - 2 * p.margin - (p.cols - 1) * p.gap) / p.cols <= 1 ||
      (p.H - 2 * p.margin - (p.rows - 1) * p.gap) / p.rows <= 1) {
    issues.push('Cells must be larger than 1 mm. Reduce the margin, gap or grid size.');
  }
  return issues;
}

/** Physical rectangles are always row-major, in sheet mm with y pointing down. */
export function buildLayout(p: SheetSettings) {
  const issues = validateSettings(p);
  if (issues.length) throw new RangeError(issues.join(' '));
  const cw = (p.W - 2 * p.margin - (p.cols - 1) * p.gap) / p.cols;
  const ch = (p.H - 2 * p.margin - (p.rows - 1) * p.gap) / p.rows;
  const scale = Math.min(cw / p.W, ch / p.H);
  const cells = Array.from({ length: p.cols * p.rows }, (_, index) => {
    const c = index % p.cols, r = Math.floor(index / p.cols);
    const cell = { x: p.margin + c * (cw + p.gap), y: p.margin + r * (ch + p.gap), w: cw, h: ch };
    const window = { x: cell.x + (cw - p.W * scale) / 2, y: cell.y + (ch - p.H * scale) / 2, w: p.W * scale, h: p.H * scale };
    const base = p.crop === 'Frame window' ? window : cell;
    // Pad is a percentage of the crop size added on EACH side.
    const dx = base.w * p.pad / 100, dy = base.h * p.pad / 100;
    const crop = { x: base.x - dx, y: base.y - dy, w: base.w + 2 * dx, h: base.h + 2 * dy };
    return { index, c, r, cell, window, crop };
  });
  const frameToCell = Array.from({ length: cells.length }, (_, i) => {
    if (p.order === 'Column-major') return (i % p.rows) * p.cols + Math.floor(i / p.rows);
    if (p.order === 'Boustrophedon' && Math.floor(i / p.cols) % 2 === 1) return Math.floor(i / p.cols) * p.cols + p.cols - 1 - i % p.cols;
    return i;
  });
  const markers = [
    { x: 20, y: 20, hole: true }, { x: p.W - 20, y: 20, hole: false },
    { x: p.W - 20, y: p.H - 20, hole: false }, { x: 20, y: p.H - 20, hole: false },
  ];
  return { cells, frameToCell, markers, scale, cw, ch, framesPerSheet: cells.length, sheets: Math.ceil(p.total / cells.length) };
}

export function framesOnSheet(p: SheetSettings, sheet: number) {
  const layout = buildLayout(p);
  if (!Number.isInteger(sheet) || sheet < 0 || sheet >= layout.sheets) throw new RangeError('Sheet index is out of range.');
  const start = sheet * layout.framesPerSheet;
  return layout.frameToCell.slice(0, Math.min(layout.framesPerSheet, p.total - start))
    .map((cellIndex, i) => ({ frame: start + i, ...layout.cells[cellIndex]! }));
}
