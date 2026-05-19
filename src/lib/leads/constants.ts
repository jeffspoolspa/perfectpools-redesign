// Allowed value sets and labels for the leads module.
// Kept as plain frozen sets / records so they're tree-shakable and runtime-safe.

import type {
  BodyType,
  LeadSource,
  Office,
  PoolCondition,
  AccountType,
  VisitsPerWeek,
} from "./types";

export const ALLOWED_BODY_TYPES: ReadonlySet<BodyType> = new Set<BodyType>([
  "pool",
  "spa",
  "fountain",
]);

export const ALLOWED_CONDITIONS: ReadonlySet<PoolCondition> = new Set<PoolCondition>([
  "good",
  "needs_repair",
  "green_pool",
]);

export const ALLOWED_SOURCES: ReadonlySet<LeadSource> = new Set<LeadSource>([
  "website",
  "phone",
  "referral",
  "internal",
  "google",
  "nextdoor",
  "social_media",
]);

export const ALLOWED_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set<AccountType>([
  "residential",
  "commercial",
]);

export const ALLOWED_VISITS_PER_WEEK: ReadonlySet<VisitsPerWeek> = new Set<VisitsPerWeek>([
  0.5,
  1,
  2,
]);

export const OFFICE_LABELS: Record<Office, string> = {
  richmond_hill: "Richmond Hill",
  brunswick: "Brunswick",
  st_marys: "St. Marys",
};

export const DEFAULT_STATE = "GA";

// How long a resume token is valid for after issuance.
export const RESUME_TOKEN_TTL_DAYS = 14;
