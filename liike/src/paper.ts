export type PaperTone = 'light' | 'dark';
export const paperBackground = (tone?: PaperTone) => tone === 'dark' ? 0 : 255;

/** Analysis polarity only: displayed/exported ink colors are never inverted. */
export function analysisLight(r: number, g: number, b: number, alpha: number, tone?: PaperTone) {
  const light = (.299 * r + .587 * g + .114 * b) * alpha / 255 + paperBackground(tone) * (1 - alpha / 255);
  return tone === 'dark' ? 255 - light : light;
}
