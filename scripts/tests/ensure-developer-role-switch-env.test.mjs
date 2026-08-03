import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ensureDeveloperRoleSwitchEnv,
  inspectDeveloperRoleSwitchEnv,
  normalizeDeveloperRoleSwitchEnv,
} from "../ensure-developer-role-switch-env.mjs";

async function withTemporaryEnv(contents, run) {
  const directory = await mkdtemp(join(tmpdir(), "stayboard-role-switch-env-"));
  const envPath = join(directory, ".env");
  try {
    await writeFile(envPath, contents, "utf8");
    await run({ directory, envPath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("adds a missing key without changing other variables or CRLF", async () => {
  const original = "DATABASE_URL=keep-secret\r\nNEXTAUTH_SECRET=also-keep\r\n";
  await withTemporaryEnv(original, async ({ directory, envPath }) => {
    const result = await ensureDeveloperRoleSwitchEnv(envPath, { now: new Date("2026-08-03T12:34:56Z") });
    assert.equal(result.changed, true);
    assert.equal(await readFile(envPath, "utf8"), `${original}ENABLE_DEVELOPER_ROLE_SWITCH=true\r\n`);
    assert.equal(await readFile(result.backupPath, "utf8"), original);
    assert.deepEqual(inspectDeveloperRoleSwitchEnv(await readFile(envPath, "utf8")), { enabled: true, keyCount: 1 });
    assert.equal((await readdir(directory)).filter((name) => name.startsWith(".env.backup-")).length, 1);
    if (process.platform !== "win32") assert.equal((await stat(envPath)).mode & 0o777, 0o600);
  });
});

test("replaces false or spaced values and removes duplicate keys", async () => {
  const original = "KEEP=one\n ENABLE_DEVELOPER_ROLE_SWITCH = false \nKEEP_TOO=two\nENABLE_DEVELOPER_ROLE_SWITCH= true \n";
  await withTemporaryEnv(original, async ({ envPath }) => {
    await ensureDeveloperRoleSwitchEnv(envPath, { now: new Date("2026-08-03T12:35:00Z") });
    const updated = await readFile(envPath, "utf8");
    assert.equal(updated, "KEEP=one\nENABLE_DEVELOPER_ROLE_SWITCH=true\nKEEP_TOO=two\n");
    assert.deepEqual(inspectDeveloperRoleSwitchEnv(updated), { enabled: true, keyCount: 1 });
  });
});

test("an already canonical file is unchanged and repeated runs are idempotent", async () => {
  const original = "OTHER=value\nENABLE_DEVELOPER_ROLE_SWITCH=true\n";
  await withTemporaryEnv(original, async ({ directory, envPath }) => {
    const first = await ensureDeveloperRoleSwitchEnv(envPath);
    const second = await ensureDeveloperRoleSwitchEnv(envPath);
    assert.equal(first.changed, false);
    assert.equal(second.changed, false);
    assert.equal(await readFile(envPath, "utf8"), original);
    assert.equal((await readdir(directory)).some((name) => name.startsWith(".env.backup-")), false);
  });
});

test("normalization and inspection reject absent, false, or duplicate final state", () => {
  assert.deepEqual(inspectDeveloperRoleSwitchEnv("OTHER=value\n"), { enabled: false, keyCount: 0 });
  assert.deepEqual(inspectDeveloperRoleSwitchEnv("ENABLE_DEVELOPER_ROLE_SWITCH=false\n"), { enabled: false, keyCount: 1 });
  assert.deepEqual(inspectDeveloperRoleSwitchEnv("ENABLE_DEVELOPER_ROLE_SWITCH=true\nENABLE_DEVELOPER_ROLE_SWITCH=true\n"), { enabled: false, keyCount: 2 });
  assert.equal(normalizeDeveloperRoleSwitchEnv("ENABLE_DEVELOPER_ROLE_SWITCH= true \n").contents, "ENABLE_DEVELOPER_ROLE_SWITCH=true\n");
});

test("keeps only the five most recent protected backups", async () => {
  await withTemporaryEnv("ENABLE_DEVELOPER_ROLE_SWITCH=false\n", async ({ directory, envPath }) => {
    for (let index = 0; index < 6; index += 1) {
      await writeFile(join(directory, `.env.backup-20260803-12000${index}`), "old", "utf8");
    }
    await ensureDeveloperRoleSwitchEnv(envPath, { now: new Date("2026-08-03T12:36:00Z"), backupLimit: 5 });
    const backups = (await readdir(directory)).filter((name) => name.startsWith(".env.backup-")).sort();
    assert.equal(backups.length, 5);
    assert.equal(backups.at(-1), ".env.backup-20260803-123600");
  });
});
