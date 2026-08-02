import assert from "node:assert/strict";
import test from "node:test";

import { validateCleaningPhoto } from "../domain/cleaning-photo-validation";

test("validates the declared MIME type against image bytes", () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  assert.deepEqual(validateCleaningPhoto({ declaredMimeType: "image/jpeg", size: bytes.length, bytes }), {
    valid: true,
    mimeType: "image/jpeg",
    extension: "jpg",
  });
});

test("rejects a spoofed image MIME type", () => {
  const bytes = Uint8Array.from([0x6e, 0x6f, 0x74, 0x2d, 0x61, 0x6e, 0x2d, 0x69, 0x6d, 0x61, 0x67, 0x65]);
  assert.equal(validateCleaningPhoto({ declaredMimeType: "image/jpeg", size: bytes.length, bytes }).valid, false);
});
