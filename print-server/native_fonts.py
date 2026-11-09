"""Bounded, printer-native ESC/POS font tests for Epson TM-T88V.

The preview is an approximation: the printer renders its own ROM glyphs.
"""

import codecs
import re
import unicodedata
from dataclasses import dataclass


# Epson TM-T88V standard model: 42 fixed single-byte pages plus the empty,
# user-defined page 255. A codec is only supplied where Python maps Unicode
# to the same named page. Every fixed page remains usable by raw glyph byte.
CODE_PAGES = {
    0: ("PC437 · USA / Europe", "cp437"),
    1: ("Katakana", None),
    2: ("PC850 · Multilingual", "cp850"),
    3: ("PC860 · Portuguese", "cp860"),
    4: ("PC863 · Canadian French", "cp863"),
    5: ("PC865 · Nordic", "cp865"),
    11: ("PC851 · Greek", None),
    12: ("PC853 · Turkish", None),
    13: ("PC857 · Turkish", "cp857"),
    14: ("PC737 · Greek", "cp737"),
    15: ("ISO 8859-7 · Greek", "iso8859_7"),
    16: ("Windows 1252 · Western", "cp1252"),
    17: ("PC866 · Cyrillic", "cp866"),
    18: ("PC852 · Central Europe", "cp852"),
    19: ("PC858 · Euro", "cp858"),
    20: ("Thai 42", None),
    21: ("Thai 11", None),
    26: ("Thai 18", None),
    30: ("TCVN-3 · Vietnamese 1", None),
    31: ("TCVN-3 · Vietnamese 2", None),
    32: ("PC720 · Arabic", "cp720"),
    33: ("PC775 · Baltic", "cp775"),
    34: ("PC855 · Cyrillic", "cp855"),
    35: ("PC861 · Icelandic", "cp861"),
    36: ("PC862 · Hebrew", "cp862"),
    37: ("PC864 · Arabic", "cp864"),
    38: ("PC869 · Greek", "cp869"),
    39: ("ISO 8859-2 · Central Europe", "iso8859_2"),
    40: ("ISO 8859-15 · Western / Euro", "iso8859_15"),
    41: ("PC1098 · Farsi", None),
    42: ("PC1118 · Lithuanian", None),
    43: ("PC1119 · Lithuanian", None),
    44: ("PC1125 · Ukrainian", "cp1125"),
    45: ("Windows 1250 · Central Europe", "cp1250"),
    46: ("Windows 1251 · Cyrillic", "cp1251"),
    47: ("Windows 1253 · Greek", "cp1253"),
    48: ("Windows 1254 · Turkish", "cp1254"),
    49: ("Windows 1255 · Hebrew", "cp1255"),
    50: ("Windows 1256 · Arabic", "cp1256"),
    51: ("Windows 1257 · Baltic", "cp1257"),
    52: ("Windows 1258 · Vietnamese", "cp1258"),
    53: ("KZ-1048 · Kazakhstan", None),
}

COUNTRIES = (
    "USA", "France", "Germany", "UK", "Denmark I", "Sweden", "Italy",
    "Spain I", "Japan", "Norway", "Denmark II", "Spain II", "Latin America",
    "Korea", "Slovenia / Croatia", "China", "Vietnam", "Arabia",
)


def _codec(page):
    name = CODE_PAGES[page][1]
    if name is None:
        return None
    try:
        codecs.lookup(name)
    except LookupError:
        return None
    return name


def page_catalog():
    return {"pages": [{"id": number, "name": name, "unicodeInput": _codec(number) is not None}
                      for number, (name, _) in CODE_PAGES.items()],
            "countries": [{"id": number, "name": name} for number, name in enumerate(COUNTRIES)],
            "userDefinedPage": 255}


def page_glyphs(page):
    if page not in CODE_PAGES:
        raise ValueError("Unsupported character page")
    codec = _codec(page)
    glyphs = []
    for byte in range(0x20, 0x100):
        char = None
        if codec:
            try:
                decoded = bytes((byte,)).decode(codec)
                if len(decoded) == 1 and not unicodedata.category(decoded).startswith("C"):
                    char = decoded
            except UnicodeDecodeError:
                pass
        glyphs.append({"hex": f"{byte:02X}", "char": char})
    return {"id": page, "name": CODE_PAGES[page][0], "unicodeInput": codec is not None,
            "glyphs": glyphs,
            "note": "Characters are estimates from standard mappings. Print a page atlas to see this Epson's ROM glyphs."}


@dataclass(frozen=True)
class NativeTest:
    id: str
    name: str
    description: str
    data: bytes
    preview: tuple[str, ...]


class Builder:
    def __init__(self):
        self.data = bytearray(b"\x1b@")
        self.preview = []

    def line(self, value, *, font="A", width=1, height=1, bold=False,
             underline=False, reverse=False, align=0, page=0, country=0,
             encoding="ascii", display=None):
        if font not in ("A", "B") or not 1 <= width <= 8 or not 1 <= height <= 8:
            raise ValueError("Unsupported native font or size")
        if page not in CODE_PAGES or country not in range(len(COUNTRIES)) or align not in (0, 1, 2):
            raise ValueError("Unsupported code page, country or alignment")
        raw = value if isinstance(value, bytes) else value.encode(encoding)
        if any(byte in (0x0A, 0x0D, 0x1B, 0x1D) for byte in raw):
            raise ValueError("Control bytes are not allowed inside text")
        self.data.extend(b"\x1bM" + bytes((font == "B",)))
        self.data.extend(b"\x1b3" + bytes((max(30, (24 if font == "A" else 17) * height + 6),)))
        self.data.extend(b"\x1d!" + bytes((((width - 1) << 4) | (height - 1),)))
        self.data.extend(b"\x1bE" + bytes((bool(bold),)))
        self.data.extend(b"\x1b-" + bytes((bool(underline),)))
        self.data.extend(b"\x1dB" + bytes((bool(reverse),)))
        self.data.extend(b"\x1ba" + bytes((align,)))
        self.data.extend(b"\x1bR" + bytes((country,)))
        self.data.extend(b"\x1bt" + bytes((page,)))
        self.data.extend(raw + b"\n\x1b2")
        if isinstance(value, bytes):
            codec = _codec(page)
            visible = value.decode(codec, errors="replace") if codec else " ".join(f"{byte:02X}" for byte in value)
        else:
            visible = value
        self.preview.append(f"{font} {width}x{height}  {display or visible}")

    def finish(self, id, name, description, cut=True):
        self.data.extend(b"\x1bM\x00\x1d!\x00\x1bE\x00\x1b-\x00\x1dB\x00\x1ba\x00\x1bR\x00")
        if cut:
            self.data.extend(b"\x1dV\x41\x20")
        return NativeTest(id, name, description, bytes(self.data), tuple(self.preview))


def font_sample():
    b = Builder()
    b.line("MUUSIA / NATIVE FONT TEST", bold=True)
    for font in ("A", "B"):
        b.line(f"FONT {font} / ROM GLYPHS", font=font, bold=True)
        for row in ("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz",
                    "0123456789 !#$%&()*+,-./", ":;<=>?@[\\]^_`{|}~"):
            b.line(row, font=font)
        b.line("The quick brown fox 123", font=font)
    return b.finish("font-sample", "Font A / B", "Both ROM fonts, ASCII letters, digits and punctuation.")


def scaling_matrix():
    b = Builder()
    b.line("FONT SCALING MATRIX / 1-8X", bold=True)
    b.line("Rows: H1-H8  |  glyphs: W1-W8")
    for font in ("A", "B"):
        b.line(f"FONT {font} / M x 64", bold=True)
        for height in range(1, 9):
            b.data.extend(b"\x1bM" + bytes((font == "B",)))
            b.data.extend(b"\x1b3" + bytes((max(30, (24 if font == "A" else 17) * height + 6),)))
            b.data.extend(b"\x1bE\x00\x1b-\x00\x1dB\x00\x1ba\x00\x1bt\x00")
            b.data.extend(b"\x1d!\x00" + f"H{height} ".encode("ascii"))
            for width in range(1, 9):
                b.data.extend(b"\x1d!" + bytes((((width - 1) << 4) | (height - 1),)))
                b.data.extend(b"M")
            b.data.extend(b"\n\x1b2")
            b.preview.append(f"{font} H{height}: " + " ".join(f"M{width}x{height}" for width in range(1, 9)))
            b.data.extend(b"\x1d!\x00")
    return b.finish("scaling-matrix", "Font scaling matrix", "All 64 width/height combinations from 1x to 8x, for both fonts on one strip.")


def typography_matrix():
    b = Builder()
    b.line("TYPOGRAPHY MATRIX", bold=True)
    for font in ("A", "B"):
        b.line(f"FONT {font}", font=font, bold=True)
        b.line("NORMAL / plain text 123", font=font)
        b.line("BOLD / emphasized 123", font=font, bold=True)
        b.line("UNDERLINE / 123", font=font, underline=True)
        b.line("REVERSE / 123", font=font, reverse=True)
        b.line("DOUBLE WIDTH", font=font, width=2)
        b.line("DOUBLE HEIGHT", font=font, height=2)
        b.line("2X BOTH", font=font, width=2, height=2)
        for align, label in enumerate(("LEFT", "CENTER", "RIGHT")):
            b.line(f"{label} / {font}", font=font, align=align)
    return b.finish("typography-matrix", "Typography matrix", "Normal, bold, underline, reverse, double size and alignment in A/B.")


def character_pages():
    b = Builder()
    b.line("CHARACTER PAGES", width=2, height=2, bold=True)
    b.line("ROM GLYPHS / 2X", width=2, height=2)
    b.line("SWEDEN ESC R 5", width=2, height=2)
    b.line(b"FI: [\\]{|}", width=2, height=2, country=5,
           display="FI: ÄÖÅäöå (Sweden set)")
    for page, label, codec in ((0, "PC437", "cp437"), (2, "PC850", "cp850"),
                               (5, "PC865", "cp865"), (19, "PC858", "cp858")):
        b.line(f"PAGE {page} / {label}", width=2, height=2, bold=True)
        sample = "ÄäÖöÅå" + (" €" if page == 19 else "")
        b.line(b"FI: " + sample.encode(codec), width=2, height=2, page=page)
        for start in range(0x80, 0x100, 16):
            b.line(f"{start:02X} ".encode("ascii") + bytes(range(start, start + 16)),
                   width=2, height=2, page=page)
    return b.finish("character-pages", "Character pages", "2x Finnish glyphs and 80-FF grids in PC437, PC850, PC865 and PC858, plus Swedish international characters.")


GENERATORS = (font_sample, scaling_matrix, typography_matrix, character_pages)
TESTS = {test.id: test for test in (generate() for generate in GENERATORS)}


def catalog():
    return [{"id": test.id, "name": test.name, "description": test.description,
             "bytes": len(test.data)} for test in TESTS.values()]


def details(id):
    test = TESTS[id]
    return {"id": test.id, "name": test.name, "description": test.description,
            "bytes": len(test.data), "preview": test.preview,
            "previewNote": "Approximation only: the Epson prints its internal bitmap glyphs."}


def compose(body):
    """Turn bounded text and/or explicit glyph bytes into native text commands."""
    if not isinstance(body, dict):
        raise ValueError("Expected a native text object")
    page, country = body.get("page", 0), body.get("country", 0)
    width, height = body.get("width", 1), body.get("height", 1)
    align, font = body.get("align", 0), body.get("font", "A")
    if type(page) is not int or page not in CODE_PAGES:
        raise ValueError("Unsupported character page")
    if type(country) is not int or not 0 <= country < len(COUNTRIES):
        raise ValueError("Unsupported international set")
    if type(width) is not int or type(height) is not int or not 1 <= width <= 8 or not 1 <= height <= 8:
        raise ValueError("Font scaling must be 1–8")
    if type(align) is not int or align not in (0, 1, 2) or font not in ("A", "B"):
        raise ValueError("Unsupported font or alignment")
    for flag in ("bold", "underline", "reverse", "cut"):
        if type(body.get(flag, False if flag != "cut" else True)) is not bool:
            raise ValueError(f"{flag} must be true or false")
    text, hex_codes = body.get("text", ""), body.get("hex", "")
    if not isinstance(text, str) or len(text) > 1000 or not isinstance(hex_codes, str) or len(hex_codes) > 3000:
        raise ValueError("Native text is too long")
    if not text.strip() and not hex_codes.strip():
        raise ValueError("Enter text or choose glyph bytes")
    codec = _codec(page)
    if text.strip() and codec is None:
        raise ValueError("This page needs glyph byte codes; Unicode conversion is unavailable")
    compact = re.sub(r"\s+", "", hex_codes)
    if len(compact) % 2 or not re.fullmatch(r"[0-9A-Fa-f]*", compact):
        raise ValueError("Glyph bytes must be pairs of hexadecimal digits")
    raw_glyphs = bytes.fromhex(compact)
    if any(byte < 0x20 for byte in raw_glyphs):
        raise ValueError("Glyph bytes must be 20–FF")
    max_chars = 512 // ((12 if font == "A" else 9) * width)
    lines = []
    for line in text.splitlines():
        if not line:
            lines.append(b" ")
            continue
        try:
            raw = line.encode(codec)
        except UnicodeEncodeError as exc:
            raise ValueError(f"A character is unavailable on page {page}; choose another page or a glyph byte") from exc
        lines.extend(raw[offset:offset + max_chars] for offset in range(0, len(raw), max_chars))
    lines.extend(raw_glyphs[offset:offset + max_chars] for offset in range(0, len(raw_glyphs), max_chars))
    if not 1 <= len(lines) <= 24:
        raise ValueError("Native text can use at most 24 printed lines at this size")
    b = Builder()
    b.line(f"MUUSIA PAGE {page} / FONT {font}")
    for raw in lines:
        b.line(raw, font=font, width=width, height=height,
               bold=body.get("bold", False), underline=body.get("underline", False),
               reverse=body.get("reverse", False), align=align, page=page, country=country)
    return b.finish("native-glyphs", "Native glyphs", f"Page {page} · {CODE_PAGES[page][0]}", cut=body.get("cut", True))
