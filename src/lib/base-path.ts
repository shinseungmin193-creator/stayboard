const BASE_PATH_ERROR =
  "NEXT_PUBLIC_BASE_PATH는 비어 있거나 /로 시작하고 끝에 /가 없는 경로여야 합니다.";

export function normalizeBasePath(value: string | undefined): string {
  const normalized = value?.trim() ?? "";

  if (!normalized || normalized === "/") return "";
  if (
    !normalized.startsWith("/")
    || normalized.endsWith("/")
    || normalized.includes("?")
    || normalized.includes("#")
    || normalized.includes("//")
  ) {
    throw new Error(BASE_PATH_ERROR);
  }

  return normalized;
}

export const APP_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export function withBasePath(path: `/${string}`): string {
  if (!APP_BASE_PATH || path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) {
    return path;
  }

  return path === "/" ? APP_BASE_PATH : `${APP_BASE_PATH}${path}`;
}
