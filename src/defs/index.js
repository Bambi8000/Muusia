/* Auto-assembled node registry (Era C0). Drop a node file into ./nodes to add it. */
import { withParameterVisibility } from "./parameter-visibility.js";
const mods = import.meta.glob("./nodes/*.js", { eager: true });
export const DEFS_NODES = {};
for (const p of Object.keys(mods).sort()) {
  const d = mods[p].default;
  DEFS_NODES[d.key] = withParameterVisibility(d);
}
