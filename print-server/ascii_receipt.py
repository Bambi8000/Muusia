"""Bounded printable ASCII programs for the receipt art node."""
import re
from receipt_limits import MAX_HEIGHT

WIDTH = 512
PAGE_ROWS = 1024

def escpos_text(body, cut=True):
    """Encode bounded printable ASCII using the TM-T88V's built-in font."""
    if "layers" in body:
        return overlay_program(body, cut)
    font = body.get("font")
    if font not in ("A", "B"):
        raise ValueError("Text font must be A or B")
    cell_width, cell_height = (12, 24) if font == "A" else (9, 17)
    size = body.get("size", 1)
    if type(size) is not int or not 1 <= size <= 8:
        raise ValueError("ASCII character size must be 1–8")
    cell_width *= size
    cell_height *= size
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
    out[9] = (size - 1) * 17
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
    if data[37:39] == b"\x1bL":
        return overlay_segments(data)
    spacing = data[36]
    rows_per_part = max(1, min(16, 288 // spacing))
    position, start, rows = 37, 0, 0
    parts = []
    while data[position:position + 2] == b"\x1b$":
        end = data.find(b"\n", position + 4)
        if end < 0:
            raise ValueError("Truncated ASCII row")
        position = end + 1
        rows += 1
        if rows == rows_per_part:
            parts.append((data[start:position], rows * spacing))
            start, rows = position, 0
    parts.append((data[start:], rows * spacing))
    return parts


def overlay_program(body, cut=True):
    layers = body.get("layers")
    if not isinstance(layers, list) or not 1 <= len(layers) <= 32 or any(not isinstance(layer, dict) or "layers" in layer for layer in layers):
        raise ValueError("ASCII Merge supports at most 32 flat text layers")
    programs = [escpos_text(layer, False) for layer in layers]
    height = max(len(layer["lines"]) * layer["lineSpacing"] for layer in layers)
    blocked = bytearray(height + 1)
    for layer in layers:
        glyph_height = (24 if layer["font"] == "A" else 17) * layer.get("size", 1)
        for row, line in enumerate(layer["lines"]):
            if line.strip():
                start = row * layer["lineSpacing"]
                blocked[start + 1:start + glyph_height] = b"\x01" * (glyph_height - 1)
    pages, start = [], 0
    while start < height:
        end = min(height, start + PAGE_ROWS)
        while end > start and blocked[end]:
            end -= 1
        if end == start:
            raise ValueError("Native ASCII overlap needs a shared row gap within 1024 dots. Increase Row gap or use a shorter canvas.")
        pages.append((start, end))
        start = end
    out = bytearray(programs[0][:37])
    def area(x, y, w, h):
        out.extend((27, 87, x & 255, x >> 8, y & 255, y >> 8, w & 255, w >> 8, h & 255, h >> 8))
    for start, end in pages:
        out.extend(b"\x1bL\x1bT\x00")
        area(0, 0, WIDTH, end - start)
        for layer in layers:
            size = layer.get("size", 1)
            baseline = (21 if layer["font"] == "A" else 16) * size
            out.extend((27, 77, int(layer["font"] == "B"), 29, 33, (size - 1) * 17))
            first = (start + layer["lineSpacing"] - 1) // layer["lineSpacing"]
            for row in range(first, len(layer["lines"])):
                y = row * layer["lineSpacing"]
                if y >= end:
                    break
                line = layer["lines"][row]
                if line.strip():
                    # GS $ addresses the font-scaled baseline. ESC W stays at
                    # the full page so no row area clips an enlarged glyph.
                    baseline_y = y - start + baseline
                    left = layer["left"]
                    out.extend((27, 36, left & 255, left >> 8, 29, 36, baseline_y & 255, baseline_y >> 8))
                    out.extend(line.encode("ascii"))
        out.append(12)
    if cut:
        out.extend(b"\x1dVA\x20")
    out.extend(b"\x1b@")
    return bytes(out)


def overlay_segments(data):
    """Acknowledge only after FF returns to Standard mode; skip numeric bytes."""
    parts, position, start, height = [], 37, 0, None
    while position < len(data):
        command = data[position:position + 2]
        if command == b"\x1bL":
            height = None
            position += 2
        elif command == b"\x1bW":
            if height is None:
                height = data[position + 8] + 256 * data[position + 9]
            position += 10
        elif command in (b"\x1bM", b"\x1bT", b"\x1d!"):
            position += 3
        elif command in (b"\x1b$", b"\x1d$"):
            position += 4
        elif data[position] == 12:
            position += 1
            parts.append((data[start:position], height))
            start = position
        elif command in (b"\x1dV", b"\x1b@"):
            break
        elif 32 <= data[position] <= 126:
            position += 1
        else:
            raise ValueError("Invalid generated ASCII overlay command")
    if start < len(data):
        parts.append((data[start:], 0))
    return parts

