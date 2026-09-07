export function emitGcode(doc) {
  return doc.lines.map((line) => `${line.raw}${line.ending}`).join("");
}

export function formatNumber(value) {
  return String(Math.round(value * 100) / 100);
}
