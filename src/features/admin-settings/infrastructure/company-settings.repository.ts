import "server-only";

import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY_SETTINGS, withCompanySettingsDefaults, type CompanySettingsValues } from "../domain/company-settings";

const settingsSelect = {
  timezone: true,
  defaultCheckInTime: true,
  defaultCheckOutTime: true,
  nextReservationDisplayDays: true,
  showFutureReservationsAsVacant: true,
  showBlockedAsRoomStatus: true,
  conflictDisplayLabel: true,
  guestFallbackMode: true,
  showNextReservationOnVacant: true,
  cleaningStatusEnabled: true,
  inspectionStatusEnabled: true,
  autoMarkCleaningRequired: true,
  showSyncFailureWarnings: true,
  showSyncSuccessMessage: true,
  recentSyncLogLimit: true,
} as const;

export function listSettingsCompanies(companyIds?: readonly string[]) {
  return prisma.company.findMany({
    where: companyIds ? { id: { in: [...companyIds] } } : undefined,
    select: { id: true, name: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getOrCreateCompanySettings(companyId: string): Promise<CompanySettingsValues> {
  const settings = await prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, ...DEFAULT_COMPANY_SETTINGS },
    update: {},
    select: settingsSelect,
  });
  return withCompanySettingsDefaults(settings);
}

export async function findCompanySettings(companyId: string): Promise<CompanySettingsValues> {
  const settings = await prisma.companySettings.findUnique({ where: { companyId }, select: settingsSelect });
  return withCompanySettingsDefaults(settings);
}

export async function upsertCompanySettings(companyId: string, settings: CompanySettingsValues): Promise<CompanySettingsValues> {
  return prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, ...settings },
    update: settings,
    select: settingsSelect,
  });
}

export async function companyExistsForSettings(companyId: string) {
  return Boolean(await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }));
}
