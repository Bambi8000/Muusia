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
];
