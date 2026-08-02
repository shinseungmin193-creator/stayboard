export const MAX_CLEANING_PHOTO_SIZE = 10 * 1024 * 1024;

export const CLEANING_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type CleaningPhotoMimeType = (typeof CLEANING_PHOTO_MIME_TYPES)[number];

export const CLEANING_PHOTO_EXTENSIONS: Record<CleaningPhotoMimeType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectCleaningPhotoMimeType(bytes: Uint8Array): CleaningPhotoMimeType | null {
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (
    bytes.length >= 12
    && startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) return "image/webp";
  return null;
}

export function validateCleaningPhoto(input: { declaredMimeType: string; size: number; bytes: Uint8Array }) {
  if (input.size <= 0 || input.bytes.length <= 0) return { valid: false as const, reason: "empty" as const };
  if (input.size > MAX_CLEANING_PHOTO_SIZE || input.bytes.length > MAX_CLEANING_PHOTO_SIZE) {
    return { valid: false as const, reason: "tooLarge" as const };
  }
  const detectedMimeType = detectCleaningPhotoMimeType(input.bytes);
  const normalizedDeclaredMimeType = input.declaredMimeType === "image/jpg" ? "image/jpeg" : input.declaredMimeType;
  if (!detectedMimeType || detectedMimeType !== normalizedDeclaredMimeType) {
    return { valid: false as const, reason: "invalidType" as const };
  }
  return {
    valid: true as const,
    mimeType: detectedMimeType,
    extension: CLEANING_PHOTO_EXTENSIONS[detectedMimeType],
  };
}
