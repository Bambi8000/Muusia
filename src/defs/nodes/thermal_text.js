import { Pin } from "../helpers.js";

export default {
  key: "thermal_text",
  name: "Thermal Text",
  cat: "mod",
  group: "penout",
  desc: "Add Epson TM-T88V ROM text before or after the wired image when printing a receipt. The blue output passes the drawing through. Choose Font A/B, character page, international set, alignment, 1–8× width and height, bold, underline and reverse. Use | for a new line. Exact hex bytes reach pages without a Unicode converter. This text is printed by the Epson, so it does not become SVG or G-code paths.",
  ins: [Pin("paths", "Image")],
  outs: [Pin("paths")],
  params: [
    { key: "text", label: "Text (| = new line)", type: "text", def: "HELLO WORLD" },
    { key: "position", label: "Place", type: "select", options: ["Before", "After"], def: "Before" },
    { key: "align", label: "Align", type: "select", options: ["Left", "Center", "Right"], def: "Left" },
    { key: "font", label: "Epson font", type: "select", options: ["A", "B"], def: "A" },
    { key: "width", label: "Width ×", type: "slider", min: 1, max: 8, step: 1, def: 1 },
    { key: "height", label: "Height ×", type: "slider", min: 1, max: 8, step: 1, def: 1 },
    { key: "bold", label: "Bold", type: "check", def: false },
    { key: "underline", label: "Underline", type: "check", def: false },
    { key: "reverse", label: "Reverse", type: "check", def: false },
    { key: "page", label: "Character page", type: "select", options: [
      "0 · PC437 USA", "1 · Katakana", "2 · PC850 Multilingual", "3 · PC860 Portuguese", "4 · PC863 Canadian French", "5 · PC865 Nordic",
      "11 · PC851 Greek", "12 · PC853 Turkish", "13 · PC857 Turkish", "14 · PC737 Greek", "15 · ISO 8859-7 Greek", "16 · Windows 1252 Western",
      "17 · PC866 Cyrillic", "18 · PC852 Central Europe", "19 · PC858 Euro", "20 · Thai 42", "21 · Thai 11", "26 · Thai 18",
      "30 · TCVN-3 Vietnamese 1", "31 · TCVN-3 Vietnamese 2", "32 · PC720 Arabic", "33 · PC775 Baltic", "34 · PC855 Cyrillic", "35 · PC861 Icelandic",
      "36 · PC862 Hebrew", "37 · PC864 Arabic", "38 · PC869 Greek", "39 · ISO 8859-2 Central Europe", "40 · ISO 8859-15 Euro",
      "41 · PC1098 Farsi", "42 · PC1118 Lithuanian", "43 · PC1119 Lithuanian", "44 · PC1125 Ukrainian", "45 · Windows 1250 Central Europe",
      "46 · Windows 1251 Cyrillic", "47 · Windows 1253 Greek", "48 · Windows 1254 Turkish", "49 · Windows 1255 Hebrew", "50 · Windows 1256 Arabic",
      "51 · Windows 1257 Baltic", "52 · Windows 1258 Vietnamese", "53 · KZ-1048 Kazakhstan",
    ], def: "0 · PC437 USA" },
    { key: "country", label: "International set", type: "select", options: [
      "0 · USA", "1 · France", "2 · Germany", "3 · UK", "4 · Denmark I", "5 · Sweden", "6 · Italy", "7 · Spain I", "8 · Japan",
      "9 · Norway", "10 · Denmark II", "11 · Spain II", "12 · Latin America", "13 · Korea", "14 · Slovenia / Croatia", "15 · China", "16 · Vietnam", "17 · Arabia",
    ], def: "0 · USA" },
    { key: "hex", label: "Exact glyph bytes (hex)", type: "text", def: "" },
  ],
  compute(ins, p) {
    const source = ins[0] && Array.isArray(ins[0].paths) ? ins[0] : { paths: [] };
    const text = String(p.text || "").replaceAll("|", "\n");
    const hex = String(p.hex || "");
    if (!text.trim() && !hex.trim()) return source;
    const block = {
      position: p.position === "After" ? "after" : "before",
      text, hex,
      align: Math.max(0, ["Left", "Center", "Right"].indexOf(p.align)),
      font: p.font === "B" ? "B" : "A",
      width: Math.max(1, Math.min(8, Math.round(Number(p.width) || 1))),
      height: Math.max(1, Math.min(8, Math.round(Number(p.height) || 1))),
      bold: !!p.bold, underline: !!p.underline, reverse: !!p.reverse,
      page: parseInt(String(p.page), 10) || 0,
      country: parseInt(String(p.country), 10) || 0,
    };
    return { ...source, paths: source.paths, thermalText: [...(Array.isArray(source.thermalText) ? source.thermalText : []), block] };
  },
};
