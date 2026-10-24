# klipper/ — machine-side configs

The opt-in rigid-needle mode and its commissioning steps are documented in
[Needle setup](../docs/needle/README.md). Paper surface is work Z0; Muusia's
Needle Z preset limits exported plunges to 2 mm and lifts to Z3 for travel.
The needle configuration was installed on viivain on 2026-10-17 after a
backup and validation with its installed Jinja2/Mainsail. Klipper restarted
successfully and reports ready; needle mode remains off and uncalibrated.
No axis motion commands or physical needle tests were run; the needle holder
has not yet been built.

Klipper / Moonraker / KlipperScreen configuration for the X-Carve + BTT Kraken
plotter build. Parts written **before the Kraken is physically wired** carry
TODO markers (placeholder serial ID, unverified directions/travels). Do not
deploy blindly.

| File | What | Status |
|---|---|---|
| `printer.cfg` | Full machine config: Kraken v1.1 pin map (official BTT reference), X + dual-Y (single Y switch, motors home as a pair) + Z (no switch — virtual homing via `[homing_override]`), TMC2160-over-tmc5160 SPI sections, pen servo + `PEN_UP`/`PEN_DOWN`/`PEN_RELEASE`/`Z_ZERO_HERE` macros, S5 brush stepper stubbed out. | Draft — TODOs: MCU serial ID, directions, travels, rotation_distances |
| `moonraker-cors.snippet.conf` | Lines to merge into the existing `[authorization]` section of `moonraker.conf` on the Pi — enables the Muusia DRO websocket from local dev origins. Restart Moonraker after applying. | Applied on viivain 2026-07-31 |
| `dro/` | TM1637 DRO service: `dro_tm1637.py` (stdlib + python3-lgpio; polls Moonraker HTTP 10 Hz for `motion_report.live_position`, converted to work coordinates via the gcode_move offset, so the displays follow real motion rather than the queued target; bit-banged TM1637, `--test` mode for solder/digit-order checks) + `dro.service` systemd unit (`WorkingDirectory` required - lgpio writes its `.lgd-nfy*` files to CWD). Pin/cable plan in MECH handoff §1. Power from 3V3 only. | Verified on viivain 2026-08-24: DIGIT_MAP = [2,1,0,5,4,3] (cross-wired boards), Z display on BCM 20/21 (phys 38/40), live readout running |
| `crowsnest.conf` | Crowsnest webcam config: Logitech BRIO via by-id path, 1080p@15fps MJPG, ustreamer on port 8080 (`/webcam/?action=stream`). | Installed and streaming on viivain 2026-08-12 |
| `moonraker.conf` | Moonraker config incl. the `[timelapse]` component (moonraker-timelapse, hyperlapse via BRIO). | Synced from viivain 2026-08-12 |
| `telegram.conf.example` | Sanitized template for moonraker-telegram-bot (status/photo/timelapse to phone). Real `telegram.conf` with bot token + chat id lives only on the Pi and is gitignored. | Bot running on viivain 2026-08-12 |
| `canvas-check.cfg` | `CANVAS_CHECK` macro — laser-framed job-bounds check: travel guard, Continue/Abort touch prompt, laser-dark smoke mode until the laser pin exists. Called from Muusia's exported G-code (profile toggle `canvasCheckOn`, v2.53). | Draft — laser pin TODO; motion untested until the Kraken |
| `pen-cal.cfg` | Laser-guided pen offset calibration macros (`PEN_CAL_MARK` / `PEN_CAL_SAVE` / `PEN_CAL_SET` / `PEN_USE`). 12 pens, matching Muusia. | Draft — laser pin + PEN_UP/DOWN stubs are TODO |
| `KlipperScreen-pencal.conf` | Optional Pen Cal menu for KlipperScreen | Draft |

See MUUSIA-PLOTTER-MECH-HANDOFF.md §5.1 for the pen-cal workflow and offset math.

## Paper loading: Prepare and Print Start

`printer.cfg` includes `prepare.cfg`. **Prepare** is on the idle touchscreen
menu and the `PREPARE` macro is also available in Mainsail. Five seconds after
Klipper becomes ready, including a firmware/software restart, it automatically
runs the same sequence: pen up → full homing (existing Z-first override) → park
at **machine X0 Y450**, with Z left at its homed clearance height. It then stays
idle displaying “Place paper, then run PRINT_START”. No job file is started and
there is no automatic pen seating, pause, resume or timed continuation.

Prepare clears paper and G92 coordinate offsets so X0 Y450 is a machine position,
independent of the previous paper origin. After placing the paper, press
**Print Start** (`PRINT_START`): this is an alias for the existing `PLOT_START`
fixed-block pen setup. Existing `PLOT_START`, M0 pen changes, PLOT_GO and Resume
remain unchanged. Preparation is rejected while printing/paused or in needle
mode; a pending startup action is cancelled by either button. The startup hook
skips active jobs/needle mode and does not retry later. Rigid needles continue
to use their separate calibration workflow.

Back up the live files before installing `prepare.cfg`, the single include in
`printer.cfg`, and the updated `viivain-screen.conf`. Restarting Klipper activates
the automatic movement; restarting KlipperScreen reloads the buttons. Set
`initial_duration: 0` in the delayed section to disable automatic preparation
while retaining the manual button. `python3 tools/validate-prepare-klipper.py`
renders the real templates offline, including shifted coordinates, job/needle
guards, startup scheduling and screen actions. No axes move during this check.

## Firmware build (Kraken v1.1)

Built on the Pi (`viivain`), Klipper v0.13.0-718 at the time of writing. The
compiled binary is a generated artifact and is NOT committed — only the recipe:

```
cd ~/klipper
make menuconfig
```

menuconfig settings:

- Micro-controller Architecture: **STMicroelectronics STM32**
- Processor model: **STM32H723**
- Bootloader offset: **128KiB bootloader**
- Clock Reference: **25 MHz crystal**
- Communication interface: **USB (on PA11/PA12)**
- Everything else at defaults

```
make clean && make
```

Output: `~/klipper/out/klipper.bin`. A dated copy is kept on the Pi in
`~/firmware/`. Rebuild after any Klipper host update so host and MCU stay on
the same version (`.config` persists the settings — `make clean && make` is
enough).

Flashing (when the Kraken arrives): rename to `firmware.bin` on a microSD, or
DFU over USB — verify the current recommended route in the BTT Kraken docs
before first flash. After flashing, fill in the real serial ID in
`printer.cfg`: `ls /dev/serial/by-id/*`.

## Conventions

- This folder is the **version-controlled source of truth**; the live copies go
  to the Pi (`viivain`, 192.168.0.57) at `~/printer_data/config/` and are synced
  back here after on-machine edits (Mainsail edits count as on-machine edits).
- Sync by scp, e.g. `scp viivain:printer_data/config/printer.cfg klipper/`
  (pull) or the reverse (push), then commit with the reason for the change.
- Not part of the Vite build or the Pages deploy (outside `src/` and `public/`).
- One file per concern.
- The Muusia DRO (`src/dro.jsx`) is read-only and LAN/local only by design:
  the GitHub Pages build shows a red/failed DRO because browsers block
  insecure `ws://` from an `https://` page — correct behavior, not a bug.
