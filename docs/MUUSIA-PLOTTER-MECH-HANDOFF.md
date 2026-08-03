# Muusia Plotter — Mechanical Handoff

Self-contained context for continuing the build in a new chat. Hardware
planning + host software stage (Aug 2026): the Pi software stack is installed
and configured, the Kraken has not yet arrived, nothing is wired. Next task:
**design the pen holder / carriage** together.

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
  Port budget: X, Y1, Y2, Z, brush rotation, ink pump, nozzle sweep = 7 of 8.
- **Host:** Raspberry Pi 4.
- **PSU:** Meishile S-500-24 (24 V, 21 A, 500 W) enclosed switching supply from
  parts bin — correct type for motors. Run steppers at moderate current
  (~1.3–1.8 A RMS), not full 2.8 A. Verify 230 V mains selector + test before use.
- **Software:** Klipper + Moonraker + Mainsail + KlipperScreen **installed
  and running** on the Pi (hostname `nakit`, 192.168.0.57; via KIAUH,
  Jul 2026). Kraken firmware pre-compiled (STM32H723, 128KiB bootloader,
  25 MHz crystal, USB PA11/PA12 — recipe in `klipper/README.md`); flashing +
  the real serial ID wait for the board. `klipper/printer.cfg` draft exists:
  official BTT pin map, slots S1=X, S2=Y-left, S3=Y-right, S4=Z, S5=brush
  (stubbed). Dual-Y homes as a pair against the single Y switch (a second
  switch on STOP2 or sensorless DIAG = future auto-square); no Z switch →
  `[homing_override]` virtual zero (jog Z to working height, G28 declares it
  Z=0; `Z_ZERO_HERE` re-declares after pen/paper changes). Pen servo macros
  PEN_UP / PEN_DOWN / PEN_RELEASE live only in printer.cfg so exported G-code
  stays hardware-agnostic. Muusia side: read-only **Moonraker DRO**
  (`src/dro.jsx`) shows live position over the websocket — LAN/local only;
  Moonraker cors_domains carries the local dev origins
  (`klipper/moonraker-cors.snippet.conf`, applied on nakit). Never
  port-forward Moonraker (7125) or Mainsail (80) to the internet.

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
- **Laser pointer (planned):** a small laser on the pen holder, now serving **two
  workflows**: (a) the magnet-jig workflow (marks magnet positions with pen up,
  see MUUSIA-MAGNET-JIG-SPEC.md) and (b) **pen offset calibration** (section 5.1).
  It sits at a fixed **offset** from the pen tip; that offset (`laserOffX/Y`)
  lives in the Muusia machine profile, not the mechanics — but the holder must
  rigidly mount the laser so the offset stays constant. The rigidity requirement
  is now hard: both workflows assume the laser never moves relative to the
  carriage between sessions.
- **Ink nozzle on sweep stepper (planned):** the tube end / dispensing needle of
  the ink blot tool (section 4) rides near the carriage on a small rotating
  stepper. Heavy parts (pump, valve, reservoir) stay on the gantry frame; only
  the light nozzle + a small stepper come near the carriage. Mount TBD in the
  carriage design.

---

## 4. Ink Blot / Air Blow tool — decided components (ordering phase)

Drops a metered ink dose on the sheet, then blows it into dendrites with a
timed compressed-air pulse from a rotatable nozzle. All parameters
deterministic and G-code-drivable: dose (µl), blow direction (°), sweep (°),
pulse duration (s). Air pressure is a **per-session constant** set on the
regulator, not a per-blot parameter.

Design tool: `public/sim/ink-blow-sim.html` (served at /Muusia/sim/ on
Pages) — interactive drop + blow simulator; parameters map 1:1 to this
hardware. Physics coefficients are uncalibrated first guesses until the
first real blot tests (50 µl per ink per paper, measure Ø + branch lengths).

### Ink dosing

| Item | Spec | Notes |
|---|---|---|
| Peristaltic pump | PENGPU **P40SMDBPT1** (NEMA17, 24 V, 1.7 A/phase, 1.8°) | Drives directly from a spare Kraken TMC2160 port. `run_current: 1.2`. Configure as Klipper extruder; calibrate `rotation_distance` so 1 E-unit = 1 µl (weigh a 10-rev water dose). Retract a few E-units after each dose to pull the meniscus back — no after-drip. |
| Pump tube | PharMed BPT 3.2×1 mm (BPT1) | Chosen over BPT2/3: ~0.19 µl/full-step resolution, smallest dead volume (~0.24 ml per 30 cm), 1000 h tube life vs. 200 h silicone, better ink solvent resistance. Tube is the only wear part — order spares. |
| Ink reservoir | 5–10 ml bottle, **vented cap** | Mounts near the pump. Vent hole is mandatory: a sealed bottle builds vacuum and doses shrink over a session. Self-priming pump → reservoir height irrelevant. |
| Mounting | Gantry frame (Z-axis backbone), **not** the pen carriage | ~310 g + reservoir is nothing to the X-Carve gantry but too much for the light pen carriage (S0017M rule). Tube run to nozzle stays ~15–30 cm. |

### Air pulse

| Item | Spec | Notes |
|---|---|---|
| Compressor | Airbrush compressor with **3–3.5 l tank**, regulator + gauge, **water trap** (AS-186/196 class) | Tank guarantees every pulse starts from identical pressure → hardware-side determinism. Water trap mandatory (condensation drop on wet media = ruined sheet). Working range est. 0.2–1.5 bar. |
| Solenoid valve | 1/8" **NPT**, 2/2-way, **NC**, direct-acting, DC 24 V 4.8 W, IP65, 100 % ED | 200 mA — any Kraken fan/heater output, Klipper `[output_pin air_valve]`. NC = fails closed. Direct-acting = works at low pressure (pilot valves need ~0.5 bar minimum). Add **1N4007 flyback diode** across the coil (bare leads, no internal diode). Buy 2 (spare / future second nozzle). |
| Fittings | 1/8" **NPT** → 6 mm push-in, ×2 + PTFE tape | NPT, not G/BSP — mixing threads leaks. Order with the valve. |
| Nozzle | Blunt dispensing needles, Luer hub, 0.5–1.5 mm ID assortment | Needle ID is a swappable physical parameter: smaller bore = harder, narrower jet at same pressure. Luer hub adapts to tube on the sweep stepper shaft. |
| Placement | Valve on gantry next to pump; valve→nozzle tube **< 30 cm** | Unpressurized volume after the valve softens pulse edges and adds tail-hiss. Compressor→valve line can be long (3 m fine), compressor sits on the floor. |

### Nozzle rotation (sweep)

A small dedicated stepper (Kraken port 7) carries the tube end / needle;
azimuth = blow direction, and rotating **during** the pulse = sweep — a
fan-spread parameter a human mouth-blower cannot reproduce repeatably.
Keep it light (small-frame stepper); mount placement is an open question in
the carriage design (section 6).

### Rejected alternatives (keep for the record)

- **8 mm micro peristaltic (€5)**: dosing resolution fine, but needs a separate
  low-current driver (TMC2160 min current too high), and ~0.5 ml/min flow means
  ~10 s per 50 µl blot. Viable as lightweight per-color satellite pumps later.
- **Fans / blowers as air source**: axial fans reach ~0.1–0.3 kPa static, ~100×
  short of the ~5–15+ kPa needed for viscous fingering; throttling a fan into a
  nozzle collapses flow instead of building pressure.
- **Electric air dusters / 100k-rpm mini turbines (~3–6 kPa)**: would produce
  soft dendrites on thin inks only; 100–300 ms spin-up/down ramps kill pulse
  repeatability, 75–85 dB, vibration. Not a valve replacement.

### Idea parked: drying fan

A separate wide, low-pressure fan (or the turbine above) as a **drying tool**,
not a blowing tool: cure fresh blots/washes between passes so the pen or the
next color doesn't smear through wet ink, and possibly soft "wind wash" moves
on watercolor. Would be a plain Klipper PWM fan output + a `DRY_WAIT`-style
macro (fan on, dwell, fan off) between plot phases. Mount so it can't blast a
still-liquid blot hard enough to move it — distance/diffuser, aim shallow.
Not ordered yet; revisit after the first wet-media sessions show real drying
times.

---

## 5. Work surface (context)

- **Phase 1 (now):** steel bed + magnets. Magnet positions are computed by a
  Muusia "Safe Areas / Magnet Jig" tool and marked physically by driving the
  carriage (pen up, laser on) to each point. → the laser above is part of this.
- **Phase 2 (later):** CNC-milled zoned vacuum table.

### 5.1 Pen offset calibration (laser, KlipperScreen)

Designed August 2026; draft Klipper configs exist (see `klipper/` below), waiting
for the Kraken to be wired. Different pens (diameters, holders) put the tip at
slightly different XY positions — this workflow measures that per pen so all pens
follow the same line, entirely on the RPi touchscreen:

1. `PEN_CAL_MARK` — the pen draws a small **cross** at a fixed calibration point
   (cross center is easier to aim at than a dot), the carriage parks aside, laser ON.
2. Jog with the KlipperScreen Move panel until the laser dot sits on the cross center.
3. `PEN_CAL_SAVE` — an `action:prompt` touch dialog with buttons **Pen 1–12**
   (matches Muusia's pen count); the offset persists in `variables.cfg`
   via `[save_variables]`.
4. `PEN_USE PEN=n [REF=m]` before plotting — applies `SET_GCODE_OFFSET` so pen n
   follows reference pen m (default 1). Muusia's exported G-code stays offset-free;
   the correction lives entirely in Klipper at pen-change time.

**Geometry:** the measured delta per pen is `D = p − L` (pen-tip offset minus laser
offset, both relative to the carriage). `PEN_USE` applies `D_ref − D_n = p_ref − p_n`,
so the laser offset cancels and the reference pen keeps zero offset (old plots stay
in register). **Bonus:** saving the *reference* pen directly yields the Muusia
machine-profile laser offset: `laserOffX = −dx`, `laserOffY = −dy` — one calibration
feeds both this workflow and the magnet jig.

Prerequisites: paper must not move between steps 1 and 3 (magnets/tape); laser
rigidly mounted (section 3); `[output_pin laser]` pin is a TODO until the Kraken
is wired (same output the magnet jig's `laserOnCmd` uses).

**Draft configs live in `klipper/` at the repo root** (`printer.cfg`,
`pen-cal.cfg`, `KlipperScreen-pencal.conf`, `moonraker-cors.snippet.conf`,
plus a README with the firmware build recipe and the Pi↔repo sync
convention). The folder is
outside `src/` and `public/`, so it never touches the Vite build or Pages deploy;
final versions move to the Pi's `~/printer_data/config/` once the Kraken arrives,
with `klipper/` remaining the version-controlled source of truth.

---

## 6. What to design next (this is the task for the new chat)

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
8. **Ink nozzle sweep mount:** where the small nozzle-rotation stepper lives
   (carriage vs Z backbone with the nozzle reaching down), keeping the carriage
   light and the nozzle→blot geometry repeatable.

Constraints to respect:
- Keep carriage **light** (small servo, less inertia on the moving gantry).
- Keep pen tip, laser, and camera in **rigid, repeatable** relative positions.
- Lift only needs a few mm of vertical travel; favor force/precision over range.
- Everything Daniel builds is confirmed visually/iteratively before committing;
  he has a 3D printer and a CNC mill available for fabrication.

---

## 7. Related project docs (software side — not needed for mechanics)
- MUUSIA-MAGNET-JIG-SPEC.md — the Safe Areas / laser magnet-jig software feature.
- MUUSIA-HANDOFF.md — the Muusia app (node-graph editor) architecture.
