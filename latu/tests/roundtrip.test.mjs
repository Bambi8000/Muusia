import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { emitGcode } from "../src/emitter.js";
import { parseGcode } from "../src/parser.js";

for (const fixture of ["servo-z.gcode", "servo-z-patch-21.gcode", "bed-z.gcode", "events.gcode"]) {
  test(`round-trip is byte-identical: ${fixture}`, async () => {
    const source = await readFile(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8");
    assert.equal(emitGcode(parseGcode(source)), source);
  });
}

test("round-trip preserves CRLF and a missing terminal newline", () => {
  const source = "; header\r\nG21\r\nG90";
  assert.equal(emitGcode(parseGcode(source)), source);
});
