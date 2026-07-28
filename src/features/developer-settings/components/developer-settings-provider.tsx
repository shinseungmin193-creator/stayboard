"use client";import { useTranslations } from "next-intl";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { applyRoomDensityPreset, DEFAULT_DEVELOPER_SETTINGS, normalizeDeveloperSettings, resetDeveloperSettingsSection, type DeveloperSettings, type RoomDensity } from "../domain/developer-settings";
import { clearDeveloperSettings, readDeveloperSettings, writeDeveloperSettings } from "../storage/developer-settings.storage";

interface DeveloperSettingsContextValue {
  settings: DeveloperSettings;
  hydrated: boolean;
  updateSettings(update: (current: DeveloperSettings) => DeveloperSettings): void;
  applyPreset(density: RoomDensity): void;
  resetSection(section: "roomOverview" | "debug" | "featureFlags"): void;
  resetAll(): void;
}

const DeveloperSettingsContext = createContext<DeveloperSettingsContextValue | null>(null);

export function DeveloperSettingsProvider({ children, enabled = true }: {children: ReactNode;enabled?: boolean;}) {
  const [settings, setSettings] = useState<DeveloperSettings>(DEFAULT_DEVELOPER_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSettings(enabled ? readDeveloperSettings(window.localStorage) : structuredClone(DEFAULT_DEVELOPER_SETTINGS));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [enabled]);
  const commit = useCallback((next: DeveloperSettings) => {
    const normalized = normalizeDeveloperSettings(next);
    setSettings(normalized);
    if (enabled) writeDeveloperSettings(window.localStorage, normalized);
  }, [enabled]);
  const updateSettings = useCallback((update: (current: DeveloperSettings) => DeveloperSettings) => setSettings((current) => {
    const next = normalizeDeveloperSettings(update(current));
    if (enabled) writeDeveloperSettings(window.localStorage, next);
    return next;
  }), [enabled]);
  const value = useMemo<DeveloperSettingsContextValue>(() => ({
    settings,
    hydrated,
    updateSettings,
    applyPreset: (density) => commit(applyRoomDensityPreset(settings, density)),
    resetSection: (section) => commit(resetDeveloperSettingsSection(settings, section)),
    resetAll: () => {if (enabled) clearDeveloperSettings(window.localStorage);commit(structuredClone(DEFAULT_DEVELOPER_SETTINGS));}
  }), [commit, enabled, hydrated, settings, updateSettings]);
  return <DeveloperSettingsContext.Provider value={value}>{children}</DeveloperSettingsContext.Provider>;
}

export function useDeveloperSettings() {const i18n = useTranslations();
  const context = useContext(DeveloperSettingsContext);
  if (!context) throw new Error(i18n("auto.m0348"));
  return context;
}

type RoomOverviewStyle = CSSProperties & Record<`--room-${string}`, string>;

export function RoomOverviewDeveloperSettingsBoundary({ children, enabled }: {children: ReactNode;enabled: boolean;}) {
  return <DeveloperSettingsProvider enabled={enabled}><RoomOverviewSettingsRoot enabled={enabled}>{children}</RoomOverviewSettingsRoot></DeveloperSettingsProvider>;
}

function RoomOverviewSettingsRoot({ children, enabled }: {children: ReactNode;enabled: boolean;}) {
  const { settings } = useDeveloperSettings();
  const room = enabled ? settings.roomOverview : DEFAULT_DEVELOPER_SETTINGS.roomOverview;
  const debug = enabled && settings.debug.enabled ? settings.debug : { ...DEFAULT_DEVELOPER_SETTINGS.debug, enabled: false };
  const style: RoomOverviewStyle = {
    "--room-card-min-width": `${room.cardMinWidth}px`,
    "--room-card-min-height": `${room.cardMinHeight}px`,
    "--room-grid-gap": `${room.gridGap}px`,
    "--room-card-padding": `${room.bodyPadding}px`,
    "--room-status-bar-height": `${room.statusBarHeight}px`,
    "--room-property-font-size": `${room.propertyFontSize}px`,
    "--room-name-font-size": `${room.roomFontSize}px`,
    "--room-schedule-panel-width": `${room.schedulePanelWidth}px`
  };
  return <div data-room-overview-settings data-schedule-visible={room.schedulePanelVisible} data-provider-size={room.providerBadgeSize} data-show-property={room.showPropertyName} data-show-providers={room.showProviderBadges} data-show-guest={room.showGuestName} data-show-stay-dates={room.showStayDates} data-show-night-count={room.showNightCount} data-show-next-reservation={room.showNextReservation} data-show-sync-warnings={room.showSyncWarnings} data-show-no-conflict={room.showNoConflictText} data-show-footer={room.showFooterActions} data-debug-enabled={debug.enabled} data-debug-room-id={debug.showRoomId} data-debug-reservation-id={debug.showReservationId} data-debug-calendar-source-id={debug.showCalendarSourceId} data-debug-internal-status={debug.showInternalStatus} data-debug-provider-raw={debug.showProviderRawValue} data-debug-render-time={debug.showRenderReferenceTime} data-debug-reservation-count={debug.showReservationCount} style={style}>{children}</div>;
}
