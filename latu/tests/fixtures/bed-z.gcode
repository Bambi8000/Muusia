; Muusia v2.72 — raw G-code
; Canvas 100 x 100 mm at origin X0 Y0 — paths 1
; Z-hop travel lift: 1.5 mm (saves bed-Z time)
G21
G90
G1 Z3 F600 ; pen up (bed-Z)
; Pen 2: Orange
G0 X5 Y5 F3000
G1 Z0 F600
G1 X15 Y5 Z-0.5 F1800
G1 X15 Y15 Z0.2 F1800
G1 Z1.5 F600
G0 X0 Y0 F3000
