#!/usr/bin/env python3
"""TM1637 DRO service for the Muusia plotter.

Drives 3x TM1637 6-digit 7-segment displays (X, Y, Z work coordinates)
from Moonraker on localhost. Runs as a systemd service on the Pi (viivain).

Design notes:
- Moonraker is read over plain HTTP polling (urllib, stdlib) instead of the
  websocket: zero pip dependencies, and localhost polling at 10 Hz outpaces
  Moonraker's 250 ms websocket status throttle anyway.
- GPIO via lgpio (python3-lgpio, stock on Raspberry Pi OS Bookworm+).
- TM1637 is bit-banged; the protocol is 2-wire (CLK+DIO), NOT I2C.
- Displays are powered from 3V3 (pin 17). Do NOT use 5 V: the module pulls
  DIO/CLK up to VCC and the Pi's GPIO pins are not 5 V tolerant.

Test mode (run before enclosing the displays!):
    python3 dro_tm1637.py --test
  Cycles identification and digit-order patterns. Six-digit TM1637 boards
  often have the two 3-digit groups cross-wired; if "123456" renders as
  "321654", set DIGIT_MAP = [2, 1, 0, 5, 4, 3] below.
"""

import json
import sys
import time
import urllib.request

import lgpio

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

MOONRAKER = "http://127.0.0.1:7125"
POLL_HZ = 10.0
BRIGHTNESS = 5          # 0..7
GPIOCHIP = 0            # main GPIO block on the Pi 4

# BCM pin numbers (physical pins in comments). 3V3 = phys 17, GND = phys 39.
DISPLAYS = {
    "x": {"clk": 5,  "dio": 6},    # phys 29 / 31
    "y": {"clk": 13, "dio": 19},   # phys 33 / 35
    "z": {"clk": 20, "dio": 21},   # phys 38 / 40
}

# Physical digit position i shows logical digit DIGIT_MAP[i] (0 = leftmost).
# Straight boards: [0,1,2,3,4,5]. Cross-wired 6-digit boards: [2,1,0,5,4,3].
DIGIT_MAP = [2, 1, 0, 5, 4, 3]

# --------------------------------------------------------------------------
# TM1637 driver (bit-banged over lgpio)
# --------------------------------------------------------------------------

SEG = {
    "0": 0x3F, "1": 0x06, "2": 0x5B, "3": 0x4F, "4": 0x66,
    "5": 0x6D, "6": 0x7D, "7": 0x07, "8": 0x7F, "9": 0x6F,
    "-": 0x40, " ": 0x00, "E": 0x79, "r": 0x50,
}
DP = 0x80
T = 3e-6  # half-clock delay; TM1637 is happy well below its ~250 kHz max


class TM1637:
    def __init__(self, handle, clk, dio):
        self.h = handle
        self.clk = clk
        self.dio = dio
        lgpio.gpio_claim_output(self.h, self.clk, 1)
        lgpio.gpio_claim_output(self.h, self.dio, 1)

    def _delay(self):
        time.sleep(T)

    def _start(self):
        lgpio.gpio_write(self.h, self.dio, 0)
        self._delay()
        lgpio.gpio_write(self.h, self.clk, 0)
        self._delay()

    def _stop(self):
        lgpio.gpio_write(self.h, self.dio, 0)
        self._delay()
        lgpio.gpio_write(self.h, self.clk, 1)
        self._delay()
        lgpio.gpio_write(self.h, self.dio, 1)
        self._delay()

    def _write_byte(self, b):
        for _ in range(8):
            lgpio.gpio_write(self.h, self.dio, b & 1)
            self._delay()
            lgpio.gpio_write(self.h, self.clk, 1)
            self._delay()
            lgpio.gpio_write(self.h, self.clk, 0)
            b >>= 1
        # ACK slot: release DIO (input + pull-up), clock once, reclaim.
        lgpio.gpio_claim_input(self.h, self.dio, lgpio.SET_PULL_UP)
        self._delay()
        lgpio.gpio_write(self.h, self.clk, 1)
        self._delay()
        lgpio.gpio_write(self.h, self.clk, 0)
        lgpio.gpio_claim_output(self.h, self.dio, 1)
        self._delay()

    def show(self, segs):
        """segs: iterable of 6 segment bytes, physical order left->right."""
        self._start()
        self._write_byte(0x40)              # data command, auto-increment
        self._stop()
        self._start()
        self._write_byte(0xC0)              # address 0
        for s in segs:
            self._write_byte(s)
        self._stop()
        self._start()
        self._write_byte(0x88 | (BRIGHTNESS & 0x07))  # display on
        self._stop()


def encode(text):
    """'-123.45' -> 6 segment bytes (logical order), dp folded into prior digit."""
    raw = []
    for ch in text:
        if ch == ".":
            if raw:
                raw[-1] |= DP
            continue
        raw.append(SEG.get(ch, 0x00))
    raw = ([SEG[" "]] * 6 + raw)[-6:]       # right-align, blank-pad, clamp
    return [raw[DIGIT_MAP[i]] for i in range(6)]


def fmt(v):
    """mm -> 6-glyph string: 2 decimals under 1000, 1 decimal above."""
    dec = 2 if abs(v) < 1000 else 1
    s = f"{v:.{dec}f}"
    while len(s.replace(".", "")) > 6:      # overflow -> drop decimals
        if dec == 0:
            return "Err   "
        dec -= 1
        s = f"{v:.{dec}f}"
    return s


# --------------------------------------------------------------------------
# Moonraker
# --------------------------------------------------------------------------

QUERY = (MOONRAKER + "/printer/objects/query"
         "?motion_report=live_position&gcode_move=gcode_position,position")


def read_position():
    """Returns [x, y, z] live work coordinates, or None on any failure.

    live_position is where the toolhead actually is right now (it advances as
    the steppers step), but it is expressed in machine coordinates. The
    commanded pair from gcode_move gives the offset currently in force
    (G92 base + SET_GCODE_OFFSET, i.e. Z_ZERO_HERE); subtracting it lands the
    reading back in work coordinates - the same origin Mainsail shows, but
    following real motion instead of the queued target.
    """
    try:
        with urllib.request.urlopen(QUERY, timeout=1.0) as r:
            data = json.load(r)
        st = data["result"]["status"]
        live = st["motion_report"]["live_position"]
        gm = st["gcode_move"]
        off = [gm["position"][i] - gm["gcode_position"][i] for i in range(3)]
        return [live[i] - off[i] for i in range(3)]
    except Exception:
        return None


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    h = lgpio.gpiochip_open(GPIOCHIP)
    disp = {ax: TM1637(h, p["clk"], p["dio"]) for ax, p in DISPLAYS.items()}

    if "--test" in sys.argv:
        print("Test mode: Ctrl-C to stop.")
        print("Identify: x=111111 y=222222 z=333333, then digit order 123456.")
        try:
            while True:
                for i, ax in enumerate(("x", "y", "z"), start=1):
                    disp[ax].show(encode(str(i) * 6))
                time.sleep(2.0)
                for ax in disp:
                    disp[ax].show(encode("123456"))
                time.sleep(2.0)
                for ax in disp:
                    disp[ax].show(encode("-88.88"))
                time.sleep(2.0)
        except KeyboardInterrupt:
            for ax in disp:
                disp[ax].show(encode("      "))
            return

    period = 1.0 / POLL_HZ
    dashes = encode("------")
    was_ok = False
    while True:
        t0 = time.monotonic()
        pos = read_position()
        if pos is None:
            if was_ok:
                for ax in disp:
                    disp[ax].show(dashes)
                was_ok = False
            time.sleep(1.0)
            continue
        was_ok = True
        for i, ax in enumerate(("x", "y", "z")):
            disp[ax].show(encode(fmt(pos[i])))
        dt = period - (time.monotonic() - t0)
        if dt > 0:
            time.sleep(dt)


if __name__ == "__main__":
    main()
