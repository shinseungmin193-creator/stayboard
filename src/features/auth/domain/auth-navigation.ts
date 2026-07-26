export function safeInternalAuthPath(path: string | undefined): `/${string}` {
  if (!path?.startsWith("/") || path.startsWith("//")) return "/";
  return path as `/${string}`;
}
