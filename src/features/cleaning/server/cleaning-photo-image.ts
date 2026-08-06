import "server-only";

import sharp from "sharp";

export async function normalizeCleaningPhoto(bytes: Uint8Array) {
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
