export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function isNormalizedEmail(value: string) {
  return value === normalizeEmail(value);
}
