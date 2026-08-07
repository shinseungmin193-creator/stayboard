import { PROVIDER_HOSTS } from "./constants";
import type { CalendarProviderType, CalendarUrlValidationResult } from "./types";

export function validateProviderUrl(provider: CalendarProviderType, url: URL): CalendarUrlValidationResult {
  if (url.protocol !== "https:") return { valid: false, reason: "INVALID_PROTOCOL" };
  if (url.username || url.password) return { valid: false, reason: "EMBEDDED_CREDENTIALS" };
  if (!(PROVIDER_HOSTS[provider] as readonly string[]).includes(url.hostname.toLowerCase())) return { valid: false, reason: "UNSUPPORTED_HOST" };
  if (provider === "AGODA") {
    if (!/^\/en-us\/api\/ari\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+\/?$/i.test(url.pathname)) return { valid: false, reason: "INVALID_PATH" };
    if (!url.searchParams.get("key")?.trim()) return { valid: false, reason: "MISSING_CREDENTIAL" };
  }
  return { valid: true };
}

export function supportsProviderUrl(provider: CalendarProviderType, url: URL): boolean {
  return validateProviderUrl(provider, url).valid;
}
