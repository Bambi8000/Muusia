export const PEN_COLORS = [
  "#d6d9de", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#3b82f6", "#a855f7", "#ec4899", "#92400e", "#64748b",
];

export const KNOWN_MACROS = new Set([
  "CLEAR_PAUSE", "PLOT_HEIGHT", "RESPOND", "SAVE_GCODE_STATE",
  "RESTORE_GCODE_STATE", "PEN_UP", "PEN_DOWN", "MANUAL_STEPPER",
  "SET_PIN", "CANVAS_CHECK", "INK_DOSE", "AIR_PULSE",
]);

export function splitComment(raw) {
  const at = raw.indexOf(";");
  return at < 0
    ? { code: raw.trim(), comment: "" }
    : { code: raw.slice(0, at).trim(), comment: raw.slice(at + 1).trim() };
}

export function words(code) {
  const out = {};
  const re = /(?:^|\s)([A-Za-z])\s*=?\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))/g;
  let match;
  while ((match = re.exec(code))) out[match[1].toUpperCase()] = Number(match[2]);
  return out;
}

export function namedArgs(code) {
  const out = {};
  for (const match of code.matchAll(/(?:^|\s)([A-Za-z_][\w]*)=([^\s;]+)/g)) {
    out[match[1].toUpperCase()] = match[2];
  }
  return out;
}

export function classifyEventComment(comment) {
  if (/CHANGE\s+PEN\s*->/i.test(comment) || /TRAVEL STOP\s*[—-]\s*PEN CHANGE/i.test(comment)) return "pen-change";
  if (/TRAVEL STOP/i.test(comment)) return "pitstop";
  if (/MAINTENANCE/i.test(comment)) return "maintenance";
  if (/MAGNET\s+\d+\s*\//i.test(comment)) return "magnet";
  return "pause";
}

export function eventLabel(kind) {
  return ({
    "pen-change": "Pen change",
    pitstop: "Travel stop",
    maintenance: "Maintenance",
    magnet: "Magnet stop",
    dip: "Dip cycle",
    rotation: "Brush rotation",
    pin: "Pin event",
    dose: "Ink dose",
    air: "Air pulse",
    "canvas-check": "Canvas check",
    pause: "Pause",
  })[kind] || "Event";
}
