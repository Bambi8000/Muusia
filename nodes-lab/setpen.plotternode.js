({
  key: "setpen",
  name: "Set Pen",
  cat: "mod",
  group: "penout",
  desc: "Recolors the input onto another pen. All moves everything to the target pen; Single remaps only one source pen and leaves the rest untouched - handy for swapping a single color in a multi-pen patch, or forcing any generator onto the pen you are about to load.",
  ins: [Pin("paths", "Paths")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Recolor", type: "select", options: ["All", "Single"], def: "All" },
    { key: "from", label: "From pen (Single)", type: "pen", def: 0 },
    { key: "layer", label: "To pen", type: "pen", def: 1 }
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const to = Math.round(p.layer);
    const from = Math.round(p.from);
    const all = p.mode === "All";
    return {
      paths: src.paths.map((pa) => ({
        ...pa,
        pts: pa.pts.map((q) => q.slice()),
        layer: all || pa.layer === from ? to : pa.layer
      }))
    };
  }
})
