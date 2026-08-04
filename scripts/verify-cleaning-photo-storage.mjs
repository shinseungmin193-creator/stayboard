import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_STORAGE_DIRECTORY = ".stayboard-storage/cleaning-photos";

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export function resolveCleaningPhotoStorageDirectory({ cwd = process.cwd(), configuredDirectory } = {}) {
  const projectDirectory = path.resolve(cwd);
  const storageDirectory = path.resolve(projectDirectory, configuredDirectory || DEFAULT_STORAGE_DIRECTORY);
  for (const volatileDirectory of ["public", ".next"].map((name) => path.join(projectDirectory, name))) {
    if (isInside(storageDirectory, volatileDirectory)) {
      throw new Error(`Cleaning photo storage must not be inside ${volatileDirectory}.`);
    }
  }
  return storageDirectory;
}

export async function verifyCleaningPhotoStorage(options = {}) {
  const storageDirectory = resolveCleaningPhotoStorageDirectory(options);
  await mkdir(storageDirectory, { recursive: true, mode: 0o750 });
  const probePath = path.join(storageDirectory, `.write-probe-${randomUUID()}`);
  const expected = `stayboard-storage-probe-${randomUUID()}`;
  try {
    await writeFile(probePath, expected, { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (await readFile(probePath, "utf8") !== expected) {
      throw new Error("Cleaning photo storage write/read verification failed.");
    }
  } finally {
    await unlink(probePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
  return storageDirectory;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  verifyCleaningPhotoStorage({ configuredDirectory: process.env.CLEANING_PHOTO_STORAGE_DIR })
    .then((storageDirectory) => console.log(storageDirectory))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
