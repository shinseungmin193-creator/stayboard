export type ClientOperationCrypto = {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
};

let fallbackSequence = 0;

function formatUuidV4(values: Uint8Array) {
  values[6] = (values[6] & 0x0f) | 0x40;
  values[8] = (values[8] & 0x3f) | 0x80;
  const hex = Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createFallbackUuidValues(scope: string) {
  fallbackSequence += 1;
  let seed = (Date.now() ^ fallbackSequence) >>> 0;
  for (let index = 0; index < scope.length; index += 1) {
    seed = Math.imul(seed ^ scope.charCodeAt(index), 1_664_525) + 1_013_904_223;
  }
  const values = new Uint8Array(16);
  for (let index = 0; index < values.length; index += 1) {
    seed = Math.imul(seed ^ (seed >>> 16), 1_664_525) + 1_013_904_223 + index;
    values[index] = seed >>> 24;
  }
  return values;
}

/**
 * Creates a non-secret identifier for client-side UI rows and idempotent operations.
 * This must never be used as an authentication token or other security credential.
 */
export function createClientOperationId(
  fallbackPrefix: string,
  cryptoApi: ClientOperationCrypto | undefined = typeof globalThis.crypto === "undefined"
    ? undefined
    : globalThis.crypto,
): string {
  try {
    const uuid = cryptoApi?.randomUUID?.();
    if (uuid) return uuid;
  } catch {
    // randomUUID may be unavailable or rejected in non-secure HTTP contexts.
  }

  try {
    if (cryptoApi?.getRandomValues) {
      return formatUuidV4(cryptoApi.getRandomValues(new Uint8Array(16)));
    }
  } catch {
    // Very old browsers still need a stable per-page fallback for non-secret IDs.
  }

  return formatUuidV4(createFallbackUuidValues(fallbackPrefix));
}
