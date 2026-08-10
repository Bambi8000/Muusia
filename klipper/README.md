# klipper/ — machine-side configs

Klipper / Moonraker / KlipperScreen configuration for the X-Carve + BTT Kraken
plotter build. Parts written **before the Kraken is physically wired** carry
TODO markers (placeholder serial ID, unverified directions/travels). Do not
deploy blindly.

| File | What | Status |
|---|---|---|
| `printer.cfg` | Full machine config: Kraken v1.1 pin map (official BTT reference), X + dual-Y (single Y switch, motors home as a pair) + Z (no switch — virtual homing via `[homing_override]`), TMC2160-over-tmc5160 SPI sections, pen servo + `PEN_UP`/`PEN_DOWN`/`PEN_RELEASE`/`Z_ZERO_HERE` macros, S5 brush stepper stubbed out. | Draft — TODOs: MCU serial ID, directions, travels, rotation_distances |
| `moonraker-cors.snippet.conf` | Lines to merge into the existing `[authorization]` section of `moonraker.conf` on the Pi — enables the Muusia DRO websocket from local dev origins. Restart Moonraker after applying. | Applied on nakit 2026-07-31 |
| `dro/` | TM1637 DRO service: `dro_tm1637.py` (stdlib + python3-lgpio; polls Moonraker HTTP 10 Hz, bit-banged TM1637, `--test` mode for solder/digit-order checks) + `dro.service` systemd unit. Pin/cable plan in MECH handoff §1. Power from 3V3 only. | Service running on nakit 2026-08-10; DIGIT_MAP pending first hookup test |
| `canvas-check.cfg` | `CANVAS_CHECK` macro — laser-framed job-bounds check: travel guard, Continue/Abort touch prompt, laser-dark smoke mode until the laser pin exists. Called from Muusia's exported G-code (profile toggle `canvasCheckOn`, v2.53). | Draft — laser pin TODO; motion untested until the Kraken |
| `pen-cal.cfg` | Laser-guided pen offset calibration macros (`PEN_CAL_MARK` / `PEN_CAL_SAVE` / `PEN_CAL_SET` / `PEN_USE`). 12 pens, matching Muusia. | Draft — laser pin + PEN_UP/DOWN stubs are TODO |
| `KlipperScreen-pencal.conf` | Optional Pen Cal menu for KlipperScreen | Draft |

See MUUSIA-PLOTTER-MECH-HANDOFF.md §5.1 for the pen-cal workflow and offset math.

## Firmware build (Kraken v1.1)

Built on the Pi (`nakit`), Klipper v0.13.0-718 at the time of writing. The
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
  to the Pi (`nakit`, 192.168.0.57) at `~/printer_data/config/` and are synced
  back here after on-machine edits (Mainsail edits count as on-machine edits).
- Sync by scp, e.g. `scp nakit@192.168.0.57:printer_data/config/printer.cfg klipper/`
  (pull) or the reverse (push), then commit with the reason for the change.
- Not part of the Vite build or the Pages deploy (outside `src/` and `public/`).
- One file per concern.
- The Muusia DRO (`src/dro.jsx`) is read-only and LAN/local only by design:
  the GitHub Pages build shows a red/failed DRO because browsers block
  insecure `ws://` from an `https://` page — correct behavior, not a bug.
