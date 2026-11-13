// Shared limits for Muusia export and LATU. Raster stripes avoid browser canvas
// height limits; ESC/POS transport splits these into 256-row printer blocks.
export const RECEIPT_WIDTH_DOTS = 512;
export const RECEIPT_MAX_HEIGHT_DOTS = 65535;
export const RECEIPT_RENDER_ROWS = 1024;
export const RECEIPT_MAX_JSON_BYTES = Math.ceil(RECEIPT_WIDTH_DOTS / 8 * RECEIPT_MAX_HEIGHT_DOTS / 3) * 4 + 65536;
export const RECEIPT_MAX_ESCPOS_BYTES = RECEIPT_WIDTH_DOTS / 8 * RECEIPT_MAX_HEIGHT_DOTS + Math.ceil(RECEIPT_MAX_HEIGHT_DOTS / 256) * 8 + 8;
