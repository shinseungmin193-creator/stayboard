import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type NetworkSafetyErrorCode = "PROTOCOL" | "PRIVATE_ADDRESS" | "DNS" | "TIMEOUT";

export class NetworkSafetyError extends Error {
  constructor(public readonly code: NetworkSafetyErrorCode) {
    super(code);
    this.name = "NetworkSafetyError";
  }
}

export function isPrivateNetworkAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || parts[0] === 0
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19))
      || (parts[0] >= 224);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fe80:")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("2001:db8:")
    || normalized.startsWith("::ffff:127.")
    || normalized.startsWith("::ffff:10.")
    || normalized.startsWith("::ffff:172.")
    || normalized.startsWith("::ffff:192.168.");
}

export function withAbortSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new NetworkSafetyError("TIMEOUT"));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new NetworkSafetyError("TIMEOUT"));
    signal.addEventListener("abort", abort, { once: true });
    operation.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

export async function assertSafePublicHttpsUrl(url: URL, signal: AbortSignal): Promise<void> {
  if (url.protocol !== "https:" || url.username || url.password) throw new NetworkSafetyError("PROTOCOL");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (["localhost", "localhost.localdomain", "0.0.0.0", "127.0.0.1", "::1"].includes(hostname)) {
    throw new NetworkSafetyError("PRIVATE_ADDRESS");
  }
  try {
    const addresses = await withAbortSignal(lookup(hostname, { all: true, verbatim: true }), signal);
    if (!addresses.length || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
      throw new NetworkSafetyError("PRIVATE_ADDRESS");
    }
  } catch (error) {
    if (error instanceof NetworkSafetyError) throw error;
    throw new NetworkSafetyError("DNS");
  }
}
