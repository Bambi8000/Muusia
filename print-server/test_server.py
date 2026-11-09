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


class PrintServerTests(unittest.TestCase):
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
                    self.assertIn(b"Muusia Print", response.read())
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
