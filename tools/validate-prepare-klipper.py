"""Offline rendering and coordinate checks for paper-loading macros; no MCU access.
Optional --config-dir validates a staged/live configuration directory.
Optional --klipper-source uses its real GCodeMove coordinate commands offline.
"""
import argparse
import configparser
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace as NS
from jinja2 import Environment, StrictUndefined

args = argparse.ArgumentParser()
args.add_argument('--config-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'klipper')
args.add_argument('--klipper-source', type=Path)
args = args.parse_args()
cfg = configparser.RawConfigParser(strict=True)
assert cfg.read(args.config_dir / 'prepare.cfg')
screen = configparser.RawConfigParser(strict=True)
assert screen.read(args.config_dir / 'viivain-screen.conf')
env = Environment(variable_start_string='{', variable_end_string='}', undefined=StrictUndefined)
for section in cfg.sections():
    if cfg.has_option(section, 'gcode'):
        env.from_string(cfg.get(section, 'gcode'))

def error(message):
    raise ValueError(message)


def state():
    return {
        'gcode_macro PREPARE': NS(park_x=0., park_y=450., travel_f=3600.),
        'gcode_macro _NEEDLE_MODE': NS(active=False),
        'toolhead': NS(homed_axes='', axis_minimum=NS(x=0., y=0., z=0.), axis_maximum=NS(x=793., y=813., z=75.)),
        'gcode_move': NS(position=NS(x=100., y=200., z=19.)),
        'print_stats': NS(state='standby'),
        'pause_resume': NS(is_paused=False),
    }


def render(section, printer):
    text = env.from_string(cfg.get(section, 'gcode')).render(printer=printer, params={}, rawparams='', action_raise_error=error)
    return [line.split('#', 1)[0].strip() for line in text.splitlines() if line.strip() and not line.strip().startswith('#')]


def rejected(section, printer):
    try:
        render(section, printer)
    except ValueError:
        return
    raise AssertionError(section + ' should reject this state')


checks = 0
# Ordered nested execution: the park helper must read the newly homed position,
# not the old position captured during the parent macro's template expansion.
for offset in [(0., 0., 0.), (42., 20., 10.5), (-200., 60., -5.)]:
    for shift in [(0., 0., 0.), (12., -8., 3.)]:
        p = state()
        homing = list(offset)
        base = [a+b for a, b in zip(offset, shift)]
        trace = []
        position = [100., 200., 19.]

        def execute(section):
            for line in render(section, p):
                trace.append(line)
                cmd = line.split()[0]
                if cmd == 'G28':
                    position[:] = [0., 0., 75.]
                    p['gcode_move'].position = NS(x=0., y=0., z=75.)
                    p['toolhead'].homed_axes = 'xyz'
                elif cmd == '_PREPARE_PARK':
                    execute('gcode_macro _PREPARE_PARK')
                elif cmd in ['SET_GCODE_OFFSET', 'G92', 'G1']:
                    values = {part[0]: float(part[1:]) for part in line.split()[1:] if part[0] in 'XYZF' and '=' not in part}
                    if cmd == 'SET_GCODE_OFFSET':
                        for i in range(3):
                            base[i] -= homing[i]
                            homing[i] = 0.
                    elif cmd == 'G92':
                        for i, axis in enumerate('XYZ'):
                            base[i] = position[i] - values[axis]
                    else:
                        for i, axis in enumerate('XYZ'):
                            if axis in values:
                                position[i] = values[axis] + base[i]
                elif cmd.startswith('G') and cmd not in ['G90']:
                    raise AssertionError('Unexpected movement command ' + line)
        execute('gcode_macro PREPARE')
        assert position == [0., 450., 75.], (offset, shift, position)
        assert homing == base == [0., 0., 0.]
        assert trace.index('PEN_UP') < trace.index('G28') < trace.index('_PREPARE_PARK')
        assert 'G92 X0.0 Y0.0 Z75.0' in trace
        assert trace[-1] == 'M117 Place paper, then run PRINT_START'
        assert not any(line.split()[0] in ['PEN_DOWN', 'PLOT_START', 'PRINT_START', 'M0', 'PAUSE', 'RESUME', 'SDCARD_PRINT_FILE'] for line in trace)
        checks += 1

for job in ['printing', 'paused']:
    p = state(); p['print_stats'].state = job
    for section in ['gcode_macro PREPARE', 'gcode_macro PRINT_START']:
        rejected(section, p); checks += 1
p = state(); p['pause_resume'].is_paused = True
rejected('gcode_macro PREPARE', p); rejected('gcode_macro PRINT_START', p); checks += 2
p = state(); p['gcode_macro _NEEDLE_MODE'].active = True
rejected('gcode_macro PREPARE', p); checks += 1
for axes in ['', 'xy', 'xz', 'yz']:
    p = state(); p['toolhead'].homed_axes = axes
    rejected('gcode_macro _PREPARE_PARK', p); checks += 1
for x, y in [(-1., 450.), (794., 450.), (0., -1.), (0., 814.)]:
    p = state(); p['gcode_macro PREPARE'].park_x = x; p['gcode_macro PREPARE'].park_y = y
    rejected('gcode_macro PREPARE', p); checks += 1

for job in ['standby', 'complete', 'cancelled', 'printing', 'paused']:
    for needle in [False, True]:
        p = state(); p['print_stats'].state = job; p['gcode_macro _NEEDLE_MODE'].active = needle
        assert ('PREPARE' in render('delayed_gcode _MUUSIA_PREPARE_BOOT', p)) == (job not in ['printing', 'paused'] and not needle)
        checks += 1
p = state(); p['pause_resume'].is_paused = True
assert 'PREPARE' not in render('delayed_gcode _MUUSIA_PREPARE_BOOT', p); checks += 1
assert cfg.getfloat('delayed_gcode _MUUSIA_PREPARE_BOOT', 'initial_duration') == 5.
for section in ['gcode_macro PREPARE', 'gcode_macro PRINT_START']:
    assert 'UPDATE_DELAYED_GCODE ID=_MUUSIA_PREPARE_BOOT DURATION=0' in render(section, state())
assert render('gcode_macro PRINT_START', state())[-1] == 'PLOT_START'
assert json.loads(screen.get('menu __main prepare', 'params')) == {'script': 'PREPARE'}
assert screen.get('menu __main prepare', 'name') == 'Prepare'
assert json.loads(screen.get('menu __main plot_start', 'params')) == {'script': 'PRINT_START'}
assert 'PREPARE' in screen.get('menu __main prepare', 'enable')
assert '[include prepare.cfg]' in (args.config_dir / 'printer.cfg').read_text()
checks += 6

if args.klipper_source:
    # Instantiate no printer/MCU: exercise only installed coordinate-transform
    # command methods to verify the G92 reset after a previous paper/G92 shift.
    source = args.klipper_source / 'klippy/extras/gcode_move.py'
    spec = importlib.util.spec_from_file_location('prepare_offline_gcode_move', source)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    class Command:
        def __init__(self, values): self.values = values
        def get_float(self, key, default=None, **unused): return self.values.get(key, default)
        def get_int(self, key, default=0, **unused): return int(self.values.get(key, default))
    for offset in [(42., 20., 10.5), (-20., 60., -4.)]:
        obj = mod.GCodeMove.__new__(mod.GCodeMove)
        obj.homing_position = [*offset, 0.]
        obj.base_position = [offset[0]+12., offset[1]-8., offset[2]+3., 0.]
        obj.last_position = [0., 0., 75., 0.]; obj.extrude_factor = 1.
        obj.cmd_SET_GCODE_OFFSET(Command({'X': 0., 'Y': 0., 'Z': 0., 'MOVE': 0}))
        obj.cmd_G92(Command({'X': 0., 'Y': 0., 'Z': 75.}))
        assert obj.base_position == obj.homing_position == [0., 0., 0., 0.]
        checks += 1
print('Prepare: %s offline template, ordering, machine-coordinate, startup, guard and touchscreen checks passed.' % checks)
