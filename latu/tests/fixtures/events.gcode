; Muusia v2.72 — raw G-code
; Z mode: SERVO "pen" — up 135° / down 80° (bed-Z untouched)
G21
G90
SET_SERVO SERVO=pen ANGLE=135
; --- dip ---
G0 X320 Y20 F3000
SET_SERVO SERVO=pen ANGLE=80 ; plunge
G4 P600 ; dwell ms
SET_SERVO SERVO=pen ANGLE=135
; --- dip done ---
G0 X10 Y10 F3000
SET_SERVO SERVO=pen ANGLE=80 ; pen down
G1 X20 Y20 F1800
SET_SERVO SERVO=pen ANGLE=135
PAUSE ; TRAVEL STOP: inspect
MANUAL_STEPPER STEPPER=pen_rotate MOVE=45 SPEED=30
SET_PIN PIN=air_valve VALUE=1
G4 P250
SET_PIN PIN=air_valve VALUE=0
