; Muusia v2.131 — raw G-code
; Machine: A — Servo Z (multi-tip brush) — work area 330 x 240 mm
; Canvas 297 x 210 mm at origin X0 Y0 — paths 12
; Draw 1.08 m, travel 0.31 m — est. 1 min (+ pen lifts & pauses)
; Z mode: SERVO "pen" — up 90° / down 35° (bed-Z untouched)
; Pen settle: down 120ms / up 80ms
G21 ; mm
G90 ; absolute
G28 ; home
SET_SERVO SERVO=pen ANGLE=90 ; pen up (servo)
G4 P80 ; settle before first travel
; Pen 0: Black
G0 X10 Y10 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X35 Y10 F1800
G1 X35 Y52 F1800
G1 X10 Y52 F1800
G1 X10 Y10 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X14 Y14 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X31 Y14 F1800
G1 X31 Y48 F1800
G1 X14 Y48 F1800
G1 X14 Y14 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X16 Y22 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X29 Y22 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
SET_SERVO SERVO=pen ANGLE=90 ; pen up
G4 P80 ; settle after lift
M0 ; CHANGE PEN -> 1: Blue
G0 X65 Y75 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X96 Y75 F1800
G1 X96 Y113 F1800
G1 X65 Y113 F1800
G1 X65 Y75 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X69 Y79 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X92 Y79 F1800
G1 X92 Y109 F1800
G1 X69 Y109 F1800
G1 X69 Y79 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X71 Y87 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X90 Y87 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
SET_SERVO SERVO=pen ANGLE=90 ; pen up
G4 P80 ; settle after lift
M0 ; CHANGE PEN -> 2: Red
G0 X126 Y22 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X151 Y22 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X124 Y14 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X153 Y14 F1800
G1 X153 Y40 F1800
G1 X124 Y40 F1800
G1 X124 Y14 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X120 Y10 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X157 Y10 F1800
G1 X157 Y44 F1800
G1 X120 Y44 F1800
G1 X120 Y10 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
SET_SERVO SERVO=pen ANGLE=90 ; pen up
G4 P80 ; settle after lift
M0 ; CHANGE PEN -> 3: Green
G0 X175 Y75 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X218 Y75 F1800
G1 X218 Y105 F1800
G1 X175 Y105 F1800
G1 X175 Y75 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X179 Y79 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X214 Y79 F1800
G1 X214 Y101 F1800
G1 X179 Y101 F1800
G1 X179 Y79 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
G0 X181 Y87 F6000
SET_SERVO SERVO=pen ANGLE=35 ; pen down
G4 P120 ; settle before draw
G1 X212 Y87 F1800
SET_SERVO SERVO=pen ANGLE=90
G4 P80 ; settle
SET_SERVO SERVO=pen ANGLE=90 ; pen up
G4 P80 ; settle after lift
G0 X0 Y0
; done