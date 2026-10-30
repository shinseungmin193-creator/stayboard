import type { InsuranceClaimType } from "@/lib/generated/prisma/enums";

export const INSURANCE_CLAIM_TYPES = ["FIRE_INSURANCE", "AIRBNB", "BOOKING", "AGODA", "EXPEDIA"] as const satisfies readonly InsuranceClaimType[];

export const INSURANCE_CLAIM_TYPE_LABELS = {
  FIRE_INSURANCE: "화재보험",
  AIRBNB: "에어비앤비",
  BOOKING: "부킹",
  AGODA: "아고다",
  EXPEDIA: "익스피디아",
} as const satisfies Record<InsuranceClaimType, string>;

export function isInsuranceClaimType(value: unknown): value is InsuranceClaimType {
  return typeof value === "string" && INSURANCE_CLAIM_TYPES.includes(value as InsuranceClaimType);
}

