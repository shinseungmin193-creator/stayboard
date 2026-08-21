import { getCleaningPhotoConfig } from "../config/cleaning-photo-config";

export const MAX_CLEANING_PHOTO_SIZE = getCleaningPhotoConfig().maxBytes;

export const CLEANING_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export type CleaningPhotoMimeType = (typeof CLEANING_PHOTO_MIME_TYPES)[number];
export const CLEANING_PHOTO_BROWSER_MIME_TYPES = [
  ...CLEANING_PHOTO_MIME_TYPES,
  "image/jpg",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

export const CLEANING_PHOTO_EXTENSIONS: Record<CleaningPhotoMimeType, "jpg" | "png" | "webp" | "heic" | "heif"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const CLEANING_PHOTO_ACCEPT = "image/*";
export const MAX_CLEANING_PHOTO_REQUEST_SIZE = MAX_CLEANING_PHOTO_SIZE + 512 * 1024;

export function normalizeCleaningPhotoDeclaredMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/heic-sequence") return "image/heic";
  if (normalized === "image/heif-sequence") return "image/heif";
  return normalized;
}

export function hasSupportedCleaningPhotoExtension(fileName: string) {
  return /\.(?:jpe?g|png|webp|heic|heif)$/i.test(fileName.trim());
}

export function isSupportedCleaningPhotoSelection(input: { declaredMimeType: string; fileName: string }) {
  const declaredMimeType = input.declaredMimeType.trim().toLowerCase();
  if (CLEANING_PHOTO_BROWSER_MIME_TYPES.includes(declaredMimeType as (typeof CLEANING_PHOTO_BROWSER_MIME_TYPES)[number])) {
    return true;
  }
  return (!declaredMimeType || declaredMimeType === "application/octet-stream")
    && hasSupportedCleaningPhotoExtension(input.fileName);
}

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
  if (bytes.length >= 12 && startsWith(bytes.subarray(4), [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

export function validateCleaningPhoto(input: { declaredMimeType: string; size: number; bytes: Uint8Array }) {
  if (input.size <= 0 || input.bytes.length <= 0) return { valid: false as const, reason: "empty" as const };
  if (input.size > MAX_CLEANING_PHOTO_SIZE || input.bytes.length > MAX_CLEANING_PHOTO_SIZE) {
    return { valid: false as const, reason: "tooLarge" as const };
  }
  const detectedMimeType = detectCleaningPhotoMimeType(input.bytes);
  const rawDeclaredMimeType = input.declaredMimeType.trim().toLowerCase();
  const normalizedDeclaredMimeType = normalizeCleaningPhotoDeclaredMimeType(rawDeclaredMimeType);
  const genericDeclaredMimeType = !normalizedDeclaredMimeType || normalizedDeclaredMimeType === "application/octet-stream";
  const heifFamilyMatch = (detectedMimeType === "image/heic" || detectedMimeType === "image/heif")
    && (normalizedDeclaredMimeType === "image/heic" || normalizedDeclaredMimeType === "image/heif");
  if (!detectedMimeType || (!genericDeclaredMimeType && detectedMimeType !== normalizedDeclaredMimeType && !heifFamilyMatch)) {
    return { valid: false as const, reason: "invalidType" as const };
  }
  return {
    valid: true as const,
    mimeType: detectedMimeType,
    extension: CLEANING_PHOTO_EXTENSIONS[detectedMimeType],
  };
}
