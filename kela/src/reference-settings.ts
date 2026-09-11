import type { SheetSettings } from './layout';

// Canvas dimensions come from animtest.svg; plot settings were confirmed by
// Daniel's Frame Grid screenshot (test/reference-settings.png, 2026-09-11).
// Keep these independent of application defaults so the fixture stays stable.
export const REFERENCE_SETTINGS: Readonly<SheetSettings> = Object.freeze({
  W: 297, H: 210, cols: 4, rows: 3, margin: 30, gap: 8,
  markSize: 15, order: 'Row-major', total: 12,
  // Extraction choices: Map canvas supports the registered frame-window crop.
  crop: 'Frame window', pad: 0,
});
