import os
import socket
import threading
import unittest
from unittest.mock import patch

import server
import usb_transport as usb


class UsbTransportTests(unittest.TestCase):
    def test_bands_preserve_payload_and_cuts_including_command_like_pixels(self):
        height = 9253 + 513
        pixels = bytearray((i * 31) % 256 for i in range(height * 64))
        pixels[9216 * 64:9216 * 64 + 8] = b'\x1dv0\x00\x40\x00\x20\x00'
        pixels = bytes(pixels)
        program = server.escpos_surface_strip(height, pixels, True, 9230)
        parts = usb.segments(program)
        raster = [(p, rows) for p, rows in parts if rows]
        self.assertEqual(b''.join(p[8:] for p, _ in raster), pixels)
        self.assertEqual(sum(rows for _, rows in raster), height)
        self.assertTrue(all(len(p) <= 2056 and rows <= 32 for p, rows in raster))
        self.assertEqual([p for p, rows in parts if not rows],
                         [b'\x1b@', b'\x1dV\x42\x00', b'\x1dV\x41\x20'])
        for invalid in [b'\x1dv0', b'\x1dv0\x00\x40\x00\x20\x00']:
            with self.assertRaises(ValueError):
                usb.segments(invalid)

    def test_continuous_transfer_fills_window_before_waiting_and_preserves_partial_writes(self):
        host, printer = socket.socketpair()
        host.setblocking(False)
        program = server.escpos_image(512, 1000, bytes([0xa5]) * 1000 * 64)
        parts = usb.segments(program)
        received, errors = [], []
        def take(n):
            out = bytearray()
            while len(out) < n:
                part = printer.recv(n - len(out))
                if not part:
                    raise RuntimeError('Unexpected end')
                out.extend(part)
            return bytes(out)
        def emulate():
            try:
                printer.settimeout(2)
                request = take(11)  # Initial paperless probe.
                printer.sendall(b'7"' + request[7:] + b'\x00')
                for start in range(0, len(parts), usb.WINDOW_BANDS):
                    # Deliberately withhold every response until a complete
                    # window has arrived. Waiting after one band deadlocks.
                    for payload, _ in parts[start:start + usb.WINDOW_BANDS]:
                        received.append(take(len(payload)))
                        request = take(11)
                        self.assertEqual(request[:7], b'\x1d(H\x06\x0000')
                    # A coalesced latest ID confirms the complete window.
                    printer.sendall(b'\x12' + b'7"OLD!\x00' + b'7"' + request[7:9])
                    printer.sendall(request[9:] + b'\x00')
            except Exception as exc:
                errors.append(exc)
        thread = threading.Thread(target=emulate); thread.start()
        actual_write = os.write
        progress = []
        try:
            with patch.object(usb.os, 'write', side_effect=lambda fd, data: actual_write(fd, data[:37])):
                usb.print_program(host.fileno(), parts, progress.append, timeout=3)
            thread.join(2)
            self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            self.assertEqual(b''.join(received), b''.join(p for p, _ in parts))
            self.assertEqual(progress[-1], 1000)
            self.assertEqual(progress, sorted(progress))
            self.assertEqual(len(progress), 3)
        finally:
            host.close(); printer.close()

    def test_missing_or_wrong_ack_stops_before_image_data(self):
        host, printer = socket.socketpair(); host.setblocking(False)
        try:
            printer.sendall(b'7"NOPE\x00')
            with self.assertRaisesRegex(TimeoutError, 'acknowledgement missing'):
                usb.acknowledge(host.fileno(), b'TEST', timeout=0.03)
            printer.settimeout(0.1)
            self.assertEqual(printer.recv(100), b'\x1d(H\x06\x0000TEST')
        finally:
            host.close(); printer.close()

    def test_disconnect_and_zero_writes_are_errors(self):
        host, printer = socket.socketpair(); host.setblocking(False)
        try:
            with patch.object(usb.os, 'write', return_value=0):
                with self.assertRaises(OSError):
                    usb.write_usb(host.fileno(), b'abc')
            printer.close()
            with self.assertRaises(OSError):
                usb.acknowledge(host.fileno(), b'TEST')
        finally:
            host.close(); printer.close()

    def test_usblp_empty_in_packet_is_not_stream_eof(self):
        with patch.object(usb, 'write_usb'), patch.object(usb.select, 'select', return_value=([1], [], [])), \
                patch.object(usb.os, 'read', side_effect=[b'', b'7"TEST\x00']):
            usb.acknowledge(1, b'TEST', timeout=0.1)

    def test_fault_latch_rejects_new_jobs_without_touching_printer(self):
        handler = object.__new__(server.Handler)
        replies = []
        handler._json = lambda status, body: replies.append((status, body))
        with patch.object(usb, 'failure', 'Transfer stopped; recover printer'), \
                patch.dict(os.environ, {}, clear=True):
            self.assertFalse(server.printer_ready())
            handler._enqueue('After failure', 1, bytes(64), False, 'receipt')
        self.assertEqual(replies, [(503, {'error': 'Transfer stopped; recover printer'})])

    def test_missing_pipeline_response_limits_backlog_and_sends_no_more_bands(self):
        host, printer = socket.socketpair(); host.setblocking(False)
        parts = usb.segments(server.escpos_image(512, 4096, bytes(4096 * 64)))
        received, errors = [], []
        def take(n):
            out = bytearray()
            while len(out) < n:
                piece = printer.recv(n - len(out))
                if not piece:
                    raise RuntimeError('Unexpected end')
                out.extend(piece)
            return bytes(out)
        def emulate():
            try:
                printer.settimeout(2)
                probe = take(11); printer.sendall(b'7"' + probe[7:] + b'\x00')
                for payload, _ in parts[:usb.WINDOW_BANDS]:
                    self.assertEqual(take(len(payload)), payload)
                    take(11); received.append(payload)
                # Never acknowledge: the next data must remain unsent.
                printer.settimeout(0.2)
                with self.assertRaises(socket.timeout):
                    printer.recv(1)
            except Exception as exc:
                errors.append(exc)
        thread = threading.Thread(target=emulate); thread.start()
        try:
            with self.assertRaisesRegex(TimeoutError, 'acknowledgement missing'):
                usb.print_program(host.fileno(), parts, timeout=0.1)
            thread.join(3)
            self.assertFalse(thread.is_alive()); self.assertEqual(errors, [])
            self.assertEqual(len(received), usb.WINDOW_BANDS)
        finally:
            host.close(); printer.close()
