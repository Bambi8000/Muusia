# Muusia — Map Import Guide

Plot a real city with the **Map Import** node: export an OpenStreetMap extract as
GeoJSON, load it into the node, and it fits the canvas with road classes mapped to
pen-plotter line weights. This guide covers getting the data, the node's parameters,
sizing advice and troubleshooting.

---

## 1. Getting map data

### overpass-turbo (recommended)

1. Open **https://overpass-turbo.eu** — no account needed.
2. Pan/zoom the map to the area you want. The visible view is your `{{bbox}}`:
   what you see is what you get.
3. Paste a query (recipes below) and press **Run**.
4. **Export → Data → GeoJSON → download**. Save the `.geojson` file.
   (*copy* also works — paste into a text editor and save with a `.geojson`
   extension. GPX, KML and raw OSM data are **not** supported by the node.)
5. In Muusia: add **Map Import** → **Choose GeoJSON…** → pick the file.

### Query recipes

**Full sheet** — roads, rail and water:

```
[out:json][timeout:180];
(
  way[highway]({{bbox}});
  way[railway=rail]({{bbox}});
  way[natural=water]({{bbox}});
  way[waterway]({{bbox}});
);
out geom;
```

**Roads only, no footpath noise** (best first test, much smaller file):

```
[out:json][timeout:180];
way[highway][highway!~"footway|path|cycleway|steps|service"]({{bbox}});
out geom;
```

**Major roads only** — for metropolis-scale areas (Tokyo, Mexico City):

```
[out:json][timeout:180];
way[highway~"motorway|trunk|primary|secondary"]({{bbox}});
out geom;
```

**Buildings** (small areas only — footprints are huge in volume):

```
[out:json][timeout:180];
way[building]({{bbox}});
out geom;
```

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
| **GeoJSON file** | Load the export. Accepts `.geojson` / `.json`. |
| **Fit** | `Contain` shows the whole extract inside the margin box; `Cover` fills the sheet and crops (roads are cut exactly at the frame). |
| **Rotate** | Turns the map (0–360°). The fit accounts for the rotated extent. |
| **Simplify** | Vertex decimation tolerance in **mm**. OSM geometry is dense; raise this for big areas. See sizing below. |
| **Road weights** | On: motorway/trunk plot as **3** parallel strokes, primary/secondary/tertiary as **2**, everything else as **1**. Off: single stroke everywhere. |
| **Roads** | Master toggle for all highway lines. |
| **Minor paths** | Adds footway, path, cycleway, steps, pedestrian, track, bridleway. Off by default — these dominate dense city extracts. |
| **Water** | Waterway lines (rivers, streams) and water polygons (lakes, ponds) on the water pen. |
| **Buildings** | Building footprints as closed outlines on the building pen. Off by default. |
| **Rail** | `railway=rail` lines on the road pen. |
| **Margin** | Frame inset in mm. |
| **Road / Water / Building pen** | One pen per feature family — plot water in blue, roads in black, buildings in a third color. |

### OSM class → line weight

| OSM `highway=` | Class | Strokes (weights on) |
|---|---|---|
| motorway, trunk (+links) | major | 3 |
| primary, secondary, tertiary (+links) | mid | 2 |
| residential, service, unclassified, living_street, … | street | 1 |
| footway, path, cycleway, steps, pedestrian, track, bridleway | minor | 1 (Minor paths toggle) |

### Projection

Coordinates are projected equirectangular with a `cos(latitude)` correction at the
extract's centre — at city scale this preserves shape and aspect ratio (verified to
<1 % in tests). No Mercator dependency, no external libraries.

---

## 3. Sizing and the point budget

Muusia truncates output at ~120 000 points. Rough guidance:

| Area | Recipe | Simplify |
|---|---|---|
| Small town (Siilinjärvi) | full sheet | 0.2 |
| One city district (Töölö) | full sheet | 0.25–0.4 |
| Whole mid-size city (Oslo, Helsinki) | roads only | 0.5–1.0 |
| Metropolis (Tokyo, Moscow, Mexico City) | major roads only | 0.8–2.0 |

If the preview looks truncated (paths missing in one corner), raise Simplify or cut
features: turn off Minor paths, use the filtered query, or shrink the bbox. Buildings
belong on small extracts only.

---

## 4. Known behaviors

- **Closed highway areas** (`area=yes`: squares like Narinkkatori, turning circles,
  parking aprons) arrive as polygons; the node plots their **outline** as a street
  line. Pedestrian squares hide behind the Minor paths toggle.
- **`waterway=boatyard`** and similar waterway tags plot as water lines. Filter in
  the query (`way[waterway~"river|stream|canal"]`) if unwanted.
- **Relations / multipolygon lakes with holes**: `out geom` on ways covers most
  cases; complex relation-based water bodies may arrive incomplete. If a big lake
  is missing, add `relation[natural=water]({{bbox}});` to the query and re-export
  — and if the node still skips it, report it: the parser can be extended.
- Empty result after loading a valid file usually means every feature was filtered
  out (e.g. a footway-only extract with Minor paths off).

---

## 5. Developer notes

For the next documentation batch — two engine conventions this node surfaced,
currently undocumented in MUUSIA-NODE-API.md:

- **`fileLabel` / `fileAccept` are definition-level fields**, not parameter fields:
  set them next to `key`/`name`/`desc` (see Point Cloud). A `fileAccept` placed
  inside the param descriptor is silently ignored and the picker falls back to
  `.svg`.
- **`onFile` results are stored at `node.data.svg`** — the `.svg` key is a
  historical artifact of Import SVG and applies to *every* file node (Point Cloud
  reads its point data from there too). `compute` must read
  `node && node.data && node.data.svg`. The API doc's wording "stored at
  `node.data`" is misleading as written.
