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

    def test_native_size_all_fonts_and_scales(self):
        legacy = ascii_receipt.escpos_text(self.body)
        self.assertEqual(legacy, ascii_receipt.escpos_text({**self.body, "size": 1}))
        for font, width, height in (("A", 12, 24), ("B", 9, 17)):
            for size in range(1, 9):
                columns = 512 // (width * size)
                body = {**self.body, "font": font, "size": size, "left": (512 - columns * width * size) // 2,
                        "lineSpacing": height * size + 1, "lines": ["0" * columns] * 33}
                data = ascii_receipt.escpos_text(body)
                self.assertEqual(data[9], (size - 1) * 17)
                parts = ascii_receipt.program_segments(data)
                self.assertEqual(b"".join(part for part, _ in parts), data)
                self.assertEqual(sum(rows for _, rows in parts), 33 * body["lineSpacing"])
                self.assertTrue(all(rows <= 288 for _, rows in parts))
                with self.assertRaises(ValueError):
                    ascii_receipt.escpos_text({**body, "lines": ["0" * (columns + 1)]})
                with self.assertRaises(ValueError):
                    ascii_receipt.escpos_text({**body, "lineSpacing": height * size - 1})
        for size in (0, 9, -1, True, "2", 1.5, None):
            with self.subTest(size=size), self.assertRaises(ValueError):
                ascii_receipt.escpos_text({**self.body, "size": size})

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

    def test_overlay_pages_keep_both_sizes_and_one_cut(self):
        a = {**self.body, "lines": ["01 01"] * 98}
        b = {**self.body, "size": 2, "lineSpacing": 35, "lines": ["00 11"] * 50}
        data = ascii_receipt.escpos_text({"layers": [a, b]})
        parts = ascii_receipt.program_segments(data)
        self.assertEqual(b"".join(part for part, _ in parts), data)
        self.assertEqual(sum(rows for _, rows in parts), 1764)
        self.assertTrue(all(0 <= rows <= 1024 for _, rows in parts))
        self.assertEqual(len([rows for _, rows in parts if rows]), 3)
        self.assertEqual(data.count(b"\x1dVA\x20"), 1)
        self.assertIn(b"\x1d!\x00", data)
        self.assertIn(b"\x1d!\x11", data)
        self.assertNotIn(b"\x1dv0", data)
        for bad in ({"layers": []}, {"layers": [a] * 33}, {"layers": [{"layers": [a]}]}, {"layers": [a, {**b, "lines": ["\x1b@"]}]}):
            with self.assertRaises(ValueError):
                ascii_receipt.escpos_text(bad)
        # No silent clipping when an arbitrary combination has no shared gap.
        c = {**self.body, "size": 3, "lineSpacing": 52, "lines": ["1"] * 100}
        with self.assertRaisesRegex(ValueError, "shared row gap"):
            ascii_receipt.escpos_text({"layers": [b, c]})

    def test_overlay_text_baselines_and_full_glyph_bounds(self):
        # Epson TM-T88V ROM baselines: A=21, B=16. Interpret the emitted
        # cursor commands rather than assuming ESC W's origin is glyph top.
        # https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_cm.html
        for size in range(1, 9):
            spacing = 24 * size + 1
            layers = [{"font": font, "size": size, "lineSpacing": spacing,
                       "left": 12, "lines": ["01 0"] * 25} for font in ("A", "B")]
            data = ascii_receipt.escpos_text({"layers": layers})
            pos, page_top, page_height = 37, 0, 0
            font, scale, x, baseline = None, None, None, None
            actual = []
            while pos < len(data):
                command = data[pos:pos + 2]
                number = lambda offset: int.from_bytes(data[pos + offset:pos + offset + 2], "little")
                if command == b"\x1bL":
                    page_height = 0
                    pos += 2
                elif command == b"\x1bT":
                    self.assertEqual(data[pos + 2], 0)
                    pos += 3
                elif command == b"\x1bW":
                    self.assertEqual(page_height, 0, "ESC W must not reset each text row")
                    self.assertEqual((number(2), number(4), number(6)), (0, 0, 512))
                    page_height = number(8)
                    x = baseline = None
                    pos += 10
                elif command == b"\x1bM":
                    font = "B" if data[pos + 2] else "A"
                    pos += 3
                elif command == b"\x1d!":
                    scale = (data[pos + 2] & 7) + 1
                    pos += 3
                elif command == b"\x1b$":
                    x = number(2)
                    pos += 4
                elif command == b"\x1d$":
                    baseline = number(2)
                    pos += 4
                elif data[pos] == 12:
                    page_top += page_height
                    pos += 1
                elif command in (b"\x1dV", b"\x1b@"):
                    break
                else:
                    end = pos
                    while end < len(data) and 32 <= data[end] <= 126:
                        end += 1
                    self.assertGreater(end, pos)
                    self.assertIsNotNone(x, "every row needs its own x")
                    self.assertIsNotNone(baseline, "every row needs its own baseline")
                    width, height, offset = (12, 24, 21) if font == "A" else (9, 17, 16)
                    top = baseline - offset * scale
                    self.assertGreaterEqual(top, 0, "glyph top must not be clipped")
                    self.assertLessEqual(top + height * scale, page_height, "glyph bottom must not be clipped")
                    self.assertLessEqual(x + (end - pos) * width * scale, 512)
                    actual.append((font, scale, x, page_top + top, data[pos:end].decode("ascii")))
                    x = baseline = None
                    pos = end
            expected = [(layer["font"], size, 12, row * spacing, text)
                        for layer in layers for row, text in enumerate(layer["lines"])]
            self.assertEqual(sorted(actual), sorted(expected))
            self.assertEqual(page_top, 25 * spacing)
            parts = ascii_receipt.program_segments(data)
            self.assertEqual(b"".join(part for part, _ in parts), data)
            self.assertEqual(sum(rows for _, rows in parts), page_top)
