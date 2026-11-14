import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import ascii_receipt
import server


class AsciiTests(unittest.TestCase):
    def setUp(self):
        self.body = {"font": "B", "lineSpacing": 18, "left": 22, "lines": ["01':;|", "  0011"], "cut": False}

    def test_printable_bounds_and_cut(self):
        for change in ({"font": "C"}, {"lines": ["\x1b@"]}, {"lines": ["ä"]}, {"lines": ["0\n1"]},
                       {"lines": ["0" * 57]}, {"lines": []}, {"lineSpacing": True}, {"lineSpacing": 16},
                       {"left": -1}, {"left": True}, {"font": "A", "lineSpacing": 23},
                       {"lines": ["0"] * (server.MAX_HEIGHT // 18 + 1)}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                ascii_receipt.escpos_text({**self.body, **change})
        data = ascii_receipt.escpos_text(self.body)
        self.assertTrue(data.endswith(b"\x1dVA\x20\x1b@"))
        self.assertNotIn(b"\x1dv0", data)
        self.assertNotIn(b"\x1dV", ascii_receipt.escpos_text(self.body, False))

    def test_long_text_has_bounded_continuous_transport(self):
        for left in (10, 22, 30):  # numeric ESC $ parameters can contain LF
            body = {**self.body, "left": left, "lines": ["0 1 0"] * (server.MAX_HEIGHT // 18)}
            data = ascii_receipt.escpos_text(body)
            parts = ascii_receipt.program_segments(data)
            self.assertEqual(b"".join(data for data, _ in parts), data)
            self.assertEqual(sum(rows for _, rows in parts), len(body["lines"]) * 18)
            self.assertTrue(all(len(data) < 1024 for data, _ in parts))
            self.assertTrue(all(rows <= 16 * 18 for _, rows in parts))
            self.assertEqual(sum(data.count(b"\x1dVA\x20") for data, _ in parts), 1)

    def test_http_binary_preview_and_queue(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{httpd.server_port}"
        def post(path, body):
            return urlopen(Request(base + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "Origin": "https://bambi8000.github.io"}), timeout=3)
        try:
            with urlopen(base + "/health", timeout=3) as response:
                self.assertIn("text", json.load(response)["formats"])
            with post("/api/ascii-bin", self.body) as response:
                self.assertEqual(response.read(), ascii_receipt.escpos_text(self.body, False))
            with post("/api/ascii-preview", self.body) as response:
                self.assertEqual(json.load(response)["height"], 36)
            with post("/api/ascii-jobs", self.body) as response:
                job_id = json.load(response)["id"]
            job, raw, cut = server.work.get_nowait()
            server.work.task_done()
            self.assertEqual(job, job_id)
            self.assertEqual(raw, ascii_receipt.escpos_text(self.body, False))
            self.assertFalse(cut)
            self.assertEqual(server.jobs.pop(job_id)["kind"], "ascii")
            for bad in ({**self.body, "lines": ["\x1b@"]}, {**self.body, "cut": "yes"}, []):
                with self.assertRaises(HTTPError) as rejected:
                    post("/api/ascii-jobs", bad)
                self.assertEqual(rejected.exception.code, 400)
                rejected.exception.close()
        finally:
            httpd.shutdown()
            httpd.server_close()
