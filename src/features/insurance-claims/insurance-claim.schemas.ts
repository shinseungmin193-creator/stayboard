import { z } from "zod";
import { INSURANCE_CLAIM_TYPES } from "./domain/insurance-claim";

const claimType = z.enum(INSURANCE_CLAIM_TYPES);

export const createInsuranceClaimSchema = z.object({
  propertyId: z.string().trim().min(1),
  roomId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(2000),
  types: z.array(claimType).max(INSURANCE_CLAIM_TYPES.length).transform((items) => [...new Set(items)]).optional().default([]),
});

export const submitInsuranceClaimSchema = z.object({
  id: z.string().trim().min(1),
  types: z.array(claimType).min(1).max(INSURANCE_CLAIM_TYPES.length).transform((items) => [...new Set(items)]),
});

export const completeInsurancePayoutSchema = z.object({
  id: z.string().trim().min(1),
  paidAmount: z.coerce.number().int().positive().max(2_000_000_000),
});

export const deleteInsuranceClaimSchema = z.object({
  id: z.string().trim().min(1),
});

