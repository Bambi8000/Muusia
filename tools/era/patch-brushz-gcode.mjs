/* tools/patch-brushz-gcode.mjs — teaches toGcode() the Brush Z pressure axis.
   Anchored string replacement with OK/MISS reporting. Run from repo root:
   node tools/patch-brushz-gcode.mjs
   Points may carry a third component = mm of plunge below pen-down (written by
   the Brush Z node). Draw moves become "G1 X.. Y.. Z.. F.." so Klipper feeds Z
   simultaneously with XY — continuous pressure along the stroke. Bed-Z mode
   only (servo pen-lift cannot press); activates purely by presence of z. */
import fs from "fs";

const FILE = "src/App.jsx";
let s = fs.readFileSync(FILE, "utf8");
let fails = 0;
const edit = (name, from, to) => {
  if (s.includes(from)) {
    s = s.replace(from, to);
    console.log("OK   " + name);
  } else {
    console.log("MISS " + name);
    fails++;
  }
};

edit("preserve z through the point mapping",
  "      pts = pts.map(([x, y]) => [x, fy(y)]);",
  "      pts = pts.map((q) => [q[0], fy(q[1]), q[2]]);");

edit("brushZ helper after travelZ",
  "  const travelZ = () => (prof.zHopOn ? f2(Math.min(prof.penUp, prof.penDown + prof.zHop)) : f2(prof.penUp));",
  `  const travelZ = () => (prof.zHopOn ? f2(Math.min(prof.penUp, prof.penDown + prof.zHop)) : f2(prof.penUp));
  /* Brush Z: pisteen 3. komponentti = upotus mm pen-downin alle (Brush Z -node).
     Vain bed-Z-tilassa; klampattu 6 mm turvarajaan. */
  const brushZ = (q) => (!zServo && typeof q[2] === "number" && isFinite(q[2]))
    ? \` Z\${f2(prof.penDown - Math.max(0, Math.min(6, q[2])))}\`
    : "";`);

edit("first-point pressure after contact",
  `      rot(ang0, "align to path start");
      penDownContact();`,
  `      rot(ang0, "align to path start");
      penDownContact();
      if (brushZ(pts[0])) lines.push(\`G1\${brushZ(pts[0])} F\${prof.zFeed} ; brush pressure\`);`);

edit("draw move (rotation branch) carries Z",
  `          if (Math.abs(dA) >= prof.rotThresh) {
            lines.push(\`G1 X\${f2(fx(pts[i][0]))} Y\${f2(pts[i][1])} F\${prof.feedDraw}\`);`,
  `          if (Math.abs(dA) >= prof.rotThresh) {
            lines.push(\`G1 X\${f2(fx(pts[i][0]))} Y\${f2(pts[i][1])}\${brushZ(pts[i])} F\${prof.feedDraw}\`);`);

edit("draw move (main) carries Z",
  `        lines.push(\`G1 X\${f2(fx(pts[i][0]))} Y\${f2(pts[i][1])} F\${prof.feedDraw}\`);
        drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);`,
  `        lines.push(\`G1 X\${f2(fx(pts[i][0]))} Y\${f2(pts[i][1])}\${brushZ(pts[i])} F\${prof.feedDraw}\`);
        drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);`);

if (!fails) fs.writeFileSync(FILE, s);
console.log(fails
  ? `\n${fails} MISSES — App.jsx NOT written; check anchors against your tree`
  : "\nALL PATCHES OK — App.jsx written");
process.exit(fails ? 1 : 0);
