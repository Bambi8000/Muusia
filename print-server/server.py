#!/usr/bin/env python3
"""Small, local ESC/POS print queue for an Epson TM-T88V on Raspberry Pi."""

import base64
import binascii
import hmac
import json
import os
import queue
import re
import stat
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


WIDTH = 512
MAX_HEIGHT = 4096
MAX_BODY = 400_000
CHUNK_ROWS = 256
jobs = {}
jobs_lock = threading.Lock()
work = queue.Queue(maxsize=8)


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
            jobs[job_id]["status"] = "printing"
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
        except Exception as exc:
            with jobs_lock:
                jobs[job_id].update(status="failed", error=str(exc))
        finally:
            work.task_done()


class Handler(BaseHTTPRequestHandler):
    def _origin(self):
        origin = self.headers.get("Origin")
        if origin and origin != "null" and origin != "https://bambi8000.github.io" and not re.fullmatch(r"http://(?:localhost|127\.0\.0\.1)(?::\d+)?", origin):
            return None
        return origin or ""

    def _headers(self, status, length, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        if self._origin():
            self.send_header("Access-Control-Allow-Origin", self._origin())
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Muusia-Token")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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
        if not self._authorized():
            return
        if self.path == "/health":
            device = os.environ.get("MUUSIA_PRINT_DEVICE", "/dev/usb/lp0")
            ready = bool(os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")) or os.path.exists(device)
            self._json(200, {"ready": ready, "queued": work.qsize()})
        elif re.fullmatch(r"/api/jobs/[a-f0-9]{32}", self.path):
            with jobs_lock:
                job = jobs.get(self.path.rsplit("/", 1)[-1])
                snapshot = dict(job) if job else None
            self._json(200 if snapshot else 404, snapshot or {"error": "Job not found"})
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        if not self._authorized():
            return
        if self.path != "/api/jobs":
            self._json(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= MAX_BODY:
                raise ValueError("Request body is too large or empty")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("Request must be a JSON object")
            width, height = body.get("width"), body.get("height")
            if type(width) is not int or type(height) is not int or width != WIDTH or not 1 <= height <= MAX_HEIGHT:
                raise ValueError("Expected width 512 and height 1–4096")
            if type(body.get("cut", True)) is not bool:
                raise ValueError("cut must be a boolean")
            pixels = base64.b64decode(body.get("data", ""), validate=True)
            if len(pixels) != width * height // 8:
                raise ValueError("Bitmap byte count does not match dimensions")
        except (ValueError, TypeError, binascii.Error, json.JSONDecodeError) as exc:
            self._json(400, {"error": str(exc)})
            return
        job_id = uuid.uuid4().hex
        with jobs_lock:
            if len(jobs) >= 100:
                oldest = next(iter(jobs))
                del jobs[oldest]
            jobs[job_id] = {"id": job_id, "status": "queued", "height": height}
            try:
                work.put_nowait((job_id, (height, pixels), body.get("cut", True)))
            except queue.Full:
                del jobs[job_id]
                self._json(503, {"error": "Print queue is full"})
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
