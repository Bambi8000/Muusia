import { Pin, mulberry32 } from "../helpers.js";
import { RECEIPT_FONTS } from "../../receipt-ascii.js";
import { RECEIPT_MAX_HEIGHT_DOTS } from "../../receipt-format.js";

const num = (value, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+value) ? +value : fallback));

export default {
  key: "receiptascii", name: "Receipt ASCII", cat: "gen", group: "textimg",
  desc: "Native receipt-printer character art inspired by a beautiful error print. Error weave makes drifting diagonal groups and denser bands; Waves, Stream and Noise explore other rhythms. Characters takes printable ASCII; spaces make gaps. Columns is limited to 56 (Font B) or 42 (Font A). Canvas aspect sets the roll length; Row gap adds space between lines. Seed repeats the same print. Select this node and PRINT ASCII RECEIPT, or DOWNLOAD ESCPOS. The preview uses a substitute monospace font; the printer uses its own Epson font. This output is receipt text, so path modifiers and plotter exports do not apply.",
  ins: [], outs: [Pin("paths", "Receipt text")],
  params: [
    { key: "pattern", label: "Pattern", type: "select", options: ["Error weave", "Waves", "Stream", "Noise"], def: "Error weave" },
    { key: "characters", label: "Characters", type: "text", def: "01':;|" },
    { key: "font", label: "Printer font", type: "select", options: ["B", "A"], def: "B" },
    { key: "cols", label: "Columns", type: "slider", min: 8, max: 56, step: 1, def: 52 },
    { key: "density", label: "Density", type: "slider", min: 0, max: 1, step: 0.01, def: 0.36 },
    { key: "repeat", label: "Repeat columns", type: "slider", min: 3, max: 40, step: 0.1, def: 10.5 },
    { key: "drift", label: "Drift per row", type: "slider", min: -3, max: 3, step: 0.05, def: 0.65 },
    { key: "wave", label: "Wave", type: "slider", min: 0, max: 12, step: 0.1, def: 3 },
    { key: "period", label: "Wave rows", type: "slider", min: 4, max: 180, step: 1, def: 42 },
    { key: "corruption", label: "Corruption", type: "slider", min: 0, max: 1, step: 0.01, def: 0.08 },
    { key: "gap", label: "Row gap dots", type: "slider", min: 0, max: 36, step: 1, def: 1 },
    { key: "seed", label: "Seed", type: "seed", def: 3542 },
  ],
  compute(_ins, p, ctx) {
    const font = p.font === "A" ? "A" : "B", metrics = RECEIPT_FONTS[font];
    const cols = Math.round(num(p.cols, 52, 8, metrics.columns));
    const lineSpacing = metrics.height + Math.round(num(p.gap, 1, 0, 36));
    const height = Math.round(num(ctx.H / ctx.W * 512, 1024, lineSpacing, RECEIPT_MAX_HEIGHT_DOTS));
    const rows = Math.max(1, Math.floor(height / lineSpacing));
    const characters = String(p.characters ?? "01':;|").replace(/[^\x20-\x7e]/g, "").slice(0, 256) || "01':;|";
    const density = num(p.density, 0.36, 0, 1), repeat = num(p.repeat, 10.5, 3, 40);
    const drift = num(p.drift, 0.65, -3, 3), wave = num(p.wave, 3, 0, 12);
    const period = num(p.period, 42, 4, 180), corruption = num(p.corruption, 0.08, 0, 1);
    const rand = mulberry32(num(p.seed, 3542, -2147483648, 2147483647));
    const phase = rand() * Math.PI * 2, lines = [];
    // All rows are retained; long rolls add pattern without changing its scale.
    for (let r = 0; r < rows; r++) {
      const bend = wave * Math.sin(r / period * Math.PI * 2 + phase);
      const band = (1 + Math.sin(r / (period * 2.7) * Math.PI * 2 + phase)) / 2;
      let line = "";
      for (let c = 0; c < cols; c++) {
        const x = c - r * drift - bend;
        const cycle = ((x / repeat % 1) + 1) % 1;
        const score = p.pattern === "Noise" ? rand()
          : p.pattern === "Stream" ? ((c + r * (cols + 1)) % repeat) / repeat
          : p.pattern === "Waves" ? (1 + Math.cos((c - bend) / repeat * Math.PI * 2)) / 2
          : Math.min(1, cycle + corruption * (0.5 - band));
        const damage = rand(), glyph = rand();
        const visible = density >= 1 || (density > 0 && (damage < corruption ? glyph < density : score < density));
        const index = p.pattern === "Stream" ? (c + r * (cols + 1)) % characters.length
          : Math.floor((cycle * 0.65 + glyph * 0.35) * characters.length) % characters.length;
        line += visible ? characters[index] : " ";
      }
      lines.push(line);
    }
    return { paths: [], receiptText: { font, lineSpacing, left: Math.floor((512 - cols * metrics.width) / 2), lines } };
  },
};
