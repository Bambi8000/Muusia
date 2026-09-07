; Muusia v2.72 — raw G-code
; Machine: Viivain - Servo pen — work area 793 x 813 mm
; Canvas 420 x 297 mm at origin X0 Y0 — paths 2 — Y flipped
; Z mode: SERVO "pen" — up 135° / down 80° (bed-Z untouched)
; Pen settle: down 200ms / up 150ms
G21 ; mm
G90 ; absolute
SET_SERVO SERVO=pen ANGLE=135 ; pen up (servo)
; Pen 0: Black
G0 X10 Y20 F3000
SET_SERVO SERVO=pen ANGLE=80 ; pen down
G4 P200 ; settle before draw
G1 X30 Y20 F1800
G1 X30 Y40 F1800
SET_SERVO SERVO=pen ANGLE=135
G4 P150 ; settle
SET_SERVO SERVO=pen ANGLE=135 ; pen up
PAUSE ; CHANGE PEN -> 7: Magenta
G0 X50 Y60 F3000
SET_SERVO SERVO=pen ANGLE=80 ; pen down
G1 X70 Y60 F1800
SET_SERVO SERVO=pen ANGLE=135
G0 X0 Y0
; done
