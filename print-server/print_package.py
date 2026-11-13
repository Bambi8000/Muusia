"""Bounded, non-executing import of calibrated Muusia thermal strip packets."""
import base64
import json
import math
import re

PROFILE_ID = "epson-tmt88v-measured-20261112"
DOTS_PER_MM = 400 / 56.6
MAX_FILE = 6_000_000
MAX_PIXELS_BYTES = 32 * 1024 * 1024
MAX_UNPACKED = 48 * 1024 * 1024
PNG_ZIP_MESSAGE = "This is a Surface PNG image export. In Surface Composer use Export Print package, or Print… for direct printing. PNG export is for image files and other printers."


def number(obj, key, minimum=0, maximum=1e9):
    n = obj.get(key)
    if isinstance(n, bool) or not isinstance(n, (float, int)) or not math.isfinite(n) or not minimum <= n <= maximum:
        raise ValueError(f"Invalid Print geometry: {key}")
    return n


def validate_strip_packet(body, validate_receipt):
    if not isinstance(body, dict) or body.get("format") != "muusia-surface-strip" or body.get("version") != 1:
        raise ValueError("Not a Muusia Print strip file")
    profile = body.get("profile", {})
    if not isinstance(profile, dict) or profile.get("id") != PROFILE_ID or profile.get("width") != 512 or abs(number(profile, "dotsPerMm", 1, 100) - DOTS_PER_MM) > 1e-9:
        raise ValueError("Print file uses a different printer calibration")
    height, pixels, cut, native = validate_receipt(body, 65535, MAX_FILE)
    if native:
        raise ValueError("Print strip files contain calibrated raster graphics only")
    geometry = body.get("geometry")
    if not isinstance(geometry, dict):
        raise ValueError("Print strip geometry is missing")
    width = number(geometry, "physicalWidthMm", 78, 82)
    offset = number(geometry, "printableOffsetMm", 0, width)
    number(geometry, "printableWidthMm", .01, width - offset)
    length = number(geometry, "bodyLengthMm", .001)
    label = number(geometry, "labelLengthMm", 0, 100)
    start = number(geometry, "fromMm")
    end = number(geometry, "toMm", start + .001)
    number(geometry, "originalLengthMm", end)
    if abs(end - start - length) > 1e-6:
        raise ValueError("Print range does not match its body length")
    rows = math.ceil(length * DOTS_PER_MM - 1e-9)
    trim = geometry.get("trim")
    guard_rows = math.ceil(3 * DOTS_PER_MM) if trim is not None else 0
    if trim is not None and (not isinstance(trim, dict) or set(trim) != {"leadingRows", "trailingRows"} or any(type(trim[k]) is not int or trim[k] != guard_rows for k in trim)):
        raise ValueError("Invalid trim guards")
    body_end = rows + 2 * guard_rows
    if type(geometry.get("bodyRows")) is not int or geometry["bodyRows"] != rows or height != body_end + math.ceil(label * DOTS_PER_MM - 1e-9):
        raise ValueError("Print raster dimensions do not match millimetre geometry")
    tear = body.get("tearAtRow")
    if tear is not None and (type(tear) is not int or tear != body_end or not 1 <= tear < height):
        raise ValueError("Invalid end-label cut row")
    name = body.get("name", "Surface strip")
    if not isinstance(name, str) or not 1 <= len(name) <= 120:
        raise ValueError("Invalid Print strip name")
    if not isinstance(geometry.get("stripId"), str) or not 1 <= len(geometry["stripId"]) <= 300:
        raise ValueError("Invalid strip ID")
    for key in ("number", "printOrder"):
        if type(geometry.get(key)) is not int or geometry[key] < 1:
            raise ValueError(f"Invalid strip {key}")
    for row in range(height):
        if pixels[row * 64] & 0x80 or pixels[row * 64 + 62] & 0x0f or pixels[row * 64 + 63]:
            raise ValueError("Print raster exceeds the calibrated side margins")
    result = {"format":"muusia-surface-strip", "version":1,"kind":"strip", "name":re.sub(r"[\x00-\x1f\x7f]", "", name), "width":512,"height":height,"data":base64.b64encode(pixels).decode("ascii"),"cut":cut,"profile":profile,"geometry":geometry}
    if tear is not None:
        result["tearAtRow"] = tear
    return result


def inspect_package(archive, members, manifest, validate_receipt):
    if manifest.get("version") != 1 or manifest.get("defaultPrintMode") != "manual":
        raise ValueError("Unsupported Muusia Print package version or print mode")
    entries = manifest.get("strips")
    if not isinstance(entries, list) or not 1 <= len(entries) <= 64:
        raise ValueError("Print package must contain 1–64 strips")
    by_name = {m.filename:m for m in members}
    if len(by_name) != len(members):
        raise ValueError("Print package contains duplicate filenames")
    expected = {"manifest.json"}
    for item in entries:
        name = item.get("filename") if isinstance(item,dict) else None
        if not isinstance(name,str) or not re.fullmatch(r"[a-zA-Z0-9_-]+\.muusia-strip\.json",name) or name in expected:
            raise ValueError("Invalid or duplicate Print package entry")
        expected.add(name)
    if set(by_name) != expected:
        raise ValueError("Print package contents do not match its manifest")
    if any(m.file_size < 1 or m.file_size > MAX_FILE for m in members) or sum(m.file_size for m in members) > MAX_UNPACKED:
        raise ValueError("Print package is too large. Export fewer strips.")
    result, pixels_bytes = [], 0
    for item in entries:
        with archive.open(by_name[item['filename']]) as stream:
            raw = stream.read(MAX_FILE + 1)
        if len(raw) > MAX_FILE:
            raise ValueError("Print strip file is too large")
        packet = validate_strip_packet(json.loads(raw), validate_receipt)
        if any(item.get(key) != packet['geometry'][key] for key in ('stripId','number','printOrder')):
            raise ValueError("Print strip order or identity does not match manifest")
        pixels_bytes += packet['height'] * 64
        if pixels_bytes > MAX_PIXELS_BYTES:
            raise ValueError("Print package exceeds 32 MiB of thermal data. Export fewer strips.")
        result.append(packet)
    return result
