# Muusia Plotter — Mechanical Handoff

Self-contained context for continuing the build in a new chat. Hardware-planning
stage (July 2026); nothing wired or configured yet. Next task: **design the pen
holder / carriage** together.

Working language: Finnish in chat, English in all code/GUI/docs.

---

## 1. The machine (mechanical overview)

- **Frame:** salvaged C-Carve / X-Carve (Inventables, 2015–2021 era), CNC-milled
  aluminium gantry. ~1 m × 1 m footprint (work area to be confirmed on assembly).
- **Kinematics:** 3-axis gantry. X (gantry cross-travel), Y1+Y2 (two motors, one
  per side of the gantry — dual-Y, to be driven separately for auto-square), Z.
- **Steppers:** NEMA 23, model **SM57HT51-2804AF** (Smart Automation) — 57 mm
  frame, 51 mm length, 1.8°, **2.8 A/phase**, 4-wire bipolar, 1/4" shaft, ~0.99 Nm.
  4 on the frame (X, Y1, Y2, Z) + 1 planned for brush rotation.
- **Control board:** BTT Kraken v1.1 (8× onboard TMC2160, SPI, up to 60 V) — ordered.
- **Host:** Raspberry Pi 4.
- **PSU:** Meishile S-500-24 (24 V, 21 A, 500 W) enclosed switching supply from
  parts bin — correct type for motors. Run steppers at moderate current
  (~1.3–1.8 A RMS), not full 2.8 A. Verify 230 V mains selector + test before use.
- **Software (context only, not this task):** Klipper + Moonraker + Mainsail/
  Fluidd + KlipperScreen on the Pi.

The pen tool is **not a router** — this is a pen/brush plotter. Loads are light;
the design concern is precision and repeatability, not cutting force.

---

## 2. Pen lift — decided components (the parts we're designing around)

The pen holder must integrate these already-chosen parts:

### Lift actuator
- **Primary servo:** SURPASS Hobby **S0017M** — 17 g, metal gear, **digital**,
  **1.8 kg·cm**, ~25T spline (comes with a metal horn). Chosen for tight hold,
  low jitter, durability over many lift cycles. PWM-controlled (Klipper `[servo]`,
  Z-profile "A" = servo lift). Powered from 5–6 V (regulator/BEC or Kraken servo
  rail) — NOT 24 V.
- **Spares / prototyping:** MG90S ×5 (metal gear, 9 g).

### Servo horn
- **25T 7075-aluminium arm, 30 mm** (a 20 mm may also be on hand to try). Multiple
  holes → pick hole radius to trade lift travel vs force. Inner holes = shorter
  travel, more force, finer control.

### Carriage guidance
- **MGN9 linear rail, 100 mm** + **2× MGN9C blocks**.
- Two blocks chosen deliberately, spaced **as far apart as the carriage allows**,
  for anti-tilt rigidity — important because a brush exerts side load and the pen
  tip sits far from the rail (any block tilt is amplified at the tip).

### Linkage & return
- **Pushrod / ball-link** from the servo horn to the carriage.
- **Return spring (or gravity)** provides constant pen-down contact pressure; the
  servo lifts *against* it. (Balancing carriage weight with the spring/counterweight
  keeps the servo load low — lets the small servo handle a heavier carriage.)

### Motion geometry rule of thumb
Lift travel ≈ (horn hole radius) × (servo swing in radians).
E.g. 20 mm radius × 40° (0.70 rad) ≈ 14 mm. Typical pen lift needs only ~3–8 mm,
so short horn radius + small swing is plenty and maximizes force/precision.

---

## 3. Also mounted on the carriage (affects pen-holder design)

- **Brush rotation:** a 5th NEMA stepper will rotate a brush (for painting).
  Design the holder so a rotating-brush tool can share or swap with the pen mount.
  (Wet painting is a real use case → side stability matters, hence 2 rail blocks.)
- **Carriage camera (planned):** a small **macro / narrow-FOV USB camera** riding
  on the carriage, aimed at the **pen tip** (not for lift — just filming the tip).
  Preference is a USB endoscope/microscope-type (UVC, close focus, light, long
  flexible USB cable) over a wide-angle webcam. Leave room + a mount point and a
  cable path for it. Optional small LED for tip lighting.
- **Laser pointer (planned):** a small laser on the pen holder for the magnet-jig
  workflow (marks magnet positions with pen up). It sits at a fixed **offset** from
  the pen tip; that offset (`laserOffX/Y`) lives in the Muusia machine profile, not
  the mechanics — but the holder must rigidly mount the laser so the offset stays
  constant. (See MUUSIA-MAGNET-JIG-SPEC.md for the software side.)

---

## 4. Work surface (context)

- **Phase 1 (now):** steel bed + magnets. Magnet positions are computed by a
  Muusia "Safe Areas / Magnet Jig" tool and marked physically by driving the
  carriage (pen up, laser on) to each point. → the laser above is part of this.
- **Phase 2 (later):** CNC-milled zoned vacuum table.

---

## 5. What to design next (this is the task for the new chat)

Design the **pen holder / carriage assembly** that ties the above together:

Open design questions to work through:
1. **Carriage plate:** geometry mounting the 2× MGN9C blocks + pen holder + (later)
   brush tool + camera mount + laser mount. Material (3D-printed vs milled ally).
2. **Lift kinematics:** horn hole radius + servo swing → desired lift height; where
   the pushrod attaches to the carriage; up/down angle limits for the servo.
3. **Pen retention:** how the pen/marker is clamped (spring-loaded plunge? fixed?
   quick-swap?). Constant contact pressure via spring — spring rate vs desired pen
   force on paper.
4. **Return mechanism:** spring vs gravity; where the spring anchors; how to balance
   carriage weight so the S0017M isn't overworked.
5. **Rail mounting:** how the MGN9 rail fixes to the Z/gantry; orientation (vertical
   travel); block spacing.
6. **Tool sharing/swap:** pen vs rotating brush — one carriage that swaps, or
   parallel mounts.
7. **Camera + laser mounts:** rigid, offset-stable positions; cable routing into a
   drag chain.

Constraints to respect:
- Keep carriage **light** (small servo, less inertia on the moving gantry).
- Keep pen tip, laser, and camera in **rigid, repeatable** relative positions.
- Lift only needs a few mm of vertical travel; favor force/precision over range.
- Everything Daniel builds is confirmed visually/iteratively before committing;
  he has a 3D printer and a CNC mill available for fabrication.

---

## 6. Related project docs (software side — not needed for mechanics)
- MUUSIA-PLOTTER-BOM.md — full bill of materials + workflow.
- MUUSIA-MAGNET-JIG-SPEC.md — the Safe Areas / laser magnet-jig software feature.
- MUUSIA-HANDOFF.md — the Muusia app (node-graph editor) architecture.
