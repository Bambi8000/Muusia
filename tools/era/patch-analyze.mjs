/* patch-analyze.mjs - Portrait phase 2A: wire src/analyze.js into App.jsx.
   ERA PATCH - anchored exact-string replacement, NOT idempotent: do not
   re-run once applied (SKIP guard refuses if the seam already exists).
   Run from repo root: node tools/era/patch-analyze.mjs

   Edits:
   E1 import + AnalyzeButton factory call (after the dro.jsx import)
   E2 faceAnalysis intake branch (EXIF + 1280 px + frozen JPEG src) in onFileText
   E3 AnalyzeButton on the node card, after the param rows

   Post-push guard (add to the release routine, v2.44 lesson):
     grep -c "AnalyzeButton" src/App.jsx   -> must print 3 */

import fs from "node:fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("AnalyzeButton")) {
  console.log("SKIP: AnalyzeButton already present in " + FILE + " - patch refused (era patches are one-shot).");
  process.exit(0);
}

let okAll = true;
const edit = (name, anchor, replacement) => {
  const n = src.split(anchor).length - 1;
  if (n !== 1) {
    console.log("MISS " + name + " (anchor found " + n + " times, need exactly 1)");
    okAll = false;
    return;
  }
  src = src.replace(anchor, replacement);
  console.log("OK   " + name);
};

/* E1 - import + factory (React is imported on line 1 of App.jsx) */
edit("E1 import analyze.js",
  'import DroPanel from "./dro.jsx";',
  'import DroPanel from "./dro.jsx";\n' +
  'import { makeAnalyzeButton, intakeImage } from "./analyze.js";\n' +
  'const AnalyzeButton = makeAnalyzeButton(React);');

/* E2 - Portrait-class intake: EXIF orientation + 1280 px resize + re-encoded
   JPEG at node.data.src; a NEW PHOTO INVALIDATES any frozen analysis.
   Legacy 160 px path below stays byte-identical for every other image node. */
edit("E2 faceAnalysis intake branch",
  'onFileText={pd.type === "file" && def.fileImage ? (dataUrl, name) => {\n' +
  '                                    const img = new Image();',
  'onFileText={pd.type === "file" && def.fileImage ? (dataUrl, name) => {\n' +
  '                                    if (def.faceAnalysis) {\n' +
  '                                      intakeImage(dataUrl, name).then(({ img, src }) => {\n' +
  '                                        setNodesL((ns) => ns.map((n) => n.id === node.id\n' +
  '                                          ? { ...n, params: { ...n.params, [pd.key]: name }, data: { ...(n.data || {}), img, src, analysis: undefined } }\n' +
  '                                          : n));\n' +
  '                                      }).catch((err) => {\n' +
  '                                        setNodesL((ns) => ns.map((n) => n.id === node.id\n' +
  '                                          ? { ...n, params: { ...n.params, [pd.key]: "Error: " + err.message } }\n' +
  '                                          : n));\n' +
  '                                      });\n' +
  '                                      return;\n' +
  '                                    }\n' +
  '                                    const img = new Image();');

/* E3 - the Analyze button on the node card, after the param rows (hidden in
   slider-setup view). onResult freezes the analysis to node.data.analysis
   and the state change triggers recompute. */
edit("E3 AnalyzeButton on card",
  '                              );\n' +
  '                            })\n' +
  '                          )}\n' +
  '                        </div>',
  '                              );\n' +
  '                            })\n' +
  '                          )}\n' +
  '                          {setupFor !== node.id && def.faceAnalysis && node.data && node.data.src ? (\n' +
  '                            <AnalyzeButton data={node.data} T={T}\n' +
  '                              onResult={(analysis) => setNodesL((ns) => ns.map((n) => n.id === node.id\n' +
  '                                ? { ...n, data: { ...(n.data || {}), analysis } } : n))} />\n' +
  '                          ) : null}\n' +
  '                        </div>');

if (!okAll) {
  console.log("\nNOT WRITTEN - fix anchors first (App.jsx has drifted from the expected base).");
  process.exitCode = 1;
} else {
  fs.writeFileSync(FILE, src);
  const count = (src.match(/AnalyzeButton/g) || []).length;
  console.log("\nWrote " + FILE + '. Sentinel: "AnalyzeButton" x' + count + " (expect 3+ occurrences on 3 lines).");
  console.log('Guard for the release routine: grep -c "AnalyzeButton" src/App.jsx  -> 3');
}
