# Muusia — Custom Node API (v1.2, app v2.29)

This document is a **complete, self-contained specification** for writing a custom node
for Muusia, a node-graph editor for generative pen-plotter art. You can hand this
document to a developer or an AI assistant and ask for a node; the resulting file is
imported in the app via the **Node ⇣** button (top toolbar). (Built-in nodes use the same definition object in ESM form under `src/defs/nodes/` — an import line plus `export default { ... };` — but this plotternode format is the one for user imports.)

---

## 1. What a node is

A node is a single JavaScript **object literal** in its own file. The file must contain
*exactly one expression* that evaluates to the definition object — no `import`, no
`export`, no surrounding statements. It is evaluated in a sandbox where a set of helper
functions (section 6) are available as free variables.

**Minimal valid file:**

```js
({
  key: "hello_rings",
  name: "Hello Rings",
  cat: "gen",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Rings", type: "slider", min: 1, max: 30, step: 1, def: 8 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const paths = [];
    for (let i = 1; i <= Math.round(p.count); i++) {
      const r = (Math.min(W, H) / 2 - 10) * (i / p.count);
      const pts = [];
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        pts.push([W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r]);
      }
      paths.push({ pts, closed: true, layer: Math.round(p.layer) });
    }
    return applyStyle({ paths }, ins[0]);
  },
})
```

Wrap the object in parentheses `({ ... })` exactly as shown.

---

## 2. The core datatype: path set

Everything flowing through blue wires is a **path set**:

```js
{ paths: [ { pts: [[x, y], ...], closed: boolean, layer: number }, ... ] }
```

- `pts` — array of `[x, y]` points in **millimetres**, canvas coordinates
  (origin top-left, x → right, y → down). Canvas size comes from `ctx.W` / `ctx.H`.
- **Point order = pen travel direction.** This is a first-class property: the machine
  export uses it to rotate a brush along the stroke. Never randomize point order
  casually; if you generate closed shapes, generate them with a consistent winding.
- `closed` — `true` means the pen returns to `pts[0]` at the end (do **not** repeat the
  first point at the end yourself).
- `layer` — integer pen index `0..11` (12 pens; colors/names user-editable in the app). Layers
  become pen-change stops in G-code and `<g>` groups in SVG export.

Curves do not exist: everything is a polyline. Sample curves densely enough
(typically a point every 0.5–2 mm) to look smooth.

An empty result is the constant `EMPTY` (`{ paths: [] }`).

**Point budget:** keep total output under ~120 000 points; the engine truncates beyond
that. Prefer resolution parameters so the user can trade detail for speed.

## 3. Definition fields

| Field | Type | Notes |
|---|---|---|
| `key` | string | Unique id, `^[a-z][a-z0-9_]*$`. Must not collide with built-ins. |
| `name` | string | Palette / node title. |
| `desc` | string, recommended | One-paragraph help shown by the node's **?** button and as tooltip. Write it for a user: what it draws, what the key params do, a chaining tip. |
| `cat` | string | Palette section: `"gen"` (Generators), `"mod"` (Modifiers), `"dec"` (Decorators), `"duo"` (Combiners), `"math"` (Math). |
| `group` | string, required for gen/mod | Palette folder. Generators: `geometric`, `organic`, `machines`, `nature`, `creatures`, `space`, `scientific`, `structural`, `textimg`. Modifiers: `transform`, `deform`, `pathops`, `cutsplit`, `fillstyle`, `penout`. Nodes without a group do not appear in folder view. |
| `ins` | array *or* `(node) => array` | Input pins, see below. |
| `outs` | array *or* `(node) => array` | Output pins. A function enables a dynamic count (read `node.params`). |
| `params` | array | Parameter descriptors, section 4. |
| `compute` | function | `(ins, p, ctx, node) => result`, section 5. |
| `overlay` | function, optional | `(params, ctx) => guides[]` — dashed preview guides shown when the node is selected. Guide kinds: `{kind:"rect",x,y,w,h}`, `{kind:"circle",cx,cy,r}`, `{kind:"point",x,y}`, `{kind:"arrow",x1,y1,x2,y2}`, `{kind:"poly",pts}`. Never plotted. |
| `onFile` | function, optional | `(text) => data` — parse a file for a `type:"file"` param; result is stored at `node.data` (see Import SVG pattern). |

**Pins:** create with `Pin(type, label?)` where type is `"paths"`, `"value"`, or
`"style"`. Only equal types connect. Examples:
`ins: [Pin("paths", "Target"), Pin("paths", "Mask")]`,
`outs: (node) => Array.from({length: Math.round(node.params.count)}, (_, i) => Pin("paths", String(i+1)))`.

## 4. Parameter UI types

Each descriptor: `{ key, label, type, def, ... }`. The engine auto-generates the UI row
and, for numeric types, a green **value input port** so any parameter can be driven by
wires — you get modulation for free.

| `type` | Extra fields | UI |
|---|---|---|
| `slider` | `min, max, step` | Slider + clamped number box (numeric port). |
| `seed` | — | Number box + dice button (numeric port). |
| `select` | `options: ["A", "B"]` | Dropdown. `p.key` is the **string**. |
| `check` | — | Checkbox → boolean. |
| `pen` | — | 12 color dots → integer 0–11. |
| `text` | — | Single-line text field. |
| `file` | — | File picker; pair with `onFile`. |

Compute must tolerate any numeric value: wires can push values outside min/max, and
since v2.18 the user can raise any slider's max per node (**⚙ slider setup**), so your
declared `max` is a default, not a guarantee. Clamp inside `compute` where physics
demands it, `Math.round()` values used as counts, and let a `margin`/fit keep output
on-sheet at extreme values.

## 5. The compute contract

```js
compute(ins, p, ctx, node) → pathSet | number | style | array-of-pathSets
```

- `ins` — array aligned with `ins` pins. **Any element can be `undefined`**
  (unwired). Guard the primary input with `const src = ins[0] || EMPTY;`.
  A `value` input arrives as a `number`; a `style` input as an opaque object you only
  pass to `applyStyle`.
- `p` — plain object of parameter values, numeric params already resolved from wires.
- `ctx` — `{ W, H }` canvas size in mm.
- `node` — the node instance; only needed for `node.data` (file payloads) or dynamic outs.
- Return one path set normally; a `number` for math nodes (`outs: [Pin("value")]`);
  an **array of path sets** if `outs` declares multiple outputs.

**Rules:**
1. **Pure and deterministic.** No DOM, no fetch, no globals, no `Math.random()` — use
   `mulberry32(seed)` with a seed parameter so results are reproducible.
2. **Never mutate inputs.** Build new arrays; copy points you modify
   (`path.pts.map(([x, y]) => [x + dx, y])`).
3. Runs on every parameter change — keep it fast (aim < 50 ms typical settings).
4. Generators should accept a Style input: declare `ins: [Pin("style", "Style")]` and
   end with `return applyStyle({ paths }, ins[0]);`.
5. Modifiers that displace points should densify first
   (`resample(path.pts, path.closed, 1)`) so bends look smooth.

## 6. Helper library (free variables)

| Helper | Signature | Behavior |
|---|---|---|
| `Pin` | `(type, label?) → pin` | Pin descriptor. |
| `EMPTY` | constant | `{ paths: [] }`. |
| `PENS` | constant | Array of 12 `{ name, c }` pen colors; use `PENS.length` for cycling. |
| `mulberry32` | `(seed) → () => float` | Deterministic PRNG in `[0,1)`. |
| `hash2` | `(x, y, seed) → float` | Deterministic hash of a lattice cell, `[0,1)`. |
| `noise2` | `(x, y, seed) → float` | Smooth 2-D value noise, `[0,1)`. Feature size ≈ `1/scale` when you sample `noise2(x*scale, y*scale, seed)`; typical scale 0.005–0.1. For fBm, sum octaves at doubling frequency, halving amplitude. |
| `resample` | `(pts, closed, step) → pts` | Even resampling at `step` mm spacing. |
| `pathLength` | `(pts, closed) → mm` | Polyline length. |
| `applyStyle` | `(pathSet, styleOrUndefined) → pathSet` | Applies a Stroke style (dashes etc.); pass-through if style is `undefined`. |
| `signedArea` | `(pts) → number` | Shoelace. In this y-down system, **positive = clockwise on screen**; use to normalize winding or find inward normals. |

Standard `Math` is available. Nothing else is — no imports.

## 7. Recipes

**Modifier skeleton** (per-point displacement):

```js
({
  key: "shear_x",
  name: "Shear X",
  cat: "mod",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [{ key: "amt", label: "Shear", type: "slider", min: -2, max: 2, step: 0.05, def: 0.5 }],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const paths = src.paths.map((path) => ({
      ...path,
      pts: resample(path.pts, path.closed, 1.5).map(([x, y]) => [x + (y - ctx.H / 2) * p.amt, y]),
    }));
    return { paths };
  },
})
```

**Per-path transform:** compute the centroid, transform points around it, keep
`closed`/`layer` via `{ ...path, pts }` spread.

**Random-with-seed:** `const rng = mulberry32(p.seed * 7919 + 13);` — mix the seed with a
prime; derive per-item streams as `mulberry32(p.seed * 7919 + i * 613)` so item `i` is
stable when others change.

**Dots/stamps:** a "dot" is a small closed polygon (6–10 points), not a zero-length path.

## 8. Common pitfalls

- Returning `{pts, closed}` objects directly instead of wrapping in `{ paths: [...] }`.
- Forgetting `ins[0] || EMPTY` → crash when unwired.
- Duplicating the first point at the end of a closed path (double pen-down at one spot).
- Using `Math.random()` → un-reproducible art, no seed control.
- Emitting millions of points (deep recursion, tiny steps) — respect the budget.
- Coordinates outside `0..W / 0..H` are allowed (modifiers may pull them back) but
  anything still outside at export prints off-canvas; prefer a `margin` param.

## 9. Testing your node before importing

The definition file is plain JavaScript, so you can validate it in Node.js with a
ten-line harness — the same practice used for every built-in node:

```js
const fs = require("fs");
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function hash2(x,y,s){let h=Math.imul(Math.floor(x)^0x9e3779b9,2654435761);h^=Math.imul(Math.floor(y)^0x85ebca6b,2246822519);h^=Math.imul((s|0)^0xc2b2ae35,3266489917);h=(h^(h>>>15))>>>0;return h/4294967296;}
function noise2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
function resample(pts,closed,step){/* even resampling; see spec section 6 */ if(pts.length<2)return pts.map(p=>p.slice());const src=closed?[...pts,pts[0]]:pts;const out=[src[0].slice()];let acc=0;for(let i=1;i<src.length;i++){let[x0,y0]=src[i-1],[x1,y1]=src[i];let seg=Math.hypot(x1-x0,y1-y0);while(acc+seg>=step){const t=(step-acc)/seg;const nx=x0+(x1-x0)*t,ny=y0+(y1-y0)*t;out.push([nx,ny]);x0=nx;y0=ny;seg=Math.hypot(x1-x0,y1-y0);acc=0;}acc+=seg;}if(!closed)out.push(src[src.length-1].slice());return out;}
const pathLength=(pts)=>{let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return l;};
const applyStyle=(ps)=>ps, signedArea=()=>0;
const H = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const N = new Function(...Object.keys(H), '"use strict"; return (' + fs.readFileSync("my.plotternode.js","utf8") + ");")(...Object.values(H));
const p = {}; for (const pr of N.params) p[pr.key] = pr.def;
const r = N.compute([undefined], p, { W: 210, H: 297 }, {});
console.log(r.paths.length, "paths");
```

Checks worth automating: every point finite and on-sheet across several seeds and
extreme parameter values; determinism (same inputs → identical JSON); the seed
actually changes the output; total points under the 120 000 budget; parameter
behaviors verified with numbers rather than by eye.

## 10. Importing

Save the file as e.g. `myname.plotternode.js` → **Node ⇣** in the toolbar → the node
appears in its palette category immediately. The definition source travels inside saved
patch files, so patches using custom nodes are self-contained. Re-importing the same
`key` replaces the previous version.
