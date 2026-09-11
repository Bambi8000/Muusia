/** webm-muxer 5 records the last block's start as Duration. Include its display
 * interval by updating the existing Segment Info field after finalization. */
export function setWebmDuration(buffer: ArrayBuffer, seconds: number) {
  const data = new Uint8Array(buffer), view = new DataView(buffer);
  function vint(offset: number, id: boolean) {
    const first = data[offset];
    if (!first) throw new Error('Invalid WebM element.');
    let length = 1, mask = 128;
    while (!(first & mask) && length <= 8) { mask >>= 1; length++; }
    if (length > 8 || offset + length > data.length) throw new Error('Invalid WebM element size.');
    let value = id ? first : first & (mask - 1), unknown = !id && value === mask - 1;
    for (let i = 1; i < length; i++) { value = value * 256 + data[offset + i]!; unknown = unknown && data[offset + i] === 255; }
    return { length, value, unknown };
  }
  function elements(start: number, end: number) {
    const result: { id: number; start: number; end: number }[] = [];
    for (let offset = start; offset < end;) {
      const id = vint(offset, true), size = vint(offset + id.length, false);
      const body = offset + id.length + size.length, stop = size.unknown ? end : body + size.value;
      if (stop > end || stop < body) throw new Error('Invalid WebM element boundary.');
      result.push({ id: id.value, start: body, end: stop }); offset = stop;
    }
    return result;
  }
  const segment = elements(0, data.length).find(e => e.id === 0x18538067);
  const info = segment && elements(segment.start, segment.end).find(e => e.id === 0x1549a966);
  if (!info) throw new Error('The video duration could not be finalized.');
  const fields = elements(info.start, info.end), duration = fields.find(e => e.id === 0x4489), scale = fields.find(e => e.id === 0x2ad7b1);
  let nanoseconds = 1000000;
  if (scale) { nanoseconds = 0; for (let i = scale.start; i < scale.end; i++) nanoseconds = nanoseconds * 256 + data[i]!; }
  if (!duration || !nanoseconds || !Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid video duration.');
  const value = seconds * 1e9 / nanoseconds;
  if (duration.end - duration.start === 8) view.setFloat64(duration.start, value);
  else if (duration.end - duration.start === 4) view.setFloat32(duration.start, value);
  else throw new Error('Unsupported WebM duration field.');
}
