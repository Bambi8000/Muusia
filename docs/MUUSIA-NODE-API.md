# Muusia — Custom Node API (v1.0)

This document is a **complete, self-contained specification** for writing a custom node
for Muusia, a node-graph editor for generative pen-plotter art. You can hand this
document to a developer or an AI assistant and ask for a node; the resulting file is
imported in the app via the **Node ⇣** button (top toolbar).

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
- `layer` — integer pen index `0..5` (Black, Blue, Red, Green, Orange, Purple). Layers
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
| `cat` | string | Palette section: `"gen"` (Generators), `"mod"` (Modifiers), `"dec"` (Decorators), `"duo"` (Combiners), `"math"` (Math). |
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
| `pen` | — | 6 color dots → integer 0–5. |
| `text` | — | Single-line text field. |
| `file` | — | File picker; pair with `onFile`. |

Compute must tolerate any numeric value (wires can push values outside min/max):
clamp inside `compute` where it matters, and `Math.round()` values used as counts.

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
| `PENS` | constant | Array of 6 `{ name, c }` pen colors; use `PENS.length` for cycling. |
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

## 9. Importing

Save the file as e.g. `myname.plotternode.js` → **Node ⇣** in the toolbar → the node
appears in its palette category immediately. The definition source travels inside saved
patch files, so patches using custom nodes are self-contained. Re-importing the same
`key` replaces the previous version.
