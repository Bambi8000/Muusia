# Differential Growth · Bounded — upstream source

Adapted Geometry, Boundary and Grower from Gilbert Chen’s [Line Growth](https://github.com/gil336699/line-growth), pinned commit `6cd6467d9c3f9d8e97ce36a15d20cac2b9032dea`.

`src/defs/line-growth-engine.js` retains the complete MIT notice. Muusia removes TypeScript annotations, adds joint boundary/segment-contact rejection and bounded rollback, and supplies its own node inputs, initialization, controls, caching, preview guides and exporters. The upstream UI, importer, SVG smoothing, worker and Clipper/Voronoi dependencies are not included.

```text
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
```
