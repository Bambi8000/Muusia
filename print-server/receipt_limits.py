"""Calibrated whole-job limits; individual ESC/POS commands remain 256 rows."""
import math

DOTS_PER_MM = 400 / 56.6
MAX_LENGTH_MM = 50000
MAX_HEIGHT = math.ceil(MAX_LENGTH_MM * DOTS_PER_MM)
MAX_BODY = 32_000_000
MAX_IMPORT = 64_000_000
