import {
  DASHBOARD_CARD_BY_ID,
  STAFF_MOBILE_DASHBOARD_CARD_IDS,
  type DashboardCardId,
} from "../../dashboard/dashboard-card-policy";

export interface DashboardPreferenceValue {
  cardOrder: DashboardCardId[];
  hiddenCardIds: DashboardCardId[];
}

export const DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE: DashboardPreferenceValue = {
  cardOrder: [...STAFF_MOBILE_DASHBOARD_CARD_IDS],
  hiddenCardIds: STAFF_MOBILE_DASHBOARD_CARD_IDS.filter(
    (id) => !DASHBOARD_CARD_BY_ID[id].staffMobileDefaultVisible,
  ),
};

const allowedIds = new Set<DashboardCardId>(STAFF_MOBILE_DASHBOARD_CARD_IDS);

function normalizeIds(value: unknown): DashboardCardId[] {
  if (!Array.isArray(value)) return [];
  const result: DashboardCardId[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowedIds.has(item as DashboardCardId)) continue;
    const id = item as DashboardCardId;
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

export function normalizeStaffMobileDashboardPreference(input: {
  cardOrder?: unknown;
  hiddenCardIds?: unknown;
} | null | undefined): DashboardPreferenceValue {
  const storedOrder = normalizeIds(input?.cardOrder);
  const cardOrder = [
    ...storedOrder,
    ...STAFF_MOBILE_DASHBOARD_CARD_IDS.filter((id) => !storedOrder.includes(id)),
  ];
  const hiddenCardIds = normalizeIds(input?.hiddenCardIds).filter((id) => cardOrder.includes(id));
  const visibleCount = cardOrder.length - hiddenCardIds.length;
  return visibleCount > 0
    ? { cardOrder, hiddenCardIds }
    : { ...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE, cardOrder: [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.cardOrder], hiddenCardIds: [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.hiddenCardIds] };
}

export function validateStaffMobileDashboardPreference(input: unknown): input is DashboardPreferenceValue {
  if (!input || typeof input !== "object") return false;
  const value = input as Partial<DashboardPreferenceValue>;
  if (!Array.isArray(value.cardOrder) || !Array.isArray(value.hiddenCardIds)) return false;
  if (value.cardOrder.length !== STAFF_MOBILE_DASHBOARD_CARD_IDS.length) return false;
  if (new Set(value.cardOrder).size !== value.cardOrder.length) return false;
  if (new Set(value.hiddenCardIds).size !== value.hiddenCardIds.length) return false;
  if (!value.cardOrder.every((id) => allowedIds.has(id))) return false;
  if (!value.hiddenCardIds.every((id) => allowedIds.has(id) && value.cardOrder!.includes(id))) return false;
  return value.cardOrder.length - value.hiddenCardIds.length > 0;
}

export function getVisibleStaffMobileDashboardCardIds(input: {
  cardOrder?: unknown;
  hiddenCardIds?: unknown;
} | null | undefined): DashboardCardId[] {
  const preference = normalizeStaffMobileDashboardPreference(input);
  return preference.cardOrder.filter((id) => !preference.hiddenCardIds.includes(id));
}

export function canManageStaffMobileDashboardPreference(context: {
  actualRole: string;
  effectiveRole: string;
  isRoleSwitchActive: boolean;
}) {
  return context.actualRole === "DEVELOPER"
    && context.effectiveRole === "DEVELOPER"
    && !context.isRoleSwitchActive;
}
