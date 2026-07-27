import basePathConfig from "../../base-path.config.cjs";

export const APP_BASE_PATH = basePathConfig.APP_BASE_PATH;
export const normalizeBasePath = basePathConfig.normalizeBasePath;
export const resolveBasePath = basePathConfig.resolveBasePath;

export function withBasePath(path: `/${string}`): string {
  if (!APP_BASE_PATH || path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) {
    return path;
  }

  return path === "/" ? APP_BASE_PATH : `${APP_BASE_PATH}${path}`;
}
