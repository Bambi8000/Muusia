/* Muusia — built-in Help examples.
 *
 * Each entry: { name, desc, make(defaults) => { nodes, edges } }.
 * `defaults(type)` is injected by App.jsx at load time so this file has no
 * imports and stays runnable in plain Node for validation
 * (tools/validate-examples.mjs).
 *
 * Conventions:
 * - node ids 9001+, edge ids "e9101"+ (loadExample resets NEXT_ID to 9500)
 * - start from defaults(type) and override only the params that differ
 * - built-in nodes only (no custom nodes, no file-import nodes)
 * - fixed seeds — an example must look good deterministically
 * - optional `canvas: { W, H }` per entry if the patch depends on sheet size
 */

// Shapes starting settings mirror learn/shapes/content.mjs; validated by the Shapes gate.
const SHAPE_LESSONS = [
  {
    "example": "Flow Field · Even pole streams",
    "key": "flow",
    "summary": "Evenly spaced streams bend around a ring of vortices and sinks.",
    "settings": {
      "field": "Mixed poles",
      "placement": "Even spacing",
      "separation": 3.5,
      "count": 100,
      "steps": 180,
      "poles": 4,
      "ring": 42,
      "core": 7,
      "layer": 0
    },
    "motion": {
      "target": "phase",
      "source": "rot °"
    },
    "steps": [
      [
        "Choose the field",
        "Add Flow Field. Set Field to Mixed poles and Line placement to Even spacing. Leave Poles unwired for the fallback ring."
      ],
      [
        "Set a physical spacing",
        "Set Separation mm to 3.5. This is the stopping distance from earlier traces, rather than a promise that every gap is exactly the same width."
      ],
      [
        "Shape the centres",
        "Use four Fallback poles on a 42 mm Pole ring, with a 7 mm Pole core. Alternate centres draw vortices and sinks."
      ],
      [
        "Fill the page",
        "Raise Trails to 100 and Length to 180. These are upper limits: traces stop at the margin, earlier lines or their own looping history."
      ],
      [
        "Place your own poles",
        "For a custom field, wire markers to Poles. Closed paths contribute their vertex-average centres and open paths their first point. Wired markers replace the ring."
      ]
    ]
  },
  {
    "example": "Wave · Two-source interference",
    "key": "aaltoilu",
    "summary": "A shared wave field bends parallel lines into changing interference bands.",
    "settings": {
      "mode": "Interference",
      "amp": 9,
      "wl": 28,
      "angle": 90,
      "decay": 0.1,
      "sourceX": 148.5,
      "sourceY": 105,
      "separation": 72
    },
    "source": {
      "key": "grid",
      "settings": {
        "vlines": 0,
        "hlines": 50,
        "margin": 25,
        "res": 2,
        "layer": 0
      }
    },
    "motion": {
      "target": "phaseDeg",
      "source": "rot °"
    },
    "steps": [
      [
        "Start with lines",
        "Add Grid. Set Vertical lines to 0, Horizontal lines to 50 and Margin mm to 25 on an A4 wide sheet."
      ],
      [
        "Connect the drawing",
        "Connect Grid Paths to the first Wave input. Wave sources is optional and takes marker paths; it does not take the artwork."
      ],
      [
        "Choose interference",
        "Set Wave field to Interference, Amplitude mm to 9 and Wavelength mm to 28. The two fallback sources sit around Source X/Y."
      ],
      [
        "Set the displacement",
        "Use Displacement angle 90° for vertical movement. Source separation 72 mm changes the interference spacing; Decay weakens distant waves."
      ],
      [
        "Move the wave",
        "Scrub Phase °. All lines use the same canvas-space wave field. The original Along path mode still follows each stroke independently."
      ]
    ]
  },
  {
    "example": "To Polar · Spiral morph",
    "key": "topolar",
    "summary": "Blend a flat drawing into a spiral using one continuous Morph control.",
    "settings": {
      "mode": "Spiral",
      "turns": 2.4,
      "rin": 10,
      "rise": 70,
      "morph": 75,
      "noise": 20,
      "noiseSize": 65,
      "margin": 20
    },
    "source": {
      "key": "grid",
      "settings": {
        "vlines": 18,
        "hlines": 14,
        "margin": 20,
        "res": 2,
        "layer": 0
      }
    },
    "motion": {
      "target": "morph",
      "source": "t",
      "math": {
        "op": "A × B",
        "b": 100
      }
    },
    "steps": [
      [
        "Build a regular source",
        "Add Grid with 18 vertical and 14 horizontal lines. Connect its Paths to To Polar Source."
      ],
      [
        "Select Spiral",
        "Set Wrap to Spiral, Turns to 2.4 and Inner radius mm to 10. Rings retains the original polar wrapping."
      ],
      [
        "Grow the spiral radius",
        "Set Spiral rise to 70%. This allocates most radial growth to horizontal progression, while leaving some separation between source rows."
      ],
      [
        "Blend the two states",
        "Set Morph to 75%. At 0 the input passes through exactly; at 100 it reaches the target unless Morph variation locally reduces the blend."
      ],
      [
        "Add local variation",
        "Set Morph variation to 20% and Variation size to 65 mm for a less uniform transition. Set variation to 0 for a complete target at Morph 100."
      ]
    ]
  },
  {
    "example": "Warp · Piecewise woven grid",
    "key": "warp",
    "summary": "A coarse deformation cage produces straight cell interiors and sharp changes at cell edges.",
    "settings": {
      "mode": "Cell interpolation",
      "cells": 7,
      "amp": 26,
      "safeCells": true,
      "seed": 21
    },
    "source": {
      "key": "grid",
      "settings": {
        "vlines": 50,
        "hlines": 35,
        "margin": 18,
        "res": 2,
        "layer": 0
      }
    },
    "motion": {
      "target": "cellPhase",
      "source": "rot °"
    },
    "steps": [
      [
        "Make a fine grid",
        "Add Grid with 50 vertical and 35 horizontal lines. Connect it to Warp."
      ],
      [
        "Choose the interpolation",
        "Set Mode to Cell interpolation. The original Grid lattice is smooth; this mode uses piecewise bilinear cells."
      ],
      [
        "Use a coarse cage",
        "Set Grid cells to 7. This controls the deformation cage, not the number of incoming drawing lines."
      ],
      [
        "Keep cells upright",
        "Set Grid amp to 26 mm and leave Prevent folds on. If the cage would invert, the displacement is reduced uniformly across the entire cage."
      ],
      [
        "Rotate the deformation",
        "Move Cell phase. The same seeded displacement vectors rotate continuously while the outer cage boundary stays fixed."
      ]
    ]
  },
  {
    "example": "Truchet · Butterfly bands",
    "key": "truchet",
    "summary": "Outlined or hatched concentric bands form a repeating optical tile field.",
    "settings": {
      "mode": "Butterfly",
      "tile": 30,
      "bands": 5,
      "bandRatio": 45,
      "rowOffset": 1,
      "bandDrawing": "Outlines",
      "margin": 15,
      "layer": 0
    },
    "steps": [
      [
        "Add the pattern",
        "Add Truchet and set Pattern to Butterfly. This is a new mode; the single-line Loop solver is unchanged."
      ],
      [
        "Set the tile size",
        "Use Tile mm 30 and Scale 100%. The node centres complete tiles inside the margin."
      ],
      [
        "Choose the bands",
        "Set Bands per tile to 5 and Band width to 45%. Width controls each ink band relative to the space between bands."
      ],
      [
        "Set the tile rhythm",
        "Row offset 1 alternates Butterfly orientations across rows. Offset 0 repeats the same column rhythm on every row."
      ],
      [
        "Choose the pen geometry",
        "Outlines draws closed annular bands. Hatch replaces each band with open concentric arc strokes at Hatch gap mm."
      ]
    ]
  },
  {
    "example": "Tiles · Hidden square field",
    "key": "tiles",
    "summary": "Coherent noise moves, turns and shrinks repeated shapes inside their own cells.",
    "settings": {
      "shape": "Superellipse",
      "superN": 8,
      "cols": 16,
      "rows": 11,
      "sizeX": 100,
      "field": 95,
      "fieldScale": 50,
      "fieldMove": 70,
      "fieldShrink": 65,
      "fieldRotate": 110,
      "clipCell": true,
      "margin": 15,
      "layer": 0
    },
    "motion": {
      "target": "phase",
      "source": "rot °"
    },
    "steps": [
      [
        "Make square-like tiles",
        "Add Tiles with Superellipse N 8, Columns 16, Rows 11 and Size X 100%."
      ],
      [
        "Enable the shared field",
        "Set Field variation to 95% and Field size to 50 mm. Nearby tiles now respond together rather than jittering independently."
      ],
      [
        "Set the three responses",
        "Use Field shift 70%, Field shrink 65% and Field rotation 110°. Each response is multiplied by the local field strength."
      ],
      [
        "Keep the cell windows",
        "Enable Clip to own cell. Each transformed motif is clipped against its original rectangular cell, exposing white corners."
      ],
      [
        "Move through the field",
        "Scrub Field phase. The noise follows a closed phase circle, so phase 360 returns to the same arrangement as phase 0."
      ]
    ]
  },
  {
    "example": "Mini Squares · Rounded rectangle mosaic",
    "key": "mini_squares",
    "summary": "Variable-width and height rectangles fill a shared modular grid without overlaps.",
    "settings": {
      "packing": "Rectangles",
      "cell": 7,
      "maxWidth": 5,
      "maxHeight": 3,
      "corner": 1.5,
      "gap": 1,
      "density": 1,
      "spread": "Full",
      "margin": 15,
      "layer": 0
    },
    "steps": [
      [
        "Choose the packing family",
        "Add Mini Squares and set Packing to Rectangles. The original Squares mode and nested square treatments remain available."
      ],
      [
        "Set the module",
        "Use Cell 7 mm. Rectangle dimensions are whole numbers of this module."
      ],
      [
        "Allow different proportions",
        "Set Max width cells to 5 and Max height cells to 3. Both are limits rather than fixed rectangle dimensions."
      ],
      [
        "Separate neighbouring blocks",
        "Set Gap to 1 mm and Corner radius to 1.5 mm. Each outline remains inside its allocated cells."
      ],
      [
        "Fill the sheet",
        "Set Density to 1 and Spread to Full for a complete mosaic. Lower Density to create patches and voids."
      ]
    ]
  },
  {
    "example": "Network · Drifting neighbourhoods",
    "key": "network",
    "summary": "Stable moving points gain and lose neighbours as their distances change.",
    "settings": {
      "motion": "Drift",
      "nodes": 65,
      "links": 3,
      "radius": 36,
      "drift": 20,
      "dots": true,
      "degsize": true,
      "margin": 18,
      "layer": 0
    },
    "motion": {
      "timeline": true
    },
    "steps": [
      [
        "Choose the moving layout",
        "Add Network and set Layout to Drift. Force layout remains the original deterministic untangling simulation."
      ],
      [
        "Set the population",
        "Use 65 Nodes and 3 Links per node. The seeded point identities stay fixed while their positions change."
      ],
      [
        "Limit the neighbourhood",
        "Set Connection radius to 36 mm. A point only proposes connections to its nearest neighbours inside this radius; final undirected degree may exceed Links per node."
      ],
      [
        "Set the movement",
        "Use Drift 20 mm. The amplitude is reduced on small pages to leave room inside the margin."
      ],
      [
        "Play the motion",
        "Set Time source to Timeline and press ANIMATE Play. Use 12 frames for the supplied preview; the patch does not save the global frame count."
      ]
    ]
  },
  {
    "example": "Cell Strands · Shared-edge bundles",
    "key": "cell_strands",
    "summary": "Parallel bundles meet at identical stations along shared distorted cell edges.",
    "settings": {
      "mode": "Hex strands",
      "cell": 25,
      "strands": 7,
      "deform": 65,
      "fieldSize": 55,
      "curve": 70,
      "density": 85,
      "carry": 45,
      "edges": true,
      "edgePen": 7,
      "layer": 0,
      "margin": 15
    },
    "motion": {
      "target": "phase",
      "source": "rot °"
    },
    "steps": [
      [
        "Choose a cell network",
        "Add Cell Strands. Hex strands creates shared hexagonal cells; Ribbon cells uses square cells."
      ],
      [
        "Set the bundle size",
        "Use Cell size 25 mm and 7 Strands per bundle. Shared edges have identical station positions in both neighbouring cells."
      ],
      [
        "Deform the cells",
        "Set Displacement to 65% and Field size to 55 mm. The deformation is uniformly reduced if any cell would cease to be convex."
      ],
      [
        "Open and close routes",
        "Use Occupied cells 85% and Extra routes 45%. Some bundles end at empty cells or unused neighbouring edges; matching routes meet exactly."
      ],
      [
        "Separate the edge layer",
        "Enable Cell edges and choose a different Edge pen, or turn the edges off to retain only the travelling bundles."
      ]
    ]
  },
  {
    "example": "Block Field · Stepped noise terrain",
    "key": "block_field",
    "summary": "Real closed 3D blocks become a hidden-line drawing and a reusable mesh.",
    "settings": {
      "mode": "Column terrain",
      "heightSource": "Noise",
      "cols": 16,
      "rows": 13,
      "height": 7,
      "terraces": 8,
      "noiseSize": 4,
      "gap": 10,
      "drawing": "Outlines",
      "hidden": true,
      "yaw": 35,
      "elevation": 32,
      "size": 235,
      "margin": 15,
      "layer": 0
    },
    "motion": {
      "target": "phase",
      "source": "rot °"
    },
    "steps": [
      [
        "Create the terrain",
        "Add Block Field with Column terrain and Noise heights. Start with 16 Columns and 13 Rows."
      ],
      [
        "Shape the heights",
        "Use Height × cell 7, Height steps 8 and Noise size 4 cells. Height steps 0 makes column heights continuous."
      ],
      [
        "Separate the blocks",
        "Set Cell gap to 10%. Choose Outlines and keep Hidden-line removal on so nearer columns hide the ones behind."
      ],
      [
        "Choose a camera",
        "Set View angle 35° and View elevation 32°. These camera settings affect Drawing only. Mesh consumers have their own camera and size."
      ],
      [
        "Reuse the solid",
        "Connect the orange Mesh output to Mesh Render, Mesh Slice or 3D Spikes. For a height image, choose Image and load a file: darker pixels make taller blocks."
      ]
    ]
  }
];

import { TYPE_STUDIO_STYLES } from "./defs/type-studio.js";

const MULTICOLOUR_GRID_EXAMPLES = [
  {
    "name": "Multicolour Grid \u00b7 Colour drift",
    "desc": "Three pens follow the same seed with small Warp strength and Cell phase differences. Select Merge. Keep Pen change per input off. Open Learn \u2192 Multicolour folded grids for the full tutorial.",
    "canvas": {
      "W": 297,
      "H": 420
    },
    "graph": {
      "nodes": [
        {
          "id": 9001,
          "type": "mm_paper",
          "x": 30,
          "y": 40,
          "collapsed": true,
          "params": {
            "fine": 1.5,
            "midEvery": 0,
            "majorEvery": 0,
            "fineOn": true,
            "snap": false,
            "border": true,
            "margin": 30,
            "penFine": 0,
            "penMid": 1,
            "penMajor": 2
          }
        },
        {
          "id": 9002,
          "type": "warp",
          "x": 390,
          "y": 40,
          "params": {
            "safeCells": true,
            "cellPhase": 0,
            "mode": "Cell interpolation",
            "tlx": 0,
            "tly": 0,
            "trx": 0,
            "trY": 0,
            "brx": 0,
            "bry": 0,
            "blx": 0,
            "bly": 0,
            "cells": 4,
            "amp": 40,
            "seed": 21
          },
          "collapsed": true
        },
        {
          "id": 9003,
          "type": "mm_paper",
          "x": 30,
          "y": 200,
          "collapsed": true,
          "params": {
            "fine": 1.5,
            "midEvery": 0,
            "majorEvery": 0,
            "fineOn": true,
            "snap": false,
            "border": true,
            "margin": 30,
            "penFine": 6,
            "penMid": 1,
            "penMajor": 2
          }
        },
        {
          "id": 9004,
          "type": "warp",
          "x": 390,
          "y": 200,
          "params": {
            "safeCells": true,
            "cellPhase": 2,
            "mode": "Cell interpolation",
            "tlx": 0,
            "tly": 0,
            "trx": 0,
            "trY": 0,
            "brx": 0,
            "bry": 0,
            "blx": 0,
            "bly": 0,
            "cells": 4,
            "amp": 38,
            "seed": 21
          },
          "collapsed": true
        },
        {
          "id": 9005,
          "type": "mm_paper",
          "x": 30,
          "y": 360,
          "collapsed": true,
          "params": {
            "fine": 1.5,
            "midEvery": 0,
            "majorEvery": 0,
            "fineOn": true,
            "snap": false,
            "border": true,
            "margin": 30,
            "penFine": 2,
            "penMid": 1,
            "penMajor": 2
          }
        },
        {
          "id": 9006,
          "type": "warp",
          "x": 390,
          "y": 360,
          "params": {
            "safeCells": true,
            "cellPhase": 358,
            "mode": "Cell interpolation",
            "tlx": 0,
            "tly": 0,
            "trx": 0,
            "trY": 0,
            "brx": 0,
            "bry": 0,
            "blx": 0,
            "bly": 0,
            "cells": 4,
            "amp": 42,
            "seed": 21
          },
          "collapsed": true
        },
        {
          "id": 9007,
          "type": "merge",
          "x": 750,
          "y": 170,
          "params": {
            "count": 3,
            "penPer": false
          },
          "collapsed": true
        }
      ],
      "edges": [
        {
          "id": "e9101",
          "from": 9001,
          "fromPort": 0,
          "to": 9002,
          "toPort": 0
        },
        {
          "id": "e9102",
          "from": 9002,
          "fromPort": 0,
          "to": 9007,
          "toPort": 0
        },
        {
          "id": "e9103",
          "from": 9003,
          "fromPort": 0,
          "to": 9004,
          "toPort": 0
        },
        {
          "id": "e9104",
          "from": 9004,
          "fromPort": 0,
          "to": 9007,
          "toPort": 1
        },
        {
          "id": "e9105",
          "from": 9005,
          "fromPort": 0,
          "to": 9006,
          "toPort": 0
        },
        {
          "id": "e9106",
          "from": 9006,
          "fromPort": 0,
          "to": 9007,
          "toPort": 2
        }
      ],
      "outputId": 9007
    }
  },
  {
    "name": "Multicolour Grid \u00b7 Three shared-warp pens",
    "desc": "Array repeats one grid onto three pens before a shared Cell interpolation Warp. Set Pen maps Blue to Teal. Select Warp. Open Learn \u2192 Multicolour folded grids.",
    "canvas": {
      "W": 297,
      "H": 420
    },
    "graph": {
      "nodes": [
        {
          "id": 9001,
          "type": "mm_paper",
          "x": 30,
          "y": 40,
          "collapsed": true,
          "params": {
            "fine": 3,
            "midEvery": 0,
            "majorEvery": 0,
            "fineOn": true,
            "snap": false,
            "border": true,
            "margin": 27,
            "penFine": 0,
            "penMid": 1,
            "penMajor": 2
          }
        },
        {
          "id": 9002,
          "type": "array",
          "x": 420,
          "y": 40,
          "params": {
            "layout": "Linear",
            "columns": 5,
            "pitchX": 35,
            "pitchY": 35,
            "radius": 65,
            "turns": 2,
            "height": 130,
            "start": 0,
            "motifSize": 18,
            "follow": true,
            "yaw": 25,
            "elevation": 25,
            "persp": 0,
            "count": 3,
            "dx": 0.25,
            "dy": 0.25,
            "drot": 0,
            "dscale": 0.5,
            "jit": 0,
            "penPer": true,
            "seed": 16
          },
          "collapsed": true
        },
        {
          "id": 9003,
          "type": "setpen",
          "x": 30,
          "y": 210,
          "collapsed": true,
          "params": {
            "mode": "Single",
            "from": 1,
            "layer": 6
          }
        },
        {
          "id": 9004,
          "type": "warp",
          "x": 420,
          "y": 210,
          "params": {
            "safeCells": true,
            "cellPhase": 0,
            "mode": "Cell interpolation",
            "tlx": 0,
            "tly": 0,
            "trx": 0,
            "trY": 0,
            "brx": 0,
            "bry": 0,
            "blx": 0,
            "bly": 0,
            "cells": 4,
            "amp": 42,
            "seed": 21
          },
          "collapsed": true
        }
      ],
      "edges": [
        {
          "id": "e9101",
          "from": 9001,
          "fromPort": 0,
          "to": 9002,
          "toPort": 0
        },
        {
          "id": "e9102",
          "from": 9002,
          "fromPort": 0,
          "to": 9003,
          "toPort": 0
        },
        {
          "id": "e9103",
          "from": 9003,
          "fromPort": 0,
          "to": 9004,
          "toPort": 0
        }
      ],
      "outputId": 9004
    }
  },
  {
    "name": "Multicolour Grid \u00b7 Four shared-warp pens",
    "desc": "Array repeats one grid onto four pens with a 0.25 mm shift and 0.5% size change per copy. Set Pen maps Green to Teal. Select Warp. Open Learn \u2192 Multicolour folded grids.",
    "canvas": {
      "W": 297,
      "H": 420
    },
    "graph": {
      "nodes": [
        {
          "id": 9001,
          "type": "mm_paper",
          "x": 30,
          "y": 40,
          "collapsed": true,
          "params": {
            "fine": 3,
            "midEvery": 0,
            "majorEvery": 0,
            "fineOn": true,
            "snap": false,
            "border": true,
            "margin": 27,
            "penFine": 0,
            "penMid": 1,
            "penMajor": 2
          }
        },
        {
          "id": 9002,
          "type": "array",
          "x": 420,
          "y": 40,
          "params": {
            "layout": "Linear",
            "columns": 5,
            "pitchX": 35,
            "pitchY": 35,
            "radius": 65,
            "turns": 2,
            "height": 130,
            "start": 0,
            "motifSize": 18,
            "follow": true,
            "yaw": 25,
            "elevation": 25,
            "persp": 0,
            "count": 4,
            "dx": 0.25,
            "dy": 0.25,
            "drot": 0,
            "dscale": 0.5,
            "jit": 0,
            "penPer": true,
            "seed": 16
          },
          "collapsed": true
        },
        {
          "id": 9003,
          "type": "setpen",
          "x": 30,
          "y": 210,
          "collapsed": true,
          "params": {
            "mode": "Single",
            "from": 3,
            "layer": 6
          }
        },
        {
          "id": 9004,
          "type": "warp",
          "x": 420,
          "y": 210,
          "params": {
            "safeCells": true,
            "cellPhase": 0,
            "mode": "Cell interpolation",
            "tlx": 0,
            "tly": 0,
            "trx": 0,
            "trY": 0,
            "brx": 0,
            "bry": 0,
            "blx": 0,
            "bly": 0,
            "cells": 4,
            "amp": 42,
            "seed": 21
          },
          "collapsed": true
        }
      ],
      "edges": [
        {
          "id": "e9101",
          "from": 9001,
          "fromPort": 0,
          "to": 9002,
          "toPort": 0
        },
        {
          "id": "e9102",
          "from": 9002,
          "fromPort": 0,
          "to": 9003,
          "toPort": 0
        },
        {
          "id": "e9103",
          "from": 9003,
          "fromPort": 0,
          "to": 9004,
          "toPort": 0
        }
      ],
      "outputId": 9004
    }
  }
];

export const EXAMPLES = [
  {
    name: "Avatar 3D · Run cycle",
    desc: "A running figure with bent elbows, knee recovery and a flight phase. Open ANIMATE to play or scrub the 24-frame loop. Posing Stand / walk / run keeps the cycle phase continuous while Movement blend changes from Standing through Walking to Running. Stride, arm swing, body adjustments, joint offsets, drawing styles, seeds, camera and cuts remain available.",
    canvas: { W: 210, H: 297 },
    animation: { frames: 24 },
    make: defaults => ({ nodes: [{ id: 9001, type: "avatar3d", x: 30, y: 20, params: { ...defaults("avatar3d"), preset: "Female", seed: 43, poseMode: "Stand / walk / run", gaitFrom: "Standing", gaitTo: "Running", gaitBlend: 1, gaitTransition: "Manual", gaitMotion: "Timeline", plotStyle: "Brush", brushWidth: 2.5 } }], edges: [] }),
  },
  {
    name: "Avatar 3D · Stand, walk, run",
    desc: "A repeatable transition from Standing through Walking to Running and back. ANIMATE supplies a shared step phase and a smooth ping-pong movement blend. The 72-frame sequence gives the gait time to change. For a one-way start or stop, choose Transition playback One-way; swap Start movement and End movement to reverse it.",
    canvas: { W: 210, H: 297 },
    animation: { frames: 72 },
    make: defaults => ({ nodes: [{ id: 9001, type: "avatar3d", x: 30, y: 20, params: { ...defaults("avatar3d"), preset: "Male", seed: 17, poseMode: "Stand / walk / run", gaitFrom: "Standing", gaitTo: "Running", gaitTransition: "Timeline", gaitCycle: "Ping-pong", gaitMotion: "Timeline", gaitSpeed: 3, plotStyle: "Contours", penWidth: .35, linePitch: .9 } }], edges: [] }),
  },
  {
    name: "Avatar 3D · Walk cycle",
    desc: "An in-place walking figure with a seamless animation loop. Open ANIMATE to scrub or play. Walk speed sets complete cycles per loop; Stride length and Arm swing shape the gait independently. Use more frames for a smoother sequence at higher speeds. Body area changes anatomy, Pose body part adds joint offsets, and the camera, slicing and plotting styles remain available.",
    canvas: { W: 210, H: 297 },
    animation: { frames: 24 },
    make: defaults => ({ nodes: [{ id: 9001, type: "avatar3d", x: 30, y: 20, params: { ...defaults("avatar3d"), preset: "Female", seed: 43, poseMode: "Walk cycle", walkMotion: "Timeline", walkSpeed: 1, walkStride: 1, walkArmSwing: 1, walkGround: true, plotStyle: "Brush", brushWidth: 2.5 } }], edges: [] }),
  },
  {
    name: "Avatar 3D · Pose transition",
    desc: "A grounded figure moves from Relaxed to Reach. Open ANIMATE and scrub or play the frames. Start pose A and End pose B each keep independent arm, leg, head and torso offsets. Pose motion uses the timeline; Motion controls rotation and slicing separately. Brush uses broad 2.5 mm gestures; switch Drawing style for fine pen contours or hatching.",
    canvas: { W: 210, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "avatar3d", x: 30, y: 20, params: { ...defaults("avatar3d"), preset: "Female", seed: 43, posePreset: "Relaxed", poseTarget: "Reach", poseMotion: "Timeline", poseCycle: "Ping-pong", poseGround: true, plotStyle: "Brush", brushWidth: 2.5 } }], edges: [] }),
  },
  {
    name: "Avatar 3D · Seated pen study",
    desc: "A seated male study with 0.35 mm contours and hatching. Adjust pose Start A, then choose a Pose body part to change each limb, head or torso independently. Body area changes proportions while preserving the pose. Visible body isolates a bust, feet or band; turn View to inspect front, side and back.",
    canvas: { W: 210, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "avatar3d", x: 30, y: 20, params: { ...defaults("avatar3d"), preset: "Male", seed: 17, posePreset: "Seated", poseTarget: "Seated", poseGround: true, plotStyle: "Contours + hatching", penWidth: .35, linePitch: .9, poseArea: "Left arm" } }], edges: [] }),
  },
  ...[
    {name:"Engraved motion",params:{}},
    {name:"Contour film",params:{drawing:"Contours",simplify:.15}},
    {name:"Crosshatched motion",params:{drawing:"Crosshatching",pitch:2.2,hatchAngle:-35,levels:4}},
    {name:"Stipple film",params:{drawing:"Stipple",pitch:3,dotDiameter:.8}},
    {name:"Small plot frames",canvas:{W:72,H:100},params:{drawing:"Contours + hatching",pitch:.7,minLength:.3,margin:4,columns:192,simplify:.08}}
  ].map(p=>({
    name:"GIF to G-code · "+p.name,
    frames:24,
    desc:"Select GIF to G-code. Choose animated GIF imports all source frames, switches from the demo to your file and sets ANIMATE Frames. Drawing chooses joined contour loops, physical hatch strokes, crosshatched shadows or real small stipple circles. Simplify and Min path length reduce tiny moves; Line / dot spacing is in millimetres, with a fixed whole-frame budget that may coarsen dense requests uniformly. Contour threshold controls the traced tonal boundary, including holes. Scale, Rotation, Offset, Contain/Cover and Keep aspect ratio place the image; unlock for independent stretch. Colour channel, levels, brightness, contrast, gamma and inversion tune the ink. Manual selects a still; Timeline follows Play. Keep matching frame counts, Phase 0 and Cycles 1 to visit each source frame once; Original timing samples delays. Select Drawing and use GENERATE G-CODE for the current frame or ANIMATE G-code × N for one complete program per frame in a ZIP. Set your machine's pen lift, speed and origin in Machine setup. SVG/DXF export the same actual XY strokes. Blue Contours and Shading outputs allow separate processing. Downloads do not run the plotter.",
    canvas:p.canvas||{W:297,H:210},
    make:defaults=>({nodes:[{id:9001,type:"gif_gcode",x:40,y:30,params:{...defaults("gif_gcode"),...p.params,source:"Colour demo",time:"Timeline"}}],edges:[]})
  })),

  ...[
    {name:"Colour to dots",params:{}},
    {name:"Colouring outlines",params:{render:"Outlines",edge:14,columns:192}},
    {name:"Light colouring guide",params:{render:"Outlines + light tone",ink:18,mode:"Bayer 4×4",columns:160}},
    {name:"Turned animation",params:{angle:-25,scale:125,mode:"Atkinson",contrast:1.25,columns:160}},
    {name:"Bold threshold",params:{mode:"Threshold",channel:"Darkest channel",threshold:60,scale:85}}
  ].map(p=>({
    name:"GIF to Receipt · "+p.name,
    frames:24,
    desc:"Select GIF to Receipt, then Choose animated GIF to open your animation. Import keeps every source frame and sets ANIMATE Frames. These starters use the built-in colour demo. Scale, Rotation, Offset and Keep aspect ratio place it on the receipt. Drawing Outlines leaves white areas for colouring by hand; Light tone adds a faint guide. Colour channel, Brightness, Contrast, Gamma, Black/White points, Threshold, Invert and five monochrome modes tune black reproduction. Bayer stays fixed between frames. Time source Timeline follows Play; Manual picks a still. Every source frame uses each frame once when ANIMATE Frames matches the GIF, Phase is zero and Cycles is one; Original timing samples its delays into equally spaced output frames. Receipt strip × N downloads ONE continuous numbered receipt: no cuts or extra feeds between frames, Cut only at the end. Receipt × N keeps separate files. Registration marks help rephotograph a hand-coloured strip. No printing happens on download.",
    canvas:{W:72,H:100},
    make:defaults=>({nodes:[{id:9001,type:"gif_receipt",x:40,y:30,params:{...defaults("gif_receipt"),...p.params,source:"Colour demo",time:"Timeline"}}],edges:[]})
  })),

  ...[
    {title:'Raised ribbon',params:{wave:0,twist:0,roll:-10,elevation:28,depth:100,shoulder:3}},
    {title:'Wave ribbon',params:{text:'FLOW',wave:15,twist:25,depth:100,roll:-8,elevation:24,height:250,shoulder:3}},
    {title:'Raised ring',params:{text:'TYPE LOOP',surface:'Ring',height:90,radius:140,depth:70,ribbonLines:48,wave:0,twist:0,roll:0,elevation:50,phase:40}},
  ].map(m=>({
    name:'Text Roll · '+m.title,
    desc:'Select Text Roll, Construction Raised ribbon. This is one continuous band ruled with horizontal rows: each row rises into the letter strokes, runs along their raised surface and returns to the band in spaces and counters. The letters share the ribbon. Horizontal lines changes the stripes; Letter depth changes relief, Relief shoulder rounds its rise and Ribbon padding adds blank borders. Drum wraps an upright ribbon, Ring lays it into an annulus. Scroll, Rock and Tumble work with Manual Phase or Timeline. Set 24 or 32 ANIMATE frames and Play; the framing stays fixed and endpoints match. Hidden lines off reveals complete closed rows including the far side. Construction Floating letters retains the original separate letter sculptures. On this 72 × 100 mm canvas, Receipt × N downloads numbered registered frames; SVG/G-code use the same XY ink. Printing is separate.',
    canvas:{W:72,H:100},
    make:defaults=>({nodes:[{id:9101,type:'text_roll',x:40,y:20,params:{...defaults('text_roll'),construction:'Raised ribbon',time:'Timeline',...m.params}}],edges:[]}),
  })),
  ...[
    {title:'Sculpted drum',params:{}},
    {title:'Rolling ring',params:{text:'TYPE LOOP',surface:'Ring',height:90,radius:130,depth:75,slices:22,twist:20,elevation:46,phase:40,roll:12,wave:15}},
    {title:'Rippled scroll',params:{text:'FLOW',height:220,arc:290,depth:80,slices:26,wave:40,waves:3,twist:70,elevation:20,phase:110}},
    {title:'Rocking receipt',params:{text:'ROLL',motion:'Rock',height:260,radius:80,depth:60,slices:22,wave:0,twist:0,elevation:22,phase:35}},
  ].map(m=>({
    name:'Text Roll · '+m.title,
    desc:'Select Text Roll. Thick letters travel around a three-dimensional Drum or Ring. Edit Text, then try Letter height, Radius, Letter depth and Contour slices. Wave and Twist deform the moving letters. Hidden lines removes back ink using the actual solid glyph faces and side walls; switch it off to see through the lettering. Empty space and counters remain open. Choose Scroll, Rock or Tumble. Open ANIMATE, set 24 or 32 frames and Play: Time source Timeline needs no wire. Phase offsets the loop, Direction reverses it, Loops sets whole cycles. Manual freezes a still. The framing stays fixed while the letters move. This 72 × 100 mm canvas fits receipts: Receipt × N downloads numbered frames with registration marks; printing is separate. SVG and G-code export the same real XY ink. Depth is visual and never machine Z. Uppercase ÄÖÅ are supported; unknown glyphs become ?.',
    canvas:{W:72,H:100},
    make:defaults=>({nodes:[{id:9101,type:'text_roll',x:40,y:20,params:{...defaults('text_roll'),time:'Timeline',...m.params}}],edges:[]}),
  })),
  ...[
    { title: "Firework", effect: "Firework", phase: 45, cy: 50, amount: 640, gravity: 35, trails: 65, grain: 22 },
    { title: "Willow trails", effect: "Willow", phase: 58, cy: 37, amount: 480, gravity: 85, trails: 100, grain: 25 },
    { title: "Volley", effect: "Volley", phase: 58, cy: 50, amount: 1000, gravity: 35, trails: 65, grain: 22 },
    { title: "Mushroom cloud", effect: "Mushroom cloud", phase: 50, cy: 84, amount: 640, gravity: 45, trails: 60, grain: 65, smoke: 75 },
    { title: "Ground blast", effect: "Ground blast", phase: 48, cy: 78, amount: 800, gravity: 55, trails: 80, grain: 45, smoke: 55 },
    { title: "Shockwave", effect: "Shockwave", phase: 52, cy: 50, amount: 640, gravity: 45, trails: 60, grain: 30, rings: 4 },
    { title: "Collision", effect: "Collision", phase: 62, cy: 50, amount: 520, gravity: 30, trails: 70, grain: 40 },
    { title: "Fountain", effect: "Fountain", phase: 48, cy: 88, amount: 480, gravity: 50, trails: 85, grain: 25 },
  ].map(m => ({
    name: "Pixel Blast · " + m.title,
    desc: "Select Pixel Blast. " + m.effect + " is an original seeded black pixel effect on a 72 × 100 mm receipt canvas. Open ANIMATE, set 24 or 32 frames and Play. Time source Timeline uses the current frame; Phase offsets the cycle and Loops per timeline changes speed in whole cycles. Manual freezes a Phase for one print. Pixel size stays in physical millimetres; Pixel fill 100% joins adjacent blocks. Filled pixels are real serpentine ink paths, so SVG, G-code and receipt exports share the drawing. Choose Receipt × N to download numbered receipt frames with registration marks in one ZIP, then send selected files from Print. DOWNLOAD RECEIPT FILE saves only the current still. These actions download files; they do not print. Trails, Gravity, Wind, Smoke and Rings appear where used. The same Seed keeps particle identities and framing stable; each cycle has an empty interval. Try another Explosion or Seed for a different event.",
    canvas: { W: 72, H: 100 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "pixel_blast", x: 40, y: 20, params: { ...defaults("pixel_blast"), effect: m.effect, motion: "Timeline", phase: m.phase, cy: m.cy, amount: m.amount, gravity: m.gravity, trails: m.trails, grain: m.grain, smoke: m.smoke ?? 65, rings: m.rings ?? 3, fill: 100, size: 100 } },
    ], edges: [] }),
  })),
  {
    name: "Pixel Blast · Receipt strip",
    desc: "Select Merge for one 72 × 480 mm receipt showing six stages from launch to dissipating sparks. The six Pixel Blast nodes use the same Seed and physical 1 mm grid; Manual Phase advances down the strip. It is a static contact strip, not an animation batch. DOWNLOAD RECEIPT FILE saves the entire strip as one file. For separately numbered, registered animation frames, load the Firework starter and use ANIMATE → Receipt × N. No printer command is sent when loading an example or downloading a file.",
    canvas: { W: 72, H: 480 },
    make: defaults => ({ nodes: [
      ...[15,30,45,60,75,88].map((phase,i) => ({ id: 9001+i, type: "pixel_blast", x: 20, y: 20+i*180, params: { ...defaults("pixel_blast"), motion: "Manual", phase, cy: (i+.5)*100/6, pixel: 1, fill: 100, gravity: 10, trails: 35, amount: 420, size: 92 } })),
      { id: 9007, type: "merge", x: 390, y: 300, params: { ...defaults("merge"), count: 6 } },
    ], edges: Array.from({length:6},(_,i)=>({ id: "e"+(9101+i), from: 9001+i, fromPort: 0, to: 9007, toPort: i })) }),
  },
  {
    name: "Slice Raster · Four screens",
    desc: "One image continues across four differently rasterised strips: Lines, Dots, Crosshatch and Waves. Auto starts with an original tone study. Choose an image to replace it. Advanced slice settings exposes each slice's independent size share, raster angle, raster pitch, ink strength and pen. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "slice_raster", x: 60, y: 40, params: { ...defaults("slice_raster"), ...{} } }], edges: [] }),
  },
  {
    name: "Slice Raster · Diagonal resolutions",
    desc: "Six diagonal strips use the same dot screen at six different pitches. The picture stays registered while the raster resolution changes from slice to slice. Try Slice angle, Gap and Advanced slice settings. Dot fill pitch is real spiral spacing, so match it to the physical nib.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "slice_raster", x: 60, y: 40, params: { ...defaults("slice_raster"), ...{"count": 6, "sliceAngle": 32, "raster1": "Dots", "raster2": "Dots", "raster3": "Dots", "raster4": "Dots", "raster5": "Dots", "raster6": "Dots", "pitch1": 1.4, "pitch2": 2, "pitch3": 2.8, "pitch4": 3.8, "pitch5": 5.2, "pitch6": 7, "angle1": 0, "angle2": 0, "angle3": 0, "angle4": 0, "angle5": 0, "angle6": 0, "advanced": true} } }], edges: [] }),
  },
  {
    name: "Slice Raster · Collage in six rasters",
    desc: "Six non-overlapping rectangles form a seeded collage. Lines, Dots, Crosshatch, Waves, Squares and Diamonds interpret the same image. The picture is fitted once across the complete page. Change Collage seed, Size share or the raster of a single slice.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "slice_raster", x: 60, y: 40, params: { ...defaults("slice_raster"), ...{"layout": "Collage", "count": 6, "seed": 82, "gap": 1, "pitch1": 1.2, "pitch2": 2.8, "pitch3": 1.6, "pitch4": 1.8, "pitch5": 4, "pitch6": 3.2} } }], edges: [] }),
  },
  {
    name: "Slice Raster · Moving raster windows",
    desc: "Four Grid regions travel across one stationary picture and its stationary raster fields. Motion Timeline reads ANIMATE directly; set 24 frames and press Play. Manual exposes Mask phase for scrubbing. The final frame is the step before the first, making the loop continuous. PNG/SVG/G-code frame exports use the same masks.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "slice_raster", x: 60, y: 40, params: { ...defaults("slice_raster"), ...{"layout": "Grid", "count": 4, "columns": 2, "motion": "Timeline", "cycles": 1, "pen1": 0, "pen2": 1, "pen3": 2, "pen4": 6} } }], edges: [] }),
  },
  {
    name: "Slice Raster · Wired lettering",
    desc: "A blue wire takes Lettering into Slice Raster's Drawing input. Select Slice Raster: one word becomes Lines, Dots, Crosshatch and Waves in four strips. Edit the text in Lettering or connect another drawing. Auto follows the wire; Image file and Tone study ignore it. Drawing stroke mm thickens source lines. Fill closed shapes fills the letter faces while preserving counters; open paths remain strokes. The drawing keeps its canvas position. Each slice still has its own raster and Pen. No photo is needed.",
    canvas: { W: 210, H: 148 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 20, y: 30, params: { ...defaults("lettering"), text: "RASTER", size: 78, weight: 32, font: "Block", depth: 0, fill: "Outline", margin: 18 } },
      { id: 9002, type: "slice_raster", x: 350, y: 30, params: { ...defaults("slice_raster"), source: "Auto", drawingFill: true, drawingWidth: 0.8, pitch1: 1.2, pitch2: 2.2, pitch3: 1.4, pitch4: 1.5, margin: 12 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Word Shape · ABRACADABRA",
    desc: "The complete word loses one final letter on every centred row, ending with A. Switch Shape for Triangle up, Diamond, Hourglass, Circle, Heart, Square or Hexagon. Serif uses real plotter strokes. Letter and row spacing change the proportions; Fit text shrinks the letters into the built-in fitting box.",
    canvas: {"W": 210, "H": 297},
    make: defaults => ({ nodes: [{ id: 9001, type: "word_shape", x: 60, y: 40, params: { ...defaults("word_shape"), ...{} } }], edges: [] }),
  },
  {
    name: "Word Shape · Diamond",
    desc: "A concrete poem that grows from one letter to the full word and shrinks again. Rows from text gives 2N-1 rows. Try Remove letters from Start or Both sides, or change Row alignment. All text stays upright.",
    canvas: {"W": 210, "H": 297},
    make: defaults => ({ nodes: [{ id: 9001, type: "word_shape", x: 60, y: 40, params: { ...defaults("word_shape"), ...{"text": "MUUSIA", "shape": "Diamond", "width": 150, "height": 195, "size": 24, "tracking": 1.6} } }], edges: [] }),
  },
  {
    name: "Word Shape · Hourglass",
    desc: "A word narrows into a one-letter waist and widens again. Try a phrase, a different font, or Custom Rows. The fitting box is only a preview guide.",
    canvas: {"W": 210, "H": 297},
    make: defaults => ({ nodes: [{ id: 9001, type: "word_shape", x: 60, y: 40, params: { ...defaults("word_shape"), ...{"text": "HOURGLASS", "shape": "Hourglass", "height": 230, "width": 155, "size": 20} } }], edges: [] }),
  },
  {
    name: "Word Shape · Heart of words",
    desc: "Complete words flow through a heart, leaving a cleft between its lobes. Whole words keeps TYPE and LOVE intact. Increase Rows or lower Letter height for finer shape detail. Change to Circle, Square or Hexagon to compare region fills.",
    canvas: {"W": 210, "H": 210},
    make: defaults => ({ nodes: [{ id: 9001, type: "word_shape", x: 60, y: 40, params: { ...defaults("word_shape"), ...{"text": "TYPE LOVE", "shape": "Heart", "mode": "Whole words", "autoRows": false, "rows": 25, "width": 175, "height": 165, "size": 6, "tracking": 1.15, "lineSpacing": 1.2, "clearance": 0.4} } }], edges: [] }),
  },
  {
    name: "Word Shape · Inside a letter",
    desc: "Lettering O feeds Word Shape's blue Shape input. Its outer contour and inner hole form one even-odd region. TYPE and ART remain whole inside the letter strokes; its counter stays blank. Select Word Shape, try Inside / Outside, and change Lettering's Text for your own closed lettering. The source outline is a guide, not an added plotted stroke.",
    canvas: { W: 210, H: 297 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 30, y: 40, params: { ...defaults("lettering"), text: "O", size: 190, weight: 26, font: "Bold", depth: 0, fill: "Outline", margin: 24 } },
      { id: 9002, type: "word_shape", x: 360, y: 40, params: { ...defaults("word_shape"), text: "TYPE ART", source: "Wired shape", mode: "Whole words", font: "Plotter", autoRows: false, rows: 38, size: 4, tracking: 1.15, lineSpacing: 1.2, clearance: 0.35 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Word Shape · Around your shape",
    desc: "A closed Draw Path feeds Word Shape. Outside lays a continuous repeated phrase around the polygon and leaves its silhouette empty. Edit the source points to redraw the void, or choose Inside to fill it. Complete letters stay clear of the boundary. Shape source Wired shape refuses open paths; enable Closed shape in Draw Path.",
    canvas: { W: 210, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 30, y: 40, params: { ...defaults("drawn_path"), closed: true, smoothness: 0, margin: 12, points: [[0.5,0.16],[0.59,0.39],[0.83,0.39],[0.64,0.54],[0.71,0.8],[0.5,0.64],[0.29,0.8],[0.36,0.54],[0.17,0.39],[0.41,0.39]] } },
      { id: 9002, type: "word_shape", x: 360, y: 40, params: { ...defaults("word_shape"), text: "WORDS MAKE SHAPES", source: "Wired shape", placement: "Outside", mode: "Repeat text", font: "Plotter", autoRows: false, rows: 34, size: 4.2, tracking: 1.12, lineSpacing: 1.2, clearance: 1.5 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Scanner · Continuous scan", desc: "Select Scanner. A sheet of vertical lines moves sideways during a top-to-bottom scan. Smooth keeps all 45 original strokes continuous, with no added pen lifts. Try Speed, Motion X/Y, Shake and Zoom change. Phase % can be driven by Frame or LFO. Keep a margin for the displaced drawing, or add Fit afterwards. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "grid", x: 25, y: 20, params: { ...defaults("grid"), vlines: 45, hlines: 0, margin: 36 } },
      { id: 9002, type: "scanner", x: 345, y: 20, params: { ...defaults("scanner"), motionX: 24, motionY: 5, zoom: 8, shake: 1.5 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Scanner · Broken bands", desc: "Lettering outlines become displaced scanner strips. Bands deliberately splits strokes at each strip, without drawing a connector across a glitch. Select Scanner and try Band width, Speed and Phase. Change to Smooth to restore continuous distorted strokes. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 25, y: 20, params: { ...defaults("lettering"), text: "ECHO", size: 85, weight: 10, depth: 0, fill: "Outline", margin: 40 } },
      { id: 9002, type: "scanner", x: 345, y: 20, params: { ...defaults("scanner"), mode: "Bands", band: 5, motionX: 22, shake: 1, speed: 2 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Scanner · Drawn motion", desc: "Draw Path is a movement recording, wired to Scanner Motion. Edit its points to change the gesture. Scanner normalises that first path and scales it with Motion X/Y; the open gesture plays forwards and backwards continuously. The grid is wired to Drawing. Change Phase to scrub the gesture. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "grid", x: 25, y: 20, params: { ...defaults("grid"), vlines: 30, hlines: 12, margin: 40 } },
      { id: 9002, type: "drawn_path", x: 25, y: 310, params: { ...defaults("drawn_path"), points: [[.1,.5],[.35,.15],[.5,.85],[.65,.2],[.9,.5]], smoothness: 70 } },
      { id: 9003, type: "scanner", x: 345, y: 20, params: { ...defaults("scanner"), motionX: 20, motionY: 14, speed: 1, shake: 0 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9003, toPort: 0 }, { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 1 }] }),
  },
  {
    name: "Voronoi · Rounded holes", desc: "Select Voronoi, Mode Bounded. Rounded cut-out contours fill a circle, with smaller cells toward its centre. Web width is the minimum geometric gap between cells; Corner radius rounds the holes and Min hole size keeps tiny regions solid. Try Placement and Relax passes. Include outline adds the circle to the drawing. This is vector geometry without kerf compensation. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "voronoi", x: 25, y: 20, params: { ...defaults("voronoi"), mode: "Bounded", boundary: "Circle", count: 140, density: "Radial", densityStrength: 90, web: 1.6, radius: 3, outline: true } }], edges: [] }),
  },
  {
    name: "Voronoi · Own boundary", desc: "Lettering O feeds Voronoi Boundary. The cells stay inside the letter and leave its middle empty. Mode Bounded uses the wired contours at their original position. Try Edges to draw the shared network once, or Holes for separated rounded contours. The dashed boundary is only a guide unless Include outline is enabled. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 25, y: 20, params: { ...defaults("lettering"), text: "O", size: 120, weight: 42, depth: 0, fill: "Outline" } },
      { id: 9002, type: "voronoi", x: 345, y: 20, params: { ...defaults("voronoi"), mode: "Bounded", count: 100, web: 1.5, radius: 2, density: "Linear", densityStrength: 85, outline: true } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Voronoi · Growing cells", desc: "Two wires: Voronoi Cells to Differential Growth Boundary, and Seeds to Start. Select Differential Growth, Mode Bounded. Each separated cell has its own small closed starting loop and grows one continuous line. Several cells require pen lifts between cells; there are no connectors through the gaps. Try Growth %, Spacing and the Voronoi seed. Keep at most 64 cell pieces for the growth node, sharing Max points. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "voronoi", x: 25, y: 20, params: { ...defaults("voronoi"), mode: "Bounded", count: 12, web: 3, radius: 4, margin: 22 } },
      { id: 9002, type: "diffgrowth", x: 345, y: 20, params: { ...defaults("diffgrowth"), mode: "Bounded", steps: 1600, spacing: 2.5, maxPoints: 4000 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 1, to: 9002, toPort: 1 }, { id: "e9102", from: 9001, fromPort: 2, to: 9002, toPort: 2 }] }),
  },
  {
    name: "Differential Growth · Bounded disc", desc: "Select Differential Growth, Mode Bounded. One final closed line folds inside the circle. Raise Growth % to continue, lower Spacing mm for denser folds, and change Seed for another repeatable result. Max points caps detail. The dashed boundary is a guide and never plots; only the final line exports. Growth can take a few seconds and stops at point/work limits. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "diffgrowth", x: 30, y: 20, params: { ...defaults("diffgrowth"), mode: "Bounded" } }], edges: [] }),
  },
  {
    name: "Differential Growth · Keep the hole", desc: "Lettering O, with Outline and Depth 0, feeds the Boundary input. Both closed contours define the region; the centre remains empty. Select Differential Growth. Auto places a small start circle where there is room, then grows it inside the letter. The letter outline remains a guide, so the output is just one grown line. Try Growth %, Spacing mm and Seed. One start grows inside one connected region. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 25, y: 20, params: { ...defaults("lettering"), text: "O", size: 120, weight: 42, depth: 0, fill: "Outline" } },
      { id: 9002, type: "diffgrowth", x: 345, y: 20, params: { ...defaults("diffgrowth"), mode: "Bounded", spacing: 4.5, maxPoints: 3600 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Differential Growth · Grow a drawn line", desc: "Draw Path feeds Start, the second blue input. Select Differential Growth to see the final grown open line. Edit Draw Path, or replace it with your own simple SVG line. Boundary clips the start at holes or edges; disconnected pieces remain separate strokes. Starts that cross or touch one another are refused. One accepted line remains one continuous stroke. Keep Seed fixed while changing Growth %. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), points: [[.22,.5],[.35,.48],[.5,.52],[.65,.48],[.78,.5]], smoothness: 50 } },
      { id: 9002, type: "diffgrowth", x: 345, y: 20, params: { ...defaults("diffgrowth"), mode: "Bounded" } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 2 }] }),
  },
  {
    name: "Differential Growth · Own boundary", desc: "A closed Draw Path supplies the Boundary. Edit its points to change the region. Differential Growth grows a final line inside the concave outline. Closed contours nested inside another are holes; disjoint regions need their own starts if you want to fill each one. Keep the supplied boundary simple. The boundary is a guide and does not add a plotted outline. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), closed: true, points: [[.08,.15],[.65,.05],[.95,.27],[.72,.46],[.94,.85],[.4,.95],[.08,.78],[.2,.45]], smoothness: 0 } },
      { id: 9002, type: "diffgrowth", x: 345, y: 20, params: { ...defaults("diffgrowth"), mode: "Bounded" } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Double Pendulum · Random bounce", desc: "Full disc with Bounce 85% sends one continuous line irregularly between the outer rim and centre. Try Bounce 100% for the strongest radial flights, or 0 for the original orbit. Seed gives another repeatable route; Traces adds density. Avoid retracing and Line spacing mm apply to the whole stroke, including rounded turns and detours. A crowded route may end early. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "double_pendulum", x: 30, y: 20, params: { ...defaults("double_pendulum"), motion: "Full disc", bounce: 85, seed: 1, traces: 3, time: 12, cy: 50, noRetrace: true, lineGap: .6, fillCentre: true } }], edges: [] }),
  },
  {
    name: "Double Pendulum · Dense full disc", desc: "Full disc with Traces 4 adds four successive driven runs to one uninterrupted line. Time is per run, Perturb deg changes later motion, and all runs share Avoid retracing protection. Compare Traces 1 and 4. A crowded route can end early instead of following old ink; Line spacing mm sets that clearance. One pen, no restarts. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "double_pendulum", x: 30, y: 20, params: { ...defaults("double_pendulum"), motion: "Full disc", traces: 4, time: 12, cy: 50, noRetrace: true, lineGap: .6, fillCentre: true } }], edges: [] }),
  },
  {
    name: "Double Pendulum · Full disc", desc: "Select Double Pendulum with Mode → Full disc. One continuously driven stroke fills the circular area and keeps moving through the upper half. Raise Traces for more density: each run adds Time to the same continuous motion, with Perturb deg gradually varying later runs. Avoid retracing is on; Line spacing mm keeps it from following older ink, and checked smooth detours can continue the drawing without pen lifts. Crossings are still allowed. Time asks for more drawing; the route can stop early when it becomes too crowded. Use one solid pen and match spacing to the physical nib. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "double_pendulum", x: 30, y: 20, params: { ...defaults("double_pendulum"), motion: "Full disc", traces: 1, time: 60, cy: 50, noRetrace: true, lineGap: .6, fillCentre: true } }], edges: [] }),
  },
  {
    name: "Double Pendulum · Fill centre", desc: "Different arm lengths normally leave a central hole. Full disc → Fill centre remaps that inner radius into the centre. Toggle it to compare. Avoid retracing and Line spacing mm protect against following the same older stroke; the output remains one continuous path. The outer dashed circle is a guide and never plots. A4 wide.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "double_pendulum", x: 30, y: 20, params: { ...defaults("double_pendulum"), motion: "Full disc", l1: 65, l2: 30, time: 45, cy: 50, noRetrace: true, lineGap: .6, fillCentre: true } }], edges: [] }),
  },
  {
    name: "Receipt ASCII · Merge two sizes",
    desc: "Two native ASCII fields overlap through Merge, preserving 1× and 2× characters and their original row spacing. Select Merge, then DOWNLOAD ESCPOS or PRINT ASCII RECEIPT. The output is one overlaid receipt, not two consecutive strips. Requires the updated Print server. Try Density and Seed on either input.",
    canvas: { W: 72, H: 250 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "receiptascii", x: 30, y: 20, params: { ...defaults("receiptascii"), cols: 56, density: 0.19 } },
      { id: 9002, type: "receiptascii", x: 350, y: 20, params: { ...defaults("receiptascii"), size: 2 } },
      { id: 9003, type: "merge", x: 690, y: 20, params: { ...defaults("merge") } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9003, toPort: 0 }, { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 1 }] }),
  },
  {
    name: "Receipt ASCII · Beautiful error",
    desc: "Small ASCII groups drift into diagonal waves, inspired by an accidental error print. Select Receipt ASCII, then use PRINT ASCII RECEIPT or DOWNLOAD ESCPOS. Density, Drift per row, Wave and Corruption shape the rhythm. The printer uses its own font. The 80 × 300 canvas makes a short first study; choose Receipt 80 mm × 1 m for a long roll. Requires the updated Muusia print server; path modifiers and plotter exports do not apply.",
    canvas: { W: 80, H: 300 },
    make: defaults => ({ nodes: [{ id: 9001, type: "receiptascii", x: 30, y: 20, params: { ...defaults("receiptascii") } }], edges: [] }),
  },
  {
    name: "Receipt ASCII · Dense stream",
    desc: "A denser one-metre stream of printable punctuation and digits. The text goes to the printer as native ESC/POS characters. Change Characters, Repeat columns and Corruption, or choose Waves for a more regular weave. Select the node to preview and print.",
    canvas: { W: 80, H: 1000 },
    make: defaults => ({ nodes: [{ id: 9001, type: "receiptascii", x: 30, y: 20, params: { ...defaults("receiptascii"), pattern: "Stream", characters: "01:;|/<>+=.*", density: 0.78, repeat: 17.4, corruption: 0.2, seed: 3543 } }], edges: [] }),
  },
  {
    name: "Ribbon · One metre pleats",
    desc: "An 80 mm × 1 m receipt ribbon. Shape Long keeps bends, swells and folds in physical millimetres as the canvas gets longer. Orientation turns it sideways. Wander automatically fits the narrow paper without shortening the ribbon. Each filament is one continuous stroke. Try Long form Line or Channels, or extend Canvas height to 3000 mm.",
    canvas: { W: 80, H: 1000 },
    make: defaults => ({ nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Long", longForm: "Pleated", margin: 5, width: 36, wander: 12, lines: 32, widthVar: 0.8, bendLength: 650, swellLength: 360, foldLength: 480, tailLength: 90, layer: 0 } }], edges: [] }),
  },
  {
    name: "Ribbon · One metre channels",
    desc: "An 80 mm × 1 m ribbon with repeating open pockets. Pocket repeat and Swell repeat set physical distances; changing canvas length adds more detail. Pocket fill adds real outlines or hatching. Colours changes pens without changing geometry. Width and Wander stay inside Margin.",
    canvas: { W: 80, H: 1000 },
    make: defaults => ({ nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Long", longForm: "Channels", margin: 5, width: 40, wander: 9, lines: 36, widthVar: 0.45, bendLength: 700, swellLength: 300, pocketSpacing: 230, pocketSize: 0.8, pocketFill: "Outline", tailLength: 80, layer: 0 } }], edges: [] }),
  },
  {
    name: "Kaisla · One metre reeds",
    desc: "Long reeds on 80 mm × 1 m paper, with tapered stems, pointed leaves, joints and feathery seed heads. Stalk length follows the canvas; Sway, Joint spacing and Leaf spacing keep their millimetre scale when you extend it to several metres. Sway bends within the receipt width instead of shortening the stems. Seed changes the plants. All marks are real pen paths.",
    canvas: { W: 80, H: 1000 },
    make: defaults => ({ nodes: [{ id: 9001, type: "kaisla", x: 30, y: 20, params: { ...defaults("kaisla"), count: 5, seed: 17, leafSpacing: 280, lengthVar: 0.22 } }], edges: [] }),
  },
  {
    name: "Kaisla · Three metre cattails",
    desc: "A three-metre reed study on an 80 mm roll. Cattail heads use seven real rails; no screen-only fill. Joint spacing and Leaf spacing repeat detail along the entire roll. Leaf veins adds a centre stroke to each pointed leaf. Reduce Stalks for a quieter drawing, or select Seed head None for bare stems.",
    canvas: { W: 80, H: 3000 },
    make: defaults => ({ nodes: [{ id: 9001, type: "kaisla", x: 30, y: 20, params: { ...defaults("kaisla"), count: 4, seed: 29, head: "Cattail", headLength: 90, headWidth: 4, leafSpacing: 500, leafLength: 160, leafVeins: true, sway: 8, swayLength: 800, width: 0.8 } }], edges: [] }),
  },
  {
    name: "Noise · Patent TV",
    desc: "Select Noise, set ANIMATE Frames to 24 and press Play. The antenna-free numbered CRT cabinet stays fixed while snow changes on its curved screen. Black frame chance inserts seeded dark interruptions; 0 turns them off. Motion Timeline needs no Frame wire. Mode Full sheet restores the open field.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "tvnoise", x: 40, y: 20, params: { ...defaults("tvnoise"), mode: "Patent TV", shape: "Dash (scanline)", cell: 2, density: 0.7, bands: 0.45, seed: 107 } },
    ], edges: [] }),
  },
  {
    name: "Noise · Program signal",
    desc: "Murmuration feeds the blue Program input on Noise. The moving birds fit inside the rounded CRT screen, retaining their own pen. Select Noise; Screen signal Auto shows the program when wired, Snow shows only static, and Program + snow overlays interference. Invert screen reverses the image, including black frames. Set ANIMATE Frames to 24 and press Play.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "murmuration", x: 20, y: 20, params: { ...defaults("murmuration"), birds: 90, spread: 70, size: 2.4, travel: 0.5, seed: 29 } },
      { id: 9002, type: "tvnoise", x: 370, y: 20, params: { ...defaults("tvnoise"), mode: "Patent TV", signal: "Auto", blackoutChance: 18, seed: 107 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Noise · Inverted broadcast",
    desc: "Murmuration becomes white bird silhouettes against a densely inked black CRT screen. Select Noise and switch Invert screen off to compare. Black frame chance makes occasional white interruptions when Invert is on. Set ANIMATE Frames to 24 and press Play.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "murmuration", x: 20, y: 20, params: { ...defaults("murmuration"), birds: 70, spread: 70, size: 4.5, travel: 0.5, seed: 29 } },
      { id: 9002, type: "tvnoise", x: 370, y: 20, params: { ...defaults("tvnoise"), mode: "Patent TV", signal: "Auto", invert: true, blackoutChance: 18, seed: 107 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Test Card · Thermal receipt",
    desc: "A 72 × 100 mm Epson TM-T88V stress card: fine grids, arcs, tiny details and ordered-halftone swatches. Select Test Card, use DOWNLOAD RECEIPT FILE, and inspect the pixels in LATU before printing. The tones are black/white dots, not printer-native grayscale.",
    canvas: { W: 72, H: 100 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "testcard", x: 30, y: 20, params: { ...defaults("testcard"), mode: "Thermal receipt" } },
    ], edges: [] }),
  },
  {
    name: "Focal Point · Shared colour grid",
    desc: "Move Focal Point X %, Y % and Radius mm. Its value wires drive Adaptive Grid, so all of its refinement follows one focus. Cells then feed Colour Neighbours, which assigns four pens so touching cells differ. Try wiring the same X % and Y % outputs to Spiral Image Center X/Y or Portrait Focus X/Y; one pair of sliders can control several nodes.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "focal_point", x: 20, y: 20, params: { ...defaults("focal_point"), x: 36, y: 58, radius: 88 } },
      { id: 9002, type: "adaptive_grid", x: 285, y: 20, params: { ...defaults("adaptive_grid"), maxCell: 37, minCell: 7, levels: 3, detail: 88 } },
      { id: 9003, type: "colour_neighbours", x: 555, y: 20, params: { ...defaults("colour_neighbours"), colors: 4, touch: 0.4 } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: "p:focusX" },
      { id: "e9102", from: 9001, fromPort: 1, to: 9002, toPort: "p:focusY" },
      { id: "e9103", from: 9001, fromPort: 4, to: 9002, toPort: "p:radius" },
      { id: "e9104", from: 9002, fromPort: 1, to: 9003, toPort: 0 },
    ] }),
  },
  {
    name: "Colour Neighbours · Four inks",
    desc: "Adaptive Grid Cells are closed shapes. Colour Neighbours assigns four pens so shared borders and corners have different ink. Change Pens in use to two to see unresolved neighbours on the Conflicts output, or increase Touch distance mm to treat nearby cells as adjacent. Colored keeps the exact original cell outlines and path order.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "adaptive_grid", x: 25, y: 20, params: { ...defaults("adaptive_grid"), source: "Focus", focusX: 60, focusY: 45, maxCell: 36, minCell: 7, levels: 3 } },
      { id: 9002, type: "colour_neighbours", x: 350, y: 20, params: { ...defaults("colour_neighbours"), colors: 4, touch: 0.4 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 1, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Image Compare · Two images, two styles",
    desc: "Choose image A and image B separately on Image Compare. A fills the left column and B fills the right. The top row draws both with Flow; the bottom row draws both with Spiral. Switch to Two panels to compare one style in larger panels, or change A–D styles independently. Line spacing, Contrast and White cutoff affect every panel together. Sheet exports the whole page; A–D let you send one treatment onward. With only one image loaded, it fills both columns.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "image_compare", x: 30, y: 20, params: { ...defaults("image_compare"), layout: "Four", spacing: 1.7 } }], edges: [] }),
  },
  {
    name: "Spiral Image · One continuous line",
    desc: "Choose a high-contrast photo on Spiral Image. One unbroken spiral travels through the whole image. Dark areas add zigzag movement to that same line; light areas retain its smooth base. Turn spacing mm controls density, Tone wiggle mm controls darkness, and Spiral shape switches between Ellipse and Circle. The line can cross itself, but it never lifts. Export one SVG path or one G-code pen-down run.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "spiral_image", x: 30, y: 20, params: { ...defaults("spiral_image"), shape: "Ellipse", pitch: 1.7, wiggle: 1.8, wavelength: 4.5 } }], edges: [] }),
  },
  {
    name: "Engrave Image · Flow study",
    desc: "Choose a clear photo on Engrave Image. Flow makes long lines curve with the tones; white areas stay open. Line spacing controls print density, Flow bend controls the curve and Shadow threshold places a second pen in the darks. Outlines, Hatching, Shadows and Dots are separate outputs. Start on A4 wide with a fine pen.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "engrave_image", x: 30, y: 20, params: { ...defaults("engrave_image"), mode: "Flow", spacing: 2.2, bend: 5, seed: 43 } }], edges: [] }),
  },
  {
    name: "Engrave Image · Straight hatch",
    desc: "Load a photo, then use Straight for orderly diagonal engraving. Adjust Base angle and Line spacing; Crosshatch shadows adds a second direction only to darker areas. Try turning Contour outlines and Light dots off to see the main hatch alone. The image stays on this device.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "engrave_image", x: 30, y: 20, params: { ...defaults("engrave_image"), mode: "Straight", angle: -35, spacing: 2.2, seed: 43 } }], edges: [] }),
  },
  {
    name: "Engrave Image · Facets",
    desc: "Load a photo with strong shapes. Facets builds tone from many short strokes that turn at local boundaries. It is lighter than the long-line modes. Lower Min stroke mm to retain tiny marks or turn Light dots off for a cleaner page. Each output can be sent to its own downstream modifier.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "engrave_image", x: 30, y: 20, params: { ...defaults("engrave_image"), mode: "Facets", spacing: 2.2, seed: 43 } }], edges: [] }),
  },
  {
    name: "Isometric Blocks · Animated morph",
    desc: "Press Play in ANIMATE, or scrub the frame slider. Frame t drives Motion phase 0–1 so heights sweep across the blocks in a seamless loop; Frame wave loop drives Top taper 0–1 so their tops narrow and widen. The bases and page framing stay fixed. Select Isometric Blocks to try Pulse or Ripple and adjust Motion amount; export SVG or G-code frames from ANIMATE.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "frame", x: 20, y: 20, params: { ...defaults("frame") } },
      { id: 9002, type: "isometric_blocks", x: 370, y: 20, params: { ...defaults("isometric_blocks"), cols: 7, rows: 3, pattern: "Terraces", levels: 5, height: 1.3, density: 95, motion: "Sweep", motionAmount: 85, shading: "All faces", seed: 29 } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: "p:motionPhase" },
      { id: "e9102", from: 9001, fromPort: 2, to: 9002, toPort: "p:taper" },
    ] }),
  },
  {
    name: "Isometric Blocks · Terraced city",
    desc: "A 30° isometric field rises towards the middle. Select Isometric Blocks to change Columns, Rows, Height pattern, Height levels, Max height and Occupied cells. Side hatch uses different pens for the left and right faces. Top, Left and Right faces are separate closed outputs for Hatch Fill.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "isometric_blocks", x: 35, y: 25, params: { ...defaults("isometric_blocks"), cols: 7, rows: 3, pattern: "Terraces", levels: 5, height: 1.3, density: 95, stagger: true, shading: "Side hatch", seed: 29 } },
    ], edges: [] }),
  },
  {
    name: "Isometric Blocks · Rising staircase",
    desc: "Block heights climb diagonally across the paper. All faces adds a lightly hatched top, with each face on its own pen. Select Isometric Blocks and try Stairs, Wave, Random or Terraces; change Cell gap and Stagger rows to reshape the composition.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "isometric_blocks", x: 35, y: 25, params: { ...defaults("isometric_blocks"), cols: 7, rows: 3, pattern: "Stairs", levels: 6, height: 1.3, density: 95, stagger: true, shading: "All faces", seed: 29 } },
    ], edges: [] }),
  },
  {
    name: "Leaf Field · Leaves apart",
    desc: "No overlap keeps the whole leaf, its veins and its stem clear of every other leaf. Select Leaf Field and change Leaf gap mm to open or tighten the spacing. When the paper is too full, fewer than the requested Leaves are drawn; turning No overlap off restores the original seeded field.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "leaf_field", x: 35, y: 25, params: { ...defaults("leaf_field"), count: 90, size: 22, scatter: 0.2, noOverlap: true, gap: 2.5, shape: "Mixed", direction: "Wave", veins: 4, seed: 42 } },
    ], edges: [] }),
  },
  {
    name: "Leaf Field · Breezy scatter",
    desc: "A page of mixed leaf silhouettes with a soft wave in their direction. Select Leaf Field and change Leaves, Scatter, Shape, Length, Width or Vein pairs. Artwork combines the two pens; Leaves contains closed outlines for Hatch Fill, and Veins contains only the open details.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "leaf_field", x: 35, y: 25, params: { ...defaults("leaf_field"), count: 70, size: 23, scatter: 0.2, shape: "Mixed", direction: "Wave", angle: 25, angleVar: 42, veins: 4, seed: 42 } },
    ], edges: [] }),
  },
  {
    name: "Leaf Field · Whorl",
    desc: "The same leaf generator turns each blade around the paper centre. Select Leaf Field and switch Direction between Whorl, Wave and Aligned, or try Lobed and Serrated shapes. The closed Leaves output can feed Hatch Fill without including the open veins.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "leaf_field", x: 35, y: 25, params: { ...defaults("leaf_field"), count: 92, size: 19, sizeVar: 0.45, width: 0.42, scatter: 0.13, shape: "Lance", direction: "Whorl", angle: 0, angleVar: 17, bend: 0.5, veins: 3, seed: 19 } },
    ], edges: [] }),
  },
  {
    name: "Drip · Cross-hatched drops",
    desc: "Draw Path feeds Drip. Round drops contain two diagonal hatch passes clipped to each outline. Select Drip to change Drop fill, Hatch spacing, Hatch angle and Hatch inset. Separate hatch pen colours the fill independently; turn it off to use the source pen. Pointed drops can also be filled, while Thread has no enclosed area.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), points: [[.08,.35],[.26,.29],[.46,.37],[.66,.28],[.9,.34]], smoothness: 80, margin: 12 } },
      { id: 9002, type: "drip", x: 370, y: 20, params: { ...defaults("drip"), fill: "Cross hatch", spacing: 20, density: 100, length: 43, variation: 55, width: 12, sway: 4, hatchSpacing: 1.7, hatchAngle: 45, hatchInset: .4, hatchOwnPen: true, hatchPen: 1 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Drip · Flowing ink line",
    desc: "Draw Path feeds Drip. The open curve grows ink runs with narrow necks and round ends. Select Drip and change Spacing, Density, Length, Variation, Width, Sway or Flow direction. Pointed makes sharp tapers and Thread makes single pen strokes. Result includes the original line; Drips outputs only the added marks.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), points: [[.08,.43],[.22,.38],[.36,.48],[.5,.34],[.64,.44],[.78,.32],[.93,.39]], smoothness: 80, margin: 12 } },
      { id: 9002, type: "drip", x: 370, y: 20, params: { ...defaults("drip"), spacing: 13, density: 94, length: 35, variation: 75, width: 6, sway: 4 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Drip · Melting outline",
    desc: "A closed Draw Path sends its lower, flow-facing edge to Drip; the upper edge stays clean. Set Closed shape edge to All edges to grow marks around the whole outline. Flow direction rotates which edge is eligible. Turn Keep source off to see the separate drips alone.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), closed: true, points: [[.14,.25],[.85,.24],[.87,.52],[.71,.61],[.51,.54],[.31,.63],[.14,.52]], smoothness: 55, margin: 16 } },
      { id: 9002, type: "drip", x: 370, y: 20, params: { ...defaults("drip"), spacing: 11, density: 94, length: 31, variation: 72, width: 7, sway: 3, seed: 45 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Adaptive Grid · Focus field",
    desc: "A coarse square grid becomes finer around the focus marker. Select Adaptive Grid, move Focus X/Y and change Influence radius, Detail, Refine levels or Min cell. Grid emits each shared line only once for plotting; Cells emits separate closed rectangles for filling or further processing.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "adaptive_grid", x: 35, y: 25, params: { ...defaults("adaptive_grid"), focusX: 37, focusY: 56, radius: 86, maxCell: 36, minCell: 4, detail: 94 } },
    ], edges: [] }),
  },
  {
    name: "Adaptive Grid · Follow a drawing",
    desc: "Draw Path feeds Adaptive Grid's Influence input. Its closed shape attracts smaller cells along the outline; change the points or switch to Freehand to draw your own. Set Detail source to Focus or Noise to explore the other modes. Select Grid for the plotter-safe lattice, or wire Cells into Hatch Fill for individual regions.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), closed: true, points: [[.26,.55],[.33,.28],[.51,.2],[.7,.39],[.74,.69],[.56,.83],[.38,.73]], smoothness: 70, margin: 18 } },
      { id: 9002, type: "adaptive_grid", x: 370, y: 20, params: { ...defaults("adaptive_grid"), source: "Input drawing", maxCell: 42, radius: 42, detail: 98, levels: 4, minCell: 4 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Pattern Tile · Painted page repeat",
    desc: "Select Pattern Tile and paint on the grid. Drag to draw or erase; the 3×3 preview and the full-page vector repeat update immediately. Try Outline, Line, Slash and Cross, then change Cell size or Grid cells. Line angle turns each line; 0° joins horizontal neighbours and 90° joins vertical ones. Pattern is the complete page output.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "pattern_tile", x: 30, y: 20, params: { ...defaults("pattern_tile"), cell: 6.5, margin: 14 } },
    ], edges: [] }),
  },
  {
    name: "Pattern Tile · Angled lines",
    desc: "Select Pattern Tile. Draw as Line uses an angle through each painted cell: 0° makes horizontal runs, 45° connects diagonal neighbours, and 90° makes vertical runs. Change Line angle while watching the full-page vector preview; the Tile output carries the same angle.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "pattern_tile", x: 30, y: 20, params: { ...defaults("pattern_tile"), mark: "Line", lineAngle: 45, cell: 8, margin: 14 } },
    ], edges: [] }),
  },
  {
    name: "Pattern Tile · Motif into Seamless Tile",
    desc: "Paint the Pattern Tile grid, then use its second blue output, Tile, as a source for Seamless Tile. Try Half drop or Mirror to build a larger repeat unit from your edited motif. The first Pattern output remains a direct page repeat.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "pattern_tile", x: 25, y: 20, params: { ...defaults("pattern_tile"), cell: 7, margin: 12 } },
      { id: 9002, type: "seamless_tile", x: 370, y: 20, params: { ...defaults("seamless_tile"), repeat: "Half drop", width: 70, height: 50, view: "3×3 preview" } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 1, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Draw Path · Open barbed curve",
    desc: "Select Draw Path and drag the points in its editor. Click empty paper to add a point or choose Freehand to replace the whole stroke with a drawn gesture. Smoothness rounds the path; Closed shape stays Off. The blue path flows into Barbed Wire, so the spikes follow your own curve.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), points: [[.08,.75],[.25,.36],[.43,.64],[.63,.28],[.83,.51],[.94,.24]], smoothness: 78 } },
      { id: 9002, type: "barbed_wire", x: 365, y: 20, params: { ...defaults("barbed_wire"), spacing: 17, length: 6 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Draw Path · Closed hatch shape",
    desc: "Select Draw Path to edit this closed organic outline. Turn Closed shape Off to make one open line instead; Hatch Fill then has no area to fill. With it On, Hatch Fill uses the shape as a region and plots diagonal lines inside it. Smoothness and Margin affect the outline before the fill.",
    canvas: { W: 210, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"), closed: true, points: [[.48,.12],[.72,.19],[.88,.45],[.78,.75],[.51,.88],[.21,.79],[.11,.49],[.25,.21]], smoothness: 72, margin: 16 } },
      { id: 9002, type: "hatch", x: 365, y: 20, params: { ...defaults("hatch"), spacing: 2.7, angle: 35, layer: 1 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Draw Path · Freehand smoothing",
    desc: "A dense point stroke shows the Freehand smoothing clearly. Select Draw Path and move Smoothness from 0 to 100: the small zigzags flatten while the broad wave remains. Freehand in the editor lets you draw your own stroke; it replaces these sample points.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "drawn_path", x: 25, y: 20, params: { ...defaults("drawn_path"),
        points: Array.from({length: 64}, (_, i) => [.08 + .84 * i / 63, .5 + .18 * Math.sin(i / 8) + (i % 2 ? .018 : -.018)]),
        smoothness: 0 } },
    ], edges: [] }),
  },
  {
    name: "Barbed Wire · Four strands",
    desc: "Four horizontal Grid lines feed Barbed Wire. The default Star barbs style draws twisted double strands with crossed straight spikes and small knots. Adjust Spikes per side, Barb spacing and length to change the rhythm; Strand gap and Twist pitch shape the cable. Switch Type for hooked Twisted pair, Alternating thorns or Razor blades. The source pen is inherited, and Clip to paper trims tips at the edge.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "grid", x: 20, y: 20, params: { ...defaults("grid"), vlines: 0, hlines: 4, margin: 28 } },
      { id: 9002, type: "barbed_wire", x: 370, y: 20, params: { ...defaults("barbed_wire") } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Wind · Anchored loop",
    desc: "A closed Superformula outline holds its windward edge while its far side bends right. Select Wind and change Wind direction and Position X/Y to move the source and anchored edge. Choose Single anchor for a point attachment or Off to pass the closed outline through unchanged. Turbulence adds seeded gusts.",
    canvas: { W: 297, H: 210 },
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "superformula", x: 30, y: 20, params: { ...defaults("superformula"), m: 4, n1: 2, n2: 2, n3: 2, margin: 30 } },
        { id: 9002, type: "wind", x: 360, y: 20, params: { ...defaults("wind"), angle: 0, force: 28, bendability: 0.8, stiffness: 0.2 } },
      ],
      edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }],
    }),
  },
  {
    name: "Wind · Free tips",
    desc: "Vertical Grid lines hold their top ends and release their bottom tips. Select Wind; Open line anchors is Start only. Wind direction turns the lean, Position X/Y moves the source arrow, Wind width changes its reach, and Turbulence makes the bends irregular. Choose Both ends to pin the tips again.",
    canvas: { W: 297, H: 210 },
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "grid", x: 30, y: 20, params: { ...defaults("grid"), vlines: 15, hlines: 0, margin: 50, res: 2 } },
        { id: 9002, type: "wind", x: 360, y: 20, params: { ...defaults("wind"), angle: 0, force: 26, bendability: 0.8, stiffness: 0.25, width: 100, turbulence: 0.55, gustScale: 35, openAnchor: "Start only" } },
      ],
      edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }],
    }),
  },
  {name:"Strand Bundle · 3D whole bend",desc:"Select Strand Bundle. Whole bend = Arc curves the entire object, including the loose middle. Bend angle controls the amount and sign; Bend plane rotates the bending direction around the object's length. Start/End turn and lift are all zero here: the curve comes entirely from Whole bend. Try S-curve for opposite curvature in the two halves. Off restores the previous shape exactly. Existing end steering can be added independently. Axis rotation rolls the curved object; camera and Angle still control the view and page.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),dimension:"3D",wholeBend:"Arc",wholeAngle:150,wholePlane:0,behavior:"Split and return",style:"Flow",stem:"Straight",width:12,length:300,spread:60,release:25,rejoin:75,threadCycles:0.8,angle:0,viewAz:90,viewEl:55,colourMode:"By number",strandNumbers:"12, 45, 88",accentPen:2}}],edges:[]})},
  {name:"Strand Bundle · 3D whole bend + ends",desc:"Select Strand Bundle. Whole bend = S-curve bends the complete body in opposite directions across its midpoint. Start turn/lift and End turn/lift add independent bends to the ends, before whole bending. Start/End cut still trim separate planes. Set Whole bend to Off to keep only the end bends, or zero the four end directions to keep only the whole-body curve. Bend plane chooses the plane of global curvature; Axis rotation then rolls the complete object. All outputs remain continuous ordinary XY pen paths with the same coloured strand identities.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),dimension:"3D",wholeBend:"S-curve",wholeAngle:160,wholePlane:20,behavior:"Split and return",style:"Wander",stem:"Straight",width:12,length:300,spread:60,release:30,rejoin:70,threadCycles:1.2,chaos:25,angle:0,viewAz:90,viewEl:55,startTurn:-45,startLift:25,endTurn:50,endLift:-30,startCut:-30,endCut:40,colourMode:"By number",strandNumbers:"12, 45, 88",accentPen:2}}],edges:[]})},
  {name:"Strand Bundle · 3D bent ends",desc:"Select Strand Bundle. Start turn/lift and End turn/lift bend the two ends independently in 3D. Turn rotates sideways around object Z; lift rotates through depth around object Y. The packed start blends back to the original path at Release at, and the packed tail starts bending after Rejoin at. In Fray end, the final 30% of each free tail bends instead. End cross-sections rotate rigidly and the blends have zero derivative at their joins. Start cut/End cut trim before bending and remain separate controls. Axis rotation spins the complete bent object.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),dimension:"3D",behavior:"Split and return",style:"Wander",stem:"Straight",width:12,length:300,spread:90,release:30,rejoin:70,threadCycles:1.4,chaos:35,angle:0,viewAz:75,viewEl:30,axisRotation:20,startTurn:-70,startLift:30,endTurn:70,endLift:-40,startCut:-30,endCut:40,colourMode:"By number",strandNumbers:"12, 45, 88",accentPen:2}}],edges:[]})},
  {name:"Strand Bundle · 3D radial fan",desc:"Select Strand Bundle. Space 3D builds a circular core and releases the fibres in all directions around it. Fan keeps each fibre in its own radial plane. Axis rotation spins the object about its length; View angle and View elevation move the orthographic camera. Angle still rotates the page. The 3D core uses more strands to retain circumferential pen spacing. The accent follows strand 15 around the core. All outputs are ordinary XY pen paths.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),dimension:"3D",style:"Fan",stem:"Straight",width:10,length:300,spread:140,release:40,tipVar:25,angle:0,viewAz:65,viewEl:20,colourMode:"By number",strandNumbers:"15",accentPen:2}}],edges:[]})},
  {name:"Strand Bundle · 3D tangled return",desc:"Select Strand Bundle. Real XYZ fibres leave a circular winding core, wander and loop through depth, then return to the same core. Axis rotation rotates the entire object, including its coloured fibres and angled end cuts. The camera uses an orthographic transparent wire view, so every strand remains visible. A cylindrical envelope keeps scale and framing fixed through a full roll. Set Space to 2D to return to the original flat construction.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),dimension:"3D",behavior:"Split and return",style:"Tangle",stem:"Meander",bend:16,width:12,length:300,spread:120,release:20,rejoin:85,threadCycles:1.4,chaos:80,angle:0,viewAz:60,viewEl:25,axisRotation:25,startCut:-35,endCut:45,colourMode:"By number",strandNumbers:"12, 45, 88",accentPen:2}}],edges:[]})},
  {name:"Strand Bundle · 3D axial rotation",desc:"Select Strand Bundle, set Frames to 24 and press Play in ANIMATE. Frame rot degrees drives Axis rotation, giving a complete seamless roll around the object's own longitudinal axis. Keep Seed, Count, paper and camera fixed: the same fibres rotate without regeneration, resizing or recentering. The highlighted fibres make their movement easy to follow. This is an animated view for 2D plotting; no machine-Z component is emitted.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"frame",x:50,y:60,params:{...defaults("frame")}},{id:9002,type:"strand_bundle",x:400,y:60,params:{...defaults("strand_bundle"),dimension:"3D",behavior:"Split and return",style:"Tangle",stem:"Meander",bend:16,width:12,length:300,spread:120,release:20,rejoin:85,threadCycles:1.4,chaos:80,angle:0,viewAz:60,viewEl:25,startCut:-35,endCut:45,colourMode:"By number",strandNumbers:"12, 45, 88",accentPen:2}}],edges:[{id:"e9101",from:9001,fromPort:4,to:9002,toPort:"p:axisRotation"}]})},
  {name:"Strand Bundle · One coloured thread",desc:"Select Strand Bundle. Colour selection = By number and Strand numbers = 35 assign just the 35th whole strand to Accent pen; every other strand uses Base pen. Numbering starts at 1 across the unrotated core, before the whole design rotates. The colour follows the complete strand through release and rejoin; the same path is not drawn twice. Colours never alter the shape or its random stream. Use Colour selection = Off for the original monochrome drawing.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),behavior:"Split and return",style:"Tangle",nib:0.4,width:21,length:390,release:17,rejoin:85,spread:90,threadCycles:0.8,stem:"Sine",angle:-161,margin:12,colourMode:"By number",strandNumbers:"35",accentPen:2}}],edges:[]})},
  {name:"Strand Bundle · Several coloured threads",desc:"Select Strand Bundle. By number accepts an exact list or inclusive ranges: this example colours 8, 22, 36, 50 and 64. Try 20-24 for five adjacent strands. Spaced uses First coloured strand, Coloured strands and Strand interval; Random chooses a unique set using an independent Colour seed. Increasing a random count keeps the previously selected strands. The same local numbers repeat in every bundle, and out-of-range indices are ignored. Select the Accent pen from the palette; Base pen controls the remaining strands. Match actual pen widths for the planned physical stem density.",canvas:{W:420,H:297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),behavior:"Split and return",style:"Tangle",nib:0.4,width:21,length:390,release:17,rejoin:85,spread:90,threadCycles:0.8,stem:"Sine",angle:-161,margin:12,colourMode:"By number",strandNumbers:"8, 22, 36, 50, 64",accentPen:2}}],edges:[]})},
  {name:"Strand Bundle · Angled ends · A2",desc:"Select Strand Bundle. This A2 landscape ribbon uses a true 520 mm length, exceeding the previous 400 mm limit. Start cut −45° and End cut 45° trim independent straight planes across the packed ends, before the whole design rotates. Set either angle to zero to retain that original end. Cuts protect the release/rejoin area and reduce extreme angles if an end is too short. Each retained strand stays one uninterrupted path. Length accepts up to 2000 mm; complete bundles still shrink to the paper and margin, so use a larger canvas to retain long physical lengths.",canvas:{W:594,H:420},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),behavior:"Split and return",style:"Flow",stem:"Sine",bend:20,stemCycles:1,length:520,width:24,spread:90,release:25,rejoin:75,angle:0,threadCycles:1.3,startCut:-45,endCut:45}}],edges:[]})},
  {name:"Strand Bundle · Neat fan",desc:"Select Strand Bundle. Fan opens a solid straight stem into an ordered non-crossing set. Pen width 0.5 mm and Ink overlap 40% give a core centreline pitch at most 0.3 mm. Tip length variation zero aligns the tips. Try Sine stem, Spread or Release at. These are real pen paths; preview/SVG retain the standard display stroke. Use the actual drawn width of your pen for physical density.",canvas:{"W":210,"H":297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),...{"style":"Fan","stem":"Straight","length":210,"width":10,"spread":110,"release":55,"tipVar":0}}}],edges:[]})},
  {name:"Strand Bundle · Wandering ends",desc:"Select Strand Bundle. A seeded Meander stem stays densely packed, then the tips wander separately. Stem bend and Stem turns affect the common stem; Chaos and Thread turns affect only the loose zone. Tip length variation staggers the free ends. Each strand is one uninterrupted root-to-tip path. Change Seed for another repeatable arrangement.",canvas:{"W":210,"H":297},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),...{"style":"Wander","stem":"Meander","bend":12,"length":200,"width":12,"spread":110,"release":45,"tipVar":35,"chaos":55,"seed":23}}}],edges:[]})},
  {name:"Strand Bundle · Ribbon return",desc:"Select Strand Bundle. Split and return opens the winding stem between Release at and Rejoin at, then reconnects every complete strand into the packed stem. Flow keeps the strands ordered without crossings. Stem and thread motion are independent. Rejoin at is kept at least ten percentage points after Release at. There are no separate join segments or extra pen lifts.",canvas:{"W":297,"H":210},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),...{"behavior":"Split and return","style":"Flow","stem":"Sine","bend":20,"stemCycles":1.1,"length":240,"width":10,"spread":75,"release":18,"rejoin":85,"angle":0,"threadCycles":1.3,"tipVar":0}}}],edges:[]})},
  {name:"Strand Bundle · Tangled return",desc:"Select Strand Bundle. Tangle allows sideways loops and crossings inside the loose zone, while all lines still return exactly to the same winding stem. Chaos changes loop amplitude; Thread turns changes their frequency. Seed is repeatable. Very dense requests narrow every core uniformly after lowering sampling, rather than dropping later bundles or strands. Core pitch mm and Core width mm report the fitted physical result.",canvas:{"W":297,"H":210},make:defaults=>({nodes:[{id:9001,type:"strand_bundle",x:50,y:60,params:{...defaults("strand_bundle"),...{"behavior":"Split and return","style":"Tangle","stem":"Meander","bend":16,"stemCycles":1.1,"length":240,"width":10,"spread":80,"release":20,"rejoin":85,"angle":0,"threadCycles":1.4,"chaos":75,"seed":9}}}],edges:[]})},
  {name:"Handwriting · Cursive note",desc:"Select Handwriting. Cursive makes one connected lowercase body per word, then writes dots, accents and crossbars. The three repeated lines are deliberately different. Variation changes shapes as well as width and slant; Seed rewrites the same message in a repeatable hand. Set Variation and Baseline sway to zero for the regular masters. Capitals and punctuation lift the pen. Open pen strokes can feed 2D to 3D in Stroked paths mode.",canvas:{W:297,H:210},make:defaults=>({nodes:[{id:9001,type:"handwriting",x:50,y:60,params:{...defaults("handwriting"),...{"mode":"Cursive","text":"Little letters, written slowly.|Little letters, written slowly.|Little letters, written slowly.|Every word has its own rhythm.","size":8.5,"variation":65,"slant":12,"sway":25,"margin":18}}}],edges:[]})},
  {name:"Handwriting · Printed notebook",desc:"Select Handwriting. Print keeps letters separate and preserves upper/lowercase. This is an original centreline alphabet, including Finnish ä, ö, å and digits. Repeated lines use different letterforms. Adjust Variation, Slant, Baseline sway and Seed. Lowercase height is the requested x-height; wrapping and automatic shrink keep the complete text inside Margin. Maximum 1200 characters; unsupported characters use a visible question mark.",canvas:{W:297,H:210},make:defaults=>({nodes:[{id:9001,type:"handwriting",x:50,y:60,params:{...defaults("handwriting"),...{"mode":"Print","text":"A small note for tomorrow.|A small note for tomorrow.|Meet me at 10:30.|abcdefghijklmnopqrstuvwxyz|ABCDEFGHIJKLMNOPQRSTUVWXYZ|äöå ÄÖÅ 0123456789","size":6.5,"variation":60,"slant":3,"sway":22,"margin":18}}}],edges:[]})},
  {name:"Line Shadows \u00b7 Rectangle fan", desc:"Select Line Shadows. A closed Container rectangle is hatched and projected into three overlapping planes around its Bottom hinge. Line angle 90 degrees, Layers 3 and Fan angle 60 degrees reproduce a fan of line shadows. Line spacing controls density. The full stack is fitted to the margin; no machine is run.", canvas:{"W": 297, "H": 420}, make:defaults=>({nodes:[{"id": 9001, "type": "container", "x": 30, "y": 40, "collapsed": true, params: {...defaults("container"), ...{"shape": "Rectangle", "cx": 70, "cy": 210, "rw": 72, "rh": 300, "cr": 55, "rot": 0, "keep": "Inside", "gap": 0, "draw": true, "regionPen": 0}}},{"id": 9002, "type": "line_shadows", "x": 390, "y": 40, params: {...defaults("line_shadows"), ...{"spacing": 2.5, "angle": 90, "layers": 3, "fan": 60, "hinge": "Bottom", "shorten": true, "shift": 0, "outlines": false, "penMode": "Single pen", "pen": 0, "pens": 4, "placement": "Fit to margin", "margin": 18}}}],edges:[{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}]})},
  {name:"Line Shadows \u00b7 Letter O", desc:"Select Line Shadows. Filled Lettering O supplies two closed contours, keeping its counter empty by even-odd fill. Four planes cycle through pens 0\u20133. Try Fan angle, Hinge edge, Foreshorten and Shift / layer. Open line fonts need closed regions before this node.", canvas:{"W": 297, "H": 210}, make:defaults=>({nodes:[{"id": 9001, "type": "lettering", "x": 30, "y": 40, "collapsed": true, params: {...defaults("lettering"), ...{"text": "O", "font": "Bold", "size": 115, "weight": 28, "nib": 35, "slant": 0, "fill": "Outline", "hatch": 1.2, "hangle": 45, "depth": 0, "dangle": 120, "side": "Zigzag", "sidegap": 1.8, "rotate": 0, "tracking": 1, "lineh": 1.5, "align": "Center", "yoff": 0, "margin": 12, "layer": 0}}},{"id": 9002, "type": "line_shadows", "x": 390, "y": 40, params: {...defaults("line_shadows"), ...{"spacing": 1.2, "angle": 90, "layers": 4, "fan": 55, "hinge": "Bottom", "shorten": true, "shift": 0, "outlines": false, "penMode": "Cycle pens", "pen": 0, "pens": 4, "placement": "Fit to margin", "margin": 18}}}],edges:[{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}]})},
  ...MULTICOLOUR_GRID_EXAMPLES.map(ex => ({name: ex.name, desc: ex.desc, canvas: ex.canvas, make: defaults => ({...structuredClone(ex.graph), nodes: ex.graph.nodes.map(n => ({...n, params: {...defaults(n.type), ...n.params}}))})})),
  ...SHAPE_LESSONS.map(l=>({name:l.example,desc:l.summary+" "+l.steps.map(s=>s[1]).join(" ")+" "+(l.motion?"Use the English Shapes tutorial for the animation wiring. Leave the seed fixed.":"This is a static starting composition."),canvas:{W:297,H:210},make:defaults=>{const nodes=[],edges=[];if(l.source)nodes.push({id:9001,type:l.source.key,x:30,y:40,params:{...defaults(l.source.key),...l.source.settings}});nodes.push({id:9002,type:l.key,x:l.source?380:30,y:40,params:{...defaults(l.key),...l.settings}});if(l.source)edges.push({id:"e9101",from:9001,fromPort:0,to:9002,toPort:0});return {nodes,edges};}})),
  {
    name: "Marbling · Combed grid",
    desc: "Select Marbling. A horizontal Grid is pulled vertically by eleven soft comb tines. Direction 90 crosses the source lines; Direction 0 pulls along them. Strength, Pull, Radius and Tine spacing change the folds. Try Drop, Rake and Swirl. Phase animates a reversible force cycle; wire Frame rot degrees for motion. This version uses repeatable controls rather than recording mouse gestures. No automatic fit: Crop can contain displaced ink.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "grid", x: 20, y: 20, params: { ...defaults("grid"), "hlines": 55, "vlines": 0, "margin": 35, "res": 1 } },
      { id: 9002, type: "marbling", x: 370, y: 20, params: { ...defaults("marbling"), "angle": 90, "tines": 11, "spacing": 14, "travel": 35, "strength": 80, "radius": 55 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}] }),
  },
  {
    name: "Shape Packing · Stars inside O",
    desc: "Select Shape Packing. The Lettering O supplies a boundary with a hole; copies of a Superformula star fit inside it. Motif source size is normalized to Largest size. Clearance protects both the region edge and the spaces between copies. Copies is an upper bound. Conservative convex envelopes mean concave motifs can leave extra space. Seed gives another arrangement; smaller Size or Clearance lets more copies fit.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "superformula", x: 20, y: 20, params: { ...defaults("superformula"), "m": 5, "n1": 0.3, "n2": 1, "n3": 1 } },
      { id: 9002, type: "lettering", x: 370, y: 20, params: { ...defaults("lettering"), "text": "O", "size": 120, "weight": 40, "depth": 0 } },
      { id: 9003, type: "shape_packing", x: 720, y: 20, params: { ...defaults("shape_packing"), "count": 60, "size": 10, "vary": 45, "gap": 0.7 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9003, "toPort": 0}, {"id": "e9102", "from": 9002, "fromPort": 0, "to": 9003, "toPort": 1}] }),
  },
  {
    name: "Path Bend · Curved grid ribbon",
    desc: "Select Path Bend. The complete Grid bends around a closed Superformula spine. Width 18% reduces the transverse dimension to a narrow ribbon; Length Fit maps the whole source width around the curve. The source can be typography or any drawing. Actual length retains source millimetres. Spine # chooses one curve; open spines extend along their endpoint tangents. No automatic fit/crop is applied.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "grid", x: 20, y: 20, params: { ...defaults("grid"), "hlines": 7, "vlines": 35, "margin": 25, "res": 1 } },
      { id: 9002, type: "superformula", x: 370, y: 20, params: { ...defaults("superformula"), "m": 3, "n1": 2, "n2": 4, "n3": 4, "margin": 42 } },
      { id: 9003, type: "path_bend", x: 720, y: 20, params: { ...defaults("path_bend"), "width": 18 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9003, "toPort": 0}, {"id": "e9102", "from": 9002, "fromPort": 0, "to": 9003, "toPort": 1}] }),
  },
  {
    name: "Seamless Tile · Mirrored repeat",
    desc: "Select Seamless Tile. A reflected 2×2 cell is the rectangular repeat unit, shown in a 3×3 preview. Shift moves the motif through the seam. Choose Single unit to export the true-size master; the preview can shrink to fit the canvas. Half drop uses two columns in its master unit. Closed paths cut by the tile edge become open fragments without extra edge strokes.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "superformula", x: 20, y: 20, params: { ...defaults("superformula"), "m": 5, "n1": 0.3, "n2": 1, "n3": 1 } },
      { id: 9002, type: "seamless_tile", x: 370, y: 20, params: { ...defaults("seamless_tile"), "repeat": "Mirror", "width": 42, "height": 36, "shiftX": 16, "shiftY": 12 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}] }),
  },
  {
    name: "Reaction Patterns · Living maze",
    desc: "Select Reaction Patterns. This is a Gray–Scott chemical field, outlined as real vector paths. Maze, Coral and Spots use different reaction settings. Change Seed for new germs; Pattern scale changes feature size. Growth reconstructs a deterministic simulation prefix. Choose Timeline, set 32 frames and Play to grow it. Growth 0 contains the initial germs. Region limits sampled simulation cells, so contour boundaries have grid-resolution error; Container can clip an exact boundary.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "reaction_patterns", x: 20, y: 20, params: { ...defaults("reaction_patterns"), "pattern": "Maze", "detail": 100, "steps": 1100, "contours": 2 } }
    ], edges: [] }),
  },
  {
    name: "Crystal Growth · Quartz cluster",
    desc: "Select Crystal Growth. Quartz stems have six faceted sides and pointed terminations. Branching adds lateral daughters; Competition limits tips entering an older stem. Change Seed, Lean or Width. Growth keeps Drawing in a fixed mature frame; choose Timeline and Play for a growth sequence. Mesh is normalized separately each frame, so use Drawing for fixed-size growth or animate a downstream Size too. Mesh Render adds hidden contours and light; the native preview deliberately shows back wire edges.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "crystal_growth", x: 20, y: 20, params: { ...defaults("crystal_growth"), "count": 22, "branch": 35, "growth": 100 } }
    ], edges: [] }),
  },
  {
    name: "Mesh Render · Crystal illustration",
    desc: "Select Mesh Render. Crystal Growth supplies an actual triangle mesh. Visible contours, silhouettes, cross-hatching and floor shadows share one camera. Move Light azimuth/elevation: shading and the floor shadow change without refitting the object. Try Drawing Contours, Hatch or Edges; Contour axis changes the surface sections. Raster detail controls the approximation; tiny features can disappear. Load a local STL or connect another Mesh source. Mesh output passes the original normalized model onward.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "crystal_growth", x: 20, y: 20, params: { ...defaults("crystal_growth"), "count": 14, "branch": 25 } },
      { id: 9002, type: "mesh_render", x: 370, y: 20, params: { ...defaults("mesh_render"), "size": 170, "contours": 28, "pitch": 1.6, "yaw": -20, "elevation": 28, "shadowPen": 0 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 1, "to": 9002, "toPort": 0}] }),
  },
  {
    name: "Array · Spatial helix",
    desc: "Select Array. The input motif is copied onto tangent planes around a 3D helix. View angle and Elevation share one camera. Radius, Turns and Helix height shape the arrangement; Motif size changes each flat copy. Try Sphere 3D, or Grid / Radial / Spiral for flat layouts. These are flat motif instances with all copies visible, without solid-surface occlusion. The original Linear transform remains unchanged.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "superformula", x: 20, y: 20, params: { ...defaults("superformula"), "m": 5, "n1": 0.5, "n2": 1, "n3": 1 } },
      { id: 9002, type: "array", x: 370, y: 20, params: { ...defaults("array"), "layout": "Helix 3D", "count": 45, "motifSize": 15, "radius": 58, "height": 110, "turns": 2.5, "elevation": 25, "penPer": false } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}] }),
  },
  {
    name: "Lens · Vortex",
    desc: "Select Lens. Vortex winds the centre more tightly than Twist, with a smooth radial falloff. Angle 0 is an exact pass-through. Radius and Falloff shape the deformation; geometry outside Radius stays in place. Sparse lines are resampled before bending. Wire Frame rot degrees to Twist angle for motion. Bulge is the original lens mode with unchanged output.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "grid", x: 20, y: 20, params: { ...defaults("grid"), "hlines": 25, "vlines": 35, "res": 1 } },
      { id: 9002, type: "lens", x: 370, y: 20, params: { ...defaults("lens"), "mode": "Vortex", "twist": 220, "radius": 85, "falloff": 2 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}] }),
  },
  {
    name: "3D View · Twisted type",
    desc: "Select 3D View. Surface bend Twist deforms the lettering before the shared camera projection. Bend axis chooses the direction, Bend / twist angle sets the total twist. Try Bend or Cylinder; Cylinder wraps physical source arc length around Radius. All source lines remain visible: this is a projected drawing sheet, not a hidden-surface solid. Flat None preserves the original projection.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 20, y: 20, params: { ...defaults("lettering"), "text": "TURN", "size": 62, "weight": 30, "depth": 0, "fill": "Hatch", "hatch": 1.4 } },
      { id: 9002, type: "view3d", x: 370, y: 20, params: { ...defaults("view3d"), "deform": "Twist", "bendAngle": 240, "yaw": 20, "pitch": 15, "persp": 0.3 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}] }),
  },
  {
    name: "Drape · Flying typography",
    desc: "Select Drape: Flying maps a full panel of serif words onto a floating sheet, with no grid. Edit the text in Word Shape. Wave height, Wavelength, Wave direction, Twist and Edge curl shape the surface; Yaw, Elevation and Perspective set the camera. Hidden lines removes text behind foreground folds. Open ANIMATE, choose 48 frames and Play: Time source Timeline makes one seamless loop. Loops per timeline sets speed in whole cycles, including zero to freeze. Phase offsets the pose; Pause to export the current frame as SVG or G-code; Manual and Phase choose a still pose. Framing stays fixed. Cloth artwork accepts any drawing, including imported vector art. This is a periodic deformation without cloth collisions.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "word_shape", x: 20, y: 20, params: { ...defaults("word_shape"), text: "WORDS BECOME WAVES", shape: "Square", mode: "Repeat text", autoRows: false, rows: 14, width: 265, height: 175, size: 8, tracking: 1.15, lineSpacing: 1.4, clearance: 0.25 } },
      { id: 9002, type: "drape", x: 370, y: 20, params: { ...defaults("drape"), physicsMode: "Flying", flightContent: "Artwork", waveHeight: 14, wavelength: 155, waveDirection: 25, twist: 45, edgeCurl: 160, yaw: -12, pitch: 60, persp: .3, motion: "Timeline", phase: 45 } }
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 3 }] }),
  },
  {
    name: "Drape · Flying drawing",
    desc: "A Spiro drawing with a second pen for the grid rides the same Flying surface as text. Cloth artwork maps the whole source canvas to the sheet and preserves source pens. No grid is needed; choose Artwork + grid to reveal the surface. Corners holds all four corners in place. Try Free, Top edge, Left edge or Centre; attached points remain fixed throughout the loop. Manual Phase gives a still frame. Put Brush Z or Needle Punch after Drape if needed: the 3D cloth depth is projected into XY, not machine Z.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "spiro", x: 20, y: 20, params: { ...defaults("spiro"), layer: 2 } },
      { id: 9002, type: "drape", x: 370, y: 20, params: { ...defaults("drape"), physicsMode: "Flying", flightPin: "Corners", flightContent: "Artwork + grid", waveHeight: 18, wavelength: 100, twist: 70, edgeCurl: 120, phase: 100, yaw: 20, pitch: 45, layer: 0 } }
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 3 }] }),
  },
  {
    name: "Drape · Flying curled edges",
    desc: "A sheet of words with tightly curled edges. Compare Hidden lines on/off: folds can hide the ink behind them even though the fabric itself is not drawn. The back is also opaque. Edge curl accepts negative values to turn the other way. Adjust Elevation to inspect folds, and choose Manual Phase for a fixed export. Flying does not prevent surface intersections; occlusion displays the nearest surface at each point.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "word_shape", x: 20, y: 20, params: { ...defaults("word_shape"), text: "FLOAT FOLD FLOW", shape: "Square", mode: "Repeat text", autoRows: false, rows: 14, width: 270, height: 175, size: 8, tracking: 1.15, lineSpacing: 1.4, clearance: 0.25 } },
      { id: 9002, type: "drape", x: 370, y: 20, params: { ...defaults("drape"), physicsMode: "Flying", waveHeight: 10, wavelength: 100, twist: -45, edgeCurl: 265, phase: 130, yaw: 12, pitch: 35, persp: .25 } }
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 3 }] }),
  },
  ...[
    { label: "roll", profile: "Roll", axis: "Length", phase: 140, pitch: 38, yaw: -25, text: "ROUND AND ROUND", explanation: "Roll winds and unwinds the whole sheet, up to one and a half turns. The rolling layers pass in front of each other. This goes beyond the edge curls in Flutter." },
    { label: "loop", profile: "Loop", axis: "Width", phase: 90, pitch: 38, yaw: -25, text: "WORDS COME AROUND", explanation: "Loop keeps the whole sheet in an open coil, with overlapping ends and a changing bend. Hidden lines makes the near side conceal the far side. The opening is intentional: this is still one rectangular sheet." },
    { label: "corkscrew", profile: "Corkscrew", axis: "Length", phase: 30, pitch: 58, yaw: 15, text: "LETTERS IN MOTION", explanation: "Corkscrew gives the sheet a complete helical turn. The twist travels through the surface over time. This is stronger than the original Twist control." },
  ].map(m => ({
    name: "Drape · Flying " + m.label,
    desc: "Select Drape. Movement " + m.profile + ". " + m.explanation + " Motion amount blends from the original flutter at 0% to the full profile at 100%. Motion along chooses Width or Length. Wave height, Twist and Edge curl add smaller folds on top. Set Attachment Free for the full wrap, or keep an edge, corners or centre anchored. Open ANIMATE, choose 48 frames and Play for a seamless cycle; Manual Phase chooses a still. Framing stays fixed across the cycle. Geometry can intersect; this is a drawing deformation without collisions.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "word_shape", x: 20, y: 20, params: { ...defaults("word_shape"), text: m.text, shape: "Square", mode: "Repeat text", autoRows: false, rows: 16, width: 265, height: 175, size: 7, tracking: 1.15, lineSpacing: 1.4, clearance: .25 } },
      { id: 9002, type: "drape", x: 370, y: 20, params: { ...defaults("drape"), physicsMode: "Flying", flightMotion: m.profile, motionAmount: 100, motionAxis: m.axis, waveHeight: 3, wavelength: 180, waveDirection: 25, twist: 0, edgeCurl: 0, yaw: m.yaw, pitch: m.pitch, persp: .2, motion: "Timeline", phase: m.phase } }
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 3 }] }),
  })),
  {
    name: "Drape · Flag typography",
    desc: "Select Drape. Flag pins a cloth sheet along its left edge; the new Cloth artwork input maps this text onto the moving mesh. Grid can be drawn too. Choose Hanging for a top attachment, or change Attachment directly. Wind, Gravity, Damping and Elasticity drive a bounded pinned mass-spring solve. Pull point fixes one movable point. Set Time source Timeline, 32 frames and Play for periodic wind. Each pose reconstructs the solver, with fixed framing and margin clipping. Objects/Mesh are used only in Draped mode; cloth self-collision is not solved.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 20, y: 20, params: { ...defaults("lettering"), "text": "WIND", "size": 58, "weight": 30, "depth": 0, "fill": "Hatch", "hatch": 1.5 } },
      { id: 9002, type: "drape", x: 370, y: 20, params: { ...defaults("drape"), "physicsMode": "Flag", "clothContent": "Artwork + grid", "clothDensity": 28, "wind": 65, "pull": true, "pullDepth": 55, "phase": 70, "pitch": 25, "yaw": 15 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 3}] }),
  },
  {
    name: "Gravity · Falling letters",
    desc: "Select Gravity. Rigid bodies / Motif copies repeats the complete A, including its hole, as one convex envelope per copy. It simulates rotations and contact impulses against other envelopes and the tray. Time 0 shows the initial arrangement; Time 5 shows the settled pile. Bounce and Friction affect contacts. Choose Timeline to animate a deterministic prefix. Concave motifs use conservative envelopes, so ink can leave extra room; Input paths treats each path independently. Very large initial overlaps or overfull trays can remain unresolved. Falling grid keeps the original effect.",
    canvas: {"W": 297, "H": 210},
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 20, y: 20, params: { ...defaults("lettering"), "text": "A", "size": 18, "weight": 22, "depth": 0 } },
      { id: 9002, type: "gravity", x: 370, y: 20, params: { ...defaults("gravity"), "physicsMode": "Rigid bodies", "bodySource": "Motif copies", "bodyCount": 24, "bodySize": 22, "time": 5, "bodySpin": 70 } }
    ], edges: [{"id": "e9101", "from": 9001, "fromPort": 0, "to": 9002, "toPort": 0}] }),
  },
  {
    name: "L-System · Seeded forest",
    desc: "Select L-System. Composition Forest places seven complete plants on A3 wide. Stochastic rules uses Continue / Branch / End as relative weights; they need not total 100. Seed changes branching, Angle variation and Length variation add independent irregularity. Branch scale 75% shortens nested branches. Plants / Columns / Spacing control cells; Height variation gives each plant its own fit with a shared baseline. Try Sparse tree, Bush or Fern. Growth 100% shows the mature drawing; lower it without moving the final framing. Original presets stay unchanged when the new controls are neutral.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lsystem", x: 40, y: 20, params: { ...defaults("lsystem"), preset: "Sparse tree", mode: "Forest", iter: 6, stochastic: true, continueWeight: 25, branchWeight: 70, endWeight: 5, branchScale: 75, angleVariation: 20, lengthVariation: 15, layer: 0 } },
    ], edges: [] }),
  },
  {
    name: "L-System · Growing fern",
    desc: "Select L-System, open ANIMATE, set 48 frames and press Play. Frame t is multiplied by 100 in Math, then drives Growth %. The final fern is generated from a fixed Seed and revealed in drawing order, keeping its final size and placement. This is a drawing reveal; keep Iterations, Seed and structural controls fixed for continuous growth. For a whole growing forest choose Composition Forest: each plant reveals its own share simultaneously. No model, API key or external library is needed.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "frame", x: 20, y: 20, params: { ...defaults("frame") } },
      { id: 9002, type: "matem", x: 370, y: 20, params: { ...defaults("matem"), op: "A × B", b: 100 } },
      { id: 9003, type: "lsystem", x: 720, y: 20, params: { ...defaults("lsystem"), preset: "Fern", iter: 6, stochastic: true, continueWeight: 25, branchWeight: 70, endWeight: 5, branchScale: 80, angleVariation: 12, lengthVariation: 10, layer: 0 } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: "p:growth" },
    ] }),
  },
  {
    name: "Line Drape · Folded type",
    desc: "Select Line Drape. Lettering supplies the FLOW outline at Depth 0; the letters are only a mask, not extra plotted outlines. Orientation rotates the straight background lines, Bend angle sets their relative direction inside the face. Softness rounds the border, Shift slides the inner field, and Strength 0 gives straight lines. Pens 4 cycles four levels; choose 1 for a single black pen. For Type Studio, connect its output to Shape. For open Text strokes, adjust Stroke width. Very narrow strokes need lower Softness / Detail. Phase accepts animation wires.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lettering", x: 20, y: 20, params: { ...defaults("lettering"), text: "FLOW", size: 76, weight: 36, depth: 0 } },
      { id: 9002, type: "line_drape", x: 370, y: 20, params: { ...defaults("line_drape"), pitch: 1.4, bend: -48, soft: 3, pens: 4, layer: 1 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Line Drape · Angled shape",
    desc: "Select Line Drape. A Superformula outline controls a single-pen line field at Orientation 32 degrees; Bend angle 62 changes the direction only through the shape. Softness rounds the transition. Fill closed shapes keeps a filled mask; disable it to bend only around the stroked outline. The shape itself is not drawn. Try Orientation 0 / 90, Strength 0, or a different Superformula.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "superformula", x: 20, y: 20, params: { ...defaults("superformula"), margin: 45, n1: .45, n2: 1.2, n3: 1.2, m: 5 } },
      { id: 9002, type: "line_drape", x: 370, y: 20, params: { ...defaults("line_drape"), angle: 32, bend: 62, soft: 5 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Needle Test · Depth and spacing",
    desc: "Select Needle Test. Each horizontal row has one fixed depth and spacing, with at least 20 punches. All depth and spacing combinations appear on separate rows. Preview labels give the exact mm values and are never exported. Set Max depth (default 0.5 mm, at most 2 mm), then choose the Needle Z machine profile and export G-code. This node already outputs individual punches: connect directly to output without Needle Punch or modifiers. Calibrate the paper surface before running the file.",
    canvas: { W: 148, H: 148 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "needletest", x: 40, y: 20, params: { ...defaults("needletest") } },
    ], edges: [] }),
  },
  {
    name: "Surface study · Torn organic rings",
    desc: "Organic Rings with small dotted rings and a full halo feeds Torn, then 2D to 3D Inflate / Auto. Select 2D to 3D. Tiny closed marks narrower than Stroke width become compact solids; dense curves adapt their approximation within one eighth of the width. Every mark/curve stays in the source allocation, while the complete mesh stays under its triangle cap. Try Extrude or Tubes, then lower Depth % for a shallower relief. This reproduces the formerly blank dense-input case; very small stamps are intentionally faceted rather than overlapping thick loops.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "organicrings", x: 20, y: 20, params: { ...defaults("organicrings"), hole: .03, wav: .11, bundling: .45, dotshare: .44, dotsize: .2, bulges: 8, bulgesize: .4, halo: 1, pens: 1 } },
      { id: 9002, type: "torn", x: 370, y: 20, params: { ...defaults("torn"), angle: -21, offset: -3, width: 12, gape: 4, chaos: 39, flingPct: 22 } },
      { id: 9003, type: "inflate3d", x: 720, y: 20, params: { ...defaults("inflate3d") } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
    ] }),
  },
  {
    name: "Moving Lines · Passing streaks",
    desc: "Select Moving Lines, set ANIMATE Frames to 48 and press Play. Only straight open line segments move across the sheet; there are no eyes or circles. Line length and Gap set the streak rhythm, Length variation and Stagger give each track a stable seeded offset. Direction Reverse changes travel direction; Alternating sends neighbouring tracks opposite ways. Wave amplitude 0 keeps the lines straight. Timeline needs no Frame wire. Cycles 1 travels one pattern period per loop; Phase offsets it. SVG/G-code ×48 exports exactly the same motion, clipped to Margin on every frame.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "moving_lines", x: 40, y: 20, params: { ...defaults("moving_lines") } },
    ], edges: [] }),
  },
  {
    name: "Moving Lines · Travelling waves",
    desc: "Select Moving Lines, set 48 frames and press ANIMATE Play. Continuous tracks carry a travelling wave rather than moving dashes. Wave amplitude 5 mm, Wavelength 90 mm and Row phase 4 degrees shape the field. Try Streaks to combine the curved tracks with moving segments, or set Amplitude 0 for straight lines. Angle rotates the complete field before clipping to the margin. Time source Manual exposes a still Phase; wire Frame rot degrees into Phase only in Manual, so the clock is not counted twice. All paths remain open, with no rings or closed motifs.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "moving_lines", x: 40, y: 20, params: { ...defaults("moving_lines"), lineStyle: "Continuous", rows: 70, amplitude: 5, wavelength: 90, rowPhase: 4 } },
    ], edges: [] }),
  },
  {
    name: "Move / Scale · Moire orbit",
    desc: "Two fine ring discs overlap. Select Merge, set ANIMATE Frames to 48 and press Play. One disc stays fixed; the other follows Move / Scale Motion Orbit, Travel X 3 mm and Y 1.5 mm, with Scale swing 0. The interference bands move even though the displacement is tiny. Select Move / Scale to change the amplitudes or Phase; static Move X/Y shifts the centre of the orbit. Keep Cycles at 1 for slow motion, or raise it for more loops in the sequence. SVG/G-code ×48 exports the same frame positions. Leave room for the whole orbit; this transform does not clip or refit.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "moire_disc", x: 20, y: 20, params: { ...defaults("moire_disc"), radius: 78, pitch: 1.2, rim: false } },
      { id: 9002, type: "moire_disc", x: 20, y: 380, params: { ...defaults("moire_disc"), radius: 78, pitch: 1.2, rim: false } },
      { id: 9003, type: "move_scale", x: 360, y: 380, params: { ...defaults("move_scale"), motion: "Orbit", travelX: 3, travelY: 1.5, scaleSwing: 0 } },
      { id: 9004, type: "merge", x: 700, y: 20, params: { ...defaults("merge") } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9004, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      { id: "e9103", from: 9003, fromPort: 0, to: 9004, toPort: 1 },
    ] }),
  },
  {
    name: "Move / Scale · Moire counter-motion",
    desc: "Two hatch discs differ by 2 degrees. Each passes through its own Move / Scale with Sway; Phase 0 and 180 degrees move them in opposite directions. Select Merge, set 48 frames and press ANIMATE Play. Travel X 1.5 mm and Y 0.5 mm are amplitudes, not the full distance. Keep Scale swing 0 to see pure displacement, then try 1% to add a slow size change. Breathe animates only scale, hiding unused Travel controls. To drive Phase with a Frame rot output, choose Time source Manual so the timeline is not counted twice.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "moire_disc", x: 20, y: 20, params: { ...defaults("moire_disc"), content: "Hatch", radius: 78, pitch: 1.2, rim: false } },
      { id: 9002, type: "moire_disc", x: 20, y: 380, params: { ...defaults("moire_disc"), content: "Hatch", radius: 78, pitch: 1.2, angle: 2, rim: false } },
      { id: 9003, type: "move_scale", x: 360, y: 20, params: { ...defaults("move_scale"), motion: "Sway", travelX: 1.5, travelY: .5, scaleSwing: 0 } },
      { id: 9004, type: "move_scale", x: 360, y: 380, params: { ...defaults("move_scale"), motion: "Sway", travelX: 1.5, travelY: .5, scaleSwing: 0, phase: 180 } },
      { id: 9005, type: "merge", x: 700, y: 20, params: { ...defaults("merge") } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 0, to: 9004, toPort: 0 },
      { id: "e9103", from: 9003, fromPort: 0, to: 9005, toPort: 0 },
      { id: "e9104", from: 9004, fromPort: 0, to: 9005, toPort: 1 },
    ] }),
  },
  {
    name: "3D Typography · Text tubes",
    desc: "Dense text is actual vector linework. Type Studio treatment 12 makes NO SIGNAL from tiny characters; 2D to 3D Tubes wraps every small stroke. Select 2D to 3D. Diameter 0.5 mm suits this lettering; the old default 6 mm would merge nearby characters visually. Tube step adds samples between corners and preserves the original letter corners. Rotate View elevation to inspect the tubes, or use 90 for a top view. No path-count reduction or text rasterization is needed.",
    canvas: { W: 594, H: 420 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "type_studio", x: 20, y: 20, params: { ...defaults("type_studio"), mode: "12 / Text made of text", text: "No Signal", tracking: 1.55 } },
      { id: 9002, type: "inflate3d", x: 370, y: 20, params: { ...defaults("inflate3d"), mode: "Tubes", diameter: .5, tubeStep: 3, viewAz: 2, viewEl: 65, size: 380 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "3D Typography · Extruded pen strokes",
    desc: "Hairline lettering is made of open pen strokes and closed loops. Path interpretation Stroked paths turns all of them into rectangular strips with Stroke width mm, preserving the counters of closed loops. Select 2D to 3D. Depth % controls the Z extent relative to the original word width. Switch Mode to Inflate for rounded strips. Auto chooses strokes for open/dense linework; Closed outlines is for actual filled regions. Overlapping strips are separate solids, with hidden-line removal in the projected drawing.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "type_studio", x: 20, y: 20, params: { ...defaults("type_studio"), mode: "08 / Hairline lettering", text: "ink", size: 60 } },
      { id: 9002, type: "inflate3d", x: 370, y: 20, params: { ...defaults("inflate3d"), mode: "Extrude", inputShape: "Stroked paths", strokeWidth: 1, depth: 8, size: 190, viewEl: 45 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Mold · Spreading colonies",
    desc: "Select Mold, open ANIMATE, set Frames to 32 and press Play. Motion Timeline starts with small germs and ends with mature, merging colonies. Edge roughness shapes the lobed front; Growth rings leaves fixed age bands, and Spores matures a stippled surface. Keep Seed, Colonies and Spread fixed during playback. The loop deliberately restarts growth. To inspect a still, switch Motion to Manual and scrub Growth %. SVG/G-code ×32 exports the same seeded growth, one drawing per frame; Margin stays fixed. Use a fine pen for the small spore loops.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "mold", x: 40, y: 20, params: { ...defaults("mold"), mode: "Mold", motion: "Timeline", colonies: 4, spread: 70, seed: 73 } },
    ], edges: [] }),
  },
  {
    name: "Mold · Growing mycelium",
    desc: "Select Mold in Mycelium mode, open ANIMATE, set Frames to 32 and press Play. Fine hyphae extend and fork while older branches remain fixed. Branching % changes how often tips fork, Hypha spacing mm limits crowding, and Meander bends the growth. Spread bounds each colony, shown by dashed guides. Keep structural settings and Seed fixed across frames. Timeline grows from germs to a mature network and restarts at the loop boundary. Manual Growth % can be wired from Frame t through Math ×100. Every frame exports ordinary 2D pen paths; no physical growth or machine Z motion is implied.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "mold", x: 40, y: 20, params: { ...defaults("mold"), mode: "Mycelium", motion: "Timeline", colonies: 2, placement: "Center", spread: 78, branching: 8, spacing: 1.1, seed: 29 } },
    ], edges: [] }),
  },
  {
    name: "Inflate · Rounded pillow",
    desc: "A closed rectangle becomes a rounded 3D pillow. Select 2D to 3D with Mode Inflate. Depth % sets total thickness relative to the shape's longest side; Roundness swells the profile. Back surface Flat makes a relief with a flat underside. Surface grid follows the curved body; Grid every Nth changes line density. Hidden-line removal hides the back. Rotate View angle/elevation, then export ordinary 2D SVG or G-code. Orange output 3 is the real normalized Mesh. Open source strokes are ignored; use closed outlines.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "container", x: 20, y: 20, params: { ...defaults("container"), shape: "Rectangle", cx: 148.5, cy: 105, rw: 120, rh: 80, draw: true, regionPen: 0 } },
      { id: 9002, type: "inflate3d", x: 370, y: 20, params: { ...defaults("inflate3d") } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Inflate · Keep the hole",
    desc: "Two nested circles feed one Inflate node through Merge. The inner outline cuts a real hole through the swollen body, independent of path direction. Select Inflate, adjust Depth % and rotate View elevation to inspect the opening. All closed paths use even-odd fill: a third nested outline would become an island, and overlapping outlines also alternate filled/empty. Surface detail refines the sampled rim; keep tiny gaps wider than a few cells. Orange Mesh output 3 can feed Mesh Slice Mesh input for actual layer contours.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "container", x: 20, y: 20, collapsed: true, params: { ...defaults("container"), shape: "Circle", cx: 148.5, cy: 105, cr: 65, draw: true, regionPen: 0 } },
      { id: 9002, type: "container", x: 20, y: 185, collapsed: true, params: { ...defaults("container"), shape: "Circle", cx: 148.5, cy: 105, cr: 27, draw: true, regionPen: 0 } },
      { id: 9003, type: "merge", x: 370, y: 20, collapsed: true, params: { ...defaults("merge") } },
      { id: 9004, type: "inflate3d", x: 720, y: 20, params: { ...defaults("inflate3d"), depth: 36, viewEl: 55 } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
      { id: "e9103", from: 9003, fromPort: 0, to: 9004, toPort: 0 },
    ] }),
  },
  {
    name: "Inflate · Grow 3D spikes",
    desc: "A closed Superformula outline inflates into a real surface, then grows spikes. The orange Mesh output 3 of Inflate feeds 3D Spikes Surface; Body must be Wired mesh. Select 3D Spikes to preview/export. Sculpt Depth % and Roundness upstream; Count, Length and Spread change the coat downstream. The two nodes have independent preview cameras; changing Inflate's View does not rotate its Mesh. Keep Seed fixed while rotating Spikes. Bang/Toggle can drive Hidden-line removal or Body occlusion through their green checkbox ports.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "superformula", x: 20, y: 20, collapsed: true, params: { ...defaults("superformula"), m: 5, n1: 2, n2: 7, n3: 7, rings: 1 } },
      { id: 9002, type: "inflate3d", x: 370, y: 20, params: { ...defaults("inflate3d"), depth: 35, detail: 36 } },
      { id: 9003, type: "spikes3d", x: 720, y: 20, params: { ...defaults("spikes3d"), body: "Wired mesh", size: 115, count: 650, length: 19, spread: 12, viewEl: 50, host: "Silhouette", hostPen: 0 } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 2, to: 9003, toPort: 0 },
    ] }),
  },
  {
    name: "2D to 3D · Extrude with a hole",
    desc: "Merge two nested closed circles into 2D paths. Select 2D to 3D, Mode Extrude: Depth % makes a straight-walled solid with flat front/back and a real opening. Surface detail refines the sampled circular rim. Rotate View elevation to see the wall; switch Drawing to Mesh edges to inspect triangles. Open strokes are ignored in Extrude. The same orange Mesh output 3 can feed Mesh Slice or 3D Spikes, with its own downstream size and camera.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "container", x: 20, y: 20, collapsed: true, params: { ...defaults("container"), shape: "Circle", cx: 148.5, cy: 105, cr: 65, draw: true, regionPen: 0 } },
      { id: 9002, type: "container", x: 20, y: 185, collapsed: true, params: { ...defaults("container"), shape: "Circle", cx: 148.5, cy: 105, cr: 27, draw: true, regionPen: 0 } },
      { id: 9003, type: "merge", x: 370, y: 20, collapsed: true, params: { ...defaults("merge") } },
      { id: 9004, type: "inflate3d", x: 720, y: 20, params: { ...defaults("inflate3d"), mode: "Extrude", depth: 28, viewEl: 48, every: 3 } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
      { id: "e9103", from: 9003, fromPort: 0, to: 9004, toPort: 0 },
    ] }),
  },
  {
    name: "2D to 3D · Tubes from strokes",
    desc: "Zigzag Sine makes three open waves. Select 2D to 3D, Mode Tubes: Diameter mm wraps each wave in a round tube, Tube step mm controls sampling along it, Tube sides controls the cross-section. These millimetres refer to the source drawing before normalization. Cap open ends closes each tube; closed paths loop without caps. Grid every Nth thins rings and rails for plotting. Overlapping tubes stay separate surfaces. Rotate View angle/elevation and export the projected Drawing as SVG or G-code, or send Mesh output 3 into another 3D node.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "zigzag", x: 20, y: 20, collapsed: true, params: { ...defaults("zigzag"), wave: "Sine", rows: 3, amp: 12, period: 65, phase: .3, margin: 30 } },
      { id: 9002, type: "inflate3d", x: 370, y: 20, params: { ...defaults("inflate3d"), mode: "Tubes", diameter: 8, tubeStep: 4, sides: 8, viewAz: 20, viewEl: 55, every: 3 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "2D to 3D · Ink height relief",
    desc: "Overlapping sine strokes become raised ink on a flat slab. Select 2D to 3D, Mode Ink height. Ink width mm sets the soft footprint; Ink buildup raises dense overlaps without counting the source vertices. Depth % controls the relief, Base % its flat support. Height curve changes tonal response and Smooth passes softens ridges. This uses vector ink density, not actual pen pressure. Surface detail resolves the footprint; very thin ink is broadened to a grid cell for stable sampling. Select Drawing Surface grid for printable relief lines. Orange Mesh output 3 contains the raised surface and its closed base.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "zigzag", x: 20, y: 20, collapsed: true, params: { ...defaults("zigzag"), wave: "Sine", rows: 9, amp: 19, period: 80, phase: .5, margin: 35 } },
      { id: 9002, type: "inflate3d", x: 370, y: 20, params: { ...defaults("inflate3d"), mode: "Ink height", depth: 30, inkWidth: 5, base: 3, detail: 54, viewAz: -15, viewEl: 48 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "2D to 3D · Depth map",
    desc: "Select 2D to 3D, Mode Depth map. Wave study gives an immediate test relief. To use your own grayscale image, switch Depth source to Image file and press Choose image. White is high and black is low; Dark is high reverses it. Depth % controls relief, Base % keeps a closed flat underside, Height curve changes contrast, Smooth passes softens pixel steps. Surface detail controls mesh resolution. The image is saved inside the patch, and its aspect ratio is retained. View angle 0 and View elevation 90 give a top view with the original image orientation. Drawing is projected 2D geometry for SVG/G-code; Mesh output 3 is the real relief for other 3D nodes.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "inflate3d", x: 40, y: 20, params: { ...defaults("inflate3d"), mode: "Depth map", mapSource: "Wave study", depth: 38, base: 4, viewAz: -25, viewEl: 45, detail: 54 } },
    ], edges: [] }),
  },
  {
    name: "Frame · Bang and Toggle",
    desc: "Frame Bang (green output 6) drives 3D Spikes Body occlusion. Set ANIMATE Frames to 16 and select 3D Spikes. At Bang rate 1/4, displayed frames 4, 8, 12 and 16 turn occlusion On; other frames leave it Off. Move the wire to Toggle (output 7) to hold each state until the next hit. Random uses Chance % and Seed, preserving the same sequence while scrubbing and exporting. The checkbox is read-only while wired; disconnect to restore its saved manual setting. Rate fractions refer to displayed frame numbers. Keep the pattern settings fixed during each Toggle loop.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "frame", x: 20, y: 20, params: { ...defaults("frame"), bangRate: "1/4" } },
      { id: 9002, type: "spikes3d", x: 370, y: 20, params: { ...defaults("spikes3d"), body: "Sphere", size: 95, count: 320, length: 30, occlusion: true } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 5, to: 9002, toPort: "p:occlusion" }] }),
  },
  {
    name: "3D Spikes · Travelling lengths",
    desc: "Frame rot degrees (output 5) drives Modulation phase degrees on 3D Spikes. Set ANIMATE Frames to 24, select Spikes and press Play. Length modulation Wave moves a growing/shrinking band along object Z; Modulation depth % controls how short the troughs become, Modulation size mm its wavelength. Try Noise for soft seeded movement, or Pulse with Pulse width %. Keep Seed, Count, body and camera fixed: roots and framing stay still. Length variation remains the static per-spike variation. With no Frame wire, choose Modulation motion Timeline for automatic movement; Modulation cycles sets whole cycles per loop. Off or depth 0 restores the original coat. SVG/G-code frame export follows the same phase. These are projected pen drawings, not machine Z animation.",
    canvas: { W: 210, H: 297 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "frame", x: 20, y: 20, collapsed: true, params: { ...defaults("frame") } },
      { id: 9002, type: "spikes3d", x: 370, y: 20, params: { ...defaults("spikes3d"), count: 650, length: 35, variation: .25, spread: 7, modulation: "Wave", modDepth: 95, modSize: 60, modMotion: "Manual", modAxis: "Z", host: "Silhouette", hostPen: 0, viewEl: 18 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 4, to: 9002, toPort: "p:modPhase" }] }),
  },
  {
    name: "3D Spikes · Bristling sculpture",
    desc: "A tall capsule covered with thin strokes grown from its 3D surface normals. Select 3D Spikes. Count and Length control the coat; Length variation and Spread create irregular bristles. Body occlusion hides strokes behind the host; turn it off for a transparent tangled study. Rotate View angle/elevation while keeping Seed fixed. Switch Marks to Spikes or Straws for width, or choose Imported STL to use a sculpture file. The whole drawing shrinks uniformly only when it exceeds Margin.",
    canvas: { W: 210, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "spikes3d", x: 40, y: 20,
      params: { ...defaults("spikes3d") } }], edges: [] }),
  },
  {
    name: "3D Spikes · Straw torus",
    desc: "An open torus covered with short six-sided straws. Diameter reveals their parallel edges and open end rings. Body drawing Silhouette adds the torus contour on another pen. Body occlusion clips against the torus, including its hole; individual straws do not hide one another. Adjust View elevation, Torus tube and Count. All output is flat projected pen geometry.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "spikes3d", x: 40, y: 20,
      params: { ...defaults("spikes3d"), body: "Torus", mode: "Straws", count: 180, size: 115, length: 17, diameter: 1.5, variation: .35, spread: 9, viewEl: 42, host: "Silhouette" } }], edges: [] }),
  },
  {
    name: "3D Spikes · Blob surface",
    desc: "Blob Mesh's orange Mesh output (port 2) feeds 3D Spikes Surface. Body must be Wired mesh. Sculpt the blob with Balls, Radius X/Y/Z, Profile and Noise, then select 3D Spikes to draw or export. Smooth normals blends triangle normals; disable it for faceted growth. Count samples by triangle area, independent of local tessellation density. Normal direction Outward handles consistently wound closed meshes; As mesh or Flip follows or reverses authored winding.",
    canvas: { W: 210, H: 297 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "blobmesh", x: 20, y: 20, params: { ...defaults("blobmesh"), balls: 3, rings: 24, segs: 32, radX: 65, radY: 75, radZ: 170, profile: "Pear", noiseAmp: 6, seed: 17 } },
      { id: 9002, type: "spikes3d", x: 365, y: 20, params: { ...defaults("spikes3d"), body: "Wired mesh", count: 1600, length: 33, spread: 24, viewEl: 16 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 2, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Lattice Type · Transit lattice",
    desc: "Grid-built lettering with round bowls, staircase diagonals, projecting crossbars and plotted junction dots. Edit Text; | starts a new line. Try Round corners, Crossbar reach and Dot radius. Dots: Outline gives rings; Hatched fills them with real strokes. Match Dot hatch gap to your pen width. Letter height is the requested cap height; the complete composition shrinks to fit Margin, including projecting marks and accents. Tight Letter gap can join adjacent letters. Separate pens assigns stems, crossbars and dots to three inks. Capitals, lowercase, digits and Ä/Ö/Å are supported. Select Lattice Type to preview and export.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "lattice_type", x: 40, y: 30,
      params: { ...defaults("lattice_type") } }], edges: [] }),
  },
  {
    name: "Direction Passes · Grid islands",
    desc: "Small overlapping grids feed one Direction Passes node. Select Direction Passes and download G-code passes .zip: run 01-horizontal, turn the tool manually 90 degrees about its centre, then run 02-vertical without moving the paper or changing origin. Routing stays inside each pass. Preview can show All, Horizontal, Vertical or Other without changing the download contents. No tip dimensions are needed. Test crop passes produces the same two directions on your chosen sample paper.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "grid", x: 20, y: 20, params: { ...defaults("grid"), vlines: 9, hlines: 7, margin: 15, res: 3 } },
      { id: 9002, type: "move_scale", x: 355, y: 20, params: { ...defaults("move_scale"), scale: 20, origin: "Canvas center", dx: -65, dy: 15 } },
      { id: 9003, type: "array", x: 690, y: 20, params: { ...defaults("array"), count: 7, dx: 22, dy: -9, drot: 0, dscale: 5, jit: 15, penPer: false, seed: 31 } },
      { id: 9004, type: "direction_passes", x: 1025, y: 20, params: { ...defaults("direction_passes"), tolerance: .1, preview: "All" } },
    ], edges: [
      { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
      { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      { id: "e9103", from: 9003, fromPort: 0, to: 9004, toPort: 0 },
    ] }),
  },
  ...TYPE_STUDIO_STYLES.map((mode,i) => ({
    name: "Type Studio · " + mode,
    desc: "One node, ten typography treatments with the original study numbers. Edit Text, then switch Type treatment. Only relevant controls are shown. Size and Margin fit the composition to your page. Blue Motif is used by 07 Modular marks; purple Style is applied last. For fine control, the original source nodes remain available.",
    canvas: { W: 200, H: 140 },
    make: defaults => ({ nodes: [{ id: 9201, type: "type_studio", x: 40, y: 30, params: {
      ...defaults("type_studio"), mode,
      text: ["TYPE","ROOT","FORM","TYPE","LOOP","TYPE","flow","TYPE","A","INK"][i],
      size: [34,39,46,44,42,39.2,38,50,40,52][i],
      weight: mode.startsWith("10") ? 40 : mode.startsWith("12") ? 35 : 32,
      layer: mode.startsWith("08") ? 6 : 0,
    }}], edges: [] }),
  })),
  {
    name: "Stitch Type · Letters made of cells", desc: "One Rod microbe becomes the building block of INK. Connect Microbes Paths to Stitch Type Motif (blue input 1); select Stitch Type. Auto uses the wired drawing. Change Motif size, angle and variation; Source pens preserves the source colours. For a simpler mark use Microbes Interior 0, Membrane Single and Filaments 0. The entire input drawing is one mark, so keep Count at 1.",
    canvas: { W: 200, H: 140 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "microbes", x: 20, y: 20, params: { ...defaults("microbes"), organism: "Rod", count: 1, size: 45, variation: 0, interior: 0, membrane: "Single", filaments: 0, motion: "Still", colours: 1, layer: 6 } },
      { id: 9002, type: "stitchtype", x: 365, y: 20, params: { ...defaults("stitchtype"), text: "INK", font: "Bold 5x7", px: 2, cell: 4, preset: "Custom", coreMark: "None", edgeMark: "None", haloMark: "None", auraMark: "None", pinMark: "None", rings: 0, motifTurn: 65, motifVary: .2, motifSize: .9, motifPens: "Source pens" } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Murmuration · Follow one reindeer", desc: "A moving camera follows the herd over sparse ground dots; animal 17 stays red. Select Frame Grid, set ANIMATE Frames to 24, and Play. Camera can also Follow animal. Keep Seed and Animals fixed. Export order → All frames by pen gives a ZIP: plot pen-00 on every sheet, then pen-02 on the same numbered sheets. Use a paper stop/jig and the same origin, scale and orientation on both passes. Markers and numbers are black only. For 48 sheets, change both Frame Grid Total frames and ANIMATE Frames to 48. In Liike choose Whole sheets and Light outlines.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "murmuration", x: 20, y: 20, params: { ...defaults("murmuration"), behaviour: "Reindeer herd", clock: "Timeline", birds: 120, spread: 42, travel: 0.85, scatter: 4, camera: "Follow group", ground: "Sparse dots", highlight: "On", animal: 17, highlightPen: 2 } },
      { id: 9002, type: "frame_grid", x: 370, y: 20, params: { ...defaults("frame_grid"), total: 24, layout: "Custom", cols: 1, rows: 1, gap: 0, markerStyle: "Light outlines", markSize: 8, numbers: "On" } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Microbes · Living microscope", desc: "Eighteen separate cells and bacteria in six inks. Select Microbes and press ANIMATE Play with 24 or 48 frames. Swimming combines small drifts, gentle turning and moving filaments; each organism keeps its identity and pen. For monochrome set Colours to 1. All frames by pen exports complete colour passes.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "microbes", x: 30, y: 20, params: { ...defaults("microbes"), colours: 6 } }], edges: [] }),
  },
  {
    name: "Microbes · Single cell", desc: "One enlarged cell with an inset membrane, a nucleus and small organelles. Count 1 centres the specimen. Size is its requested body dimension in mm before fitting; set Size variation to 0 for a consistent size. Breathe makes a quiet looping study. Interior 0 and Membrane Single leave just the outline.",
    canvas: { W: 210, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "microbes", x: 30, y: 20, params: { ...defaults("microbes"), organism: "Cell", count: 1, size: 150, variation: 0, interior: 1, motion: "Breathe" } }], edges: [] }),
  },
  {
    name: "Microbes · Swimming bacteria", desc: "A field of rod-shaped bacteria with coiled interiors and waving flagella. Filaments sets tail length and count; Motion amount sets the swimming movement. Keep Seed and Count fixed during a loop. Bodies and tails remain within separate reserved areas throughout the animation.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "microbes", x: 30, y: 20, params: { ...defaults("microbes"), organism: "Rod", count: 14, size: 52, filaments: 1, colours: 3, amount: 1 } }], edges: [] }),
  },
  {
    name: "Microbes · Specimen collection", desc: "Six different microscopic forms in a spaced grid: Cell, Coccus, Rod, Spiral, Amoeba and Ciliate. A still collection in six pens. Pick a single Organism and Count 1 to enlarge any specimen. These are stylised biological drawings, made entirely from plotter paths.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "microbes", x: 30, y: 20, params: { ...defaults("microbes"), count: 6, size: 65, layout: "Grid", variation: 0, motion: "Still", interior: 1, colours: 6 } }], edges: [] }),
  },
  {
    name: "Frame Grid · Light A4 markers", desc: "One animation frame per A4 sheet, with six-stroke Light outlines and printed frame numbers. Select Frame Grid, set ANIMATE → Frames to 24, then export all frames. In Liike choose Whole sheets, Light outlines, A4 landscape, Custom 1 × 1, Margin 30, Gap 0, Clearance 0, Marker size 8 and Total frames 24. The square with an X is top-left. Cell frames and Corner dots are not needed. Keep markers clear of artwork; photograph all four completely.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "murmuration", x: 20, y: 20, params: { ...defaults("murmuration"), behaviour: "Reindeer herd", clock: "Timeline", birds: 120, spread: 42, travel: 0.85, scatter: 4 } },
      { id: 9002, type: "frame_grid", x: 370, y: 20, params: { ...defaults("frame_grid"), total: 24, layout: "Custom", cols: 1, rows: 1, gap: 0, markerStyle: "Light outlines", markSize: 8, numbers: "On" } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Murmuration · Reindeer migration", desc: "A ground herd follows a winding route with delayed followers and local neighbour avoidance. Select Murmuration, set ANIMATE → Frames to 36 and press Play. Time source → Timeline follows the app directly, with no duplicate endpoint. Animal mark chooses Point, Circle or Dash; dashes face the direction of motion. Preferred spacing is a soft target, so very crowded herds may overlap. Keep Seed fixed when exporting frames.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "murmuration", x: 30, y: 20, params: { ...defaults("murmuration"), behaviour: "Reindeer herd", clock: "Timeline", herdMotion: "Migration", herdMark: "Dash", birds: 220, spread: 42, travel: 0.85, scatter: 4 } }], edges: [] }),
  },
  {
    name: "Murmuration · Circling reindeer", desc: "Small circles move around an elliptical herd in different lanes, with waves of compression and local spacing. Set 24, 36 or 48 frames and press Play. Circle marks are real closed outlines, not a screen-only fill. Neighbour avoidance reduces crowding; Group radius and Animals control density. Timeline uses frame index / frame count, and scrubbing or exporting in a different order produces the same animals.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "murmuration", x: 30, y: 20, params: { ...defaults("murmuration"), behaviour: "Reindeer herd", clock: "Timeline", herdMotion: "Milling", herdMark: "Circle", birds: 260, spread: 58, travel: 0.25, spacing: 3, size: 1.3 } }], edges: [] }),
  },
  {
    name: "Murmuration · Gather and roam", desc: "Tiny pen marks gather into a compact herd, open out and travel again. Set 36 frames and press Play. Pulse controls gathering, Travel range changes the shared route, and Scatter adds individual drift. Points are short physical strokes that export to SVG and G-code. To drive the loop with green wires, choose Manual and connect Frame rot ° through Math ÷ 360 to Time.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "murmuration", x: 30, y: 20, params: { ...defaults("murmuration"), behaviour: "Reindeer herd", clock: "Timeline", herdMotion: "Gather & roam", herdMark: "Point", birds: 220, spread: 48, pulse: 1, scatter: 3, travel: 0.7 } }], edges: [] }),
  },
  {
    name: "Ribbon · Organic pleats", desc: "A soft ribbon swells into broad pleats and narrows into dark seams. Shape → Organic, form → Pleated. Fold turns rotates the sheet edge-on; Flares changes the swell pattern. Width variation and Fine tails pinch it to thin ends, while Edge ripple adds a shared waviness. Every filament is a continuous pen stroke; crossings overprint.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Organic", width: 160, lines: 38, widthVar: 0.65, wander: 55, twist: 0.75, ripple: 1.4, bends: 2.5, flares: 4 } }], edges: [] }),
  },
  {
    name: "Ribbon · Open channels", desc: "Parallel filaments bend around four empty pockets. Shape → Organic, form → Channels. Pockets and Pocket size control the openings; Pocket fill → Open leaves only the surrounding lines. Bends steers the route, Flares shapes the swells, and Width variation makes narrow waists. The whole band fits the page margins.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Organic", organicForm: "Channels", width: 130, lines: 32, widthVar: 0.65, wander: 70, ripple: 1.5, bends: 2, pockets: 4, pocketSize: 0.75 } }], edges: [] }),
  },
  {
    name: "Ribbon · Ink pockets", desc: "Flowing lines surround dark islands. Pocket fill → Hatch draws their interiors with real pen strokes; Pocket pitch is the physical spacing in millimetres. Use a matching nib for a solid-looking fill, or choose Outline for lighter pockets. There are no screen-only black fills. Changing Colours assigns up to six selected pens across the ribbon.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Organic", organicForm: "Channels", width: 130, lines: 36, widthVar: 0.8, wander: 60, ripple: 1.5, bends: 2, pockets: 3, pocketSize: 0.75, pocketFill: "Hatch", pocketPitch: 0.3, seed: 18 } }], edges: [] }),
  },
  {
    name: "Ribbon · Six ink pleats", desc: "Sixty continuous filaments make a folded ribbon in six selected inks. Change the pen choices without changing the geometry. Fold turns controls the pinched crossings, Rotate turns the complete drawing, and Width mm sets the band width before any shrink needed to fit the page. Ink mixing at crossings depends on the pens and paper.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Organic", width: 160, lines: 60, widthVar: 0.55, wander: 55, twist: 1.15, ripple: 1.4, bends: 2.5, flares: 5, colours: 6, seed: 18 } }], edges: [] }),
  },
  {
    name: "Shan Shui · River valley", desc: "A mountain-and-water landscape built with adapted shan-shui-inf geometry by Lingdong Huang. Fine lines makes delicate pen strokes; Hidden lines removes geometry behind the mountains. Try Seed, Relief, Trees and Texture to change the scenery. Buildings adds pagodas and Boats adds fishing boats. A3 landscape, one black pen.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "shan_shui", x: 30, y: 20, params: { ...defaults("shan_shui") } }], edges: [] }),
  },
  {
    name: "Shan Shui · Islands in six inks", desc: "Low shores, trees, pagodas and boats in six selected inks. Pens follow land, distant peaks, trees, buildings, water and boats; fewer colours cycle those categories through the selected pens. Change colours without changing the drawing. Turning a feature off can also remove its pen group. Hidden lines keeps the landscape layered even in SVG or G-code.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "shan_shui", x: 30, y: 20, params: { ...defaults("shan_shui"), layout: "Islands", seed: 27, mountains: 5, colours: 6, trees: 55, buildings: 2, boats: 2 } }], edges: [] }),
  },
  {
    name: "Shan Shui · Brush outlines", desc: "The boundaries of the original variable-width brush marks become real closed pen paths. Compare Lines → Fine lines for lighter, faster plotting. Texture controls rock strokes and Trees controls vegetation. The drawing has no solid washes or paper texture: every visible mark is a pen route. Start with a fine nib.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "shan_shui", x: 30, y: 20, params: { ...defaults("shan_shui"), lines: "Brush outlines", texture: 20, trees: 25 } }], edges: [] }),
  },
  {
    name: "Primitive Image · Geometric portrait", desc: "Choose a photo on Primitive Image. The optimiser tries triangles and refines the ones that reduce image error. Tone hatch converts each fitted tone into actual pen strokes. Start with 150 shapes and a 0.3 mm pen; use Search, Shape scale and Seed for different interpretations. Reveal shows the drawing building up. All fitting happens locally.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "primitive_image", x: 30, y: 20, params: { ...defaults("primitive_image") } }], edges: [] }),
  },
  {
    name: "Primitive Image · Six-ink mosaic", desc: "Choose a colourful photo. Mixed searches triangles, rectangles, ellipses and circles using six selected pen colours. The optimiser may use fewer than six if some inks do not improve the image. Overlaps darken white paper through real strokes. Try Cross hatch or Outlines, which is a geometric interpretation without tonal fills. Changing pen colours can change the fitted shapes.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "primitive_image", x: 30, y: 20, params: { ...defaults("primitive_image"), shape: "Mixed", count: 180, colours: 6 } }], edges: [] }),
  },
  {
    name: "Image · Rams contour", desc: "Choose a well-lit portrait on Image. Rams contour makes long parallel lines that bend around tonal features. Cell / spacing sets the line spacing; Contour depth and Strength set the relief. Contour smoothing softens detail, Contour angle turns the strokes, and White cutoff clears light areas. Use a plain light background; this mode does not remove backgrounds automatically. One selected pen, A3 portrait.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "image", x: 30, y: 20, params: { ...defaults("image"), source: "Image (file)", mode: "Rams contour", cell: 1.7, gamma: 1.15, strength: 0.8, ramsDepth: 14, ramsSmooth: 1.2 } }], edges: [] }),
  },
  {
    name: "Image · Drawing contours", desc: "A blue Lissajous wire supplies Image’s Drawing input. Rams contour turns the thickened curve into a line relief. Keep white background shows the surrounding field; turn it off to retain only the source marks. Change the Lissajous frequencies, Drawing stroke mm, Contour depth and angle to reshape the result. No image file needed.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "lissajous", x: 30, y: 20, params: { ...defaults("lissajous"), fx: 3, fy: 4, turns: 1, margin: 26, layer: 0 } },
      { id: 9002, type: "image", x: 350, y: 20, params: { ...defaults("image"), source: "Auto", mode: "Rams contour", cell: 1.8, drawingWidth: 6, strength: 0.8, ramsDepth: 10, ramsSmooth: 1.5, ramsWhite: true, ramsAngle: 20 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }] }),
  },
  {
    name: "Grid Hairs · Crosshatch", desc: "Small crossed strokes in square cells. Cell width and Cell height set the physical grid; Lines per cell sets density. Try Direction scatter and Length variation for a looser surface. Cell gap separates the groups. Seed repeats the same drawing.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "grid_hairs", x: 30, y: 20, params: { ...defaults("grid_hairs"), ...{} } }], edges: [] }),
  },
  {
    name: "Grid Hairs · Tufts", desc: "Parallel bundles in tall cells, with actual grey grid lines. Draw grid can be switched off; selected-node guides never export. Change Cell width and Cell height independently, or use Bend to curve the hairs.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "grid_hairs", x: 30, y: 20, params: { ...defaults("grid_hairs"), ...{"pattern": "Tufts", "cellW": 12, "cellH": 20, "count": 12, "densityVar": 0.15, "length": 150, "scatter": 8, "gap": 2, "drawGrid": true, "seed": 17} } }], edges: [] }),
  },
  {
    name: "Grid Hairs · Scatter", desc: "Freely turned strokes remain inside each square cell. Density variation mixes dense and sparse groups; Cell gap reveals the grid through white space. Length is a percentage of the smaller cell dimension.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "grid_hairs", x: 30, y: 20, params: { ...defaults("grid_hairs"), ...{"pattern": "Scatter", "cellW": 16, "cellH": 16, "count": 15, "densityVar": 0.6, "length": 100, "gap": 2, "seed": 53} } }], edges: [] }),
  },
  {
    name: "Grid Hairs · Flow", desc: "Six pens follow a flowing direction field, one pen per cell. Flow size sets how many cells share a broad turn; Bend curves the hairs. Colours changes only the selected pens, keeping the geometry. All hairs stay inside their own cells.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "grid_hairs", x: 30, y: 20, params: { ...defaults("grid_hairs"), ...{"pattern": "Flow", "cellW": 10, "cellH": 10, "count": 10, "scatter": 9, "bend": 0.65, "gap": 1, "colours": 6, "layer": 5, "pen2": 7, "pen3": 6, "pen4": 4, "pen5": 10, "pen6": 0, "seed": 28} } }], edges: [] }),
  },
  {
    name: "Colour Scribble · Knot", desc: "A compact tangle of six coloured inks. Gesture mixes straight hatching and curved bundles. Try Spread, Size variation and Disorder to open up or loosen the knot. Lines per bundle changes density. Colours 1 makes the same drawing monochrome. All marks are real pen paths.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "colour_scribble", x: 30, y: 20, params: { ...defaults("colour_scribble"), ...{"layout": "Knot", "gesture": "Mixed", "bundles": 110, "density": 13, "length": 32, "width": 10, "spread": 0.65, "variation": 0.65, "disorder": 0.55, "curve": 0.45, "threads": 0.2, "rotation": 0, "cx": 50, "cy": 50, "margin": 10, "seed": 41, "colours": 6, "layer": 1, "pen2": 7, "pen3": 6, "pen4": 4, "pen5": 5, "pen6": 10} } }], edges: [] }),
  },
  {
    name: "Colour Scribble · Burst", desc: "Curved bundles escape from a loose centre. Length sets the size of the marks in millimetres; Curvature bends them, and Loose threads adds longer wandering strokes. Try a fine pen and lower Density for more white space.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "colour_scribble", x: 30, y: 20, params: { ...defaults("colour_scribble"), ...{"layout": "Burst", "gesture": "Arcs", "bundles": 100, "density": 6, "length": 48, "width": 5, "spread": 0.85, "variation": 0.65, "disorder": 0.35, "curve": 0.75, "threads": 0.35, "rotation": 0, "cx": 50, "cy": 50, "margin": 10, "seed": 19, "colours": 6, "layer": 1, "pen2": 7, "pen3": 6, "pen4": 4, "pen5": 5, "pen6": 10} } }], edges: [] }),
  },
  {
    name: "Colour Scribble · River", desc: "Colourful hatching bundles form a winding stream. Composition River sets the route, Rotation turns it, and Spread opens it across the paper. The six selectable pens are assigned to whole bundles without changing geometry.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "colour_scribble", x: 30, y: 20, params: { ...defaults("colour_scribble"), ...{"layout": "River", "gesture": "Mixed", "bundles": 170, "density": 15, "length": 29, "width": 10, "spread": 0.9, "variation": 0.65, "disorder": 0.55, "curve": 0.25, "threads": 0.05, "rotation": -12, "cx": 50, "cy": 50, "margin": 10, "seed": 13, "colours": 6, "layer": 1, "pen2": 7, "pen3": 6, "pen4": 4, "pen5": 5, "pen6": 10} } }], edges: [] }),
  },
  {
    name: "Colour Scribble · Islands", desc: "Scattered islands of coloured hatching with angular threads between the dense patches. Seed rebuilds the islands, Size variation mixes small and large marks, and Loose threads controls the roaming lines. All strokes are clipped to Margin.",
    canvas: { W: 420, H: 297 },
    make: defaults => ({ nodes: [{ id: 9001, type: "colour_scribble", x: 30, y: 20, params: { ...defaults("colour_scribble"), ...{"layout": "Islands", "gesture": "Hatching", "bundles": 135, "density": 13, "length": 24, "width": 9, "spread": 0.95, "variation": 0.65, "disorder": 0.55, "curve": 0.45, "threads": 0.6, "rotation": 0, "cx": 50, "cy": 50, "margin": 10, "seed": 31, "colours": 6, "layer": 1, "pen2": 7, "pen3": 6, "pen4": 4, "pen5": 5, "pen6": 10} } }], edges: [] }),
  },
  {
    name: "Portrait · String art", desc: "Choose an image on Portrait and use Mode → String art. One continuous thread runs between Nails arranged on a circle. Nails changes the number of anchors; Thread lines sets the maximum number of straight chords. The photo is centre-cropped to the circle. Start with a close portrait and a light background. No face analysis is needed. Pen width and Ink strength tune the simulated thread darkness; Gamma and White cutoff adjust the photo. Nail markers are guides, and the plain output plots without lifts between chords.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "portrait", x: 30, y: 20, params: { ...defaults("portrait"), mode: "String art", stringNails: 250, stringLines: 6000, stringWidth: 0.035 } }], edges: [] }),
  },
  {
    name: "Portrait · Continuous scribble", desc: "Choose image on the Portrait node, then keep Mode → Scribble. One continuous line builds the darks with irregular loops; no Analyze face step is needed. Start with a close crop and a light, plain background. Scribble density adds ink, Loop size changes the gesture, Wander loosens it, and Feature contrast opens the light areas. Pen width should match your pen. White cutoff suppresses loops, but the connecting line can cross white areas. A3 portrait, one pen.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "portrait", x: 30, y: 20, params: { ...defaults("portrait"), mode: "Scribble", scribbleSize: 2.4, scribbleDensity: 1.1, scribbleWander: 0.25, scribbleFeatures: 0.7, detail: 0.8, penW: 0.3, gamma: 1.05 } }], edges: [] }),
  },
  {
    name: "Arc Mounds · Billows", desc: "An A3 field of soft, overlapping bodies made entirely from curved pen strokes. Size contrast mixes small and large forms. Body curves adds asymmetry and waists; Curve scale changes how broadly they bend. Foreground shapes hide the lines behind them. Arc pitch sets density; Seed changes the composition. No solid fills are plotted.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds") } }], edges: [] }),
  },
  {
    name: "Arc Mounds · Soft body", desc: "A single asymmetric form with fuller lobes and a narrower waist. Body curves 0 restores the smooth oval. Try Curve scale, Fullness, Tilt and Arc flow to reshape the silhouette and its curved ribs. Every line is a real plotter stroke.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds"), layout: "Single", size: 260, fullness: 1.15, flow: 36, tilt: 15, bodyCurves: 0.9, curveScale: 260 } }], edges: [] }),
  },
  {
    name: "Arc Mounds · Three inks", desc: "The same soft field drawn with purple, magenta and teal. Colours assigns pens to whole forms and keeps all geometry unchanged. Select each pen on the node. Increase Size contrast for tiny shapes against broad curves; Arc pitch controls how much linework is drawn.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds"), colours: 3, layer: 5, pen2: 7, pen3: 6 } }], edges: [] }),
  },
  {
    name: "Arc Mounds · Rolls", desc: "Long, round-ended rolls with curved ribs across their bodies. Form → Rolls keeps the original Soft bodies option available. Body curves and Curve scale bend the tubes; Fullness changes their thickness. Use Single to isolate a roll, or Colours for up to six whole-body pens.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds"), form: "Rolls", size: 240, fullness: 1, tilt: 16, sizeContrast: 0.65, bodyCurves: 0.9, curveScale: 260, pitch: 1.8, flow: 35 } }], edges: [] }),
  },
  {
    name: "Ribbon · No crossings", desc: "An open six-colour sharp ribbon with mixed left and right turns that avoids itself. Angular layout → No crossings checks the full band width, including the corners. Clearance mm adds space between separate spans. Seed finds a new route; Turns is a maximum, so a wide band or large gap may produce fewer turns. Width and clearance scale together if the composition needs to fit the page. Choose a gap suitable for your actual pen width.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "No crossings", seed: 27, turns: 9, clearance: 6, width: 28, pitch: 0.3, stripeGap: 0.5, colours: 6, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3, pen6: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Ribbon · Sharp stripes", desc: "An A3 ribbon with long straight spans, sharp corners and six selected pens. Shape → Angular, layout → Free folds. Change Seed for a new route, Turns for complexity, Width for the band, or Corners for sharp/bevel joins. Stripes uses real parallel strokes at Pen pitch; crossings overprint. Woven Ribbon is the separate over/under option.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "Free folds", seed: 27, turns: 9, width: 28, pitch: 0.3, stripeGap: 0.5, colours: 6, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3, pen6: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Ribbon · Sharp zigzag", desc: "Six colour bands follow a regular zigzag. Corners → Sharp, with Corner limit 8 for pointed joins. Use Bevel for short flat tips. Switch Angular fill to Lines for a sparse drawing, or lower Colours for fewer pens. The complete band shrinks only if needed to fit the page margins.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "Zigzag", turns: 4, width: 24, miterLimit: 8, pitch: 0.3, stripeGap: 0.5, colours: 6, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3, pen6: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Ribbon · Star loop", desc: "A closed five-point star drawn as parallel colour stripes. Every filament is a closed pen stroke. Star points changes the polygon, Rotate turns the composition, and Stripe gap separates the colour bands. Crossings keep every stroke; use Woven Ribbon when you want actual underpass gaps.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "Star", starPoints: 5, width: 25, rotate: 18, miterLimit: 4, pitch: 0.3, stripeGap: 0.5, colours: 5, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Zoom letter", desc: "One N grows into a large N made from many small Ns. Their physical size stays at 5 mm. Press Play in ANIMATE (try 48 frames), or use Phase input: 0 is one letter, 0.5 is full zoom. Max rows sets the largest letter grid; Cell spacing changes the gaps. Try Zoom in or Zoom out for a one-way cycle. Each small letter is real plotter geometry.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), text: "N", motion: "Zoom", size: 5, zoomRows: 32, zoomSpacing: 1.25 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Zoom word", desc: "ZOOM grows from four small letters into a word built from fixed-size Zs, Os and Ms. Press Play in ANIMATE (try 48 frames). Each character is built from copies of itself; a | in Text starts another centred line. A longer phrase needs a smaller Max rows setting to stay on the page.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), text: "ZOOM", motion: "Zoom", size: 3, zoomRows: 12, zoomSpacing: 1.2 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Shift field", desc: "A full field of letter cells stays in place while their order changes. Press Play in ANIMATE (try 36 frames). Shift pattern → Rows cycles each row, Columns cycles vertically, Shuffle rearranges the same letters with Seed. Spaces are omitted to keep the field filled; Phase selects an exact permutation.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), mode: "Fill region", text: "WORDS KEEP CHANGING", size: 5, lineh: 1.1, motion: "Shift", shiftPattern: "Rows", rowLag: 0.02 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Living columns", desc: "Repeated phrases shorten to THU 1 OCT 26 and expand again. Select Concrete Poetry, set ANIMATE to 36 frames and press Play. Try the fourteen Motion modes; Phase input lets you scrub or wire Phase 0–1. Motion Off restores the still composition. SVG × frames exports the moving geometry as separate drawings.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), mode: "Columns", text: "THURSDAY 1 OCTOBER 2026", shortText: "THU 1 OCT 26", size: 4.5, lineh: 1.2, motion: "Word collapse", amount: 1, rowLag: 0.04 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Living waves", desc: "Real stroke letters ripple along repeated rows. Select Concrete Poetry and press Play in ANIMATE; 24–36 frames makes a smoother loop. Try Swarm, Letter flip or Typewriter, adjust Travel mm and the two lags, or pause to export a single drawing. Seed changes Swarm's scattering.",
    canvas: { W: 297, H: 210 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), mode: "Columns", columns: 1, align: "Centre", text: "WORDS IN MOTION", size: 10, lineh: 1.7, margin: 24, motion: "Wave", distance: 5, amount: 1, layer: 1, clip: false } }],
      edges: [],
    }),
  },
  {
    name: "Image · Drawing to blocks", desc: "A blue wire takes Lissajous into Image’s Drawing input. No photo needed: Square weave rebuilds the curve from filled squares. Try Organic dots or Short strokes, change the Lissajous frequencies, and use Drawing stroke mm to thicken the source interpretation. Source Auto follows the wire.",
    canvas: { W: 297, H: 210 },
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "lissajous", x: 30, y: 20, params: { ...defaults("lissajous"), fx: 3, fy: 4, turns: 1, margin: 26, layer: 0 } },
        { id: 9002, type: "image", x: 350, y: 20, params: { ...defaults("image"), source: "Auto", mode: "Square weave", cell: 1.8, drawingWidth: 3, strength: 1, gamma: 0.8, jitter: 0, pitch: 0.25 } },
      ],
      edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }],
    }),
  },
  {
    name: "Image · Square weave", desc: "Choose your photo on Image. Staggered squares grow in darker regions; Hatch fill draws their interiors as real pen strokes. Jitter 0 keeps regular rows. Try Woven fill, Outline, an aligned Grid or Colours 6 with Tone bands.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "image", x: 30, y: 20, params: { ...defaults("image"), mode: "Square weave", cell: 3.2, strength: 1, gamma: 1.25, jitter: 0, pitch: 0.25 } }],
      edges: [],
    }),
  },
  {
    name: "Image · Organic dots", desc: "Choose your photo on the Image node. Organic dots turns its tones into filled circles. Try Dot fill → Outline, or Colours → 6 with Tone bands for a colourful print. A4 portrait with 12 mm margins.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "image", x: 30, y: 20, params: { ...defaults("image"), mode: "Organic dots", cell: 2.2, strength: 1, gamma: 1.4, jitter: 0.35 } }],
      edges: [],
    }),
  },
  {
    name: "Image · Short strokes", desc: "Choose your photo on the Image node. Short strokes follows tonal edges; try Flow field or Fixed angle for a different texture. Shadow passes adds lines in dark areas. Colours can follow the source or your own tone palette.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "image", x: 30, y: 20, params: { ...defaults("image"), mode: "Short strokes", cell: 1.5, strength: 1, gamma: 1.1, flow: 1, pitch: 0.2, jitter: 0.2 } }],
      edges: [],
    }),
  },
  {
    name: "Coral · Brain study", desc: "An A3 coral medallion built from closed, winding contours. Three nested bands add line density. Try Form → Cells, change Seed, or set Colours to 6. Growth and Density take longer to recompute than colour or size.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "coral", x: 30, y: 20, params: { ...defaults("coral"), bands: 3 } }],
      edges: [],
    }),
  },
  {
    name: "Coral · Radial colours", desc: "Warped radial coral with a textured centre and teal, blue and ochre contour bands. Colours are assigned by each contour's average radius; all marks are real vector pen paths.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "coral", x: 30, y: 20, params: { ...defaults("coral"), form: "Radial coral", bands: 3, colours: 3, colouring: "By radius", layer: 6, pen2: 1, pen3: 10, growth: 0.9, density: 18 } }],
      edges: [],
    }),
  },
  {
    name: "Reaction Labyrinth · One line", desc: "One uninterrupted field-guided line curls from the rim to the centre. Turns controls the number of coils, Meander their wiggle, and Evolution and Pattern scale change the underlying reaction-diffusion field. No pen lifts occur inside this drawing.",
    canvas: { W: 210, H: 210 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "reaction_labyrinth", x: 30, y: 20, params: { ...defaults("reaction_labyrinth"), mode: "Continuous path" } }],
      edges: [],
    }),
  },
  {
    name: "Reaction Labyrinth · Separate contours", desc: "The same seeded Gray-Scott growth is traced as many individual closed vector contours. Threshold changes which boundaries are followed; Contour bands adds nested lines. The pen lifts between separate loops.",
    canvas: { W: 210, H: 210 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "reaction_labyrinth", x: 30, y: 20, params: { ...defaults("reaction_labyrinth"), mode: "Separate contours" } }],
      edges: [],
    }),
  },
  {
    name: "Topology · Möbius one edge", desc: "Select Topology. The half-twisted band has one continuous boundary, drawn in blue. Switch Surface to Cylinder band to see its two separate boundaries. Half twists 1, 3 and 5 all keep the Möbius strip one-sided; Twist direction reverses its handedness. Drawing is a plotted grid, while the orange Mesh output is a real open triangle surface for Mesh Render.",
    canvas: { W: 210, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "topology", x: 30, y: 20, params: { ...defaults("topology"), shape: "Mobius strip" } },
    ], edges: [] }),
  },
  {
    name: "Topology · Möbius mesh render", desc: "Topology's orange Mesh output feeds Mesh Render. Select Mesh Render to switch between illustrated, contour, hatch and edge views with hidden surfaces. The Möbius sheet has one boundary and is open, so use it as an image surface rather than a solid slice. Change Topology Surface to Torus or Trefoil tube for closed meshes.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "topology", x: 20, y: 20, params: { ...defaults("topology"), shape: "Mobius strip" } },
      { id: 9002, type: "mesh_render", x: 370, y: 20, params: { ...defaults("mesh_render"), drawing: "Illustration", shadow: false, selfShadow: false, contours: 16, pitch: 2.2, detail: 80, size: 165 } },
    ], edges: [{ id: "e9101", from: 9001, fromPort: 2, to: 9002, toPort: 0 }] }),
  },
  {
    name: "Topology · Linked torus loops", desc: "Hopf link has two interlocked torus components, with no boundary. Torus is one ring; Trefoil tube is a single knotted ring; Klein bottle is a self-crossing one-sided immersion. Use the orange Mesh output with Mesh Render for shaded inspection, or keep the native plotted wire grid.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [
      { id: 9001, type: "topology", x: 30, y: 20, params: { ...defaults("topology"), shape: "Hopf link", viewAz: 15, viewEl: 50 } },
    ], edges: [] }),
  },
  {
    name: "Iris · Six colours", desc: "A3 iris with six separate pen layers: black, orange, blue, teal, purple and ochre. Colour mode → Six pens; choose each colour on the node and customise the inks in Pens.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "iris", x: 30, y: 20, params: { ...defaults("iris"), colours: "Six pens", layer: 0, innerPen: 4, accentPen: 1, midtonePen: 6, outerPen: 5, highlightPen: 10 } }],
      edges: [],
    }),
  },
  {
    name: "Iris · A3 study", desc: "A 277 mm iris on A3. Try Human, Cat, Goat or Gecko, or switch Centre to Centre rays. Three real pen layers: teal fibres, orange inner fibres, black accents.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "iris", x: 30, y: 20, params: { ...defaults("iris"), colours: "Three pens", layer: 6, innerPen: 4, accentPen: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Iris · 420 mm", desc: "A full 420 mm iris on a 440 × 440 mm sheet. Monochrome, 1,400 fibres and an open pupil. This circle is wider than the short side of A3; use a larger sheet or Mega Canvas.",
    canvas: { W: 440, H: 440 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "iris", x: 30, y: 20, params: { ...defaults("iris"), diameter: 420, fibres: 1400, pupilFill: "Open" } }],
      edges: [],
    }),
  },
  {
    name: "1 · Stamps", desc: "A yellow style wire (Dashed) feeds Tracks; Stamp rides the paths with triangles.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "viiva", x: 30, y: 20, params: { ...defaults("viiva"), dash: 24.5 } },
        { id: 9002, type: "radat", x: 340, y: 25, params: { ...defaults("radat"), rings: 30 } },
        { id: 9003, type: "stamp", x: 686, y: 38, params: { ...defaults("stamp"), spacing: 37, sizeMod: 1, pathVar: 0.6, motif: "Triangle", orientMode: "Along path", seed: 6727 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "2 · Seismic mountains", desc: "Mountains → Smear → Squiggle (Seismic): three modifiers become a new texture.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "mountains", x: 30, y: 20, params: { ...defaults("mountains"), rows: 53, height: 138 } },
        { id: 9002, type: "smear", x: 344, y: 93, params: { ...defaults("smear"), zx: 94, zw: 400, zh: 302, mode: "Horizontal" } },
        { id: 9003, type: "squiggle", x: 679, y: 126, params: { ...defaults("squiggle"), mode: "Seismic", amp: 0.5, levels: 3, seed: 6222 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "3 · Empty fill", desc: "Rippled terraces, then Empty Fill hatches the untouched paper with pen 4.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "parallel_lines", x: 30, y: 34, params: { ...defaults("parallel_lines"), spacing: 5, margin: 2, levels: 5, plateau: 58, relief: 0.67, fall: 1, mess: 1, layer: 7 } },
        { id: 9002, type: "ripple", x: 367, y: 20, params: { ...defaults("ripple"), waterline: 0.59, poolx: 28, poolw: 109, pooledge: 0.22, scale: 0.26, breakup: 0.31, stretch: 1.27, below: true, seed: 6635 } },
        { id: 9003, type: "empty_fill", x: 670, y: 131, params: { ...defaults("empty_fill"), pattern: "Hatch", gap: 6.2, angle: 38, seed: 9518, pen: 4 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "4 · Contours", desc: "One Voronoi, two treatments: SDF Contours and Mycelium Fill share the source.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "voronoi", x: 30, y: 52, params: defaults("voronoi") },
        { id: 9002, type: "sdfcontours", x: 393, y: 20, params: defaults("sdfcontours") },
        { id: 9003, type: "myceliumfill", x: 696, y: 263, params: { ...defaults("myceliumfill"), strands: 4, width: 10.5, boost: 0.2 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "5 · Potato ASCII", desc: "Potatoes rasterized into ASCII characters, then roughened by Hand Drawn.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "potato", x: 30, y: 20, params: { ...defaults("potato"), count: 14, eyes: "None" } },
        { id: 9002, type: "asciiart", x: 383, y: 47, params: { ...defaults("asciiart"), ramp: "Custom", rampCustom: ".oO0ÖCD" } },
        { id: 9003, type: "handdrawn", x: 720, y: 99, params: { ...defaults("handdrawn"), wobble: 3.7, waveLen: 87, tremor: 1.05 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "6 · Ribbon mosaic", desc: "Ribbon shattered by Cellular Mosaic, recolored with Set Pen, merged over the original.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), wander: 120, width: 55.5, widthVar: 1, margin: 23 } },
        { id: 9002, type: "cellular_mosaic", x: 336, y: 129, params: { ...defaults("cellular_mosaic"), scale: 10.5 } },
        { id: 9003, type: "setpen", x: 639, y: 438, params: { ...defaults("setpen"), layer: 7 } },
        { id: 9004, type: "merge", x: 934, y: 54, params: defaults("merge") },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
        { id: "e9103", from: 9001, fromPort: 0, to: 9004, toPort: 0 },
        { id: "e9104", from: 9003, fromPort: 0, to: 9004, toPort: 1 },
      ],
    }),
  },
  {
    name: "7 · Nature", desc: "Wood rings + spore print; Negative Space fills the background with Caustics.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "wood", x: 30, y: 20, params: { ...defaults("wood"), rings: 24, cx: 82, cy: 72 } },
        { id: 9002, type: "spore_print", x: 304, y: 110, params: { ...defaults("spore_print"), cx: 69 } },
        { id: 9003, type: "merge", x: 610, y: 182, params: defaults("merge") },
        { id: 9004, type: "caustics", x: 596, y: 529, params: defaults("caustics") },
        { id: 9005, type: "negspace", x: 899, y: 434, params: defaults("negspace") },
        { id: 9006, type: "merge", x: 1205, y: 219, params: defaults("merge") },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
        { id: "e9102", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
        { id: "e9103", from: 9003, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9104", from: 9004, fromPort: 0, to: 9005, toPort: 1 },
        { id: "e9105", from: 9003, fromPort: 0, to: 9006, toPort: 0 },
        { id: "e9106", from: 9005, fromPort: 0, to: 9006, toPort: 1 },
      ],
    }),
  },
  {
    name: "8 · Pebble", desc: "One Pebble, two fates: a contour halo and a glitched, shrunken pen-7 shadow.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "merge", x: 940, y: 48, params: defaults("merge") },
        { id: 9002, type: "setpen", x: 937, y: 460, params: { ...defaults("setpen"), from: 7, layer: 7 } },
        { id: 9003, type: "pebble", x: 30, y: 20, params: { ...defaults("pebble"), mode: "Mesh", angular: 0, facets: 19, detail: 0, rx: -41 } },
        { id: 9004, type: "move_scale", x: 638, y: 582, params: { ...defaults("move_scale"), dx: -5.5, dy: 2, scale: 33 } },
        { id: 9005, type: "glitch", x: 325, y: 150, params: defaults("glitch") },
        { id: 9006, type: "sdfcontours", x: 634, y: 20, params: { ...defaults("sdfcontours"), start: 11, step: 5.5, count: 8 } },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9001, toPort: 1 },
        { id: "e9102", from: 9004, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9103", from: 9005, fromPort: 0, to: 9004, toPort: 0 },
        { id: "e9104", from: 9003, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9105", from: 9006, fromPort: 0, to: 9001, toPort: 0 },
        { id: "e9106", from: 9003, fromPort: 0, to: 9006, toPort: 0 },
      ],
    }),
  },
  {
    name: "9 · Move & rotate", desc: "Two laser floors — one rotated — pushed apart by Move/Scale; a sphere floats between.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "retromesh", x: 41, y: 20, params: { ...defaults("retromesh"), mode: "Laser floor", size: 188, spokes: 12, throat: 0.68, persp: 0.54, terrain: 0.54, horizon: false, rx: -24, ry: 2 } },
        { id: 9002, type: "solids", x: 694, y: 51, params: { ...defaults("solids"), size: 43, rx: -48, ry: -3, rz: -31, persp: 0.1, lat: 14, px: 142, py: 101, layer: 2 } },
        { id: 9003, type: "merge", x: 1291, y: 22, params: { ...defaults("merge"), count: 3 } },
        { id: 9004, type: "retromesh", x: 30, y: 833, params: { ...defaults("retromesh"), mode: "Laser floor", size: 188, spokes: 12, throat: 0.68, persp: 0.54, terrain: 0.54, horizon: false, rx: -24, ry: 2, seed: 572 } },
        { id: 9005, type: "kierto", x: 346, y: 831, params: { ...defaults("kierto"), deg: -180 } },
        { id: 9006, type: "move_scale", x: 698, y: 803, params: { ...defaults("move_scale"), dx: -16, dy: -59.5 } },
        { id: 9007, type: "move_scale", x: 332, y: 96, params: { ...defaults("move_scale"), dx: 12.5, dy: 60.5 } },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
        { id: "e9102", from: 9004, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9103", from: 9005, fromPort: 0, to: 9006, toPort: 0 },
        { id: "e9104", from: 9006, fromPort: 0, to: 9003, toPort: 2 },
        { id: "e9105", from: 9001, fromPort: 0, to: 9007, toPort: 0 },
        { id: "e9106", from: 9007, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "10 \u00B7 Animation", desc: "Frame spins a solid over a static background. Press \u25B6 in ANIMATE.",
    make: (defaults) => {
      const so = defaults("solids"), ma = defaults("matem");
      so.shape = "Icosahedron"; so.size = 90;
      ma.op = "A \u00D7 B"; ma.b = 15;
      return {
        nodes: [
          { id: 9001, type: "frame", x: 30, y: 40, params: defaults("frame") },
          { id: 9002, type: "matem", x: 250, y: 40, params: ma },
          { id: 9003, type: "solids", x: 470, y: 120, params: so },
          { id: 9004, type: "mountains", x: 30, y: 330, params: defaults("mountains") },
          { id: 9005, type: "merge", x: 760, y: 200, params: defaults("merge") },
        ],
        edges: [
          { id: "e9101", from: 9001, fromPort: 1, to: 9002, toPort: 0 },
          { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: "p:ry" },
          { id: "e9103", from: 9004, fromPort: 0, to: 9005, toPort: 0 },
          { id: "e9104", from: 9003, fromPort: 0, to: 9005, toPort: 1 },
        ],
      };
    },
  },
  {
    name: "Tick Grid · Free chaos", desc: "Everything at its defaults: about six in ten lattice nodes hold one small bent tick, each turned freely. Every mark is its own seeded decision - press Seed for a different drawing, or raise Cell for bigger calmer spaces.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "tick_grid", x: 30, y: 20, params: { ...defaults("tick_grid"), ...{} } }], edges: [] }),
  },
  {
    name: "Tick Grid · Constellation", desc: "Density under ten percent leaves a handful of floating marks, a few of them in the accent pen. Raise Length variation and Jitter to loosen the field further, or drop Jitter to zero to snap the survivors back onto the lattice.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "tick_grid", x: 30, y: 20, params: { ...defaults("tick_grid"), ...{"cell": 14, "density": 0.09, "length": 70, "lengthVar": 0.6, "angle": 0, "scatter": 90, "jitter": 0.5, "bend": 0.35, "accent": 12, "pen2": 9, "seed": 5} } }], edges: [] }),
  },
  {
    name: "Tick Grid · Column drift", desc: "Angle 90° with a small scatter keeps every tick close to vertical, so the sheet reads as columns that slowly lean. Raise Angle scatter to dissolve the columns into free chaos, or set Angle to 0 for rows.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "tick_grid", x: 30, y: 20, params: { ...defaults("tick_grid"), ...{"cell": 8, "density": 0.5, "length": 55, "lengthVar": 0.4, "angle": 90, "scatter": 20, "jitter": 0.35, "bend": 0.1, "seed": 5} } }], edges: [] }),
  },
  {
    name: "Tick Grid · Dense field", desc: "Cell 6 mm at full density: thousands of small ticks weave into a textured surface while the lattice beneath still shows through. A share of eight percent takes the accent pen; lower Bend for straighter, quieter marks.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "tick_grid", x: 30, y: 20, params: { ...defaults("tick_grid"), ...{"cell": 6, "density": 1, "length": 65, "lengthVar": 0.35, "angle": 0, "scatter": 100, "jitter": 0.4, "bend": 0.4, "margin": 10, "accent": 8, "pen2": 9, "seed": 5} } }], edges: [] }),
  },

  ...[
    { name: "Rosette plate", params: { mode: "Rosette", waves: 96, copies: 40, amplitude: 0.35, growth: 0.004, jitter: 0.25, accent: 30, seed: 11 } },
    { name: "Weave lattice", params: { mode: "Weave", waves: 48, copies: 36, amplitude: 0.3, growth: 0.006, jitter: 0.3, seed: 23 } },
    { name: "Seal rings", params: { mode: "Rings", waves: 160, copies: 28, amplitude: 0.22, growth: 0.02, jitter: 0.2, accent: 100, pen2: 2, seed: 5 } },
  ].map(p => ({
    name: "Guilloché · " + p.name,
    desc: "Select Guilloché, the banknote fine-line generator: " + p.params.mode + " draws its whole family with one node. Waves sets the lobe count, Copies the family size, Amplitude the wave depth and Growth the radial step between successive copies. Jitter adds the seeded hand-cut wobble that separates these sheets from machined engraving, and Angle rotates the whole family. Raise Accent to draw part of the family in the second pen, as banknotes often run a faint underlayer beneath the dark plate. The family centres on the sheet inside Margin and clips to the paper edge; under the point budget it thins sampling rather than cutting the drawing, so exports stay complete. Try the other four styles (Rosette, Rings, Fan, Weave, Spiral) in the Mode dropdown, then export SVG or G-code; chain into Brush or Warp downstream.",
    canvas: p.canvas || { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "guilloche", x: 40, y: 30, params: { ...defaults("guilloche"), ...p.params } }], edges: [] })
  })),

  ...[
    { name: "Rosette field", params: { mode: "Guilloché", gStyle: "Rosette", gWaves: 72, gCopies: 18, gAmp: 0.2, gGrowth: 0.014, gJit: 0.35, gSize: 200, gOver: 0.5, gFill: 1, gAngle: 12, margin: 0, seed: 21 } },
    { name: "Fan underprint", params: { mode: "Guilloché", gStyle: "Fan", gWaves: 16, gCopies: 26, gAmp: 0.3, gGrowth: 0.02, gJit: 0.8, gSize: 240, gOver: 0.55, gFill: 1, gAngle: 25, gAccent: 40, pen2: 2, margin: 0, seed: 8 } },
  ].map(p => ({
    name: "BG Fill · " + p.name,
    desc: "Select Guilloché in BG Fill to lay identical banknote plates edge to edge across the whole sheet: unlike one centred plate, the staggered lattice tiles every corner, and with Margin at zero the fine lines reach the paper edge. Motif size and Overlap set how often each plate repeats; Waves, Copies, Amplitude, Growth and Jitter shape each motif exactly like the Guilloché generator; Fill keeps every plate a complete bullseye so no millimetre of sheet stays blank, and Angle rotates the whole lattice with its seeded drift. Wire any path into Void to carve it out of the field, and raise Accent to run part of every plate in a second pen - banknotes often print a faint underlayer beneath the dark design. Layer it under Scanner or Portrait output, then export SVG or G-code.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "bg_fill", x: 40, y: 30, params: { ...defaults("bg_fill"), ...p.params } }], edges: [] })
  })),

  {
    name: "Bust · Ink study", desc: "Select Bust, the nude figure study: Form picks Female or Male, each drawn as one smooth designed silhouette - broad shoulders, a neck scoop, chest mounds, an S-curve waist and flared hips, cut by Crop into a flat hem. Wobble at zero is a glass-smooth edge made for broad ink; raise it to 8-15 for a hand-cut frilled line. Size sets the figure height in millimetres and the whole drawing auto-fits inside Margin. Press Seed for a different body.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "bust", x: 40, y: 30, params: { ...defaults("bust"), ...{ form: "Female", style: "Outline", seed: 7, size: 190 } } }], edges: [] }),
  },
  {
    name: "Bust · Banknote rosette", desc: "Rosette clips counter-rotated banknote circle families into the form, twin petals around the areola focus - the look of money guilloché drawn on a single figure. The outline runs in the Pen, the rosette families in the Detail pen (here a faint gray underlayer, as banknotes print). Raise Rosette orbit to push the circle rings toward the hem, and Petal size for coarser engraving.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "bust", x: 40, y: 30, params: { ...defaults("bust"), ...{ form: "Female", style: "Rosette", seed: 5, size: 170, rPetals: 22, rOrbit: 0.34, rPetalR: 0.6, penDetail: 9 } } }], edges: [] }),
  },
  {
    name: "Bust · Crosshatched pair", desc: "Layout Pair places two facing studies; Asymmetry breaks the mirror so the bodies differ in size, tilt and rise while the seeds keep them related. Crosshatch sweeps two off-centre fan families across the form in the Detail pen, hatch pitch below one millimetre reads as engraving with a 0.35 mm technical pen. Overlap sets how close the pair stands.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "bust", x: 40, y: 30, params: { ...defaults("bust"), ...{ form: "Male", style: "Crosshatch", seed: 3, size: 120, hSpacing: 0.9, hLift: 4, layout: "Pair", overlap: 10, asym: 40, penDetail: 1 } } }], edges: [] }),
  },
  {
    name: "Bust · Stipple stack", desc: "Stipple seeds dots denser toward the shaded lower hemisphere - Shade bias pushes the darkness down, Dot gap sets the field density. Layout Stacked rises top over bottom, like a pair of studies on one sheet; Asymmetry gives the two bodies their own size and lean. Wobble at 8 keeps the edge alive while the dot work stays crisp.",
    canvas: { W: 297, H: 210 },
    make: defaults => ({ nodes: [{ id: 9001, type: "bust", x: 40, y: 30, params: { ...defaults("bust"), ...{ form: "Female", style: "Stipple", seed: 11, size: 100, wobble: 8, sDots: 1200, sGap: 0.8, sDotR: 0.3, sBias: 0.7, layout: "Stacked", asym: 25 } } }], edges: [] }),
  },
];
