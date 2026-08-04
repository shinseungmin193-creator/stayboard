import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveCleaningPhotoStorageDirectory,
  verifyCleaningPhotoStorage,
} from "../verify-cleaning-photo-storage.mjs";

test("creates and verifies persistent cleaning photo storage without leaving probe files", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "stayboard-photo-storage-"));
  try {
    const storageDirectory = await verifyCleaningPhotoStorage({ cwd });
    assert.equal(storageDirectory, path.join(cwd, ".stayboard-storage", "cleaning-photos"));
    assert.deepEqual(await readdir(storageDirectory), []);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("rejects deployment-volatile public and Next build directories", () => {
  const cwd = path.resolve("stayboard-test-root");
  assert.throws(
    () => resolveCleaningPhotoStorageDirectory({ cwd, configuredDirectory: "public/cleaning-photos" }),
    /must not be inside/,
  );
  assert.throws(
    () => resolveCleaningPhotoStorageDirectory({ cwd, configuredDirectory: ".next/cleaning-photos" }),
    /must not be inside/,
  );
});
