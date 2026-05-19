// Per-visit pricing for maintenance leads.
// Mirrors maintenance_leads/src/lib/pricing.ts.
//
// Rules (as of the schema in place when this was written):
//   - Primary body sets the base rate.
//   - Each additional body adds a flat surcharge.
//   - Monthly deposit = perVisit * visits_per_week * 4.

import type { BodyType, VisitsPerWeek } from "./types";

export const BASE_PRICES: Readonly<Record<BodyType, number>> = {
  pool: 50,
  spa: 45,
  fountain: 35,
};

export const ADDITIONAL_BODY_SURCHARGE = 10;

export const DEFAULT_BASE_PRICE = 50;

export interface QuoteInput {
  primaryBodyType: BodyType;
  additionalBodyCount: number;
  visitsPerWeek: VisitsPerWeek;
}

export interface QuoteOutput {
  perVisit: number;
  visitsPerMonth: number;
  firstMonthsDeposit: number;
}

export function calculateQuote(input: QuoteInput): QuoteOutput {
  const base = BASE_PRICES[input.primaryBodyType] ?? DEFAULT_BASE_PRICE;
  const perVisit = base + Math.max(0, input.additionalBodyCount) * ADDITIONAL_BODY_SURCHARGE;
  const visitsPerMonth = input.visitsPerWeek * 4;
  const firstMonthsDeposit = perVisit * visitsPerMonth;
  return { perVisit, visitsPerMonth, firstMonthsDeposit };
}
