import base64
import json
import os
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class PrintServerTests(unittest.TestCase):
    def test_escpos_image_chunks_and_cuts(self):
        pixels = bytes([0x80]) + bytes(512 * 257 // 8 - 1)
        output = server.escpos_image(512, 257, pixels)
        self.assertEqual(output[:10], b"\x1b@\x1dv0\x00\x40\x00\x00\x01")
        self.assertEqual(output[10], 0x80)
        self.assertEqual(output[10 + 256 * 64:10 + 256 * 64 + 8], b"\x1dv0\x00\x40\x00\x01\x00")
        self.assertTrue(output.endswith(b"\x1bJ\x70\x1dV\x00"))

    def test_http_queue_auth_and_file_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "receipt.bin")
            old_token = os.environ.get("MUUSIA_PRINT_TOKEN")
            old_output = os.environ.get("MUUSIA_PRINT_OUTPUT_FILE")
            os.environ["MUUSIA_PRINT_TOKEN"] = "test-token"
            os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = output_path
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            threading.Thread(target=server.print_worker, daemon=True).start()
            base = f"http://127.0.0.1:{httpd.server_port}"
            try:
                payload = json.dumps({"width": 512, "height": 1, "data": base64.b64encode(bytes([0x80]) + bytes(63)).decode(), "cut": False}).encode()
                with self.assertRaises(HTTPError) as denied:
                    urlopen(Request(base + "/api/jobs", data=payload, headers={"Content-Type": "application/json"}), timeout=2)
                self.assertEqual(denied.exception.code, 401)
                denied.exception.close()
                headers = {"Content-Type": "application/json", "X-Muusia-Token": "test-token", "Origin": "http://localhost:5173"}
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
                with urlopen(Request(base + "/health", headers={"X-Muusia-Token": "test-token", "Origin": public_origin}), timeout=2) as response:
                    self.assertEqual(response.status, 200)
                with self.assertRaises(HTTPError) as wrong_origin:
                    urlopen(Request(base + "/health", headers={"X-Muusia-Token": "test-token", "Origin": "https://example.com"}), timeout=2)
                self.assertEqual(wrong_origin.exception.code, 403)
                wrong_origin.exception.close()
            finally:
                httpd.shutdown()
                httpd.server_close()
                if old_token is None:
                    os.environ.pop("MUUSIA_PRINT_TOKEN", None)
                else:
                    os.environ["MUUSIA_PRINT_TOKEN"] = old_token
                if old_output is None:
                    os.environ.pop("MUUSIA_PRINT_OUTPUT_FILE", None)
                else:
                    os.environ["MUUSIA_PRINT_OUTPUT_FILE"] = old_output


if __name__ == "__main__":
    unittest.main()
