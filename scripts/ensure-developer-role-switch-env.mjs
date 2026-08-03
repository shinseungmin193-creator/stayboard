import {
  chmod,
  chown,
  copyFile,
  lstat,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEVELOPER_ROLE_SWITCH_ENV_KEY = "ENABLE_DEVELOPER_ROLE_SWITCH";
const CANONICAL_LINE = `${DEVELOPER_ROLE_SWITCH_ENV_KEY}=true`;
const ENV_LINE_PATTERN = /^\s*ENABLE_DEVELOPER_ROLE_SWITCH\s*=/;

function formatTimestamp(date) {
  const digits = date.toISOString().replace(/[-:]/g, "").replace("T", "-");
  return digits.slice(0, 15);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeDeveloperRoleSwitchEnv(contents) {
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const endsWithNewline = /(?:\r\n|\n)$/.test(contents);
  const lines = contents.length ? contents.split(/\r?\n/) : [];
  if (endsWithNewline) lines.pop();

  let found = false;
  const normalizedLines = [];
  for (const line of lines) {
    if (!ENV_LINE_PATTERN.test(line)) {
      normalizedLines.push(line);
      continue;
    }
    if (!found) normalizedLines.push(CANONICAL_LINE);
    found = true;
  }
  if (!found) normalizedLines.push(CANONICAL_LINE);

  const normalized = normalizedLines.join(newline)
    + (endsWithNewline || contents.length === 0 ? newline : "");
  return {
    contents: normalized,
    changed: normalized !== contents,
    keyCount: normalizedLines.filter((line) => ENV_LINE_PATTERN.test(line)).length,
  };
}

export function inspectDeveloperRoleSwitchEnv(contents) {
  const matchingLines = contents.split(/\r?\n/).filter((line) => ENV_LINE_PATTERN.test(line));
  if (matchingLines.length !== 1) return { enabled: false, keyCount: matchingLines.length };
  const value = matchingLines[0].slice(matchingLines[0].indexOf("=") + 1).trim().toLowerCase();
  return { enabled: value === "true", keyCount: matchingLines.length };
}

async function nextBackupPath(envPath, now) {
  const basePath = `${envPath}.backup-${formatTimestamp(now)}`;
  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix ? `${basePath}-${suffix}` : basePath;
    try {
      await lstat(candidate);
    } catch (error) {
      if (error?.code === "ENOENT") return candidate;
      throw error;
    }
  }
}

async function pruneBackups(envPath, backupLimit) {
  const directory = dirname(envPath);
  const envName = basename(envPath);
  const backupPattern = new RegExp(`^${escapeRegExp(envName)}\\.backup-\\d{8}-\\d{6}(?:-\\d+)?$`);
  const backups = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && backupPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));
  await Promise.all(backups.slice(backupLimit).map((name) => rm(resolve(directory, name), { force: true })));
}

export async function ensureDeveloperRoleSwitchEnv(envFile, options = {}) {
  const envPath = resolve(envFile);
  const backupLimit = options.backupLimit ?? 5;
  const now = options.now ?? new Date();
  const stats = await lstat(envPath);
  if (!stats.isFile()) throw new Error(`운영 환경 파일이 일반 파일이 아닙니다: ${envPath}`);

  const original = await readFile(envPath, "utf8");
  const normalized = normalizeDeveloperRoleSwitchEnv(original);
  let backupPath = null;

  if (normalized.changed) {
    backupPath = await nextBackupPath(envPath, now);
    await copyFile(envPath, backupPath, fsConstants.COPYFILE_EXCL);
    await chmod(backupPath, 0o600);

    const temporaryPath = `${envPath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(temporaryPath, normalized.contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
      if (process.platform !== "win32") await chown(temporaryPath, stats.uid, stats.gid);
      await rename(temporaryPath, envPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  await chmod(envPath, 0o600);
  await pruneBackups(envPath, backupLimit);
  return { envPath, changed: normalized.changed, backupPath };
}

async function runCli() {
  const args = process.argv.slice(2);
  const checkOnly = args[0] === "--check";
  const envFile = checkOnly ? args[1] : args[0];
  if (!envFile || args.length !== (checkOnly ? 2 : 1)) {
    throw new Error("사용법: node scripts/ensure-developer-role-switch-env.mjs [--check] <환경 파일>");
  }

  if (checkOnly) {
    const envPath = resolve(envFile);
    const state = inspectDeveloperRoleSwitchEnv(await readFile(envPath, "utf8"));
    if (!state.enabled || state.keyCount !== 1) {
      throw new Error(`${DEVELOPER_ROLE_SWITCH_ENV_KEY} 환경변수 검증에 실패했습니다.`);
    }
    console.log(`[환경 확인] ${DEVELOPER_ROLE_SWITCH_ENV_KEY}=true`);
    return;
  }

  const result = await ensureDeveloperRoleSwitchEnv(envFile);
  console.log(`[환경 확인] 운영 환경 파일: ${basename(result.envPath)}`);
  console.log(`[환경 확인] ${DEVELOPER_ROLE_SWITCH_ENV_KEY}=true (${result.changed ? "updated" : "unchanged"})`);
  if (result.backupPath) console.log(`[환경 백업] ${basename(result.backupPath)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(`[배포 실패] ${error instanceof Error ? error.message : "운영 환경 파일을 처리하지 못했습니다."}`);
    process.exitCode = 1;
  });
}
