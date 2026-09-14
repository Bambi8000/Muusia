# Muusia — Map Import Guide

Plot a real city with the **Map Import** node: export an OpenStreetMap extract as
GeoJSON, load it into the node, and it fits the canvas with road classes mapped to
pen-plotter line weights. This guide covers getting the data, the node's parameters,
sizing advice and troubleshooting.

The node reads **GeoJSON only**, and reads OSM tags straight from
`feature.properties`. No seed — the file *is* the seed, so the same extract always
plots the same drawing.

---

## 1. Getting map data

### overpass-turbo (recommended)

1. Open **https://overpass-turbo.eu** — no account needed.
2. Pan/zoom the map to the area you want. The visible view is your `{{bbox}}`:
   what you see is what you get. Match its aspect ratio roughly to the Muusia
   canvas, or Fit: Contain leaves wide empty bands.
3. Paste a query (recipes below) and press **Run**. If overpass-turbo offers to
   *auto-complete* the query, decline — the recipes already output geometry.
   Dashed lines at the view edges are the output clipping working as intended.
4. **Export → Data → GeoJSON → download**. Save the `.geojson` file.
   (*copy* also works — paste into a text editor and save with a `.geojson`
   extension. GPX, KML and **raw OSM data from the Overpass API** are *not*
   supported: raw Overpass JSON is `elements[]`, the node needs `features[]`.
   Only the GeoJSON export runs the tags-into-`properties` conversion.)
5. In Muusia: add **Map Import** → **Choose GeoJSON…** → pick the file.

### Always clip the geometry to the bbox

The node frames on **the extent of the recognised features**, not on the query
bbox. Plain `out geom;` returns *complete* ways, so one motorway or river running
out of town stretches the bounding box tens of kilometres and collapses the city
into a smudge in the middle of the sheet. Measured example: a 2 km Helsinki
viewport with one motorway way leaving it framed a 24.9–26.5° × 60.1–61.5° box.

`out geom({{bbox}})` restricts the emitted coordinates to the viewport, so the
data extent ≈ the viewport and the framing is predictable. Ways get cut at the
border, which is exactly what a plotted sheet wants. Every recipe below does this.

### Query recipes

**Full sheet** — roads, rail and water. Over-fetch on purpose: *Minor paths*,
*Rail* and *Buildings* are checkboxes in the node, so download once and decide
later.

```
[out:json][timeout:180];
(
  way[highway]({{bbox}});
  way[railway~"^(rail|light_rail|tram|subway|narrow_gauge)$"]({{bbox}});
  way[natural=water]({{bbox}});
  relation[natural=water]({{bbox}});
  way[landuse=reservoir]({{bbox}});
  way[waterway]({{bbox}});
);
out geom({{bbox}});
```

**Roads only, no footpath noise** (best first test, much smaller file):

```
[out:json][timeout:180];
way[highway][highway!~"^(footway|path|cycleway|steps|pedestrian|bridleway|track|construction|proposed)$"]({{bbox}});
out geom({{bbox}});
```

**Major roads only** — for metropolis-scale areas (Tokyo, Mexico City):

```
[out:json][timeout:180];
way[highway~"^(motorway|trunk|primary|secondary)(_link)?$"]({{bbox}});
out geom({{bbox}});
```

**Buildings** (small areas only — footprints are huge in volume):

```
[out:json][timeout:180];
(
  way[building]({{bbox}});
  relation[building]({{bbox}});
);
out geom({{bbox}});
```

Never query `node[...]` or `nwr[...]`: point features are dropped entirely by the
parser and are pure download weight.

### If the server is busy

The public Overpass API times out under load
(`Dispatcher_Client::request_read_and_idx::timeout`). In order of effort:

- Wait a minute and re-run.
- Switch servers: **Settings (⚙) → Server** →
  `https://overpass.kumi.systems/api/` or `https://overpass.osm.ch/api/`.
- Add `[timeout:180]` and shrink the bbox — bbox size is the main cost.
- Reduce feature count with the roads-only recipe.
- Skip Overpass entirely: **https://extract.bbbike.org** delivers pre-cut city
  extracts (choose GeoJSON) by email, more reliable for large areas.

European evenings are peak load; mornings go through more easily.

**Sanity check:** drop the file on **https://geojson.io** — if it renders there,
Map Import will read it.

---

## 2. The node

| Parameter | What it does |
|---|---|
| **GeoJSON file** | Load the export. Accepts `.geojson` / `.json`. Parsed on load; the parsed result is frozen in `node.data` and travels inside the saved patch. |
| **Fit** | `Contain` shows the whole extract inside the margin box; `Cover` fills the sheet and crops (roads are cut exactly at the frame). |
| **Rotate** | Turns the map (0–360°). The fit accounts for the rotated extent, so 90° on a portrait canvas reframes a landscape extract instead of shrinking it. |
| **Simplify** | Vertex decimation tolerance in **mm**, applied after the fit. OSM geometry is dense; raise this for big areas. See sizing below. |
| **Road weights** | On: motorway/trunk plot as **3** parallel strokes, primary/secondary/tertiary as **2**, everything else as **1**. Off: single stroke everywhere — an even mesh with no hierarchy, at a third of the point cost. |
| **Roads** | Master toggle for all highway lines. |
| **Minor paths** | Adds footway, path, cycleway, steps, pedestrian, track, bridleway. Off by default — these dominate dense city extracts. |
| **Water** | Waterway lines (rivers, streams) and water polygons (lakes, ponds) on the water pen. |
| **Buildings** | Building footprints as closed outlines on the building pen. Off by default. |
| **Rail** | Railway lines on the road pen. |
| **Margin** | Frame inset in mm. Also the crop rectangle, shown as the overlay guide when the node is selected. |
| **Road / Water / Building pen** | One pen per feature family — plot water in blue, roads in black, buildings in a third color. |

The **Style** input takes a style wire like any other generator, and the output is
an ordinary path set — Eraser, Brush Z, Mini Canvas and the rest all chain on
normally.

### What the parser recognises

Everything else in the file is silently ignored, including all point features and
untagged geometry — an ignored feature does not even enter the bounding box (a
`landuse=forest` polygon has zero effect on framing).

| GeoJSON properties | Class | Plotted as | Gate | Pen |
|---|---|---|---|---|
| `highway` = motorway, trunk (+ `_link`) | major | 3 parallel strokes | Roads | Road |
| `highway` = primary, secondary, tertiary (+ `_link`) | mid | 2 parallel strokes | Roads | Road |
| `highway` = any other value (residential, service, unclassified, living_street, …) | street | 1 stroke | Roads | Road |
| `highway` = footway, path, cycleway, steps, pedestrian, track, bridleway | minor | 1 stroke | Minor paths | Road |
| `railway` = **any** value (incl. tram, subway, platform, abandoned) | rail | 1 stroke | Rail | Road |
| `waterway` = any value (line) | waterline | 1 stroke | Water | Water |
| `natural=water`, `water=*`, `landuse=reservoir`, `waterway=riverbank` (polygon) | water | closed outline | Water | Water |
| `building` = any value (polygon) | bldg | closed footprint | Buildings | Building |

Geometry types handled: `LineString`, `MultiLineString`, `Polygon`,
`MultiPolygon`. `Point` / `MultiPoint` are dropped.

Note the `railway` row: the parser accepts *any* `railway` tag, so a broad
`way[railway]` query drags in platforms, disused and razed lines on the road pen.
Filter at the query, as the full-sheet recipe does.

### Projection

Coordinates are projected equirectangular with a `cos(latitude)` correction at the
extract's centre — at city scale this preserves shape and aspect ratio (verified to
<1 % in tests). No Mercator dependency, no external libraries.

---

## 3. Sizing and the point budget

The node has no scale parameter — scale falls out of the extract extent versus the
canvas:

```
extract width  (m) ≈ Δlon° × 111320 × cos(latitude)
extract height (m) ≈ Δlat° × 110570
scale               = canvas_mm / (extract_m × 1000)
```

At Helsinki's latitude `cos(lat) ≈ 0.5`, so 0.02° of longitude is about 1.1 km. A
420 mm canvas over a 3 km extract is roughly 1:7000.

**The budget is 115 000 points per node**, and when it runs out the node stops
emitting — quietly. Lines are processed before polygons, so the symptom is water
and buildings missing while the roads still look complete. Fixes, in order: raise
Simplify, turn **Road weights** off (it triples every motorway and doubles every
primary), turn Buildings off, shrink the bbox, tighten the query.

| Area | Recipe | Simplify |
|---|---|---|
| Neighbourhood / block, 0.3–1 km | full sheet + buildings | 0.1–0.2 |
| Small town (Siilinjärvi) | full sheet | 0.2 |
| One city district (Töölö) | full sheet | 0.25–0.4 |
| Whole mid-size city (Oslo, Helsinki) | roads only | 0.5–1.0 |
| Metropolis (Tokyo, Moscow, Mexico City) | major roads only | 0.8–2.0 |

Simplify is a perpendicular-deviation tolerance, so the same value decimates
harder on a big extract. A vertex is always kept at least every 25 mm, so long
motorway straights never degenerate into a single segment.

---

## 4. Known behaviors

- **Closed highway areas** (`area=yes`: squares like Narinkkatori, turning circles,
  parking aprons) arrive as polygons; the node plots their **outline** as a street
  line. Pedestrian squares hide behind the Minor paths toggle.
- **`waterway=boatyard`** and similar waterway tags plot as water lines. Filter in
  the query (`way[waterway~"^(river|stream|canal)$"]`) if unwanted.
- **Rivers drawn as three parallel lines**: the extract contains both the
  `waterway=river` centreline and the bank polygon (`riverbank` /
  `natural=water`). Pick one — centreline for a graphic single-stroke river,
  polygon for banks — and drop the other from the query.
- **Relations / multipolygon lakes**: `MultiPolygon` water *is* handled, so adding
  `relation[natural=water]({{bbox}});` brings big lakes in. Without the relation
  line they are simply absent, since large water bodies are usually mapped as
  multipolygon relations rather than closed ways.
- **Map shrunk into a small central blob**: unclipped `out geom;`, see §1.
- **Wide empty bands on two sides**: extract aspect ≠ canvas aspect. Rotate 90°,
  switch to Cover, or re-frame the viewport.
- **Patch file suddenly huge**: the parsed GeoJSON is saved inside the patch. Keep
  extracts lean, or re-import into a fresh node rather than carrying a giant one
  around.
- Empty result after loading a valid file usually means every feature was filtered
  out (e.g. a footway-only extract with Minor paths off), or that no feature
  carries a recognised tag at all — check for `highway` / `railway` / `waterway` /
  `natural=water` / `building` inside `properties`.
