export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export type Matrix = [number, number, number, number, number, number, number, number, number];

/** Four-point DLT with h33 = 1, using photo_trace's y-down convention. */
export function solveHomography(source: Quad, destination: Quad): Matrix {
  if ([...source, ...destination].some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Marker coordinates must be finite.');
  // Normalize both sets around their centroids for stable elimination at full resolution.
  const normalize = (points: Quad) => {
    const x = points.reduce((sum, p) => sum + p.x, 0) / 4;
    const y = points.reduce((sum, p) => sum + p.y, 0) / 4;
    const scale = Math.sqrt(2) / (points.reduce((sum, p) => sum + Math.hypot(p.x - x, p.y - y), 0) / 4);
    if (!Number.isFinite(scale)) throw new Error('Place four distinct markers.');
    return { x, y, scale, points: points.map(p => ({ x: (p.x - x) * scale, y: (p.y - y) * scale })) };
  };
  const s = normalize(source), d = normalize(destination);
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = s.points[i]!, { x: u, y: v } = d.points[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    if (Math.abs(a[pivot]![col]!) < 1e-10) throw new Error('Markers are too close together or aligned. Spread them over the four corners.');
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const divisor = a[col]![col]!;
    for (let c = col; c < 9; c++) a[col]![c] = a[col]![c]! / divisor;
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = a[row]![col]!;
      for (let c = col; c < 9; c++) a[row]![c] = a[row]![c]! - factor * a[col]![c]!;
    }
  }
  const h = [...a.map(row => row[8]!), 1] as Matrix;
  const multiply = (l: Matrix, r: Matrix): Matrix => Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    return l[row * 3]! * r[col]! + l[row * 3 + 1]! * r[col + 3]! + l[row * 3 + 2]! * r[col + 6]!;
  }) as Matrix;
  const result = multiply([1 / d.scale, 0, d.x, 0, 1 / d.scale, d.y, 0, 0, 1],
    multiply(h, [s.scale, 0, -s.x * s.scale, 0, s.scale, -s.y * s.scale, 0, 0, 1]));
  if (Math.abs(result[8]) < 1e-12) throw new Error('This perspective cannot be rectified. Check the marker positions.');
  return result.map(v => v / result[8]) as Matrix;
}

export function project(h: Matrix, x: number, y: number): Point {
  const denominator = h[6] * x + h[7] * y + h[8];
  if (Math.abs(denominator) < 1e-12) throw new Error('The perspective crosses infinity. Check the marker positions.');
  return { x: (h[0] * x + h[1] * y + h[2]) / denominator, y: (h[3] * x + h[4] * y + h[5]) / denominator };
}

export function registrationTransform(W: number, H: number, points: Quad): Matrix {
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 40 || H <= 40) throw new Error('Check the sheet dimensions.');
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Check the marker coordinates.');
  const crosses = points.map((a, i) => {
    const b = points[(i + 1) % 4]!, c = points[(i + 2) % 4]!;
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  if (crosses.every(c => c < -1e-6)) throw new Error('The marker order is mirrored. Start at the hole and continue clockwise: TL → TR → BR → BL.');
  if (crosses.some(c => c <= 1e-6)) throw new Error('Markers must form four distinct corners without crossing. Check their order.');
  const h = solveHomography([{ x: 20, y: 20 }, { x: W - 20, y: 20 }, { x: W - 20, y: H - 20 }, { x: 20, y: H - 20 }], points);
  // Extrapolation from the inset markers must remain finite over the entire sheet.
  const denominators = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => h[6] * x! + h[7] * y! + 1);
  if (!denominators.every(v => v > 1e-8)) throw new Error('The perspective is too extreme. Check the corners or take a more overhead photo.');
  return h;
}
