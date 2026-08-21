import "server-only";

import sharp from "sharp";
import type { CleaningPhotoMimeType } from "../domain/cleaning-photo-validation";

export async function normalizeCleaningPhoto(bytes: Uint8Array, source: {
  mimeType: CleaningPhotoMimeType;
  extension: "jpg" | "png" | "webp" | "heic" | "heif";
}) {
  if (source.mimeType === "image/heic" || source.mimeType === "image/heif") {
    return {
      data: bytes,
      mimeType: source.mimeType,
      extension: source.extension,
      width: null,
      height: null,
    };
  }

  const image = sharp(bytes, { failOn: "warning" }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("The uploaded file is not a decodable image.");
  const data = await image
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const output = await sharp(data).metadata();
  return { data, mimeType: "image/webp" as const, extension: "webp" as const, width: output.width ?? null, height: output.height ?? null };
}
