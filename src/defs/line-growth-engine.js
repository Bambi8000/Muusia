/* Adapted from gil336699/line-growth, commit 6cd6467d9c3f9d8e97ce36a15d20cac2b9032dea.
   Geometry, Boundary and Grower: Gilbert Chen, 2026. Type annotations removed.
   Muusia adds joint boundary/segment-contact rejection and a complete rollback.

MIT License

Copyright (c) 2026 Gilbert Chen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

export const distance = (a, b)=>Math.hypot(a[0] - b[0], a[1] - b[1]);
export function signedArea(ring) {
    let a = 0;
    for(let i = 0, j = ring.length - 1; i < ring.length; j = i++)a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    return a / 2;
}
export function centroid(poly) {
    let a = 0, cx = 0, cy = 0;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
        const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
        a += f;
        cx += (poly[j][0] + poly[i][0]) * f;
        cy += (poly[j][1] + poly[i][1]) * f;
    }
    if (Math.abs(a) < 1e-12) {
        const n = Math.max(1, poly.length);
        return [
            poly.reduce((s, p)=>s + p[0], 0) / n,
            poly.reduce((s, p)=>s + p[1], 0) / n
        ];
    }
    return [
        cx / (3 * a),
        cy / (3 * a)
    ];
}
export function pathLength(points, closed) {
    let total = 0;
    const count = closed ? points.length : points.length - 1;
    for(let i = 0; i < count; i++)total += distance(points[i], points[(i + 1) % points.length]);
    return total;
}
export function boxOf(rings) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const ring of rings)for (const [x, y] of ring){
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
    }
    return [
        x0,
        y0,
        x1,
        y1
    ];
}
export const overlaps = (a, b)=>a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
export function resample(points, closed, spacing) {
    if (points.length < 2 || !(spacing > 0)) return points.map((p)=>[
            p[0],
            p[1]
        ]);
    const result = [
        [
            points[0][0],
            points[0][1]
        ]
    ];
    let carried = 0;
    let last = [
        points[0][0],
        points[0][1]
    ];
    const count = closed ? points.length : points.length - 1;
    for(let i = 0; i < count; i++){
        const end = [
            points[(i + 1) % points.length][0],
            points[(i + 1) % points.length][1]
        ];
        let segment = distance(last, end);
        while(carried + segment >= spacing){
            const t = (spacing - carried) / segment;
            const next = [
                last[0] + (end[0] - last[0]) * t,
                last[1] + (end[1] - last[1]) * t
            ];
            result.push(next);
            last = next;
            segment = distance(last, end);
            carried = 0;
        }
        carried += segment;
        last = end;
        if (!closed && i === count - 1) result.push(end);
    }
    if (closed && result.length > 2 && distance(result[0], result[result.length - 1]) < spacing * 0.5) result.pop();
    return result;
}
export function ellipseRing(cx, cy, rx, ry, tolerance = 0.005) {
    const r = Math.max(rx, ry, 1e-9);
    const step = tolerance < r ? 2 * Math.acos(1 - tolerance / r) : Math.PI / 2;
    const n = Math.min(4096, Math.max(16, Math.ceil(Math.PI * 2 / step)));
    return Array.from({
        length: n
    }, (_, i)=>[
            cx + rx * Math.cos(i / n * Math.PI * 2),
            cy + ry * Math.sin(i / n * Math.PI * 2)
        ]);
}
export const flat = (points)=>{
    const out = new Float64Array(points.length * 2);
    points.forEach(([x, y], i)=>{
        out[i * 2] = x;
        out[i * 2 + 1] = y;
    });
    return out;
};
export const unflat = (points)=>{
    const out = [];
    for(let i = 0; i + 1 < points.length; i += 2)out.push([
        points[i],
        points[i + 1]
    ]);
    return out;
};


export class Boundary {
    rings;
    box;
    length;
    ex0;
    ey0;
    ex1;
    ey1;
    cols;
    rows;
    cw;
    ch;
    buckets;
    stamp;
    tick = 0;
    constructor(rings){
        this.rings = rings.filter((r)=>r.length >= 3);
        this.box = boxOf(this.rings);
        const n = this.rings.reduce((sum, r)=>sum + r.length, 0);
        this.ex0 = new Float64Array(n);
        this.ey0 = new Float64Array(n);
        this.ex1 = new Float64Array(n);
        this.ey1 = new Float64Array(n);
        let k = 0, length = 0;
        for (const ring of this.rings){
            for(let i = 0; i < ring.length; i++){
                const a = ring[i], b = ring[(i + 1) % ring.length];
                this.ex0[k] = a[0];
                this.ey0[k] = a[1];
                this.ex1[k] = b[0];
                this.ey1[k] = b[1];
                k++;
                length += Math.hypot(b[0] - a[0], b[1] - a[1]);
            }
        }
        this.length = length;
        const [x0, y0, x1, y1] = this.box;
        const w = Math.max(1e-9, x1 - x0), h = Math.max(1e-9, y1 - y0);
        const side = Math.max(4, Math.min(256, Math.round(Math.sqrt(n))));
        this.cols = Math.max(1, Math.round(side * Math.sqrt(w / h)));
        this.rows = Math.max(1, Math.round(side * Math.sqrt(h / w)));
        this.cw = w / this.cols;
        this.ch = h / this.rows;
        const lists = Array.from({
            length: this.cols * this.rows
        }, ()=>[]);
        for(let e = 0; e < n; e++){
            const [c0, r0] = this.cell(Math.min(this.ex0[e], this.ex1[e]), Math.min(this.ey0[e], this.ey1[e]));
            const [c1, r1] = this.cell(Math.max(this.ex0[e], this.ex1[e]), Math.max(this.ey0[e], this.ey1[e]));
            for(let r = r0; r <= r1; r++)for(let c = c0; c <= c1; c++)lists[r * this.cols + c].push(e);
        }
        this.buckets = lists.map((l)=>Int32Array.from(l));
        this.stamp = new Int32Array(n);
    }
    get empty() {
        return this.ex0.length === 0;
    }
    cell(x, y) {
        return [
            Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.box[0]) / this.cw))),
            Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.box[1]) / this.ch)))
        ];
    }
    contains(x, y) {
        const [x0, y0, x1, y1] = this.box;
        if (!(x >= x0 && x <= x1 && y >= y0 && y <= y1)) return false;
        const [col, row] = this.cell(x, y);
        const tick = ++this.tick;
        let inside = false;
        for(let c = col; c < this.cols; c++){
            for (const e of this.buckets[row * this.cols + c]){
                if (this.stamp[e] === tick) continue;
                this.stamp[e] = tick;
                const ay = this.ey0[e], by = this.ey1[e];
                if (ay > y === by > y) continue;
                const xi = this.ex0[e] + (y - ay) * (this.ex1[e] - this.ex0[e]) / (by - ay);
                if (xi > x) inside = !inside;
            }
        }
        return inside;
    }
    near(box, visit) {
        if (!overlaps(box, this.box)) return;
        const [c0, r0] = this.cell(box[0], box[1]), [c1, r1] = this.cell(box[2], box[3]);
        const tick = ++this.tick;
        for(let r = r0; r <= r1; r++){
            for(let c = c0; c <= c1; c++){
                for (const e of this.buckets[r * this.cols + c]){
                    if (this.stamp[e] === tick) continue;
                    this.stamp[e] = tick;
                    visit(e);
                }
            }
        }
    }
    closest(x, y) {
        if (this.empty) return [
            x,
            y
        ];
        const [bx0, by0, bx1, by1] = this.box;
        const outside = Math.hypot(Math.max(bx0 - x, 0, x - bx1), Math.max(by0 - y, 0, y - by1));
        let h = Math.max(this.cw, this.ch) + outside;
        const span = Math.hypot(bx1 - bx0, by1 - by0) + outside;
        for(;;){
            let best = Infinity, px = x, py = y;
            this.near([
                x - h,
                y - h,
                x + h,
                y + h
            ], (e)=>{
                const ax = this.ex0[e], ay = this.ey0[e], ex = this.ex1[e] - ax, ey = this.ey1[e] - ay;
                const len2 = ex * ex + ey * ey || 0.000001;
                const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / len2));
                const qx = ax + ex * t, qy = ay + ey * t;
                const d = (qx - x) * (qx - x) + (qy - y) * (qy - y);
                if (d < best) {
                    best = d;
                    px = qx;
                    py = qy;
                }
            });
            if (best <= h * h || h > span) return [
                px,
                py
            ];
            h *= 2;
        }
    }
    clipSegment(ax, ay, bx, by) {
        const ts = [
            0,
            1
        ];
        const dx = bx - ax, dy = by - ay;
        this.near([
            Math.min(ax, bx),
            Math.min(ay, by),
            Math.max(ax, bx),
            Math.max(ay, by)
        ], (e)=>{
            const ex = this.ex1[e] - this.ex0[e], ey = this.ey1[e] - this.ey0[e];
            const den = dx * ey - dy * ex;
            if (Math.abs(den) < 1e-18) return;
            const qx = this.ex0[e] - ax, qy = this.ey0[e] - ay;
            const t = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
            if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
        });
        ts.sort((p, q)=>p - q);
        const out = [];
        for(let i = 0; i + 1 < ts.length; i++){
            const t0 = ts[i], t1 = ts[i + 1];
            if (t1 - t0 < 1e-9) continue;
            const m = (t0 + t1) / 2;
            if (!this.contains(ax + dx * m, ay + dy * m)) continue;
            const last = out[out.length - 1];
            if (last && Math.abs(last[1] - t0) < 1e-12) last[1] = t1;
            else out.push([
                t0,
                t1
            ]);
        }
        return out;
    }
    repellers(spacing) {
        const xs = [], ys = [], nxs = [], nys = [];
        for (const ring of this.rings){
            const points = resample(ring, true, spacing);
            const n = points.length;
            for(let i = 0; i < n; i++){
                const [x, y] = points[i];
                const a = points[(i + n - 1) % n], b = points[(i + 1) % n];
                let nx = -(b[1] - a[1]), ny = b[0] - a[0];
                const l = Math.hypot(nx, ny) || 1;
                nx /= l;
                ny /= l;
                const probe = Math.max(1e-6, spacing * 0.01);
                if (!this.contains(x + nx * probe, y + ny * probe)) {
                    nx = -nx;
                    ny = -ny;
                }
                xs.push(x);
                ys.push(y);
                nxs.push(nx);
                nys.push(ny);
            }
        }
        return {
            x: Float64Array.from(xs),
            y: Float64Array.from(ys),
            nx: Float64Array.from(nxs),
            ny: Float64Array.from(nys)
        };
    }
    roomiest() {
        const [x0, y0, x1, y1] = this.box;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const clearance = (x, y)=>{
            const [px, py] = this.closest(x, y);
            return Math.hypot(px - x, py - y);
        };
        const centre = this.contains(cx, cy) ? clearance(cx, cy) : -1;
        let best = [
            cx,
            cy
        ], bestClear = centre;
        const n = 24;
        for(let i = 0; i < n; i++)for(let j = 0; j < n; j++){
            const x = x0 + (i + 0.5) / n * (x1 - x0), y = y0 + (j + 0.5) / n * (y1 - y0);
            if (!this.contains(x, y)) continue;
            const c = clearance(x, y);
            if (c > bestClear * 1.5 + 1e-9 && c > bestClear) {
                best = [
                    x,
                    y
                ];
                bestClear = c;
            }
        }
        return best;
    }
}
const cache = new WeakMap();
export function boundaryOf(rings) {
    let b = cache.get(rings);
    if (!b) cache.set(rings, b = new Boundary(rings));
    return b;
}

export const SPLIT_FACTOR = 1.25;
export const ENDPOINT_DAMPING = 0.15;
export const EDGE_FORCE = 2;
const MAX_REPELLERS_PER_MM = 1 / 20_000;
function mix(h) {
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
}
export const noise = (seed, step, strand, k)=>mix(mix(mix(mix(seed >>> 0) ^ step) ^ strand) ^ k) / 4294967296;
function buildGrid(xs, ys, n, radius, minCells) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for(let i = 0; i < n; i++){
        const x = xs[i], y = ys[i];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
    }
    if (!(n > 0)) {
        x0 = y0 = 0;
        x1 = y1 = 1;
    }
    const w = Math.max(x1 - x0, 1e-9), h = Math.max(y1 - y0, 1e-9);
    const limit = Math.max(minCells, 4 * n);
    let cell = Math.max(radius, 1e-9);
    if ((w / cell + 1) * (h / cell + 1) > limit) cell = Math.max(cell, Math.sqrt(w * h / limit), (w + h) / limit);
    const cols = Math.floor(w / cell) + 1, rows = Math.floor(h / cell) + 1;
    const inv = 1 / cell;
    const start = new Int32Array(cols * rows + 1);
    const cellOf = new Int32Array(n);
    for(let i = 0; i < n; i++){
        const c = Math.floor((xs[i] - x0) * inv) + Math.floor((ys[i] - y0) * inv) * cols;
        cellOf[i] = c;
        start[c + 1]++;
    }
    for(let c = 0; c < cols * rows; c++)start[c + 1] += start[c];
    const fill = start.slice(0, cols * rows);
    const items = new Int32Array(n);
    for(let i = 0; i < n; i++)items[fill[cellOf[i]]++] = i;
    return {
        x0,
        y0,
        inv,
        cols,
        rows,
        start,
        items
    };
}
export function shareBudget(needs, budget) {
    const total = needs.reduce((a, b)=>a + b, 0);
    if (total <= budget) return needs.slice();
    const sorted = needs.slice().sort((a, b)=>a - b);
    let level = 0, used = 0, left = needs.length;
    for (const need of sorted){
        const rise = (need - level) * left;
        if (used + rise > budget) break;
        used += rise;
        level = need;
        left--;
    }
    level += Math.floor((budget - used) / Math.max(1, left));
    const caps = needs.map((need)=>Math.min(need, level));
    let rest = budget - caps.reduce((a, b)=>a + b, 0);
    for(let s = 0; s < needs.length && rest > 0; s++)if (needs[s] > caps[s]) {
        caps[s]++;
        rest--;
    }
    return caps;
}
function splitStrand(strand, split, cap, randomness, seed, step, index, countOnly) {
    const p = strand.points, n = p.length / 2;
    const edges = strand.closed ? n : n - 1;
    const out = [], nudges = [];
    let made = 0;
    const visit = (ax, ay, bx, by)=>{
        const dx = bx - ax, dy = by - ay;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (made >= cap || !(d > split)) return;
        const k = made++;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        visit(ax, ay, mx, my);
        if (!countOnly) {
            out.push(mx, my);
            const offset = randomness > 0 && d > 0 ? (noise(seed, step, index, k) * 2 - 1) * randomness * 0.25 * d : 0;
            nudges.push(-dy / d * offset, dx / d * offset);
        }
        visit(mx, my, bx, by);
    };
    for(let i = 0; i < n; i++){
        if (!countOnly) {
            out.push(p[i * 2], p[i * 2 + 1]);
            nudges.push(0, 0);
        }
        if (i < edges) {
            const j = (i + 1) % n;
            visit(p[i * 2], p[i * 2 + 1], p[j * 2], p[j * 2 + 1]);
        }
    }
    if (countOnly) return made;
    return made ? {
        points: Float64Array.from(out),
        nudges: randomness > 0 ? Float64Array.from(nudges) : null
    } : null;
}
export function subdivide(strands, params, step) {
    const nudges = strands.map(()=>null);
    const total = strands.reduce((sum, s)=>sum + s.points.length / 2, 0);
    const budget = Math.floor(params.maxNodes) - total;
    if (budget <= 0 || total < 2) return nudges;
    const split = params.segmentLength * SPLIT_FACTOR;
    const needs = strands.map((s, i)=>s.points.length >= 4 ? splitStrand(s, split, budget, params.randomness, params.seed, step, i, true) : 0);
    const caps = shareBudget(needs, budget);
    strands.forEach((s, i)=>{
        if (!caps[i]) return;
        const next = splitStrand(s, split, caps[i], params.randomness, params.seed, step, i, false);
        if (next) {
            s.points = next.points;
            nudges[i] = next.nudges;
        }
    });
    return nudges;
}
export const nodeCount = (strands)=>strands.reduce((sum, s)=>sum + s.points.length / 2, 0);
const FILLED_AFTER_STEPS = 300;
export class Grower {
    strands;
    step;
    params;
    boundary;
    repellers = null;
    repelGrid = null;
    repelKey = '';
    X = new Float64Array(0);
    Y = new Float64Array(0);
    DX = new Float64Array(0);
    DY = new Float64Array(0);
    lastAdded;
    constructor(strands, step, params, boundary){
        this.strands = strands;
        this.step = step;
        this.params = params;
        this.boundary = boundary;
        this.lastAdded = step;
    }
    setParams(params) {
        this.params = params;
        this.lastAdded = this.step;
    }
    setBoundary(boundary) {
        this.boundary = boundary;
        this.repelKey = '';
        this.lastAdded = this.step;
    }
    get nodes() {
        return nodeCount(this.strands);
    }
    get settling() {
        return this.nodes >= Math.floor(this.params.maxNodes);
    }
    get filled() {
        return !this.settling && this.step - this.lastAdded >= FILLED_AFTER_STEPS;
    }
    boundaryPoints() {
        const { segmentLength, repelRadius } = this.params;
        const spacing = Math.max(segmentLength, this.boundary.length * MAX_REPELLERS_PER_MM);
        const key = `${spacing}|${repelRadius}`;
        if (!this.repellers || key !== this.repelKey) {
            this.repellers = this.boundary.repellers(spacing);
            const r = this.repellers;
            this.repelGrid = buildGrid(r.x, r.y, r.x.length, repelRadius, 1024);
            this.repelKey = key;
        }
        return this.repellers;
    }
    stepOnce() {
        const total = this.nodes;
        if (total < 2) return false;
        const p = this.params;
        const nudges = subdivide(this.strands, p, this.step);
        const strands = this.strands;
        const n = nodeCount(strands);
        if (n > total) this.lastAdded = this.step;
        if (this.X.length < n) {
            const size = Math.max(n, Math.ceil(this.X.length * 1.5));
            this.X = new Float64Array(size);
            this.Y = new Float64Array(size);
            this.DX = new Float64Array(size);
            this.DY = new Float64Array(size);
        }
        const { X, Y, DX, DY } = this;
        let g = 0;
        for (const s of strands)for(let i = 0; i < s.points.length; i += 2){
            X[g] = s.points[i];
            Y[g] = s.points[i + 1];
            g++;
        }
        const target = p.segmentLength, R = p.repelRadius, R2 = R * R;
        const rep = p.repulsion, att = p.attraction, ali = p.alignment, stepSize = p.stepSize;
        const grid = buildGrid(X, Y, n, R, 64);
        const rp = this.boundaryPoints(), rg = this.repelGrid;
        const maxMove = R;
        let off = 0;
        for (const s of strands){
            const m = s.points.length / 2, closed = s.closed;
            for(let i = 0; i < m; i++){
                const gi = off + i, x = X[gi], y = Y[gi];
                let fx = 0, fy = 0, efx = 0, efy = 0;
                {
                    const cx = Math.floor((x - grid.x0) * grid.inv), cy = Math.floor((y - grid.y0) * grid.inv);
                    for(let yy = Math.max(0, cy - 1); yy <= Math.min(grid.rows - 1, cy + 1); yy++){
                        for(let xx = Math.max(0, cx - 1); xx <= Math.min(grid.cols - 1, cx + 1); xx++){
                            const c = yy * grid.cols + xx;
                            for(let k = grid.start[c]; k < grid.start[c + 1]; k++){
                                const j = grid.items[k];
                                if (j === gi) continue;
                                const dx = x - X[j], dy = y - Y[j];
                                const d2 = dx * dx + dy * dy;
                                if (d2 >= R2 || d2 === 0) continue;
                                const d = Math.sqrt(d2);
                                const strength = (1 - d / R) * rep;
                                fx += dx / d * strength;
                                fy += dy / d * strength;
                            }
                        }
                    }
                }
                {
                    const cx = Math.floor((x - rg.x0) * rg.inv), cy = Math.floor((y - rg.y0) * rg.inv);
                    for(let yy = Math.max(0, cy - 1); yy <= Math.min(rg.rows - 1, cy + 1); yy++){
                        for(let xx = Math.max(0, cx - 1); xx <= Math.min(rg.cols - 1, cx + 1); xx++){
                            const c = yy * rg.cols + xx;
                            for(let k = rg.start[c]; k < rg.start[c + 1]; k++){
                                const j = rg.items[k];
                                const dx = x - rp.x[j], dy = y - rp.y[j];
                                const d = Math.sqrt(dx * dx + dy * dy) || 0.000001;
                                if (d < 0.0001) {
                                    efx += rp.nx[j] * rep * EDGE_FORCE;
                                    efy += rp.ny[j] * rep * EDGE_FORCE;
                                    continue;
                                }
                                if (d < R) {
                                    const strength = (1 - d / R) * rep * EDGE_FORCE;
                                    efx += dx / d * strength;
                                    efy += dy / d * strength;
                                }
                            }
                        }
                    }
                }
                const prev = i === 0 ? closed ? m - 1 : 0 : i - 1;
                const next = i === m - 1 ? closed ? 0 : m - 1 : i + 1;
                if (prev !== i) {
                    const dx = X[off + prev] - x, dy = Y[off + prev] - y;
                    const d = Math.sqrt(dx * dx + dy * dy) || 0.000001;
                    const pull = (d - target) * att / target;
                    fx += dx / d * pull;
                    fy += dy / d * pull;
                }
                if (next !== i) {
                    const dx = X[off + next] - x, dy = Y[off + next] - y;
                    const d = Math.sqrt(dx * dx + dy * dy) || 0.000001;
                    const pull = (d - target) * att / target;
                    fx += dx / d * pull;
                    fy += dy / d * pull;
                }
                if (prev !== i && next !== i) {
                    const midX = (X[off + prev] + X[off + next]) / 2, midY = (Y[off + prev] + Y[off + next]) / 2;
                    fx += (midX - x) * ali / target;
                    fy += (midY - y) * ali / target;
                }
                if (!closed && (i === 0 || i === m - 1)) {
                    fx *= ENDPOINT_DAMPING;
                    fy *= ENDPOINT_DAMPING;
                }
                let mx = (fx + efx) * stepSize, my = (fy + efy) * stepSize;
                const len2 = mx * mx + my * my;
                if (len2 > maxMove * maxMove) {
                    const k = maxMove / Math.sqrt(len2);
                    mx *= k;
                    my *= k;
                }
                DX[gi] = mx;
                DY[gi] = my;
            }
            off += m;
        }
        off = 0;
        strands.forEach((s, i)=>{
            const u = nudges[i];
            if (u) for(let k = 0; k < u.length; k += 2){
                DX[off + k / 2] += u[k];
                DY[off + k / 2] += u[k + 1];
            }
            off += s.points.length / 2;
        });
        const b = this.boundary;
        for(let k = 0; k < n; k++){
            let x = X[k] + DX[k], y = Y[k] + DY[k];
            if (!b.empty && !b.contains(x, y)) [x, y] = b.closest(x, y);
            DX[k] = x;
            DY[k] = y;
        }
        this.held = untangle(strands, X, Y, DX, DY, n, target * SPLIT_FACTOR, b);
        g = 0;
        for (const s of strands){
            const pts = s.points;
            for(let i = 0; i < pts.length; i += 2){
                pts[i] = DX[g];
                pts[i + 1] = DY[g];
                g++;
            }
        }
        this.step++;
        return true;
    }
    held = 0;
}
function buildEdgeGrid(NX, NY, edges, next, size) {
    const e = edges.length;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for(let i = 0; i < e; i++){
        const a = edges[i], b = next[a];
        x0 = Math.min(x0, NX[a], NX[b]);
        x1 = Math.max(x1, NX[a], NX[b]);
        y0 = Math.min(y0, NY[a], NY[b]);
        y1 = Math.max(y1, NY[a], NY[b]);
    }
    if (!(e > 0)) {
        x0 = y0 = 0;
        x1 = y1 = 1;
    }
    const w = Math.max(x1 - x0, 1e-9), h = Math.max(y1 - y0, 1e-9);
    const limit = Math.max(64, 4 * e);
    let cell = Math.max(size, 1e-9);
    if ((w / cell + 1) * (h / cell + 1) > limit) cell = Math.max(cell, Math.sqrt(w * h / limit), (w + h) / limit);
    const cols = Math.floor(w / cell) + 1, rows = Math.floor(h / cell) + 1, inv = 1 / cell;
    const span = (i)=>{
        const a = edges[i], b = next[a];
        return [
            Math.floor((Math.min(NX[a], NX[b]) - x0) * inv),
            Math.floor((Math.min(NY[a], NY[b]) - y0) * inv),
            Math.floor((Math.max(NX[a], NX[b]) - x0) * inv),
            Math.floor((Math.max(NY[a], NY[b]) - y0) * inv)
        ];
    };
    const start = new Int32Array(cols * rows + 1);
    for(let i = 0; i < e; i++){
        const [c0, r0, c1, r1] = span(i);
        for(let r = r0; r <= r1; r++)for(let c = c0; c <= c1; c++)start[r * cols + c + 1]++;
    }
    for(let c = 0; c < cols * rows; c++)start[c + 1] += start[c];
    const fill = start.slice(0, cols * rows), items = new Int32Array(start[cols * rows]);
    for(let i = 0; i < e; i++){
        const [c0, r0, c1, r1] = span(i);
        for(let r = r0; r <= r1; r++)for(let c = c0; c <= c1; c++)items[fill[r * cols + c]++] = i;
    }
    return {
        x0,
        y0,
        inv,
        cols,
        rows,
        start,
        items
    };
}
export function crossed(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
    const orient = (px, py, qx, qy, rx, ry)=>(qx - px) * (ry - py) - (qy - py) * (rx - px);
    return orient(ax0, ay0, ax1, ay1, bx0, by0) * orient(ax0, ay0, ax1, ay1, bx1, by1) < 0 && orient(bx0, by0, bx1, by1, ax0, ay0) * orient(bx0, by0, bx1, by1, ax1, ay1) < 0;
}
function untangle(strands, X, Y, NX, NY, n, size, boundary) {
    const next = new Int32Array(n);
    let off = 0;
    for (const s of strands){
        const m = s.points.length / 2;
        for(let i = 0; i < m; i++)next[off + i] = i < m - 1 ? off + i + 1 : s.closed && m > 2 ? off : -1;
        off += m;
    }
    const edges = [], edgeOf = new Int32Array(n).fill(-1), prevOf = new Int32Array(n).fill(-1);
    for(let k = 0; k < n; k++)if (next[k] >= 0) {
        edgeOf[k] = edges.length;
        prevOf[next[k]] = edges.length;
        edges.push(k);
    }
    const e = edges.length;
    const stamp = new Int32Array(n), seen = new Int32Array(e);
    let query = 0;
    let held = 0;
    let check = null;
    for(let pass = 1; pass <= 64; pass++){
        const grid = buildEdgeGrid(NX, NY, edges, next, size);
        const back = [];
        const count = check ? check.length : e;
        for(let q = 0; q < count; q++){
            const i = check ? check[q] : q;
            const a0 = edges[i], a1 = next[a0];
            const ax0 = NX[a0], ay0 = NY[a0], ax1 = NX[a1], ay1 = NY[a1];
            // Joint boundary/contact rollback: checking endpoints alone lets a
            // segment cut across a small hole or a concave corner.
            if (Math.hypot(ax1-ax0,ay1-ay0)<1e-8 || !segmentInside(boundary, ax0, ay0, ax1, ay1)) {
                for (const node of [a0, a1]) {
                    if (stamp[node] !== pass && (NX[node] !== X[node] || NY[node] !== Y[node])) {
                        stamp[node] = pass; back.push(node);
                    }
                }
            }
            const c0 = Math.floor((Math.min(ax0, ax1) - grid.x0) * grid.inv), r0 = Math.floor((Math.min(ay0, ay1) - grid.y0) * grid.inv);
            const c1 = Math.floor((Math.max(ax0, ax1) - grid.x0) * grid.inv), r1 = Math.floor((Math.max(ay0, ay1) - grid.y0) * grid.inv);
            const visit = ++query;
            for(let yy = r0; yy <= r1; yy++){
                for(let xx = c0; xx <= c1; xx++){
                    const cell = yy * grid.cols + xx;
                    for(let k = grid.start[cell]; k < grid.start[cell + 1]; k++){
                        const j = grid.items[k];
                        if ((check ? j === i : j <= i) || seen[j] === visit) continue;
                        seen[j] = visit;
                        const b0 = edges[j], b1 = next[b0];
                        if (b0 === a1 || b1 === a0 || b0 === a0 || b1 === a1) continue;
                        const bx0 = NX[b0], by0 = NY[b0], bx1 = NX[b1], by1 = NY[b1];
                        if (!segmentContact(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1)) continue;
                        for (const node of [
                            a0,
                            a1,
                            b0,
                            b1
                        ]){
                            if (stamp[node] === pass || NX[node] === X[node] && NY[node] === Y[node]) continue;
                            stamp[node] = pass;
                            back.push(node);
                        }
                    }
                }
            }
        }
        if (!back.length) return held;
        const touched = new Set();
        for (const node of back){
            NX[node] = X[node];
            NY[node] = Y[node];
            if (edgeOf[node] >= 0) touched.add(edgeOf[node]);
            if (prevOf[node] >= 0) touched.add(prevOf[node]);
        }
        check = [
            ...touched
        ];
        held += back.length;
    }
    // If the bounded search is exhausted, retain the valid, subdivided old
    // geometry for this entire step. Never commit a partially repaired state.
    NX.set(X.subarray(0, n)); NY.set(Y.subarray(0, n));
    return held;
}

// Inclusive contacts also reject touches and collinear overlaps between
// independent edges, unlike upstream's proper-crossing-only predicate.
export function segmentContact(ax, ay, bx, by, cx, cy, dx, dy) {
    const eps=1e-9;
    if(Math.max(ax,bx)<Math.min(cx,dx)-eps || Math.max(cx,dx)<Math.min(ax,bx)-eps || Math.max(ay,by)<Math.min(cy,dy)-eps || Math.max(cy,dy)<Math.min(ay,by)-eps)return false;
    const o=(px,py,qx,qy,rx,ry)=>(qx-px)*(ry-py)-(qy-py)*(rx-px);
    const a=o(ax,ay,bx,by,cx,cy),b=o(ax,ay,bx,by,dx,dy),c=o(cx,cy,dx,dy,ax,ay),d=o(cx,cy,dx,dy,bx,by);
    return a*b<0&&c*d<0 || Math.abs(a)<eps&&(cx-ax)*(cx-bx)+(cy-ay)*(cy-by)<=eps || Math.abs(b)<eps&&(dx-ax)*(dx-bx)+(dy-ay)*(dy-by)<=eps || Math.abs(c)<eps&&(ax-cx)*(ax-dx)+(ay-cy)*(ay-dy)<=eps || Math.abs(d)<eps&&(bx-cx)*(bx-dx)+(by-cy)*(by-dy)<=eps;
}
export function segmentInside(boundary, ax, ay, bx, by) {
    const spans=boundary.clipSegment(ax,ay,bx,by);
    return spans.length===1 && spans[0][0]<1e-8 && spans[0][1]>1-1e-8;
}
// Check complete starts and final outputs, including adjacent foldbacks.
export function validStrands(strands, boundary, size=2) {
    const points=strands.flatMap(s=>unflat(s.points)),n=points.length;
    if(!n)return false;
    const X=Float64Array.from(points,q=>q[0]),Y=Float64Array.from(points,q=>q[1]);
    const next=new Int32Array(n).fill(-1),edges=[];
    let off=0;
    for(const s of strands){
        const m=s.points.length/2;
        if(m<(s.closed?3:2))return false;
        for(let k=0;k<m;k++){
            const a=off+k,b=k<m-1?a+1:s.closed?off:-1;next[a]=b;
            if(b>=0){if(Math.hypot(X[a]-X[b],Y[a]-Y[b])<1e-8 || !segmentInside(boundary,X[a],Y[a],X[b],Y[b]))return false;edges.push(a);}
        }
        for(let k=s.closed?0:1;k<(s.closed?m:m-1);k++){
            const p=points[off+(k+m-1)%m],q=points[off+k],r=points[off+(k+1)%m];
            if(Math.abs((q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]))<1e-9 && (q[0]-p[0])*(r[0]-q[0])+(q[1]-p[1])*(r[1]-q[1])<=0)return false;
        }
        off+=m;
    }
    const grid=buildEdgeGrid(X,Y,edges,next,size),seen=new Int32Array(edges.length);
    for(let i=0;i<edges.length;i++){
        const a=edges[i],b=next[a],stamp=i+1;
        const c0=Math.floor((Math.min(X[a],X[b])-grid.x0)*grid.inv),c1=Math.floor((Math.max(X[a],X[b])-grid.x0)*grid.inv),r0=Math.floor((Math.min(Y[a],Y[b])-grid.y0)*grid.inv),r1=Math.floor((Math.max(Y[a],Y[b])-grid.y0)*grid.inv);
        for(let y=r0;y<=r1;y++)for(let x=c0;x<=c1;x++){
            const cell=y*grid.cols+x;
            for(let k=grid.start[cell];k<grid.start[cell+1];k++){
                const j=grid.items[k];if(j<=i||seen[j]===stamp)continue;seen[j]=stamp;
                const c=edges[j],d=next[c];if(a===c||a===d||b===c||b===d)continue;
                if(segmentContact(X[a],Y[a],X[b],Y[b],X[c],Y[c],X[d],Y[d]))return false;
            }
        }
    }
    return true;
}
