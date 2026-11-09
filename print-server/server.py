#!/usr/bin/env python3
"""Small, local ESC/POS print queue for an Epson TM-T88V on Raspberry Pi."""

import base64
import binascii
import hmac
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


WIDTH = 512
MAX_HEIGHT = 4096
MAX_BODY = 400_000
MAX_IMPORT = 12_000_000
MAX_IMPORT_ITEMS = 64
CHUNK_ROWS = 256
jobs = {}
job_images = {}
jobs_lock = threading.Lock()
work = queue.Queue(maxsize=MAX_IMPORT_ITEMS)


def validate_receipt(body):
    if not isinstance(body, dict):
        raise ValueError("Request must be a JSON object")
    width, height = body.get("width"), body.get("height")
    if type(width) is not int or type(height) is not int or width != WIDTH or not 1 <= height <= MAX_HEIGHT:
        raise ValueError("Expected width 512 and height 1–4096")
    if type(body.get("cut", True)) is not bool:
        raise ValueError("cut must be a boolean")
    encoded = body.get("data", "")
    if not isinstance(encoded, str) or len(encoded) > MAX_BODY:
        raise ValueError("Invalid receipt bitmap")
    pixels = base64.b64decode(encoded, validate=True)
    if len(pixels) != width * height // 8:
        raise ValueError("Bitmap byte count does not match dimensions")
    return height, pixels, body.get("cut", True)


def inspect_file(name, data):
    """Preview only validated Muusia receipts; never interpret archive paths."""
    if len(data) > MAX_IMPORT:
        raise ValueError("File is too large")
    if name.lower().endswith(".zip"):
        try:
            archive = zipfile.ZipFile(io.BytesIO(data))
            members = [m for m in archive.infolist() if not m.is_dir()]
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
    elif name.lower().endswith(".muusia-receipt.json") or name.lower().endswith(".json"):
        if len(data) > MAX_BODY:
            raise ValueError("Receipt file is too large")
        sources = [(Path(name).name, data)]
    else:
        raise ValueError("Choose a Muusia receipt JSON or receipt ZIP")
    result = []
    for filename, raw in sources:
        try:
            body = json.loads(raw)
            if not isinstance(body, dict):
                raise ValueError("Not a Muusia receipt file")
            if body.get("format") != "muusia-receipt" or body.get("version") != 1:
                raise ValueError("Not a Muusia receipt file")
            height, pixels, cut = validate_receipt(body)
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, KeyError) as exc:
            raise ValueError(f"Invalid receipt: {filename}") from exc
        result.append({"name": filename, "width": WIDTH, "height": height,
                       "data": base64.b64encode(pixels).decode("ascii"), "cut": cut})
    return result


def escpos_image(width, height, pixels, cut=True):
    """Encode MSB-first 1-bit rows using GS v 0, then feed to the cutter."""
    if width != WIDTH or not 1 <= height <= MAX_HEIGHT or len(pixels) != width * height // 8:
        raise ValueError("Expected a 512-dot image of at most 4096 rows")
    stride = width // 8
    out = bytearray(b"\x1b@")
    for row in range(0, height, CHUNK_ROWS):
        rows = min(CHUNK_ROWS, height - row)
        out.extend((0x1D, 0x76, 0x30, 0, stride & 255, stride >> 8, rows & 255, rows >> 8))
        out.extend(pixels[row * stride:(row + rows) * stride])
    if cut:
        # The cutter sits about 14 mm after the head on TM-T88V.
        out.extend(b"\x1bJ\x70\x1dV\x00")  # feed 112 dots, then cut
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
        try:
            data = escpos_image(WIDTH, image[0], image[1], cut)
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
        finally:
            work.task_done()


class Handler(BaseHTTPRequestHandler):
    def _origin(self):
        origin = self.headers.get("Origin")
        same_host = "http://" + self.headers.get("Host", "")
        if origin and origin != same_host and origin != "null" and origin != "https://bambi8000.github.io" and not re.fullmatch(r"http://(?:localhost|127\.0\.0\.1)(?::\d+)?", origin):
            return None
        return origin or ""

    def _headers(self, status, length, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
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

    def _authorized(self):
        token = os.environ.get("MUUSIA_PRINT_TOKEN", "")
        if not token:
            self._json(503, {"error": "MUUSIA_PRINT_TOKEN is not configured"})
            return False
        if self._origin() is None:
            self._json(403, {"error": "Origin is not allowed"})
            return False
        if not hmac.compare_digest(self.headers.get("X-Muusia-Token", ""), token):
            self._json(401, {"error": "Invalid print token"})
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
        if not self._authorized():
            return
        if self.path == "/health":
            device = os.environ.get("MUUSIA_PRINT_DEVICE", "/dev/usb/lp0")
            ready = bool(os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")) or os.path.exists(device)
            with jobs_lock:
                queued = sum(j["status"] == "queued" for j in jobs.values())
            self._json(200, {"ready": ready, "queued": queued, "mode": "test file" if os.environ.get("MUUSIA_PRINT_OUTPUT_FILE") else "USB", "device": device})
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
            if not snapshot or pixels is None:
                self._json(404, {"error": "Receipt not found"})
            else:
                self._json(200, {"format": "muusia-receipt", "version": 1, "width": WIDTH,
                                 "height": snapshot["height"], "data": base64.b64encode(pixels).decode("ascii"),
                                 "cut": snapshot["cut"]})
        else:
            self._json(404, {"error": "Not found"})

    def do_DELETE(self):
        if not self._authorized():
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
        if not self._authorized():
            return
        if self.path not in ("/api/jobs", "/api/inspect"):
            self._json(404, {"error": "Not found"})
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
            height, pixels, cut = validate_receipt(body)
            name = body.get("name", "Receipt")
            if not isinstance(name, str) or not 1 <= len(name) <= 120:
                raise ValueError("Invalid job name")
            name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip() or "Receipt"
        except (ValueError, TypeError, binascii.Error, json.JSONDecodeError) as exc:
            self._json(400, {"error": str(exc)})
            return
        job_id = uuid.uuid4().hex
        queue_error = None
        with jobs_lock:
            if len(jobs) >= 100:
                oldest = next((key for key, value in jobs.items() if value["status"] in ("done", "failed", "cancelled")), None)
                if oldest is None:
                    queue_error = "Job history is full"
                else:
                    del jobs[oldest]
                    job_images.pop(oldest, None)
            if queue_error is None:
                jobs[job_id] = {"id": job_id, "status": "queued", "name": name, "height": height,
                                "width": WIDTH, "cut": cut, "createdAt": time.time()}
                job_images[job_id] = pixels
                try:
                    work.put_nowait((job_id, (height, pixels), cut))
                except queue.Full:
                    del jobs[job_id]
                    job_images.pop(job_id, None)
                    queue_error = "Print queue is full"
        if queue_error:
            self._json(503, {"error": queue_error})
            return
        self._json(202, {"id": job_id, "status": "queued"})


def main():
    if not os.environ.get("MUUSIA_PRINT_TOKEN"):
        raise SystemExit("Set MUUSIA_PRINT_TOKEN before starting")
    host = os.environ.get("MUUSIA_PRINT_HOST", "127.0.0.1")
    port = int(os.environ.get("MUUSIA_PRINT_PORT", "8631"))
    threading.Thread(target=print_worker, daemon=True).start()
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Muusia Print listening on {host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
