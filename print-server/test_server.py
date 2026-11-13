import base64
import json
import os
import tempfile
import threading
import time
import unittest
import zipfile
import io
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server
import native_fonts


class PrintServerTests(unittest.TestCase):
    def test_00_strip_jobs_are_single_idle_and_idempotent(self):
        # No worker: inspect real HTTP queue operations without printing anything.
        server.jobs.clear(); server.job_images.clear(); server.job_native_texts.clear()
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True); thread.start()
        base = f"http://127.0.0.1:{httpd.server_port}"
        def post(body):
            req = Request(base + "/api/strip-jobs", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            with urlopen(req, timeout=3) as response:
                return json.load(response)
        payload = {"width": 512, "height": 5000, "data": base64.b64encode(bytes(64 * 5000)).decode(), "cut": True, "requestId": "a" * 32}
        try:
            with urlopen(base + "/api/strip-capabilities", timeout=3) as response:
                self.assertEqual(json.load(response)["maxHeight"], 65535)
            self.assertEqual(post(payload)["id"], "a" * 32)
            self.assertEqual(post(payload)["id"], "a" * 32)
            self.assertEqual(server.work.qsize(), 1, "Retry never prints the strip twice")
            with self.assertRaises(HTTPError) as busy:
                post({**payload, "requestId": "b" * 32})
            self.assertEqual(busy.exception.code, 409); busy.exception.close()
            queued = server.work.get_nowait(); server.work.task_done()
            self.assertEqual(queued[0], "a" * 32)
            self.assertEqual(queued[1][0], 5000)
            server.jobs["a" * 32]["status"] = "done"
            with server.clock_condition:
                server.clock_state["running"] = True
            with self.assertRaises(HTTPError) as clock:
                post({**payload, "requestId": "b" * 32})
            self.assertEqual(clock.exception.code, 409); clock.exception.close()
            with server.clock_condition:
                server.clock_state["running"] = False
            # Terminal preview images are evicted, active work is retained.
            for i in range(20):
                key = f"old-{i}"
                server.jobs[key] = {"status": "done"}
                server.job_images[key] = bytes(2 * 1024 * 1024)
            self.assertEqual(post({**payload, "requestId": "b" * 32})["id"], "b" * 32)
            self.assertLessEqual(sum(len(b) for b in server.job_images.values()), server.MAX_IMAGE_HISTORY_BYTES)
            self.assertIn("b" * 32, server.job_images)
            server.work.get_nowait(); server.work.task_done()
            server.jobs["b" * 32]["status"] = "done"
            for invalid in [0,5000,True,1.5,"300"]:
                with self.assertRaises(HTTPError) as bad_label:
                    post({**payload,"requestId":"c"*32,"tearAtRow":invalid})
                self.assertEqual(bad_label.exception.code,400);bad_label.exception.close()
            self.assertEqual(post({**payload,"requestId":"c"*32,"tearAtRow":300})["id"],"c"*32)
            queued=server.work.get_nowait();server.work.task_done()
            self.assertIsInstance(queued[1],bytes)
            self.assertEqual(queued[1].count(b"\x1dV\x42\x00"),1)
        finally:
            httpd.shutdown(); httpd.server_close()
            server.jobs.clear(); server.job_images.clear(); server.job_native_texts.clear()
            with server.clock_condition:
                server.clock_state["running"] = False

    def test_surface_label_partial_cut_keeps_one_atomic_raster(self):
        pixels = bytes([0xa5]) * 64 * 500
        encoded = server.escpos_surface_strip(500, pixels, True, 300)
        expected = (server.escpos_image(512, 300, pixels[:64*300], False)
                    + b"\x1dV\x42\x00"
                    + server.escpos_image(512, 200, pixels[64*300:], True, initialize=False))
        self.assertEqual(encoded, expected)
        self.assertEqual(encoded.count(b"\x1b@"), 1)
        self.assertEqual(encoded.count(b"\x1dV\x42\x00"), 1)
        self.assertTrue(encoded.endswith(b"\x1dV\x41\x20"))
        self.assertFalse(server.escpos_surface_strip(500, pixels, False, 300).endswith(b"\x1dV\x41\x20"))
        for invalid in [0, 500, -1, True, 2.5, "300"]:
            with self.assertRaises(ValueError):
                server.escpos_surface_strip(500, pixels, True, invalid)
        self.assertEqual(server.escpos_surface_strip(500, pixels), server.escpos_image(512,500,pixels))

    def test_long_strip_raster_is_continuous_and_cuts_only_at_the_end(self):
        height = 14135
        pixels = bytes([0xa5]) * (64 * height)
        body = {"width": 512, "height": height, "data": base64.b64encode(pixels).decode()}
        with self.assertRaises(ValueError):
            server.validate_receipt(body)
        self.assertEqual(server.validate_receipt(body, server.MAX_STRIP_HEIGHT, server.MAX_STRIP_BODY)[0], height)
        with self.assertRaises(ValueError):
            server.escpos_image(512, height, pixels)
        encoded = server.escpos_image(512, height, pixels, max_height=server.MAX_STRIP_HEIGHT)
        self.assertTrue(encoded.startswith(b"\x1b@")); self.assertTrue(encoded.endswith(b"\x1dV\x41\x20"))
        self.assertEqual(encoded.count(b"\x1dV\x41\x20"), 1)
        position = 2; rows = 0; reconstructed = bytearray()
        while rows < height:
            self.assertEqual(encoded[position:position+6], b"\x1dv0\x00\x40\x00")
            count = encoded[position+6] + 256 * encoded[position+7]
            self.assertLessEqual(count, 256)
            reconstructed.extend(encoded[position+8:position+8+count*64])
            position += 8 + count * 64; rows += count
        self.assertEqual(bytes(reconstructed), pixels)
        self.assertEqual(encoded[position:], b"\x1dV\x41\x20")

    def test_native_font_programs_are_bounded_and_use_rom_commands(self):
        self.assertEqual(set(native_fonts.TESTS), {"font-sample", "scaling-matrix", "typography-matrix", "character-pages"})
        for test in native_fonts.TESTS.values():
            self.assertLess(len(test.data), 5000)
            self.assertTrue(test.data.startswith(b"\x1b@"))
            self.assertTrue(test.data.endswith(b"\x1dV\x41\x20"))
            self.assertIn(b"\x1bM\x00", test.data)
            if test.id != "character-pages":
                self.assertIn(b"\x1bM\x01", test.data)
        matrix = native_fonts.TESTS["scaling-matrix"].data
        for height in range(1, 9):
            for width in range(1, 9):
                self.assertEqual(matrix.count(b"\x1d!" + bytes((((width - 1) << 4) | (height - 1),)) + b"M"), 2)
        pages = native_fonts.TESTS["character-pages"].data
        self.assertIn(b"\x1bR\x05", pages)
        self.assertIn(b"FI: [\\]{|}", pages)
        self.assertIn(b"\x1d!\x11", pages)
        for page in (0, 2, 5, 19):
            self.assertIn(b"\x1bt" + bytes((page,)), pages)

    def test_all_character_pages_and_native_composition(self):
        self.assertEqual(len(native_fonts.CODE_PAGES), 42)
        self.assertEqual(len(native_fonts.COUNTRIES), 18)
        self.assertEqual(native_fonts.page_catalog()["userDefinedPage"], 255)
        for page in native_fonts.CODE_PAGES:
            self.assertEqual(len(native_fonts.page_glyphs(page)["glyphs"]), 224)
        cyrillic = native_fonts.compose({"page": 17, "text": "Привет", "font": "A", "width": 2, "height": 2})
        self.assertIn("Привет".encode("cp866"), cyrillic.data)
        self.assertIn(b"\x1bt\x11", cyrillic.data)
        icelandic = native_fonts.compose({"page": 35, "text": "Þór Ðýr", "font": "B", "country": 9})
        self.assertIn("Þór Ðýr".encode("cp861"), icelandic.data)
        self.assertIn(b"\x1bR\x09", icelandic.data)
        katakana = native_fonts.compose({"page": 1, "hex": "80 81 FF", "cut": False})
        self.assertIn(b"\x80\x81\xff", katakana.data)
        self.assertFalse(katakana.data.endswith(b"\x1dV\x41\x20"))
        with self.assertRaisesRegex(ValueError, "glyph byte codes"):
            native_fonts.compose({"page": 1, "text": "カタカナ"})
        with self.assertRaisesRegex(ValueError, "20–FF"):
            native_fonts.compose({"page": 0, "hex": "1B 41"})
        with self.assertRaisesRegex(ValueError, "24 printed lines"):
            native_fonts.compose({"page": 0, "text": "A" * 1000, "width": 8})

    def test_inspect_receipt_json_and_zip_rejects_bad_members(self):
        receipt = {"format": "muusia-receipt", "version": 1, "width": 512, "height": 1,
                   "data": base64.b64encode(bytes([0x80]) + bytes(63)).decode(), "cut": False}
        raw = json.dumps(receipt).encode()
        self.assertEqual(server.inspect_file("card.muusia-receipt.json", raw)[0]["height"], 1)
        archive_bytes = io.BytesIO()
        with zipfile.ZipFile(archive_bytes, "w") as archive:
            archive.writestr("a/f001.muusia-receipt.json", raw)
            archive.writestr("b/f002.muusia-receipt.json", raw)
        self.assertEqual(len(server.inspect_file("frames.zip", archive_bytes.getvalue())), 2)
        with zipfile.ZipFile(archive_bytes, "a") as archive:
            archive.writestr("bad.txt", b"not a receipt")
        with self.assertRaisesRegex(ValueError, "unsupported"):
            server.inspect_file("frames.zip", archive_bytes.getvalue())
        with self.assertRaisesRegex(ValueError, "Bitmap byte count"):
            server.inspect_file("bad.json", json.dumps({**receipt, "data": "AA=="}).encode())

    def test_escpos_image_chunks_and_cuts(self):
        pixels = bytes([0x80]) + bytes(512 * 257 // 8 - 1)
        output = server.escpos_image(512, 257, pixels)
        self.assertEqual(output[:10], b"\x1b@\x1dv0\x00\x40\x00\x00\x01")
        self.assertEqual(output[10], 0x80)
        self.assertEqual(output[10 + 256 * 64:10 + 256 * 64 + 8], b"\x1dv0\x00\x40\x00\x01\x00")
        self.assertTrue(output.endswith(b"\x1dV\x41\x20"))

    def test_thermal_text_wraps_image_in_one_queued_receipt(self):
        pixels = bytes([0x80]) + bytes(63)
        before = {"position": "before", "page": 17, "text": "Привет", "font": "B",
                  "width": 2, "height": 2, "align": 1, "bold": True}
        after = {"position": "after", "page": 35, "text": "Þór", "align": 2,
                 "underline": True, "reverse": True}
        receipt = {"format": "muusia-receipt", "version": 1, "width": 512, "height": 1,
                   "data": base64.b64encode(pixels).decode(), "thermalText": [before, after], "cut": True}
        height, decoded, cut, blocks = server.validate_receipt(receipt)
        self.assertEqual((height, decoded, cut, blocks), (1, pixels, True, [before, after]))
        expected = (b"\x1b@" + native_fonts.receipt_block(before)
                    + server.escpos_image(512, 1, pixels, cut=False, initialize=False)
                    + native_fonts.receipt_block(after) + b"\x1dV\x41\x20")
        self.assertEqual(server.escpos_mixed_receipt(512, 1, pixels, blocks), expected)
        self.assertEqual(expected.count(b"\x1b@"), 1)
        self.assertEqual(expected.count(b"\x1dV\x41\x20"), 1)
        self.assertLess(expected.index("Привет".encode("cp866")), expected.index(b"\x1dv0"))
        self.assertLess(expected.index(b"\x1dv0"), expected.index("Þór".encode("cp861")))
        self.assertEqual(server.inspect_file("mixed.muusia-receipt.json", json.dumps(receipt).encode())[0]["thermalText"], blocks)
        with self.assertRaisesRegex(ValueError, "before or after"):
            server.validate_receipt({**receipt, "thermalText": [{**before, "position": "middle"}]})
        with self.assertRaisesRegex(ValueError, "at most 8"):
            server.validate_receipt({**receipt, "thermalText": [before] * 9})
        with self.assertRaisesRegex(ValueError, "unavailable on page"):
            server.validate_receipt({**receipt, "thermalText": [{**before, "page": 0}]})
        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "mixed.bin")
            old_output = os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")
            os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = output_path
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            threading.Thread(target=server.print_worker, daemon=True).start()
            base = f"http://127.0.0.1:{httpd.server_port}"
            try:
                request = Request(base + "/api/jobs", data=json.dumps(receipt).encode(),
                                  headers={"Content-Type": "application/json"})
                with urlopen(request, timeout=2) as response:
                    job_id = json.load(response)["id"]
                for _ in range(50):
                    with urlopen(base + "/api/jobs/" + job_id, timeout=2) as response:
                        status = json.load(response)["status"]
                    if status == "done":
                        break
                    time.sleep(0.01)
                self.assertEqual(status, "done")
                with open(output_path, "rb") as result:
                    self.assertEqual(result.read(), expected)
                with urlopen(base + "/api/jobs/" + job_id + "/receipt", timeout=2) as response:
                    self.assertEqual(json.load(response)["thermalText"], blocks)
            finally:
                httpd.shutdown()
                httpd.server_close()
                if old_output is None:
                    os.environ.pop("MUUSIA_PRINT_OUTPUT_FILE", None)
                else:
                    os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = old_output

    def test_clock_mode_runs_and_stops_without_cutting(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "clock.bin")
            old_output = os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")
            os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = output_path
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            threading.Thread(target=server.print_worker, daemon=True).start()
            base = f"http://127.0.0.1:{httpd.server_port}"
            def post(path, value=None):
                body = json.dumps(value).encode() if value is not None else b""
                with urlopen(Request(base + path, data=body, method="POST",
                                     headers={"Content-Type": "application/json"}), timeout=2) as response:
                    return json.load(response)
            def finished_lines(count):
                deadline = time.monotonic() + 4
                while time.monotonic() < deadline:
                    with urlopen(base + "/api/jobs", timeout=2) as response:
                        lines = [job for job in json.load(response)["jobs"]
                                 if job["kind"] == "clock" and job["status"] == "done"]
                    if len(lines) >= count:
                        return lines
                    time.sleep(.03)
                self.fail(f"Clock did not finish {count} lines")
            try:
                with urlopen(base + "/api/clock", timeout=2) as response:
                    self.assertFalse(json.load(response)["running"])
                self.assertTrue(post("/api/clock", {"interval": "second"})["running"])
                lines = finished_lines(2)
                self.assertEqual(len(lines[0]["name"].split()[-1]), 8)
                self.assertTrue(all(not line["cut"] for line in lines))
                stopped = post("/api/clock/stop")
                self.assertFalse(stopped["running"])
                before = len(finished_lines(2))
                time.sleep(1.1)
                self.assertEqual(len(finished_lines(2)), before)
                self.assertTrue(post("/api/clock", {"interval": "minute"})["running"])
                lines = finished_lines(3)
                self.assertEqual(len(lines[0]["name"].split()[-1]), 5)
                self.assertFalse(post("/api/clock/stop")["running"])
                with open(output_path, "rb") as result:
                    output = result.read()
                self.assertEqual(output.count(b"\x1b@"), len(lines))
                self.assertIn(b"\x1ba\x01", output)
                self.assertIn(b"\x1d!\x11", output)
                self.assertNotIn(b"\x1dV", output)
                with self.assertRaises(HTTPError) as invalid:
                    post("/api/clock", {"interval": "hour"})
                self.assertEqual(invalid.exception.code, 400)
                invalid.exception.close()
            finally:
                server.stop_clock()
                httpd.shutdown()
                httpd.server_close()
                if old_output is None:
                    os.environ.pop("MUUSIA_PRINT_OUTPUT_FILE", None)
                else:
                    os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = old_output

    def test_http_queue_origin_and_file_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "receipt.bin")
            old_output = os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")
            os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = output_path
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            threading.Thread(target=server.print_worker, daemon=True).start()
            base = f"http://127.0.0.1:{httpd.server_port}"
            try:
                payload = json.dumps({"width": 512, "height": 1, "data": base64.b64encode(bytes([0x80]) + bytes(63)).decode(), "cut": False}).encode()
                headers = {"Content-Type": "application/json", "Origin": "http://localhost:5173"}
                with urlopen(Request(base + "/api/jobs", data=payload, headers=headers), timeout=2) as response:
                    self.assertEqual(response.status, 202)
                    job_id = json.load(response)["id"]
                    self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://localhost:5173")
                for _ in range(50):
                    with urlopen(Request(base + "/api/jobs/" + job_id, headers=headers), timeout=2) as response:
                        status = json.load(response)["status"]
                    if status == "done":
                        break
                    time.sleep(0.01)
                self.assertEqual(status, "done")
                with open(output_path, "rb") as result:
                    self.assertEqual(result.read(), server.escpos_image(512, 1, bytes([0x80]) + bytes(63), False))
                before_cut = os.path.getsize(output_path)
                with urlopen(Request(base + "/api/cut", data=b"", method="POST", headers=headers), timeout=2) as response:
                    self.assertEqual(response.status, 202)
                    cut_id = json.load(response)["id"]
                for _ in range(50):
                    with urlopen(Request(base + "/api/jobs/" + cut_id, headers=headers), timeout=2) as response:
                        cut_job = json.load(response)
                    if cut_job["status"] == "done":
                        break
                    time.sleep(0.01)
                self.assertEqual(cut_job["kind"], "cut")
                self.assertEqual(cut_job["status"], "done")
                with open(output_path, "rb") as result:
                    result.seek(before_cut)
                    self.assertEqual(result.read(), b"\x1dV\x00")
                with urlopen(base + "/api/native-tests", timeout=2) as response:
                    self.assertEqual(len(json.load(response)["tests"]), 4)
                native = native_fonts.TESTS["font-sample"]
                with urlopen(base + "/api/native-tests/font-sample", timeout=2) as response:
                    self.assertEqual(json.load(response)["id"], native.id)
                with urlopen(base + "/api/native-tests/font-sample/bin", timeout=2) as response:
                    self.assertEqual(response.read(), native.data)
                    self.assertIn("print-font-sample.bin", response.headers["Content-Disposition"])
                before_native = os.path.getsize(output_path)
                with urlopen(Request(base + "/api/native-tests/font-sample", data=b"", method="POST"), timeout=2) as response:
                    native_id = json.load(response)["id"]
                for _ in range(50):
                    with urlopen(base + "/api/jobs/" + native_id, timeout=2) as response:
                        native_status = json.load(response)["status"]
                    if native_status == "done":
                        break
                    time.sleep(0.01)
                self.assertEqual(native_status, "done")
                with open(output_path, "rb") as result:
                    result.seek(before_native)
                    self.assertEqual(result.read(), native.data)
                with urlopen(base + "/api/native-pages", timeout=2) as response:
                    self.assertEqual(len(json.load(response)["pages"]), 42)
                with urlopen(base + "/api/native-pages/35", timeout=2) as response:
                    self.assertEqual(json.load(response)["name"], "PC861 · Icelandic")
                composition = {"page": 17, "font": "A", "width": 2, "height": 2, "text": "Привет"}
                composed = native_fonts.compose(composition)
                content = json.dumps(composition).encode()
                with urlopen(Request(base + "/api/native-compose/preview", data=content,
                                     headers={"Content-Type": "application/json"}), timeout=2) as response:
                    self.assertIn("Привет", json.load(response)["preview"][-1])
                with urlopen(Request(base + "/api/native-compose/bin", data=content,
                                     headers={"Content-Type": "application/json"}), timeout=2) as response:
                    self.assertEqual(response.read(), composed.data)
                before_compose = os.path.getsize(output_path)
                with urlopen(Request(base + "/api/native-compose", data=content,
                                     headers={"Content-Type": "application/json"}), timeout=2) as response:
                    composed_id = json.load(response)["id"]
                for _ in range(50):
                    with urlopen(base + "/api/jobs/" + composed_id, timeout=2) as response:
                        composed_status = json.load(response)["status"]
                    if composed_status == "done":
                        break
                    time.sleep(0.01)
                self.assertEqual(composed_status, "done")
                with open(output_path, "rb") as result:
                    result.seek(before_compose)
                    self.assertEqual(result.read(), composed.data)
                public_origin = "https://bambi8000.github.io"
                preflight = Request(base + "/api/jobs", method="OPTIONS", headers={
                    "Origin": public_origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Private-Network": "true",
                })
                with urlopen(preflight, timeout=2) as response:
                    self.assertEqual(response.status, 204)
                    self.assertEqual(response.headers["Access-Control-Allow-Origin"], public_origin)
                    self.assertEqual(response.headers["Access-Control-Allow-Private-Network"], "true")
                with urlopen(Request(base + "/health", headers={"Origin": public_origin}), timeout=2) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(json.load(response)["mode"], "test file")
                with urlopen(base + "/", timeout=2) as response:
                    self.assertIn(b"<title>Print</title>", response.read())
                    self.assertIn("default-src 'none'", response.headers["Content-Security-Policy"])
                with urlopen(Request(base + "/api/jobs"), timeout=2) as response:
                    self.assertTrue(any(job["id"] == job_id for job in json.load(response)["jobs"]))
                with urlopen(Request(base + "/api/jobs/" + job_id + "/receipt"), timeout=2) as response:
                    self.assertEqual(json.load(response)["data"], base64.b64encode(bytes([0x80]) + bytes(63)).decode())
                waiting_id = "a" * 32
                with server.jobs_lock:
                    server.jobs[waiting_id] = {"id": waiting_id, "status": "queued", "name": "Waiting", "height": 1,
                                               "width": 512, "cut": False, "createdAt": time.time()}
                with urlopen(Request(base + "/api/jobs/" + waiting_id, method="DELETE"), timeout=2) as response:
                    self.assertEqual(json.load(response)["status"], "cancelled")
                with server.jobs_lock:
                    server.jobs.pop(waiting_id, None)
                with urlopen(Request(base + "/api/inspect", data=json.dumps({"format": "muusia-receipt", "version": 1,
                         "width": 512, "height": 1, "data": base64.b64encode(bytes(64)).decode()}).encode(), headers={
                             "X-Muusia-Filename": "test.muusia-receipt.json"}), timeout=2) as response:
                    self.assertEqual(len(json.load(response)["receipts"]), 1)
                with self.assertRaises(HTTPError) as wrong_origin:
                    urlopen(Request(base + "/health", headers={"Origin": "https://example.com"}), timeout=2)
                self.assertEqual(wrong_origin.exception.code, 403)
                wrong_origin.exception.close()
                with self.assertRaises(HTTPError) as opaque_origin:
                    urlopen(Request(base + "/api/cut", data=b"", method="POST", headers={"Origin": "null"}), timeout=2)
                self.assertEqual(opaque_origin.exception.code, 403)
                opaque_origin.exception.close()
                with self.assertRaises(HTTPError) as spoofed_host:
                    urlopen(Request(base + "/health", headers={"Host": "untrusted.example", "Origin": "http://untrusted.example"}), timeout=2)
                self.assertEqual(spoofed_host.exception.code, 403)
                spoofed_host.exception.close()
            finally:
                httpd.shutdown()
                httpd.server_close()
                if old_output is None:
                    os.environ.pop("MUUSIA_PRINT_OUTPUT_FILE", None)
                else:
                    os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = old_output


if __name__ == "__main__":
    unittest.main()
