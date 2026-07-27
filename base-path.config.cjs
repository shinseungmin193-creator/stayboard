"use strict";

const DEPLOYMENT_BASE_PATH = "/stayboard";
const BASE_PATH_ERROR =
  "NEXT_PUBLIC_BASE_PATH는 비어 있거나 /로 시작하고 끝에 /가 없는 경로여야 합니다.";

function normalizeBasePath(value) {
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

function resolveBasePath(value, nodeEnv) {
  const normalized = normalizeBasePath(value);

  if (nodeEnv === "production") {
    return normalized || DEPLOYMENT_BASE_PATH;
  }

  return value === undefined ? DEPLOYMENT_BASE_PATH : normalized;
}

const APP_BASE_PATH = resolveBasePath(
  process.env.NEXT_PUBLIC_BASE_PATH,
  process.env.NODE_ENV,
);

module.exports = {
  APP_BASE_PATH,
  normalizeBasePath,
  resolveBasePath,
};
