import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedCleaningPhotoSelection,
  MAX_CLEANING_PHOTO_SIZE,
  validateCleaningPhoto,
} from "../domain/cleaning-photo-validation";

function isoBaseMediaFile(brand: string) {
  return Uint8Array.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    ...Array.from(brand, (character) => character.charCodeAt(0)),
  ]);
}

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

test("accepts HEIC and HEIF photos selected by mobile browsers", () => {
  const heic = isoBaseMediaFile("heic");
  assert.deepEqual(validateCleaningPhoto({ declaredMimeType: "image/heic-sequence", size: heic.length, bytes: heic }), {
    valid: true,
    mimeType: "image/heic",
    extension: "heic",
  });

  const heif = isoBaseMediaFile("mif1");
  assert.deepEqual(validateCleaningPhoto({ declaredMimeType: "image/heif-sequence", size: heif.length, bytes: heif }), {
    valid: true,
    mimeType: "image/heif",
    extension: "heif",
  });
});

test("accepts a missing browser MIME declaration when the image signature is valid", () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  assert.equal(validateCleaningPhoto({ declaredMimeType: "", size: bytes.length, bytes }).valid, true);
  assert.equal(validateCleaningPhoto({ declaredMimeType: "application/octet-stream", size: bytes.length, bytes }).valid, true);
  assert.equal(isSupportedCleaningPhotoSelection({ declaredMimeType: "", fileName: "CAMERA_001.JPEG" }), true);
  assert.equal(isSupportedCleaningPhotoSelection({ declaredMimeType: "application/octet-stream", fileName: "IMG_001.HEIC" }), true);
  assert.equal(isSupportedCleaningPhotoSelection({ declaredMimeType: "", fileName: "payload.exe" }), false);
});

test("rejects photos larger than the configured ten MiB limit", () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  assert.deepEqual(validateCleaningPhoto({ declaredMimeType: "image/jpeg", size: MAX_CLEANING_PHOTO_SIZE + 1, bytes }), {
    valid: false,
    reason: "tooLarge",
  });
});
