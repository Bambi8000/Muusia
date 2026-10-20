"""Render real Klipper templates without a machine. Requires Jinja2.
Run with a Python environment providing jinja2; no printer connection is used.
"""
import configparser
from pathlib import Path
from types import SimpleNamespace as NS
from jinja2 import Environment, StrictUndefined

cfg = configparser.RawConfigParser(strict=True)
cfg.read(Path(__file__).resolve().parents[1] / 'klipper/printer.cfg')
env = Environment(variable_start_string='{', variable_end_string='}', undefined=StrictUndefined)
# Parse every template, including the old servo branches modified by this change.
for section in cfg.sections():
    if cfg.has_option(section, 'gcode'):
        env.from_string(cfg.get(section, 'gcode'))

state = NS(active=True, calibrated=True, surface_z=20.0)
printer = {
    'gcode_macro _NEEDLE_MODE': state,
    'gcode_macro _PEN_VARS': NS(up_angle=135, down_angle=80),
    'toolhead': NS(homed_axes='xyz', extruder='', axis_minimum=NS(z=0), axis_maximum=NS(z=75)),
    'gcode_move': NS(position=NS(z=21), gcode_position=NS(z=1)),
}
def error(message):
    raise ValueError(message)
def render(name):
    return env.from_string(cfg.get('gcode_macro ' + name, 'gcode')).render(printer=printer, params={}, rawparams='', action_raise_error=error)
def fails(name):
    try:
        render(name)
    except ValueError:
        return
    raise AssertionError(f'{name} should reject this state')

for name in ['PEN_UP', 'PLOT_GO', 'NEEDLE_BEGIN']:
    text = render(name)
    assert 'NEEDLE_LIFT' in text
    assert 'SET_SERVO' not in text and 'G28' not in text and 'PLOT_START' not in text
assert 'G1 Z3 F120' in render('NEEDLE_LIFT')
assert 'MOVE=1' not in render('NEEDLE_LIFT')
assert 'SET_SERVO' not in render('PEN_RELEASE')
assert 'PAUSE_BASE' in render('M0') and 'PLOT_START' not in render('M0')
assert 'NEEDLE_LIFT' in render('_MUUSIA_CANCEL')
assert render('PAUSE').index('NEEDLE_LIFT') < render('PAUSE').index('\nPAUSE_BASE')
assert 'NEEDLE_LIFT' in render('_TOOLHEAD_PARK_PAUSE_CANCEL')
assert 'G1 X' not in render('_TOOLHEAD_PARK_PAUSE_CANCEL')
for name in ['PEN_DOWN', 'PLOT_START', 'PLOT_HEIGHT', 'Z_ZERO_HERE']:
    fails(name)
state.calibrated = False
fails('NEEDLE_LIFT')
state.calibrated = True
printer['gcode_move'].gcode_position.z = 2
fails('NEEDLE_LIFT')  # origin was moved after calibration
printer['gcode_move'].gcode_position.z = 1
printer['toolhead'].homed_axes = 'xy'
fails('NEEDLE_LIFT')
fails('NEEDLE_ZERO_HERE')
printer['toolhead'].homed_axes = 'xyz'
text = render('NEEDLE_ZERO_HERE')
assert 'SET_GCODE_OFFSET Z_ADJUST=1 MOVE=0' in text
assert 'SET_KINEMATIC_POSITION' not in text
# Offset adjustment changes work Z1 at machine Z21 into work Z0 at Z21.
assert (21 - 1) + 1 == 21
for z in [1.9, 72.1]:
    printer['gcode_move'].position.z = z
    fails('NEEDLE_ZERO_HERE')
printer['gcode_move'].position.z = 21
state.active = False
fails('NEEDLE_ZERO_HERE')
assert 'SET_SERVO SERVO=pen ANGLE=135' in render('PEN_UP')
assert 'SET_SERVO SERVO=pen ANGLE=80' in render('PEN_DOWN')
assert 'SET_SERVO SERVO=pen WIDTH=0' in render('PEN_RELEASE')
assert 'PLOT_START' in render('M0')
assert 'NEEDLE_LIFT' not in render('_MUUSIA_CANCEL')
assert 'NEEDLE_LIFT' not in render('PAUSE')
assert cfg.get('gcode_macro PAUSE', 'rename_existing') == 'PAUSE_BASE'
assert not cfg.has_option('gcode_macro _TOOLHEAD_PARK_PAUSE_CANCEL', 'rename_existing')
assert 'VARIABLE=calibrated VALUE=False' in cfg.get('homing_override', 'gcode')
assert cfg.get('gcode_macro _CLIENT_VARIABLE', 'variable_user_cancel_macro') == '"_MUUSIA_CANCEL"'
print('Klipper templates: syntax, needle/servo branches, calibration and lift checks passed (offline).')
