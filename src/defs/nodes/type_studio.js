import { Pin } from "../helpers.js";
import { typeStudioParams, computeTypeStudio, studioFrame, studioParameters } from "../type-studio.js";

export default {
  key: "type_studio", name: "Type Studio", cat: "gen", group: "textimg",
  desc: "Ten type treatments from Muusia's typography study, with the original numbers: 01 Contour type, 02 Living strokes, 03 Patterned face, 04 Modular squares, 05 Serpentine type, 07 Modular marks, 08 Hairline lettering, 10 Words inside a word, 11 Falling characters and 12 Text made of text. Enter Text and switch Type treatment; only relevant controls are shown. Letter height sets the source size, Composition scale shrinks the whole result, and Margin keeps it on the page. Long text shrinks to fit; use | for new lines (up to 128 characters). In 07, blue Motif repeats your complete drawing in selected stitch cells. Purple Style is applied last. Falling characters can cycle through the letters or repeat the whole text. Words inside a word inherits Concrete Poetry's centre-based region test; small strokes can cross its edge. Hairline lettering uses Ribbon Type's a-z alphabet: capitals become lowercase, digits and punctuation have no drawn glyphs. Numeric controls accept animation wires; there is no automatic timeline motion. Fine spacing may merge with a thick physical pen.",
  ins: [Pin("style", "Style"), Pin("paths", "Motif (07 only)")],
  outs: [Pin("paths")],
  params: typeStudioParams,
  compute(ins,p,ctx) { return computeTypeStudio(ins,p,ctx); },
  overlay(p,ctx) {
    const f=studioFrame(studioParameters(p),ctx);
    return f?[{kind:"rect",x:f.x,y:f.y,w:f.w,h:f.h}]:[];
  },
};
