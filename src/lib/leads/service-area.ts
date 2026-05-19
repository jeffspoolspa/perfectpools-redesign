// Service-area lookup: a zip code maps to one of three offices, or out-of-area.
// Ported from maintenance_leads/src/lib/pricing.ts.
// IMPORTANT: keep zip lists in sync with that file until both repos consume
// this module directly.

import type { Office } from "./types";

const BRUNSWICK_ZIPS: ReadonlySet<string> = new Set([
  "31520", "31521", "31522", "31523", "31524", "31525",
  "31527", "31561", "31568",
  "31548", "31558", "31565", "31569",
]);

const RICHMOND_HILL_ZIPS: ReadonlySet<string> = new Set([
  "31324", "31328", "31405", "31406", "31407", "31408", "31409",
  "31410", "31411", "31412", "31414", "31415", "31416", "31419",
  "31421", "31302", "31312", "31313", "31314", "31315", "31316",
  "31320", "31321", "31323", "31326", "31327", "31329",
  "31301", "31305", "31309", "31319", "31331", "31333",
]);

// Note: 31548 and 31558 appear in both St. Marys and Brunswick sets. Brunswick
// wins because we check it first below — matches existing maintenance_leads
// behaviour. Worth confirming with ops which office actually owns these zips.
const ST_MARYS_ZIPS: ReadonlySet<string> = new Set([
  "31547", "31558", "31548",
]);

export interface ServiceAreaResult {
  inArea: boolean;
  office: Office | null;
}

export function checkServiceArea(zip: string): ServiceAreaResult {
  const z = (zip ?? "").trim().slice(0, 5);
  if (BRUNSWICK_ZIPS.has(z)) return { inArea: true, office: "brunswick" };
  if (ST_MARYS_ZIPS.has(z)) return { inArea: true, office: "st_marys" };
  if (RICHMOND_HILL_ZIPS.has(z)) return { inArea: true, office: "richmond_hill" };

  // Fallback: any 313xx-315xx coastal-GA zip → Richmond Hill office.
  // Matches the catch-all in maintenance_leads/src/lib/pricing.ts.
  if (z.length === 5 && z.startsWith("31")) {
    const n = parseInt(z, 10);
    if (!Number.isNaN(n) && n >= 31300 && n <= 31599) {
      return { inArea: true, office: "richmond_hill" };
    }
  }

  return { inArea: false, office: null };
}
