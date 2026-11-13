#!/usr/bin/env python3
"""Small, local ESC/POS print queue for an Epson TM-T88V on Raspberry Pi."""

import base64
import binascii
from datetime import datetime
import io
import json
import os
import queue
import re
import stat
import threading
import time
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import native_fonts
import print_package


WIDTH = 512
MAX_HEIGHT = 4096
MAX_BODY = 400_000
MAX_STRIP_HEIGHT = 65535
MAX_STRIP_BODY = 6_000_000
MAX_IMAGE_HISTORY_BYTES = 32 * 1024 * 1024
MAX_IMPORT = 12_000_000
MAX_IMPORT_ITEMS = 64
CHUNK_ROWS = 256
jobs = {}
job_images = {}
job_native_texts = {}
jobs_lock = threading.Lock()
work = queue.Queue(maxsize=MAX_IMPORT_ITEMS)
CLOCK_INTERVALS = {"second": 1, "minute": 60}
clock_condition = threading.Condition()
clock_thread = None
clock_state = {"running": False, "interval": "second", "lastLine": None,
               "lastQueuedAt": None, "error": None, "lastSlot": None, "generation": 0}


def printer_ready():
    return bool(os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")) or os.path.exists(
        os.environ.get("MUUSIA_PRINT_DEVICE", "/dev/usb/lp0"))


def clock_snapshot():
    with clock_condition:
        return {key: clock_state[key] for key in ("running", "interval", "lastLine", "lastQueuedAt", "error")}


def clock_line(timestamp, interval):
    """One centered, bold Font A 2x2 line in the Pi's local time, without a cut."""
    if interval not in CLOCK_INTERVALS:
        raise ValueError("Clock interval must be second or minute")
    label = datetime.fromtimestamp(timestamp).strftime("%H:%M:%S" if interval == "second" else "%H:%M")
    program = native_fonts.compose({"text": label, "font": "A", "width": 2, "height": 2,
                                    "bold": True, "align": 1, "page": 0, "country": 0,
                                    "cut": False}, heading=False)
    return label, program.data


def queue_clock_line(label, raw, timestamp):
    """Skip a tick while another job is queued/printing; never build a backlog."""
    with jobs_lock:
        if any(job["status"] in ("queued", "printing") for job in jobs.values()) or work.full():
            return False
        if len(jobs) >= 100:
            oldest = next((key for key, job in jobs.items() if job["status"] in ("done", "failed", "cancelled")), None)
            if oldest is None:
                return False
            del jobs[oldest]
            job_images.pop(oldest, None)
            job_native_texts.pop(oldest, None)
        job_id = uuid.uuid4().hex
        jobs[job_id] = {"id": job_id, "status": "queued", "name": f"Clock {label}",
                        "height": 0, "width": 0, "cut": False, "kind": "clock",
                        "createdAt": timestamp}
        work.put_nowait((job_id, raw, False))
        return True


def stop_clock(error=None, expected_generation=None):
    with clock_condition:
        if expected_generation is not None and clock_state["generation"] != expected_generation:
            return {key: clock_state[key] for key in ("running", "interval", "lastLine", "lastQueuedAt", "error")}
        clock_state["running"] = False
        clock_state["error"] = error
        clock_state["generation"] += 1
        clock_condition.notify_all()
    with jobs_lock:
        for job in jobs.values():
            if job["kind"] == "clock" and job["status"] == "queued":
                job["status"] = "cancelled"
                job["finishedAt"] = time.time()
    return clock_snapshot()


def clock_loop():
    while True:
        with clock_condition:
            while not clock_state["running"]:
                clock_condition.wait()
            interval = clock_state["interval"]
            period = CLOCK_INTERVALS[interval]
            now = time.time()
            slot = int(now // period)
            if slot == clock_state["lastSlot"]:
                clock_condition.wait(timeout=max(.02, (slot + 1) * period - now))
                continue
            clock_state["lastSlot"] = slot
            generation = clock_state["generation"]
        if not printer_ready():
            stop_clock("Printer output is unavailable. Clock stopped.", generation)
            continue
        label, raw = clock_line(now, interval)
        with clock_condition:
            if clock_state["running"] and clock_state["generation"] == generation:
                if queue_clock_line(label, raw, now):
                    clock_state["lastLine"] = label
                    clock_state["lastQueuedAt"] = now
                elif clock_state["lastLine"] is None:
                    # The first line after Start or an interval change waits for
                    # a busy printer; later ticks are intentionally skipped.
                    clock_state["lastSlot"] = None
                    clock_condition.wait(timeout=.1)


def start_clock(interval):
    global clock_thread
    if interval not in CLOCK_INTERVALS:
        raise ValueError("Clock interval must be second or minute")
    if not printer_ready():
        raise ValueError("Printer output is unavailable")
    with clock_condition:
        if clock_thread is None or not clock_thread.is_alive():
            clock_thread = threading.Thread(target=clock_loop, name="print-clock", daemon=True)
            clock_thread.start()
        if not clock_state["running"] or clock_state["interval"] != interval:
            clock_state.update(running=True, interval=interval, lastSlot=None,
                               lastLine=None, lastQueuedAt=None, error=None)
            clock_state["generation"] += 1
            clock_condition.notify_all()
    return clock_snapshot()


def validate_receipt(body, max_height=MAX_HEIGHT, max_body=MAX_BODY):
    if not isinstance(body, dict):
        raise ValueError("Request must be a JSON object")
    width, height = body.get("width"), body.get("height")
    if type(width) is not int or type(height) is not int or width != WIDTH or not 1 <= height <= max_height:
        raise ValueError(f"Expected width 512 and height 1–{max_height}")
    if type(body.get("cut", True)) is not bool:
        raise ValueError("cut must be a boolean")
    encoded = body.get("data", "")
    if not isinstance(encoded, str) or len(encoded) > max_body:
        raise ValueError("Invalid receipt bitmap")
    pixels = base64.b64decode(encoded, validate=True)
    if len(pixels) != width * height // 8:
        raise ValueError("Bitmap byte count does not match dimensions")
    native_text = body.get("thermalText", [])
    if not isinstance(native_text, list) or len(native_text) > 8:
        raise ValueError("thermalText must contain at most 8 text blocks")
    for block in native_text:
        if not isinstance(block, dict) or block.get("position") not in ("before", "after"):
            raise ValueError("Native text position must be before or after")
        native_fonts.receipt_block(block)
    return height, pixels, body.get("cut", True), native_text


def inspect_file(name, data):
    """Preview only validated Muusia receipts; never interpret archive paths."""
    if len(data) > MAX_IMPORT:
        raise ValueError("File is too large")
    if name.lower().endswith(".zip"):
        try:
            archive = zipfile.ZipFile(io.BytesIO(data))
            members = [m for m in archive.infolist() if not m.is_dir()]
            manifest_member = next((m for m in members if m.filename == "manifest.json"), None)
            if manifest_member:
                if manifest_member.file_size > 512000:
                    raise ValueError("Print package manifest is too large")
                with archive.open(manifest_member) as stream:
                    manifest = json.loads(stream.read(512001))
                if isinstance(manifest,dict) and manifest.get("format") == "muusia-print-package":
                    return print_package.inspect_package(archive,members,manifest,validate_receipt)
                if isinstance(manifest,dict) and manifest.get("format") == "muusia-surface-strips":
                    raise ValueError(print_package.PNG_ZIP_MESSAGE)
            if not 1 <= len(members) <= MAX_IMPORT_ITEMS:
                raise ValueError("ZIP must contain 1–64 receipt files")
            if any(m.file_size > MAX_BODY or m.file_size < 1 or not m.filename.lower().endswith(".muusia-receipt.json") for m in members):
                raise ValueError("ZIP contains an unsupported or oversized file")
            if sum(m.file_size for m in members) > MAX_IMPORT:
                raise ValueError("Uncompressed ZIP is too large")
            sources = []
            for member in members:
                with archive.open(member) as stream:
                    raw = stream.read(MAX_BODY + 1)
                if len(raw) > MAX_BODY:
                    raise ValueError("ZIP contains an oversized receipt")
                sources.append((Path(member.filename).name, raw))
        except (zipfile.BadZipFile, zipfile.LargeZipFile, RuntimeError, OSError, EOFError, NotImplementedError) as exc:
            raise ValueError("Could not open receipt ZIP") from exc
    elif name.lower().endswith(".muusia-strip.json"):
        if len(data) > MAX_STRIP_BODY:
            raise ValueError("Print strip file is too large")
        return [print_package.validate_strip_packet(json.loads(data),validate_receipt)]
    elif name.lower().endswith(".png"):
        raise ValueError(print_package.PNG_ZIP_MESSAGE)
    elif name.lower().endswith(".muusia-receipt.json") or name.lower().endswith(".json"):
        if len(data) > MAX_BODY:
            raise ValueError("Receipt file is too large")
        sources = [(Path(name).name, data)]
    else:
        raise ValueError("Choose a Muusia Print package, strip file or receipt ZIP")
    result = []
    for filename, raw in sources:
        try:
            body = json.loads(raw)
            if not isinstance(body, dict):
                raise ValueError("Not a Muusia receipt file")
            if body.get("format") != "muusia-receipt" or body.get("version") != 1:
                raise ValueError("Not a Muusia receipt file")
            height, pixels, cut, native_text = validate_receipt(body)
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, KeyError) as exc:
            raise ValueError(f"Invalid receipt: {filename}") from exc
        result.append({"name": filename, "width": WIDTH, "height": height,
                       "data": base64.b64encode(pixels).decode("ascii"), "cut": cut,
                       "thermalText": native_text})
    return result


def escpos_image(width, height, pixels, cut=True, initialize=True, max_height=MAX_HEIGHT):
    """Encode MSB-first 1-bit rows using GS v 0, then feed to the cutter."""
    if width != WIDTH or not 1 <= height <= max_height or len(pixels) != width * height // 8:
        raise ValueError(f"Expected a 512-dot image of at most {max_height} rows")
    stride = width // 8
    out = bytearray(b"\x1b@" if initialize else b"")
    for row in range(0, height, CHUNK_ROWS):
        rows = min(CHUNK_ROWS, height - row)
        out.extend((0x1D, 0x76, 0x30, 0, stride & 255, stride >> 8, rows & 255, rows >> 8))
        out.extend(pixels[row * stride:(row + rows) * stride])
    if cut:
        # TM-T88V GS V Function B advances to its cutter position, adds 32 dots
        # of white margin, then cuts. A fixed 112-dot feed cut into real output.
        out.extend(b"\x1dV\x41\x20")
    return bytes(out)


def escpos_surface_strip(height, pixels, cut=True, tear_at_row=None):
    """One atomic body+label job. Function B partial-cuts the body at its end;
    the mechanism feeds to its cutter, leaving blank paper before the label.
    TM-T88V's left bridge is fixed by its cutter, not a programmable width.
    """
    if tear_at_row is None:
        return escpos_image(WIDTH, height, pixels, cut, max_height=MAX_STRIP_HEIGHT)
    if isinstance(tear_at_row, bool) or not isinstance(tear_at_row, int) or not 1 <= tear_at_row < height:
        raise ValueError("End label cut must be between the body and label rows")
    if len(pixels) != 64 * height or not 1 <= height <= MAX_STRIP_HEIGHT:
        raise ValueError("Invalid surface raster")
    out = bytearray(escpos_image(WIDTH, tear_at_row, pixels[:tear_at_row * 64], cut=False, max_height=MAX_STRIP_HEIGHT))
    out.extend(b"\x1dV\x42\x00")
    out.extend(escpos_image(WIDTH, height - tear_at_row, pixels[tear_at_row * 64:], cut=cut, initialize=False, max_height=MAX_STRIP_HEIGHT))
    return bytes(out)


def escpos_mixed_receipt(width, height, pixels, native_text, cut=True):
    """Print native text around one raster image and cut only at the end."""
    if not native_text:
        return escpos_image(width, height, pixels, cut)
    out = bytearray(b"\x1b@")
    for block in native_text:
        if block["position"] == "before":
            out.extend(native_fonts.receipt_block(block))
    out.extend(escpos_image(width, height, pixels, cut=False, initialize=False))
    for block in native_text:
        if block["position"] == "after":
            out.extend(native_fonts.receipt_block(block))
    if cut:
        out.extend(b"\x1dV\x41\x20")
    return bytes(out)


def write_all(fd, data):
    view = memoryview(data)
    while view:
        written = os.write(fd, view[:16384])
        if written <= 0:
            raise OSError("USB printer stopped accepting data")
        view = view[written:]


def print_worker():
    while True:
        job_id, image, cut = work.get()
        with jobs_lock:
            if jobs.get(job_id, {}).get("status") == "cancelled":
                work.task_done()
                continue
            jobs[job_id]["status"] = "printing"
            jobs[job_id]["startedAt"] = time.time()
            kind = jobs[job_id]["kind"]
        try:
            if image is None:
                data = b"\x1dV\x00"
            elif isinstance(image, bytes):
                data = image
            else:
                data = escpos_image(WIDTH, image[0], image[1], cut, max_height=MAX_STRIP_HEIGHT if kind == "strip" else MAX_HEIGHT)
            file_output = os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")
            if file_output:
                fd = os.open(file_output, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            else:
                device = os.environ.get("MUUSIA_PRINT_DEVICE", "/dev/usb/lp0")
                if not stat.S_ISCHR(os.stat(device).st_mode):
                    raise OSError(f"Printer path is not a character device: {device}")
                fd = os.open(device, os.O_WRONLY)
            try:
                write_all(fd, data)
            finally:
                os.close(fd)
            with jobs_lock:
                jobs[job_id]["status"] = "done"
                jobs[job_id]["finishedAt"] = time.time()
        except Exception as exc:
            with jobs_lock:
                jobs[job_id].update(status="failed", error=str(exc), finishedAt=time.time())
            if kind == "clock":
                stop_clock(f"Printer error: {exc}. Clock stopped.")
        finally:
            work.task_done()


class Handler(BaseHTTPRequestHandler):
    def _origin(self):
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        if not re.fullmatch(r"(?:localhost|127\.0\.0\.1)(?::\d+)?", host):
            return None
        same_host = "http://" + host
        if origin and origin != same_host and origin != "https://bambi8000.github.io" and not re.fullmatch(r"http://(?:localhost|127\.0\.0\.1)(?::\d+)?", origin):
            return None
        return origin or ""

    def _headers(self, status, length, content_type="application/json", filename=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; form-action 'self'; base-uri 'none'")
        if self._origin():
            self.send_header("Access-Control-Allow-Origin", self._origin())
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Muusia-Token, X-Muusia-Filename")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
            if self.headers.get("Access-Control-Request-Private-Network") == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def _json(self, status, value):
        data = json.dumps(value).encode("utf-8")
        self._headers(status, len(data))
        self.wfile.write(data)

    def _origin_allowed(self):
        if self._origin() is None:
            self._json(403, {"error": "Origin is not allowed"})
            return False
        return True

    def do_OPTIONS(self):
        if self._origin() is None:
            self._json(403, {"error": "Origin is not allowed"})
        else:
            self._headers(204, 0)

    def do_GET(self):
        if self.path in ("/", "/dashboard.js", "/dashboard.css"):
            filename = {"/": "dashboard.html", "/dashboard.js": "dashboard.js", "/dashboard.css": "dashboard.css"}[self.path]
            content = Path(__file__).with_name(filename).read_bytes()
            content_type = "text/html; charset=utf-8" if filename.endswith(".html") else "text/javascript; charset=utf-8" if filename.endswith(".js") else "text/css; charset=utf-8"
            self._headers(200, len(content), content_type)
            self.wfile.write(content)
            return
        if not self._origin_allowed():
            return
        if self.path == "/health":
            device = os.environ.get("MUUSIA_PRINT_DEVICE", "/dev/usb/lp0")
            ready = printer_ready()
            with jobs_lock:
                queued = sum(j["status"] == "queued" for j in jobs.values())
            self._json(200, {"ready": ready, "queued": queued, "mode": "test file" if os.environ.get("MUUSIA_PRINT_OUTPUT_FILE") else "USB", "device": device})
        elif self.path == "/api/strip-capabilities":
            self._json(200, {"width": WIDTH, "maxHeight": MAX_STRIP_HEIGHT, "singleStripJob": True, "requiresIdle": True, "partialCutEndLabel": True, "endLabelBridge": "fixed-left", "printPackageVersion": 1, "trimMarksVersion": 1})
        elif self.path == "/api/clock":
            self._json(200, clock_snapshot())
        elif self.path == "/api/native-pages":
            self._json(200, native_fonts.page_catalog())
        elif re.fullmatch(r"/api/native-pages/\d+", self.path):
            page = int(self.path.rsplit("/", 1)[-1])
            if page in native_fonts.CODE_PAGES:
                self._json(200, native_fonts.page_glyphs(page))
            else:
                self._json(404, {"error": "Character page not found"})
        elif self.path == "/api/native-tests":
            self._json(200, {"tests": native_fonts.catalog()})
        elif re.fullmatch(r"/api/native-tests/[a-z0-9-]+/bin", self.path):
            test_id = self.path.split("/")[3]
            test = native_fonts.TESTS.get(test_id)
            if not test:
                self._json(404, {"error": "Native test not found"})
            else:
                self._headers(200, len(test.data), "application/octet-stream", f"print-{test.id}.bin")
                self.wfile.write(test.data)
        elif re.fullmatch(r"/api/native-tests/[a-z0-9-]+", self.path):
            test_id = self.path.rsplit("/", 1)[-1]
            if test_id in native_fonts.TESTS:
                self._json(200, native_fonts.details(test_id))
            else:
                self._json(404, {"error": "Native test not found"})
        elif self.path == "/api/jobs":
            with jobs_lock:
                listing = [dict(job) for job in jobs.values()]
            self._json(200, {"jobs": listing[::-1]})
        elif re.fullmatch(r"/api/jobs/[a-f0-9]{32}", self.path):
            with jobs_lock:
                job = jobs.get(self.path.rsplit("/", 1)[-1])
                snapshot = dict(job) if job else None
            self._json(200 if snapshot else 404, snapshot or {"error": "Job not found"})
        elif re.fullmatch(r"/api/jobs/[a-f0-9]{32}/receipt", self.path):
            job_id = self.path.split("/")[3]
            with jobs_lock:
                job = jobs.get(job_id)
                pixels = job_images.get(job_id)
                snapshot = dict(job) if job else None
                native_text = job_native_texts.get(job_id, [])
            if not snapshot or pixels is None:
                self._json(404, {"error": "Receipt not found"})
            else:
                self._json(200, {"format": "muusia-receipt", "version": 1, "width": WIDTH,
                                 "height": snapshot["height"], "data": base64.b64encode(pixels).decode("ascii"),
                                 "cut": snapshot["cut"], "thermalText": native_text})
        else:
            self._json(404, {"error": "Not found"})

    def do_DELETE(self):
        if not self._origin_allowed():
            return
        if not re.fullmatch(r"/api/jobs/[a-f0-9]{32}", self.path):
            self._json(404, {"error": "Not found"})
            return
        with jobs_lock:
            job = jobs.get(self.path.rsplit("/", 1)[-1])
            if job and job["status"] == "queued":
                job["status"] = "cancelled"
                job["finishedAt"] = time.time()
                snapshot = dict(job)
            else:
                snapshot = None
        self._json(200 if snapshot else 409, snapshot or {"error": "Only queued jobs can be cancelled"})

    def do_POST(self):
        if not self._origin_allowed():
            return
        if self.path == "/api/clock":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= 128:
                    raise ValueError("Clock request is too large or empty")
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError("Clock request must be an object")
                self._json(200, start_clock(body.get("interval")))
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self._json(400, {"error": str(exc)})
            return
        if self.path == "/api/clock/stop":
            if self.headers.get("Content-Length", "0") != "0":
                self._json(400, {"error": "Clock stop takes no body"})
            else:
                self._json(200, stop_clock())
            return
        if self.path in ("/api/native-compose", "/api/native-compose/preview", "/api/native-compose/bin"):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= 5000:
                    raise ValueError("Native text request is too large or empty")
                test = native_fonts.compose(json.loads(self.rfile.read(length)))
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self._json(400, {"error": str(exc)})
                return
            if self.path.endswith("/preview"):
                self._json(200, {"name": test.name, "description": test.description,
                                 "bytes": len(test.data), "preview": test.preview,
                                 "previewNote": "Approximation only: the Epson renders its own ROM glyphs."})
            elif self.path.endswith("/bin"):
                self._headers(200, len(test.data), "application/octet-stream", "print-native-glyphs.bin")
                self.wfile.write(test.data)
            else:
                self._enqueue(test.name, 0, None, test.data.endswith(b"\x1dV\x41\x20"), "native", raw=test.data)
            return
        if re.fullmatch(r"/api/native-tests/[a-z0-9-]+", self.path):
            test_id = self.path.rsplit("/", 1)[-1]
            test = native_fonts.TESTS.get(test_id)
            if not test:
                self._json(404, {"error": "Native test not found"})
            elif self.headers.get("Content-Length", "0") != "0":
                self._json(400, {"error": "Native test takes no body"})
            else:
                self._enqueue(test.name, 0, None, True, "native", raw=test.data)
            return
        if self.path == "/api/strip-jobs":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= MAX_STRIP_BODY:
                    raise ValueError("Strip request is too large or empty")
                body = json.loads(self.rfile.read(length))
                height, pixels, cut, native = validate_receipt(body, MAX_STRIP_HEIGHT, MAX_STRIP_BODY)
                if native:
                    raise ValueError("Strip jobs contain raster graphics only")
                tear_at_row = body.get("tearAtRow")
                if tear_at_row is not None and (isinstance(tear_at_row, bool) or not isinstance(tear_at_row, int) or not 1 <= tear_at_row < height):
                    raise ValueError("End label cut must be between the body and label rows")
                if body.get("format") == "muusia-surface-strip":
                    print_package.validate_strip_packet(body,validate_receipt)
                name = body.get("name", "Surface strip")
                if not isinstance(name, str) or not 1 <= len(name) <= 120:
                    raise ValueError("Invalid strip job name")
                name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip() or "Surface strip"
                request_id = body.get("requestId")
                if request_id is not None and (not isinstance(request_id, str) or not re.fullmatch(r"[a-f0-9]{32}", request_id)):
                    raise ValueError("Invalid strip request ID")
            except (ValueError, TypeError, binascii.Error, json.JSONDecodeError) as exc:
                self._json(400, {"error": str(exc)})
                return
            if clock_snapshot()["running"]:
                self._json(409, {"error": "Stop Clock before printing a surface strip"})
                return
            self._enqueue(name, height, pixels, cut, "strip", raw=escpos_surface_strip(height, pixels, cut, tear_at_row) if tear_at_row is not None else None, require_idle=True, request_id=request_id)
            return
        if self.path not in ("/api/jobs", "/api/inspect", "/api/cut"):
            self._json(404, {"error": "Not found"})
            return
        if self.path == "/api/cut":
            if self.headers.get("Content-Length", "0") != "0":
                self._json(400, {"error": "Cut command takes no body"})
                return
            self._enqueue("Cut paper", 0, None, True, "cut")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= (MAX_IMPORT if self.path == "/api/inspect" else MAX_BODY):
                raise ValueError("Request body is too large or empty")
            raw = self.rfile.read(length)
            if self.path == "/api/inspect":
                name = unquote(self.headers.get("X-Muusia-Filename", "")).strip()
                result = inspect_file(name, raw)
                self._json(200, {"receipts": result})
                return
            body = json.loads(raw)
            height, pixels, cut, native_text = validate_receipt(body)
            name = body.get("name", "Receipt")
            if not isinstance(name, str) or not 1 <= len(name) <= 120:
                raise ValueError("Invalid job name")
            name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip() or "Receipt"
        except (ValueError, TypeError, binascii.Error, json.JSONDecodeError) as exc:
            self._json(400, {"error": str(exc)})
            return
        raw_print = escpos_mixed_receipt(WIDTH, height, pixels, native_text, cut) if native_text else None
        self._enqueue(name, height, pixels, cut, "receipt", raw=raw_print, native_text=native_text)

    def _enqueue(self, name, height, pixels, cut, kind, raw=None, native_text=None, require_idle=False, request_id=None):
        job_id = request_id or uuid.uuid4().hex
        queue_error = None
        with jobs_lock:
            if request_id and job_id in jobs:
                self._json(202, {"id": job_id, "status": jobs[job_id]["status"]})
                return
            if require_idle and any(j["status"] in ("queued", "printing") for j in jobs.values()):
                self._json(409, {"error": "Printer is busy. Wait for the current strip to finish."})
                return
            incoming = len(pixels) if pixels is not None else 0
            while sum(len(data) for data in job_images.values()) + incoming > MAX_IMAGE_HISTORY_BYTES:
                oldest_image = next((key for key in job_images if jobs.get(key, {}).get("status") in ("done", "failed", "cancelled")), None)
                if oldest_image is None:
                    self._json(503, {"error": "Print image memory budget is full"})
                    return
                job_images.pop(oldest_image, None)
                job_native_texts.pop(oldest_image, None)
            if len(jobs) >= 100:
                oldest = next((key for key, value in jobs.items() if value["status"] in ("done", "failed", "cancelled")), None)
                if oldest is None:
                    queue_error = "Job history is full"
                else:
                    del jobs[oldest]
                    job_images.pop(oldest, None)
                    job_native_texts.pop(oldest, None)
            if queue_error is None:
                jobs[job_id] = {"id": job_id, "status": "queued", "name": name, "height": height,
                                "width": WIDTH if pixels is not None else 0, "cut": cut,
                                "kind": kind, "createdAt": time.time()}
                if pixels is not None:
                    job_images[job_id] = pixels
                if native_text:
                    job_native_texts[job_id] = native_text
                try:
                    image = raw if raw is not None else (height, pixels) if pixels is not None else None
                    work.put_nowait((job_id, image, cut))
                except queue.Full:
                    del jobs[job_id]
                    job_images.pop(job_id, None)
                    job_native_texts.pop(job_id, None)
                    queue_error = "Print queue is full"
        if queue_error:
            self._json(503, {"error": queue_error})
            return
        self._json(202, {"id": job_id, "status": "queued"})


def main():
    # The API has no password: never expose it on the Pi network interfaces.
    host = "127.0.0.1"
    port = int(os.environ.get("MUUSIA_PRINT_PORT", "8631"))
    threading.Thread(target=print_worker, daemon=True).start()
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Print listening on {host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
