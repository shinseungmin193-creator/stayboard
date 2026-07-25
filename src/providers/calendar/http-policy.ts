import { ICS_MAX_RESPONSE_BYTES } from "./constants";
export function isRetryableHttpStatus(status: number): boolean { return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504; }
export function exceedsResponseByteLimit(bytes: number): boolean { return Number.isFinite(bytes) && bytes > ICS_MAX_RESPONSE_BYTES; }
export function exceedsContentLengthLimit(value: string | null): boolean { if (!value) return false; const length = Number(value); return exceedsResponseByteLimit(length); }
