import * as module from 'gifenc';

// gifenc 1 exposes named ESM exports to Vite but a CommonJS object to Node.
const codec = 'quantize' in module ? module : (module as { default: typeof module }).default;
export const { GIFEncoder, quantize, applyPalette } = codec;
