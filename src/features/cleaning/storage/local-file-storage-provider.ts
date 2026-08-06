import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { withBasePath } from "@/lib/base-path";
import type { FileStorageProvider, StoredFileUpload } from "./file-storage-provider";

const DEFAULT_STORAGE_DIRECTORY = ".stayboard-storage/cleaning-photos";

export class LocalFileStorageProvider implements FileStorageProvider {
  private readonly rootDirectory: string;

  constructor(rootDirectory = process.env.FILE_STORAGE_LOCAL_ROOT ?? process.env.CLEANING_PHOTO_STORAGE_DIR ?? DEFAULT_STORAGE_DIRECTORY) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  private resolveStorageKey(storageKey: string) {
    if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.(?:jpg|png|webp|heic|heif)$/.test(storageKey)) {
      throw new Error("Invalid cleaning photo storage key.");
    }
    const resolved = path.resolve(this.rootDirectory, storageKey);
    if (!resolved.startsWith(`${this.rootDirectory}${path.sep}`)) {
      throw new Error("Cleaning photo storage key escaped its storage directory.");
    }
    return resolved;
  }

  async upload(file: StoredFileUpload) {
    if (!/^[A-Za-z0-9_-]+$/.test(file.taskId)) throw new Error("Invalid cleaning task id.");
    if (!/^(?:jpg|png|webp|heic|heif)$/.test(file.extension)) throw new Error("Invalid cleaning photo extension.");
    const storageKey = `${file.taskId}/${randomUUID()}.${file.extension}`;
    const destination = this.resolveStorageKey(storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) => writeFile(destination, file.data, { flag: "wx" }));
    return { storageKey };
  }

  async read(storageKey: string) {
    return { data: await readFile(this.resolveStorageKey(storageKey)) };
  }

  async delete(storageKey: string) {
    try {
      await unlink(this.resolveStorageKey(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  getUrl(photoId: string) {
    return withBasePath(`/api/cleaning/photos/${encodeURIComponent(photoId)}`);
  }
}

let localStorageProvider: LocalFileStorageProvider | undefined;

export function getCleaningPhotoStorage() {
  const provider = (process.env.FILE_STORAGE_PROVIDER ?? "local").trim().toLowerCase();
  if (provider !== "local") throw new Error(`Unsupported FILE_STORAGE_PROVIDER: ${provider}`);
  localStorageProvider ??= new LocalFileStorageProvider();
  return localStorageProvider;
}
