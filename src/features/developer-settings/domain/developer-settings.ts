export const DEVELOPER_SETTINGS_VERSION = 1 as const;
export const DEVELOPER_SETTINGS_STORAGE_KEY = "stayboard:developer-settings:v1";
export const ROOM_DENSITIES = ["comfortable", "default", "compact", "ultra-compact"] as const;
export type RoomDensity = (typeof ROOM_DENSITIES)[number];

export interface DeveloperSettings {
  version: 1;
  roomOverview: {
    density: RoomDensity;
    cardMinWidth: number;
    cardMinHeight: number;
    gridGap: number;
    bodyPadding: number;
    statusBarHeight: number;
    propertyFontSize: number;
    roomFontSize: number;
    providerBadgeSize: "sm" | "md";
    schedulePanelVisible: boolean;
    schedulePanelWidth: number;
    showPropertyName: boolean;
    showProviderBadges: boolean;
    showGuestName: boolean;
    showStayDates: boolean;
    showNightCount: boolean;
    showNextReservation: boolean;
    showSyncWarnings: boolean;
    showNoConflictText: boolean;
    showFooterActions: boolean;
  };
  debug: {
    enabled: boolean;
    showRoomId: boolean;
    showReservationId: boolean;
    showCalendarSourceId: boolean;
    showInternalStatus: boolean;
    showProviderRawValue: boolean;
    showRenderReferenceTime: boolean;
    showReservationCount: boolean;
  };
  featureFlags: {
    roomDetailPanel: boolean;
    roomCardPopover: boolean;
    experimentalFilters: boolean;
  };
}

export const ROOM_OVERVIEW_LIMITS = {
  cardMinWidth: { min: 210, max: 360, step: 10 },
  cardMinHeight: { min: 240, max: 340, step: 4 },
  gridGap: { min: 6, max: 20, step: 2 },
  bodyPadding: { min: 8, max: 20, step: 2 },
  statusBarHeight: { min: 32, max: 40, step: 2 },
  propertyFontSize: { min: 12, max: 16, step: 1 },
  roomFontSize: { min: 14, max: 20, step: 1 },
  schedulePanelWidth: { min: 260, max: 420, step: 10 },
} as const;

export const ROOM_DENSITY_PRESETS: Record<RoomDensity, Pick<DeveloperSettings["roomOverview"], "cardMinWidth" | "cardMinHeight" | "gridGap" | "bodyPadding">> = {
  comfortable: { cardMinWidth: 320, cardMinHeight: 300, gridGap: 16, bodyPadding: 16 },
  default: { cardMinWidth: 250, cardMinHeight: 272, gridGap: 8, bodyPadding: 12 },
  compact: { cardMinWidth: 240, cardMinHeight: 260, gridGap: 10, bodyPadding: 10 },
  "ultra-compact": { cardMinWidth: 210, cardMinHeight: 248, gridGap: 8, bodyPadding: 8 },
};

export const DEFAULT_DEVELOPER_SETTINGS: DeveloperSettings = {
  version: DEVELOPER_SETTINGS_VERSION,
  roomOverview: {
    density: "default",
    ...ROOM_DENSITY_PRESETS.default,
    statusBarHeight: 36,
    propertyFontSize: 14,
    roomFontSize: 16,
    providerBadgeSize: "sm",
    schedulePanelVisible: true,
    schedulePanelWidth: 300,
    showPropertyName: true,
    showProviderBadges: true,
    showGuestName: true,
    showStayDates: true,
    showNightCount: true,
    showNextReservation: true,
    showSyncWarnings: true,
    showNoConflictText: true,
    showFooterActions: true,
  },
  debug: {
    enabled: false,
    showRoomId: false,
    showReservationId: false,
    showCalendarSourceId: false,
    showInternalStatus: false,
    showProviderRawValue: false,
    showRenderReferenceTime: false,
    showReservationCount: false,
  },
  featureFlags: { roomDetailPanel: false, roomCardPopover: false, experimentalFilters: false },
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const bool = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => typeof value === "string" && values.includes(value as T) ? value as T : fallback;
const number = (value: unknown, key: keyof typeof ROOM_OVERVIEW_LIMITS, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const limit = ROOM_OVERVIEW_LIMITS[key];
  return Math.min(limit.max, Math.max(limit.min, Math.round(value / limit.step) * limit.step));
};

export function normalizeDeveloperSettings(value: unknown): DeveloperSettings {
  if (!isRecord(value) || value.version !== DEVELOPER_SETTINGS_VERSION) return structuredClone(DEFAULT_DEVELOPER_SETTINGS);
  const room = isRecord(value.roomOverview) ? value.roomOverview : {};
  const debug = isRecord(value.debug) ? value.debug : {};
  const flags = isRecord(value.featureFlags) ? value.featureFlags : {};
  const defaults = DEFAULT_DEVELOPER_SETTINGS;
  return {
    version: DEVELOPER_SETTINGS_VERSION,
    roomOverview: {
      density: choice(room.density, ROOM_DENSITIES, defaults.roomOverview.density),
      cardMinWidth: number(room.cardMinWidth, "cardMinWidth", defaults.roomOverview.cardMinWidth),
      cardMinHeight: number(room.cardMinHeight, "cardMinHeight", defaults.roomOverview.cardMinHeight),
      gridGap: number(room.gridGap, "gridGap", defaults.roomOverview.gridGap),
      bodyPadding: number(room.bodyPadding, "bodyPadding", defaults.roomOverview.bodyPadding),
      statusBarHeight: number(room.statusBarHeight, "statusBarHeight", defaults.roomOverview.statusBarHeight),
      propertyFontSize: number(room.propertyFontSize, "propertyFontSize", defaults.roomOverview.propertyFontSize),
      roomFontSize: number(room.roomFontSize, "roomFontSize", defaults.roomOverview.roomFontSize),
      providerBadgeSize: choice(room.providerBadgeSize, ["sm", "md"] as const, defaults.roomOverview.providerBadgeSize),
      schedulePanelVisible: bool(room.schedulePanelVisible, defaults.roomOverview.schedulePanelVisible),
      schedulePanelWidth: number(room.schedulePanelWidth, "schedulePanelWidth", defaults.roomOverview.schedulePanelWidth),
      showPropertyName: bool(room.showPropertyName, defaults.roomOverview.showPropertyName),
      showProviderBadges: bool(room.showProviderBadges, defaults.roomOverview.showProviderBadges),
      showGuestName: bool(room.showGuestName, defaults.roomOverview.showGuestName),
      showStayDates: bool(room.showStayDates, defaults.roomOverview.showStayDates),
      showNightCount: bool(room.showNightCount, defaults.roomOverview.showNightCount),
      showNextReservation: bool(room.showNextReservation, defaults.roomOverview.showNextReservation),
      showSyncWarnings: bool(room.showSyncWarnings, defaults.roomOverview.showSyncWarnings),
      showNoConflictText: bool(room.showNoConflictText, defaults.roomOverview.showNoConflictText),
      showFooterActions: bool(room.showFooterActions, defaults.roomOverview.showFooterActions),
    },
    debug: {
      enabled: bool(debug.enabled, defaults.debug.enabled),
      showRoomId: bool(debug.showRoomId, defaults.debug.showRoomId),
      showReservationId: bool(debug.showReservationId, defaults.debug.showReservationId),
      showCalendarSourceId: bool(debug.showCalendarSourceId, defaults.debug.showCalendarSourceId),
      showInternalStatus: bool(debug.showInternalStatus, defaults.debug.showInternalStatus),
      showProviderRawValue: bool(debug.showProviderRawValue, defaults.debug.showProviderRawValue),
      showRenderReferenceTime: bool(debug.showRenderReferenceTime, defaults.debug.showRenderReferenceTime),
      showReservationCount: bool(debug.showReservationCount, defaults.debug.showReservationCount),
    },
    featureFlags: {
      roomDetailPanel: bool(flags.roomDetailPanel, false),
      roomCardPopover: bool(flags.roomCardPopover, false),
      experimentalFilters: bool(flags.experimentalFilters, false),
    },
  };
}

export function applyRoomDensityPreset(settings: DeveloperSettings, density: RoomDensity): DeveloperSettings {
  return { ...settings, roomOverview: { ...settings.roomOverview, density, ...ROOM_DENSITY_PRESETS[density] } };
}

export function resetDeveloperSettingsSection(settings: DeveloperSettings, section: "roomOverview" | "debug" | "featureFlags"): DeveloperSettings {
  return { ...settings, [section]: structuredClone(DEFAULT_DEVELOPER_SETTINGS[section]) };
}
