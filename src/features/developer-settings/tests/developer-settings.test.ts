import assert from "node:assert/strict";
import test from "node:test";
import { applyRoomDensityPreset, DEFAULT_DEVELOPER_SETTINGS, DEVELOPER_SETTINGS_STORAGE_KEY, normalizeDeveloperSettings, resetDeveloperSettingsSection } from "../domain/developer-settings";
import { readDeveloperSettings, writeDeveloperSettings, type SettingsStorage } from "../storage/developer-settings.storage";

class MemoryStorage implements SettingsStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("SSR처럼 storage가 없으면 기본값을 반환한다", () => assert.deepEqual(readDeveloperSettings(null), DEFAULT_DEVELOPER_SETTINGS));
test("localStorage 저장값을 복원한다", () => { const storage = new MemoryStorage(); const changed = applyRoomDensityPreset(DEFAULT_DEVELOPER_SETTINGS, "compact"); writeDeveloperSettings(storage, changed); assert.equal(readDeveloperSettings(storage).roomOverview.density, "compact"); });
test("객실 현황 표시 토글을 모두 false로 저장하고 복원한다", () => {
  const storage = new MemoryStorage();
  const roomOverview = {
    ...DEFAULT_DEVELOPER_SETTINGS.roomOverview,
    showPropertyName: false,
    showProviderBadges: false,
    showGuestName: false,
    showStayDates: false,
    showNightCount: false,
    showNextReservation: false,
    showSyncWarnings: false,
    showNoConflictText: false,
    showFooterActions: false,
    schedulePanelVisible: false,
  };

  writeDeveloperSettings(storage, { ...DEFAULT_DEVELOPER_SETTINGS, roomOverview });

  assert.deepEqual(readDeveloperSettings(storage).roomOverview, roomOverview);
});
test("잘못된 JSON과 version은 기본값으로 복원한다", () => { const storage = new MemoryStorage(); storage.setItem(DEVELOPER_SETTINGS_STORAGE_KEY, "{"); assert.deepEqual(readDeveloperSettings(storage), DEFAULT_DEVELOPER_SETTINGS); storage.setItem(DEVELOPER_SETTINGS_STORAGE_KEY, JSON.stringify({ version: 2 })); assert.deepEqual(readDeveloperSettings(storage), DEFAULT_DEVELOPER_SETTINGS); });
test("숫자 범위를 clamp하고 step을 정규화한다", () => { const result = normalizeDeveloperSettings({ ...DEFAULT_DEVELOPER_SETTINGS, roomOverview: { ...DEFAULT_DEVELOPER_SETTINGS.roomOverview, cardMinWidth: 999, gridGap: 7 } }); assert.equal(result.roomOverview.cardMinWidth, 360); assert.equal(result.roomOverview.gridGap, 8); });
test("프리셋과 Section 기본값을 적용한다", () => { const compact = applyRoomDensityPreset(DEFAULT_DEVELOPER_SETTINGS, "ultra-compact"); assert.equal(compact.roomOverview.cardMinWidth, 210); const reset = resetDeveloperSettingsSection({ ...compact, debug: { ...compact.debug, enabled: true } }, "debug"); assert.equal(reset.debug.enabled, false); });
test("Debug Mode OFF면 세부 설정이 있어도 활성 상태가 아니다", () => { const settings = normalizeDeveloperSettings({ ...DEFAULT_DEVELOPER_SETTINGS, debug: { ...DEFAULT_DEVELOPER_SETTINGS.debug, enabled: false, showRoomId: true } }); assert.equal(settings.debug.enabled && settings.debug.showRoomId, false); });
