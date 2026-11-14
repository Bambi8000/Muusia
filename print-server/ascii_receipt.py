"""Bounded printable ASCII programs for the receipt art node."""
import re
from receipt_limits import MAX_HEIGHT

WIDTH = 512

def escpos_text(body, cut=True):
    """Encode bounded printable ASCII using the TM-T88V's built-in font."""
    font = body.get("font")
    if font not in ("A", "B"):
        raise ValueError("Text font must be A or B")
    cell_width, cell_height = (12, 24) if font == "A" else (9, 17)
    spacing, left, lines = body.get("lineSpacing"), body.get("left"), body.get("lines")
    if type(spacing) is not int or not cell_height <= spacing <= 255:
        raise ValueError("Invalid text line spacing")
    if type(left) is not int or not 0 <= left < WIDTH:
        raise ValueError("Invalid text left position")
    if not isinstance(lines, list) or not lines or len(lines) * spacing > MAX_HEIGHT:
        raise ValueError("Text receipt is empty or too long")
    for line in lines:
        if not isinstance(line, str) or not re.fullmatch(r"[\x20-\x7e]*", line) or len(line) * cell_width + left > WIDTH:
            raise ValueError("Text rows must be printable ASCII within 512 dots")
    out = bytearray(b"\x1b@\x1c.\x1bM")
    out.append(1 if font == "B" else 0)
    out.extend(b"\x1d!\x00\x1bR\x00\x1bt\x00\x1b \x00\x1ba\x00\x1dL\x00\x00\x1dW\x00\x02\x1dP\xb4\xb4\x1b3")
    out.append(spacing)
    for line in lines:
        out.extend((27, 36, left & 255, left >> 8))
        out.extend(line.encode("ascii"))
        out.append(10)
    if cut:
        out.extend(b"\x1dV\x41\x20")
    out.extend(b"\x1b@")
    return bytes(out)


def program_segments(data):
    """Keep native text in small acknowledged windows without splitting commands."""
    # escpos_text owns this fixed header. Skip each four-byte ESC $ position
    # before finding LF: its numeric position byte may itself equal 0x0A.
    spacing = data[36]
    position, start, rows = 37, 0, 0
    parts = []
    while data[position:position + 2] == b"\x1b$":
        end = data.find(b"\n", position + 4)
        if end < 0:
            raise ValueError("Truncated ASCII row")
        position = end + 1
        rows += 1
        if rows == 16:
            parts.append((data[start:position], rows * spacing))
            start, rows = position, 0
    parts.append((data[start:], rows * spacing))
    return parts

