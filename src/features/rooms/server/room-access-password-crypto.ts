import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function encryptionKey() {
  const secret = process.env.ROOM_ACCESS_PASSWORD_ENCRYPTION_KEY?.trim()
    || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("ROOM_ACCESS_PASSWORD_ENCRYPTION_KEY must be at least 32 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptRoomAccessPassword(password: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptRoomAccessPassword(payload: string) {
  const [version, ivValue, authTagValue, ciphertextValue, extra] = payload.split(":");
  if (version !== VERSION || !ivValue || !authTagValue || !ciphertextValue || extra !== undefined) {
    throw new Error("Unsupported room access password payload");
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
