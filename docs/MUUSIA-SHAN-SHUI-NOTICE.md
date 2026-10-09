# Shan Shui Landscape — third-party source

This node uses adapted geometry code from **shan-shui-inf** by Lingdong Huang:
https://github.com/LingDong-/shan-shui-inf

Pinned upstream commit: `9f754d2b2e73495db7883d4d4055a7b0903b0454`.
Upstream `index.html` SHA-256: `858792db2659e7d4c6604606d4ff2175f137f07061f8af51644f06ab0788215f`.

The PolyTools, Util, stroke/blob/texture, Tree, Mount, Arch, Man and water
functions originate in that source. Muusia replaces SVG string serialization
with path/mask commands, then removes hidden strokes and clips to the sheet.
A bounded scene planner replaces infinite scrolling. Fine lines uses the brush
centreline; Brush outlines retains the generated brush boundaries. Trees and
buildings are controlled by the node, and novelty text signs are omitted.

The original browser UI, global PRNG patch, paper bitmap, downloader and the
p5-derived PerlinNoise block are **not included**. Muusia uses its own local
seeded random generator and an adapter over its existing noise helper; it never
reassigns global Math.random. Consequently seeds do not reproduce the website's
exact scenes. Local-variable declarations and degenerate numerical cases are
hardened for strict ES modules; no browser/network access is needed to compute.

The adapted source is kept inside the node definition so custom-node prototyping,
the source bundle and Claude project snapshots carry the complete implementation.
The following upstream license is retained in the node and the repository:

```text
MIT License

Copyright (c) 2018 Lingdong Huang

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
